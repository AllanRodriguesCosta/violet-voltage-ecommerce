import { icon } from "./icons.js";
import {
  catalogProducts,
  searchProducts,
  normalize,
  categories,
  money,
  productImage,
  escapeHtml as esc,
} from "./common.js";

function combobox(form) {
  const input = form.querySelector("input[role=combobox]");
  const list = form.querySelector("[role=listbox]");
  let options = [];
  let active = -1;
  let timer;
  const setActive = (index) => {
    active = index;
    options.forEach((o, i) => o.setAttribute("aria-selected", String(i === active)));
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", options[active].id);
      options[active].scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };
  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  };
  async function update() {
    const query = input.value.trim();
    if (normalize(query).length < 2) return close();
    let products;
    try {
      products = await catalogProducts();
    } catch {
      return close();
    }
    if (input.value.trim() !== query) return;
    const found = searchProducts(products, query).slice(0, 5);
    const cats = categories.filter((c) => normalize(c).includes(normalize(query))).slice(0, 3);
    const id = list.id;
    const productOptions = found
      .map(
        (p, i) =>
          `<a role="option" id="${id}-p${i}" href="/produto.html?id=${encodeURIComponent(p.id)}" tabindex="-1"><img src="${esc(productImage(p))}" alt="" width="44" height="44"><span><strong>${esc(p.modelo)}</strong><small>${esc(p.marca)} · ${esc(p.categoria)}</small></span><span class="suggestion-price">${money(p.priceCents)}</span></a>`,
      )
      .join("");
    const categoryOptions = cats
      .map(
        (c, i) =>
          `<a role="option" id="${id}-c${i}" href="/catalogo.html?categoria=${encodeURIComponent(c)}" tabindex="-1">${icon("grid", { size: 18 })}<span><strong>${esc(c)}</strong><small>Ver categoria</small></span></a>`,
      )
      .join("");
    list.innerHTML = `${categoryOptions}${productOptions || '<p class="suggestion-empty">Nenhum produto com esse termo.</p>'}<a role="option" id="${id}-all" class="suggestion-all" href="/catalogo.html?q=${encodeURIComponent(query)}" tabindex="-1">${icon("search", { size: 18 })}<span>Buscar “${esc(query)}” no catálogo</span>${icon("arrowRight", { size: 16 })}</a>`;
    options = [...list.querySelectorAll("[role=option]")];
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(-1);
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  });
  input.addEventListener("focus", () => input.value && update());
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (list.hidden) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + delta + options.length) % options.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      location.href = options[active].href;
    } else if (event.key === "Escape") {
      // Primeiro Escape fecha as sugestões; o seguinte fecha a busca móvel.
      event.preventDefault();
      if (!list.hidden) close();
      else form.closest("dialog")?.close();
    }
  });
  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget)) setTimeout(close, 100);
  });
  form.addEventListener("submit", (event) => {
    if (!input.value.trim()) {
      event.preventDefault();
      location.href = "/catalogo.html";
    }
  });
}
export function initSearch() {
  document.querySelectorAll("form.search-box").forEach(combobox);
  const dialog = document.querySelector("#search-dialog");
  document.querySelectorAll("[data-open-search]").forEach((button) =>
    button.addEventListener("click", () => {
      dialog.showModal();
      dialog.querySelector("input").focus();
    }),
  );
}
