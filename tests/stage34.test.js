// Etapa 34: cupons no painel, frete por região do CEP, carrinho salvo na conta com lembrete,
// estoque por cor e correção das encomendas no assistente.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { REGIONS, regionFor, cepFromText, regionalPrice, regionalPrazo } from "../public/js/regions.js";
import { quote, deliveryOptions, coupons } from "../src/services/pricing.js";
import { mergeCarts, createCartSync } from "../public/js/cart-sync.js";
import { remindAbandoned } from "../src/services/carts.js";
import { usable, couponState } from "../src/services/coupons.js";
import { reply } from "../src/assistant/index.js";

const cheap = seedProducts.filter((p) => p.priceCents < 40000 && p.estoque >= 5)[0];
const colorful = seedProducts.filter((p) => p.estoque >= 5 && p.rowKey !== cheap.rowKey)[0];
const item = (priceCents, quantidade = 1) => ({ priceCents, quantidade });

test("frete por região: todos os dígitos têm região; SP mantém o preço base; outras somam prazo", () => {
  for (const d of "0123456789") assert.ok(regionFor(`${d}1000000`), `CEP iniciado por ${d}`);
  assert.equal(new Set(REGIONS.flatMap((r) => r.digitos.split(""))).size, 10);
  assert.equal(regionFor("01310-100").id, "sp");
  assert.equal(regionFor("69000000").id, "n");
  assert.equal(regionFor("123"), null);
  assert.equal(cepFromText("Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100"), "01310100");
  assert.equal(cepFromText("Rua 5, número 123456789"), null);
  assert.equal(regionalPrice(2500, regionFor("01310100")), 2500);
  assert.equal(regionalPrice(2500, regionFor("69000000")), 4000);
  assert.equal(regionalPrice(0, regionFor("69000000")), 0, "retirada continua grátis");
  assert.equal(regionalPrazo("padrao", regionFor("69000000")), "9 a 12 dias úteis");
  assert.equal(regionalPrazo("padrao", regionFor("01310100")), null);
  const far = quote([item(10000)], { entrega: "padrao", cep: "69000000" });
  assert.equal(far.freteCents, 4000);
  assert.equal(far.regiao.id, "n");
  assert.equal(quote([item(10000)], { entrega: "padrao" }).freteCents, 2500, "sem CEP: base");
  assert.equal(quote([item(99900)], { entrega: "padrao", cep: "69000000" }).freteCents, 0, "frete grátis vale em todo o país");
  const options = deliveryOptions(10000, "90000000");
  assert.equal(options.find((o) => o.id === "padrao").prazo, "7 a 10 dias úteis");
  assert.equal(options.find((o) => o.id === "retirada").priceCents, 0);
});

test("cupons: validade, limite e desativação tiram o cupom; percentual sem teto funciona", () => {
  const at = new Date("2026-12-01T12:00:00-03:00");
  assert.ok(usable({ ativo: true, validoAte: "2026-12-01" }, at), "vale até o fim do dia");
  assert.equal(couponState({ ativo: true, validoAte: "2026-11-30" }, at), "Expirado");
  assert.equal(couponState({ ativo: true, limiteUsos: 2, usos: 2 }, at), "Esgotado");
  assert.equal(couponState({ ativo: false }, at), "Desativado");
  const rules = { NATAL15: { type: "percent", value: 15, maxCents: null, description: "15%" } };
  assert.equal(quote([item(100000)], { entrega: "retirada", cupom: "natal15", rules }).descontoCents, 15000);
  assert.throws(() => quote([item(100000)], { entrega: "retirada", cupom: "VOLTAGE10", rules }), /inválido ou expirado/);
  assert.equal(quote([item(100000)], { entrega: "retirada", cupom: "VOLTAGE10" }).descontoCents, 10000, "sem regras: cupons padrão");
});

