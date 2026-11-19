// Etapa 39.2: catálogo, produto, comparar e favoritos em React (pré-render + hidratação).
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { seedProducts } from "../src/services/seed-products.js";
import { bundlePicks } from "../shared/catalog.js";
import heads from "./helpers/heads.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/catalogo.html", root));
const PAGES = { catalogo: "Catalog", produto: "Product", comparar: "Compare", favoritos: "Wishlist" };

test("39.2: catálogo, produto, comparar e favoritos têm HTML com #root, entrada e componente registrado", async () => {
  const registry = await read("web/src/pages/index.ts");
  for (const [name, component] of Object.entries(PAGES)) {
    const html = await read(`web/${name}.html`);
    // <head> de SEO das páginas antigas (retrato em tests/helpers/heads.json, de antes da remoção).
    const legacy = Object.values(heads[name]).filter(Boolean).join("\n");
    assert.match(html, /<div id="root"><\/div>/, name);
    assert.match(html, new RegExp(`<script type="module" src="/src/entries/${name}\\.tsx"></script>`), name);
    assert.match(html, /<script src="\/js\/theme-init\.js"><\/script>/, name);
    assert.doesNotMatch(html, /\/js\/app\.js|rel="stylesheet"|rel="modulepreload"/, name);
    // Mesmo <head> de SEO da página antiga (o servidor troca estas tags com expressões regulares).
    for (const tag of [/<title>[^<]*<\/title>/, /<meta name="description" content="[^"]*" \/>/, /<meta property="og:type" content="[^"]*" \/>/, /<meta property="og:title" content="[^"]*" \/>/, /<meta property="og:description" content="[^"]*" \/>/])
      assert.equal(html.match(tag)?.[0], legacy.match(tag)?.[0], `${name}: ${tag}`);
    assert.equal(html.match(/<body[^>]*>/)[0], legacy.match(/<body[^>]*>/)[0], `${name}: classe do body`);
    assert.match(registry, new RegExp(`import ${component} from "\\./${component}";`));
    assert.match(registry, new RegExp(`\\b${name}: ${component},`));
    const entry = await read(`web/src/entries/${name}.tsx`);
    assert.match(entry, new RegExp(`mount\\(${component}\\)`));
  }
  // Etapa 39.5: as páginas antigas saíram de public/.
  for (const name of Object.keys(PAGES)) assert.ok(!existsSync(new URL(`public/${name}.html`, root)), name);
});

test("39.2: páginas React mantêm ids e textos usados pelo CSS, testes de navegador e assistente", async () => {
  const catalog = await read("web/src/pages/Catalog.tsx");
  for (const id of ["catalog-q", "catalog-q-clear", "filters-open", "filters-count", "catalog-sort", "applied-filters", "filters-panel", "filters-close", "facet-category", "facet-brand", "facet-specs", "price-error", "price-presets", "clear-filters", "filters-apply", "catalog-count", "search-correction", "products", "catalog-more", "crumb-current", "catalog-title", "catalog-lead"])
    assert.match(catalog, new RegExp(`id="${id}"`), `catálogo #${id}`);
  assert.match(catalog, /history\.replaceState/);
  const product = await read("web/src/pages/Product.tsx");
  for (const id of ["product-detail", "add-product", "quantidade", "bundle", "related", "recentes", "sticky-buy", "crumb-category", "crumb-current"])
    assert.match(product, new RegExp(`id="${id}"`), `produto #${id}`);
  const gallery = await read("web/src/components/Gallery.tsx");
  assert.match(gallery, /gallery-thumbs/);
  assert.match(gallery, /searchParams|color-picker/);
  assert.match(product, /url\.searchParams\.set\("cor"/, "?cor= no endereço");
  const compare = await read("web/src/pages/Compare.tsx");
  assert.match(compare, /id="compare-content"/);
  assert.match(compare, /history\.replaceState\(null, "", "\/comparar\.html"\)/);
  const wishlist = await read("web/src/pages/Wishlist.tsx");
  for (const id of ["wishlist-meta", "wishlist-actions", "wishlist-clear", "wishlist-price", "wishlist-add-all", "wishlist-grid"]) assert.match(wishlist, new RegExp(`id="${id}"`), `favoritos #${id}`);
  // Regra de "Compre junto" continua única (shared/catalog.js), usada pelo React.
  assert.match(await read("web/src/lib/catalog.ts"), /bundlePicks as bundlePicksJs,\n\} from "\.\.\/\.\.\/\.\.\/shared\/catalog\.js"/);
  assert.equal(typeof bundlePicks, "function");
});

test("39.2: servidor entrega catálogo e produto pré-renderizados com SEO do servidor", { skip: !built && "rode npm run build" }, async (t) => {
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

  const catalog = await fetch(`${base}/catalogo.html`).then((r) => r.text());
  assert.match(catalog, /<div id="root">(?:<link [^>]+>)?<div id="header">/, "cabeçalho já no HTML");
  assert.match(catalog, /<h1 id="catalog-title">Todos os equipamentos<\/h1>/);
  assert.match(catalog, /id="catalog-count" aria-live="polite">Carregando equipamentos…/);
  assert.match(catalog, /class="product-card skeleton"/, "carregando com esqueleto");
  assert.match(catalog, /src="\/app\/catalogo-[\w-]+\.js"/);
  assert.doesNotMatch(catalog, /\/js\/app\.js/);

  const category = await fetch(`${base}/catalogo.html?categoria=Pedais`).then((r) => r.text());
  assert.match(category, /<title>Pedais \| Violet Voltage<\/title>/, "SEO da categoria no HTML do build");
  assert.match(category, /<meta property="og:title" content="Pedais \| Violet Voltage" \/>/);
  assert.match(category, /<link rel="canonical" href="[^"]+catalogo\.html\?categoria=Pedais"/);
  assert.match(category, /id="catalog-title"/);

  const [p] = (await fetch(`${base}/api/products`).then((r) => r.json())).data;
  const name = `${p.marca} ${p.modelo}`;
  const product = await fetch(`${base}/produto.html?id=${encodeURIComponent(p.id)}`).then((r) => r.text());
  assert.match(product, new RegExp(`<title>${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| Violet Voltage</title>`), "título do produto");
  assert.match(product, /<meta property="og:type" content="product" \/>/);
  assert.match(product, /<script type="application\/ld\+json">[^<]*"@type":"Product"/, "dados estruturados do servidor");
  assert.match(product, /<div id="product-detail" class="detail-grid detail-loading" aria-busy="true">/, "esqueleto pré-renderizado");
  assert.match(product, /id="sticky-buy"/);
  assert.match(product, /src="\/app\/produto-[\w-]+\.js"/);

  for (const page of ["comparar", "favoritos"]) {
    const html = await fetch(`${base}/${page}.html`).then((r) => r.text());
    assert.match(html, new RegExp(`src="/app/${page}-[\\w-]+\\.js"`), page);
    assert.match(html, /<meta name="robots" content="noindex" \/>/, page);
  }
  // Etapa 39.5: nenhuma página carrega mais o script antigo.
  assert.doesNotMatch(await fetch(`${base}/ajuda.html`).then((r) => r.text()), /\/js\/app\.js/);
});
