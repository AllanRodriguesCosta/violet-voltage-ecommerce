import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { addressInput, saveAddress, removeAddress, formatAddress, MAX_ADDRESSES, UFS } from "../src/services/addresses.js";
import * as clientAddress from "../public/js/address.js";
import { orderNotice } from "../src/services/notifications.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";

const valid = { apelido: "Casa", cep: "01310100", logradouro: "Avenida Paulista", numero: "1000", complemento: "Apto 12", bairro: "Bela Vista", cidade: "São Paulo", uf: "sp" };

test("endereço: CEP formatado, UF válida e mensagens por campo", () => {
  const a = addressInput(valid);
  assert.equal(a.cep, "01310-100");
  assert.equal(a.uf, "SP");
  assert.equal(formatAddress(a), "Avenida Paulista, 1000 - Apto 12, Bela Vista, São Paulo - SP, CEP 01310-100");
  for (const [field, value] of [["cep", "123"], ["cep", "00000-000"], ["uf", "XX"], ["logradouro", "R"], ["numero", ""], ["bairro", ""], ["cidade", "a".repeat(61)]])
    assert.throws(() => addressInput({ ...valid, [field]: value }), (e) => e.field === field && e.status === 400, field);
});

test("endereço: navegador usa as mesmas UFs e o mesmo formato do servidor", () => {
  assert.deepEqual(clientAddress.UFS, UFS);
  const a = addressInput(valid);
  assert.equal(clientAddress.formatAddress(a), formatAddress(a));
  assert.equal(clientAddress.formatCep("01310100"), "01310-100");
  assert.equal(clientAddress.ufFromCep("01310-100"), "SP");
  assert.equal(clientAddress.ufFromCep("20040-020"), "RJ");
  assert.equal(clientAddress.ufFromCep("69900-000"), "AC");
  assert.equal(clientAddress.ufFromCep("90010-000"), "RS");
  assert.equal(clientAddress.ufFromCep("123"), "");
});

test("endereço: um principal, primeiro da lista, e limite de cinco", () => {
  let list = saveAddress([], addressInput(valid));
  assert.equal(list[0].principal, true);
  list = saveAddress(list, addressInput({ ...valid, apelido: "Trabalho", principal: true }));
  assert.deepEqual(list.map((a) => [a.apelido, a.principal]), [["Trabalho", true], ["Casa", false]]);
  const trabalho = list[0].id;
  list = saveAddress(list, addressInput({ ...valid, apelido: "Escritório" }), trabalho);
  assert.equal(list.filter((a) => a.principal).length, 1);
  assert.equal(list[0].apelido, "Casa", "desmarcar o principal passa a vez para outro endereço");
  list = removeAddress(list, list[0].id);
  assert.equal(list.length, 1);
  assert.equal(list[0].principal, true);
  while (list.length < MAX_ADDRESSES) list = saveAddress(list, addressInput(valid));
  assert.throws(() => saveAddress(list, addressInput(valid)), (e) => e.status === 409);
  assert.throws(() => removeAddress(list, "nao-existe"), (e) => e.status === 404);
});

test("notificação de status usa o número curto do pedido e trata retirada", () => {
  const order = { rowKey: "0df98121-aaaa-bbbb", entrega: "retirada" };
  assert.equal(orderNotice(order, "Em preparação").titulo, "Pedido #0DF98121 em preparação");
  assert.equal(orderNotice(order, "Enviado").titulo, "Pedido #0DF98121 liberado para retirada");
  assert.equal(orderNotice({ ...order, entrega: "padrao" }, "Enviado").titulo, "Pedido #0DF98121 enviado");
});

