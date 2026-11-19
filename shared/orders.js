// Pedidos na loja: espelho das regras do servidor (tests/orders.test.js garante paridade com
// src/services/orders.js), rótulos, número curto e previsão de entrega em dias úteis.
export const statuses = ["Recebido", "Em preparação", "Enviado", "Concluído", "Cancelado"];
const flow = statuses.slice(0, 4);
/** @param {string} status @returns {string[]} */
export function allowedNext(status) {
  const index = flow.indexOf(status);
  if (index < 0 || status === "Concluído") return [];
  const forward = flow.slice(index + 1);
  return index <= 1 ? [...forward, "Cancelado"] : forward;
}
/** @param {string} status */
export const statusClass = (status) =>
  /** @type {Record<string, string>} */ ({ Recebido: "received", "Em preparação": "preparing", Enviado: "shipped", Concluído: "done", Cancelado: "canceled" })[status] || "received";
/** @type {Record<string, string>} */
export const paymentLabels = { pix: "Pix", cartao: "Cartão de crédito", boleto: "Boleto" };
/** @type {Record<string, string>} */
export const deliveryLabels = { padrao: "Entrega padrão", expressa: "Entrega expressa", retirada: "Retirada na loja" };
/** @param {{ id: string }} order */
export const orderNumber = (order) => order.id.slice(0, 8).toUpperCase();
// Prazo em dias úteis por forma de entrega (o mesmo anunciado no checkout).
/** @type {Record<string, [number, number]>} */
const businessDays = { padrao: [5, 8], expressa: [1, 3], retirada: [1, 1] };
/** @param {string | number | Date} start @param {number} days */
function addBusinessDays(start, days) {
  const d = new Date(start);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}
// Previsão de entrega (ou de retirada) contada a partir da confirmação do pedido.
/** @param {{ entrega: string, status: string, createdAt: string }} order @returns {{ from: Date, to: Date, text: string } | null} */
export function deliveryWindow(order) {
  const range = businessDays[order.entrega];
  if (!range || ["Concluído", "Cancelado"].includes(order.status)) return null;
  const [from, to] = range.map((n) => addBusinessDays(order.createdAt, n));
  /** @param {Date} d */
  const day = (d) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const label = order.entrega === "retirada" ? "Retirada a partir de" : "Previsão de entrega";
  return { from, to, text: from.getTime() === to.getTime() ? `${label} ${day(from)}` : `${label}: ${day(from)} a ${day(to)}` };
}
