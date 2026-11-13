import { icon } from "./icons.js";
import { money, escapeHtml as esc, productImage, itemImage } from "./common.js";

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
// Prazo em dias úteis por forma de entrega (o mesmo anunciado no checkout).
const businessDays = { padrao: [5, 8], expressa: [1, 3], retirada: [1, 1] };
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
export function deliveryWindow(order) {
  const range = businessDays[order.entrega];
  if (!range || ["Concluído", "Cancelado"].includes(order.status)) return null;
  const [from, to] = range.map((n) => addBusinessDays(order.createdAt, n));
  const day = (d) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const label = order.entrega === "retirada" ? "Retirada a partir de" : "Previsão de entrega";
  return { from, to, text: from.getTime() === to.getTime() ? `${label} ${day(from)}` : `${label}: ${day(from)} a ${day(to)}` };
}
export function trackingHTML(order) {
  const win = deliveryWindow(order);
  const parts = [];
  if (win) parts.push(`<span>${icon("clock", { size: 16 })}${esc(win.text)}</span>`);
  if (order.rastreio) parts.push(`<span>${icon("truck", { size: 16 })}Código de rastreio: <strong class="mono">${esc(order.rastreio)}</strong></span>`);
  return parts.length ? `<p class="order-tracking">${parts.join("")}</p>` : "";
}
export const orderNumber = (order) => order.id.slice(0, 8).toUpperCase();
export function totalsFactsHTML(order) {
  const kits = order.kits || [];
  return `<div><dt>Subtotal</dt><dd>${money(order.subtotalCents)}</dd></div>${order.servicosCents ? `<div><dt>Serviços</dt><dd>${money(order.servicosCents)}</dd></div>` : ""}${kits.map((k) => `<div><dt>Desconto ${esc(k.nome)}${k.quantidade > 1 ? ` (${k.quantidade}x)` : ""}</dt><dd>− ${money(k.descontoCents)}</dd></div>`).join("")}<div><dt>Frete</dt><dd>${order.freteCents ? money(order.freteCents) : "Grátis"}</dd></div>${order.descontoCents ? `<div><dt>Desconto${order.cupom ? ` (${esc(order.cupom)})` : ""}</dt><dd>− ${money(order.descontoCents)}</dd></div>` : ""}`;
}
export { paymentLabels, deliveryLabels };
// Solicitação de troca: aviso no cartão do pedido; no painel, com resposta da loja.
function exchangeNoteHTML(order, admin) {
  const t = (order.trocas || []).at(-1);
  if (!t) return "";
  const names = new Map(order.itens.map((i) => [i.id, i.nome]));
  const label = `${t.tipo === "troca" ? "Troca" : "Devolução"} ${t.status === "Aberta" ? "solicitada" : t.status === "Aprovada" ? "aprovada" : "recusada"}`;
  return `<div class="exchange-note${t.status === "Aberta" ? " is-open" : ""}"><p>${icon("refresh", { size: 16 })}<strong>${label}</strong>: ${esc(t.itens.map((id) => names.get(id) || id).join(", "))}. <span class="muted">“${esc(t.motivo)}”</span></p>${admin && t.status === "Aberta" ? `<form class="exchange-admin" data-exchange="${esc(order.id)}"><label class="sr-only" for="exchange-reply-${esc(order.id)}">Resposta ao cliente</label><input id="exchange-reply-${esc(order.id)}" name="resposta" maxlength="500" placeholder="Resposta ao cliente (opcional)"><button type="submit" name="status" value="Aprovada" class="small-button">Aprovar</button><button type="submit" name="status" value="Recusada" class="secondary small-button">Recusar</button></form>` : ""}</div>`;
}
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
  return `<article class="order-card" data-order-id="${esc(order.id)}"><header class="order-card-head"><div><strong>Pedido #${esc(orderNumber(order))}</strong><small>${new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}${customer ? ` · ${esc(customer)}` : ""}</small></div><span class="status status-${statusClass(order.status)}">${esc(order.status)}</span></header>
<div class="order-thumbs">${items.slice(0, 4).map((i) => `<img src="${esc(byId.get(i.id) ? itemImage(byId.get(i.id), i.cor) : productImage({ categoria: "" }))}" alt="${esc(i.nome)}" width="52" height="52" title="${esc(i.nome)}">`).join("")}${items.length > 4 ? `<span>+${items.length - 4}</span>` : ""}<p><strong>${money(order.totalCents)}</strong><small>${count} ${count === 1 ? "item" : "itens"} · ${esc(paymentLabels[order.pagamento] || order.pagamento)}${order.parcelas > 1 ? ` em ${order.parcelas}x` : ""}</small></p></div>
${timelineHTML(order)}${trackingHTML(order)}
<details class="order-details"><summary>Detalhes do pedido ${icon("chevronDown", { size: 16 })}</summary><ul class="order-items">${items.map((i) => `<li><span>${i.quantidade} × ${esc(i.nome)}${i.cor ? `<small class="order-service">Cor: ${esc(i.cor)}</small>` : ""}${(i.servicos || []).map((s) => `<small class="order-service">+ ${esc(s.nome)}</small>`).join("")}</span><strong>${money((i.priceCents + (i.servicos || []).reduce((t, s) => t + s.priceCents, 0)) * i.quantidade)}</strong></li>`).join("")}</ul><dl class="order-facts">${totalsFactsHTML(order)}<div><dt>Entrega</dt><dd>${esc(deliveryLabels[order.entrega] || order.entrega)}</dd></div><div class="wide"><dt>Endereço</dt><dd>${esc(order.endereco)}</dd></div><div class="wide"><dt>Número completo</dt><dd>${esc(order.id)}</dd></div></dl></details>
${exchangeNoteHTML(order, admin)}${readonly ? "" : `<footer class="order-actions">${
    admin
      ? next.length
        ? `<label class="sr-only" for="status-${esc(order.id)}">Novo status</label><select id="status-${esc(order.id)}" data-status-select><option value="">Alterar status…</option>${next.map((s) => `<option>${s}</option>`).join("")}</select>`
        : '<span class="small muted">Pedido encerrado.</span>'
      : `<a class="button secondary" href="/pedido.html?id=${encodeURIComponent(order.id)}">${icon("package", { size: 16 })}Comprovante</a><button type="button" class="secondary" data-reorder>${icon("refresh", { size: 16 })}Comprar novamente</button>${order.status === "Recebido" ? `<button type="button" class="text-button danger-text" data-cancel>Cancelar pedido</button>` : ""}`
  }</footer>`}</article>`;
}