test("API: painel cria e desativa cupons; checkout respeita uso único, limite e região do endereço", async (t) => {
  const { call, register, admin } = await storeFixture(t);
  const boss = await admin();
  const list = await call("/admin/cupons", { method: "GET", cookie: boss });
  assert.deepEqual(list.body.data.map((c) => c.codigo).sort(), Object.keys(coupons).sort());
  assert.ok(list.body.data.every((c) => c.padrao && c.situacao === "Ativo"));
  assert.equal((await call("/admin/cupons", { cookie: boss, body: { codigo: "a b", type: "fixed", value: 1000, description: "x y z" } })).status, 400);
  assert.equal((await call("/admin/cupons", { cookie: boss, body: { codigo: "VOLTAGE10", type: "fixed", value: 1000, description: "duplicado" } })).status, 409);
  const created = await call("/admin/cupons", { cookie: boss, body: { codigo: "bemvindo", type: "fixed", value: 2000, description: "R$ 20 na primeira compra", umPorCliente: true, limiteUsos: 5 } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.codigo, "BEMVINDO");
  const ana = await register("ana@s34.test");
  assert.equal((await call("/admin/cupons", { cookie: ana, method: "GET" })).status, 403);
  const items = [{ id: cheap.rowKey, quantidade: 1 }];
  const q = await call("/checkout/quote", { cookie: ana, body: { items, entrega: "padrao", cupom: "BEMVINDO", cep: "69000-000" } });
  assert.equal(q.status, 200);
  assert.equal(q.body.data.descontoCents, 2000);
  assert.equal(q.body.data.freteCents, 4000);
  assert.equal(q.body.data.entregas.find((o) => o.id === "padrao").prazo, "9 a 12 dias úteis");
  // O CEP do endereço vale mais que o enviado à parte.
  const order = await call("/orders", { cookie: ana, body: { items, entrega: "padrao", pagamento: "pix", cupom: "BEMVINDO", cep: "01310100", endereco: "Rua das Flores, 10, Centro, Manaus - AM, CEP 69000-000", requestId: "pedido-s34-000001" } });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.data.freteCents, 4000);
  const again = await call("/checkout/quote", { cookie: ana, body: { items, entrega: "padrao", cupom: "BEMVINDO" } });
  assert.equal(again.status, 400);
  assert.match(again.body.error.message, /já usou/);
  const after = (await call("/admin/cupons", { method: "GET", cookie: boss })).body.data.find((c) => c.codigo === "BEMVINDO");
  assert.equal(after.usos, 1);
  // Desativar um cupom padrão tira o cupom do checkout e do assistente.
  assert.equal((await call("/admin/cupons/VOLTAGE10", { method: "PATCH", cookie: boss, body: { ativo: false } })).body.data.situacao, "Desativado");
  assert.equal((await call("/checkout/quote", { body: { items, entrega: "padrao", cupom: "VOLTAGE10" } })).status, 400);
  const said = await call("/assistente", { body: { mensagem: "tem algum cupom?" } });
  assert.doesNotMatch(said.body.data.texto, /VOLTAGE10/);
  assert.match(said.body.data.texto, /BEMVINDO/);
  // Cupom usado em pedido conta uso também nos padrão.
  const bia = await register("bia@s34.test");
  const o2 = await call("/orders", { cookie: bia, body: { items, entrega: "retirada", pagamento: "pix", cupom: "PRIMEIROACORDE", endereco: "Retirada na loja", requestId: "pedido-s34-000002" } });
  if (cheap.priceCents >= 20000) {
    assert.equal(o2.status, 201);
    assert.equal((await call("/admin/cupons", { method: "GET", cookie: boss })).body.data.find((c) => c.codigo === "PRIMEIROACORDE").usos, 1);
  }
});

