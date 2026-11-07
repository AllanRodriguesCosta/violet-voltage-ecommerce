import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import { configuration } from "../src/config/index.js";
import { databaseOptions } from "../src/repositories/postgres.js";
import { seed } from "../src/services/seed.js";
import { placeOrder } from "../src/services/checkout.js";
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
