import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { allowedNext, summary, statuses } from "../src/services/orders.js";
import * as client from "../public/js/orders.js";
import { MemoryStorage } from "../src/repositories/storage.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";

test("transições de status: avançam, cancelam antes do envio e encerram", () => {
  assert.deepEqual(allowedNext("Recebido"), ["Em preparação", "Enviado", "Concluído", "Cancelado"]);
  assert.deepEqual(allowedNext("Em preparação"), ["Enviado", "Concluído", "Cancelado"]);
  assert.deepEqual(allowedNext("Enviado"), ["Concluído"]);
  assert.deepEqual(allowedNext("Concluído"), []);
  assert.deepEqual(allowedNext("Cancelado"), []);
  for (const status of statuses) assert.deepEqual(client.allowedNext(status), allowedNext(status), status);
  assert.deepEqual(client.statuses, statuses);
});

test("resumo administrativo: ticket médio, status, estoque baixo e 14 dias", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const orders = [
    { status: "Recebido", totalCents: 10000, createdAt: "2026-11-10T12:00:00Z" },
    { status: "Concluído", totalCents: 30000, createdAt: "2026-11-09T12:00:00Z" },
    { status: "Cancelado", totalCents: 99999, createdAt: "2026-11-10T12:00:00Z" },
    { status: "Enviado", totalCents: 5000, createdAt: "2026-10-01T12:00:00Z" },
  ];
  const products = [
    { ativo: true, estoque: 2, rowKey: "a", marca: "M", modelo: "A" },
    { ativo: true, estoque: 9, rowKey: "b", marca: "M", modelo: "B" },
    { ativo: false, estoque: 0, rowKey: "c", marca: "M", modelo: "C" },
  ];
  const s = summary(products, [{ ativo: true, role: "customer" }, { ativo: true, role: "admin" }], orders, now);
  assert.equal(s.totalCents, 45000);
  assert.equal(s.ticketMedioCents, 15000);
  assert.equal(s.porStatus.Cancelado, 1);
  assert.deepEqual(s.estoqueBaixo, [{ id: "a", nome: "M A", estoque: 2 }]);
  assert.equal(s.vendasPorDia.length, 14);
  assert.deepEqual(s.vendasPorDia.at(-1), { dia: "2026-11-10", totalCents: 10000, pedidos: 1 });
  assert.equal(s.vendasPorDia.at(-2).totalCents, 30000);
  assert.equal(s.clientes, 1);
});

test("API: cancelamento devolve estoque e respeita dono e status", async (t) => {
  const storage = new MemoryStorage();
  await storage.create("products", {
    partitionKey: "pedais", rowKey: "pedal-1", marca: "Teste", modelo: "Pedal", categoria: "Pedais",
    descricao: "Pedal de teste para pedidos", priceCents: 20000, estoque: 5, ativo: true,
  });
  const adminPassword = randomBytes(16).toString("hex");
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@pedidos.test", ADMIN_PASSWORD: adminPassword, ADMIN_NAME: "Admin Pedidos" });
  const app = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") });
  const http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const base = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { method = "POST", body = {}, cookie } = {}) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const customer = async (email) => (await call("/auth/register", { body: { nome: "Cliente", email, senha: randomBytes(12).toString("hex") } })).cookie;
  const ana = await customer("ana@pedidos.test");
  const bia = await customer("bia@pedidos.test");
  const admin = (await call("/auth/login", { body: { email: "admin@pedidos.test", senha: adminPassword } })).cookie;
  const order = async (cookie, quantidade) => (await call("/orders", { cookie, body: { items: [{ id: "pedal-1", quantidade }], pagamento: "pix", entrega: "retirada", endereco: "Retirada na loja", requestId: randomUUID() } })).body.data;
  const stock = async () => (await storage.get("products", "pedais", "pedal-1")).estoque;
  const first = await order(ana, 2);
  assert.equal(await stock(), 3);
  assert.equal((await call(`/orders/${first.id}/cancel`, { cookie: bia })).status, 404);
  const canceled = await call(`/orders/${first.id}/cancel`, { cookie: ana });
  assert.equal(canceled.status, 200);
  assert.equal(canceled.body.data.status, "Cancelado");
  assert.deepEqual(canceled.body.data.statusHistory.map((h) => h.status), ["Recebido", "Cancelado"]);
  assert.equal(await stock(), 5);
  // Repetir o cancelamento é idempotente e não devolve o estoque duas vezes.
  assert.equal((await call(`/orders/${first.id}/cancel`, { cookie: ana })).status, 200);
  assert.equal(await stock(), 5);
  assert.equal((await call(`/admin/orders/${first.id}`, { method: "PATCH", cookie: admin, body: { status: "Enviado" } })).status, 409);
  const second = await order(ana, 1);
  for (const status of ["Em preparação", "Enviado"])
    assert.equal((await call(`/admin/orders/${second.id}`, { method: "PATCH", cookie: admin, body: { status } })).body.data.status, status);
  assert.equal((await call(`/admin/orders/${second.id}`, { method: "PATCH", cookie: admin, body: { status: "Recebido" } })).status, 409);
  assert.equal((await call(`/admin/orders/${second.id}`, { method: "PATCH", cookie: admin, body: { status: "Cancelado" } })).status, 409);
  assert.equal((await call(`/orders/${second.id}/cancel`, { cookie: ana })).status, 409);
  assert.equal((await call(`/admin/orders/${second.id}`, { method: "PATCH", cookie: admin, body: { status: "Inexistente" } })).status, 400);
  const third = await order(ana, 1);
  await call(`/admin/orders/${third.id}`, { method: "PATCH", cookie: admin, body: { status: "Em preparação" } });
  assert.equal((await call(`/orders/${third.id}/cancel`, { cookie: ana })).status, 409);
  const byAdmin = await call(`/admin/orders/${third.id}`, { method: "PATCH", cookie: admin, body: { status: "Cancelado" } });
  assert.equal(byAdmin.body.data.estoqueDevolvido, true);
  assert.equal(await stock(), 4);
  const s = (await call("/admin/summary", { method: "GET", cookie: admin })).body.data;
  assert.equal(s.porStatus.Cancelado, 2);
  assert.equal(s.porStatus.Enviado, 1);
  assert.equal(s.ticketMedioCents, 20000);
  assert.equal(s.estoqueBaixo[0].estoque, 4);
});
