import { icon } from "./icons.js";
import { FREE_SHIPPING_CENTS, maxInstallments, installmentValue } from "./pricing.js";
import { alertButtonHTML } from "./alerts.js";
import { compareButtonHTML } from "./compare.js";
import {
  money,
  escapeHtml as esc,
  productImage,
  isWished,
  toggleWishlist,
  addCart,
  toast,
} from "./common.js";

export const categoryInfo = {
  Guitarras: "Corpos marcantes e acabamentos feitos para o palco.",
  Pedais: "Efeitos, pedaleiras e pedalboards para moldar o timbre.",
  Amplificadores: "Valvulados e combos para ensaio, estúdio e show.",
  Cabos: "Conexões firmes do instrumento ao amplificador.",
  Correias: "Conforto e personalidade para tocar em pé.",
  Acessórios: "Suportes, palhetas e o que mais o setup pede.",
};
export function stockState(product) {
  if (!product.estoque) return { key: "out", label: "Esgotado" };
  if (product.estoque <= 5) return { key: "low", label: "Últimas unidades" };
  return { key: "in", label: "Em estoque" };
}
export function installmentText(totalCents) {
  const count = maxInstallments(totalCents);
  return count > 1 ? `ou ${count}x de ${money(installmentValue(totalCents, count))} sem juros` : "";
}
export function freeShippingHTML(subtotalCents) {
  const missing = Math.max(0, FREE_SHIPPING_CENTS - subtotalCents);
  const percent = Math.min(100, Math.round((subtotalCents / FREE_SHIPPING_CENTS) * 100));
  return `<div class="ship-progress${missing ? "" : " is-done"}"><p>${missing ? `${icon("truck", { size: 18 })}<span>Faltam <strong>${money(missing)}</strong> para frete grátis na entrega padrão.</span>` : `${icon("check", { size: 18 })}<span>Você ganhou <strong>frete grátis</strong> na entrega padrão.</span>`}</p><div class="ship-bar" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div></div>`;
}
export const productUrl = (p) => `/produto.html?id=${encodeURIComponent(p.id)}`;
export function wishLabel(name, wished) {
  return wished ? `Remover ${name} dos favoritos` : `Salvar ${name} nos favoritos`;
}
export function productCard(p, index = 0) {
  const stock = stockState(p);
  const name = `${p.marca} ${p.modelo}`;
  const wished = isWished(p.id);
  return `<article class="product-card${stock.key === "out" ? " is-out" : ""}" style="--i:${index % 12}">
<div class="product-media"><img src="${esc(productImage(p))}" alt="" loading="lazy" decoding="async" width="480" height="480"><div class="product-badges"><span class="badge badge-category">${esc(p.categoria)}</span>${stock.key === "in" ? "" : `<span class="badge badge-${stock.key}">${stock.label}</span>`}</div><button type="button" class="wish-button" data-wish="${esc(p.id)}" aria-pressed="${wished}" aria-label="${esc(wishLabel(name, wished))}">${icon("heart")}</button><button type="button" class="quick-button" data-quick="${esc(p.id)}" aria-label="Visualização rápida de ${esc(name)}">${icon("eye", { size: 18 })}<span>Ver rápido</span></button></div>
<div class="product-body"><span class="product-brand">${esc(p.marca)}</span><h3 class="product-title"><a href="${productUrl(p)}"><span class="sr-only">${esc(p.marca)} </span>${esc(p.modelo)}</a></h3><p class="product-price">${money(p.priceCents)}</p>${installmentText(p.priceCents) ? `<p class="product-installments">${installmentText(p.priceCents)}</p>` : ""}${compareButtonHTML(p)}${stock.key === "out" ? alertButtonHTML(p, { short: true, className: "button secondary add-button" }) : `<button type="button" class="button add-button" data-add="${esc(p.id)}" aria-label="Adicionar ${esc(name)} ao carrinho">${icon("bag", { size: 18 })}<span>Adicionar</span></button>`}</div>
</article>`;
}
export const skeletonCards = (count = 6) =>
  Array.from(
    { length: count },
    () =>
      '<div class="product-card skeleton" aria-hidden="true"><div class="product-media"></div><div class="product-body"><span class="sk-line w40"></span><span class="sk-line w80"></span><span class="sk-line w50"></span><span class="sk-block"></span></div></div>',
  ).join("");
