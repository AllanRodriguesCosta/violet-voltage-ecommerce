import { icon } from "../icons.js";
import {
  api,
  money,
  productImage,
  escapeHtml as esc,
  addCart,
  bindForm,
  showError,
  pushRecent,
  isWished,
} from "../common.js";
import { stockState, wishLabel, handleWish, installmentText } from "../components.js";
import { delivery, shipping, FREE_SHIPPING_CENTS } from "../pricing.js";

export default async function detail() {
  const container = document.querySelector("#product-detail");
  const id = new URLSearchParams(location.search).get("id") || "";
  try {
    const p = await api(`/products/${encodeURIComponent(id)}`);
    pushRecent(p.id);
    const name = `${p.marca} ${p.modelo}`;
    const stock = stockState(p);
    const wished = isWished(p.id);
    document.title = `${name} | Violet Voltage`;
    document.querySelector("#crumb-category").innerHTML = `<a href="/catalogo.html?categoria=${encodeURIComponent(p.categoria)}">${esc(p.categoria)}</a>`;
    document.querySelector("#crumb-current").textContent = p.modelo;
    container.className = "detail-grid";
    container.removeAttribute("aria-busy");
    container.innerHTML = `<div class="detail-media"><img class="detail-image" src="${esc(productImage(p))}" alt="${esc(name)}" width="640" height="640"><button type="button" class="wish-button" data-wish="${esc(p.id)}" data-name="${esc(name)}" aria-pressed="${wished}" aria-label="${esc(wishLabel(name, wished))}">${icon("heart")}</button></div>
<section class="detail-info" data-name="${esc(name)}"><span class="eyebrow">${esc(p.categoria)} · ${esc(p.marca)}</span><h1>${esc(p.modelo)}</h1><p class="detail-price">${money(p.priceCents)}</p>${installmentText(p.priceCents) ? `<p class="detail-installments">${installmentText(p.priceCents)}</p>` : ""}<p class="stock-pill stock-${stock.key}">${icon(stock.key === "out" ? "clock" : "check", { size: 16 })}${stock.key === "out" ? "Produto esgotado" : stock.key === "low" ? `Últimas unidades: ${p.estoque} em estoque` : `${p.estoque} unidades em estoque`}</p><p class="lead">${esc(p.descricao)}</p>
<form id="add-product" class="buy-box"><div class="field quantity"><label for="quantidade">Quantidade</label><input id="quantidade" name="quantidade" type="number" value="1" min="1" max="${Math.min(99, p.estoque)}" inputmode="numeric" required${p.estoque ? "" : " disabled"}></div><button type="submit"${p.estoque ? "" : " disabled"}>${icon("bag", { size: 18 })}Adicionar ao carrinho</button></form>
<p class="cart-feedback" role="status"></p>
<ul class="perk-list delivery-list">${Object.entries(delivery).map(([id, d]) => `<li>${icon(id === "retirada" ? "store" : "truck", { size: 18 })}<span><strong>${d.label}</strong><small>${d.prazo}</small></span><span class="option-price">${id === "padrao" && p.priceCents >= FREE_SHIPPING_CENTS ? "Grátis" : shipping[id] ? money(shipping[id]) : "Grátis"}</span></li>`).join("")}<li>${icon("refresh", { size: 18 })}<span><strong>Troca em até 7 dias</strong><small>Após o recebimento</small></span></li></ul><p class="small muted">Frete grátis na entrega padrão para compras a partir de ${money(FREE_SHIPPING_CENTS)}.</p>
<section class="product-specs"><h2>Sobre este equipamento</h2><dl><div><dt>Marca</dt><dd>${esc(p.marca)}</dd></div><div><dt>Modelo</dt><dd>${esc(p.modelo)}</dd></div><div><dt>Categoria</dt><dd>${esc(p.categoria)}</dd></div></dl><a class="text-link" href="/catalogo.html?categoria=${encodeURIComponent(p.categoria)}">Explorar ${esc(p.categoria)} ${icon("arrowRight", { size: 16 })}</a></section></section>`;
    container.querySelector("[data-wish]").addEventListener("click", (event) => handleWish(event.currentTarget.dataset.wish));
    const feedback = container.querySelector(".cart-feedback");
    bindForm(container.querySelector("#add-product"), (data) => {
      if (addCart(p, Number(data.quantidade)))
        feedback.innerHTML = 'Equipamento adicionado. <a href="/carrinho.html">Ver meu carrinho</a>';
      else feedback.textContent = "Não foi possível adicionar. Confira a quantidade e a mensagem exibida.";
    });
  } catch (e) {
    container.className = "state-panel";
    container.removeAttribute("aria-busy");
    container.innerHTML = "";
    showError(container, e);
    const back = document.createElement("a");
    back.href = "/catalogo.html";
    back.className = "button secondary";
    back.textContent = "Voltar ao catálogo";
    container.append(back);
    if (e.status !== 404) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Tentar novamente";
      retry.onclick = detail;
      container.append(retry);
    }
  }
}
