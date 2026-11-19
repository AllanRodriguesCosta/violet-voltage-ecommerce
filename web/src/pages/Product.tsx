// Produto: galeria por cor (?cor= no endereço), preço e parcelas, estoque (também por cor),
// quantidade, carrinho e "Comprar agora", entrega e serviços, ficha técnica, compartilhar,
// comparar, avisos, "Compre junto", perguntas, relacionados e vistos recentemente.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { addCart, api, catalogProducts, getCart, getRecent, money, productImage, setCart, toast, maxInstallments, installmentValue, FREE_SHIPPING_CENTS, type Product } from "../lib/shop";
import { affinity, bundlePicks, delivery, itemColor, openCart, photosOf, pushRecent, servicesFor, shipping, specRows, type Detail } from "../lib/catalog";
import { useFieldError } from "../lib/forms";
import { togglePriceAlert, usePriceAlerts } from "../lib/priceAlerts";
import { AlertButton, CompareButton, ProductCard, installmentText, stockState } from "../components/ProductCard";
import { ColorPicker, Gallery } from "../components/Gallery";
import { Questions } from "../components/Questions";
import { State } from "../components/State";

function structuredData(p: Product, name: string) {
  // O servidor já entrega os dados estruturados no HTML; aqui só quando eles faltarem.
  if (document.querySelector('script[type="application/ld+json"]')) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: p.descricao,
    sku: p.id,
    category: p.categoria,
    brand: { "@type": "Brand", name: p.marca },
    image: new URL(productImage(p), location.origin).href,
    offers: {
      "@type": "Offer",
      url: location.href,
      priceCurrency: "BRL",
      price: (p.priceCents / 100).toFixed(2),
      availability: `https://schema.org/${p.estoque > 0 ? "InStock" : "OutOfStock"}`,
    },
  });
  document.head.append(script);
}
async function share(name: string) {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${name} | Violet Voltage`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Link copiado para a área de transferência.", { type: "success" });
  } catch (error) {
    if ((error as Error)?.name !== "AbortError") toast("Não foi possível compartilhar. Copie o endereço da página.", { type: "error" });
  }
}
function InstallmentsTable({ total }: { total: number }) {
  const max = maxInstallments(total);
  if (max < 2) return null;
  return (
    <details className="installments-table">
      <summary>Ver todas as parcelas</summary>
      <table>
        <caption className="sr-only">Parcelamento no cartão de crédito</caption>
        <tbody>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <tr key={n}>
              <th scope="row">{n}x</th>
              <td>{money(installmentValue(total, n))}</td>
              <td>sem juros</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
// Serviços disponíveis para o item, em uma linha ("Regulagem, troca de cordas e garantia estendida").
const serviceLabels: Record<string, string> = { regulagem: "regulagem por luthier", cordas: "troca de cordas", garantia: "garantia estendida" };
function serviceSummary(p: Product) {
  const names = servicesFor(p).map((x) => serviceLabels[x.id]);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}
// Ficha técnica: gêneros viram atalhos para o catálogo filtrado.
function Specs({ p }: { p: Product }) {
  return specRows(p).map(({ field, text }) =>
    field.key === "generos" && p.ficha?.generos?.length ? (
      <div key={field.key} className="spec-genres">
        <dt>{field.label}</dt>
        <dd>
          <ul className="genre-links">
            {p.ficha.generos.map((g) => (
              <li key={g}>
                <a className="chip" href={`/catalogo.html?generos=${encodeURIComponent(g)}`}>
                  {g}
                </a>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    ) : (
      <div key={field.key}>
        <dt>{field.label}</dt>
        <dd>{text}</dd>
      </div>
    ),
  );
}
function PriceAlertButton({ product: p }: { product: Product }) {
  const on = usePriceAlerts().has(p.id);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="text-button price-alert-button"
      aria-pressed={on}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await togglePriceAlert(p.id);
        setBusy(false);
      }}
    >
      <span className="alert-icon">
        <Icon name={on ? "check" : "tag"} size={18} />
      </span>
      <span className="alert-label">{on ? "Aviso de preço ativado" : "Avisar se baixar o preço"}</span>
      <span className="sr-only">
        {" "}
        de {p.marca} {p.modelo}
      </span>
    </button>
  );
}

// Compre junto: o produto e até dois complementos (regra em shared/catalog.js).
function Bundle({ product: p, picks }: { product: Product; picks: Product[] }) {
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const all = [p, ...picks];
  const chosen = all.filter((x, i) => i === 0 || !unchecked.has(x.id));
  const sum = chosen.reduce((s, x) => s + x.priceCents, 0);
  const parcel = installmentText(sum);
  const items = chosen.length === 1 ? "item" : "itens";
  const add = () => {
    const cart = getCart() as { id: string; quantidade: number }[];
    let added = 0;
    for (const x of chosen) {
      const line = cart.find((i) => i.id === x.id);
      if ((line?.quantidade || 0) + 1 > Math.min(99, x.estoque)) continue;
      if (line) line.quantidade++;
      else cart.push({ id: x.id, quantidade: 1 });
      added++;
    }
    if (!added) return toast("Esses itens já estão no carrinho no limite do estoque.", { type: "info" });
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho.`);
  };
  const list: ReactNode[] = [];
  all.forEach((x, i) => {
    const main = i === 0;
    if (i)
      list.push(
        <li key={`plus-${i}`} className="bundle-plus" aria-hidden="true">
          <Icon name="plus" size={20} />
        </li>,
      );
    list.push(
      <li key={x.id} className={`bundle-item${main ? " is-main" : ""}`}>
        <label>
          <input
            type="checkbox"
            value={x.id}
            checked={main || !unchecked.has(x.id)}
            disabled={main}
            onChange={(e) => {
              const next = new Set(unchecked);
              if (e.target.checked) next.delete(x.id);
              else next.add(x.id);
              setUnchecked(next);
            }}
          />
          <span className="bundle-media">
            <img src={productImage(x)} alt="" width={96} height={96} loading="lazy" />
          </span>
          <span className="bundle-text">
            <small>{main ? "Este item" : x.categoria}</small>
            <span>
              {x.marca} {x.modelo}
            </span>
            <strong>{money(x.priceCents)}</strong>
          </span>
        </label>
        {!main && (
          <a className="text-link small" href={`/produto.html?id=${encodeURIComponent(x.id)}`}>
            Ver detalhes
          </a>
        )}
      </li>,
    );
  });
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Compre junto</span>
          <h2 id="bundle-title">Complete o seu setup</h2>
        </div>
      </div>
      <div className="bundle panel">
        <ul className="bundle-items">{list}</ul>
        <div className="bundle-total" aria-live="polite">
          <span>
            Total de {chosen.length} {items}
          </span>
          <strong>{money(sum)}</strong>
          {parcel && <small>{parcel}</small>}
          <button type="button" data-bundle-add="" onClick={add}>
            <Icon name="bag" size={18} />
            Adicionar {chosen.length} {items} ao carrinho
          </button>
        </div>
      </div>
    </>
  );
}

