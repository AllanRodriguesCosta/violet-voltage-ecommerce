// Etapa 39.6: refinamentos do frontend React — React em arquivo próprio, assistente e
// visualização rápida carregados sob demanda, isolamento de erros, nova tentativa em leituras da
// API, foto substituta, aviso de conexão e pré-carregamento de páginas.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createElement } from "react";
import { web, html } from "./helpers/web.js";

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/index.html", root));

function fakeFetch(responses) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init?.method || "GET" });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? { data: null }), { status: next.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("leituras da API tentam de novo em 502/503/504 e queda de conexão", async () => {
  const { api, retryDelays } = await web("lib/api.ts");
  retryDelays.splice(0, retryDelays.length, 0, 0);
  const net = fakeFetch([{ status: 503, body: { error: { message: "acordando" } } }, new TypeError("fetch failed"), { body: { data: { ok: 1 } } }]);
  try {
    assert.deepEqual(await api("/products"), { ok: 1 });
    assert.equal(net.calls.length, 3);
  } finally {
    net.restore();
  }
  const fail = fakeFetch([{ status: 502, body: {} }, { status: 502, body: {} }, { status: 504, body: { error: { message: "Servidor indisponível." } } }]);
  try {
    await assert.rejects(api("/products"), (e) => e.status === 504 && /indispon/.test(e.message));
    assert.equal(fail.calls.length, 3, "duas novas tentativas no máximo");
  } finally {
    fail.restore();
  }
});

test("envios (POST) e erros de regra nunca são repetidos sozinhos", async () => {
  const { api, send, retryDelays } = await web("lib/api.ts");
  retryDelays.splice(0, retryDelays.length, 0, 0);
  const post = fakeFetch([{ status: 503, body: { error: { message: "Tente de novo." } } }]);
  try {
    await assert.rejects(send("/orders", { itens: [] }), /Tente de novo/);
    assert.equal(post.calls.length, 1, "pedido não pode ser duplicado");
  } finally {
    post.restore();
  }
  const offline = fakeFetch([new TypeError("fetch failed")]);
  try {
    await assert.rejects(send("/orders", {}), /Não foi possível conectar/);
    assert.equal(offline.calls.length, 1);
  } finally {
    offline.restore();
  }
  const notFound = fakeFetch([{ status: 404, body: { error: { message: "Produto não encontrado." } } }]);
  try {
    await assert.rejects(api("/products/x"), /não encontrado/);
    assert.equal(notFound.calls.length, 1);
  } finally {
    notFound.restore();
  }
});

test("foto que falha vira a ilustração da categoria, uma vez só", async () => {
  const { replaceBrokenImage, FALLBACK_IMAGE } = await web("lib/browser.ts");
  const img = (src, fallback) => {
    const attrs = { src };
    return { dataset: fallback ? { fallback } : {}, getAttribute: (k) => attrs[k], set src(v) { attrs.src = v; }, get src() { return attrs.src; } };
  };
  const amp = img("/api/images/amp-1", "/assets/amp.svg");
  assert.equal(replaceBrokenImage(amp), true);
  assert.equal(amp.src, "/assets/amp.svg");
  assert.equal(replaceBrokenImage(amp), false, "sem laço se a ilustração também falhar");
  const generic = img("/foto.jpg");
  replaceBrokenImage(generic);
  assert.equal(generic.src, FALLBACK_IMAGE);

  const { ProductCard } = await web("components/ProductCard.tsx");
  const card = await html(createElement(ProductCard, { product: { id: "a1", marca: "Marca", modelo: "Amp", categoria: "Amplificadores", preco: 1000, estoque: 3, imageUrl: "/x.jpg" } }));
  assert.match(card, /data-fallback="\/assets\/amp\.svg"/);
});

test("pré-carregamento: regras pelo cabeçalho, sem script inline, fora de API/painel/checkout/pedido", async () => {
  const { SPECULATION_RULES } = await import("../shared/speculation.js");
  const rule = SPECULATION_RULES.prefetch[0];
  assert.equal(rule.eagerness, "moderate");
  const blocked = rule.where.and[1].not.href_matches;
  for (const path of ["/api/*", "/admin.html", "/checkout.html", "/pedido.html"]) assert.ok(blocked.includes(path), path);
  assert.equal(SPECULATION_RULES.prerender, undefined, "só prefetch: nada roda antes do clique");

  const { MemoryStorage } = await import("../src/repositories/memory.js");
  const { createApp } = await import("../src/app.js");
  const server = createApp(new MemoryStorage(), { memory: true, production: false, secret: "x".repeat(96) }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`${base}/catalogo.html`);
    assert.equal(page.headers.get("speculation-rules"), '"/speculation-rules.json"');
    assert.doesNotMatch(page.headers.get("content-security-policy") || "", /unsafe-inline'[^;]*script|script-src[^;]*unsafe-inline/);
    const rules = await fetch(`${base}/speculation-rules.json`);
    assert.equal(rules.headers.get("content-type").split(";")[0].trim(), "application/speculationrules+json");
    assert.deepEqual(await rules.json(), SPECULATION_RULES);
    const apiRes = await fetch(`${base}/api/products`);
    assert.equal(apiRes.headers.get("speculation-rules"), null);
    const asset = await fetch(`${base}/assets/amp.svg`);
    assert.equal(asset.headers.get("speculation-rules"), null);
  } finally {
    server.close();
  }
});

test("página com erro mostra aviso com recarregar; recurso global com erro some", async () => {
  const { PageError, ErrorBoundary } = await web("components/ErrorBoundary.tsx");
  const markup = await html(createElement(PageError));
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Recarregar a página/);
  assert.match(markup, /href="\/"/);
  const boundary = new ErrorBoundary({ area: "assistente", fallback: null, children: "ok" });
  assert.equal(boundary.render(), "ok");
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error("x"));
  assert.equal(boundary.render(), null);

  const layout = await read("web/src/components/Layout.tsx");
  assert.match(layout, /<ErrorBoundary area="página">\{children\}<\/ErrorBoundary>/);
  assert.match(layout, /lazy\(\(\) => import\("\.\/Assistant"\)/);
  assert.match(layout, /lazy\(\(\) => import\("\.\/QuickView"\)/);
  assert.doesNotMatch(layout, /^import \{ (Assistant|QuickView) \}/m, "sem importação estática");
});

test("build: React num arquivo próprio e assistente fora do pacote principal", { skip: !built && "sem dist/ (rode npm run build)" }, async () => {
  const assets = await readdir(new URL("dist/app/", root));
  const vendor = assets.find((f) => /^react-[\w-]{8}\.js$/.test(f));
  const assistant = assets.find((f) => /^Assistant-[\w-]{8}\.js$/.test(f));
  assert.ok(vendor, "app/react-HASH.js");
  assert.ok(assistant, "app/Assistant-HASH.js");
  const page = await read("dist/index.html");
  assert.match(page, new RegExp(`/app/${vendor}`), "React pré-carregado na página");
  assert.doesNotMatch(page, new RegExp(`/app/${assistant}`), "assistente só depois da página");
  const mount = assets.find((f) => /^mount-[\w-]{8}\.js$/.test(f));
  const code = await read(`dist/app/${mount}`);
  assert.doesNotMatch(code, /Nada é comprado sem você clicar/, "texto do assistente fora do pacote principal");
});
