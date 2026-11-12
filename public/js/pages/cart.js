import { icon } from "../icons.js";
import {
  send,
  catalogProducts,
  money,
  productImage,
  escapeHtml as esc,
  getCart,
  setCart,
  getWishlist,
  setWishlist,
  addCart,
  toast,
} from "../common.js";
import { emptyState, freeShippingHTML, installmentText, productCard, bindCards, errorState } from "../components.js";
import { maxInstallments, installmentValue } from "../pricing.js";
import { cartAdvice } from "../compat.js";
import { kitProgress, kitPrice } from "../kits.js";
import { servicesFor, servicePrice, SERVICES } from "../services.js";

export async function cartData() {
  const cart = getCart();
  const products = await catalogProducts({ fresh: true });
  return cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }));
}
export const subtotal = (items) =>
  items.reduce((sum, i) => sum + (i.product?.priceCents || 0) * i.quantidade, 0);
export const servicesTotal = (items) =>
  items.reduce((sum, i) => sum + (i.servicos || []).reduce((t, id) => t + servicePrice(id, i.product), 0) * i.quantidade, 0);
// Serviços do item no carrinho: caixas de seleção com preço por unidade.
function servicesHTML(item) {
  const options = servicesFor(item.product);
  if (!options.length) return "";
  const chosen = new Set(item.servicos || []);
  return `<details class="item-services"${chosen.size ? " open" : ""}><summary>${icon("wrench", { size: 16 })}Serviços da loja${chosen.size ? ` <span class="chip-count">${chosen.size}</span>` : ""}</summary><ul>${options
    .map((s) => `<li><label class="check"><input type="checkbox" data-service="${s.id}" data-id="${esc(item.id)}"${chosen.has(s.id) ? " checked" : ""}><span><strong>${esc(s.nome)}</strong> <span class="service-price">+ ${money(s.priceCents)}${item.quantidade > 1 ? " cada" : ""}</span><small>${esc(s.texto)}</small></span></label></li>`)
    .join("")}</ul></details>`;
}
// Preferências do checkout guardadas neste navegador.
export const prefs = {
  get coupon() {
    try { return localStorage.getItem("vv_coupon") || ""; } catch { return ""; }
  },
  set coupon(value) {
    try { value ? localStorage.setItem("vv_coupon", value) : localStorage.removeItem("vv_coupon"); } catch { /* opcional */ }
  },
  get delivery() {
    try { return localStorage.getItem("vv_delivery") || "padrao"; } catch { return "padrao"; }
  },
  set delivery(value) {
    try { localStorage.setItem("vv_delivery", value); } catch { /* opcional */ }
  },
};
export const fetchQuote = (entrega, cupom) =>
  send("/checkout/quote", { items: getCart(), entrega, ...(cupom ? { cupom } : {}) });
export function totalsHTML(quote) {
  const count = maxInstallments(quote.totalCents);
  return `<div class="summary-line"><span>Subtotal</span><span>${money(quote.subtotalCents)}</span></div>${quote.servicosCents ? `<div class="summary-line"><span>Serviços</span><span>${money(quote.servicosCents)}</span></div>` : ""}${(quote.kits || []).map((k) => `<div class="summary-line discount"><span>Desconto ${esc(k.nome)}${k.quantidade > 1 ? ` (${k.quantidade}x)` : ""}</span><span>− ${money(k.descontoCents)}</span></div>`).join("")}<div class="summary-line"><span>Frete</span><span>${quote.freteCents ? money(quote.freteCents) : '<strong class="free">Grátis</strong>'}</span></div>${quote.descontoCents ? `<div class="summary-line discount"><span>Desconto${quote.cupom ? ` (${esc(quote.cupom.codigo)})` : ""}</span><span>− ${money(quote.descontoCents)}</span></div>` : ""}<div class="summary-line summary-total"><span>Total</span><span>${money(quote.totalCents)}</span></div>${count > 1 ? `<p class="installments-note">ou até ${count}x de ${money(installmentValue(quote.totalCents, count))} sem juros no cartão</p>` : ""}`;
}

