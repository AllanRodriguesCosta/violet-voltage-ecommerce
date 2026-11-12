import { randomUUID } from "node:crypto";

// Notificações da conta (status do pedido e estoque de volta) e avisos "Avise-me".
const LIMIT = 30;
export const shortId = (id) => String(id).slice(0, 8).toUpperCase();

export async function notify(storage, customerId, { tipo, titulo, texto, link }) {
  const id = randomUUID();
  const item = { partitionKey: customerId, rowKey: id, id, customerId, tipo, titulo, texto, link, createdAt: new Date().toISOString(), readAt: null };
  await storage.create("notifications", item);
  return item;
}
export async function listNotifications(storage, customerId) {
  const all = (await storage.listByPartition("notifications", customerId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { itens: all.slice(0, LIMIT).map(publicNotification), naoLidas: all.filter((n) => !n.readAt).length };
}
export async function unreadCount(storage, customerId) {
  return (await storage.listByPartition("notifications", customerId)).filter((n) => !n.readAt).length;
}
export async function markRead(storage, customerId, ids) {
  const wanted = Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : null;
  const now = new Date().toISOString();
  for (const n of await storage.listByPartition("notifications", customerId))
    if (!n.readAt && (!wanted || wanted.has(n.rowKey))) await storage.save("notifications", { ...n, readAt: now }, n.etag);
  return unreadCount(storage, customerId);
}
export const publicNotification = (n) => ({ id: n.rowKey, tipo: n.tipo, titulo: n.titulo, texto: n.texto, link: n.link, createdAt: n.createdAt, lida: !!n.readAt });

const statusText = {
  "Em preparação": ["em preparação", "Estamos separando e embalando os seus itens."],
  Enviado: ["enviado", "Seu pedido está a caminho."],
  Concluído: ["concluído", "Obrigado por comprar na Violet Voltage. Bom som!"],
  Cancelado: ["cancelado", "Os itens voltaram ao estoque. Em caso de dúvida, consulte a central de ajuda."],
};
export function orderNotice(order, status) {
  const [label, texto] = statusText[status] || [status.toLowerCase(), "O status do seu pedido foi atualizado."];
  const pickup = order.entrega === "retirada";
  return {
    tipo: "pedido",
    titulo: pickup && status === "Enviado" ? `Pedido #${shortId(order.rowKey)} liberado para retirada` : `Pedido #${shortId(order.rowKey)} ${label}`,
    texto: pickup && status === "Enviado" ? "Retire na loja com um documento com foto e o número do pedido." : order.rastreio && status === "Enviado" ? `${texto} Código de rastreio: ${order.rastreio}.` : texto,
    link: status === "Cancelado" ? "/minha-conta.html#pedidos" : `/pedido.html?id=${encodeURIComponent(order.rowKey)}`,
  };
}

// "Avise-me": um aviso por cliente e produto; ao voltar ao estoque, vira notificação uma vez.
export const alertKey = (customerId, productId) => `${customerId}:${productId}`;
export async function restockAlerts(storage, product) {
  if (!product?.ativo || !(product.estoque > 0)) return 0;
  const pending = (await storage.list("alerts")).filter((a) => a.productId === product.rowKey && !a.notifiedAt);
  for (const alert of pending) {
    await notify(storage, alert.customerId, {
      tipo: "estoque",
      titulo: `${product.marca} ${product.modelo} voltou ao estoque`,
      texto: "O item que você pediu para avisar está disponível de novo.",
      link: `/produto.html?id=${encodeURIComponent(product.rowKey)}`,
    });
    await storage.save("alerts", { ...alert, notifiedAt: new Date().toISOString() }, alert.etag);
  }
  return pending.length;
}
export async function demandByProduct(storage) {
  const counts = new Map();
  for (const a of await storage.list("alerts")) if (!a.notifiedAt) counts.set(a.productId, (counts.get(a.productId) || 0) + 1);
  return counts;
}
