import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import { configuration } from "../src/config/index.js";
import { databaseOptions } from "../src/repositories/postgres.js";
import { seed } from "../src/services/seed.js";
import { placeOrder } from "../src/services/checkout.js";
import { updateOrderStatus } from "../src/services/orders.js";
import { alertKey, restockAlerts, listNotifications, markRead } from "../src/services/notifications.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
import { createApp } from "../src/app.js";
import { seedFixture, fixturePng } from "./helpers/seed-fixture.js";
import { postgresFixture } from "./helpers/postgres-fixture.js";

test("PostgreSQL: configuração de TLS e ausência de dependência de credenciais Azure", () => {
  const env = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://localhost/violet?sslmode=no-verify",
    JWT_SECRET: randomBytes(48).toString("hex"),
  };
  const config = configuration(env);
  assert.equal(config.memory, false);
  const options = databaseOptions(config);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(
    new URL(options.connectionString).searchParams.has("sslmode"),
    false,
  );
  assert.throws(() => configuration({ ...env, DATABASE_SSL: "false" }));
  assert.throws(() =>
    configuration({ ...env, DATABASE_URL: "https://example.test" }),
  );
  assert.equal(
    configuration({ ...env, NODE_ENV: "development", DATABASE_SSL: "false" })
      .databaseSsl,
    false,
  );
});

test("PostgreSQL: migração repetível, seed com 22 imagens e controle de concorrência", async (t) => {
  const { storage, database } = await postgresFixture(t);
  const assets = await seedFixture(t);
  await storage.init();
  assert.deepEqual(await seed(storage, assets), {
    created: 22,
    updated: 0,
    uploaded: 22,
    total: 22,
  });
  assert.deepEqual(await seed(storage, assets), {
    created: 0,
    updated: 22,
    uploaded: 22,
    total: 22,
  });
  assert.equal((await storage.list("products")).length, 22);
  assert.equal(
    (
      await database.query(
        "SELECT count(*)::integer AS total FROM violet_voltage.images",
      )
    ).rows[0].total,
    22,
  );
  const p = await storage.get("products", "correias", "demo-001");
  assert.deepEqual((await storage.blob(p.blobName)).buffer, fixturePng);
  await storage.save("products", { ...p, estoque: 7 }, p.etag);
  await assert.rejects(
    storage.save("products", { ...p, estoque: 100 }, p.etag),
    (e) => e.statusCode === 412,
  );
  await assert.rejects(
    storage.create("products", { ...p, partitionKey: "outra" }),
    (e) => e.statusCode === 409,
  );
  await assert.rejects(storage.list("products; DROP TABLE anything"));
  await storage.removeBlob("inexistente");
  assert.equal(await storage.blob("inexistente"), null);
  // Reexecutar a migração não perde os dados.
  await storage.init();
  assert.equal(
    (await storage.get("products", "correias", "demo-001")).estoque,
    7,
  );
});

test("PostgreSQL: checkout atômico, idempotência e rollback de pedido inválido", async (t) => {
  const { storage, database } = await postgresFixture(t);
  await seed(storage, await seedFixture(t));
  const user = { id: randomUUID() };
  const body = {
    requestId: randomUUID(),
    items: [{ id: "demo-001", quantidade: 2, priceCents: 1 }],
    pagamento: "pix",
    entrega: "retirada",
    endereco: "Retirada na loja",
  };
  const order = await placeOrder(storage, user, body);
  assert.equal(order.totalCents, 13980);
  assert.equal((await placeOrder(storage, user, body)).rowKey, order.rowKey);
  assert.equal(
    (await storage.get("products", "correias", "demo-001")).estoque,
    23,
  );
  const before = (await storage.list("products")).find(
    (p) => p.rowKey === "demo-002",
  );
  // Uma restrição SQL falha depois de salvar o estoque dentro da mesma transação.
  await database.exec(
    "ALTER TABLE violet_voltage.orders ADD CONSTRAINT qa_reject CHECK (data->>'endereco' <> 'Falha de teste')",
  );
  await assert.rejects(
    placeOrder(storage, user, {
      ...body,
      requestId: randomUUID(),
      items: [{ id: "demo-002", quantidade: 1 }],
      endereco: "Falha de teste",
    }),
  );
  assert.equal(
    (await storage.get("products", before.partitionKey, before.rowKey)).estoque,
    before.estoque,
  );
  assert.equal((await storage.list("orders")).length, 1);
  await assert.rejects(
    storage.transaction(async (scoped) => {
      await scoped.upload("qa.png", fixturePng, "image/png");
      throw new Error("Rollback de imagem");
    }),
  );
  assert.equal(await storage.blob("qa.png"), null);
});

test("PostgreSQL: API autentica, serve imagens e mantém pedido e estoque", async (t) => {
  const { storage } = await postgresFixture(t);
  await seed(storage, await seedFixture(t));
  const password = randomBytes(20).toString("hex");
  await bootstrapAdmin(storage, {
    ADMIN_EMAIL: "qa@example.test",
    ADMIN_PASSWORD: password,
    ADMIN_NAME: "Administrador QA",
  });
  const config = {
    memory: false,
    production: false,
    secret: randomBytes(48).toString("hex"),
  };
  const server = createApp(storage, config).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa@example.test", senha: password }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const health = await (await fetch(base + "/health")).json();
  assert.equal(health.data.storage, "postgresql");
  assert.equal((await fetch(base + "/admin/summary")).status, 401);
  assert.equal(
    (await fetch(base + "/admin/summary", { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  const image = await fetch(base + "/images/demo-001");
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), fixturePng);
  const order = await fetch(base + "/orders", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: randomUUID(),
      items: [{ id: "demo-001", quantidade: 1 }],
      pagamento: "pix",
      entrega: "retirada",
      endereco: "Retirada na loja",
    }),
  });
  assert.equal(order.status, 201);
  assert.equal((await order.json()).data.totalCents, 6990);
  assert.equal(
    (
      await (
        await fetch(base + "/orders", { headers: { Cookie: cookie } })
      ).json()
    ).data.length,
    1,
  );
  assert.equal(
    (await storage.get("products", "correias", "demo-001")).estoque,
    24,
  );
  assert.equal(
    (
      await (
        await fetch(base + "/auth/me", { headers: { Cookie: cookie } })
      ).json()
    ).data.passwordHash,
    undefined,
  );
});

