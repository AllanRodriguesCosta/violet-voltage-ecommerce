// Comparador: de 2 a 4 produtos lado a lado (ficha técnica, preço e disponibilidade), só as
// diferenças, link para compartilhar (?ids=) e atalhos para remover, limpar e adicionar.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../lib/icons";
import { addCart, catalogProducts, money, productImage, toast, type Product } from "../lib/shop";
import { useCompare } from "../lib/compare";
import { compareRows, getCompare, setCompare, MAX_COMPARE } from "../lib/catalog";
import { AlertButton, installmentText, productUrl, stockState } from "../components/ProductCard";
import { State } from "../components/State";

// Lista vinda do link (?ids=) tem prioridade: permite compartilhar a comparação.
function adoptSharedIds() {
  const shared = new URLSearchParams(location.search).get("ids");
  if (!shared) return;
  const ids = [...new Set(shared.split(","))].filter((id) => /^[a-zA-Z0-9-]{1,100}$/.test(id)).slice(0, MAX_COMPARE);
  if (ids.length) {
    setCompare(ids);
    history.replaceState(null, "", "/comparar.html");
  }
}

type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };

export default function Compare() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [onlyDiff, setOnlyDiff] = useState(false);
  const ids = useCompare();
  const container = useRef<HTMLDivElement>(null);
  const focusAfter = useRef(false);
  const fetchProducts = useCallback(() => {
    (catalogProducts() as Promise<Product[]>).then(
      (products) => setLoad({ status: "ready", products }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(() => {
    adoptSharedIds();
    fetchProducts();
  }, [fetchProducts]);

  const products = load.status === "ready" ? load.products : null;
  const list = products ? ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)) : [];
  // Produtos que saíram do catálogo deixam a comparação.
  useEffect(() => {
    if (products && list.length !== ids.length) setCompare(list.map((p) => p.id));
  });
  // Depois de remover ou limpar, o foco vai para o próximo botão de remover (ou para o catálogo).
  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    container.current?.querySelector<HTMLElement>(".compare-remove, a.button")?.focus();
  }, [ids]);

  const remove = (id: string) => {
    focusAfter.current = true;
    setCompare(getCompare().filter((x) => x !== id));
  };
  const clear = () => {
    focusAfter.current = true;
    setCompare([]);
  };
  const shareLink = async () => {
    const url = `${location.origin}/comparar.html?ids=${getCompare().map(encodeURIComponent).join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link da comparação copiado.", { type: "success" });
    } catch {
      toast(`Copie o endereço: ${url}`, { type: "info" });
    }
  };

  let lead = "Fichas técnicas, preços e disponibilidade em uma tabela.";
  let content;
  if (load.status === "loading") content = <div className="loading" role="status">Carregando comparação…</div>;
  else if (load.status === "error")
    content = (
      <State
        tone="error"
        title="Não foi possível carregar."
        text={load.error.message}
        actions={
          <>
            <button type="button" onClick={fetchProducts}>
              Tentar novamente
            </button>
            <a className="button secondary" href="/catalogo.html">
              Voltar ao catálogo
            </a>
          </>
        }
      />
    );
  else if (list.length < 2) {
    lead = "Escolha de 2 a 4 equipamentos para ver as fichas lado a lado.";
    content = (
      <State
        symbol="compare"
        title={list.length ? "Falta pelo menos mais um produto." : "Nenhum produto para comparar ainda."}
        text={
          <>
            No catálogo ou na página do produto, toque em <strong>Comparar</strong> nos itens que você quer ver lado a lado.
          </>
        }
        actions={
          <a className="button" href={`/catalogo.html${list[0] ? `?categoria=${encodeURIComponent(list[0].categoria)}` : ""}`}>
            Escolher no catálogo
          </a>
        }
      />
    );
  } else {
    const categories = [...new Set(list.map((p) => p.categoria))];
    lead = `${list.length} equipamentos lado a lado. As linhas destacadas mostram onde eles se diferenciam.`;
    const rows = compareRows(list);
    const cheapest = Math.min(...list.map((p) => p.priceCents));
    const visible = onlyDiff ? rows.filter((r) => r.differs) : rows;
    content = (
      <>
        {categories.length > 1 && (
          <p className="notice">
            <Icon name="info" size={18} />
            <span>Você está comparando categorias diferentes ({categories.join(", ")}). A comparação faz mais sentido entre itens da mesma categoria.</span>
          </p>
        )}
        <div className="compare-tools">
          <label className="check">
            <input type="checkbox" id="only-diff" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
            <span>Mostrar só as diferenças</span>
          </label>
          <button type="button" className="text-button" data-share-compare="" onClick={shareLink}>
            <Icon name="share" size={16} />
            Copiar link da comparação
          </button>
          <button type="button" className="text-button" data-clear="" onClick={clear}>
            <Icon name="trash" size={16} />
            Limpar comparação
          </button>
          {list.length < MAX_COMPARE && (
            <a className="text-link" href={`/catalogo.html?categoria=${encodeURIComponent(list[0].categoria)}`}>
              <Icon name="plus" size={16} />
              Adicionar outro
            </a>
          )}
        </div>
        <div className="table-wrap compare-wrap" role="region" aria-label="Tabela de comparação" tabIndex={0}>
          <table className="compare-table">
            <caption className="sr-only">Comparação de {list.length} produtos</caption>
            <thead>
              <tr>
                <td />
                {list.map((p) => {
                  const name = `${p.marca} ${p.modelo}`;
                  const stock = stockState(p);
                  return (
                    <th key={p.id} scope="col" className="compare-product">
                      <button type="button" className="icon-button compare-remove" aria-label={`Remover ${name} da comparação`} onClick={() => remove(p.id)}>
                        <Icon name="close" size={18} />
                      </button>
                      <a href={productUrl(p)}>
                        <img src={productImage(p)} alt="" width={120} height={120} loading="lazy" />
                        <span className="product-brand">{p.marca}</span>
                        <strong>{p.modelo}</strong>
                      </a>
                      <span className="compare-price">
                        {money(p.priceCents)}
                        {p.priceCents === cheapest && <span className="badge badge-in">Menor preço</span>}
                      </span>
                      <small>{installmentText(p.priceCents) || "\u00a0"}</small>
                      <span className={`small stock-${stock.key}`}>{stock.label}</span>
                      {p.estoque ? (
                        <button
                          type="button"
                          className="button small-button"
                          onClick={(e) => addCart(p, 1, { source: e.currentTarget.closest("th")?.querySelector("img") })}
                        >
                          <Icon name="bag" size={16} />
                          Adicionar
                        </button>
                      ) : (
                        <AlertButton product={p} short className="button secondary small-button" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((r) => (
                  <tr key={r.key + r.label} className={r.differs ? "is-diff" : ""}>
                    <th scope="row">
                      {r.label}
                      {r.differs && <span className="sr-only"> (diferente)</span>}
                    </th>
                    {r.values.map((v, i) => (
                      <td key={i}>{v || "—"}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={list.length + 1}>Nenhuma diferença na ficha técnica: compare preço e disponibilidade acima.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className="container page-wrap compare-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <a href="/catalogo.html">Catálogo</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Comparar</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Comparador</span>
          <h1 className="page-title">Lado a lado, sem dúvida.</h1>
          <p className="lead" id="compare-lead">
            {lead}
          </p>
        </div>
      </header>
      <div id="compare-content" ref={container}>
        {content}
      </div>
    </div>
  );
}
