// Etapa 35: servidor para os testes de navegador e o Lighthouse do CI. Usa o armazenamento em
// memória com o catálogo seed (sem fotos), um administrador de teste e nenhum serviço externo.
// Uso: node scripts/e2e-server.js  (porta 4173 ou PORT)
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
import { seedProducts } from "../src/services/seed-products.js";

export const E2E_ADMIN = { email: "admin@e2e.test", senha: "e2e-admin-senha-2026" };
const storage = new MemoryStorage();
const now = new Date().toISOString();
for (const source of seedProducts) {
  const data = { ...source };
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
await bootstrapAdmin(storage, { ADMIN_EMAIL: E2E_ADMIN.email, ADMIN_PASSWORD: E2E_ADMIN.senha, ADMIN_NAME: "Admin E2E" });
const port = Number(process.env.PORT || 4173);
createApp(storage, { production: false, memory: true, secret: "e2e-".repeat(16) }).listen(port, "127.0.0.1", () => console.log(`e2e na porta ${port}`));
