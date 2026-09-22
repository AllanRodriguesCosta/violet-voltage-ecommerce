import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { MemoryStorage } from "../src/repositories/storage.js";
import { createApp } from "../src/app.js";
import {
  configuration,
  tableNames,
  containerName,
} from "../src/config/index.js";
import { productInput, email, integer } from "../src/utils/validation.js";
import { calculate, placeOrder } from "../src/services/checkout.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
import { seed } from "../src/services/seed.js";
const sample = {
  marca: "Teste",
  modelo: "Modelo",
  categoria: "Guitarras",
  descricao: "Descrição suficientemente longa",
  priceCents: 10001,
  estoque: 3,
};
test("validação de valores, e-mail e produto", () => {
  assert.equal(email("  TESTE@example.com "), "teste@example.com");
  assert.throws(() => email("x/invalid@example.com"));
  assert.throws(() => integer(1.5, "estoque"));
  assert.throws(() => productInput({ ...sample, priceCents: -1 }));
  assert.throws(() => productInput({ ...sample, categoria: "Inválida" }));
  assert.deepEqual(productInput(sample), sample);
});
test("produção exige Azure e segredo forte", () => {
  assert.throws(() =>
    configuration({ NODE_ENV: "production", DEV_MEMORY_STORAGE: "true" }),
  );
  assert.throws(() => configuration({ NODE_ENV: "production" }));
  assert.throws(() =>
    configuration({ AZURE_STORAGE_CONNECTION_STRING: "test" }),
  );
  assert.equal(configuration({ DEV_MEMORY_STORAGE: "true" }).memory, true);
  assert.deepEqual(Object.values(tableNames), [
    "AllanRibeiroProdutos",
    "AllanRibeiroClientes",
    "AllanRibeiroPedidos",
  ]);
  assert.equal(containerName, "allan-ribeiro-produtos");
});
test("checkout ignora preços do cliente e rejeita duplicados, inativos e excesso", () => {
  const products = [{ ...sample, rowKey: "p1", ativo: true }];
  assert.equal(
    calculate([{ id: "p1", quantidade: 2, priceCents: 1 }], products)[0]
      .priceCents,
    10001,
  );
  assert.throws(() => calculate([{ id: "p1", quantidade: 4 }], products));
  assert.throws(() =>
    calculate(
      [
        { id: "p1", quantidade: 1 },
        { id: "p1", quantidade: 1 },
      ],
      products,
    ),
  );
  assert.throws(() =>
    calculate(
      [{ id: "p1", quantidade: 1 }],
      [{ ...products[0], ativo: false }],
    ),
  );
});
test("seed é idempotente e preserva registros", async () => {
  const storage = new MemoryStorage();
  assert.equal(await seed(storage), 8);
  assert.equal(await seed(storage), 0);
  assert.equal((await storage.list("products")).length, 8);
});
test("falha ao persistir pedido compensa o estoque", async () => {
  const storage = new MemoryStorage();
  await storage.create("products", {
    ...sample,
    partitionKey: "guitarras",
    rowKey: "p1",
    ativo: true,
  });
  const originalCreate = storage.create.bind(storage);
  storage.create = async (table, item) => {
    if (table === "orders") throw new Error("Falha simulada");
    return originalCreate(table, item);
  };
  await assert.rejects(
    placeOrder(
      storage,
      { id: "cliente-teste" },
      {
        requestId: randomUUID(),
        items: [{ id: "p1", quantidade: 2 }],
        pagamento: "pix",
        entrega: "padrao",
        endereco: "Endereço de teste",
      },
    ),
  );
  assert.equal((await storage.get("products", "guitarras", "p1")).estoque, 3);
  assert.equal((await storage.list("orders")).length, 0);
  assert.throws(() => calculate([null], []));
});
test("cookie Secure em produção e limite de autenticação", async (t) => {
  const storage = new MemoryStorage();
  const config = {
    production: true,
    memory: false,
    secret: randomBytes(48).toString("hex"),
  };
  const server = createApp(storage, config).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Cliente Cookie",
      email: "cookie@example.test",
      senha: randomBytes(16).toString("hex"),
    }),
  });
  assert.match(response.headers.get("set-cookie"), /Secure/);
  for (let i = 0; i < 29; i++)
    await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  const limited = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(limited.status, 429);
  assert.equal(
    (
      await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      })
    ).status,
    400,
  );
});
test("API: autenticação, administração, estoque, imagens e páginas", async (t) => {
  const storage = new MemoryStorage();
  const config = {
    memory: true,
    production: false,
    secret: randomBytes(48).toString("hex"),
  };
  const adminPassword = randomBytes(24).toString("hex");
  await bootstrapAdmin(storage, {
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_PASSWORD: adminPassword,
    ADMIN_NAME: "Administrador",
  });
  const server = createApp(storage, config).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(
    path,
    { method = "GET", body, cookie, headers = {} } = {},
  ) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    const json = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : null;
    return {
      status: response.status,
      body: json,
      cookie: response.headers.get("set-cookie"),
      headers: response.headers,
    };
  }
  let adminCookie, customerCookie, customerId, productId, orderId;
  await t.test("saúde e páginas estáticas", async () => {
    assert.equal(
      (await request("/health")).body.data.storage,
      "memory-development",
    );
    for (const page of [
      "/",
      "/produto.html",
      "/carrinho.html",
      "/checkout.html",
      "/login.html",
      "/cadastro.html",
      "/minha-conta.html",
      "/admin.html",
      "/css/style.css",
      "/css/ui.css",
      "/js/app.js",
      "/js/common.js",
      "/js/admin.js",
      "/assets/hero.svg",
    ]) {
      const r = await fetch(base + page);
      assert.equal(r.status, 200, page);
    }
    assert.equal((await fetch(base + "/nao-existe")).status, 404);
    assert.equal((await request("/inexistente")).status, 404);
  });
  await t.test(
    "rotas privadas negam acesso anônimo e origem externa",
    async () => {
      assert.equal((await request("/admin/summary")).status, 401);
      assert.equal(
        (await request("/orders", { method: "POST", body: {} })).status,
        401,
      );
      assert.equal(
        (
          await request("/auth/logout", {
            method: "POST",
            body: {},
            headers: { Origin: "https://externo.test" },
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "cadastro, cookie HttpOnly e proibição de elevação de papel",
    async () => {
      const pass = randomBytes(16).toString("hex");
      const r = await request("/auth/register", {
        method: "POST",
        body: {
          nome: "Cliente Teste",
          email: "cliente@example.test",
          senha: pass,
          role: "admin",
        },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.role, "customer");
      assert.equal(r.body.data.passwordHash, undefined);
      assert.match(r.cookie, /HttpOnly/);
      assert.match(r.cookie, /SameSite=Lax/);
      customerCookie = r.cookie.split(";")[0];
      customerId = r.body.data.id;
      assert.equal(
        (await request("/admin/summary", { cookie: customerCookie })).status,
        403,
      );
      assert.equal(
        (
          await request("/auth/register", {
            method: "POST",
            body: { nome: "Outro", email: "cliente@example.test", senha: pass },
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "login inválido é genérico e administrador pode entrar",
    async () => {
      assert.equal(
        (
          await request("/auth/login", {
            method: "POST",
            body: { email: "admin@example.test", senha: "incorreta" },
          })
        ).body.error.message,
        "E-mail ou senha inválidos.",
      );
      const r = await request("/auth/login", {
        method: "POST",
        body: { email: "admin@example.test", senha: adminPassword },
      });
      assert.equal(r.status, 200);
      adminCookie = r.cookie.split(";")[0];
      assert.equal(
        (await request("/auth/me", { cookie: adminCookie })).body.data.role,
        "admin",
      );
    },
  );
  await t.test("cadastro e edição de produtos; filtros", async () => {
    let r = await request("/admin/products", {
      method: "POST",
      body: sample,
      cookie: adminCookie,
    });
    assert.equal(r.status, 201);
    productId = r.body.data.id;
    assert.equal(
      (
        await request(
          "/products?marca=Teste&modelo=Modelo&categoria=Guitarras&min=10000&max=10002",
        )
      ).body.data.length,
      1,
    );
    assert.equal((await request("/products?min=abc")).status, 400);
    r = await request(`/admin/products/${productId}`, {
      method: "PATCH",
      body: { ...sample, descricao: "Nova descrição válida" },
      cookie: adminCookie,
    });
    assert.equal(r.status, 200);
  });
  await t.test(
    "upload valida MIME, conteúdo e limite; substituição remove blob antigo",
    async () => {
      const invalid = new FormData();
      invalid.append(
        "image",
        new Blob(["invalid"], { type: "image/png" }),
        "fake.png",
      );
      assert.equal(
        (
          await request(`/admin/products/${productId}/image`, {
            method: "POST",
            body: invalid,
            cookie: adminCookie,
          })
        ).status,
        400,
      );
      const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);
      const first = new FormData();
      first.append(
        "image",
        new Blob([jpeg], { type: "image/jpeg" }),
        "test.jpg",
      );
      assert.equal(
        (
          await request(`/admin/products/${productId}/image`, {
            method: "POST",
            body: first,
            cookie: adminCookie,
          })
        ).status,
        200,
      );
      const firstName = (await storage.list("products"))[0].blobName;
      const second = new FormData();
      second.append(
        "image",
        new Blob([jpeg], { type: "image/jpeg" }),
        "second.jpg",
      );
      assert.equal(
        (
          await request(`/admin/products/${productId}/image`, {
            method: "POST",
            body: second,
            cookie: adminCookie,
          })
        ).status,
        200,
      );
      assert.equal(await storage.blob(firstName), null);
      assert.equal(
        (await fetch(`${base}/api/images/${productId}`)).status,
        200,
      );
      const big = new FormData();
      big.append(
        "image",
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }),
        "big.png",
      );
      assert.equal(
        (
          await request(`/admin/products/${productId}/image`, {
            method: "POST",
            body: big,
            cookie: adminCookie,
          })
        ).status,
        413,
      );
    },
  );
  await t.test(
    "checkout recalcula, mantém snapshots e evita duplicação",
    async () => {
      const payload = {
        items: [{ id: productId, quantidade: 2, priceCents: 1 }],
        totalCents: 1,
        pagamento: "pix",
        entrega: "padrao",
        endereco: "Rua de teste, 123",
        requestId: randomUUID(),
      };
      const r = await request("/orders", {
        method: "POST",
        body: payload,
        cookie: customerCookie,
      });
      assert.equal(r.status, 201);
      orderId = r.body.data.id;
      assert.equal(r.body.data.totalCents, 22502);
      assert.equal(r.body.data.itens[0].nome, "Teste Modelo");
      assert.equal(
        (
          await request("/orders", {
            method: "POST",
            body: payload,
            cookie: customerCookie,
          })
        ).body.data.id,
        orderId,
      );
      assert.equal(
        (await request(`/products/${productId}`)).body.data.estoque,
        1,
      );
      assert.equal(
        (
          await request("/orders", {
            method: "POST",
            body: { ...payload, requestId: randomUUID() },
            cookie: customerCookie,
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "compras concorrentes não vendem a última unidade duas vezes",
    async () => {
      const payload = {
        items: [{ id: productId, quantidade: 1 }],
        pagamento: "boleto",
        entrega: "retirada",
        endereco: "Retirada demonstrativa",
      };
      const results = await Promise.all(
        [1, 2].map(() =>
          request("/orders", {
            method: "POST",
            body: { ...payload, requestId: randomUUID() },
            cookie: customerCookie,
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        (await request(`/products/${productId}`)).body.data.estoque,
        0,
      );
    },
  );
  await t.test(
    "histórico privado, perfil, CRUD de clientes e status",
    async () => {
      assert.equal(
        (await request("/orders", { cookie: customerCookie })).body.data.length,
        2,
      );
      assert.equal(
        (await request("/orders", { cookie: adminCookie })).body.data.length,
        0,
      );
      assert.equal(
        (
          await request("/profile", {
            method: "PATCH",
            body: {
              nome: "Nome atualizado",
              telefone: "123",
              endereco: "Rua teste",
            },
            cookie: customerCookie,
          })
        ).body.data.nome,
        "Nome atualizado",
      );
      assert.equal(
        (
          await request(`/admin/orders/${orderId}`, {
            method: "PATCH",
            body: { status: "Enviado" },
            cookie: adminCookie,
          })
        ).body.data.status,
        "Enviado",
      );
      const customers = await request("/admin/customers", {
        cookie: adminCookie,
      });
      assert.ok(customers.body.data.every((c) => !("passwordHash" in c)));
      assert.equal(
        (
          await request(`/admin/customers/${customerId}`, {
            method: "PATCH",
            body: {
              nome: "Nome editado",
              telefone: "456",
              endereco: "Novo endereço",
            },
            cookie: adminCookie,
          })
        ).status,
        200,
      );
      const created = await request("/admin/customers", {
        method: "POST",
        cookie: adminCookie,
        body: {
          nome: "Cliente Administrativo",
          email: "outro@example.test",
          senha: randomBytes(16).toString("hex"),
        },
      });
      assert.equal(created.status, 201);
      assert.equal(
        (
          await request(`/admin/customers/${customerId}`, {
            method: "DELETE",
            cookie: adminCookie,
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/auth/me", { cookie: customerCookie })).status,
        401,
      );
    },
  );
  await t.test(
    "exclusão de produto preserva pedidos e remove seu blob",
    async () => {
      const p = (await storage.list("products"))[0];
      assert.equal(
        (
          await request(`/admin/products/${productId}`, {
            method: "DELETE",
            cookie: adminCookie,
          })
        ).status,
        200,
      );
      assert.equal(await storage.blob(p.blobName), null);
      assert.equal((await request(`/products/${productId}`)).status, 404);
      assert.equal(
        (await request("/admin/orders", { cookie: adminCookie })).body.data
          .length,
        2,
      );
      const r = await request("/auth/logout", {
        method: "POST",
        body: {},
        cookie: adminCookie,
      });
      assert.equal(r.status, 200);
      assert.match(r.cookie, /Expires=Thu, 01 Jan 1970/);
    },
  );
});
