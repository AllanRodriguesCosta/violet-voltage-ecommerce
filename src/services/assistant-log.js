// Frases que o assistente não entendeu, guardadas sem identificar o cliente: sem conta,
// nome, e-mail, códigos de pedido nem telefones. Ficam 90 dias e servem para
// a loja ensinar novas frases ao assistente (painel > Assistente).
import { randomUUID } from "node:crypto";

export const RETENTION_DAYS = 90;
export function anonymize(message) {
  return String(message || "")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[código]")
    .replace(/#?\b[0-9a-f]{6,8}\b/gi, (m) => (/\d/.test(m) ? "[código]" : m))
    .replace(/\(?\d[\d\s().-]{7,}\d/g, "[número]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
export async function logMiss(storage, message, now = new Date()) {
  const texto = anonymize(message);
  if (!texto) return;
  const limit = new Date(now.getTime() - RETENTION_DAYS * 86400000).toISOString();
  for (const old of (await storage.list("assistantLog")).filter((x) => x.createdAt < limit)) await storage.remove("assistantLog", old.partitionKey, old.rowKey);
  await storage.create("assistantLog", { partitionKey: "faltas", rowKey: randomUUID(), texto, createdAt: now.toISOString() });
}
// Agrupado por frase (sem diferenciar maiúsculas), mais frequentes e recentes primeiro.
export async function missSummary(storage) {
  const groups = new Map();
  for (const x of await storage.list("assistantLog")) {
    const key = x.texto.toLowerCase();
    const g = groups.get(key) || { texto: x.texto, vezes: 0, ultima: x.createdAt };
    g.vezes++;
    if (x.createdAt > g.ultima) g.ultima = x.createdAt;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima)).slice(0, 50);
}
export async function clearMisses(storage) {
  for (const x of await storage.list("assistantLog")) await storage.remove("assistantLog", x.partitionKey, x.rowKey);
}
