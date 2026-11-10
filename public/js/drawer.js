import { icon } from "./icons.js";
import {
  getCart,
  setCart,
  catalogProducts,
  money,
  productImage,
  escapeHtml as esc,
  toast,
} from "./common.js";

let dialog;
function ensure() {
  if (dialog) return dialog;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog class="drawer" id="cart-drawer" aria-labelledby="cart-drawer-title"><div class="drawer-panel"><header class="drawer-header"><h2 id="cart-drawer-title">Seu carrinho</h2><button type="button" class="icon-button" data-drawer-close aria-label="Fechar carrinho">${icon("close")}</button></header><p class="drawer-status" role="status"></p><div class="drawer-body"></div><footer class="drawer-footer"></footer></div></dialog>`,
  );
  dialog = document.querySelector("#cart-drawer");
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-drawer-close]")) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.querySelector(".drawer-body").addEventListener("click", onItemAction);
  return dialog;
}
function close() {
  if (!dialog?.open) return;
  dialog.classList.add("is-closing");
  const done = () => {
    dialog.classList.remove("is-closing");
    dialog.close();
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
  else setTimeout(done, 180);
}
function onItemAction(event) {
  const step = event.target.closest("[data-step]");
  const remove = event.target.closest("[data-remove]");
  if (!step && !remove) return;
  const cart = getCart();
  const id = (step || remove).dataset.id;
  const item = cart.find((i) => i.id === id);
  if (!item) return render();
  try {
    if (remove) {
      const previous = getCart();
      setCart(cart.filter((i) => i.id !== id));
      toast("Item removido do carrinho.", {
        type: "info",
        action: { label: "Desfazer", onClick: () => { setCart(previous); render(); } },
      });
    } else {
      item.quantidade = Math.max(1, Math.min(Number(step.dataset.max), item.quantidade + Number(step.dataset.step)));
      setCart(cart);
    }
  } catch {
    toast("Não foi possível atualizar o carrinho neste navegador.", { type: "error" });
  }
  render();
}
async function render() {
  const body = dialog.querySelector(".drawer-body");
  const footer = dialog.querySelector(".drawer-footer");
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.quantidade, 0);
  dialog.querySelector("#cart-drawer-title").innerHTML = `Seu carrinho <span class="muted">(${count} ${count === 1 ? "item" : "itens"})</span>`;
  if (!cart.length) {
    body.innerHTML = `<div class="drawer-empty">${icon("bag", { size: 34 })}<h3>Seu carrinho está vazio.</h3><p>Que tal começar pelo instrumento principal?</p><a class="button" href="/catalogo.html">Explorar catálogo</a></div>`;
    footer.innerHTML = "";
    return;
  }
  if (!body.children.length) body.innerHTML = '<div class="loading">Carregando itens…</div>';
  let products;
  try {
    products = await catalogProducts();
  } catch (error) {
    body.innerHTML = `<div class="error" role="alert">${esc(error.message)}</div>`;
    footer.innerHTML = '<a class="button secondary full" href="/carrinho.html">Abrir carrinho</a>';
    return;
  }
  const rows = cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }));
  const subtotal = rows.reduce((s, r) => s + (r.product?.priceCents || 0) * r.quantidade, 0);
  const invalid = rows.some((r) => !r.product || r.quantidade > r.product.estoque);
  body.innerHTML = `<ul class="drawer-items">${rows
    .map((r) => {
      const p = r.product;
      const name = p ? `${p.marca} ${p.modelo}` : "Produto indisponível";
      const max = Math.min(99, p?.estoque || 0);
      return `<li class="drawer-item"><img src="${esc(productImage(p))}" alt="" width="72" height="72"><div class="drawer-item-info">${p ? `<a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(name)}</a><span class="small muted">${money(p.priceCents)} cada</span>` : `<strong>${esc(name)}</strong>`}${!p || r.quantidade > max ? '<span class="field-error">Indisponível nessa quantidade.</span>' : ""}<div class="stepper" role="group" aria-label="Quantidade de ${esc(name)}"><button type="button" data-step="-1" data-id="${esc(r.id)}" data-max="${max}" aria-label="Diminuir quantidade"${r.quantidade <= 1 ? " disabled" : ""}>${icon("minus", { size: 16 })}</button><output aria-live="polite">${r.quantidade}</output><button type="button" data-step="1" data-id="${esc(r.id)}" data-max="${max}" aria-label="Aumentar quantidade"${r.quantidade >= max ? " disabled" : ""}>${icon("plus", { size: 16 })}</button></div></div><div class="drawer-item-end"><strong>${money((p?.priceCents || 0) * r.quantidade)}</strong><button type="button" class="icon-button" data-remove data-id="${esc(r.id)}" aria-label="Remover ${esc(name)}">${icon("trash", { size: 18 })}</button></div></li>`;
    })
    .join("")}</ul>`;
  footer.innerHTML = `<div class="summary-line summary-total"><span>Subtotal</span><span>${money(subtotal)}</span></div><p class="small muted">Frete e prazo calculados no checkout.</p>${invalid ? '<p class="field-error">Ajuste os itens indisponíveis antes de finalizar.</p>' : ""}<a class="button full" href="/checkout.html"${invalid ? ' aria-disabled="true" data-blocked' : ""}>Finalizar compra ${icon("arrowRight", { size: 18 })}</a><a class="button secondary full" href="/carrinho.html">Ver carrinho completo</a>`;
  footer.querySelector("[data-blocked]")?.addEventListener("click", (event) => {
    event.preventDefault();
    location.href = "/carrinho.html";
  });
}
export async function openCart(message = "") {
  ensure();
  dialog.querySelector(".drawer-status").textContent = message;
  if (!dialog.open) dialog.showModal();
  await render();
  dialog.querySelector(".drawer-panel").focus?.();
}
export function initDrawer() {
  ensure();
  document.querySelectorAll("[data-open-cart]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (location.pathname === "/carrinho.html" || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      openCart();
    }),
  );
  document.addEventListener("vv:cart-added", (event) => {
    if (location.pathname === "/carrinho.html") {
      toast("Produto adicionado ao carrinho.", { type: "success" });
      return;
    }
    const p = event.detail.product;
    openCart(`${p.marca} ${p.modelo} foi adicionado ao carrinho.`);
  });
}
