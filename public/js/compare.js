// Comparador: até 4 produtos escolhidos neste navegador, com barra flutuante de acesso.
import { icon } from "./icons.js";
import { escapeHtml as esc, productImage, toast, emit, catalogProducts } from "./common.js";

export const MAX_COMPARE = 4;
const KEY = "vv_compare";
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);
export function getCompare() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data) ? data.filter(validId).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}
export function setCompare(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.filter(validId).slice(0, MAX_COMPARE)));
  } catch {
    toast("Não foi possível salvar a comparação neste navegador.", { type: "error" });
    return false;
  }
  emit("vv:compare", ids);
  return true;
}
export const isCompared = (id) => getCompare().includes(id);
export const compareLabel = (name, on) => (on ? `Remover ${name} da comparação` : `Comparar ${name}`);
export function compareButtonHTML(p, { className = "compare-toggle" } = {}) {
  const on = isCompared(p.id);
  const name = `${p.marca} ${p.modelo}`;
  return `<button type="button" class="${className}" data-compare="${esc(p.id)}" aria-pressed="${on}" aria-label="${esc(compareLabel(name, on))}" data-compare-name="${esc(name)}">${icon("compare", { size: 16 })}<span>Comparar</span></button>`;
}
export function toggleCompare(id) {
  const list = getCompare();
  if (list.includes(id)) {
    setCompare(list.filter((x) => x !== id));
    return false;
  }
  if (list.length >= MAX_COMPARE) {
    toast(`Compare até ${MAX_COMPARE} produtos por vez. Remova um para incluir outro.`, {
      type: "info",
      action: { label: "Ver comparação", onClick: () => (location.href = "/comparar.html") },
    });
    return false;
  }
  setCompare([...list, id]);
  return true;
}
function syncButtons() {
  const list = getCompare();
  document.querySelectorAll("[data-compare]").forEach((b) => {
    const on = list.includes(b.dataset.compare);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", compareLabel(b.dataset.compareName || "produto", on));
  });
}
// Barra flutuante com miniaturas; some quando a lista está vazia ou na própria página.
async function renderTray(tray) {
  const ids = getCompare();
  if (!ids.length) {
    tray.hidden = true;
    document.body.classList.remove("has-compare-tray");
    return;
  }
  let products = [];
  try {
    products = await catalogProducts();
  } catch {
    /* miniaturas são opcionais */
  }
  const chosen = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  tray.innerHTML = `<div class="container compare-tray-inner"><span class="compare-tray-title">${icon("compare", { size: 18 })}<strong>${ids.length} de ${MAX_COMPARE}</strong><span class="hide-sm"> para comparar</span></span><ul class="compare-thumbs">${chosen.map((p) => `<li><img src="${esc(productImage(p))}" alt="${esc(p.marca)} ${esc(p.modelo)}" width="40" height="40"></li>`).join("")}</ul><button type="button" class="text-button" data-compare-clear>Limpar</button><a class="button" href="/comparar.html"${ids.length < 2 ? ' aria-disabled="true" data-compare-few' : ""}>Comparar</a></div>`;
  tray.hidden = false;
  document.body.classList.add("has-compare-tray");
}
export function initCompare() {
  const own = location.pathname === "/comparar.html";
  let tray = null;
  if (!own && !["/checkout.html", "/admin.html"].includes(location.pathname)) {
    tray = document.createElement("aside");
    tray.className = "compare-tray";
    tray.setAttribute("aria-label", "Comparação de produtos");
    tray.hidden = true;
    document.body.append(tray);
    tray.addEventListener("click", (event) => {
      if (event.target.closest("[data-compare-clear]")) {
        setCompare([]);
        toast("Comparação limpa.", { type: "info" });
      } else if (event.target.closest("[data-compare-few]")) {
        event.preventDefault();
        toast("Escolha pelo menos 2 produtos para comparar.", { type: "info" });
      }
    });
    renderTray(tray);
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-compare]");
    if (!button) return;
    const name = button.dataset.compareName || "Produto";
    const on = toggleCompare(button.dataset.compare);
    if (on) toast(`${name} na comparação.`, { type: "success", action: getCompare().length > 1 ? { label: "Comparar agora", onClick: () => (location.href = "/comparar.html") } : undefined });
  });
  document.addEventListener("vv:compare", () => {
    syncButtons();
    if (tray) renderTray(tray);
  });
  addEventListener("storage", (event) => {
    if (event.key === KEY) emit("vv:compare");
  });
}
