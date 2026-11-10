import { icon } from "../icons.js";
import { send, money, escapeHtml as esc, getCart, setCart, bindForm, showError, requireUser } from "../common.js";
import { emptyState } from "../components.js";
import { cartData, subtotal } from "./cart.js";

export default async function checkout(session) {
  const user = await session;
  if (!requireUser(user)) return;
  const form = document.querySelector("#checkout-form");
  const submit = form.querySelector("[type=submit]");
  const summary = document.querySelector("#checkout-summary");
  submit.disabled = true;
  let items;
  try {
    items = await cartData();
  } catch (error) {
    summary.replaceChildren();
    showError(summary, error);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Carregar pedido novamente";
    retry.onclick = () => {
      retry.disabled = true;
      checkout(session);
    };
    summary.append(retry);
    return;
  }
  if (!items.length) {
    document.querySelector("#checkout-content").innerHTML = emptyState({
      symbol: "bag",
      title: "Seu carrinho está vazio.",
      actions: '<a class="button" href="/catalogo.html">Explorar catálogo</a>',
    });
    return;
  }
  if (items.some((i) => !i.product || i.quantidade > i.product.estoque)) {
    document.querySelector("#checkout-content").innerHTML =
      '<div class="error">Existem itens indisponíveis. <a href="/carrinho.html">Revise o carrinho</a> antes de continuar.</div>';
    return;
  }
  if (!form.elements.endereco.value) form.elements.endereco.value = user.endereco || "";
  function refresh() {
    const freight = { padrao: 2500, expressa: 4500, retirada: 0 }[form.elements.entrega.value];
    summary.innerHTML = `<h2>Seu pedido</h2>${items.map((i) => `<div class="summary-line"><span>${i.quantidade} × ${esc(i.product.modelo)}</span><strong>${money(i.product.priceCents * i.quantidade)}</strong></div>`).join("")}<div class="summary-line"><span>Frete</span><strong>${money(freight)}</strong></div><div class="summary-line summary-total"><span>Total</span><span>${money(subtotal(items) + freight)}</span></div>`;
  }
  form.elements.entrega.onchange = () => {
    if (form.elements.entrega.value === "retirada" && !form.elements.endereco.value)
      form.elements.endereco.value = "Retirada na loja";
    refresh();
  };
  refresh();
  submit.disabled = false;
  submit.textContent = "Confirmar pedido";
  const requestId = crypto.randomUUID();
  bindForm(form, async (data) => {
    const order = await send("/orders", { ...data, requestId, items: getCart() });
    let cartCleared = true;
    try {
      setCart([]);
    } catch {
      cartCleared = false;
    }
    document.querySelector("#checkout-content").innerHTML =
      `<div class="panel narrow confirmation" role="status" tabindex="-1"><div class="success-icon" aria-hidden="true">${icon("check", { size: 36 })}</div><h2>Seu pedido foi registrado.</h2><p class="lead">Os detalhes já estão disponíveis no seu histórico.</p><p class="small">Número do pedido</p><p class="order-number">${esc(order.id)}</p><p class="price">${money(order.totalCents)}</p>${cartCleared ? "" : '<p class="error">O pedido foi registrado, mas o navegador não conseguiu limpar o carrinho. Não repita a compra; confira seu histórico.</p>'}<a href="/minha-conta.html" class="button">Ver meu histórico</a><a href="/catalogo.html" class="text-button">Continuar explorando</a></div>`;
    document.querySelector(".confirmation").focus();
  });
}
