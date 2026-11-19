// Catálogo: busca fixa, filtros (categoria, marca, ficha técnica, preço e estoque), ordenação,
// "Você quis dizer", resultados em páginas de 24 e filtros em painel lateral no celular.
// O estado vive no endereço (?q=, categoria, marca, min, max, estoque, sort, exato e ficha).
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "../lib/icons";
import { catalogProducts, categories, send, type Product } from "../lib/shop";
import { categoryInfo, correctQuery, guitarFields, rememberSearch, searchProducts, specFields, specList, type SpecField } from "../lib/catalog";
import { ProductCard, SkeletonCards } from "../components/ProductCard";
import { ErrorState, State } from "../components/State";

const presets = [
  ["Até R$ 100", "", "100"],
  ["R$ 100 a R$ 500", "100", "500"],
  ["R$ 500 a R$ 2.000", "500", "2000"],
  ["Acima de R$ 2.000", "2000", ""],
] as const;
const sorters: Record<string, (a: Product, b: Product) => number> = {
  "price-asc": (a, b) => a.priceCents - b.priceCents,
  "price-desc": (a, b) => b.priceCents - a.priceCents,
  name: (a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, "pt-BR"),
};
// Filtros da ficha técnica: sem categoria, só os comuns (estilo e gêneros); com categoria, os dela.
const commonFilters = guitarFields.filter((f) => f.key === "estilo" || f.key === "generos");
const filterFields = (categoria: string): SpecField[] => (categoria ? specFields(categoria) : commonFilters).filter((f) => f.filter);
// Resultados em páginas de 24: "Mostrar mais" acrescenta a próxima sem recarregar.
const PAGE = 24;
const reais = (value: string) => (/^\d{1,7}$/.test(value || "") ? Number(value) : null);
const LEAD = "Guitarras, efeitos, amplificadores e acessórios em um só lugar.";

type Filters = {
  q: string;
  categoria: string;
  marcas: string[];
  min: string;
  max: string;
  estoque: boolean;
  sort: string;
  exato: boolean;
  specs: Record<string, string[]>;
};
const EMPTY: Filters = { q: "", categoria: "", marcas: [], min: "", max: "", estoque: false, sort: "default", exato: false, specs: {} };

function fromUrl(search: string): Filters {
  const initial = new URLSearchParams(search);
  const categoria = initial.get("categoria") || "";
  const sort = initial.get("sort") || "";
  const state: Filters = {
    q: (initial.get("q") || "").slice(0, 80),
    categoria: (categories as string[]).includes(categoria) ? categoria : "",
    marcas: (initial.get("marca") || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    min: initial.get("min") || "",
    max: initial.get("max") || "",
    estoque: initial.get("estoque") === "1",
    sort: sorters[sort] ? sort : "default",
    exato: initial.get("exato") === "1",
    specs: {},
  };
  for (const field of filterFields(state.categoria)) {
    const values = (initial.get(field.key) || "").split(",").filter((v) => field.values?.includes(v));
    if (values.length) state.specs[field.key] = values;
  }
  return state;
}
function toUrl(state: Filters) {
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
  return params;
}

// Etapa 35: termo buscado e quantos produtos apareceram, sem identificar quem buscou (o painel
// mostra o que mais procuram e o que falta no catálogo). Espera a digitação parar.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let lastLogged = "";
function logSearch(q: string, count: number, corrected: string | null) {
  clearTimeout(searchTimer);
  const term = String(q || "").trim();
  if (term.length < 2 || term === lastLogged) return;
  searchTimer = setTimeout(() => {
    lastLogged = term;
    (send("/buscas", { termo: term, resultados: count, ...(corrected ? { corrigido: corrected } : {}) }) as Promise<unknown>).catch(() => {});
  }, 1200);
}

// Produtos que passam nos filtros (skip ignora um deles, para as contagens de cada grupo).
function matches(products: Product[], query: string, state: Filters, skip?: string) {
  const min = reais(state.min);
  const max = reais(state.max);
  const priceOk = min === null || max === null || min <= max;
  return searchProducts(products, query).filter(
    (p) =>
      (skip === "categoria" || !state.categoria || p.categoria === state.categoria) &&
      (skip === "marca" || !state.marcas.length || state.marcas.includes(p.marca)) &&
      (!priceOk || min === null || p.priceCents >= min * 100) &&
      (!priceOk || max === null || p.priceCents <= max * 100) &&
      (!state.estoque || p.estoque > 0) &&
      Object.entries(state.specs).every(([key, values]) => skip === key || !values.length || specList(p, key).some((v) => values.includes(v))),
  );
}
function appliedChips(state: Filters) {
  const chips: [string, string][] = [];
  if (state.q) chips.push(["q", `Busca: “${state.q}”`]);
  if (state.categoria) chips.push(["categoria", state.categoria]);
  for (const m of state.marcas) chips.push([`marca:${m}`, m]);
  if (state.min || state.max)
    chips.push(["preco", state.min && state.max ? `R$ ${state.min} a R$ ${state.max}` : state.min ? `A partir de R$ ${state.min}` : `Até R$ ${state.max}`]);
  if (state.estoque) chips.push(["estoque", "Em estoque"]);
  for (const [key, values] of Object.entries(state.specs)) for (const v of values) chips.push([`spec:${key}:${v}`, v]);
  return chips;
}
// Trocar de categoria mantém só os filtros de ficha que a nova categoria também tem.
function withCategory(state: Filters, categoria: string): Filters {
  const keep = new Set(filterFields(categoria).map((f) => f.key));
  return { ...state, categoria, specs: Object.fromEntries(Object.entries(state.specs).filter(([key]) => keep.has(key))) };
}

type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };

