// Carrinho: itens (quantidade, cor, serviços, salvar para depois), o que falta para o equipamento
// funcionar, frete pelo CEP, cupom e totais calculados pelo servidor. Acompanha o minicarrinho e
// o carrinho salvo na conta (evento "vv:cart").
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../lib/icons";
import { addCart, catalogProducts, getCart, getWishlist, money, productImage, setCart, toast, type Product } from "../lib/shop";
import { colorNames, itemColor, itemImage } from "../../../shared/catalog.js";
import { setWishlist } from "../lib/cart";
import { cartData, fetchQuote, prefs, servicesTotal, subtotal } from "../lib/checkout";
import { cartAdvice } from "../../../shared/compat.js";
import { kitPrice, kitProgress } from "../../../shared/kits.js";
import { SERVICES, servicesFor } from "../../../shared/services.js";
import { cepDigits, formatCep } from "../../../shared/regions.js";
import { CouponApplied, FreeShipping, Totals, type Quote } from "../components/Commerce";
import { LoadError } from "../components/Private";
import { installmentText, ProductCard } from "../components/ProductCard";
import { State } from "../components/State";

export type CartLine = { id: string; quantidade: number; cor?: string; servicos?: string[]; product?: Product };
type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; items: CartLine[]; products: Product[] };
type Service = { id: string; nome: string; texto: string; priceCents: number };
type Advice = { nivel: "essencial" | "aviso" | "dica"; titulo: string; texto: string; sugestao?: string };
type Kit = { id: string; nome: string; descontoPct: number };

const saveError = () => toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });

