// Etapa 39: frontend em React + TypeScript (Vite), página a página, com pré-render.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { seedProducts } from "../src/services/seed-products.js";
import { cacheControl } from "../src/http/static.js";

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/index.html", root));

test("cada página React tem HTML com #root, entrada própria e componente no pré-render", async () => {
  const htmls = (await readdir(new URL("web/", root))).filter((f) => f.endsWith(".html"));
  assert.ok(htmls.includes("index.html"));
  const registry = await read("web/src/pages/index.ts");
  for (const file of htmls) {
    const name = file.replace(/\.html$/, "");
    const html = await read(`web/${file}`);
    assert.match(html, /<div id="root"><\/div>/, file);
    assert.match(html, new RegExp(`<script type="module" src="/src/entries/${name}\\.tsx"></script>`), file);
    assert.ok(existsSync(new URL(`web/src/entries/${name}.tsx`, root)), `entrada de ${name}`);
    assert.match(registry, new RegExp(`(?:\\b|")${name}"?: `), `pré-render de ${name}`);
    // Tema salvo aplicado antes do CSS (que o Vite injeta depois deste script).
    assert.match(html, /<script src="\/js\/theme-init\.js"><\/script>/, file);
    assert.doesNotMatch(html, /\/js\/app\.js/, `${file} não carrega mais o script antigo`);
  }
});

test("código React segue as regras de texto da loja (sem aviso de site de teste)", async () => {
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) await scan(path);
      else if (/\.(tsx?|css|html)$/.test(entry.name))
        assert.doesNotMatch(await readFile(path, "utf8"), /demonstr|simulad|nenhuma\s+cobrança|sem\s+cobrança/i, entry.name);
    }
  }
  await scan(new URL("web/", root));
});

test("build: arquivos com hash têm cache longo; Render, Docker e CI geram o frontend", async () => {
  assert.equal(cacheControl("/srv/dist/app/index-Dxp1efvZ.js"), "public, max-age=31536000, immutable");
  assert.equal(cacheControl("/srv/dist/app/index-Z2_zcK6g.css"), "public, max-age=31536000, immutable");
  assert.equal(cacheControl("/srv/public/js/theme-init.js"), "no-cache");
  assert.equal(cacheControl("/srv/dist/index.html"), "no-cache");
  const [pkg, render, docker, ci, ignore] = await Promise.all(["package.json", "render.yaml", "Dockerfile", ".github/workflows/quality.yml", ".gitignore"].map(read));
  const { scripts, dependencies, devDependencies } = JSON.parse(pkg);
  assert.match(scripts.build, /vite build/);
  assert.match(scripts.build, /prerender/);
  assert.ok(dependencies.react && dependencies["react-dom"] && devDependencies.vite && devDependencies.typescript);
  assert.match(render, /buildCommand: npm ci --include=dev && npm run build/);
  assert.match(docker, /COPY --from=web \/app\/dist \.\/dist/);
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm run build/);
  assert.match(ignore, /^dist\/$/m);
});

test("servidor entrega a página pré-renderizada do build, com SEO do servidor", { skip: !built && "rode npm run build" }, async (t) => {
  const storage = new MemoryStorage();
  const now = new Date().toISOString();
  for (const source of seedProducts.slice(0, 3)) {
    const data = { ...source };
    delete data.file;
    await storage.create("products", { ...data, partitionKey: "p", ativo: true, blobName: "", imageUrl: "", createdAt: now, updatedAt: now });
  }
  const server = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(`${base}/`).then((r) => r.text());
  assert.match(home, /<div id="root">(?:<link [^>]+>)?<div id="header">/, "HTML inicial já vem com o cabeçalho");
  assert.match(home, /Pular para o conteúdo/);
  assert.match(home, /Encontre a sua<br\/><em>frequência\.<\/em>/);
  assert.match(home, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/" \/>/, "SEO do servidor aplicado ao HTML do build");
  const script = home.match(/src="(\/app\/index-[\w-]+\.js)"/)?.[1];
  assert.ok(script, "script do build no HTML");
  const js = await fetch(base + script);
  assert.equal(js.status, 200);
  assert.equal(js.headers.get("cache-control"), "public, max-age=31536000, immutable");
  // Etapa 39.5: todas as páginas vêm do build (a ajuda também), sem o script antigo.
  const help = await fetch(`${base}/ajuda.html`).then((r) => r.text());
  assert.match(help, /<div id="root">(?:<link [^>]+>)?<div id="header">/);
  assert.doesNotMatch(help, /\/js\/app\.js/);
});
