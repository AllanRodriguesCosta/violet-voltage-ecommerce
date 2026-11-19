// Início: vitrine com categorias, estilos musicais, destaques, kits e vistos recentemente.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../lib/icons";
import { catalogProducts, categories, getRecent, productImage, toast, type Product } from "../lib/shop";
import { categoryInfo } from "../../../shared/catalog.js";
import { GENEROS } from "../../../shared/specs.js";
import { kitPrice } from "../../../shared/kits.js";
import { Carousel } from "../components/Carousel";
import { ProductCard, SkeletonCards } from "../components/ProductCard";
import { ALL_KITS, KitCard } from "../components/KitCard";
import { ErrorState } from "../components/State";

// Destaque: o item mais caro disponível de cada categoria, depois os demais por preço.
function highlights(products: Product[]) {
  const available = products.filter((p) => p.estoque > 0);
  const flagship = (categories as string[])
    .map((c) => available.filter((p) => p.categoria === c).sort((a, b) => b.priceCents - a.priceCents)[0])
    .filter(Boolean);
  const rest = available.filter((p) => !flagship.includes(p)).sort((a, b) => b.priceCents - a.priceCents);
  return [...flagship, ...rest].slice(0, 8);
}

type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };

function Categories({ products }: { products: Product[] | null }) {
  return (
    <div className="category-grid" id="category-grid">
      {(categories as string[]).map((c) => {
        const items = (products || []).filter((p) => p.categoria === c);
        const cover = [...items].sort((a, b) => b.priceCents - a.priceCents)[0];
        const count = products ? `${items.length} ${items.length === 1 ? "item" : "itens"}` : "Ver itens";
        return (
          <a key={c} className="category-tile" href={`/catalogo.html?categoria=${encodeURIComponent(c)}`}>
            <span className="category-copy">
              <strong>{c}</strong>
              <span>{(categoryInfo as Record<string, string>)[c]}</span>
              <span className="category-count">
                {count} <Icon name="arrowRight" size={16} />
              </span>
            </span>
            <img src={productImage(cover || { categoria: c })} alt="" loading="lazy" width={160} height={160} />
          </a>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const fetchProducts = useCallback(() => {
    setLoad({ status: "loading" });
    (catalogProducts() as Promise<Product[]>).then(
      (products) => setLoad({ status: "ready", products }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(() => {
    // Endereços antigos da busca na página inicial seguem para o catálogo.
    const params = new URLSearchParams(location.search);
    if (location.hash === "#catalogo" || ["q", "categoria", "marca", "modelo", "min", "max", "sort"].some((k) => params.has(k))) {
      location.replace(`/catalogo.html${location.search}`);
      return;
    }
    if (params.get("conta") === "excluida") {
      toast("Sua conta foi excluída e seus dados pessoais foram apagados.", { type: "success" });
      history.replaceState(null, "", "/");
    }
    setRecentIds(getRecent() as string[]);
    fetchProducts();
  }, [fetchProducts]);

  const products = load.status === "ready" ? load.products : null;
  const genres = products
    ? (GENEROS as string[]).map((g) => [g, products.filter((p) => p.ficha?.generos?.includes(g)).length] as const).filter(([, n]) => n)
    : [];
  const recent = products
    ? recentIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p))
        .slice(0, 8)
    : [];
  const kits = products ? ALL_KITS.filter((k) => kitPrice(k, products)).slice(0, 3) : [];

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Volume na sua identidade.</span>
            <h1>
              Encontre a sua
              <br />
              <em>frequência.</em>
            </h1>
            <p>Da primeira nota ao próximo palco. Encontre o equipamento que dá voz ao seu estilo.</p>
            <div className="hero-actions">
              <a className="button button-glow" href="/catalogo.html">
                Explorar equipamentos <Icon name="arrowRight" />
              </a>
              <a className="hero-link" href="/setup.html">
                Monte seu setup
              </a>
            </div>
            <p className="hero-foot">GUITARRAS / EFEITOS / AMPLIFICADORES</p>
          </div>
          <div className="hero-stage">
            <span className="stage-label" aria-hidden="true">
              VV / SOUND EXPLORATION
            </span>
            <img className="hero-art" src="/assets/hero.svg" alt="Ilustração original de uma guitarra violeta" width={640} height={580} />
            <span className="stage-caption" aria-hidden="true">
              Turn up
              <br />
              <strong>your tone.</strong>
            </span>
          </div>
        </div>
      </section>
      <section className="perks" aria-label="Vantagens da loja">
        <ul className="container perk-grid">
          {(
            [
              ["truck", "Frete grátis acima de R$ 999", "Na entrega padrão"],
              ["card", "Até 10x sem juros", "No cartão de crédito"],
              ["store", "Retirada na loja", "Sem custo de frete"],
              ["refresh", "Troca em até 7 dias", "Após o recebimento"],
            ] as const
          ).map(([symbol, title, text]) => (
            <li key={symbol}>
              <span className="perk-icon">
                <Icon name={symbol} size={22} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="container promo" aria-label="Cupom de boas-vindas">
        <span className="promo-icon">
          <Icon name="tag" size={22} />
        </span>
        <p>
          <strong>Primeira compra?</strong> Use o cupom <code>PRIMEIROACORDE</code> e ganhe R$ 30,00 em pedidos a partir de R$ 200,00.
        </p>
        <a className="text-link" href="/catalogo.html">
          Aproveitar <Icon name="arrowRight" />
        </a>
      </aside>
      <section className="section container" id="categorias" aria-labelledby="categories-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">Explore</span>
            <h2 id="categories-title">Escolha por categoria</h2>
          </div>
          <a className="text-link" href="/catalogo.html">
            Ver todo o catálogo <Icon name="arrowRight" />
          </a>
        </div>
        {load.status === "loading" ? (
          <div className="category-grid" id="category-grid">
            <div className="category-tile skeleton" />
            <div className="category-tile skeleton" />
            <div className="category-tile skeleton" />
          </div>
        ) : (
          <Categories products={products} />
        )}
      </section>
      <section className="section container" id="estilos" aria-labelledby="genres-title" hidden={!genres.length}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Encontre pelo seu som</span>
            <h2 id="genres-title">Escolha por estilo musical</h2>
          </div>
          <a className="text-link" href="/setup.html">
            Montar um setup <Icon name="arrowRight" />
          </a>
        </div>
        <ul className="genre-cloud" id="genre-cloud">
          {genres.map(([g, n]) => (
            <li key={g}>
              <a className="chip genre-chip" href={`/catalogo.html?generos=${encodeURIComponent(g)}`}>
                {g}
                <span className="facet-count">{n}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <Carousel
        id="destaques"
        titleId="highlights-title"
        eyebrow="Seleção da casa"
        title="Destaques do palco"
        label="Destaques"
        prevLabel="Destaques anteriores"
        nextLabel="Próximos destaques"
      >
        {load.status === "loading" && <SkeletonCards count={4} />}
        {load.status === "error" && <ErrorState error={load.error} retry={fetchProducts} level={3} title="Não foi possível carregar os destaques." />}
        {products && highlights(products).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </Carousel>
      <section className="setups" id="setups" aria-labelledby="setups-title" hidden={load.status === "error" || (products !== null && !kits.length)}>
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Kits com desconto</span>
              <h2 id="setups-title">Combinações prontas para tocar</h2>
              <p>Itens que conversam entre si. Com o kit completo no carrinho, o desconto entra sozinho.</p>
            </div>
            <a className="text-link" href="/kits.html">
              Ver todos os kits <Icon name="arrowRight" />
            </a>
          </div>
          <div className="setup-grid" id="setup-grid">
            {products && kits.map((kit) => <KitCard key={kit.id} kit={kit} products={products} />)}
          </div>
        </div>
      </section>
      <Carousel
        id="recentes"
        titleId="recent-title"
        eyebrow="Continue de onde parou"
        title="Vistos recentemente"
        label="Vistos recentemente"
        prevLabel="Itens anteriores"
        nextLabel="Próximos itens"
        hidden={!recent.length}
      >
        {recent.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </Carousel>
      <section className="brand-story container" id="essencia" aria-labelledby="story-title">
        <div>
          <span className="eyebrow">A essência Violet Voltage</span>
          <h2 id="story-title">
            Técnica encontra
            <br />
            personalidade.
          </h2>
          <div className="story-stats" id="story-stats">
            {products &&
              (
                [
                  [products.length, "equipamentos no catálogo"],
                  [categories.length, "categorias para explorar"],
                  [new Set(products.map((p) => p.marca)).size, "marcas selecionadas"],
                ] as const
              ).map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
          </div>
        </div>
        <div>
          <p>Um riff que fica na cabeça. Uma textura diferente. A vontade de tocar mais uma vez. Seu equipamento faz parte dessa descoberta.</p>
          <p>Explore guitarras, amplificadores e efeitos para compor um setup com a sua identidade.</p>
          <a className="text-link" href="/catalogo.html">
            Encontre seu próximo som <Icon name="arrowRight" />
          </a>
        </div>
      </section>
    </>
  );
}
