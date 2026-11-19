// Kits com desconto: todos os kits com a lista de itens, preço cheio, economia e "Adicionar kit".
import { useCallback, useEffect, useState } from "react";
import { catalogProducts, type Product } from "../lib/shop";
import { ALL_KITS, KitCard } from "../components/KitCard";
import { State } from "../components/State";

type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };

export default function Kits() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const fetchProducts = useCallback(() => {
    setLoad({ status: "loading" });
    (catalogProducts() as Promise<Product[]>).then(
      (products) => setLoad({ status: "ready", products }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(fetchProducts, [fetchProducts]);
  // Link direto para um kit (/kits.html#kit-blues-classico) rola até ele.
  useEffect(() => {
    if (load.status === "ready" && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [load.status]);

  return (
    <div className="container page-wrap kits-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Kits</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Kits com desconto</span>
          <h1 className="page-title">Tudo combinando, por menos.</h1>
          <p className="lead">
            Kits montados por estilo e por momento. Com todos os itens do kit no carrinho, o desconto aparece sozinho no resumo, e você ainda pode usar um cupom.
          </p>
        </div>
      </header>
      <section className="setups kits-band" aria-label="Kits disponíveis">
        <div className="setup-grid kits-grid" id="kits-grid">
          {load.status === "loading" && (
            <div className="loading" role="status">
              Carregando kits…
            </div>
          )}
          {load.status === "error" && (
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
                    Ver catálogo
                  </a>
                </>
              }
            />
          )}
          {load.status === "ready" && ALL_KITS.map((kit) => <KitCard key={kit.id} kit={kit} products={load.products} detailed level={2} />)}
        </div>
      </section>
    </div>
  );
}