function ItemServices({ item, onToggle }: { item: CartLine; onToggle: (service: string, checked: boolean) => void }) {
  const options = servicesFor(item.product) as Service[];
  const chosen = new Set(item.servicos || []);
  // Abre já expandido quando há serviço escolhido; depois, quem abre e fecha é a pessoa.
  const [initiallyOpen] = useState(chosen.size > 0);
  if (!options.length) return null;
  return (
    <details className="item-services" open={initiallyOpen}>
      <summary>
        <Icon name="wrench" size={16} />
        Serviços da loja{chosen.size > 0 && <> <span className="chip-count">{chosen.size}</span></>}
      </summary>
      <ul>
        {options.map((s) => (
          <li key={s.id}>
            <label className="check">
              <input type="checkbox" data-service={s.id} data-id={item.id} checked={chosen.has(s.id)} onChange={(e) => onToggle(s.id, e.currentTarget.checked)} />
              <span>
                <strong>{s.nome}</strong>{" "}
                <span className="service-price">
                  + {money(s.priceCents)}
                  {item.quantidade > 1 ? " cada" : ""}
                </span>
                <small>{s.texto}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AdvicePanel({ items, products, onAdd }: { items: CartLine[]; products: Product[]; onAdd: (p: Product) => void }) {
  const lines = items.filter((i) => i.product);
  const advice = cartAdvice(lines, products) as Advice[];
  const byId = new Map(products.map((p) => [p.id, p]));
  const progress = (kitProgress(lines.map((i) => i.id)) as { kit: Kit; faltam: string[] }[])
    .map(({ kit, faltam }) => ({ kit, faltam: faltam.map((id) => byId.get(id)), price: kitPrice(kit, products) as { descontoCents: number } | null }))
    .filter(({ faltam, price }) => price && faltam.every((p) => (p?.estoque ?? 0) > 0));
  if (!advice.length && !progress.length) return null;
  const tone: Record<Advice["nivel"], IconName> = { essencial: "alert", aviso: "info", dica: "sparkle" };
  const suggestion = (p: Product | undefined) =>
    p && (
      <div className="advice-pick" key={p.id}>
        <img src={productImage(p)} alt="" width={48} height={48} loading="lazy" />
        <a href={`/produto.html?id=${encodeURIComponent(p.id)}`}>
          {p.marca} {p.modelo}
        </a>
        <strong>{money(p.priceCents)}</strong>
        <button type="button" className="secondary small-button" data-advice-add={p.id} aria-label={`Adicionar ${p.marca} ${p.modelo} ao carrinho`} onClick={() => onAdd(p)}>
          <Icon name="plus" size={16} />
          Adicionar
        </button>
      </div>
    );
  return (
    <section className="panel advice-panel" aria-labelledby="advice-title">
      <h2 id="advice-title">
        <Icon name="plug" size={20} />
        Antes de fechar o pedido
      </h2>
      <ul className="advice-list">
        {progress.map(({ kit, faltam, price }) => (
          <li className="advice advice-kit" key={kit.id}>
            <span className="advice-icon">
              <Icon name="gift" size={18} />
            </span>
            <div>
              <strong>
                Falta{faltam.length > 1 ? "m" : ""} {faltam.length} {faltam.length === 1 ? "item" : "itens"} para completar o {kit.nome}
              </strong>
              <p>
                Com o kit completo você ganha {kit.descontoPct}% de desconto ({money(price!.descontoCents)}) automaticamente.
              </p>
              {faltam.map(suggestion)}
            </div>
          </li>
        ))}
        {advice.map((a, index) => (
          <li className={`advice advice-${a.nivel}`} key={`${a.titulo}-${index}`}>
            <span className="advice-icon">
              <Icon name={tone[a.nivel]} size={18} />
            </span>
            <div>
              <strong>{a.titulo}</strong>
              <p>{a.texto}</p>
              {suggestion(a.sugestao ? byId.get(a.sugestao) : undefined)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Resumo: CEP, opções de entrega, cupom e totais (recalculados a cada mudança do carrinho).
function Summary({ items }: { items: CartLine[] }) {
  const [delivery, setDelivery] = useState(() => prefs.delivery as string);
  const [coupon, setCoupon] = useState(() => prefs.coupon as string);
  const [cep, setCep] = useState(() => prefs.cep as string);
  const [cepInput, setCepInput] = useState(() => formatCep(prefs.cep) as string);
  const [couponError, setCouponError] = useState("");
  const [cepError, setCepError] = useState("");
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);
  const request = useRef(0);
  const aside = useRef<HTMLElement>(null);
  const focusCep = useRef(false);
  const invalid = items.some((i) => !i.product || i.quantidade > i.product.estoque);

  useEffect(() => {
    const id = ++request.current;
    (async () => {
      let next: Quote | null = null;
      if (!invalid) {
        try {
          next = (await fetchQuote(delivery, coupon, cep)) as Quote;
        } catch (e) {
          const error = e as Error & { field?: string };
          if (error.field === "cupom" && coupon) {
            if (id !== request.current) return;
            setCouponError(error.message);
            prefs.coupon = "";
            setCoupon("");
            return;
          } else if (error.field === "entrega") {
            prefs.delivery = "padrao";
            if (id === request.current) setDelivery("padrao");
          }
        }
      }
      if (id !== request.current) return;
      setQuote(next);
      if (focusCep.current) {
        focusCep.current = false;
        aside.current?.querySelector<HTMLInputElement>("#cart-cep")?.focus();
      }
    })();
  }, [items, invalid, delivery, coupon, cep, nonce]);

  const base: Quote = {
    subtotalCents: subtotal(items),
    servicosCents: servicesTotal(items),
    freteCents: 0,
    descontoCents: 0,
    totalCents: subtotal(items) + servicesTotal(items),
  };
  const onCep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = cepInput;
    if (value.trim() && !cepDigits(value)) setCepError("Informe os 8 dígitos do CEP, como 01310-100.");
    else {
      setCepError("");
      prefs.cep = value;
      setCep(prefs.cep);
      setCepInput(formatCep(prefs.cep));
    }
    focusCep.current = true;
    setNonce((n) => n + 1);
  };
  const onCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("cupom") as HTMLInputElement | null;
    const value = field?.value.trim();
    if (!value) return;
    const code = value.toUpperCase();
    setCouponError("");
    try {
      const applied = (await fetchQuote(delivery, code, cep)) as Quote;
      prefs.coupon = code;
      setCoupon(code);
      toast(`Cupom ${applied.cupom!.codigo} aplicado.`, { type: "success" });
    } catch (error) {
      setCouponError((error as Error).message);
      setCoupon("");
      setNonce((n) => n + 1);
    }
  };
  if (quote === undefined)
    return (
      <aside className="panel summary-panel" aria-live="polite" ref={aside}>
        <div className="loading" role="status">
          Calculando…
        </div>
      </aside>
    );
  const options = quote?.entregas || [];
  return (
    <aside className="panel summary-panel" aria-live="polite" ref={aside}>
      <h2>Resumo do pedido</h2>
      <form className="cep-form" noValidate onSubmit={onCep}>
        <label htmlFor="cart-cep">Calcular frete pelo CEP</label>
        <div className="coupon-row">
          <input
            id="cart-cep"
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            placeholder="00000-000"
            value={cepInput}
            onChange={(e) => setCepInput(e.currentTarget.value)}
            aria-invalid={cepError ? true : undefined}
            aria-describedby={cepError ? "cep-error" : undefined}
          />
          <button type="submit" className="secondary">
            Calcular
          </button>
        </div>
        {cepError ? (
          <p className="field-error" id="cep-error" role="alert">
            {cepError}
          </p>
        ) : quote?.regiao ? (
          <p className="form-help">Entrega para {quote.regiao.nome}.</p>
        ) : (
          <p className="form-help">Sem CEP, mostramos o frete para o estado de São Paulo.</p>
        )}
      </form>
      {options.length > 0 && (
        <fieldset className="ship-estimate">
          <legend>Entrega</legend>
          {options.map((o) => (
            <label className="option-line" key={o.id}>
              <input
                type="radio"
                name="estimate"
                value={o.id}
                checked={o.id === delivery}
                onChange={() => {
                  prefs.delivery = o.id;
                  setDelivery(o.id);
                  setCouponError("");
                }}
              />
              <span>
                <strong>{o.label}</strong>
                <small>{o.prazo}</small>
              </span>
              <span className="option-price">{o.priceCents ? money(o.priceCents) : "Grátis"}</span>
            </label>
          ))}
        </fieldset>
      )}
      <form className="coupon-form" noValidate onSubmit={onCoupon}>
        <label htmlFor="cart-coupon">Cupom de desconto</label>
        {quote?.cupom ? (
          <CouponApplied
            cupom={quote.cupom}
            onRemove={() => {
              prefs.coupon = "";
              setCoupon("");
            }}
          />
        ) : (
          <>
            <div className="coupon-row">
              <input
                id="cart-coupon"
                name="cupom"
                maxLength={30}
                autoComplete="off"
                placeholder="Ex.: VOLTAGE10"
                defaultValue=""
                aria-invalid={couponError ? true : undefined}
                aria-describedby={couponError ? "coupon-error" : undefined}
              />
              <button type="submit" className="secondary">
                Aplicar
              </button>
            </div>
            {couponError && (
              <p className="field-error" id="coupon-error" role="alert">
                {couponError}
              </p>
            )}
          </>
        )}
      </form>
      <div className="totals">
        <Totals quote={quote || base} />
      </div>
      {invalid && <p className="field-error">Ajuste os itens indisponíveis para continuar.</p>}
      <a
        className="button full"
        href="/checkout.html"
        aria-disabled={invalid ? true : undefined}
        onClick={(e) => {
          if (!invalid) return;
          e.preventDefault();
          toast("Ajuste os itens indisponíveis primeiro.", { type: "error" });
        }}
      >
        Finalizar compra <Icon name="arrowRight" size={18} />
      </a>
      <a className="button secondary full" href="/catalogo.html">
        Continuar comprando
      </a>
      <p className="secure-note">
        <Icon name="shield" size={16} />
        Preços, estoque e descontos são conferidos novamente ao confirmar.
      </p>
    </aside>
  );
}

function CartItem({ item, onChange, reload }: { item: CartLine; onChange: (next: CartLine[] | null, message?: string, extra?: () => void) => void; reload: () => void }) {
  const p = item.product;
  const name = p ? `${p.marca} ${p.modelo}` : "Produto removido ou indisponível";
  const max = Math.min(99, p?.estoque || 0);
  const problem = !p ? "Este produto não está mais disponível." : item.quantidade > p.estoque ? `Restam ${p.estoque} em estoque; ajuste a quantidade.` : "";
  const colors = p ? (colorNames(p) as string[]) : [];
  const parcel = p ? installmentText(p.priceCents) : "";
  const step = (delta: number) => {
    const cart = getCart() as CartLine[];
    const line = cart.find((i) => i.id === item.id);
    if (!line) return reload();
    line.quantidade = Math.max(1, line.quantidade + delta);
    onChange(cart);
  };
  // Mudança só no armazenamento (cor e serviços): a lista local acompanha sem recarregar.
  const update = (change: (line: CartLine) => void, done: (cart: CartLine[]) => void) => {
    const cart = getCart() as CartLine[];
    const line = cart.find((x) => x.id === item.id);
    if (!line) return reload();
    change(line);
    try {
      setCart(cart);
    } catch {
      saveError();
      return;
    }
    done(cart);
  };
  return (
    <article className="cart-item">
      <img src={p ? itemImage(p, item.cor) : productImage(p)} alt="" width={96} height={96} />
      <div className="cart-item-info">
        <h3>{p ? <a href={`/produto.html?id=${encodeURIComponent(p.id)}`}>{name}</a> : name}</h3>
        {p && colors.length > 1 && (
          <label className="cart-color">
            <span>Cor</span>
            <select
              data-color-item={item.id}
              aria-label={`Cor de ${p.marca} ${p.modelo}`}
              value={itemColor(p, item.cor) as string}
              onChange={(e) => {
                const cor = e.currentTarget.value;
                update(
                  (line) => (line.cor = cor),
                  () => {
                    onChange(null);
                    toast(`Cor alterada para ${cor}.`, { type: "success" });
                  },
                );
              }}
            >
              {colors.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <span className="small muted">
          {money(p?.priceCents || 0)} cada{parcel ? ` · ${parcel}` : ""}
        </span>
        {problem && <p className="field-error">{problem}</p>}
        <div className="cart-actions">
          <div className="stepper" role="group" aria-label={`Quantidade de ${name}`}>
            <button type="button" data-step="-1" data-id={item.id} aria-label="Diminuir quantidade" disabled={item.quantidade <= 1} onClick={() => step(-1)}>
              <Icon name="minus" size={16} />
            </button>
            <output aria-live="polite">{item.quantidade}</output>
            <button type="button" data-step="1" data-id={item.id} data-max={max} aria-label="Aumentar quantidade" disabled={item.quantidade >= max} onClick={() => step(1)}>
              <Icon name="plus" size={16} />
            </button>
          </div>
          {p && (
            <button
              type="button"
              className="text-button"
              data-later={item.id}
              onClick={() =>
                onChange(
                  (getCart() as CartLine[]).filter((i) => i.id !== item.id),
                  "Item movido para os favoritos.",
                  () => {
                    const wishes = getWishlist() as string[];
                    if (!wishes.includes(item.id)) setWishlist([item.id, ...wishes]);
                  },
                )
              }
            >
              <Icon name="heart" size={16} />
              Salvar para depois
            </button>
          )}
          <button
            type="button"
            className="text-button"
            data-remove-item={item.id}
            onClick={() => onChange((getCart() as CartLine[]).filter((i) => i.id !== item.id), "Item removido do carrinho.")}
          >
            <Icon name="trash" size={16} />
            Remover
          </button>
        </div>
        {p && (
          <ItemServices
            item={item}
            onToggle={(service, checked) =>
              update(
                (line) => {
                  const set = new Set(line.servicos || []);
                  if (checked) set.add(service);
                  else set.delete(service);
                  line.servicos = [...set];
                },
                () => {
                  onChange(null);
                  toast(`${(SERVICES as Record<string, { nome: string }>)[service].nome} ${checked ? "incluída" : "removida"}.`, { type: "success" });
                },
              )
            }
          />
        )}
      </div>
      <strong className="price">{money((p?.priceCents || 0) * item.quantidade)}</strong>
    </article>
  );
}

export default function Cart() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const container = useRef<HTMLDivElement>(null);
  const focusCount = useRef(false);

  const reload = useCallback(async () => {
    try {
      const items = (await cartData()) as CartLine[];
      const products = (await catalogProducts()) as Product[];
      setLoad({ status: "ready", items, products });
    } catch (error) {
      setLoad({ status: "error", error: error as Error });
    }
  }, []);

  useEffect(() => {
    reload();
    // Outras abas, o minicarrinho e o carrinho da conta mudam o carrinho: a página acompanha
    // (exceto quando a mudança veio de um controle desta própria lista, que já se atualiza).
    const onCart = () => {
      if (!container.current?.contains(document.activeElement)) reload();
    };
    document.addEventListener("vv:cart", onCart);
    document.addEventListener("vv:cart-added", reload);
    return () => {
      document.removeEventListener("vv:cart", onCart);
      document.removeEventListener("vv:cart-added", reload);
    };
  }, [reload]);

  useEffect(() => {
    if (load.status === "ready" && focusCount.current) {
      focusCount.current = false;
      container.current?.querySelector<HTMLElement>(".cart-count")?.focus();
    }
  }, [load]);

  // Salva o carrinho (com "Desfazer" quando há mensagem) e recarrega a lista.
  const save = (items: CartLine[] | null, message?: string, extra?: () => void) => {
    if (!items) {
      // Cor ou serviço: o armazenamento já mudou; atualiza a lista local.
      const stored = getCart() as CartLine[];
      setLoad((current) =>
        current.status === "ready"
          ? { ...current, items: current.items.map((i) => ({ ...i, ...stored.find((s) => s.id === i.id), product: i.product })) }
          : current,
      );
      return;
    }
    const previous = getCart() as CartLine[];
    const previousWishes = getWishlist() as string[];
    try {
      setCart(items);
      extra?.();
    } catch {
      toast("Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador.", { type: "error" });
      return;
    }
    if (message)
      toast(message, {
        type: "info",
        action: {
          label: "Desfazer",
          onClick: () => {
            setCart(previous);
            setWishlist(previousWishes);
            reload();
          },
        },
      });
    reload();
  };

  let content;
  if (load.status === "loading")
    content = (
      <div id="cart-content" className="loading" ref={container}>
        Carregando carrinho…
      </div>
    );
  else if (load.status === "error")
    content = (
      <div id="cart-content" ref={container}>
        <LoadError error={load.error} retry={reload} back={{ href: "/catalogo.html", label: "Voltar ao catálogo" }} />
      </div>
    );
  else if (!load.items.length)
    content = (
      <div id="cart-content" ref={container}>
        <State
          symbol="bag"
          title="Seu carrinho está esperando o primeiro acorde."
          text="Explore o catálogo e monte o seu próximo setup."
          actions={
            <>
              <a className="button" href="/catalogo.html">
                Explorar catálogo
              </a>
              <a className="button secondary" href="/favoritos.html">
                Ver favoritos
              </a>
            </>
          }
        />
      </div>
    );
  else {
    const { items, products } = load;
    const count = items.reduce((s, i) => s + i.quantidade, 0);
    const categoriesInCart = new Set(items.map((i) => i.product?.categoria));
    // Itens já sugeridos no painel "Antes de fechar o pedido" não se repetem aqui.
    const advised = new Set((cartAdvice(items.filter((i) => i.product), products) as Advice[]).map((a) => a.sugestao));
    const suggestions = products
      .filter((p) => p.estoque > 0 && !categoriesInCart.has(p.categoria) && !items.some((i) => i.id === p.id) && !advised.has(p.id))
      .sort((a, b) => a.priceCents - b.priceCents)
      .slice(0, 4);
    content = (
      <div id="cart-content" ref={container}>
        <div className="cart-layout">
          <div className="cart-main">
            <div className="panel ship-panel">
              <FreeShipping subtotalCents={subtotal(items)} />
            </div>
            <section className="panel cart-list" aria-label="Itens do carrinho">
              <h2 className="cart-count" tabIndex={-1}>
                {count} {count === 1 ? "item" : "itens"}
              </h2>
              {items.map((i) => (
                <CartItem key={i.id} item={i} onChange={save} reload={reload} />
              ))}
            </section>
            <AdvicePanel
              items={items}
              products={products}
              onAdd={(product) => {
                if (!addCart(product, 1, { notify: false })) return;
                toast(`${product.marca} ${product.modelo} adicionado ao carrinho.`, { type: "success" });
                focusCount.current = true;
                reload();
              }}
            />
          </div>
          <Summary items={items} />
        </div>
        {suggestions.length > 0 && (
          <section className="cart-suggestions" aria-labelledby="suggestions-title">
            <h2 id="suggestions-title">Complete seu setup</h2>
            <div className="product-grid product-grid-wide">
              {suggestions.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="container page-wrap">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Carrinho</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Carrinho</span>
          <h1 className="page-title">Seu próximo setup.</h1>
          <p className="lead">Confira os equipamentos que vão acompanhar o seu som.</p>
        </div>
      </header>
      {content}
    </div>
  );
}
