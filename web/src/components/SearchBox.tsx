// Busca do cabeçalho e da busca móvel: combobox com sugestões (produtos, categorias, "Você quis
// dizer" e buscar no catálogo), buscas recentes com o campo vazio e navegação pelo teclado
// (setas, Enter e Esc). Mesma marcação (ids, classes e papéis ARIA) da busca anterior.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Icon } from "../lib/icons";
import { catalogProducts, clearSearches, recentSearches, rememberSearch } from "../lib/cart";
import { categories, correctQuery, money, normalize, productImage, searchProducts } from "../../../shared/catalog.js";
import type { Product } from "../lib/types";

type Suggestions =
  | { kind: "recent"; items: string[] }
  | { kind: "results"; query: string; fixed: string | null; cats: string[]; found: Product[] };

function Options({ id, data }: { id: string; data: Suggestions }) {
  if (data.kind === "recent")
    return (
      <>
        <p className="suggestion-heading">Buscas recentes</p>
        {data.items.map((q, i) => (
          <a role="option" key={q} id={`${id}-r${i}`} href={`/catalogo.html?q=${encodeURIComponent(q)}`} tabIndex={-1}>
            <Icon name="clock" size={18} />
            <span>
              <strong>{q}</strong>
            </span>
          </a>
        ))}
        <a role="option" id={`${id}-clear`} className="suggestion-clear" href="#" data-clear-searches tabIndex={-1}>
          <Icon name="trash" size={16} />
          <span>Limpar buscas recentes</span>
        </a>
      </>
    );
  const { query, fixed, cats, found } = data;
  return (
    <>
      {fixed && (
        <a role="option" id={`${id}-fix`} className="suggestion-fix" href={`/catalogo.html?q=${encodeURIComponent(fixed)}`} tabIndex={-1}>
          <Icon name="sparkle" size={18} />
          <span>
            Você quis dizer <strong>“{fixed}”</strong>?
          </span>
        </a>
      )}
      {cats.map((c, i) => (
        <a role="option" key={c} id={`${id}-c${i}`} href={`/catalogo.html?categoria=${encodeURIComponent(c)}`} tabIndex={-1}>
          <Icon name="grid" size={18} />
          <span>
            <strong>{c}</strong>
            <small>Ver categoria</small>
          </span>
        </a>
      ))}
      {found.length ? (
        found.map((p, i) => (
          <a role="option" key={p.id} id={`${id}-p${i}`} href={`/produto.html?id=${encodeURIComponent(p.id)}`} tabIndex={-1}>
            <img src={productImage(p)} alt="" width={44} height={44} />
            <span>
              <strong>{p.modelo}</strong>
              <small>
                {p.marca} · {p.categoria}
              </small>
            </span>
            <span className="suggestion-price">{money(p.priceCents)}</span>
          </a>
        ))
      ) : (
        <p className="suggestion-empty">Nenhum produto com esse termo.</p>
      )}
      <a role="option" id={`${id}-all`} className="suggestion-all" href={`/catalogo.html?q=${encodeURIComponent(query)}`} tabIndex={-1}>
        <Icon name="search" size={18} />
        <span>Buscar “{query}” no catálogo</span>
        <Icon name="arrowRight" size={16} />
      </a>
    </>
  );
}

export function SearchBox({ id, placeholder, children, className = "search-box" }: { id: string; placeholder: string; children?: ReactNode; className?: string }) {
  const listId = `${id}-suggestions`;
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = data !== null;
  const options = () => [...(list.current?.querySelectorAll<HTMLElement>("[role=option]") || [])];
  const close = () => {
    setData(null);
    setActive(-1);
  };
  const show = (next: Suggestions) => {
    setData(next);
    setActive(-1);
  };
  // Campo vazio: buscas recentes deste navegador, com opção de limpar o histórico.
  async function update() {
    const query = input.current?.value.trim() || "";
    if (!query) {
      const items = recentSearches();
      return items.length ? show({ kind: "recent", items }) : close();
    }
    if (normalize(query).length < 2) return close();
    let products: Product[];
    try {
      products = await catalogProducts();
    } catch {
      return close();
    }
    if (input.current?.value.trim() !== query) return;
    let found = searchProducts(products, query).slice(0, 5);
    const fixed = found.length ? null : correctQuery(products, query);
    if (fixed) found = searchProducts(products, fixed).slice(0, 5);
    const cats = categories.filter((c) => normalize(c).includes(normalize(query))).slice(0, 3);
    show({ kind: "results", query, fixed, cats, found });
  }
  useEffect(() => {
    const option = options()[active];
    option?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(closing.current);
    },
    [],
  );
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const all = options();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open || !all.length) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + delta + all.length) % all.length);
    } else if (event.key === "Enter" && active >= 0 && all[active]) {
      event.preventDefault();
      all[active].click();
    } else if (event.key === "Escape") {
      // Primeiro Escape fecha as sugestões; o seguinte fecha a busca móvel.
      event.preventDefault();
      if (open) close();
      else event.currentTarget.closest("dialog")?.close();
    }
  };
  const activeId = active >= 0 ? options()[active]?.id : undefined;
  return (
    <form
      className={className}
      id={id === "header" ? "header-search" : undefined}
      role="search"
      action="/catalogo.html"
      onSubmit={(event) => {
        const value = input.current?.value || "";
        if (!value.trim()) {
          event.preventDefault();
          location.href = "/catalogo.html";
        } else rememberSearch(value);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) closing.current = setTimeout(close, 100);
      }}
    >
      <label className="sr-only" htmlFor={`${id}-q`}>
        Buscar equipamentos
      </label>
      <span className="search-icon">
        <Icon name="search" size={18} />
      </span>
      <input
        ref={input}
        id={`${id}-q`}
        name="q"
        type="search"
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onInput={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(update, 120);
        }}
        // Voltar ao campo logo depois de sair dele cancela o fechamento pendente.
        onFocus={() => {
          clearTimeout(closing.current);
          update();
        }}
        onKeyDown={onKeyDown}
      />
      {children}
      <div
        className="suggestions"
        id={listId}
        role="listbox"
        aria-label="Sugestões"
        hidden={!open}
        ref={list}
        onClick={(event) => {
          // Escolher uma opção guarda o termo digitado; "Limpar" esvazia o histórico.
          const option = (event.target as HTMLElement).closest("[role=option]");
          if (!option) return;
          if (option.hasAttribute("data-clear-searches")) {
            event.preventDefault();
            clearSearches();
            close();
            input.current?.focus();
          } else rememberSearch(input.current?.value || "");
        }}
      >
        {data && <Options id={listId} data={data} />}
      </div>
      <SelectedSync list={list} active={active} />
    </form>
  );
}

// aria-selected da opção ativa (as opções são links gerados pela lista).
function SelectedSync({ list, active }: { list: RefObject<HTMLDivElement | null>; active: number }) {
  useEffect(() => {
    list.current?.querySelectorAll("[role=option]").forEach((o, i) => o.setAttribute("aria-selected", String(i === active)));
  });
  return null;
}