// O que falta para o equipamento funcionar e kits a um ou dois itens de completar.
export function adviceHTML(items, products) {
  const lines = items.filter((i) => i.product);
  const advice = cartAdvice(lines, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const progress = kitProgress(lines.map((i) => i.id))
    .map(({ kit, faltam }) => ({ kit, faltam: faltam.map((id) => byId.get(id)), price: kitPrice(kit, products) }))
    .filter(({ faltam, price }) => price && faltam.every((p) => p?.estoque > 0));
  if (!advice.length && !progress.length) return "";
  const suggestion = (p) =>
    p ? `<div class="advice-pick"><img src="${esc(productImage(p))}" alt="" width="48" height="48" loading="lazy"><a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(p.marca)} ${esc(p.modelo)}</a><strong>${money(p.priceCents)}</strong><button type="button" class="secondary small-button" data-advice-add="${esc(p.id)}" aria-label="Adicionar ${esc(p.marca)} ${esc(p.modelo)} ao carrinho">${icon("plus", { size: 16 })}Adicionar</button></div>` : "";
  const tone = { essencial: "alert", aviso: "info", dica: "sparkle" };
  return `<section class="panel advice-panel" aria-labelledby="advice-title"><h2 id="advice-title">${icon("plug", { size: 20 })}Antes de fechar o pedido</h2><ul class="advice-list">${progress
    .map(({ kit, faltam, price }) => `<li class="advice advice-kit"><span class="advice-icon">${icon("gift", { size: 18 })}</span><div><strong>Falta${faltam.length > 1 ? "m" : ""} ${faltam.length} ${faltam.length === 1 ? "item" : "itens"} para completar o ${esc(kit.nome)}</strong><p>Com o kit completo você ganha ${kit.descontoPct}% de desconto (${money(price.descontoCents)}) automaticamente.</p>${faltam.map(suggestion).join("")}</div></li>`)
    .join("")}${advice
    .map((a) => `<li class="advice advice-${a.nivel}"><span class="advice-icon">${icon(tone[a.nivel], { size: 18 })}</span><div><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p>${suggestion(byId.get(a.sugestao))}</div></li>`)
    .join("")}</ul></section>`;
}

export default async function cartPage() {
  const container = document.querySelector("#cart-content");
  let delivery = prefs.delivery;
  let coupon = prefs.coupon;
  let couponError = "";
  let products = [];
  function save(items, message, extra) {
    const previous = getCart();
    const previousWishes = getWishlist();
    try {
      setCart(items);
      extra?.();
    } catch {
      toast("Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador.", { type: "error" });
      return;
    }
    if (message)
      toast(message, {
        type: "info",
        action: { label: "Desfazer", onClick: () => { setCart(previous); setWishlist(previousWishes); render(); } },
      });
    render();
  }
  async function summary(items) {
    const aside = container.querySelector(".summary-panel");
    const invalid = items.some((i) => !i.product || i.quantidade > i.product.estoque);
    const base = { subtotalCents: subtotal(items), servicosCents: servicesTotal(items), freteCents: 0, descontoCents: 0, totalCents: subtotal(items) + servicesTotal(items) };
    let quote = null;
    if (!invalid) {
      try {
        quote = await fetchQuote(delivery, coupon);
      } catch (error) {
        if (error.field === "cupom" && coupon) {
          couponError = error.message;
          coupon = prefs.coupon = "";
          try { quote = await fetchQuote(delivery); } catch { quote = null; }
        } else if (error.field === "entrega") {
          delivery = prefs.delivery = "padrao";
        }
      }
    }
    const options = quote?.entregas || [];
    aside.innerHTML = `<h2>Resumo do pedido</h2>${options.length ? `<fieldset class="ship-estimate"><legend>Entrega</legend>${options.map((o) => `<label class="option-line"><input type="radio" name="estimate" value="${o.id}"${o.id === delivery ? " checked" : ""}><span><strong>${esc(o.label)}</strong><small>${esc(o.prazo)}</small></span><span class="option-price">${o.priceCents ? money(o.priceCents) : "Grátis"}</span></label>`).join("")}</fieldset>` : ""}
<form class="coupon-form" novalidate><label for="cart-coupon">Cupom de desconto</label>${quote?.cupom ? `<div class="coupon-applied">${icon("tag", { size: 18 })}<span><strong>${esc(quote.cupom.codigo)}</strong><small>${esc(quote.cupom.descricao)}</small></span><button type="button" class="text-button" data-remove-coupon>Remover</button></div>` : `<div class="coupon-row"><input id="cart-coupon" name="cupom" maxlength="30" autocomplete="off" placeholder="Ex.: VOLTAGE10" value=""${couponError ? ' aria-invalid="true" aria-describedby="coupon-error"' : ""}><button type="submit" class="secondary">Aplicar</button></div>${couponError ? `<p class="field-error" id="coupon-error" role="alert">${esc(couponError)}</p>` : ""}`}</form>
<div class="totals">${totalsHTML(quote || base)}</div>${invalid ? '<p class="field-error">Ajuste os itens indisponíveis para continuar.</p>' : ""}
<a class="button full" href="/checkout.html"${invalid ? ' aria-disabled="true"' : ""}>Finalizar compra ${icon("arrowRight", { size: 18 })}</a><a class="button secondary full" href="/catalogo.html">Continuar comprando</a><p class="secure-note">${icon("shield", { size: 16 })}Preços, estoque e descontos são conferidos novamente ao confirmar.</p>`;
    aside.querySelector('[aria-disabled="true"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Ajuste os itens indisponíveis primeiro.", { type: "error" });
    });
    aside.querySelectorAll("input[name=estimate]").forEach((radio) =>
      radio.addEventListener("change", () => {
        delivery = prefs.delivery = radio.value;
        couponError = "";
        summary(items);
      }),
    );
    aside.querySelector(".coupon-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = event.target.elements.cupom?.value.trim();
      if (!value) return;
      coupon = value.toUpperCase();
      couponError = "";
      try {
        const applied = await fetchQuote(delivery, coupon);
        prefs.coupon = coupon;
        toast(`Cupom ${applied.cupom.codigo} aplicado.`, { type: "success" });
      } catch (error) {
        couponError = error.message;
        coupon = "";
      }
      summary(items);
    });
    aside.querySelector("[data-remove-coupon]")?.addEventListener("click", () => {
      coupon = prefs.coupon = "";
      summary(items);
    });
  }
  async function render() {
    let items;
    try {
      items = await cartData();
      products = await catalogProducts();
    } catch (error) {
      container.className = "";
      errorState(container, error, render, { back: { href: "/catalogo.html", label: "Voltar ao catálogo" } });
      return;
    }
    container.className = "";
    if (!items.length) {
      container.innerHTML = emptyState({
        symbol: "bag",
        title: "Seu carrinho está esperando o primeiro acorde.",
        text: "Explore o catálogo e monte o seu próximo setup.",
        actions: '<a class="button" href="/catalogo.html">Explorar catálogo</a><a class="button secondary" href="/favoritos.html">Ver favoritos</a>',
      });
      return;
    }
    const count = items.reduce((s, i) => s + i.quantidade, 0);
    const categoriesInCart = new Set(items.map((i) => i.product?.categoria));
    // Itens já sugeridos no painel "Antes de fechar o pedido" não se repetem aqui.
    const advised = new Set(cartAdvice(items.filter((i) => i.product), products).map((a) => a.sugestao));
    const suggestions = products
      .filter((p) => p.estoque > 0 && !categoriesInCart.has(p.categoria) && !items.some((i) => i.id === p.id) && !advised.has(p.id))
      .sort((a, b) => a.priceCents - b.priceCents)
      .slice(0, 4);
    container.innerHTML = `<div class="cart-layout"><div class="cart-main"><div class="panel ship-panel">${freeShippingHTML(subtotal(items))}</div><section class="panel cart-list" aria-label="Itens do carrinho"><h2 class="cart-count" tabindex="-1">${count} ${count === 1 ? "item" : "itens"}</h2>${items
      .map((i) => {
        const p = i.product;
        const name = p ? `${p.marca} ${p.modelo}` : "Produto removido ou indisponível";
        const max = Math.min(99, p?.estoque || 0);
        const problem = !p ? "Este produto não está mais disponível." : i.quantidade > p.estoque ? `Restam ${p.estoque} em estoque; ajuste a quantidade.` : "";
        return `<article class="cart-item"><img src="${esc(productImage(p))}" alt="" width="96" height="96"><div class="cart-item-info"><h3>${p ? `<a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(name)}</a>` : esc(name)}</h3><span class="small muted">${money(p?.priceCents || 0)} cada${p && installmentText(p.priceCents) ? ` · ${installmentText(p.priceCents)}` : ""}</span>${problem ? `<p class="field-error">${problem}</p>` : ""}<div class="cart-actions"><div class="stepper" role="group" aria-label="Quantidade de ${esc(name)}"><button type="button" data-step="-1" data-id="${esc(i.id)}" aria-label="Diminuir quantidade"${i.quantidade <= 1 ? " disabled" : ""}>${icon("minus", { size: 16 })}</button><output aria-live="polite">${i.quantidade}</output><button type="button" data-step="1" data-id="${esc(i.id)}" data-max="${max}" aria-label="Aumentar quantidade"${i.quantidade >= max ? " disabled" : ""}>${icon("plus", { size: 16 })}</button></div>${p ? `<button type="button" class="text-button" data-later="${esc(i.id)}">${icon("heart", { size: 16 })}Salvar para depois</button>` : ""}<button type="button" class="text-button" data-remove-item="${esc(i.id)}">${icon("trash", { size: 16 })}Remover</button></div>${p ? servicesHTML(i) : ""}</div><strong class="price">${money((p?.priceCents || 0) * i.quantidade)}</strong></article>`;
      })
      .join("")}</section>${adviceHTML(items, products)}</div><aside class="panel summary-panel" aria-live="polite"><div class="loading" role="status">Calculando…</div></aside></div>${suggestions.length ? `<section class="cart-suggestions" aria-labelledby="suggestions-title"><h2 id="suggestions-title">Complete seu setup</h2><div class="product-grid product-grid-wide">${suggestions.map((p, i) => productCard(p, i)).join("")}</div></section>` : ""}`;
    const grid = container.querySelector(".cart-suggestions .product-grid");
    if (grid) bindCards(grid, () => products);
    container.querySelectorAll("[data-step]").forEach((b) =>
      b.addEventListener("click", () => {
        const cart = getCart();
        const item = cart.find((i) => i.id === b.dataset.id);
        if (!item) return render();
        item.quantidade = Math.max(1, item.quantidade + Number(b.dataset.step));
        save(cart);
      }),
    );
    container.querySelectorAll("[data-service]").forEach((box) =>
      box.addEventListener("change", () => {
        const cart = getCart();
        const line = cart.find((x) => x.id === box.dataset.id);
        if (!line) return render();
        const set = new Set(line.servicos || []);
        if (box.checked) set.add(box.dataset.service);
        else set.delete(box.dataset.service);
        line.servicos = [...set];
        try {
          setCart(cart);
        } catch {
          toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
          return;
        }
        toast(`${SERVICES[box.dataset.service].nome} ${box.checked ? "incluída" : "removida"}.`, { type: "success" });
        summary(items.map((x) => ({ ...x, servicos: cart.find((c) => c.id === x.id)?.servicos })));
      }),
    );
    container.querySelectorAll("[data-advice-add]").forEach((b) =>
      b.addEventListener("click", () => {
        const product = products.find((p) => p.id === b.dataset.adviceAdd);
        if (!product || !addCart(product, 1, { notify: false })) return;
        toast(`${product.marca} ${product.modelo} adicionado ao carrinho.`, { type: "success" });
        render().then(() => container.querySelector(".cart-count")?.focus());
      }),
    );
    container.querySelectorAll("[data-remove-item]").forEach((b) =>
      b.addEventListener("click", () => save(getCart().filter((i) => i.id !== b.dataset.removeItem), "Item removido do carrinho.")),
    );
    container.querySelectorAll("[data-later]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.later;
        save(getCart().filter((i) => i.id !== id), "Item movido para os favoritos.", () => {
          const wishes = getWishlist();
          if (!wishes.includes(id)) setWishlist([id, ...wishes]);
        });
      }),
    );
    await summary(items);
  }
  document.addEventListener("vv:cart", () => {
    if (!container.contains(document.activeElement)) render();
  });
  document.addEventListener("vv:cart-added", () => render());
  await render();
}