// Estados padronizados (vazio, erro, sucesso e informação): mesmo visual, título no nível
// certo da página e semântica de alerta apenas para falhas.
export function stateHTML({ tone = "empty", symbol, title, text = "", actions = "", level = 2 }) {
  const symbols = { empty: "search", error: "alert", success: "check", info: "info" };
  const role = tone === "error" ? ' role="alert"' : "";
  return `<div class="empty state-${tone}"${role}>${icon(symbol || symbols[tone], { size: 30 })}<h${level}>${title}</h${level}>${text ? `<p>${text}</p>` : ""}${actions ? `<div class="row center">${actions}</div>` : ""}</div>`;
}
export const emptyState = ({ symbol = "search", title, text = "", actions = "", level = 2 }) =>
  stateHTML({ tone: "empty", symbol, title, text, actions, level });
export const loadingHTML = (text = "Carregando…") => `<div class="loading" role="status">${text}</div>`;
// Falha com explicação, nova tentativa (quando faz sentido) e um caminho de saída.
export function errorState(container, error, retry, { title = "Não foi possível carregar.", text, level = 2, back } = {}) {
  const actions = `${retry ? '<button type="button" data-retry>Tentar novamente</button>' : ""}${back ? `<a class="button secondary" href="${back.href}">${back.label}</a>` : ""}`;
  container.innerHTML = stateHTML({ tone: "error", title, text: text ?? esc(error.message), actions, level });
  if (retry) container.querySelector("[data-retry]").addEventListener("click", retry);
}
// Atualiza todos os botões de favorito do mesmo produto na página.
export function syncWishButtons(id, wished) {
  document.querySelectorAll(`[data-wish="${CSS.escape(id)}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(wished));
    const card = button.closest("[data-name]") || button.closest(".product-card");
    const name = button.dataset.name || card?.querySelector(".product-title")?.textContent.trim() || "produto";
    button.setAttribute("aria-label", wishLabel(name, wished));
    button.classList.remove("pop");
    void button.offsetWidth;
    button.classList.add("pop");
  });
}
export function handleWish(id, onChange) {
  const wished = toggleWishlist(id);
  syncWishButtons(id, wished);
  toast(wished ? "Salvo nos favoritos." : "Removido dos favoritos.", {
    type: "success",
    action: wished
      ? { label: "Ver favoritos", onClick: () => (location.href = "/favoritos.html") }
      : { label: "Desfazer", onClick: () => { toggleWishlist(id); syncWishButtons(id, true); onChange?.(); } },
  });
  onChange?.();
  return wished;
}
// Delegação de eventos para grades que são renderizadas novamente.
export function bindCards(container, getProducts, { onWishChange } = {}) {
  if (container.dataset.cardsBound) return;
  container.dataset.cardsBound = "true";
  container.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    const wish = event.target.closest("[data-wish]");
    const quick = event.target.closest("[data-quick]");
    if (add) {
      const product = getProducts().find((p) => p.id === add.dataset.add);
      const source = add.closest(".product-card")?.querySelector(".product-media img");
      if (product) addCart(product, 1, { source });
    } else if (wish) handleWish(wish.dataset.wish, onWishChange);
    else if (quick) {
      const product = getProducts().find((p) => p.id === quick.dataset.quick);
      if (product) import("./quickview.js").then(({ openQuickView }) => openQuickView(product, quick));
    }
  });
}
// Carrossel horizontal com botões anterior/próximo.
export function carousel(section) {
  const track = section.querySelector(".carousel");
  const prev = section.querySelector("[data-prev]");
  const next = section.querySelector("[data-next]");
  if (!track || !prev || !next) return;
  const sync = () => {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
  };
  prev.addEventListener("click", () => track.scrollBy({ left: -track.clientWidth * 0.9 }));
  next.addEventListener("click", () => track.scrollBy({ left: track.clientWidth * 0.9 }));
  track.addEventListener("scroll", sync, { passive: true });
  addEventListener("resize", sync);
  sync();
}
// Confirmação acessível com <dialog>; o foco inicial fica na opção segura.
export function confirmDialog({ title, text, confirm = "Confirmar", cancel = "Voltar", danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.innerHTML = `<form method="dialog"><h2>${title}</h2><p>${text}</p><div class="row"><button value="cancel" class="secondary">${cancel}</button><button value="ok"${danger ? ' class="danger-solid"' : ""}>${confirm}</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "ok");
      dialog.remove();
    });
    dialog.showModal();
    dialog.querySelector('button[value="cancel"]').focus();
  });
}
// Formata telefone brasileiro ao sair do campo, sem atrapalhar a digitação.
export function maskPhone(input) {
  if (!input) return;
  input.addEventListener("blur", () => {
    const d = input.value.replace(/\D/g, "");
    if (d.length === 10) input.value = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    else if (d.length === 11) input.value = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });
}
