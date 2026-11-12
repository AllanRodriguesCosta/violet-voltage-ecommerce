import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { KITS, kitDiscounts, kitPrice, kitProgress } from "../public/js/kits.js";
import { cartAdvice } from "../public/js/compat.js";
import { compareRows, checkSpecs, needsPower } from "../public/js/specs.js";
import { quote } from "../src/services/pricing.js";

const catalog = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const byId = (id) => catalog.find((p) => p.id === id);
const line = (id, quantidade = 1) => ({ id, quantidade, priceCents: byId(id).priceCents });

test("kits: itens existem no catálogo, sem repetição, desconto entre 5% e 15%", () => {
  assert.equal(new Set(KITS.map((k) => k.id)).size, KITS.length);
  for (const kit of KITS) {
    assert.equal(new Set(kit.itens).size, kit.itens.length, kit.id);
    assert.ok(kit.itens.every(byId), kit.id);
    assert.ok(kit.descontoPct >= 5 && kit.descontoPct <= 15, kit.id);
    assert.ok(kitPrice(kit, catalog).precoCents < kitPrice(kit, catalog).totalCents);
  }
});

test("kits: desconto só com o kit completo, uma unidade por kit e cupom sobre o restante", () => {
  const kit = KITS.find((k) => k.id === "primeira-guitarra");
  const full = kit.itens.map((id) => line(id));
  const expected = Math.round((full.reduce((s, i) => s + i.priceCents, 0) * kit.descontoPct) / 100);
  assert.deepEqual(kitDiscounts(full).kits.map((k) => [k.id, k.descontoCents]), [["primeira-guitarra", expected]]);
  assert.equal(kitDiscounts(full.slice(1)).descontoKitsCents, 0, "kit incompleto não tem desconto");
  // Dois kits completos do mesmo tipo: desconto em dobro; uma unidade extra de um item não conta.
  const twice = kit.itens.map((id, i) => line(id, i === 0 ? 3 : 2));
  assert.equal(kitDiscounts(twice).descontoKitsCents, expected * 2);
  // Itens compartilhados (palhetas, afinador) entram em um kit só.
  const manutencao = KITS.find((k) => k.id === "manutencao");
  const both = [...new Set([...kit.itens, ...manutencao.itens])].map((id) => line(id));
  assert.equal(kitDiscounts(both).kits.length, 1);
  const totals = quote(full, { entrega: "padrao", cupom: "VOLTAGE10" });
  assert.equal(totals.descontoKitsCents, expected);
  assert.equal(totals.descontoCents, Math.min(Math.round(((totals.subtotalCents - expected) * 10) / 100), 50000));
  assert.equal(totals.totalCents, totals.subtotalCents - expected - totals.descontoCents + totals.freteCents);
  assert.deepEqual(kitProgress(kit.itens.slice(0, -1)).map((p) => [p.kit.id, p.faltam]), [["primeira-guitarra", [kit.itens.at(-1)]]]);
});

test("compatibilidade: cabo, amplificador, fonte, patch e pedalboard com sugestão do catálogo", () => {
  const advice = (ids) => cartAdvice(ids.map((id) => ({ product: byId(id), quantidade: 1 })), catalog);
  const guitarOnly = advice(["demo-035"]);
  assert.deepEqual(guitarOnly.map((a) => a.id), ["cabo", "amplificador", "correia", "cordas"]);
  assert.equal(byId(guitarOnly[0].sugestao).categoria, "Cabos");
  assert.notEqual(byId(guitarOnly[0].sugestao).ficha.tipo, "Patch");
  assert.equal(byId(guitarOnly[1].sugestao).categoria, "Amplificadores");
  const pedals = advice(["demo-047", "demo-052", "demo-048"]);
  assert.deepEqual(pedals.map((a) => a.id), ["fonte", "patch", "pedalboard"]);
  assert.equal(pedals[0].sugestao, "demo-077", "vários pedais pedem a fonte isolada");
  assert.equal(advice(["demo-047"])[0].sugestao, "demo-076", "um pedal pede a fonte simples");
  assert.deepEqual(advice(["demo-060"]), [], "pedaleira com fonte inclusa não pede fonte");
  assert.equal(advice(["demo-019"])[0].id, "patch-sozinho");
  const complete = advice(["demo-035", "demo-045", "demo-021", "demo-067", "demo-068"]);
  assert.deepEqual(complete, []);
  // Toda sugestão está em estoque e fora do carrinho.
  for (const a of [...guitarOnly, ...pedals]) assert.ok(byId(a.sugestao).estoque > 0);
});

test("ficha: alimentação dos pedais e comparação com diferenças", () => {
  for (const p of catalog.filter((x) => x.categoria === "Pedais")) {
    assert.ok(p.ficha.alimentacao, p.modelo);
    assert.equal(checkSpecs(p.categoria, p.ficha).erro, undefined, p.modelo);
  }
  assert.equal(needsPower(byId("demo-047")), true);
  assert.equal(needsPower(byId("demo-060")), false);
  const rows = compareRows([byId("demo-023"), byId("demo-027")]);
  assert.equal(rows.find((r) => r.key === "captacao").differs, true);
  assert.deepEqual(rows.find((r) => r.key === "captacao").values, ["Single-coil", "Humbucker"]);
  assert.equal(rows.find((r) => r.key === "categoria").differs, false);
});

test("API: cotação e pedido com kit, comprovante e rastreio", async (t) => {
  const { call, register, admin } = await storeFixture(t);
  const ana = await register("ana@kits.test");
  const bia = await register("bia@kits.test");
  const kit = KITS.find((k) => k.id === "pedalboard-essencial");
  const items = kit.itens.map((id) => ({ id, quantidade: 1 }));
  const q = (await call("/checkout/quote", { body: { items, entrega: "padrao" } })).body.data;
  assert.equal(q.kits[0].id, kit.id);
  assert.equal(q.totalCents, q.subtotalCents - q.descontoKitsCents + q.freteCents);
  const placed = await call("/orders", { cookie: ana, body: { requestId: randomUUID(), items, entrega: "padrao", pagamento: "pix", endereco: "Rua Teste, 100, São Paulo" } });
  assert.equal(placed.status, 201);
  const order = placed.body.data;
  assert.equal(order.descontoKitsCents, q.descontoKitsCents);
  assert.equal(order.totalCents, q.totalCents);
  assert.equal((await call(`/orders/${order.id}`, { method: "GET", cookie: ana })).body.data.id, order.id);
  assert.equal((await call(`/orders/${order.id}`, { method: "GET", cookie: bia })).status, 404, "pedido de outro cliente");
  assert.equal((await call(`/orders/${order.id}`, { method: "GET" })).status, 401);
  const boss = await admin();
  await call(`/admin/orders/${order.id}`, { method: "PATCH", cookie: boss, body: { status: "Enviado" } });
  const shipped = (await call(`/orders/${order.id}`, { method: "GET", cookie: ana })).body.data;
  assert.match(shipped.rastreio, /^VV\d{9}BR$/);
  const notice = (await call("/notifications", { method: "GET", cookie: ana })).body.data.itens[0];
  assert.match(notice.texto, new RegExp(shipped.rastreio));
  assert.equal(notice.link, `/pedido.html?id=${order.id}`);
});