test("carrinho na conta: salva, valida, junta com o do navegador, some no pedido e entra na cópia", async (t) => {
  const { call, register, storage } = await storeFixture(t);
  assert.equal((await call("/cart", { method: "GET" })).status, 401);
  const ana = await register("ana.cart@s34.test");
  assert.equal((await call("/cart", { method: "PUT", cookie: ana, body: { itens: [{ id: "x", quantidade: 0 }] } })).status, 400);
  const saved = await call("/cart", { method: "PUT", cookie: ana, body: { itens: [{ id: cheap.rowKey, quantidade: 2, cor: "Preto", servicos: ["cordas"] }] } });
  assert.equal(saved.status, 200);
  assert.deepEqual((await call("/cart", { method: "GET", cookie: ana })).body.data.itens, [{ id: cheap.rowKey, quantidade: 2, cor: "Preto", servicos: ["cordas"] }]);
  const exported = await call("/account/export", { method: "GET", cookie: ana });
  assert.equal(exported.body.carrinhoSalvo.itens.length, 1);
  await call("/orders", { cookie: ana, body: { items: [{ id: cheap.rowKey, quantidade: 1 }], entrega: "retirada", pagamento: "pix", endereco: "Retirada na loja", requestId: "pedido-s34-000003" } });
  assert.deepEqual((await call("/cart", { method: "GET", cookie: ana })).body.data.itens, [], "pedido limpa o carrinho salvo");
  assert.equal((await storage.list("carts")).length, 0);
  assert.deepEqual(
    mergeCarts([{ id: "a", quantidade: 1 }, { id: "b", quantidade: 3 }], [{ id: "b", quantidade: 2 }, { id: "c", quantidade: 1 }]).map((i) => `${i.id}${i.quantidade}`).sort(),
    ["a1", "b3", "c1"],
  );
});

test("sincronização do navegador: junta uma vez por sessão e envia mudanças com atraso", async () => {
  const calls = [];
  let local = [{ id: "a", quantidade: 1 }];
  const store = new Map();
  const sync = createCartSync({
    request: async (path, body, method) => {
      calls.push([method || "GET", body?.itens?.map((i) => i.id).join(",")]);
      return body ? { itens: body.itens } : { itens: [{ id: "b", quantidade: 1 }] };
    },
    read: () => local,
    write: (items) => (local = items),
    wait: 5,
    store: { getItem: (k) => store.get(k), setItem: (k, v) => store.set(k, v) },
  });
  await sync.start({ id: "u1" });
  assert.deepEqual(local.map((i) => i.id).sort(), ["a", "b"]);
  assert.deepEqual(calls, [["GET", undefined], ["PUT", "b,a"]]);
  assert.equal(await sync.start({ id: "u1" }), null, "segunda vez na mesma sessão não junta de novo");
  sync.changed([{ id: "z", quantidade: 1 }]);
  sync.changed([{ id: "y", quantidade: 1 }]);
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(calls.at(-1), ["PUT", "y"], "só a última mudança vai");
  assert.equal(calls.length, 3);
});

test("lembrete de carrinho esquecido: uma vez, só depois de 24 h e sem pedido depois", async (t) => {
  const { call, register, storage } = await storeFixture(t);
  const ana = await register("ana.lembrete@s34.test");
  await call("/cart", { method: "PUT", cookie: ana, body: { itens: [{ id: cheap.rowKey, quantidade: 1 }] } });
  const user = (await storage.list("customers")).find((c) => c.rowKey === "ana.lembrete@s34.test");
  assert.equal(await remindAbandoned(storage, user), null, "antes de 24 h, nada");
  const later = new Date(Date.now() + 25 * 3_600_000);
  const note = await remindAbandoned(storage, user, later);
  assert.equal(note.tipo, "carrinho");
  assert.equal(await remindAbandoned(storage, user, later), null, "não repete");
  const notes = await call("/notifications", { method: "GET", cookie: ana });
  assert.equal(notes.body.data.itens.filter((n) => n.tipo === "carrinho").length, 1);
});

