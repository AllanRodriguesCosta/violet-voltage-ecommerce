// Etapa 39.5: ajuda, termos, privacidade, 404, offline e painel em React; minicarrinho, busca,
// avisos, comparação, visualização rápida e assistente em React; regras compartilhadas em shared/
// e remoção do frontend antigo (public/*.html e public/js).
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createElement } from "react";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
import { helpGroups } from "../src/knowledge/help.js";
import heads from "./helpers/heads.json" with { type: "json" };
import { web, html } from "./helpers/web.js";

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/404.html", root));
const PAGES = { ajuda: "Help", termos: "Terms", privacidade: "Privacy", 404: "NotFound", offline: "Offline", admin: "Admin" };

async function files(dir, pattern) {
  const out = [];
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const path = `${dir}${entry.name}${entry.isDirectory() ? "/" : ""}`;
    if (entry.isDirectory()) out.push(...(await files(path, pattern)));
    else if (pattern.test(entry.name)) out.push(path);
  }
  return out;
}

test("39.5: páginas novas com HTML, entrada, componente e o mesmo <head> de SEO das antigas", async () => {
  const registry = await read("web/src/pages/index.ts");
  for (const [name, component] of Object.entries(PAGES)) {
    const page = await read(`web/${name}.html`);
    assert.match(page, /<div id="root"><\/div>/, name);
    assert.match(page, new RegExp(`<script type="module" src="/src/entries/${name}\\.tsx"></script>`), name);
    assert.match(page, /<script src="\/js\/theme-init\.js"><\/script>/, name);
    assert.doesNotMatch(page, /\/js\/app\.js|rel="stylesheet"|modulepreload/, name);
    for (const [key, tag] of Object.entries(heads[name])) {
      if (!tag) assert.ok(key === "robots" ? !/name="robots"/.test(page) : true, `${name}: ${key}`);
      else assert.ok(page.includes(tag), `${name}: ${key}`);
    }
    assert.match(registry, new RegExp(`import ${component} from "\\./${component}";`), name);
    assert.match(registry, new RegExp(`(?:\\b|")${name}"?: ${component},`), name);
    assert.ok(existsSync(new URL(`web/src/entries/${name}.tsx`, root)), name);
  }
  // offline.html não tem Layout nem hidratação: só o HTML pré-renderizado e o CSS.
  assert.match(registry, /export const bare = new Set\(\["offline"\]\)/);
  assert.match(await read("web/src/prerender.tsx"), /bare\.has\(name\)/);
  assert.doesNotMatch(await read("web/src/entries/offline.tsx"), /mount\(/);
});

test("39.5: frontend antigo removido; public/ só com arquivos estáticos", async () => {
  const pub = await files("public/", /./);
  assert.deepEqual(pub.filter((f) => f.endsWith(".html")), [], "sem páginas em public/");
  assert.deepEqual(pub.filter((f) => f.startsWith("public/js/")), ["public/js/theme-init.js"], "public/js só com o tema inicial");
  assert.ok(!existsSync(new URL("public/css/", root)), "CSS em web/src/styles");
  for (const css of ["style.css", "ui.css"]) assert.ok(existsSync(new URL(`web/src/styles/${css}`, root)), css);
  // O web/ tem todas as páginas que existiam (retrato dos <head> antigos em tests/helpers/heads.json).
  for (const name of Object.keys(heads)) assert.ok(existsSync(new URL(`web/${name}.html`, root)), name);
  // Nenhum código importa de public/ (servidor, frontend, testes e scripts).
  for (const file of [...(await files("src/", /\.js$/)), ...(await files("web/src/", /\.tsx?$/)), ...(await files("tests/", /\.m?js$/)), ...(await files("scripts/", /\.js$/))])
    assert.doesNotMatch(await read(file), /from "[./]*public\/|import\("[./]*public\//, file);
  const layout = await read("web/src/components/Layout.tsx");
  assert.doesNotMatch(layout, /LegacyEnhancers/);
  for (const part of ["<SearchBox", "<CartWidgets", "<CompareTray", "<QuickView", "<Assistant", "useUnread()"]) assert.ok(layout.includes(part), part);
  assert.doesNotMatch(await read("web/src/pages/Account.tsx"), /querySelectorAll<HTMLElement>\('\.notif-link/, "contador sem atalho pelo DOM");
});

test("39.5: regras compartilhadas em shared/, usadas pelo servidor e pelo frontend", async () => {
  for (const name of ["specs", "pricing", "kits", "compat", "regions", "services", "cart-sync", "catalog", "account", "forms", "address", "orders", "partners", "request"])
    assert.ok(existsSync(new URL(`shared/${name}.js`, root)), name);
  for (const file of ["src/http/seo.js", "src/assistant/actions.js", "src/routes/api.js", "src/services/checkout.js", "src/services/pricing.js"])
    assert.match(await read(file), /from "\.\.\/\.\.\/shared\//, file);
  const shop = await read("web/src/lib/shop.ts");
  assert.match(shop, /from "\.\/cart"/);
  assert.match(shop, /from "\.\.\/\.\.\/\.\.\/shared\/catalog\.js"/);
  // Sem DOM nem APIs do Node em shared/ (o ESLint confere os globais).
  assert.match(await read("eslint.config.js"), /files: \["shared\/\*\*\/\*\.js"\]/);
  for (const file of await files("shared/", /\.js$/)) assert.doesNotMatch(await read(file), /\b(document|window|localStorage|require)\b|from "node:/, file);
});

test("39.5: estado do navegador em TypeScript (carrinho, comparação, notificações e assistente)", async (t) => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  for (const name of ["localStorage", "sessionStorage"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: storage });
    t.after(() => (previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]));
  }
  const { setUnread, getUnread } = await web("lib/notifications.ts");
  setUnread(3);
  assert.equal(getUnread(), 3);
  setUnread(-2);
  assert.equal(getUnread(), 0, "nunca negativo");
  const { getCompare, setCompare, MAX_COMPARE } = await web("lib/compare.ts");
  assert.equal(MAX_COMPARE, 4);
  setCompare(["a-1", "b-2", "c-3", "d-4", "e-5", "<script>"]);
  assert.deepEqual(getCompare(), ["a-1", "b-2", "c-3", "d-4"]);
  const { takePending } = await web("components/Assistant.tsx");
  store.set("vv_assistente_pendente", JSON.stringify({ texto: "onde está meu pedido?", ts: 1000 }));
  assert.equal(takePending(1000 + 60_000), "onde está meu pedido?", "pergunta retomada depois do login");
  assert.equal(takePending(), null, "usada uma vez só");
  store.set("vv_assistente_pendente", JSON.stringify({ texto: "velha", ts: 0 }));
  assert.equal(takePending(31 * 60 * 1000), null, "expira em 30 minutos");
});

test("39.5: busca do cabeçalho mantém o combobox acessível e os globais só existem no navegador", async () => {
  const { SearchBox } = await web("components/SearchBox.tsx");
  const box = await html(createElement(SearchBox, { id: "header", placeholder: "Buscar", className: "header-search search-box" }));
  assert.match(box, /<form class="header-search search-box" id="header-search" role="search" action="\/catalogo\.html">/);
  assert.match(box, /id="header-q" type="search"[^>]*role="combobox" aria-expanded="false" aria-controls="header-suggestions" aria-autocomplete="list" name="q"/);
  assert.match(box, /<div class="suggestions" id="header-suggestions" role="listbox" aria-label="Sugestões" hidden="">/);
  // Minicarrinho, assistente, barra de comparação e visualização rápida vão para o <body> depois da hidratação.
  for (const [file, name, props] of [["components/CartDrawer.tsx", "CartWidgets", {}], ["components/QuickView.tsx", "QuickView", {}], ["components/Assistant.tsx", "Assistant", { user: null, loading: false }]]) {
    const component = (await web(file))[name];
    assert.equal(await html(createElement(component, props)), "", `${name} fora do pré-render`);
  }
  const offline = (await web("pages/Offline.tsx")).default;
  const page = await html(createElement(offline));
  assert.match(page, /O sinal caiu por aqui\./);
  assert.doesNotMatch(page, /site-header/);
});

test("39.5: servidor entrega ajuda completa, termos, privacidade, painel, offline e 404 do build", { skip: !built && "rode npm run build" }, async (t) => {
  const storage = new MemoryStorage();
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@s395.test", ADMIN_PASSWORD: "admin-senha-s395-2026", ADMIN_NAME: "Admin" });
  const server = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path) => fetch(base + path).then(async (r) => ({ status: r.status, text: await r.text(), cache: r.headers.get("cache-control") }));
  const help = await get("/ajuda.html");
  assert.equal(help.status, 200);
  for (const g of helpGroups) for (const i of g.itens.keys()) assert.ok(help.text.includes(`id="${g.id}-${i + 1}"`), `${g.id}-${i + 1}`);
  assert.match(help.text, /<div id="root">(?:<link [^>]+>)?<div id="header">/);
  assert.match((await get("/termos.html")).text, /id="alteracoes"[^>]*>.*Alterações destes termos/s);
  assert.match((await get("/privacidade.html")).text, /sem identificar quem buscou/);
  const admin = await get("/admin.html");
  assert.match(admin.text, /<meta name="robots" content="noindex" \/>/);
  assert.match(admin.text, /Verificando acesso…/, "pré-render sem dados do painel");
  const offline = await get("/offline.html");
  assert.equal(offline.status, 200);
  assert.match(offline.text, /<body class="offline-page">/);
  assert.match(offline.text, /<link rel="stylesheet"[^>]+href="\/app\/[^"]+\.css">/);
  assert.doesNotMatch(offline.text, /id="header"/);
  const missing = await get("/nao-existe");
  assert.equal(missing.status, 404);
  assert.equal(missing.cache, "no-cache");
  assert.match(missing.text, /Essa nota não existe\./);
  assert.match(missing.text, /<title>Página não encontrada \| Violet Voltage<\/title>/);
  // Service worker: arquivos da instalação existem (o CSS do offline é lido da própria página).
  const sw = await read("public/sw.js");
  const core = JSON.parse(sw.match(/const CORE = (\[[^\]]+\]);/)[1]);
  for (const path of core) assert.equal((await fetch(base + path)).status, 200, path);
  assert.match(sw, /matchAll\(/);
});
