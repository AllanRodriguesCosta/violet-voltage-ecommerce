import test from "node:test";
import assert from "node:assert/strict";
import { unlink, writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { MemoryStorage } from "../src/repositories/memory.js";
import { seed, SeedInputError } from "../src/services/seed.js";
import { seedProducts, ORIGINAL_SEED_COUNT, expansionProducts } from "../src/services/seed-products.js";
const N = seedProducts.length;
import { createApp } from "../src/app.js";
import { productImage } from "../public/js/common.js";
import { seedFixture, fixturePng } from "./helpers/seed-fixture.js";

test("catálogo seed: IDs sequenciais únicos, arquivos e modelos únicos, preços e estoques", () => {
  assert.equal(ORIGINAL_SEED_COUNT, 22);
  assert.ok(N >= 60 && N <= 90, `catálogo com ${N} produtos`);
  assert.equal(new Set(seedProducts.map((p) => p.file)).size, N);
  assert.equal(new Set(seedProducts.map((p) => p.modelo)).size, N, "modelo identifica a ficha");
  assert.deepEqual(
    seedProducts.map((p) => p.rowKey),
    Array.from({ length: N }, (_, i) => `demo-${String(i + 1).padStart(3, "0")}`),
  );
  for (const [i, p] of seedProducts.entries()) {
    assert.ok(Number.isSafeInteger(p.priceCents) && p.priceCents > 0);
    assert.ok(p.descricao.length >= 10 && p.descricao.length <= 4000);
    if (i < ORIGINAL_SEED_COUNT) assert.ok(p.estoque >= 5 && p.estoque <= 30);
    else assert.ok(p.estoque >= 1 && p.estoque <= 50, p.modelo);
  }
  const count = (list) => list.reduce((c, p) => ({ ...c, [p.categoria]: (c[p.categoria] || 0) + 1 }), {});
  assert.deepEqual(count(seedProducts.slice(0, ORIGINAL_SEED_COUNT)), {
    Correias: 3,
    Amplificadores: 3,
    Pedais: 6,
    Guitarras: 3,
    Acessórios: 3,
    Cabos: 4,
  });
  assert.deepEqual(count(expansionProducts), {
    Guitarras: 17,
    Amplificadores: 10,
    Pedais: 15,
    Cabos: 4,
    Correias: 3,
    Acessórios: 10,
  });
  assert.ok(
    seedProducts
      .slice(0, ORIGINAL_SEED_COUNT)
      .filter((p) => p.categoria === "Guitarras")
      .every((p) => p.marca === "Violet Voltage"),
  );
  const brands = new Set(expansionProducts.map((p) => p.marca));
  assert.ok(brands.has("Violet Voltage") && brands.size >= 15, "mistura de marcas reais e própria");
  // Fotos novas: subpastas existentes e nomes simples, sem espaço nem acento.
  for (const p of expansionProducts)
    assert.match(p.file, /^(guitarras|amplificadores|pedais|cabos|correias|acessorios)\/[a-z0-9-]+\.png$/, p.file);
  assert.equal(seedProducts[3].marca, "VOX");
  assert.equal(seedProducts[10].modelo, "TONEX MultiFX");
  assert.equal(seedProducts[21].marca, "Ernie Ball");
});

test("migra demo-001 a demo-008 pela RowKey e preserva produtos, datas e blobs manuais", async (t) => {
  const options = await seedFixture(t);
  const storage = new MemoryStorage();
  const initialDate = "2025-01-01T00:00:00.000Z";
  for (let i = 1; i <= 8; i++)
    await storage.create("products", {
      partitionKey: `categoria-antiga-${i}`,
      rowKey: `demo-${String(i).padStart(3, "0")}`,
      modelo: "Antigo",
      categoria: "Categoria antiga",
      ativo: false,
      blobName: "manual/imagem-anterior.png",
      createdAt: initialDate,
      updatedAt: initialDate,
    });
  const manual = {
    partitionKey: "guitarras",
    rowKey: "produto-manual",
    modelo: "Preservado",
    priceCents: 55555,
    estoque: 13,
    blobName: "manual/foto.png",
    imageUrl: "/api/images/produto-manual",
    ativo: true,
  };
  await storage.create("products", manual);
  const before = await storage.get("products", "guitarras", "produto-manual");
  await storage.upload("manual/foto.png", fixturePng, "image/png");
  await storage.upload("manual/imagem-anterior.png", fixturePng, "image/png");
  let uploads = 0;
  const upload = storage.upload.bind(storage);
  storage.upload = async (name, buffer, type) => {
    uploads++;
    assert.match(name, /^seed\/violet-voltage\/demo-\d{3}\.png$/);
    assert.equal(type, "image/png");
    assert.deepEqual(buffer, fixturePng);
    await upload(name, buffer, type);
  };
  storage.removeBlob = async () => assert.fail("Seed não deve remover blobs.");
  const firstDate = "2026-01-01T00:00:00.000Z";
  assert.deepEqual(
    await seed(storage, { ...options, now: () => new Date(firstDate) }),
    { created: N - 8, updated: 8, uploaded: N, total: N, ignored: [] },
  );
  assert.equal(uploads, N);
  const first = await storage.list("products");
  assert.equal(first.length, N + 1);
  for (let i = 0; i < N; i++) {
    const expected = seedProducts[i];
    const product = first.find((p) => p.rowKey === expected.rowKey);
    assert.equal(product.modelo, expected.modelo);
    assert.equal(product.categoria, expected.categoria);
    assert.equal(product.ativo, true);
    assert.equal(product.createdAt, i < 8 ? initialDate : firstDate);
    assert.equal(product.updatedAt, firstDate);
    if (i < 8) assert.equal(product.partitionKey, `categoria-antiga-${i + 1}`);
    assert.match(
      product.imageUrl,
      new RegExp(`^/api/images/${product.rowKey}\\?v=[a-f0-9]{16}$`),
    );
  }
  const secondDate = "2026-01-02T00:00:00.000Z";
  assert.deepEqual(
    await seed(storage, { ...options, now: () => new Date(secondDate) }),
    { created: 0, updated: N, uploaded: N, total: N, ignored: [] },
  );
  const second = await storage.list("products");
  assert.equal(second.length, N + 1);
  assert.equal(new Set(second.map((p) => p.rowKey)).size, N + 1);
  assert.equal(storage.blobs.size, N + 2);
  for (const p of second.filter((p) => p.rowKey.startsWith("demo-"))) {
    const original = first.find((x) => x.rowKey === p.rowKey);
    assert.equal(p.createdAt, original.createdAt);
    assert.equal(p.updatedAt, secondDate);
    assert.equal(p.blobName, original.blobName);
    assert.equal(p.imageUrl, original.imageUrl);
  }
  assert.deepEqual(
    await storage.get("products", "guitarras", "produto-manual"),
    before,
  );
  assert.deepEqual((await storage.blob("manual/foto.png")).buffer, fixturePng);
  assert.deepEqual(
    (await storage.blob("manual/imagem-anterior.png")).buffer,
    fixturePng,
  );
});

test("pasta ausente, última imagem ausente e PNG inválido impedem qualquer gravação", async (t) => {
  const options = await seedFixture(t);
  const storage = new MemoryStorage();
  let mutations = 0;
  storage.upload =
    storage.create =
    storage.save =
      async () => {
        mutations++;
      };
  await assert.rejects(
    seed(storage, {
      assetsDirectory: join(options.assetsDirectory, "ausente"),
    }),
    (e) => e instanceof SeedInputError && e.message.includes(`${N} imagens`),
  );
  const last = join(options.assetsDirectory, seedProducts.at(-1).file);
  await unlink(last);
  await assert.rejects(seed(storage, options), (e) => {
    assert.match(e.message, new RegExp(`faltam 1 de ${N} imagens`));
    assert.ok(e.message.includes(seedProducts.at(-1).file));
    assert.match(e.message, /--parcial/);
    assert.match(e.message, /Nenhum produto ou imagem foi alterado/);
    return true;
  });
  await writeFile(last, "PNG inválido");
  await assert.rejects(seed(storage, options), /não é um PNG válido/);
  assert.equal(mutations, 0);
});

test("modo parcial carrega só produtos com foto e lista os que faltam; sem nenhuma foto, interrompe", async (t) => {
  const options = await seedFixture(t);
  const storage = new MemoryStorage();
  const withoutPhoto = expansionProducts.slice(0, 3);
  for (const p of withoutPhoto) await unlink(join(options.assetsDirectory, p.file));
  // Sem o modo parcial, a falta lista todos os arquivos ausentes e nada é gravado.
  await assert.rejects(seed(storage, options), (e) => withoutPhoto.every((p) => e.message.includes(p.file)) && /faltam 3 de/.test(e.message));
  assert.equal((await storage.list("products")).length, 0);
  const result = await seed(storage, { ...options, partial: true });
  assert.deepEqual(result, { created: N - 3, updated: 0, uploaded: N - 3, total: N, ignored: withoutPhoto.map((p) => p.file) });
  const ids = new Set((await storage.list("products")).map((p) => p.rowKey));
  assert.ok(withoutPhoto.every((p) => !ids.has(p.rowKey)));
  // Quando as fotos chegam, o mesmo comando completa o catálogo sem duplicar.
  for (const p of withoutPhoto) await writeFile(join(options.assetsDirectory, p.file), fixturePng);
  assert.deepEqual(await seed(storage, { ...options, partial: true }), { created: 3, updated: N - 3, uploaded: N, total: N, ignored: [] });
  assert.equal((await storage.list("products")).length, N);
  // Pasta vazia: modo parcial não "conclui" sem nenhum produto.
  const empty = join(options.assetsDirectory, "vazia");
  await mkdir(empty);
  await assert.rejects(seed(new MemoryStorage(), { assetsDirectory: empty, partial: true }), new RegExp(`faltam ${N} de ${N}`));
});

test("duplicação antiga de RowKey é detectada antes de alterar dados", async (t) => {
  const options = await seedFixture(t);
  const storage = new MemoryStorage();
  await storage.create("products", {
    partitionKey: "antiga",
    rowKey: "demo-001",
  });
  await storage.create("products", {
    partitionKey: "nova",
    rowKey: "demo-001",
  });
  await assert.rejects(seed(storage, options), /mais de uma partição/);
  assert.equal(storage.blobs.size, 0);
  assert.equal((await storage.list("products")).length, 2);
});

test("todos os produtos do manifesto e suas imagens continuam acessíveis por HTTP após repetir o seed", async (t) => {
  const storage = new MemoryStorage();
  const options = await seedFixture(t);
  await seed(storage, options);
  await seed(storage, options);
  const server = createApp(storage, {
    memory: true,
    production: false,
    secret: randomBytes(48).toString("hex"),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.data.status, "ok");
  assert.equal(Object.hasOwn(health.data, "payment"), false);
  const products = (await (await fetch(base + "/api/products")).json()).data;
  assert.equal(products.length, N);
  for (const product of products) {
    const detail = await fetch(`${base}/api/products/${product.id}`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).data.id, product.id);
    const image = await fetch(new URL(product.imageUrl, base));
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type"), /^image\/png/);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), fixturePng);
    assert.equal(productImage(product), product.imageUrl);
  }
  assert.equal(productImage({ categoria: "Pedais" }), "/assets/pedal.svg");
  assert.equal(
    productImage({ id: "p1", blobName: "photo.png" }),
    "/api/images/p1",
  );
});

test("arquivos públicos não contêm avisos de pagamento simulado", async () => {
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      if (!/\.(html|js|css|svg)$/.test(entry.name)) continue;
      assert.doesNotMatch(
        await readFile(path, "utf8"),
        /demonstr|simulad|nenhuma\s+cobrança|sem\s+cobrança|nenhum\s+valor\s+foi\s+cobrado/i,
        path,
      );
    }
  }
  await scan(fileURLToPath(new URL("../public/", import.meta.url)));
});
