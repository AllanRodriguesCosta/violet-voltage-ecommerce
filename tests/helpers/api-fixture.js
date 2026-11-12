// Loja em memória com o catálogo seed (sem imagens), administrador e cliente HTTP de teste.
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { MemoryStorage } from "../../src/repositories/memory.js";
import { createApp } from "../../src/app.js";
import { bootstrapAdmin } from "../../src/services/bootstrap.js";
import { seedProducts } from "../../src/services/seed-products.js";

export async function storeFixture(t, { overrides = {} } = {}) {
  const storage = new MemoryStorage();
  const now = new Date().toISOString();
  for (const source of seedProducts) {
    const data = { ...source, ...(overrides[source.rowKey] || {}) };
    delete data.file;
    await storage.create("products", {
      ...data,
      partitionKey: data.categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
      ativo: true,
      blobName: "",
      imageUrl: "",
      createdAt: now,
      updatedAt: now,
    });
  }
  const adminPassword = randomBytes(16).toString("hex");
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@loja.test", ADMIN_PASSWORD: adminPassword, ADMIN_NAME: "Admin Loja" });
  const app = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") });
  const http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { method = "POST", body = {}, cookie } = {}) => {
    const r = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: r.status, body: json, cookie: r.headers.get("set-cookie")?.split(";")[0], headers: r.headers };
  };
  const register = async (email) =>
    (await call("/auth/register", { body: { nome: "Cliente Teste", email, senha: randomBytes(12).toString("hex") } })).cookie;
  const admin = async () => (await call("/auth/login", { body: { email: "admin@loja.test", senha: adminPassword } })).cookie;
  return { storage, call, register, admin, url };
}