function Recent({ products }: { products: Product[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const sync = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    el.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync);
    sync();
    return () => {
      el.removeEventListener("scroll", sync);
      removeEventListener("resize", sync);
    };
  }, [products]);
  const move = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9 });
  return (
    <section className="section-tight" id="recentes" aria-labelledby="recent-title" hidden={!products.length}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Continue de onde parou</span>
          <h2 id="recent-title">Vistos recentemente</h2>
        </div>
        <div className="carousel-controls">
          <button type="button" className="icon-button" data-prev="" aria-label="Itens anteriores" disabled={edges.start} onClick={() => move(-1)}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="icon-button" data-next="" aria-label="Próximos itens" disabled={edges.end} onClick={() => move(1)}>
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className="carousel" ref={track} role="region" aria-label="Vistos recentemente" tabIndex={0}>
        {products.map((x, i) => (
          <ProductCard key={x.id} product={x} index={i} />
        ))}
      </div>
    </section>
  );
}

type Load = { status: "loading" } | { status: "error"; error: Error & { status?: number } } | { status: "ready"; product: Detail };
type Extras = { picks: Product[]; related: Product[]; recent: Product[] };

function Ready({ p, extras }: { p: Detail; extras: Extras | null }) {
  const name = `${p.marca} ${p.modelo}`;
  const stock = stockState(p);
  // Galeria (etapa 29): fotos da cor escolhida (?cor= no endereço mantém a escolha ao compartilhar).
  const colors = Array.isArray(p.cores) && p.cores.length > 1 ? p.cores : [];
  const [cor, setCor] = useState(() => itemColor(p, new URLSearchParams(location.search).get("cor")));
  const photos = photosOf(p, cor);
  const max = Math.min(99, p.estoque);
  const [qty, setQty] = useState("1");
  const [feedback, setFeedback] = useState<ReactNode>("");
  const [barVisible, setBarVisible] = useState(false);
  const quantity = useFieldError<HTMLInputElement>("quantidade");
  const buyBox = useRef<HTMLElement | null>(null);
  const setBuyBox = (el: HTMLElement | null) => {
    buyBox.current = el;
  };
  const image = () => document.querySelector<HTMLImageElement>(".detail-image");

  // Etapa 34: estoque por cor (quando a loja informa). Cor esgotada não entra no carrinho.
  const color = (p.cores || []).find((x) => x.nome === cor);
  const colorStock = color && Number.isInteger(color.estoque) ? (color.estoque as number) : null;
  const colorNote =
    colorStock === null ? "" : colorStock === 0 ? `Esgotado na cor ${cor}. Escolha outra cor ou ative o Avise-me.` : colorStock <= 5 ? `Últimas unidades na cor ${cor}: ${colorStock}.` : "";
  const soldOutColor = colorStock === 0;
  const qtyMax = colorStock ? Math.min(max, colorStock) : max;
  useEffect(() => {
    if (colorStock) setQty((v) => (Number(v) > colorStock ? String(colorStock) : v));
  }, [colorStock]);

  const pickColor = (next: string) => {
    setCor(next);
    const url = new URL(location.href);
    url.searchParams.set("cor", next);
    history.replaceState(history.state, "", url);
  };
  const step = (delta: number) => setQty((v) => String(Math.min(max, Math.max(1, (Number(v) || 1) + delta))));

  // Barra de compra fixa no celular quando o botão principal sai da tela.
  useEffect(() => {
    let ticking = false;
    const sync = () => {
      ticking = false;
      setBarVisible((buyBox.current?.getBoundingClientRect().bottom ?? 0) < 0);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(sync);
      }
    };
    addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => removeEventListener("scroll", onScroll);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!quantity.validate()) return;
    if (addCart(p, Number(qty), { source: image(), cor: cor || undefined }))
      setFeedback(
        <>
          Equipamento adicionado{cor ? ` na cor ${cor}` : ""}. <a href="/carrinho.html">Ver meu carrinho</a>
        </>,
      );
    else setFeedback("Não foi possível adicionar. Confira a quantidade e a mensagem exibida.");
  };
  const deliveryPrice = (key: string) => ((key === "padrao" && p.priceCents >= FREE_SHIPPING_CENTS) || !shipping[key] ? "Grátis" : money(shipping[key]));
  const services = servicesFor(p);

  return (
    <Frame
      p={p}
      crumb={p.modelo}
      extras={extras}
      sticky={<StickyBuy p={p} image={photos[0].url} visible={barVisible} disabled={soldOutColor} cor={cor} />}
    >
      <div id="product-detail" className="detail-grid">
        <Gallery product={p} name={name} cor={cor} photos={photos} />
        <section className="detail-info" data-name={name}>
          <span className="eyebrow">
            {p.categoria} · {p.marca}
          </span>
          <h1>{p.modelo}</h1>
          <p className="detail-price">{money(p.priceCents)}</p>
          {installmentText(p.priceCents) && <p className="detail-installments">{installmentText(p.priceCents)}</p>}
          <InstallmentsTable total={p.priceCents} />
          <p className={`stock-pill stock-${stock.key}`}>
            <Icon name={stock.key === "out" ? "clock" : "check"} size={16} />
            {stock.key === "out" ? "Produto esgotado" : stock.key === "low" ? `Últimas unidades: ${p.estoque} em estoque` : `${p.estoque} unidades em estoque`}
          </p>
          {colors.length > 0 && <ColorPicker colors={colors} current={cor} note={colorNote} onChange={pickColor} />}
          <p className="lead">{p.descricao}</p>
          {p.estoque ? (
            <form id="add-product" className="buy-box" noValidate onSubmit={onSubmit} ref={setBuyBox}>
              <div className="quantity-field">
                <label htmlFor="quantidade">Quantidade</label>
                <div className="stepper stepper-lg" role="group" aria-label="Quantidade">
                  <button type="button" data-qty="-1" aria-label="Diminuir quantidade" disabled={Number(qty) <= 1} onClick={() => step(-1)}>
                    <Icon name="minus" size={18} />
                  </button>
                  <input
                    id="quantidade"
                    name="quantidade"
                    type="number"
                    value={qty}
                    min="1"
                    max={qtyMax}
                    inputMode="numeric"
                    required
                    aria-describedby={quantity.error ? quantity.hintId : undefined}
                    {...quantity.props}
                    onChange={(e) => setQty(e.target.value)}
                  />
                  <button type="button" data-qty="1" aria-label="Aumentar quantidade" disabled={Number(qty) >= max} onClick={() => step(1)}>
                    <Icon name="plus" size={18} />
                  </button>
                </div>
                {quantity.error && (
                  <p className="field-error" id={quantity.hintId}>
                    {quantity.error}
                  </p>
                )}
              </div>
              <div className="buy-actions">
                <button type="submit" disabled={soldOutColor}>
                  <Icon name="bag" size={18} />
                  Adicionar ao carrinho
                </button>
                <button
                  type="button"
                  className="secondary"
                  data-buy-now=""
                  disabled={soldOutColor}
                  onClick={() => {
                    if (!quantity.validate()) return;
                    if (addCart(p, Number(qty), { notify: false, cor: cor || undefined })) location.href = "/checkout.html";
                  }}
                >
                  Comprar agora
                </button>
              </div>
            </form>
          ) : (
            <div className="buy-box buy-box-out" ref={setBuyBox}>
              <AlertButton product={p} />
              <p className="small muted">Sem estoque agora. Ative o aviso e acompanhe em Minha conta.</p>
            </div>
          )}
          <p className="cart-feedback" role="status">
            {feedback}
          </p>
          <ul className="perk-list delivery-list">
            {Object.entries(delivery).map(([key, d]) => (
              <li key={key}>
                <Icon name={key === "retirada" ? "store" : "truck"} size={18} />
                <span>
                  <strong>{d.label}</strong>
                  <small>{d.prazo}</small>
                </span>
                <span className="option-price">{deliveryPrice(key)}</span>
              </li>
            ))}
            <li>
              <Icon name="refresh" size={18} />
              <span>
                <strong>Troca em até 7 dias</strong>
                <small>Após o recebimento</small>
              </span>
            </li>
            {services.length > 0 && (
              <li>
                <Icon name="wrench" size={18} />
                <span>
                  <strong>{serviceSummary(p)}</strong>
                  <small>A partir de {money(Math.min(...services.map((x) => x.priceCents)))}, escolha no carrinho</small>
                </span>
              </li>
            )}
          </ul>
          <p className="small muted">Frete grátis na entrega padrão para compras a partir de {money(FREE_SHIPPING_CENTS)}.</p>
          <div className="detail-actions">
            <button type="button" className="text-button" data-share="" onClick={() => share(name)}>
              <Icon name="share" size={18} />
              Compartilhar
            </button>
            <CompareButton product={p} className="text-button compare-toggle" />
            <PriceAlertButton product={p} />
            <a className="text-link" href={`/catalogo.html?categoria=${encodeURIComponent(p.categoria)}`}>
              Mais {p.categoria.toLowerCase()} <Icon name="arrowRight" size={16} />
            </a>
          </div>
          <section className="product-specs">
            <h2>Sobre este equipamento</h2>
            <dl>
              <div>
                <dt>Marca</dt>
                <dd>{p.marca}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{p.modelo}</dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>{p.categoria}</dd>
              </div>
              <Specs p={p} />
              <div>
                <dt>Código</dt>
                <dd>{p.id}</dd>
              </div>
            </dl>
          </section>
        </section>
      </div>
    </Frame>
  );
}