test("estoque por cor: painel grava, checkout recusa cor esgotada e baixa o estoque da cor", async (t) => {
  const cores = [{ nome: "Preto", hex: "#111111" }, { nome: "Roxo", hex: "#4a4483" }];
  const { call, register, admin, storage } = await storeFixture(t, { overrides: { [colorful.rowKey]: { cores, estoque: 5 } } });
  const boss = await admin();
  const p = await storage.getByRowKey("products", colorful.rowKey);
  const base = { marca: p.marca, modelo: p.modelo, categoria: p.categoria, descricao: p.descricao, priceCents: p.priceCents, estoque: 5 };
  assert.equal((await call(`/admin/products/${p.rowKey}`, { method: "PATCH", cookie: boss, body: { ...base, estoqueCores: { Preto: 4, Roxo: 3 } } })).status, 400, "soma maior que o total");
  const ok = await call(`/admin/products/${p.rowKey}`, { method: "PATCH", cookie: boss, body: { ...base, estoqueCores: { Preto: 3, Roxo: 0 } } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.data.cores.map((c) => c.estoque), [3, 0]);
  const ana = await register("ana.cor@s34.test");
  const purple = await call("/checkout/quote", { body: { items: [{ id: p.rowKey, quantidade: 1, cor: "Roxo" }], entrega: "padrao" } });
  assert.equal(purple.status, 409);
  assert.match(purple.body.error.message, /esgotado na cor Roxo/);
  const order = await call("/orders", { cookie: ana, body: { items: [{ id: p.rowKey, quantidade: 2, cor: "Preto" }], entrega: "retirada", pagamento: "pix", endereco: "Retirada na loja", requestId: "pedido-s34-000004" } });
  assert.equal(order.status, 201);
  const after = await storage.getByRowKey("products", p.rowKey);
  assert.equal(after.estoque, 3);
  assert.equal(after.cores.find((c) => c.nome === "Preto").estoque, 1);
  // Cancelar devolve também o estoque da cor.
  assert.equal((await call(`/orders/${order.body.data.id}/cancel`, { cookie: ana })).status, 200);
  assert.equal((await storage.getByRowKey("products", p.rowKey)).cores.find((c) => c.nome === "Preto").estoque, 3);
  // Sem número por cor, o controle por cor sai.
  const cleared = await call(`/admin/products/${p.rowKey}`, { method: "PATCH", cookie: boss, body: { ...base, estoqueCores: { Preto: null, Roxo: "" } } });
  assert.ok(cleared.body.data.cores.every((c) => c.estoque === undefined));
});

test("assistente: encomendas do cliente chegam pela API; cupons ativos vêm do painel", async (t) => {
  const { call, register } = await storeFixture(t);
  const ana = await register("ana.enc@s34.test");
  await call("/encomendas", { cookie: ana, body: { tipo: "personalizado", produto: "Les Paul com Seymour Duncan", contato: "E-mail" } });
  const r = await call("/assistente", { cookie: ana, body: { mensagem: "como está minha encomenda?" } });
  assert.match(r.body.data.texto, /Les Paul com Seymour Duncan/);
  const none = await reply({ mensagem: "tem cupom?" }, { products: [], cupons: async () => [] });
  assert.match(none.texto, /não há cupom ativo/);
});

test("telas: CEP no carrinho, endereço do checkout no frete, aba de cupons e estoque por cor", async () => {
  const read = (f) => readFile(new URL(`../public/${f}`, import.meta.url), "utf8");
  const [cart, checkout, admin, adminHtml, product, common, help] = await Promise.all(["js/pages/cart.js", "js/pages/checkout.js", "js/admin.js", "admin.html", "js/pages/product.js", "js/common.js", "ajuda.html"].map(read));
  assert.match(cart, /Calcular frete pelo CEP/);
  assert.match(checkout, /currentCep\(\)/);
  assert.match(adminHtml, /data-tab="coupons"/);
  assert.match(admin, /\/admin\/cupons/);
  assert.match(product, /Esgotado na cor/);
  assert.match(common, /cartSync\.start\(user\)/);
  assert.doesNotMatch(help, /Cupons ativos: VOLTAGE10/, "a ajuda não fixa a lista de cupons");
  for (const page of ["carrinho.html", "checkout.html"]) assert.match(await read(page), /modulepreload" href="\/js\/regions\.js"/);
});
