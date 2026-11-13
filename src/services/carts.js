// Etapa 34: carrinho salvo na conta. O navegador continua sendo a fonte do carrinho; com login,
// ele é espelhado aqui para aparecer em outro aparelho e para o lembrete de carrinho esquecido.
import { AppError } from "../utils/validation.js";
import { notify } from "./notifications.js";

export const REMINDER_HOURS = 24;
const SERVICES = ["regulagem", "cordas", "garantia"];
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);

export function cleanItems(value) {
  if (!Array.isArray(value) || value.length > 30) throw new AppError(400, "Carrinho inválido.");
  const seen = new Set();
  return value.map((i) => {
    if (!i || !validId(i.id) || !Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 99 || seen.has(i.id)) throw new AppError(400, "Item de carrinho inválido.");
    seen.add(i.id);
    const out = { id: i.id, quantidade: i.quantidade };
    if (i.cor !== undefined && i.cor !== null) {
      if (typeof i.cor !== "string" || i.cor.length > 30) throw new AppError(400, "Cor inválida.");
      out.cor = i.cor;
    }
    if (i.servicos !== undefined) {
      if (!Array.isArray(i.servicos) || i.servicos.some((s) => !SERVICES.includes(s))) throw new AppError(400, "Serviços inválidos.");
      if (i.servicos.length) out.servicos = [...new Set(i.servicos)];
    }
    return out;
  });
}
export async function getSavedCart(storage, user) {
  const c = await storage.get("carts", user.id, user.id);
  return { itens: c?.itens || [], updatedAt: c?.updatedAt || null };
}
export async function saveCart(storage, user, items) {
  const itens = cleanItems(items);
  const current = await storage.get("carts", user.id, user.id);
  const now = new Date().toISOString();
  // Mesmo conteúdo: não mexe na data (o lembrete conta a partir da última mudança real).
  if (current && JSON.stringify(current.itens) === JSON.stringify(itens)) return { itens, updatedAt: current.updatedAt };
  const next = { partitionKey: user.id, rowKey: user.id, itens, updatedAt: now, lembradoEm: null };
  if (current) await storage.save("carts", next, current.etag);
  else await storage.create("carts", next);
  return { itens, updatedAt: now };
}
export async function clearCart(storage, userId) {
  if (await storage.get("carts", userId, userId)) await storage.remove("carts", userId, userId);
}
// Lembrete único por versão do carrinho: itens parados há 24 h sem pedido depois disso.
export async function remindAbandoned(storage, user, now = new Date()) {
  const c = await storage.get("carts", user.id, user.id);
  if (!c?.itens?.length || c.lembradoEm) return null;
  if (now - new Date(c.updatedAt) < REMINDER_HOURS * 3_600_000) return null;
  const orders = await storage.listByPartition("orders", user.id);
  if (orders.some((o) => o.createdAt > c.updatedAt)) return null;
  await storage.save("carts", { ...c, lembradoEm: now.toISOString() }, c.etag);
  const count = c.itens.reduce((s, i) => s + i.quantidade, 0);
  return notify(storage, user.id, {
    tipo: "carrinho",
    titulo: "Você deixou itens no carrinho",
    texto: `${count} ${count === 1 ? "item espera" : "itens esperam"} por você. Os preços e o estoque são conferidos de novo ao abrir o carrinho.`,
    link: "/carrinho.html",
  });
}
// Carrinhos com itens, sem pedido depois da última mudança, parados há mais de 24 h (painel).
export async function abandonedStats(storage, now = new Date()) {
  const [carts, orders] = await Promise.all([storage.list("carts"), storage.list("orders")]);
  const withItems = carts.filter((c) => c.itens?.length);
  const abandoned = withItems.filter((c) => now - new Date(c.updatedAt) >= REMINDER_HOURS * 3_600_000 && !orders.some((o) => o.partitionKey === c.partitionKey && o.createdAt > c.updatedAt));
  return { carrinhosSalvos: withItems.length, abandonados: abandoned.length, itensAbandonados: abandoned.reduce((s, c) => s + c.itens.reduce((t, i) => t + i.quantidade, 0), 0), lembretes: abandoned.filter((c) => c.lembradoEm).length };
}