test("API: endereços, avise-me, notificações e procura no painel", async (t) => {
  const storage = new MemoryStorage();
  const base = { categoria: "Pedais", descricao: "Pedal de teste para a conta", priceCents: 20000, ativo: true };
  await storage.create("products", { ...base, partitionKey: "pedais", rowKey: "esgotado-1", marca: "Teste", modelo: "Fuzz", estoque: 0 });
  await storage.create("products", { ...base, partitionKey: "pedais", rowKey: "unico-1", marca: "Teste", modelo: "Delay", estoque: 1 });
  const adminPassword = randomBytes(16).toString("hex");
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@conta.test", ADMIN_PASSWORD: adminPassword, ADMIN_NAME: "Admin Conta" });
  const app = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") });
  const http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { method = "POST", body = {}, cookie } = {}) => {
    const r = await fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const register = async (email) => (await call("/auth/register", { body: { nome: "Cliente Conta", email, senha: randomBytes(12).toString("hex") } })).cookie;
  const ana = await register("ana@conta.test");
  const bia = await register("bia@conta.test");
  const admin = (await call("/auth/login", { body: { email: "admin@conta.test", senha: adminPassword } })).cookie;

  // Endereços
  assert.equal((await call("/addresses", { method: "GET" })).status, 401);
  const first = await call("/addresses", { cookie: ana, body: valid });
  assert.equal(first.status, 201);
  assert.equal(first.body.data[0].principal, true);
  const second = await call("/addresses", { cookie: ana, body: { ...valid, apelido: "Trabalho", cep: "20040-020", uf: "RJ", cidade: "Rio de Janeiro", principal: true } });
  assert.deepEqual(second.body.data.map((a) => a.apelido), ["Trabalho", "Casa"]);
  const invalid = await call("/addresses", { cookie: ana, body: { ...valid, cep: "12" } });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.field, "cep");
  const edited = await call(`/addresses/${second.body.data[1].id}`, { method: "PATCH", cookie: ana, body: { ...valid, numero: "1001" } });
  assert.equal(edited.body.data.find((a) => a.apelido === "Casa").numero, "1001");
  assert.equal((await call(`/addresses/${second.body.data[0].id}`, { method: "PATCH", cookie: bia, body: valid })).status, 404);
  const removed = await call(`/addresses/${second.body.data[0].id}`, { method: "DELETE", cookie: ana });
  assert.deepEqual(removed.body.data.map((a) => [a.apelido, a.principal]), [["Casa", true]]);
  const session = (await call("/auth/session", { method: "GET", cookie: ana })).body.data;
  assert.equal(session.enderecos.length, 1);
  assert.equal(session.naoLidas, 0);
  assert.equal(session.passwordHash, undefined);

  // Avise-me
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "unico-1" } })).status, 409, "item disponível não precisa de aviso");
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "nao-existe" } })).status, 404);
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "esgotado-1" } })).status, 201);
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "esgotado-1" } })).status, 200, "repetir não duplica");
  assert.equal((await call("/alerts", { cookie: bia, body: { productId: "esgotado-1" } })).status, 201);
  const demand = (await call("/admin/summary", { method: "GET", cookie: admin })).body.data.procura;
  assert.deepEqual(demand, [{ id: "esgotado-1", nome: "Teste Fuzz", estoque: 0, avisos: 2 }]);
  assert.equal((await call(`/alerts/esgotado-1`, { method: "DELETE", cookie: bia })).status, 200);
  const restock = await call("/admin/products/esgotado-1", { method: "PATCH", cookie: admin, body: { marca: "Teste", modelo: "Fuzz", categoria: "Pedais", descricao: base.descricao, priceCents: 20000, estoque: 4 } });
  assert.equal(restock.status, 200);
  let inbox = (await call("/notifications", { method: "GET", cookie: ana })).body.data;
  assert.equal(inbox.naoLidas, 1);
  assert.equal(inbox.itens[0].titulo, "Teste Fuzz voltou ao estoque");
  assert.equal(inbox.itens[0].link, "/produto.html?id=esgotado-1");
  assert.equal((await call("/notifications", { method: "GET", cookie: bia })).body.data.naoLidas, 0, "aviso cancelado não notifica");
  const alerts = (await call("/alerts", { method: "GET", cookie: ana })).body.data;
  assert.ok(alerts[0].notifiedAt);
  assert.equal(alerts[0].produto.estoque, 4);
  await call("/admin/products/esgotado-1", { method: "PATCH", cookie: admin, body: { marca: "Teste", modelo: "Fuzz", categoria: "Pedais", descricao: base.descricao, priceCents: 20000, estoque: 6 } });
  assert.equal((await call("/notifications", { method: "GET", cookie: ana })).body.data.naoLidas, 1, "aviso dispara uma vez");
  assert.deepEqual((await call("/admin/summary", { method: "GET", cookie: admin })).body.data.procura, []);

  // Status do pedido pela loja notifica; cancelamento pelo próprio cliente não.
  const order = async (cookie) => (await call("/orders", { cookie, body: { items: [{ id: "unico-1", quantidade: 1 }], pagamento: "pix", entrega: "retirada", endereco: "Retirada na loja", requestId: randomUUID() } })).body.data;
  const mine = await order(bia);
  assert.equal((await storage.getByRowKey("products", "unico-1")).estoque, 0);
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "unico-1" } })).status, 201);
  await call(`/admin/orders/${mine.id}`, { method: "PATCH", cookie: admin, body: { status: "Em preparação" } });
  inbox = (await call("/notifications", { method: "GET", cookie: bia })).body.data;
  assert.equal(inbox.naoLidas, 1);
  assert.match(inbox.itens[0].titulo, /^Pedido #[0-9A-F]{8} em preparação$/);
  // Cancelamento pela loja devolve o item e avisa quem esperava por ele.
  await call(`/admin/orders/${mine.id}`, { method: "PATCH", cookie: admin, body: { status: "Cancelado" } });
  assert.equal((await storage.getByRowKey("products", "unico-1")).estoque, 1);
  inbox = (await call("/notifications", { method: "GET", cookie: ana })).body.data;
  assert.equal(inbox.naoLidas, 2);
  assert.equal(inbox.itens[0].titulo, "Teste Delay voltou ao estoque");
  const own = await order(bia);
  await call(`/orders/${own.id}/cancel`, { cookie: bia });
  assert.equal((await call("/notifications", { method: "GET", cookie: bia })).body.data.naoLidas, 2, "cancelamento do próprio cliente não notifica");
  // Marcar como lidas: uma específica e depois todas.
  const one = inbox.itens[1].id;
  assert.equal((await call("/notifications/read", { cookie: ana, body: { ids: [one] } })).body.data.naoLidas, 1);
  assert.equal((await call("/notifications/read", { cookie: ana, body: {} })).body.data.naoLidas, 0);
  assert.equal((await call("/auth/session", { method: "GET", cookie: ana })).body.data.naoLidas, 0);
});
