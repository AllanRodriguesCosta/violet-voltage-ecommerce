import { icon } from "../icons.js";
import { api, money, escapeHtml as esc, requireUser } from "../common.js";
import { errorState } from "../components.js";
import { timelineHTML, trackingHTML, totalsFactsHTML, orderNumber, paymentLabels, deliveryLabels, statusClass } from "../orders.js";

// Comprovante do pedido: tela e impressão (o botão usa a impressão do navegador, que salva em PDF).
export default async function orderPage(session) {
  if (!requireUser(await session)) return;
  const container = document.querySelector("#order-content");
  const id = new URLSearchParams(location.search).get("id") || "";
  let order;
  try {
    order = await api(`/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    container.removeAttribute("aria-busy");
    errorState(container, error, error.status === 404 ? null : () => orderPage(session), {
      level: 1,
      title: error.status === 404 ? "Pedido não encontrado." : "Não foi possível carregar o pedido.",
      text: error.status === 404 ? "Confira o link ou abra o pedido pela lista em Minha conta." : undefined,
      back: { href: "/minha-conta.html#pedidos", label: "Ver meus pedidos" },
    });
    return;
  }
  const number = orderNumber(order);
  document.title = `Pedido #${number} | Violet Voltage`;
  document.querySelector("#crumb-current").textContent = `Pedido #${number}`;
  const created = new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  container.removeAttribute("aria-busy");
  container.innerHTML = `<header class="page-head receipt-head"><div><span class="eyebrow">Comprovante do pedido</span><h1 class="page-title">Pedido #${esc(number)}</h1><p class="lead">Feito em ${esc(created)}</p></div><div class="row no-print"><span class="status status-${statusClass(order.status)}">${esc(order.status)}</span><button type="button" class="secondary" data-print>${icon("printer", { size: 18 })}Imprimir ou salvar PDF</button></div></header>
<div class="receipt-grid"><section class="panel receipt-status" aria-labelledby="receipt-status-title"><h2 id="receipt-status-title">Acompanhamento</h2>${timelineHTML(order)}${trackingHTML(order)}</section>
<section class="panel" aria-labelledby="receipt-items-title"><h2 id="receipt-items-title">Itens</h2><div class="table-wrap"><table class="receipt-table"><thead><tr><th scope="col">Produto</th><th scope="col">Qtd.</th><th scope="col">Preço</th><th scope="col">Total</th></tr></thead><tbody>${order.itens
    .map((i) => `<tr><td><a href="/produto.html?id=${encodeURIComponent(i.id)}">${esc(i.nome)}</a>${(i.servicos || []).map((s) => `<small class="receipt-service">+ ${esc(s.nome)}: ${money(s.priceCents)} cada</small>`).join("")}</td><td>${i.quantidade}</td><td>${money(i.priceCents)}</td><td>${money(i.priceCents * i.quantidade + (i.servicos || []).reduce((t, s) => t + s.priceCents * i.quantidade, 0))}</td></tr>`)
    .join("")}</tbody></table></div><dl class="order-facts receipt-totals">${totalsFactsHTML(order)}<div class="total"><dt>Total</dt><dd>${money(order.totalCents)}</dd></div></dl></section>
<section class="panel" aria-labelledby="receipt-info-title"><h2 id="receipt-info-title">Pagamento e entrega</h2><dl class="order-facts"><div><dt>Pagamento</dt><dd>${esc(paymentLabels[order.pagamento] || order.pagamento)}${order.parcelas > 1 ? ` em ${order.parcelas}x de ${money(Math.ceil(order.totalCents / order.parcelas))}` : ""}</dd></div><div><dt>Entrega</dt><dd>${esc(deliveryLabels[order.entrega] || order.entrega)}</dd></div><div class="wide"><dt>${order.entrega === "retirada" ? "Retirada" : "Endereço"}</dt><dd>${order.entrega === "retirada" ? "Loja Violet Voltage. Leve um documento com foto e o número do pedido." : esc(order.endereco)}</dd></div><div class="wide"><dt>Número completo</dt><dd class="mono">${esc(order.id)}</dd></div></dl></section></div>
<p class="small muted receipt-note">Este comprovante resume o pedido e não substitui a nota fiscal. Dúvidas? <a href="/ajuda.html#pedidos">Central de ajuda</a>.</p>
<div class="row no-print"><a class="button secondary" href="/minha-conta.html#pedidos">${icon("chevronLeft", { size: 16 })}Meus pedidos</a></div>`;
  container.querySelector("[data-print]").addEventListener("click", () => print());
}
