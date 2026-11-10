import { icon } from "../icons.js";
import {
  catalogProducts,
  categories,
  getRecent,
  getCart,
  setCart,
  money,
  productImage,
  escapeHtml as esc,
  toast,
} from "../common.js";
import { productCard, skeletonCards, bindCards, categoryInfo, errorState, productUrl, carousel } from "../components.js";
import { openCart } from "../drawer.js";

// Combinações curadas; itens ausentes ou inativos são ignorados.
const setups = [
  { id: "primeiro", title: "Primeiro setup", text: "Guitarra, amplificador, cabo e correia para plugar e tocar.", items: ["demo-013", "demo-006", "demo-021", "demo-001"] },
  { id: "pedalboard", title: "Pedalboard essencial", text: "Base, efeitos e cabos para organizar a cadeia de pedais.", items: ["demo-009", "demo-008", "demo-012", "demo-019"] },
  { id: "palco", title: "Pronto para o palco", text: "Timbre de show do primeiro ao último acorde.", items: ["demo-014", "demo-004", "demo-011", "demo-020"] },
];

function highlights(products) {
  const available = products.filter((p) => p.estoque > 0);
  const flagship = categories
    .map((c) => available.filter((p) => p.categoria === c).sort((a, b) => b.priceCents - a.priceCents)[0])
    .filter(Boolean);
  const rest = available.filter((p) => !flagship.includes(p)).sort((a, b) => b.priceCents - a.priceCents);
  return [...flagship, ...rest].slice(0, 8);
}
function renderCategories(products) {
  document.querySelector("#category-grid").innerHTML = categories
    .map((c) => {
      const items = products.filter((p) => p.categoria === c);
      const cover = items.sort((a, b) => b.priceCents - a.priceCents)[0];
      return `<a class="category-tile" href="/catalogo.html?categoria=${encodeURIComponent(c)}"><span class="category-copy"><strong>${c}</strong><span>${categoryInfo[c]}</span><span class="category-count">${items.length} ${items.length === 1 ? "item" : "itens"} ${icon("arrowRight", { size: 16 })}</span></span><img src="${esc(productImage(cover || { categoria: c }))}" alt="" loading="lazy" width="160" height="160"></a>`;
    })
    .join("");
}
function renderSetups(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const cards = setups
    .map((setup) => {
      const items = setup.items.map((id) => byId.get(id)).filter((p) => p && p.estoque > 0);
      if (items.length < 2) return "";
      const total = items.reduce((s, p) => s + p.priceCents, 0);
      return `<article class="setup-card" data-reveal><div class="setup-thumbs">${items.map((p) => `<img src="${esc(productImage(p))}" alt="" loading="lazy" width="96" height="96">`).join("")}</div><h3>${setup.title}</h3><p>${setup.text}</p><ul class="setup-items">${items.map((p) => `<li><a href="${productUrl(p)}">${esc(p.marca)} ${esc(p.modelo)}</a><span>${money(p.priceCents)}</span></li>`).join("")}</ul><div class="setup-total"><span>${items.length} itens</span><strong>${money(total)}</strong></div><button type="button" class="button full" data-setup="${setup.id}">${icon("bag", { size: 18 })}Adicionar setup ao carrinho</button></article>`;
    })
    .join("");
  const grid = document.querySelector("#setup-grid");
  grid.innerHTML = cards;
  document.querySelector("#setups").hidden = !cards;
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-setup]");
    if (!button) return;
    const setup = setups.find((s) => s.id === button.dataset.setup);
    const cart = getCart();
    let added = 0;
    let skipped = 0;
    for (const id of setup.items) {
      const p = byId.get(id);
      if (!p || p.estoque < 1) continue;
      const current = cart.find((i) => i.id === id);
      if ((current?.quantidade || 0) + 1 > Math.min(99, p.estoque)) {
        skipped++;
        continue;
      }
      if (current) current.quantidade++;
      else cart.push({ id, quantidade: 1 });
      added++;
    }
    try {
      setCart(cart);
    } catch {
      toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
      return;
    }
    if (added) openCart(`${setup.title}: ${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho.`);
    if (skipped) toast(`${skipped} ${skipped === 1 ? "item já está" : "itens já estão"} no limite do estoque.`, { type: "info" });
  });
}
function renderRow(selector, list, products) {
  const section = document.querySelector(selector);
  const track = section.querySelector(".carousel");
  track.innerHTML = list.map((p, i) => productCard(p, i)).join("");
  section.hidden = !list.length;
  bindCards(track, () => products);
  carousel(section);
}
export default async function home() {
  const params = new URLSearchParams(location.search);
  if (location.hash === "#catalogo" || ["q", "categoria", "marca", "modelo", "min", "max", "sort"].some((k) => params.has(k))) {
    location.replace(`/catalogo.html${location.search}`);
    return;
  }
  document.querySelector("#highlights").innerHTML = skeletonCards(4);
  let products;
  try {
    products = await catalogProducts();
  } catch (error) {
    errorState(document.querySelector("#highlights"), error, () => home());
    return;
  }
  renderCategories(products);
  renderRow("#destaques", highlights(products), products);
  const recent = getRecent()
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 8);
  renderRow("#recentes", recent, products);
  renderSetups(products);
  const brands = new Set(products.map((p) => p.marca)).size;
  document.querySelector("#story-stats").innerHTML = [
    [products.length, "equipamentos no catálogo"],
    [categories.length, "categorias para explorar"],
    [brands, "marcas selecionadas"],
  ]
    .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
}
