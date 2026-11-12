import { catalogProducts } from "../common.js";
import { errorState } from "../components.js";
import { kitsHTML, bindKits } from "../kit-cards.js";

export default async function kitsPage() {
  const grid = document.querySelector("#kits-grid");
  let products;
  try {
    products = await catalogProducts();
  } catch (error) {
    errorState(grid, error, kitsPage, { back: { href: "/catalogo.html", label: "Ver catálogo" } });
    return;
  }
  grid.innerHTML = kitsHTML(products, { detailed: true, level: 2 });
  bindKits(grid, () => products);
  // Link direto para um kit (/kits.html#kit-blues-classico) rola até ele.
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}
