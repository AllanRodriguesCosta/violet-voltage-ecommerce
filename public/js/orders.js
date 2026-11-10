import { icon } from "./icons.js";
import { money, escapeHtml as esc, productImage } from "./common.js";

// Espelho das regras do servidor (teste garante paridade com src/services/orders.js).
export const statuses = ["Recebido", "Em preparação", "Enviado", "Concluído", "Cancelado"];
const flow = statuses.slice(0, 4);
export function allowedNext(status) {
  const index = flow.indexOf(status);
  if (index < 0 || status === "Concluído") return [];
  const forward = flow.slice(index + 1);
  return index <= 1 ? [...forward, "Cancelado"] : forward;
}
export const statusClass = (status) =>
  ({ Recebido: "received", "Em preparação": "preparing", Enviado: "shipped", Concluído: "done", Cancelado: "canceled" })[status] || "received";
const paymentLabels = { pix: "Pix", cartao: "Cartão de crédito", boleto: "Boleto" };
const deliveryLabels = { padrao: "Entrega padrão", expressa: "Entrega expressa", retirada: "Retirada na loja" };
const date = (value) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const steps = [
  ["Recebido", "package"],
  ["Em preparação", "store"],
  ["Enviado", "truck"],
  ["Concluído", "check"],
];
export function timelineHTML(order) {
  const history = order.statusHistory?.length ? order.statusHistory : [{ status: "Recebido", at: order.createdAt }];
  const when = Object.fromEntries(history.map((h) => [h.status, h.at]));
  if (order.status === "Cancelado")
    return `<ol class="timeline is-canceled"><li class="done"><span class="dot">${icon("package", { size: 16 })}</span><span><strong>Recebido</strong><small>${date(when.Recebido || order.createdAt)}</small></span></li><li class="canceled"><span class="dot">${icon("close", { size: 16 })}</span><span><strong>Cancelado</strong><small>${when.Cancelado ? date(when.Cancelado) : ""}${order.estoqueDevolvido ? " · itens devolvidos ao estoque" : ""}</small></span></li></ol>`;
  const reached = flow.indexOf(order.status);
  return `<ol class="timeline">${steps
    .map(([status, symbol], i) => `<li class="${i < reached ? "done" : i === reached ? "current" : ""}"${i === reached ? ' aria-current="step"' : ""}><span class="dot">${icon(symbol, { size: 16 })}</span><span><strong>${status}</strong><small>${when[status] ? date(when[status]) : i <= reached ? "—" : "Próxima etapa"}</small></span></li>`)
    .join("")}</ol>`;
}
export function orderCardHTML(order, { products = [], admin = false, customer, readonly = false } = {}) {
  const items = order.itens;
  const byId = new Map(products.map((p) => [p.id, p]));
  const count = items.reduce((s, i) => s + i.quantidade, 0);
  const next = allowedNext(order.status);
  return `<article class="order-card" data-order-id="${esc(order.id)}"><header class="order-card-head"><div><strong>Pedido #${esc(order.id.slice(0, 8).toUpperCase())}</strong><small>${new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}${customer ? ` · ${esc(customer)}` : ""}</small></div><span class="status status-${statusClass(order.status)}">${esc(order.status)}</span></header>
<div class="order-thumbs">${items.slice(0, 4).map((i) => `<img src="${esc(productImage(byId.get(i.id) || { categoria: "" }))}" alt="${esc(i.nome)}" width="52" height="52" title="${esc(i.nome)}">`).join("")}${items.length > 4 ? `<span>+${items.length - 4}</span>` : ""}<p><strong>${money(order.totalCents)}</strong><small>${count} ${count === 1 ? "item" : "itens"} · ${esc(paymentLabels[order.pagamento] || order.pagamento)}${order.parcelas > 1 ? ` em ${order.parcelas}x` : ""}</small></p></div>
${timelineHTML(order)}
<details class="order-details"><summary>Detalhes do pedido ${icon("chevronDown", { size: 16 })}</summary><ul class="order-items">${items.map((i) => `<li><span>${i.quantidade} × ${esc(i.nome)}</span><strong>${money(i.priceCents * i.quantidade)}</strong></li>`).join("")}</ul><dl class="order-facts"><div><dt>Subtotal</dt><dd>${money(order.subtotalCents)}</dd></div><div><dt>Frete</dt><dd>${order.freteCents ? money(order.freteCents) : "Grátis"}</dd></div>${order.descontoCents ? `<div><dt>Desconto${order.cupom ? ` (${esc(order.cupom)})` : ""}</dt><dd>− ${money(order.descontoCents)}</dd></div>` : ""}<div><dt>Entrega</dt><dd>${esc(deliveryLabels[order.entrega] || order.entrega)}</dd></div><div class="wide"><dt>Endereço</dt><dd>${esc(order.endereco)}</dd></div><div class="wide"><dt>Número completo</dt><dd>${esc(order.id)}</dd></div></dl></details>
${readonly ? "" : `<footer class="order-actions">${
    admin
      ? next.length
        ? `<label class="sr-only" for="status-${esc(order.id)}">Novo status</label><select id="status-${esc(order.id)}" data-status-select><option value="">Alterar status…</option>${next.map((s) => `<option>${s}</option>`).join("")}</select>`
        : '<span class="small muted">Pedido encerrado.</span>'
      : `<button type="button" class="secondary" data-reorder>${icon("refresh", { size: 16 })}Comprar novamente</button>${order.status === "Recebido" ? `<button type="button" class="text-button danger-text" data-cancel>Cancelar pedido</button>` : ""}`
  }</footer>`}</article>`;
}
