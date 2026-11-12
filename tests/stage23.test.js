import test from "node:test";
import assert from "node:assert/strict";
import { storeFixture } from "./helpers/api-fixture.js";
import { summary } from "../src/services/orders.js";
import { withMeta } from "../src/http/seo.js";

test("painel: vendas por categoria, mais vendidos, serviços, kits e cancelamento", () => {
  const products = [
    { rowKey: "g", categoria: "Guitarras", marca: "M", modelo: "G", ativo: true, estoque: 9 },
    { rowKey: "p", categoria: "Pedais", marca: "M", modelo: "P", ativo: true, estoque: 9 },
  ];
  const item = (id, q, price, servicos) => ({ id, nome: id.toUpperCase(), quantidade: q, priceCents: price, ...(servicos ? { servicos } : {}) });
  const orders = [
    { status: "Concluído", totalCents: 1, createdAt: "2026-11-10T12:00:00Z", itens: JSON.stringify([item("g", 1, 100000, [{ id: "regulagem", nome: "Regulagem por luthier", priceCents: 12000 }]), item("p", 2, 30000)]), kits: [{ id: "k", nome: "Kit K", quantidade: 1, descontoCents: 5000 }] },
    { status: "Recebido", totalCents: 1, createdAt: "2026-11-10T12:00:00Z", itens: JSON.stringify([item("p", 1, 30000)]) },
    { status: "Cancelado", totalCents: 1, createdAt: "2026-11-10T12:00:00Z", itens: JSON.stringify([item("g", 5, 100000)]) },
  ];
  const s = summary(products, [], orders, new Date("2026-11-11T12:00:00Z"));
  assert.deepEqual(s.porCategoria.map((c) => [c.categoria, c.totalCents, c.unidades]), [["Guitarras", 100000, 1], ["Pedais", 90000, 3]]);
  assert.deepEqual(s.maisVendidos.map((v) => [v.id, v.unidades]), [["p", 3], ["g", 1]], "cancelado não conta");
  assert.deepEqual(s.servicos, [{ id: "regulagem", nome: "Regulagem por luthier", quantidade: 1, totalCents: 12000 }]);
  assert.deepEqual(s.kits, [{ id: "k", nome: "Kit K", quantidade: 1, descontoCents: 5000 }]);
  assert.equal(s.cancelamentoPct, 33);
});

test("SEO: metadados escapados e JSON-LD sem quebrar o HTML", () => {
  const template = '<title>X</title><meta name="description" content="d" /><meta property="og:type" content="website" /><meta property="og:title" content="t" /><meta property="og:description" content="d" />';
  const out = withMeta(template, { title: 'A "B" <C>', description: "x".repeat(300), url: "https://loja.test/p?id=1&a=2", jsonld: { name: "</script><b>" } });
  assert.match(out, /<title>A &quot;B&quot; &lt;C&gt;<\/title>/);
  assert.match(out, /content="x{160}"/);
  assert.match(out, /href="https:\/\/loja.test\/p\?id=1&amp;a=2"/);
  assert.ok(!out.includes("</script><b>"), "JSON-LD não fecha a tag");
});

test("SEO: produto, categoria e início com Open Graph, canônico e dados estruturados", async (t) => {
  const { url, call, admin } = await storeFixture(t);
  const site = url.replace(/\/api$/, "");
  const page = async (path, headers = {}) => {
    const r = await fetch(site + path, { headers });
    return { status: r.status, headers: r.headers, text: await r.text() };
  };
  const product = await page("/produto.html?id=demo-024");
  assert.equal(product.status, 200);
  assert.match(product.text, /<title>Squier Classic Vibe &#39;50s Stratocaster \| Violet Voltage<\/title>/);
  assert.match(product.text, /<meta property="og:type" content="product" \/>/);
  assert.match(product.text, new RegExp(`<link rel="canonical" href="${site}/produto.html\\?id=demo-024" />`));
  assert.match(product.text, new RegExp(`og:image" content="${site}/icons/icon-512.png"`));
  const ld = JSON.parse(product.text.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(ld[0]["@type"], "Product");
  assert.equal(ld[0].offers.price, "3499.00");
  assert.ok(ld[0].additionalProperty.some((x) => x.name === "Captação" && x.value === "Single-coil"));
  assert.equal(ld[1].itemListElement[1].name, "Guitarras");
  assert.equal(product.headers.get("cache-control"), "no-cache");
  const br = await fetch(site + "/produto.html?id=demo-024", { headers: { "Accept-Encoding": "br" } });
  assert.equal(br.headers.get("content-encoding"), "br");
  assert.match(await br.text(), /og:type" content="product"/, "fetch já descomprime o Brotli");
  // Produto inexistente ou desativado: página estática (o script mostra o estado de erro).
  assert.match((await page("/produto.html?id=nao-existe")).text, /<title>Detalhes do equipamento \| Violet Voltage<\/title>/);
  const boss = await admin();
  await call("/admin/products/demo-025", { method: "DELETE", cookie: boss });
  assert.doesNotMatch((await page("/produto.html?id=demo-025")).text, /og:type" content="product"/);
  const category = await page("/catalogo.html?categoria=Pedais");
  assert.match(category.text, /<title>Pedais \| Violet Voltage<\/title>/);
  assert.match(category.text, /overdrive, distorção, fuzz/);
  assert.match((await page("/catalogo.html?categoria=Pedais&q=boss")).text, /<title>Catálogo \| Violet Voltage<\/title>/, "busca não vira canônico da categoria");
  const home = await page("/");
  assert.match(home.text, new RegExp(`"target":"${site}/catalogo.html\\?q=\\{busca\\}"`));
  assert.match(home.text, new RegExp(`<link rel="canonical" href="${site}/" />`));
  const robots = await page("/robots.txt");
  assert.match(robots.text, /Disallow: \/pedido.html/);
  const sitemap = await page("/sitemap.xml");
  assert.match(sitemap.text, /guias\.html/);
  assert.match(sitemap.text, /kits\.html/);
});
