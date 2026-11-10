import { shell, showError } from "./common.js";
import { icon } from "./icons.js";
import { initDrawer } from "./drawer.js";
import { initSearch } from "./search.js";

document.documentElement.classList.add("js");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
  document.documentElement.classList.add("motion");
// A sessão é verificada em paralelo; só as páginas privadas aguardam por ela.
const session = shell();
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.outerHTML = icon(el.dataset.icon, { size: Number(el.dataset.size) || 20 });
});
initDrawer();
initSearch();
const routes = {
  "/": "home",
  "/index.html": "home",
  "/catalogo.html": "catalog",
  "/favoritos.html": "wishlist",
  "/produto.html": "product",
  "/carrinho.html": "cart",
  "/checkout.html": "checkout",
  "/minha-conta.html": "account",
  "/login.html": "auth",
  "/cadastro.html": "auth",
  "/ajuda.html": "help",
};
try {
  if (location.pathname === "/admin.html") {
    const { adminPage } = await import("./admin.js");
    await adminPage(await session);
  } else if (routes[location.pathname]) {
    const page = await import(`./pages/${routes[location.pathname]}.js`);
    await page.default(session);
  }
} catch (e) {
  showError(document.querySelector("#main"), e);
}