function StickyBuy({ p, image, visible, disabled, cor }: { p: Product; image: string; visible: boolean; disabled: boolean; cor: string | null }) {
  const img = useRef<HTMLImageElement>(null);
  return (
    <aside className={`sticky-buy${visible ? " is-visible" : ""}`} id="sticky-buy" aria-label="Compra rápida">
      <img ref={img} src={image} alt="" width={44} height={44} />
      <span>
        <strong>{p.modelo}</strong>
        <small>{p.estoque ? money(p.priceCents) : "Esgotado"}</small>
      </span>
      {p.estoque ? (
        <button type="button" data-bar-add="" disabled={disabled} onClick={() => addCart(p, 1, { source: img.current, cor: cor || undefined })}>
          <Icon name="bag" size={18} />
          Adicionar
        </button>
      ) : (
        <AlertButton product={p} short className="" />
      )}
    </aside>
  );
}

// Moldura da página: trilha, detalhe (carregando, erro ou produto), seções e barra de compra.
function Frame({ p, crumb, extras, sticky, children }: { p: Product | null; crumb: string; extras: Extras | null; sticky: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="container page-wrap">
        <nav className="breadcrumb" aria-label="Trilha de navegação">
          <a href="/">Início</a>
          <span aria-hidden="true">/</span>
          <a href="/catalogo.html">Catálogo</a>
          <span aria-hidden="true">/</span>
          <span id="crumb-category">{p && <a href={`/catalogo.html?categoria=${encodeURIComponent(p.categoria)}`}>{p.categoria}</a>}</span>
          <span aria-hidden="true">/</span>
          <span id="crumb-current" aria-current="page">
            {crumb}
          </span>
        </nav>
        {children}
        <section className="section-tight" id="bundle" aria-labelledby="bundle-title" hidden={!p || !extras?.picks.length}>
          {p && extras && extras.picks.length > 0 && <Bundle key={p.id} product={p} picks={extras.picks} />}
        </section>
        {p ? <Questions product={p} /> : <section className="section-tight qa-section" id="perguntas" aria-labelledby="qa-title" hidden />}
        <section className="section-tight" id="related" aria-labelledby="related-title" hidden={!extras?.related.length}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Você também pode gostar</span>
              <h2 id="related-title">Combina com o seu setup</h2>
            </div>
          </div>
          <div className="product-grid product-grid-wide">
            {extras?.related.map((x, i) => (
              <ProductCard key={x.id} product={x} index={i} />
            ))}
          </div>
        </section>
        <Recent products={extras?.recent ?? []} />
      </div>
      {sticky}
    </>
  );
}

