import { icon } from "../icons.js";
import { GENEROS } from "../specs.js";
import {
  catalogProducts,
  categories,
  getRecent,
  productImage,
  escapeHtml as esc,
  toast,
} from "../common.js";
import { kitsHTML, bindKits } from "../kit-cards.js";
import { productCard, skeletonCards, bindCards, categoryInfo, errorState, carousel } from "../components.js";

// Atalhos por estilo musical: gêneros da ficha com quantos itens indicados cada um tem.
function renderGenres(products) {
  const section = document.querySelector("#estilos");
  const items = GENEROS.map((g) => [g, products.filter((p) => p.ficha?.generos?.includes(g)).length]).filter(([, n]) => n);
  section.hidden = !items.length;
  document.querySelector("#genre-cloud").innerHTML = items
    .map(([g, n]) => `<li><a class="chip genre-chip" href="/catalogo.html?generos=${encodeURIComponent(g)}">${esc(g)}<span class="facet-count">${n}</span></a></li>`)
    .join("");
}
function highlights(products) {
  const available = products.filter((p) => p.estoque > 0);
  const flagship = categories
    .map((c) => available.filter((p) => p.categoria === c).sort((a, b) => b.priceCents - a.priceCents)[0])
    .filter(Boolean);
  const rest = available.filter((p) => !flagship.includes(p)).sort((a, b) => b.priceCents - a.priceCents);
  return [...flagship, ...rest].slice(0, 8);
}
// Sem catálogo (falha de rede), as categorias continuam navegáveis, só sem contagem.
function renderCategories(products) {
  document.querySelector("#category-grid").innerHTML = categories
    .map((c) => {
      const items = (products || []).filter((p) => p.categoria === c);
      const cover = items.sort((a, b) => b.priceCents - a.priceCents)[0];
      const count = products ? `${items.length} ${items.length === 1 ? "item" : "itens"}` : "Ver itens";
      return `<a class="category-tile" href="/catalogo.html?categoria=${encodeURIComponent(c)}"><span class="category-copy"><strong>${c}</strong><span>${categoryInfo[c]}</span><span class="category-count">${count} ${icon("arrowRight", { size: 16 })}</span></span><img src="${esc(productImage(cover || { categoria: c }))}" alt="" loading="lazy" width="160" height="160"></a>`;
    })
    .join("");
}
// Kits com desconto: os três primeiros no início; todos em /kits.html.
function renderSetups(products) {
  const grid = document.querySelector("#setup-grid");
  const cards = kitsHTML(products, { limit: 3 });
  grid.innerHTML = cards;
  document.querySelector("#setups").hidden = !cards;
  bindKits(grid, () => products);
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
  if (params.get("conta") === "excluida") {
    toast("Sua conta foi excluída e seus dados pessoais foram apagados.", { type: "success" });
    history.replaceState(null, "", "/");
  }
  document.querySelector("#highlights").innerHTML = skeletonCards(4);
  let products;
  try {
    products = await catalogProducts();
  } catch (error) {
    renderCategories(null);
    document.querySelector("#setups").hidden = true;
    errorState(document.querySelector("#highlights"), error, () => home(), { level: 3, title: "Não foi possível carregar os destaques." });
    return;
  }
  renderCategories(products);
  renderGenres(products);
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
