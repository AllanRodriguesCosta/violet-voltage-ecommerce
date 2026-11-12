// Cartões de kit (início e página de kits): preço cheio, desconto e adição do kit inteiro.
import { icon } from "./icons.js";
import { money, productImage, escapeHtml as esc, getCart, setCart, toast } from "./common.js";
import { productUrl, installmentText } from "./components.js";
import { KITS, kitPrice } from "./kits.js";
import { openCart } from "./drawer.js";

export function kitCardHTML(kit, products, { detailed = false, level = 3 } = {}) {
  const price = kitPrice(kit, products);
  if (!price) return "";
  const { items } = price;
  const parcel = installmentText(price.precoCents);
  return `<article class="setup-card kit-card" id="kit-${esc(kit.id)}" data-reveal><span class="kit-badge">${icon("gift", { size: 16 })}${kit.descontoPct}% off no kit</span><div class="setup-thumbs">${items.slice(0, 6).map((p) => `<img src="${esc(productImage(p))}" alt="" loading="lazy" width="96" height="96">`).join("")}</div><span class="eyebrow">${esc(kit.publico)}</span><h${level}>${esc(kit.nome)}</h${level}><p>${esc(kit.texto)}</p>${detailed ? `<ul class="setup-items">${items.map((p) => `<li><a href="${productUrl(p)}">${esc(p.marca)} ${esc(p.modelo)}</a><span>${p.estoque ? money(p.priceCents) : "Esgotado"}</span></li>`).join("")}</ul>` : ""}<div class="setup-total kit-total"><span>${items.length} itens · <s>${money(price.totalCents)}</s></span><strong>${money(price.precoCents)}</strong><small>Economia de ${money(price.descontoCents)}${parcel ? ` · ${parcel}` : ""}</small></div>${price.disponivel ? `<button type="button" class="button full" data-kit="${esc(kit.id)}">${icon("bag", { size: 18 })}Adicionar kit ao carrinho</button>` : '<p class="small muted">Um dos itens está esgotado no momento. O desconto volta quando ele for reposto.</p>'}<a class="setup-customize" href="/setup.html?itens=${items.map((p) => encodeURIComponent(p.id)).join(",")}">Personalizar no montador ${icon("arrowRight", { size: 16 })}</a></article>`;
}
export function kitsHTML(products, { detailed = false, limit = KITS.length, level = 3 } = {}) {
  return KITS.map((kit) => kitCardHTML(kit, products, { detailed, level }))
    .filter(Boolean)
    .slice(0, limit)
    .join("");
}
// Adiciona uma unidade de cada item; o desconto aparece no carrinho com o kit completo.
export function bindKits(grid, getProducts) {
  if (grid.dataset.kitsBound) return;
  grid.dataset.kitsBound = "true";
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-kit]");
    if (!button) return;
    const kit = KITS.find((k) => k.id === button.dataset.kit);
    const products = getProducts();
    const cart = getCart();
    const blocked = [];
    for (const id of kit.itens) {
      const p = products.find((x) => x.id === id);
      const line = cart.find((i) => i.id === id);
      if (!p || (line?.quantidade || 0) + 1 > Math.min(99, p.estoque)) blocked.push(p ? `${p.marca} ${p.modelo}` : id);
    }
    if (blocked.length) return toast(`Não há estoque para mais um kit completo: ${blocked.join(", ")}.`, { type: "error" });
    for (const id of kit.itens) {
      const line = cart.find((i) => i.id === id);
      if (line) line.quantidade++;
      else cart.push({ id, quantidade: 1 });
    }
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`${kit.nome}: ${kit.itens.length} itens adicionados. O desconto de ${kit.descontoPct}% aparece no resumo do carrinho.`);
  });
}
