import { shell, showError } from "./common.js";
import { icon } from "./icons.js";
import { initDrawer } from "./drawer.js";
import { initSearch } from "./search.js";
import { initTheme } from "./theme.js";
import { initMotion } from "./motion.js";
import { initAlerts } from "./alerts.js";
import { initCompare } from "./compare.js";

document.documentElement.classList.add("js");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
  document.documentElement.classList.add("motion");
// A sessão é verificada em paralelo; só as páginas privadas aguardam por ela.
const session = shell();
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.outerHTML = icon(el.dataset.icon, { size: Number(el.dataset.size) || 20 });
});
initTheme();
initMotion();
initDrawer();
initSearch();
initAlerts();
initCompare();
// Instalação e páginas já visitadas disponíveis sem conexão (somente em HTTPS ou localhost).
if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname)))
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
// Assistente de compras: só para quem está logado, carregado depois da página.
session
  .then((user) => {
    if (user && location.pathname !== "/admin.html") return import("./assistant.js").then((m) => m.mountAssistant(user));
  })
  .catch(() => {});
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
  "/setup.html": "setup",
  "/comparar.html": "compare",
  "/kits.html": "kits",
  "/pedido.html": "order",
  "/guias.html": "guides",
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
