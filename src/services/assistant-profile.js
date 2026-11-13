// Etapa 36: memória do assistente para quem tem conta. Guarda só o gosto do último setup
// (gênero, artista, tipo de som, cor, teto e o que o cliente já tem), nunca a conversa.
// O cliente pede para esquecer pelo próprio assistente; a cópia de dados e a exclusão da
// conta incluem este registro.
import { sanitizeContext } from "../assistant/context.js";

const KEYS = ["genero", "artista", "som", "cor", "max", "tenho", "estilo"];
export function tasteOf(filtros = {}) {
  const clean = sanitizeContext({ filtros }).filtros;
  const out = Object.fromEntries(KEYS.filter((k) => clean[k] !== undefined).map((k) => [k, clean[k]]));
  return Object.keys(out).length ? out : null;
}
export async function loadProfile(storage, user) {
  const p = await storage.get("profiles", user.id, user.id);
  return p ? tasteOf(p.gosto) : null;
}
export async function saveProfile(storage, user, filtros) {
  const gosto = tasteOf(filtros);
  if (!gosto) return null;
  const current = await storage.get("profiles", user.id, user.id);
  if (current && JSON.stringify(current.gosto) === JSON.stringify(gosto)) return gosto;
  const next = { partitionKey: user.id, rowKey: user.id, gosto, updatedAt: new Date().toISOString() };
  if (current) await storage.save("profiles", next, current.etag);
  else await storage.create("profiles", next);
  return gosto;
}
export async function forgetProfile(storage, user) {
  if (await storage.get("profiles", user.id, user.id)) await storage.remove("profiles", user.id, user.id);
}
export const profileDeps = (storage, user) =>
  user
    ? { carregar: () => loadProfile(storage, user), salvar: (f) => saveProfile(storage, user, f), esquecer: () => forgetProfile(storage, user) }
    : undefined;
