import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { readFile } from "node:fs/promises";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { seedProducts } from "../src/services/seed-products.js";
import { encoding, cacheControl } from "../src/http/static.js";

// Requisição crua (sem descompressão automática) para conferir bytes e cabeçalhos.
function raw(port, path, headers = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("negociação de codificação e cache por tipo de arquivo", () => {
  const req = (value) => ({ get: () => value });
  assert.equal(encoding(req("gzip, deflate, br")), "br");
  assert.equal(encoding(req("gzip")), "gzip");
  assert.equal(encoding(req("br;q=0, gzip;q=0.5")), "gzip");
  assert.equal(encoding(req("identity")), null);
  assert.equal(encoding(req(undefined)), null);
  assert.equal(cacheControl("/x/style.css"), "no-cache");
  assert.equal(cacheControl("/x/index.html"), "no-cache");
  assert.equal(cacheControl("/x/sw.js"), "no-cache");
  assert.equal(cacheControl("/x/geist-latin.woff2"), "public, max-age=2592000");
  assert.equal(cacheControl("/x/icon-192.png"), "public, max-age=604800");
});

test("HTTP: arquivos e API comprimidos, revalidação por ETag e cache longo para fonte", async (t) => {
  const storage = new MemoryStorage();
  const now = new Date().toISOString();
  for (const source of seedProducts) {
    const data = { ...source };
    delete data.file;
    await storage.create("products", { ...data, partitionKey: "p", ativo: true, blobName: "", imageUrl: "", createdAt: now, updatedAt: now });
  }
  const server = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const css = await readFile(new URL("../public/css/style.css", import.meta.url));

  const br = await raw(port, "/css/style.css", { "Accept-Encoding": "gzip, br" });
  assert.equal(br.status, 200);
  assert.equal(br.headers["content-encoding"], "br");
  assert.match(br.headers.vary, /Accept-Encoding/);
  assert.equal(br.headers["cache-control"], "no-cache");
  assert.match(br.headers["content-type"], /^text\/css/);
  assert.ok(br.body.length < css.length / 3, `brotli: ${br.body.length} de ${css.length}`);
  assert.deepEqual(brotliDecompressSync(br.body), css);
  const again = await raw(port, "/css/style.css", { "Accept-Encoding": "br", "If-None-Match": br.headers.etag });
  assert.equal(again.status, 304);
  assert.equal(again.body.length, 0);

  const gz = await raw(port, "/", { "Accept-Encoding": "gzip" });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.match(gunzipSync(gz.body).toString(), /<html lang="pt-BR">/);
  const plain = await raw(port, "/css/style.css");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.headers["cache-control"], "no-cache");
  assert.deepEqual(plain.body, css);
  const head = await raw(port, "/js/app.js", { "Accept-Encoding": "br" }, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.headers["content-encoding"], "br");
  assert.equal(head.body.length, 0);

  const font = await raw(port, "/fonts/geist-latin.woff2", { "Accept-Encoding": "br" });
  assert.equal(font.headers["content-encoding"], undefined, "woff2 já é comprimido");
  assert.equal(font.headers["cache-control"], "public, max-age=2592000");
  assert.equal((await raw(port, "/assets/hero.svg", { "Accept-Encoding": "br" })).headers["cache-control"], "public, max-age=604800");
  assert.equal((await raw(port, "/..%2fpackage.json", { "Accept-Encoding": "br" })).status, 404);
  assert.equal((await raw(port, "/%2e%2e/package.json", { "Accept-Encoding": "br" })).status, 404);

  const api = await raw(port, "/api/products", { "Accept-Encoding": "gzip" });
  assert.equal(api.headers["content-encoding"], "gzip");
  assert.match(api.headers["content-type"], /^application\/json/);
  assert.equal(JSON.parse(gunzipSync(api.body)).data.length, seedProducts.length);
  const small = await raw(port, "/api/auth/session", { "Accept-Encoding": "gzip" });
  assert.equal(small.headers["content-encoding"], undefined, "respostas pequenas seguem sem compressão");
  assert.deepEqual(JSON.parse(small.body), { data: null });
});
