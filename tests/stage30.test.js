import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { seedProducts } from "../src/services/seed-products.js";
import { galleryFiles } from "../src/services/seed-gallery.js";
import { syncCatalogPhotos, syncSummary, repoAssetsDirectory } from "../src/services/catalog-sync.js";
import { seed, missingGalleryFiles } from "../src/services/seed.js";
import { configuration } from "../src/config/index.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { fixturePng } from "./helpers/seed-fixture.js";

const N = seedProducts.length;
const byModel = (modelo) => seedProducts.find((p) => p.modelo === modelo);
const otherPng = Buffer.concat([fixturePng, Buffer.from("versao-2")]);
async function folder(t, files) {
  const dir = await mkdtemp(join(tmpdir(), "violet-voltage-catalogo-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [file, content] of files) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), content);
  }
  return dir;
}
const product = async (storage, id) => (await storage.list("products")).find((p) => p.rowKey === id);

test("fotos versionadas: todas as do repositório estão no manifesto e são PNG", async () => {
  const known = new Set(seedProducts.flatMap((p) => galleryFiles(p).map((f) => f.file)));
  let count = 0;
  for (const p of seedProducts)
    for (const f of galleryFiles(p)) {
      let buffer;
      try {
        buffer = await readFile(join(repoAssetsDirectory, f.file));
      } catch {
        continue;
      }
      count++;
      assert.ok(known.has(f.file));
      assert.ok(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), f.file);
      assert.ok(buffer.length <= 1024 * 1024, `${f.file} acima de 1 MB`);
    }
  assert.ok(count >= 80, `${count} fotos no repositório`);
  assert.ok((await stat(join(repoAssetsDirectory, "amplificadores/orange-crush-20rt/branco-topo.png"))).isFile());
});

test("ao iniciar: cadastra quem tem foto, atualiza só as fotos e respeita preço, estoque e foto do painel", async (t) => {
  const crush = byModel("Crush 20RT");
  const katana = byModel("Katana-50 MkII");
  const pedal = byModel("Tube Screamer TS9");
  const dir = await folder(t, [
    ...galleryFiles(crush).map((f) => [f.file, fixturePng]),
    [katana.file, fixturePng],
    [pedal.file, fixturePng],
    [byModel("AC30C2").file, Buffer.from("não é png")],
  ]);
  const storage = new MemoryStorage();
  const old = new Date("2026-01-01T00:00:00.000Z").toISOString();
  // Crush já no banco com foto antiga e preço/estoque mudados pelo administrador.
  await storage.create("products", { ...crush, file: undefined, partitionKey: "amplificadores", ativo: true, priceCents: 99900, estoque: 2, blobName: "seed/violet-voltage/demo-043.png", imageUrl: "/api/images/demo-043?v=antiga", createdAt: old, updatedAt: old });
  // Katana com foto enviada pelo painel.
  await storage.create("products", { ...katana, file: undefined, partitionKey: "amplificadores", ativo: true, blobName: "demo-044/manual.png", imageUrl: "/api/images/demo-044?v=manual", createdAt: old, updatedAt: old });
  const first = await syncCatalogPhotos(storage, { directory: dir });
  assert.deepEqual({ ...first, errors: first.errors.length }, { created: 1, photosUpdated: 1, unchanged: 0, withoutPhoto: N - 3, manualPhoto: 1, errors: 0 });
  const c = await product(storage, crush.rowKey);
  assert.equal(c.priceCents, 99900, "preço do painel mantido");
  assert.equal(c.estoque, 2, "estoque mantido");
  assert.equal(c.createdAt, old);
  assert.equal(c.fotos.length, 9);
  assert.deepEqual(c.cores.map((x) => x.nome), ["Laranja", "Preto", "Branco"]);
  assert.ok(await storage.blob(c.fotos[8].blobName));
  const k = await product(storage, katana.rowKey);
  assert.equal(k.blobName, "demo-044/manual.png", "foto do painel não é trocada");
  const p = await product(storage, pedal.rowKey);
  assert.equal(p.priceCents, pedal.priceCents);
  assert.equal(p.fotos, null);
  assert.match(p.imageUrl, /^\/api\/images\/demo-047\?v=[0-9a-f]{16}$/);
  assert.equal(await product(storage, "demo-042"), undefined, "PNG inválido não cadastra");
  assert.equal(await product(storage, "demo-001"), undefined, "sem foto no repositório não cadastra");
  // Sem mudança nas fotos, nada é gravado.
  const etag = (await product(storage, crush.rowKey)).etag;
  const again = await syncCatalogPhotos(storage, { directory: dir });
  assert.deepEqual([again.created, again.photosUpdated, again.unchanged], [0, 0, 2]);
  assert.equal((await product(storage, crush.rowKey)).etag, etag);
  // Foto trocada no repositório: nova versão no endereço.
  await writeFile(join(dir, pedal.file), otherPng);
  const third = await syncCatalogPhotos(storage, { directory: dir });
  assert.equal(third.photosUpdated, 1);
  assert.notEqual((await product(storage, pedal.rowKey)).imageUrl, p.imageUrl);
  assert.match(syncSummary(third), /^Fotos do catálogo: 0 produtos cadastrados, 1 com fotos atualizadas/);
});

test("uma falha não interrompe os outros produtos e vira aviso no resumo", async (t) => {
  const pedal = byModel("Tube Screamer TS9");
  const dir = await folder(t, [[pedal.file, fixturePng], [byModel("BD-2 Blues Driver").file, fixturePng]]);
  const storage = new MemoryStorage();
  const original = storage.create.bind(storage);
  storage.create = async (table, entity) => {
    if (entity.rowKey === pedal.rowKey) throw new Error("conflito simulado");
    return original(table, entity);
  };
  const result = await syncCatalogPhotos(storage, { directory: dir });
  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 1);
  assert.match(syncSummary(result), /Falhas: demo-047: conflito simulado/);
});

test("seed procura na pasta local e depois nas fotos do repositório", async (t) => {
  // Local: só as fotos que não estão no repositório; repositório: as demais.
  const inRepo = new Set();
  for (const p of seedProducts) {
    try {
      await stat(join(repoAssetsDirectory, p.file));
      inRepo.add(p.file);
    } catch {
      /* fica na pasta local */
    }
  }
  const local = await folder(t, seedProducts.filter((p) => !inRepo.has(p.file)).map((p) => [p.file, fixturePng]));
  const storage = new MemoryStorage();
  const result = await seed(storage, { assetsDirectory: local, fallbackDirectory: repoAssetsDirectory });
  assert.equal(result.created, N);
  assert.deepEqual(result.ignored, []);
  assert.ok(result.uploaded > N, "fotos extras da galeria vieram do repositório");
  assert.equal((await product(storage, "demo-043")).fotos.length, 9);
  assert.deepEqual(await missingGalleryFiles(local, repoAssetsDirectory), []);
  // Sem a pasta local, o repositório sozinho serve para o modo parcial.
  const only = await seed(new MemoryStorage(), { assetsDirectory: join(local, "nao-existe"), fallbackDirectory: repoAssetsDirectory, partial: true });
  assert.equal(only.created, inRepo.size);
});

test("CATALOG_SYNC=off desliga a carga das fotos ao iniciar", () => {
  assert.equal(configuration({ DEV_MEMORY_STORAGE: "true" }).catalogSync, true);
  assert.equal(configuration({ DEV_MEMORY_STORAGE: "true", CATALOG_SYNC: "off" }).catalogSync, false);
});