export default function ProductPage() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [extras, setExtras] = useState<Extras | null>(null);
  const fetchProduct = useCallback(() => {
    setLoad({ status: "loading" });
    const id = new URLSearchParams(location.search).get("id") || "";
    (api(`/products/${encodeURIComponent(id)}`) as Promise<Detail>).then(
      (product) => setLoad({ status: "ready", product }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(fetchProduct, [fetchProduct]);

  const p = load.status === "ready" ? load.product : null;
  useEffect(() => {
    if (!p) return;
    const name = `${p.marca} ${p.modelo}`;
    document.title = `${name} | Violet Voltage`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", `${name}: ${p.descricao}`.slice(0, 160));
    pushRecent(p.id);
    structuredData(p, name);
    let alive = true;
    (catalogProducts() as Promise<Product[]>).then(
      (products) => {
        if (!alive) return;
        const others = products.filter((x) => x.id !== p.id && x.estoque > 0);
        const related = [
          ...others
            .filter((x) => x.categoria === p.categoria)
            .sort((a, b) => affinity(p, b) - affinity(p, a) || Math.abs(a.priceCents - p.priceCents) - Math.abs(b.priceCents - p.priceCents)),
          ...others.filter((x) => x.categoria !== p.categoria).sort((a, b) => a.priceCents - b.priceCents),
        ].slice(0, 4);
        const recent = (getRecent() as string[])
          .filter((id) => id !== p.id)
          .map((id) => products.find((x) => x.id === id))
          .filter((x): x is Product => Boolean(x))
          .slice(0, 8);
        setExtras({ picks: p.estoque ? bundlePicks(p, others) : [], related, recent });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [p]);

  if (p) return <Ready p={p} extras={extras} />;
  const missing = load.status === "error" && load.error.status === 404;
  return (
    <Frame p={null} crumb={missing ? "Produto não encontrado" : "Produto"} extras={null} sticky={<aside className="sticky-buy" id="sticky-buy" aria-label="Compra rápida" />}>
      {load.status === "error" ? (
        <div id="product-detail" className="state-wrap">
          <State
            tone="error"
            level={1}
            title={missing ? "Produto não encontrado." : "Não foi possível carregar este produto."}
            text={missing ? "O endereço pode estar incompleto ou o item saiu do catálogo. Que tal explorar os equipamentos disponíveis?" : load.error.message}
            actions={
              <>
                {!missing && (
                  <button type="button" onClick={fetchProduct}>
                    Tentar novamente
                  </button>
                )}
                <a className="button secondary" href="/catalogo.html">
                  Voltar ao catálogo
                </a>
              </>
            }
          />
        </div>
      ) : (
        <div id="product-detail" className="detail-grid detail-loading" aria-busy="true">
          <div className="detail-media skeleton" />
          <div className="detail-info">
            <span className="sk-line w40" />
            <span className="sk-line w80 tall" />
            <span className="sk-line w50" />
            <span className="sk-block" />
          </div>
        </div>
      )}
    </Frame>
  );
}
