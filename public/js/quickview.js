// Visualização rápida a partir dos cards: preço, parcelas, estoque, quantidade e favoritos
// sem sair da vitrine. A página do produto continua sendo o detalhe completo.
import { icon } from "./icons.js";
import { money, escapeHtml as esc, productImage, addCart, isWished, validateForm } from "./common.js";
import { stockState, installmentText, productUrl, handleWish, wishLabel } from "./components.js";

let dialog;
let opener;
function ensure() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "quick-view";
  dialog.setAttribute("aria-labelledby", "qv-title");
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-qv-close]")) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  return dialog;
}

export function openQuickView(product, from) {
  ensure();
  opener = from;
  const p = product;
  const name = `${p.marca} ${p.modelo}`;
  const stock = stockState(p);
  const max = Math.min(99, p.estoque);
  const wished = isWished(p.id);
  const stockText =
    stock.key === "out" ? "Produto esgotado" : stock.key === "low" ? `Últimas unidades: ${p.estoque} em estoque` : "Em estoque";
  dialog.innerHTML = `<button type="button" class="icon-button qv-close" data-qv-close aria-label="Fechar visualização rápida">${icon("close")}</button><div class="qv-grid"><div class="qv-media"><img src="${esc(productImage(p))}" alt="${esc(name)}" width="480" height="480"></div>
<div class="qv-info" data-name="${esc(name)}">
<span class="eyebrow">${esc(p.categoria)} · ${esc(p.marca)}</span><h2 id="qv-title">${esc(p.modelo)}</h2>
<p class="qv-price">${money(p.priceCents)}</p>${installmentText(p.priceCents) ? `<p class="product-installments">${installmentText(p.priceCents)}</p>` : ""}
<p class="stock-pill stock-${stock.key}">${icon(stock.key === "out" ? "clock" : "check", { size: 16 })}${stockText}</p>
<p class="qv-desc">${esc(p.descricao || "")}</p>
<form class="qv-buy"><div class="stepper stepper-lg" role="group" aria-label="Quantidade"><button type="button" data-qty="-1" aria-label="Diminuir quantidade" disabled>${icon("minus", { size: 16 })}</button><input name="quantidade" type="number" value="1" min="1" max="${max}" inputmode="numeric" aria-label="Quantidade"${p.estoque ? "" : " disabled"}><button type="button" data-qty="1" aria-label="Aumentar quantidade"${max > 1 ? "" : " disabled"}>${icon("plus", { size: 16 })}</button></div><button type="submit"${p.estoque ? "" : " disabled"}>${icon("bag", { size: 18 })}${p.estoque ? "Adicionar ao carrinho" : "Esgotado"}</button></form>
<div class="qv-links"><button type="button" class="text-button" data-wish="${esc(p.id)}" data-name="${esc(name)}" aria-pressed="${wished}" aria-label="${esc(wishLabel(name, wished))}">${icon("heart", { size: 18 })}<span>Favoritos</span></button><a class="text-link" href="${productUrl(p)}">Ver detalhes completos ${icon("arrowRight", { size: 16 })}</a></div></div></div>`;
  const form = dialog.querySelector(".qv-buy");
  const qty = form.elements.quantidade;
  const sync = () => {
    const value = Number(qty.value);
    form.querySelector('[data-qty="-1"]').disabled = !p.estoque || value <= 1;
    form.querySelector('[data-qty="1"]').disabled = !p.estoque || value >= max;
  };
  form.querySelectorAll("[data-qty]").forEach((button) =>
    button.addEventListener("click", () => {
      qty.value = Math.min(max, Math.max(1, (Number(qty.value) || 1) + Number(button.dataset.qty)));
      sync();
    }),
  );
  qty.addEventListener("input", sync);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateForm(form)) return;
    const image = dialog.querySelector(".qv-media img");
    if (addCart(p, Number(qty.value), { source: image })) dialog.close();
  });
  dialog.querySelector("[data-wish]").addEventListener("click", () => handleWish(p.id));
  dialog.showModal();
  (p.estoque ? form.querySelector("[type=submit]") : dialog.querySelector(".qv-close")).focus();
}