export default function Catalog() {
  const [state, setState] = useState<Filters>(EMPTY);
  const [parsed, setParsed] = useState(false);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState({ min: "", max: "" });
  const [limit, setLimit] = useState(PAGE);
  const [allBrands, setAllBrands] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = useRef<HTMLInputElement>(null);
  const sort = useRef<HTMLSelectElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focusFrom = useRef<number | null>(null);
  const opened = useRef(false);

  // Qualquer mudança de filtro volta para a primeira página de resultados.
  const update = useCallback((change: (s: Filters) => Filters) => {
    setState(change);
    setLimit(PAGE);
  }, []);
  const fetchProducts = useCallback(() => {
    setLoad({ status: "loading" });
    (catalogProducts() as Promise<Product[]>).then(
      (products) => setLoad({ status: "ready", products }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(() => {
    const initial = fromUrl(location.search);
    setState(initial);
    setQuery(initial.q);
    setPrice({ min: initial.min, max: initial.max });
    if (initial.q) rememberSearch(initial.q);
    setParsed(true);
    fetchProducts();
    return () => clearTimeout(timer.current);
  }, [fetchProducts]);

  const products = load.status === "ready" ? load.products : null;
  const view = useMemo(() => {
    if (!products) return null;
    const corrected = state.q && !state.exato && !searchProducts(products, state.q).length ? correctQuery(products, state.q) : null;
    const activeQuery = corrected || state.q;
    const list = matches(products, activeQuery, state);
    if (state.sort !== "default") list.sort(sorters[state.sort]);
    const byCategory = matches(products, activeQuery, state, "categoria");
    const byBrand = matches(products, activeQuery, state, "marca");
    const brands = [...new Set(products.map((p) => p.marca))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const brandCounts = brands.map((b) => [b, byBrand.filter((p) => p.marca === b).length] as const).filter(([b, n]) => n > 0 || state.marcas.includes(b));
    const specGroups = filterFields(state.categoria)
      .map((field) => {
        const base = matches(products, activeQuery, state, field.key);
        const chosen = state.specs[field.key] || [];
        const options = (field.values || []).map((v) => [v, base.filter((p) => specList(p, field.key).includes(v)).length] as const).filter(([v, n]) => n > 0 || chosen.includes(v));
        return { field, chosen, options };
      })
      .filter((g) => g.options.length);
    return { corrected, activeQuery, list, byCategory, brandCounts, specGroups };
  }, [products, state]);

  // Endereço, título da aba e registro da busca acompanham os filtros (depois de carregar).
  useEffect(() => {
    if (!parsed) return;
    document.title = `${state.categoria || "Catálogo"} | Violet Voltage`;
    if (!view) return;
    const params = toUrl(state);
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    logSearch(state.q, view.list.length, view.corrected);
  }, [parsed, state, view]);

  // "Mostrar mais": o foco vai para o primeiro item novo (teclado e leitor de tela).
  useEffect(() => {
    if (focusFrom.current === null) return;
    grid.current?.children[focusFrom.current]?.querySelector<HTMLElement>("a, button")?.focus();
    focusFrom.current = null;
  }, [limit]);

  // Filtros no celular: painel lateral com foco controlado.
  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    const wasOpened = opened.current;
    opened.current ||= open;
    if (!open) {
      if (wasOpened) trigger.current?.focus();
      return;
    }
    const close = closeButton.current;
    close?.focus();
    // No celular o painel só fica visível ao fim da transição (0,3 s): o foco espera por ele.
    if (document.activeElement === close) return;
    const wait = setTimeout(() => close?.focus(), 320);
    return () => clearTimeout(wait);
  }, [open]);
  useEffect(() => () => document.body.classList.remove("no-scroll"), []);

  const reset = () => {
    clearTimeout(timer.current);
    update((s) => ({ ...EMPTY, sort: s.sort, exato: s.exato }));
    setQuery("");
    setPrice({ min: "", max: "" });
  };
  const removeFilter = (key: string) => {
    if (key === "all") return reset();
    if (key === "q") setQuery("");
    if (key === "preco") setPrice({ min: "", max: "" });
    update((s) => {
      if (key === "q") return { ...s, q: "" };
      if (key === "categoria") return withCategory(s, "");
      if (key === "preco") return { ...s, min: "", max: "" };
      if (key === "estoque") return { ...s, estoque: false };
      if (key.startsWith("marca:")) return { ...s, marcas: s.marcas.filter((m) => m !== key.slice(6)) };
      if (key.startsWith("spec:")) {
        const [, field, value] = key.split(":");
        const specs = { ...s.specs, [field]: (s.specs[field] || []).filter((v) => v !== value) };
        if (!specs[field].length) delete specs[field];
        return { ...s, specs };
      }
      return s;
    });
    sort.current?.focus();
  };
  const setSearch = (value: string) => update((s) => ({ ...s, q: value.trim().slice(0, 80), exato: false }));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    clearTimeout(timer.current);
    setSearch(query);
    rememberSearch(query.trim().slice(0, 80));
    search.current?.blur();
  };
  const setPriceField = (name: "min" | "max", value: string, wait: number) => {
    setPrice((p) => ({ ...p, [name]: value }));
    clearTimeout(timer.current);
    const commit = () => update((s) => (s[name] === value.trim() ? s : { ...s, [name]: value.trim() }));
    if (wait) timer.current = setTimeout(commit, wait);
    else commit();
  };
  const toggleSpec = (field: SpecField, value: string, checked: boolean) =>
    update((s) => {
      const chosen = new Set(s.specs[field.key] || []);
      if (checked) chosen.add(value);
      else chosen.delete(value);
      const values = (field.values || []).filter((v) => chosen.has(v));
      const specs = { ...s.specs };
      if (values.length) specs[field.key] = values;
      else delete specs[field.key];
      return { ...s, specs };
    });

  const min = reais(state.min);
  const max = reais(state.max);
  const invalid = min !== null && max !== null && min > max;
  const chips = appliedChips(state);
  const count = chips.filter(([k]) => k !== "q").length;
  const list = view?.list ?? [];
  const shown = list.slice(0, limit);
  const brandCounts = view?.brandCounts ?? [];
  const brands = allBrands ? brandCounts : brandCounts.slice(0, 6);

  let countText = "Carregando equipamentos…";
  if (load.status === "error") countText = "Não foi possível carregar os equipamentos.";
  else if (view) countText = `${list.length} ${list.length === 1 ? "equipamento encontrado" : "equipamentos encontrados"}${view.activeQuery ? ` para “${view.activeQuery}”` : ""}`;

  return (
    <div className="container page-wrap catalog-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span id="crumb-current" aria-current="page">
          {state.categoria || "Catálogo"}
        </span>
      </nav>
      <header className="catalog-head">
        <span className="eyebrow">Catálogo</span>
        <h1 id="catalog-title">{state.categoria || "Todos os equipamentos"}</h1>
        <p className="lead" id="catalog-lead">
          {state.categoria ? categoryInfo[state.categoria] : LEAD}
        </p>
      </header>
      <div className="catalog-toolbar" id="busca">
        <form className="catalog-search" id="catalog-search" role="search" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="catalog-q">
            Buscar no catálogo
          </label>
          <Icon name="search" />
          <input
            ref={search}
            id="catalog-q"
            name="q"
            type="search"
            placeholder="Buscar por modelo, marca ou categoria"
            maxLength={80}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => setSearch(value), 150);
            }}
          />
          <button
            type="button"
            className="icon-button"
            id="catalog-q-clear"
            aria-label="Limpar busca"
            hidden={!query}
            onClick={() => {
              clearTimeout(timer.current);
              removeFilter("q");
              search.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </form>
        <button
          ref={trigger}
          type="button"
          className="button secondary filters-trigger"
          id="filters-open"
          aria-controls="filters-panel"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Icon name="filter" />
          Filtros{" "}
          <span className="count" id="filters-count" hidden={!count}>
            {count || ""}
          </span>
        </button>
        <div className="sort-field">
          <label htmlFor="catalog-sort">Ordenar</label>
          <select ref={sort} id="catalog-sort" value={state.sort} onChange={(e) => update((s) => ({ ...s, sort: e.target.value }))}>
            <option value="default">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name">Nome: A–Z</option>
          </select>
        </div>
      </div>
      <div className="applied-filters" id="applied-filters" aria-label="Filtros aplicados">
        {chips.length > 0 && (
          <>
            {chips.map(([key, label]) => (
              <button key={key} type="button" className="chip chip-removable" aria-label={`Remover filtro ${label}`} onClick={() => removeFilter(key)}>
                {label}
                <Icon name="close" size={14} />
              </button>
            ))}
            <button type="button" className="text-button" onClick={() => removeFilter("all")}>
              Limpar tudo
            </button>
          </>
        )}
      </div>
      <div className="catalog-layout">
        <aside
          className={`filters-panel${open ? " is-open" : ""}`}
          id="filters-panel"
          aria-labelledby="filters-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) setOpen(false);
          }}
        >
          <div className="filters-head">
            <h2 id="filters-title">Filtrar</h2>
            <button ref={closeButton} type="button" className="icon-button" id="filters-close" aria-label="Fechar filtros" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <form id="filters" className="filters-form" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend>Categoria</legend>
              <div className="facet-list" id="facet-category">
                {view &&
                  ["", ...(categories as string[])].map((c) => (
                    <label key={c} className={`facet${state.categoria === c ? " is-active" : ""}`}>
                      <input type="radio" name="categoria" value={c} checked={state.categoria === c} onChange={() => update((s) => withCategory(s, c))} />
                      <span>{c || "Todas"}</span>
                      <span className="facet-count">{c ? view.byCategory.filter((p) => p.categoria === c).length : view.byCategory.length}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Marca</legend>
              <div className="facet-list" id="facet-brand">
                {brands.map(([b, n]) => (
                  <label key={b} className="facet">
                    <input
                      type="checkbox"
                      name="marca"
                      value={b}
                      checked={state.marcas.includes(b)}
                      onChange={(e) => {
                        const on = e.target.checked;
                        update((s) => ({ ...s, marcas: on ? [...s.marcas, b] : s.marcas.filter((m) => m !== b) }));
                      }}
                    />
                    <span>{b}</span>
                    <span className="facet-count">{n}</span>
                  </label>
                ))}
                {brandCounts.length > 6 && (
                  <button type="button" className="text-button" id="toggle-brands" aria-expanded={allBrands} onClick={() => setAllBrands((v) => !v)}>
                    {allBrands ? "Mostrar menos" : `Mostrar todas (${brandCounts.length})`}
                  </button>
                )}
              </div>
            </fieldset>
            <div id="facet-specs">
              {view?.specGroups.map(({ field, chosen, options }) => (
                <fieldset key={field.key}>
                  <legend>{field.label}</legend>
                  <div className="facet-list">
                    {options.map(([v, n]) => (
                      <label key={v} className="facet">
                        <input type="checkbox" name="spec" data-key={field.key} value={v} checked={chosen.includes(v)} onChange={(e) => toggleSpec(field, v, e.target.checked)} />
                        <span>{v}</span>
                        <span className="facet-count">{n}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <fieldset>
              <legend>Preço</legend>
              <div className="price-range">
                {(["min", "max"] as const).map((name) => (
                  <div key={name} className="field">
                    <label htmlFor={name}>{name === "min" ? "Mínimo (R$)" : "Máximo (R$)"}</label>
                    <input
                      id={name}
                      name={name}
                      type="number"
                      min="0"
                      max="9999999"
                      step="1"
                      inputMode="numeric"
                      placeholder={name === "min" ? "0" : "Sem limite"}
                      aria-describedby={name === "max" ? "price-error" : undefined}
                      aria-invalid={name === "max" ? invalid : undefined}
                      value={price[name]}
                      onChange={(e) => setPriceField(name, e.target.value, 400)}
                      onBlur={(e) => setPriceField(name, e.target.value, 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setPriceField(name, e.currentTarget.value, 0);
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="field-error" id="price-error" role="alert" hidden={!invalid}>
                {invalid ? "O máximo deve ser maior ou igual ao mínimo; a faixa não foi aplicada." : ""}
              </p>
              <div className="chip-row" id="price-presets">
                {view &&
                  presets.map(([label, pmin, pmax]) => {
                    const active = state.min === pmin && state.max === pmax;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`chip${active ? " active" : ""}`}
                        data-min={pmin}
                        data-max={pmax}
                        aria-pressed={active}
                        onClick={() => {
                          clearTimeout(timer.current);
                          const next = active ? { min: "", max: "" } : { min: pmin, max: pmax };
                          setPrice(next);
                          update((s) => ({ ...s, ...next }));
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
              </div>
            </fieldset>
            <fieldset>
              <legend>Disponibilidade</legend>
              <label className="check">
                <input type="checkbox" name="estoque" value="1" checked={state.estoque} onChange={(e) => update((s) => ({ ...s, estoque: e.target.checked }))} />
                <span>Somente em estoque</span>
              </label>
            </fieldset>
          </form>
          <div className="filters-foot">
            <button type="button" className="button secondary" id="clear-filters" onClick={reset}>
              Limpar filtros
            </button>
            <button type="button" className="button" id="filters-apply" onClick={() => setOpen(false)}>
              {view ? `Ver ${list.length} ${list.length === 1 ? "resultado" : "resultados"}` : "Ver resultados"}
            </button>
          </div>
        </aside>
        <section className="results" aria-labelledby="results-title">
          <h2 className="sr-only" id="results-title">
            Resultados
          </h2>
          <p className="catalog-meta" id="catalog-count" aria-live="polite">
            {countText}
          </p>
          <p className="search-correction" id="search-correction" role="status" hidden={!view?.corrected}>
            {view?.corrected && (
              <>
                <Icon name="sparkle" size={16} />
                <span>
                  Mostrando resultados para <strong>“{view.corrected}”</strong>.
                </span>
                <button
                  type="button"
                  className="text-button"
                  data-exact=""
                  onClick={() => {
                    update((s) => ({ ...s, exato: true }));
                    search.current?.focus();
                  }}
                >
                  Buscar apenas por “{state.q}”
                </button>
              </>
            )}
          </p>
          <div className="product-grid" id="products" ref={grid}>
            {load.status === "loading" && <SkeletonCards count={6} />}
            {load.status === "error" && <ErrorState error={load.error} retry={fetchProducts} />}
            {view &&
              (list.length ? (
                shown.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
              ) : (
                <State
                  level={3}
                  title={state.q ? `Nada encontrado para “${state.q}”.` : "Nenhum equipamento com esses filtros."}
                  text="Confira a grafia, use menos palavras ou remova um filtro."
                  actions={
                    <>
                      <button type="button" onClick={reset}>
                        Limpar filtros
                      </button>
                      <a className="button secondary" href="/catalogo.html">
                        Ver todo o catálogo
                      </a>
                    </>
                  }
                />
              ))}
          </div>
          <div className="catalog-more" id="catalog-more">
            {list.length > shown.length ? (
              <>
                <p className="small muted">
                  Mostrando {shown.length} de {list.length}
                </p>
                <button
                  type="button"
                  className="button secondary"
                  data-more=""
                  onClick={() => {
                    focusFrom.current = shown.length;
                    setLimit((n) => n + PAGE);
                  }}
                >
                  Mostrar mais {Math.min(PAGE, list.length - shown.length)}
                </button>
              </>
            ) : (
              list.length > PAGE && <p className="small muted">Todos os {list.length} equipamentos exibidos.</p>
            )}
          </div>
        </section>
      </div>
      <div className="filters-backdrop" hidden={!open} onClick={() => setOpen(false)} />
    </div>
  );
}
