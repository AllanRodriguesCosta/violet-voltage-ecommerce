import test from "node:test";
import assert from "node:assert/strict";
import { unlink, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { MemoryStorage, AzureStorage } from "../src/repositories/storage.js";
import { seed, SeedInputError } from "../src/services/seed.js";
import { seedProducts } from "../src/services/seed-products.js";
import { createApp } from "../src/app.js";
import { productImage } from "../public/js/common.js";
import { seedFixture, fixturePng } from "./helpers/seed-fixture.js";

test("catálogo seed: 22 IDs únicos, marcas, categorias, preços e estoques", () => {
  assert.equal(seedProducts.length, 22);
  assert.equal(new Set(seedProducts.map((p) => p.file)).size, 22);
  assert.deepEqual(
    seedProducts.map((p) => p.rowKey),
    Array.from(
      { length: 22 },
      (_, i) => `demo-${String(i + 1).padStart(3, "0")}`,
    ),
  );
  const counts = {};
  for (const p of seedProducts) {
    counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    assert.ok(Number.isSafeInteger(p.priceCents) && p.priceCents > 0);
    assert.ok(p.estoque >= 5 && p.estoque <= 30);
    assert.ok(p.descricao.length >= 10);
  }
  assert.deepEqual(counts, {
    Correias: 3,
    Amplificadores: 3,
    Pedais: 6,
    Guitarras: 3,
    Acessórios: 3,
    Cabos: 4,
  });
  assert.ok(
    seedProducts
      .filter((p) => p.categoria === "Guitarras")
      .every((p) => p.marca === "Violet Voltage"),
  );
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
    { created: 14, updated: 8, uploaded: 22, total: 22 },
  );
  assert.equal(uploads, 22);
  const first = await storage.list("products");
  assert.equal(first.length, 23);
  for (let i = 0; i < 22; i++) {
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
    { created: 0, updated: 22, uploaded: 22, total: 22 },
  );
  const second = await storage.list("products");
  assert.equal(second.length, 23);
  assert.equal(new Set(second.map((p) => p.rowKey)).size, 23);
  assert.equal(storage.blobs.size, 24);
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
    (e) => e instanceof SeedInputError && e.message.includes("22 imagens"),
  );
  const last = join(options.assetsDirectory, seedProducts.at(-1).file);
  await unlink(last);
  await assert.rejects(
    seed(storage, options),
    /Nenhum produto ou imagem foi alterado/,
  );
  await writeFile(last, "PNG inválido");
  await assert.rejects(seed(storage, options), /não é um PNG válido/);
  assert.equal(mutations, 0);
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

test("seed usa o mesmo contrato no adaptador Azure sem credenciais reais", async (t) => {
  const options = await seedFixture(t);
  const backing = new MemoryStorage();
  const storage = Object.create(AzureStorage.prototype);
  storage.tables = {
    products: {
      async *listEntities() {
        yield* await backing.list("products");
      },
      createEntity: (entity) => backing.create("products", entity),
      updateEntity: (entity, mode, options) => {
        assert.equal(mode, "Replace");
        return backing.save("products", entity, options.etag);
      },
    },
  };
  storage.container = {
    getBlockBlobClient: (name) => ({
      uploadData: (buffer, options) =>
        backing.upload(name, buffer, options.blobHTTPHeaders.blobContentType),
    }),
  };
  assert.equal((await seed(storage, options)).created, 22);
  assert.equal((await seed(storage, options)).updated, 22);
  assert.equal((await backing.list("products")).length, 22);
  assert.equal(backing.blobs.size, 22);
});

test("todos os 22 produtos e suas imagens continuam acessíveis por HTTP após repetir o seed", async (t) => {
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
  assert.equal(products.length, 22);
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
