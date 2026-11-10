import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import * as server from "../src/services/pricing.js";
import * as client from "../public/js/pricing.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";

const item = (priceCents, quantidade = 1) => ({ priceCents, quantidade });

test("regras exibidas no navegador são as mesmas do servidor", () => {
  for (const key of ["shipping", "delivery", "FREE_SHIPPING_CENTS", "MAX_INSTALLMENTS", "MIN_INSTALLMENT_CENTS"])
    assert.deepEqual(client[key], server[key], key);
  for (const total of [1, 4999, 5000, 12345, 49999, 50000, 999999])
    assert.equal(client.maxInstallments(total), server.maxInstallments(total));
  assert.equal(client.installmentValue(10001, 3), 3334);
});

test("frete grátis vale só para entrega padrão a partir de R$ 999", () => {
  assert.equal(server.quote([item(99899)], { entrega: "padrao" }).freteCents, 2500);
  const free = server.quote([item(49950, 2)], { entrega: "padrao" });
  assert.equal(free.freteCents, 0);
  assert.equal(free.freteGratis, true);
  assert.equal(free.faltaFreteGratisCents, 0);
  assert.equal(server.quote([item(99900)], { entrega: "expressa" }).freteCents, 4500);
  assert.equal(server.quote([item(1000)], { entrega: "padrao" }).faltaFreteGratisCents, 98900);
  assert.throws(() => server.quote([item(1000)], { entrega: "drone" }), (e) => e.field === "entrega");
});

test("cupons: percentual com teto, valor mínimo, frete e códigos inválidos", () => {
  const ten = server.quote([item(100000)], { entrega: "expressa", cupom: " voltage10 " });
  assert.equal(ten.descontoCents, 10000);
  assert.equal(ten.totalCents, 100000 + 4500 - 10000);
  assert.equal(ten.cupom.codigo, "VOLTAGE10");
  assert.equal(server.quote([item(900000)], { entrega: "retirada", cupom: "VOLTAGE10" }).descontoCents, 50000);
  assert.throws(() => server.quote([item(19999)], { entrega: "padrao", cupom: "PRIMEIROACORDE" }), /a partir de/);
  assert.equal(server.quote([item(20000)], { entrega: "padrao", cupom: "PRIMEIROACORDE" }).totalCents, 20000 + 2500 - 3000);
  const freight = server.quote([item(5000)], { entrega: "expressa", cupom: "FRETEVOLT" });
  assert.equal(freight.freteCents, 0);
  assert.equal(freight.descontoCents, 0);
  assert.throws(() => server.quote([item(5000)], { entrega: "retirada", cupom: "FRETEVOLT" }), /já é grátis/);
  for (const cupom of ["NAOEXISTE", "x", "com espaço", 10])
    assert.throws(() => server.quote([item(5000)], { entrega: "padrao", cupom }), (e) => e.status === 400 && e.field === "cupom");
});

test("parcelas: até 10x com parcela mínima de R$ 50 e só no cartão", () => {
  assert.equal(server.maxInstallments(4999), 1);
  assert.equal(server.maxInstallments(30000), 6);
  assert.equal(server.maxInstallments(10_000_000), 10);
  assert.equal(server.installments("pix", 5, 100000), 1);
  assert.equal(server.installments("cartao", undefined, 100000), 1);
  assert.equal(server.installments("cartao", 10, 100000), 10);
  assert.throws(() => server.installments("cartao", 7, 30000), (e) => e.field === "parcelas");
  assert.throws(() => server.installments("cartao", "3", 30000));
});

test("API: cotação pública e pedido com cupom e parcelas", async (t) => {
  const storage = new MemoryStorage();
  await storage.create("products", {
    partitionKey: "amplificadores", rowKey: "amp-1", marca: "Teste", modelo: "Amp", categoria: "Amplificadores",
    descricao: "Amplificador de teste", priceCents: 60000, estoque: 5, ativo: true,
  });
  const app = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") });
  const http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const base = `http://127.0.0.1:${http.address().port}/api`;
  const post = (path, body, cookie) =>
    fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  let r = await post("/checkout/quote", { items: [{ id: "amp-1", quantidade: 2, priceCents: 1 }], entrega: "padrao", cupom: "voltage10" });
  let body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.data.subtotalCents, 120000);
  assert.equal(body.data.freteCents, 0);
  assert.equal(body.data.descontoCents, 12000);
  assert.equal(body.data.totalCents, 108000);
  assert.equal(body.data.parcelasMax, 10);
  assert.equal(body.data.items[0].totalCents, 120000);
  assert.deepEqual(body.data.entregas.map((e) => [e.id, e.priceCents]), [["padrao", 0], ["expressa", 4500], ["retirada", 0]]);
  r = await post("/checkout/quote", { items: [{ id: "amp-1", quantidade: 1 }], entrega: "padrao", cupom: "INVALIDO" });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.field, "cupom");
  assert.equal((await post("/checkout/quote", { items: [{ id: "amp-1", quantidade: 6 }] })).status, 409);
  const register = await post("/auth/register", { nome: "Cliente Preço", email: "preco@example.test", senha: randomBytes(12).toString("hex") });
  const cookie = register.headers.get("set-cookie").split(";")[0];
  const order = { items: [{ id: "amp-1", quantidade: 1 }], entrega: "expressa", pagamento: "cartao", parcelas: 12, cupom: "PRIMEIROACORDE", endereco: "Rua do Teste, 10", requestId: randomUUID() };
  r = await post("/orders", order, cookie);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.field, "parcelas");
  r = await post("/orders", { ...order, parcelas: 10 }, cookie);
  body = await r.json();
  assert.equal(r.status, 201);
  assert.equal(body.data.totalCents, 60000 + 4500 - 3000);
  assert.equal(body.data.descontoCents, 3000);
  assert.equal(body.data.cupom, "PRIMEIROACORDE");
  assert.equal(body.data.parcelas, 10);
  assert.equal(body.data.statusHistory[0].status, "Recebido");
  assert.equal((await storage.get("products", "amplificadores", "amp-1")).estoque, 4);
});
