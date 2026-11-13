import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { email, text } from "../utils/validation.js";
export async function bootstrapAdmin(storage, env = process.env) {
  if (!env.ADMIN_EMAIL && !env.ADMIN_PASSWORD && !env.ADMIN_NAME) return;
  // Etapa 32: várias instâncias subindo juntas (balanceador) não podem criar o admin duas vezes.
  // Quem não pega a trava pula: outra instância já está gravando o mesmo administrador.
  if (storage.withLock) return void (await storage.withLock("admin-bootstrap", () => saveAdmin(storage, env)));
  await saveAdmin(storage, env);
}
async function saveAdmin(storage, env) {
  const address = email(env.ADMIN_EMAIL);
  const password = text(env.ADMIN_PASSWORD, "senha do administrador", 12, 72);
  if (Buffer.byteLength(password) > 72)
    throw new Error("Senha do administrador excede 72 bytes.");
  const nome = text(env.ADMIN_NAME, "nome do administrador", 2);
  const old = await storage.get("customers", "cliente", address);
  const u = {
    partitionKey: "cliente",
    rowKey: address,
    id: old?.id || randomUUID(),
    nome,
    telefone: old?.telefone || "",
    endereco: old?.endereco || "",
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
    ativo: true,
    createdAt: old?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (old) await storage.save("customers", u, old.etag);
  else await storage.create("customers", u);
}
