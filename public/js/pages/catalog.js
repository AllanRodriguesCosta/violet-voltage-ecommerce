import { icon } from "../icons.js";
import { catalogProducts, searchProducts, correctQuery, rememberSearch, categories, escapeHtml as esc } from "../common.js";
import { productCard, skeletonCards, bindCards, categoryInfo, emptyState, errorState } from "../components.js";
import { specFields, specList, SPEC_FIELDS } from "../specs.js";

const presets = [
  ["Até R$ 100", "", "100"],
  ["R$ 100 a R$ 500", "100", "500"],
  ["R$ 500 a R$ 2.000", "500", "2000"],
  ["Acima de R$ 2.000", "2000", ""],
];
const sorters = {
  "price-asc": (a, b) => a.priceCents - b.priceCents,
  "price-desc": (a, b) => b.priceCents - a.priceCents,
  name: (a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, "pt-BR"),
};
// Filtros da ficha técnica: sem categoria, só os comuns (estilo e gêneros); com categoria, os dela.
const commonFilters = SPEC_FIELDS.Guitarras.filter((f) => f.key === "estilo" || f.key === "generos");
const filterFields = (categoria) => (categoria ? specFields(categoria) : commonFilters).filter((f) => f.filter);
const reais = (value) => (/^\d{1,7}$/.test(value || "") ? Number(value) : null);

