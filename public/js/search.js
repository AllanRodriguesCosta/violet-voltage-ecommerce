import { icon } from "./icons.js";
import {
  catalogProducts,
  searchProducts,
  correctQuery,
  recentSearches,
  rememberSearch,
  clearSearches,
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
  const show = () => {
    options = [...list.querySelectorAll("[role=option]")];
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(-1);
  };
  // Campo vazio: buscas recentes deste navegador, com opção de limpar o histórico.
  function recent() {
    const items = recentSearches();
    if (!items.length) return close();
    const id = list.id;
    list.innerHTML = `<p class="suggestion-heading">Buscas recentes</p>${items
      .map((q, i) => `<a role="option" id="${id}-r${i}" href="/catalogo.html?q=${encodeURIComponent(q)}" tabindex="-1">${icon("clock", { size: 18 })}<span><strong>${esc(q)}</strong></span></a>`)
      .join("")}<a role="option" id="${id}-clear" class="suggestion-clear" href="#" data-clear-searches tabindex="-1">${icon("trash", { size: 16 })}<span>Limpar buscas recentes</span></a>`;
    show();
  }
  async function update() {
    const query = input.value.trim();
    if (!query) return recent();
    if (normalize(query).length < 2) return close();
    let products;
    try {
      products = await catalogProducts();
    } catch {
      return close();
    }
    if (input.value.trim() !== query) return;
    let found = searchProducts(products, query).slice(0, 5);
    const fixed = found.length ? null : correctQuery(products, query);
    if (fixed) found = searchProducts(products, fixed).slice(0, 5);
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
    const didYouMean = fixed
      ? `<a role="option" id="${id}-fix" class="suggestion-fix" href="/catalogo.html?q=${encodeURIComponent(fixed)}" tabindex="-1">${icon("sparkle", { size: 18 })}<span>Você quis dizer <strong>“${esc(fixed)}”</strong>?</span></a>`
      : "";
    list.innerHTML = `${didYouMean}${categoryOptions}${productOptions || '<p class="suggestion-empty">Nenhum produto com esse termo.</p>'}<a role="option" id="${id}-all" class="suggestion-all" href="/catalogo.html?q=${encodeURIComponent(query)}" tabindex="-1">${icon("search", { size: 18 })}<span>Buscar “${esc(query)}” no catálogo</span>${icon("arrowRight", { size: 16 })}</a>`;
    show();
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  });
  // Voltar ao campo logo depois de sair dele cancela o fechamento pendente.
  let closing;
  input.addEventListener("focus", () => {
    clearTimeout(closing);
    update();
  });
  // Escolher uma opção guarda o termo digitado; "Limpar" esvazia o histórico.
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[role=option]");
    if (!option) return;
    if (option.hasAttribute("data-clear-searches")) {
      event.preventDefault();
      clearSearches();
      close();
      input.focus();
    } else rememberSearch(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (list.hidden) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + delta + options.length) % options.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      options[active].click();
    } else if (event.key === "Escape") {
      // Primeiro Escape fecha as sugestões; o seguinte fecha a busca móvel.
      event.preventDefault();
      if (!list.hidden) close();
      else form.closest("dialog")?.close();
    }
  });
  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget)) closing = setTimeout(close, 100);
  });
  form.addEventListener("submit", (event) => {
    if (!input.value.trim()) {
      event.preventDefault();
      location.href = "/catalogo.html";
    } else rememberSearch(input.value);
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