test("PostgreSQL: consultas por chave, índices únicos e cancelamento transacional", async (t) => {
  const { storage } = await postgresFixture(t);
  await seed(storage, await seedFixture(t));
  assert.equal((await storage.getByRowKey("products", "demo-004")).modelo, "AC15 Valvulado");
  assert.equal(await storage.getByRowKey("products", "inexistente"), null);
  assert.deepEqual(
    (await storage.getManyByRowKeys("products", ["demo-002", "demo-001", "demo-002", "x"])).map((p) => p.rowKey).sort(),
    ["demo-001", "demo-002"],
  );
  assert.deepEqual(await storage.getManyByRowKeys("products", []), []);
  const user = { id: randomUUID() };
  const body = {
    requestId: randomUUID(),
    items: [{ id: "demo-001", quantidade: 2 }],
    pagamento: "pix",
    entrega: "retirada",
    endereco: "Retirada na loja",
  };
  const order = await placeOrder(storage, user, body);
  assert.equal((await storage.findOrderByRequest(user.id, body.requestId)).rowKey, order.rowKey);
  assert.equal(await storage.findOrderByRequest(randomUUID(), body.requestId), null);
  assert.equal((await storage.listByPartition("orders", user.id)).length, 1);
  assert.equal((await storage.get("products", "correias", "demo-001")).estoque, 23);
  const canceled = await updateOrderStatus(storage, order.rowKey, "Cancelado");
  assert.equal(canceled.status, "Cancelado");
  assert.equal((await storage.get("products", "correias", "demo-001")).estoque, 25);
  await assert.rejects(updateOrderStatus(storage, order.rowKey, "Enviado"), (e) => e.status === 409);
  await storage.create("customers", { partitionKey: "cliente", rowKey: "pg@example.test", id: "cliente-pg", nome: "PG", ativo: true });
  assert.equal((await storage.findCustomerById("cliente-pg")).rowKey, "pg@example.test");
  assert.equal(await storage.findCustomerById("nenhum"), null);
});

test("PostgreSQL: avisos de estoque e notificações na mesma transação", async (t) => {
  const { storage, database } = await postgresFixture(t);
  const tables = await database.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='violet_voltage' ORDER BY table_name",
  );
  assert.deepEqual(tables.rows.map((r) => r.table_name), ["alerts", "customers", "images", "notifications", "orders", "products"]);
  await storage.create("products", {
    partitionKey: "pedais", rowKey: "pg-alerta", marca: "PG", modelo: "Reverb", categoria: "Pedais",
    descricao: "Pedal para teste de avisos", priceCents: 15000, estoque: 0, ativo: true,
  });
  const alert = (customerId) => ({
    partitionKey: customerId, rowKey: alertKey(customerId, "pg-alerta"), productId: "pg-alerta",
    customerId, createdAt: new Date().toISOString(), notifiedAt: null,
  });
  const ana = randomUUID();
  await storage.create("alerts", alert(ana));
  await assert.rejects(storage.create("alerts", alert(ana)), (e) => e.statusCode === 409);
  // Falha depois da notificação desfaz estoque, notificação e marcação do aviso.
  const before = await storage.getByRowKey("products", "pg-alerta");
  await assert.rejects(
    storage.transaction(async (scoped) => {
      const next = { ...before, estoque: 3 };
      await scoped.save("products", next, before.etag);
      assert.equal(await restockAlerts(scoped, next), 1);
      throw new Error("falha depois de notificar");
    }),
    /falha depois de notificar/,
  );
  assert.equal((await storage.getByRowKey("products", "pg-alerta")).estoque, 0);
  assert.equal((await listNotifications(storage, ana)).naoLidas, 0);
  assert.equal((await storage.listByPartition("alerts", ana))[0].notifiedAt, null);
  // Reposição confirmada notifica uma vez.
  const current = await storage.getByRowKey("products", "pg-alerta");
  const notified = await storage.transaction(async (scoped) => {
    const next = { ...current, estoque: 2 };
    await scoped.save("products", next, current.etag);
    return restockAlerts(scoped, next);
  });
  assert.equal(notified, 1);
  const inbox = await listNotifications(storage, ana);
  assert.equal(inbox.naoLidas, 1);
  assert.equal(inbox.itens[0].titulo, "PG Reverb voltou ao estoque");
  assert.equal(await restockAlerts(storage, await storage.getByRowKey("products", "pg-alerta")), 0);
  assert.equal(await markRead(storage, ana), 0);
  const [saved] = await storage.listByPartition("alerts", ana);
  assert.ok(saved.notifiedAt);
  await storage.remove("alerts", ana, saved.rowKey);
  assert.deepEqual(await storage.listByPartition("alerts", ana), []);
});
