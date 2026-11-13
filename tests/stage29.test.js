import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { seedProducts } from "../src/services/seed-products.js";
import { seedGallery, galleryFiles, galleryColors } from "../src/services/seed-gallery.js";
import { seed, missingGalleryFiles, SeedInputError } from "../src/services/seed.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { photosOf, itemColor, itemImage, colorNames, productImage } from "../public/js/common.js";
import { seedFixture, fixturePng } from "./helpers/seed-fixture.js";
import { storeFixture } from "./helpers/api-fixture.js";

const N = seedProducts.length;
const byModel = (modelo) => seedProducts.find((p) => p.modelo === modelo);

test("galeria do seed: cada modelo existe, arquivos simples e a frente da primeira cor é a foto principal", () => {
  for (const [modelo, g] of Object.entries(seedGallery)) {
    const p = byModel(modelo);
    assert.ok(p, `${modelo} não está no catálogo`);
    const files = galleryFiles(p);
    assert.equal(files[0].file, p.file, modelo);
    assert.equal(new Set(files.map((f) => f.file)).size, files.length, `${modelo}: arquivos repetidos`);
    for (const f of files) assert.match(f.file, /^[a-z]+\/[a-z0-9-]+(\/[a-z0-9-]+)?\.png$/, f.file);
    for (const c of g.cores || []) assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${modelo} ${c.nome}`);
  }
  const crush = galleryFiles(byModel("Crush 20RT"));
  assert.equal(crush.length, 9);
  assert.deepEqual(crush.slice(0, 4).map((f) => [f.cor, f.vista]), [["Laranja", "frente"], ["Laranja", "topo"], ["Laranja", "costas"], ["Preto", "frente"]]);
  assert.equal(crush[3].file, "amplificadores/orange-crush-20rt/preto-frente.png");
  assert.deepEqual(galleryColors("Crush 20RT").map((c) => c.nome), ["Laranja", "Preto", "Branco"]);
  // Amarelo do Hot Rod só tem frente e topo.
  assert.deepEqual(galleryFiles(byModel("Hot Rod Deluxe IV")).filter((f) => f.cor === "Amarelo").map((f) => f.vista), ["frente", "topo"]);
  assert.deepEqual(galleryFiles(byModel("Katana-50 MkII")).map((f) => f.file), [
    "amplificadores/boss-katana-50-mkii.png",
    "amplificadores/boss-katana-50-mkii/topo.png",
    "amplificadores/boss-katana-50-mkii/costas.png",
  ]);
  assert.deepEqual(galleryFiles(byModel("ST Electric Pink")), [{ file: byModel("ST Electric Pink").file, cor: null, vista: "frente" }]);
  assert.deepEqual(galleryColors("ST Electric Pink"), []);
});

test("seed envia as fotos extras, grava cores e vistas e segue sem as extras que faltam", async (t) => {
  const { assetsDirectory } = await seedFixture(t);
  const crush = byModel("Crush 20RT");
  const katana = byModel("Katana-50 MkII");
  // Crush completo; Katana só com o topo; Blues Junior só com a cor laranja (sem a preta extra).
  const extras = [...galleryFiles(crush).slice(1), galleryFiles(katana)[1], ...galleryFiles(byModel("Blues Junior IV")).filter((f) => f.cor === "Laranja")];
  for (const f of extras) {
    await mkdir(dirname(join(assetsDirectory, f.file)), { recursive: true });
    await writeFile(join(assetsDirectory, f.file), fixturePng);
  }
  const storage = new MemoryStorage();
  const result = await seed(storage, { assetsDirectory });
  assert.deepEqual(result, { created: N, updated: 0, uploaded: N + extras.length, total: N, ignored: [] });
  const product = async (p) => (await storage.list("products")).find((x) => x.rowKey === p.rowKey);
  const saved = await product(crush);
  assert.equal(saved.fotos.length, 9);
  assert.deepEqual(saved.fotos[0], { blobName: saved.blobName, url: saved.imageUrl, cor: "Laranja", vista: "frente" });
  assert.match(saved.fotos[4].url, /^\/api\/images\/demo-043\/4\?v=[0-9a-f]{16}$/);
  assert.deepEqual(saved.cores.map((c) => c.nome), ["Laranja", "Preto", "Branco"]);
  assert.ok(await storage.blob(saved.fotos[8].blobName));
  const k = await product(katana);
  assert.deepEqual(k.fotos.map((f) => f.vista), ["frente", "topo"]);
  assert.equal(k.cores, null, "sem cores");
  const blues = await product(byModel("Blues Junior IV"));
  assert.deepEqual(blues.cores.map((c) => c.nome), ["Preto", "Laranja"], "cor com foto aparece");
  assert.equal((await product(byModel("ST Electric Pink"))).fotos, null, "uma foto só: sem galeria");
  const missing = await missingGalleryFiles(assetsDirectory);
  assert.ok(missing.includes("amplificadores/boss-katana-50-mkii/costas.png"));
  assert.ok(!missing.some((f) => f.startsWith("amplificadores/orange-crush-20rt/")));
  // Rodar de novo não duplica nada.
  assert.equal((await seed(storage, { assetsDirectory })).updated, N);
  assert.equal((await storage.list("products")).length, N);
});

test("foto extra que não é PNG interrompe o seed antes de gravar qualquer coisa", async (t) => {
  const { assetsDirectory } = await seedFixture(t);
  const extra = galleryFiles(byModel("AC30C2"))[4];
  await mkdir(dirname(join(assetsDirectory, extra.file)), { recursive: true });
  await writeFile(join(assetsDirectory, extra.file), "não é imagem");
  const storage = new MemoryStorage();
  await assert.rejects(seed(storage, { assetsDirectory }), (e) => e instanceof SeedInputError && e.message.includes(extra.file));
  assert.equal((await storage.list("products")).length, 0);
});

// Loja com o Crush 20RT em três cores (3 fotos cada) e a Katana com duas vistas.
async function galleryStore(t) {
  const cores = galleryColors("Crush 20RT");
  const fotos = galleryFiles(byModel("Crush 20RT")).map((f, i) => ({ blobName: `g/demo-043/${i}.png`, url: `/api/images/demo-043${i ? `/${i}` : ""}?v=t`, cor: f.cor, vista: f.vista }));
  const store = await storeFixture(t, {
    overrides: {
      "demo-043": { blobName: fotos[0].blobName, imageUrl: fotos[0].url, fotos, cores },
      "demo-044": { fotos: [{ blobName: "", url: "/assets/amp.svg", cor: null, vista: "frente" }, { blobName: "g/k/1.png", url: "/api/images/demo-044/1?v=t", cor: null, vista: "topo" }], cores: null },
    },
  });
  for (const f of fotos) await store.storage.upload(f.blobName, fixturePng, "image/png");
  await store.storage.upload("g/k/1.png", fixturePng, "image/png");
  return store;
}

test("API: produto traz galeria sem nomes internos e cada foto tem endereço próprio", async (t) => {
  const { call, url } = await galleryStore(t);
  const p = (await call("/products/demo-043", { method: "GET" })).body.data;
  assert.equal(p.fotos.length, 9);
  for (const f of p.fotos) assert.deepEqual(Object.keys(f).sort(), ["cor", "url", "vista"]);
  assert.deepEqual(p.cores.map((c) => c.nome), ["Laranja", "Preto", "Branco"]);
  const image = await fetch(`${url}/images/demo-043/7`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal((await fetch(`${url}/images/demo-044/1`)).status, 200);
  for (const bad of ["demo-043/9", "demo-043/abc", "demo-043/-1", "demo-001/1", "demo-044/0"]) assert.equal((await fetch(`${url}/images/${bad}`)).status, 404, bad);
  const list = (await call("/products", { method: "GET" })).body.data;
  assert.equal(list.find((x) => x.id === "demo-001").fotos, null);
});

test("cor no carrinho e no pedido: só as do produto, padrão quando não escolhe", async (t) => {
  const { call, register } = await galleryStore(t);
  const quote = async (items) => call("/checkout/quote", { body: { items } });
  assert.equal((await quote([{ id: "demo-043", quantidade: 1, cor: "Branco" }])).body.data.items[0].cor, "Branco");
  assert.equal((await quote([{ id: "demo-043", quantidade: 1 }])).body.data.items[0].cor, "Laranja");
  assert.equal((await quote([{ id: "demo-043", quantidade: 1, cor: "Roxo" }])).body.data.items[0].cor, "Laranja", "cor fora de linha vira a padrão");
  assert.equal((await quote([{ id: "demo-043", quantidade: 1, cor: 7 }])).status, 400);
  assert.equal((await quote([{ id: "demo-043", quantidade: 1, cor: "x".repeat(31) }])).status, 400);
  assert.equal((await quote([{ id: "demo-001", quantidade: 1, cor: "Preto" }])).body.data.items[0].cor, undefined, "produto sem cores");
  const cookie = await register(`cor-${randomUUID()}@teste.test`);
  const order = (await call("/orders", { cookie, body: { items: [{ id: "demo-043", quantidade: 1, cor: "Preto" }, { id: "demo-001", quantidade: 1 }], pagamento: "pix", entrega: "retirada", endereco: "Retirada na loja", requestId: randomUUID() } })).body.data;
  assert.equal(order.itens[0].cor, "Preto");
  assert.equal(order.itens[1].cor, undefined);
  const mine = (await call("/orders", { method: "GET", cookie })).body.data[0];
  assert.equal(mine.itens.find((i) => i.id === "demo-043").cor, "Preto");
});

test("vitrine: fotos da cor escolhida, cor padrão e imagem do item", () => {
  const fotos = galleryFiles(byModel("Crush 20RT")).map((f, i) => ({ url: `/f/${i}`, cor: f.cor, vista: f.vista }));
  const p = { id: "demo-043", categoria: "Amplificadores", blobName: "x", imageUrl: "/f/0", fotos, cores: galleryColors("Crush 20RT") };
  assert.deepEqual(colorNames(p), ["Laranja", "Preto", "Branco"]);
  assert.deepEqual(photosOf(p, "Branco").map((f) => f.url), ["/f/6", "/f/7", "/f/8"]);
  assert.deepEqual(photosOf(p, "Inexistente").map((f) => f.url), ["/f/0", "/f/1", "/f/2"]);
  assert.equal(itemColor(p, undefined), "Laranja");
  assert.equal(itemColor(p, "Preto"), "Preto");
  assert.equal(itemImage(p, "Preto"), "/f/3");
  const plain = { id: "demo-001", categoria: "Guitarras", blobName: "", imageUrl: "" };
  assert.deepEqual(photosOf(plain), [{ url: productImage(plain), cor: null, vista: "frente" }]);
  assert.equal(itemColor(plain, "Preto"), null);
  assert.equal(itemImage(plain), productImage(plain));
  // Vistas sem cor (Katana): todas as fotos.
  const katana = { ...plain, fotos: [{ url: "/k/0", cor: null, vista: "frente" }, { url: "/k/1", cor: null, vista: "topo" }], cores: null };
  assert.equal(photosOf(katana).length, 2);
});