export default async function catalog() {
  const $ = (s) => document.querySelector(s);
  const form = $("#filters");
  const panel = $("#filters-panel");
  const grid = $("#products");
  const search = $("#catalog-q");
  const sort = $("#catalog-sort");
  const initial = new URLSearchParams(location.search);
  const state = {
    q: (initial.get("q") || "").slice(0, 80),
    categoria: categories.includes(initial.get("categoria")) ? initial.get("categoria") : "",
    marcas: (initial.get("marca") || "").split(",").map((m) => m.trim()).filter(Boolean),
    min: initial.get("min") || "",
    max: initial.get("max") || "",
    estoque: initial.get("estoque") === "1",
    sort: sorters[initial.get("sort")] ? initial.get("sort") : "default",
    exato: initial.get("exato") === "1",
    specs: {},
  };
  for (const field of filterFields(state.categoria)) {
    const values = (initial.get(field.key) || "").split(",").filter((v) => field.values.includes(v));
    if (values.length) state.specs[field.key] = values;
  }
  // Termo efetivamente usado: o digitado ou a correção ("Você quis dizer") quando ele não acha nada.
  let activeQuery = state.q;
  let corrected = null;
  if (state.q) rememberSearch(state.q);
  let products = [];
  let showAllBrands = false;
  search.value = state.q;
  sort.value = state.sort;
  form.elements.min.value = state.min;
  form.elements.max.value = state.max;
  form.elements.estoque.checked = state.estoque;
  grid.innerHTML = skeletonCards(6);

  function filtered(skip) {
    const min = reais(state.min);
    const max = reais(state.max);
    const priceOk = min === null || max === null || min <= max;
    return searchProducts(products, activeQuery).filter(
      (p) =>
        (skip === "categoria" || !state.categoria || p.categoria === state.categoria) &&
        (skip === "marca" || !state.marcas.length || state.marcas.includes(p.marca)) &&
        (!priceOk || min === null || p.priceCents >= min * 100) &&
        (!priceOk || max === null || p.priceCents <= max * 100) &&
        (!state.estoque || p.estoque > 0) &&
        Object.entries(state.specs).every(([key, values]) => skip === key || !values.length || specList(p, key).some((v) => values.includes(v))),
    );
  }
  function specFacets() {
    $("#facet-specs").innerHTML = filterFields(state.categoria)
      .map((field) => {
        const base = filtered(field.key);
        const chosen = state.specs[field.key] || [];
        const options = field.values
          .map((v) => [v, base.filter((p) => specList(p, field.key).includes(v)).length])
          .filter(([v, n]) => n > 0 || chosen.includes(v));
        if (!options.length) return "";
        return `<fieldset><legend>${esc(field.label)}</legend><div class="facet-list">${options
          .map(([v, n]) => `<label class="facet"><input type="checkbox" name="spec" data-key="${esc(field.key)}" value="${esc(v)}"${chosen.includes(v) ? " checked" : ""}><span>${esc(v)}</span><span class="facet-count">${n}</span></label>`)
          .join("")}</div></fieldset>`;
      })
      .join("");
  }
  function facets() {
    const byCategory = filtered("categoria");
    $("#facet-category").innerHTML = ["", ...categories]
      .map((c) => {
        const count = c ? byCategory.filter((p) => p.categoria === c).length : byCategory.length;
        return `<label class="facet${state.categoria === c ? " is-active" : ""}"><input type="radio" name="categoria" value="${esc(c)}"${state.categoria === c ? " checked" : ""}><span>${c || "Todas"}</span><span class="facet-count">${count}</span></label>`;
      })
      .join("");
    const byBrand = filtered("marca");
    const brands = [...new Set([...products.map((p) => p.marca)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const counted = brands
      .map((b) => [b, byBrand.filter((p) => p.marca === b).length])
      .filter(([b, n]) => n > 0 || state.marcas.includes(b));
    const visible = showAllBrands ? counted : counted.slice(0, 6);
    $("#facet-brand").innerHTML =
      visible
        .map(([b, n]) => `<label class="facet"><input type="checkbox" name="marca" value="${esc(b)}"${state.marcas.includes(b) ? " checked" : ""}><span>${esc(b)}</span><span class="facet-count">${n}</span></label>`)
        .join("") +
      (counted.length > 6
        ? `<button type="button" class="text-button" id="toggle-brands" aria-expanded="${showAllBrands}">${showAllBrands ? "Mostrar menos" : `Mostrar todas (${counted.length})`}</button>`
        : "");
    $("#toggle-brands")?.addEventListener("click", () => {
      showAllBrands = !showAllBrands;
      facets();
      $("#toggle-brands").focus();
    });
    $("#price-presets").innerHTML = presets
      .map(([label, min, max]) => `<button type="button" class="chip${state.min === min && state.max === max ? " active" : ""}" data-min="${min}" data-max="${max}" aria-pressed="${state.min === min && state.max === max}">${label}</button>`)
      .join("");
    specFacets();
  }
  function applied() {
    const chips = [];
    if (state.q) chips.push(["q", `Busca: “${state.q}”`]);
    if (state.categoria) chips.push(["categoria", state.categoria]);
    for (const m of state.marcas) chips.push([`marca:${m}`, m]);
    if (state.min || state.max)
      chips.push(["preco", state.min && state.max ? `R$ ${state.min} a R$ ${state.max}` : state.min ? `A partir de R$ ${state.min}` : `Até R$ ${state.max}`]);
    if (state.estoque) chips.push(["estoque", "Em estoque"]);
    for (const [key, values] of Object.entries(state.specs)) for (const v of values) chips.push([`spec:${key}:${v}`, v]);
    $("#applied-filters").innerHTML = chips.length
      ? chips.map(([key, label]) => `<button type="button" class="chip chip-removable" data-remove="${esc(key)}" aria-label="Remover filtro ${esc(label)}">${esc(label)}${icon("close", { size: 14 })}</button>`).join("") + '<button type="button" class="text-button" data-remove="all">Limpar tudo</button>'
      : "";
    const count = chips.filter(([k]) => k !== "q").length;
    $("#filters-count").textContent = count;
    $("#filters-count").hidden = !count;
  }
  function syncUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.categoria) params.set("categoria", state.categoria);
    if (state.marcas.length) params.set("marca", state.marcas.join(","));
    if (state.min) params.set("min", state.min);
    if (state.max) params.set("max", state.max);
    if (state.estoque) params.set("estoque", "1");
    for (const [key, values] of Object.entries(state.specs)) if (values.length) params.set(key, values.join(","));
    if (state.sort !== "default") params.set("sort", state.sort);
    if (state.q && state.exato) params.set("exato", "1");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    const title = state.categoria || "Todos os equipamentos";
    $("#catalog-title").textContent = title;
    $("#crumb-current").textContent = state.categoria || "Catálogo";
    $("#catalog-lead").textContent = state.categoria ? categoryInfo[state.categoria] : "Guitarras, efeitos, amplificadores e acessórios em um só lugar.";
    document.title = `${state.categoria || "Catálogo"} | Violet Voltage`;
  }
  function render() {
    corrected = state.q && !state.exato && !searchProducts(products, state.q).length ? correctQuery(products, state.q) : null;
    activeQuery = corrected || state.q;
    const notice = $("#search-correction");
    notice.hidden = !corrected;
    notice.innerHTML = corrected
      ? `${icon("sparkle", { size: 16 })}<span>Mostrando resultados para <strong>“${esc(corrected)}”</strong>.</span><button type="button" class="text-button" data-exact>Buscar apenas por “${esc(state.q)}”</button>`
      : "";
    const min = reais(state.min);
    const max = reais(state.max);
    const invalid = min !== null && max !== null && min > max;
    $("#price-error").hidden = !invalid;
    $("#price-error").textContent = invalid ? "O máximo deve ser maior ou igual ao mínimo; a faixa não foi aplicada." : "";
    form.elements.max.setAttribute("aria-invalid", String(invalid));
    const list = filtered();
    if (state.sort !== "default") list.sort(sorters[state.sort]);
    $("#catalog-count").textContent = `${list.length} ${list.length === 1 ? "equipamento encontrado" : "equipamentos encontrados"}${activeQuery ? ` para “${activeQuery}”` : ""}`;
    $("#filters-apply").textContent = `Ver ${list.length} ${list.length === 1 ? "resultado" : "resultados"}`;
    grid.innerHTML = list.length
      ? list.map((p, i) => productCard(p, i)).join("")
      : emptyState({
          level: 3,
          title: state.q ? `Nada encontrado para “${esc(state.q)}”.` : "Nenhum equipamento com esses filtros.",
          text: "Confira a grafia, use menos palavras ou remova um filtro.",
          actions: `<button type="button" data-remove="all">Limpar filtros</button><a class="button secondary" href="/catalogo.html">Ver todo o catálogo</a>`,
        });
    facets();
    applied();
    syncUrl();
  }
  // Trocar de categoria mantém só os filtros de ficha que a nova categoria também tem.
  function setCategory(categoria) {
    state.categoria = categoria;
    const keep = new Set(filterFields(categoria).map((f) => f.key));
    for (const key of Object.keys(state.specs)) if (!keep.has(key)) delete state.specs[key];
  }
  function reset() {
    Object.assign(state, { q: "", categoria: "", marcas: [], min: "", max: "", estoque: false, specs: {} });
    search.value = "";
    form.reset();
    $("#catalog-q-clear").hidden = true;
    render();
  }
  function removeFilter(key) {
    if (key === "all") return reset();
    if (key === "q") search.value = state.q = "";
    else if (key === "categoria") setCategory("");
    else if (key === "preco") form.elements.min.value = form.elements.max.value = state.min = state.max = "";
    else if (key === "estoque") form.elements.estoque.checked = state.estoque = false;
    else if (key.startsWith("marca:")) state.marcas = state.marcas.filter((m) => m !== key.slice(6));
    else if (key.startsWith("spec:")) {
      const [, field, value] = key.split(":");
      state.specs[field] = (state.specs[field] || []).filter((v) => v !== value);
      if (!state.specs[field].length) delete state.specs[field];
    }
    $("#catalog-q-clear").hidden = !search.value;
    render();
    sort.focus();
  }

  // Busca fixa: filtra enquanto digita.
  let timer;
  search.addEventListener("input", () => {
    $("#catalog-q-clear").hidden = !search.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = search.value.trim().slice(0, 80);
      state.exato = false;
      render();
    }, 150);
  });
  $("#catalog-search").addEventListener("submit", (event) => {
    event.preventDefault();
    state.q = search.value.trim().slice(0, 80);
    state.exato = false;
    rememberSearch(state.q);
    render();
    search.blur();
  });
  $("#search-correction").addEventListener("click", (event) => {
    if (!event.target.closest("[data-exact]")) return;
    state.exato = true;
    render();
    search.focus();
  });
  $("#catalog-q-clear").hidden = !search.value;
  $("#catalog-q-clear").addEventListener("click", () => removeFilter("q") || search.focus());
  sort.addEventListener("change", () => {
    state.sort = sort.value;
    render();
  });
  form.addEventListener("change", (event) => {
    const t = event.target;
    if (t.name === "categoria") setCategory(t.value);
    else if (t.name === "spec") {
      const values = [...form.querySelectorAll(`input[name=spec][data-key="${t.dataset.key}"]:checked`)].map((i) => i.value);
      if (values.length) state.specs[t.dataset.key] = values;
      else delete state.specs[t.dataset.key];
    }
    else if (t.name === "marca") state.marcas = [...form.querySelectorAll("input[name=marca]:checked")].map((i) => i.value);
    else if (t.name === "estoque") state.estoque = t.checked;
    else if (t.name === "min" || t.name === "max") state[t.name] = t.value.trim();
    render();
  });
  form.addEventListener("input", (event) => {
    if (event.target.name !== "min" && event.target.name !== "max") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      state[event.target.name] = event.target.value.trim();
      render();
    }, 400);
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  $("#price-presets").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-min]");
    if (!chip) return;
    const same = state.min === chip.dataset.min && state.max === chip.dataset.max;
    state.min = form.elements.min.value = same ? "" : chip.dataset.min;
    state.max = form.elements.max.value = same ? "" : chip.dataset.max;
    render();
  });
  document.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    if (remove && (remove.closest("#applied-filters") || remove.closest("#products"))) removeFilter(remove.dataset.remove);
  });
  $("#clear-filters").addEventListener("click", reset);

  // Filtros no celular: painel lateral com foco controlado.
  const trigger = $("#filters-open");
  const backdrop = document.createElement("div");
  backdrop.className = "filters-backdrop";
  backdrop.hidden = true;
  document.body.append(backdrop);
  const openPanel = (open) => {
    panel.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    document.body.classList.toggle("no-scroll", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) $("#filters-close").focus();
    else trigger.focus();
  };
  trigger.addEventListener("click", () => openPanel(true));
  $("#filters-close").addEventListener("click", () => openPanel(false));
  $("#filters-apply").addEventListener("click", () => openPanel(false));
  backdrop.addEventListener("click", () => openPanel(false));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("is-open")) openPanel(false);
  });

  bindCards(grid, () => products);
  async function load() {
    try {
      products = await catalogProducts();
      render();
    } catch (error) {
      $("#catalog-count").textContent = "Não foi possível carregar os equipamentos.";
      errorState(grid, error, () => {
        grid.innerHTML = skeletonCards(6);
        load();
      });
    }
  }
  await load();
}
