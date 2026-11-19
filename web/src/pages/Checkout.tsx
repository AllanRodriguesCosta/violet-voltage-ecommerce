// Checkout: entrega (endereços salvos, outro endereço ou retirada), pagamento, cupom e resumo
// calculado pelo servidor; ao confirmar, o pedido é criado e o carrinho esvaziado.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon, type IconName } from "../lib/icons";
import { getCart, installmentValue, money, productImage, send, setCart, toast, type Product } from "../lib/shop";
import { itemImage } from "../../../shared/catalog.js";
import { cartData, fetchQuote, prefs } from "../lib/checkout";
import { formatAddress } from "../../../shared/address.js";
import { cepDigits, cepFromText } from "../../../shared/regions.js";
import { CouponApplied, Totals, type Quote } from "../components/Commerce";
import { Form, useFieldA11y, FieldError, SubmitButton } from "../components/Form";
import { LoadError, Private, type AccountUser } from "../components/Private";
import { State } from "../components/State";
import type { CartLine } from "./Cart";

const payments: [string, IconName, string, string][] = [
  ["pix", "pix", "Pix", "Aprovação imediata após o pagamento"],
  ["cartao", "card", "Cartão de crédito", "Em até 10x sem juros"],
  ["boleto", "barcode", "Boleto", "Compensação em até 2 dias úteis"],
];
const paymentLabel: Record<string, string> = { pix: "Pix", cartao: "Cartão de crédito", boleto: "Boleto" };
type Choice = { id: string; title: string; text: string; main?: boolean; cep?: string | null };
type Order = { id: string; entrega: string; pagamento: string; parcelas?: number; totalCents: number; descontoKitsCents?: number; descontoCents?: number };
// O CEP nulo (retirada) não pode virar o CEP salvo: por isso o tipo aceita null.
const quoteFor = fetchQuote as (entrega: string, cupom: string, cep: string | null) => Promise<Quote>;
type Sel = { entrega: string; endereco: string; typed: string; cupom: string };

function Steps({ done }: { done: boolean }) {
  return (
    <ol className="steps" aria-label="Etapas da compra">
      <li className="done">
        <span>1</span>Carrinho
      </li>
      <li className={done ? "done" : "current"} aria-current={done ? undefined : "step"}>
        <span>2</span>Entrega e pagamento
      </li>
      <li className={done ? "current" : undefined}>
        <span>3</span>Confirmação
      </li>
    </ol>
  );
}

function Shell({ done = false, children }: { done?: boolean; children: ReactNode }) {
  return (
    <div className="container page-wrap">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <a href="/carrinho.html">Carrinho</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Checkout</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Checkout</span>
          <h1 className="page-title">Quase pronto para tocar.</h1>
        </div>
      </header>
      <Steps done={done} />
      <div id="checkout-content">{children}</div>
    </div>
  );
}

function Confirmation({ order, quote, user, cartCleared }: { order: Order; quote: Quote; user: AccountUser; cartCleared: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    scrollTo({ top: 0 });
  }, []);
  const option = quote.entregas?.find((o) => o.id === order.entrega);
  const parcel = order.pagamento === "cartao" && (order.parcelas || 1) > 1 ? ` em ${order.parcelas}x de ${money(installmentValue(order.totalCents, order.parcelas!))}` : "";
  const saved = (order.descontoKitsCents || 0) + (order.descontoCents || 0);
  return (
    <div className="panel confirmation" role="status" tabIndex={-1} ref={ref}>
      <svg className="check-anim" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="m15 27 7 7 15-15" />
      </svg>
      <span className="eyebrow">Pedido confirmado</span>
      <h2>Obrigado, {user.nome.split(" ")[0]}! Seu pedido foi registrado.</h2>
      <p className="lead">Acompanhe cada etapa em Minha conta.</p>
      <dl className="confirmation-facts">
        <div>
          <dt>Pedido</dt>
          <dd>#{order.id.slice(0, 8).toUpperCase()}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{money(order.totalCents)}</dd>
        </div>
        {saved > 0 && (
          <div>
            <dt>Você economizou</dt>
            <dd>{money(saved)}</dd>
          </div>
        )}
        <div>
          <dt>Pagamento</dt>
          <dd>
            {paymentLabel[order.pagamento]}
            {parcel}
          </dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>
            {option?.label || order.entrega} · {option?.prazo || ""}
          </dd>
        </div>
      </dl>
      <p className="small muted">Número completo: {order.id}</p>
      {!cartCleared && <p className="error">O pedido foi registrado, mas o navegador não conseguiu limpar o carrinho. Não repita a compra; confira seu histórico.</p>}
      <div className="row center">
        <a href={`/pedido.html?id=${encodeURIComponent(order.id)}`} className="button">
          Ver comprovante
        </a>
        <a href="/minha-conta.html#pedidos" className="button secondary">
          Acompanhar pedido
        </a>
        <a href="/catalogo.html" className="button secondary">
          Continuar comprando
        </a>
      </div>
    </div>
  );
}

function AddressInput({ required, value, onChange, inputRef }: { required: boolean; value: string; onChange: (v: string) => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const a11y = useFieldA11y("endereco", "address-help");
  return (
    <>
      <input
        id="endereco"
        name="endereco"
        type="text"
        required={required}
        minLength={5}
        maxLength={500}
        autoComplete="street-address"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        {...a11y}
      />
      <FieldError name="endereco" />
    </>
  );
}

function CheckoutForm({ user, onPlaced }: { user: AccountUser; onPlaced: () => void }) {
  // Forma de pagamento preferida da conta (Minha conta > Métodos de pagamento) vem marcada.
  const preferred = user.pagamento && ["pix", "cartao", "boleto"].includes(user.pagamento.metodo) ? user.pagamento : null;
  const [items, setItems] = useState<CartLine[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [fatal, setFatal] = useState<Error | null>(null);
  const [sel, setSel] = useState<Sel>(() => ({ entrega: prefs.delivery, endereco: "novo", typed: "", cupom: prefs.coupon }));
  const [pagamento, setPagamento] = useState(preferred?.metodo || "pix");
  const [parcelasPick, setParcelas] = useState(preferred?.metodo === "cartao" ? preferred.parcelas || 1 : 1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponError, setCouponError] = useState("");
  const [quoting, setQuoting] = useState(true);
  const [done, setDone] = useState<{ order: Order; cartCleared: boolean } | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const request = useRef(0);
  const address = useRef<HTMLInputElement>(null);
  const couponInput = useRef<HTMLInputElement>(null);
  const typedCep = useRef<string | null>(null);
  const focusAddress = useRef(false);

  // Endereços salvos (principal primeiro), o do cadastro e a opção de digitar outro.
  const saved = user.enderecos || [];
  const legacy = (user.endereco || "").trim();
  const choices: Choice[] = [
    ...saved.map((a) => ({ id: a.id, title: a.apelido || "Endereço", text: formatAddress(a) as string, main: a.principal, cep: cepDigits(a.cep) as string | null })),
    ...(legacy && !saved.some((a) => formatAddress(a) === legacy) ? [{ id: "cadastro", title: "Endereço do cadastro", text: legacy, cep: cepFromText(legacy) as string | null }] : []),
  ];
  // Etapa 34: o frete segue a região do CEP do endereço escolhido (ou digitado).
  const cepOf = (s: Sel): string | null =>
    s.entrega === "retirada" ? null : s.endereco === "novo" ? cepFromText(s.typed) || prefs.cep : choices.find((c) => c.id === s.endereco)?.cep || prefs.cep;

  async function refresh(s: Sel, coupon?: string) {
    const id = ++request.current;
    setQuoting(true);
    const tryCoupon = coupon === undefined ? s.cupom : coupon;
    try {
      const q = await quoteFor(s.entrega, tryCoupon, cepOf(s));
      if (id !== request.current) return;
      const cupom = q.cupom?.codigo || "";
      prefs.coupon = cupom;
      setSel((current) => ({ ...current, cupom }));
      setQuote(q);
      setCouponError("");
      if (coupon) toast(`Cupom ${cupom} aplicado.`, { type: "success" });
    } catch (e) {
      const error = e as Error & { field?: string };
      if (id !== request.current) return;
      if (error.field !== "cupom") return setFatal(error);
      const cupom = coupon ? s.cupom : "";
      if (!coupon) prefs.coupon = "";
      try {
        const q = await quoteFor(s.entrega, cupom, cepOf(s));
        if (id !== request.current) return;
        setSel((current) => ({ ...current, cupom }));
        setQuote(q);
        setCouponError(error.message);
      } catch (again) {
        return setFatal(again as Error);
      }
    }
    setQuoting(false);
  }

  useEffect(() => {
    let alive = true;
    (cartData() as Promise<CartLine[]>).then(
      (list) => {
        if (!alive) return;
        setItems(list);
        const first = { ...sel, endereco: choices[0]?.id || "novo" };
        setSel(first);
        if (list.length && !list.some((i) => !i.product || i.quantidade > i.product.estoque)) refresh(first);
      },
      (error: Error) => alive && setLoadError(error),
    );
    return () => {
      alive = false;
    };
    // Carrega uma vez, com a sessão e as preferências do momento.
  }, []);
  useEffect(() => {
    if (focusAddress.current) {
      focusAddress.current = false;
      address.current?.focus();
    }
  }, [sel.endereco]);
  // Endereço digitado: assim que o CEP fica completo, recalcula o frete (durante a digitação, e
  // não ao sair do campo, para não desabilitar o botão no mesmo clique que confirma o pedido).
  useEffect(() => {
    if (!items) return;
    const timer = setTimeout(() => {
      const cep = cepFromText(sel.typed);
      if (cep && cep !== typedCep.current) {
        typedCep.current = cep;
        refresh(sel);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [sel.typed]);

  if (loadError) return <LoadError error={loadError} retry={() => location.reload()} back={{ href: "/carrinho.html", label: "Voltar ao carrinho" }} />;
  if (fatal) return <LoadError error={fatal} retry={() => location.reload()} back={{ href: "/carrinho.html", label: "Voltar ao carrinho" }} />;
  if (done && quote) return <Confirmation order={done.order} quote={quote} user={user} cartCleared={done.cartCleared} />;
  if (items && !items.length)
    return (
      <State
        symbol="bag"
        title="Seu carrinho está vazio."
        actions={
          <a className="button" href="/catalogo.html">
            Explorar catálogo
          </a>
        }
      />
    );
  if (items?.some((i) => !i.product || i.quantidade > i.product.estoque))
    return (
      <State
        symbol="alert"
        title="Existem itens indisponíveis no carrinho."
        text="Revise as quantidades antes de finalizar."
        actions={
          <a className="button" href="/carrinho.html">
            Revisar carrinho
          </a>
        }
      />
    );

  const pickup = sel.entrega === "retirada";
  const typing = sel.endereco === "novo";
  const max = quote?.parcelasMax || 1;
  const parcelas = Math.min(parcelasPick, max);
  const byId = new Map((items || []).map((i) => [i.id, i.product]));
  const parcel = quote && pagamento === "cartao" && parcelas > 1 ? ` · ${parcelas}x de ${money(installmentValue(quote.totalCents, parcelas))}` : "";
  const applyCoupon = () => {
    const value = couponInput.current?.value.trim();
    if (value) refresh(sel, value.toUpperCase());
  };

  const submit = async () => {
    const cep = cepOf(sel);
    const order = (await send("/orders", {
      endereco: pickup ? "Retirada na loja" : typing ? sel.typed : choices.find((c) => c.id === sel.endereco)!.text,
      entrega: sel.entrega,
      ...(cep ? { cep } : {}),
      pagamento,
      ...(pagamento === "cartao" ? { parcelas } : {}),
      ...(sel.cupom ? { cupom: sel.cupom } : {}),
      requestId,
      items: getCart(),
    })) as Order;
    let cartCleared = true;
    try {
      setCart([]);
      prefs.coupon = "";
    } catch {
      cartCleared = false;
    }
    setDone({ order, cartCleared });
    onPlaced();
  };

  return (
    <Form id="checkout-form" className="checkout-layout" onSubmit={submit}>
      <div className="checkout-main">
        <section className="panel checkout-section" aria-labelledby="delivery-title">
          <h2 id="delivery-title">
            <span className="step-num">1</span>Entrega
          </h2>
          <fieldset>
            <legend className="sr-only">Forma de entrega</legend>
            <div className="option-cards" id="delivery-options">
              {quote ? (
                (quote.entregas || []).map((o) => (
                  <label className="option-card" key={o.id}>
                    <input
                      type="radio"
                      name="entrega"
                      value={o.id}
                      checked={o.id === sel.entrega}
                      onChange={() => {
                        prefs.delivery = o.id;
                        const next = { ...sel, entrega: o.id };
                        setSel(next);
                        refresh(next);
                      }}
                    />
                    <span className="option-icon">
                      <Icon name={o.id === "retirada" ? "store" : "truck"} size={22} />
                    </span>
                    <span className="option-text">
                      <strong>{o.label}</strong>
                      <small>{o.prazo}</small>
                    </span>
                    <span className="option-price">{o.priceCents ? money(o.priceCents) : "Grátis"}</span>
                  </label>
                ))
              ) : (
                <div className="loading">Calculando opções…</div>
              )}
            </div>
          </fieldset>
          <div id="address-choices" hidden={!quote || pickup || !choices.length}>
            {quote && choices.length > 0 && (
              <>
                <fieldset className="address-choices">
                  <legend>Entregar em</legend>
                  <div className="option-cards">
                    {[...choices, { id: "novo", title: "Outro endereço", text: "Digite o endereço completo só para este pedido." } as Choice].map((c) => (
                      <label className="option-card" key={c.id}>
                        <input
                          type="radio"
                          name="endereco-escolha"
                          value={c.id}
                          checked={sel.endereco === c.id}
                          onChange={() => {
                            const next = { ...sel, endereco: c.id };
                            setSel(next);
                            if (c.id === "novo") focusAddress.current = true;
                            else refresh(next);
                          }}
                        />
                        <span className="option-icon">
                          <Icon name={c.id === "novo" ? "plus" : "pin"} size={22} />
                        </span>
                        <span className="option-text">
                          <strong>
                            {c.title}
                            {c.main && (
                              <>
                                {" "}
                                <span className="badge badge-main">Principal</span>
                              </>
                            )}
                          </strong>
                          <small>{c.text}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <a className="text-link small" href="/minha-conta.html#enderecos">
                  Gerenciar endereços <Icon name="arrowRight" size={16} />
                </a>
              </>
            )}
          </div>
          <div className="field" id="address-field" hidden={!!quote && (pickup || !typing)}>
            <label htmlFor="endereco">Endereço completo</label>
            <AddressInput required={!pickup && typing} value={sel.typed} onChange={(typed) => setSel((s) => ({ ...s, typed }))} inputRef={address} />
            <p className="form-help" id="address-help">
              Rua, número, complemento, bairro, cidade, estado e CEP.
            </p>
          </div>
          <p className="pickup-note" id="pickup-note" hidden={!pickup}>
            Retire na loja Violet Voltage a partir de 1 dia útil após a confirmação. Leve um documento com foto.
          </p>
        </section>
        <section className="panel checkout-section" aria-labelledby="payment-title">
          <h2 id="payment-title">
            <span className="step-num">2</span>Pagamento
          </h2>
          <fieldset>
            <legend className="sr-only">Forma de pagamento</legend>
            <div className="option-cards" id="payment-options">
              {quote &&
                payments.map(([id, symbol, label, text]) => (
                  <label className="option-card" key={id}>
                    <input
                      type="radio"
                      name="pagamento"
                      value={id}
                      checked={id === pagamento}
                      onChange={() => {
                        setPagamento(id);
                        if (id !== "cartao") setParcelas(1);
                      }}
                    />
                    <span className="option-icon">
                      <Icon name={symbol} size={22} />
                    </span>
                    <span className="option-text">
                      <strong>{label}</strong>
                      <small>{text}</small>
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
          <div className="field" id="installments-field" hidden={!quote || pagamento !== "cartao"}>
            <label htmlFor="parcelas">Parcelas</label>
            <select id="parcelas" name="parcelas" value={parcelas} onChange={(e) => setParcelas(Number(e.currentTarget.value))}>
              {quote &&
                Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x de {money(installmentValue(quote.totalCents, n))} sem juros{n === 1 ? " (à vista)" : ""}
                  </option>
                ))}
            </select>
          </div>
        </section>
        <section className="panel checkout-section" aria-labelledby="coupon-title">
          <h2 id="coupon-title">
            <span className="step-num">3</span>Cupom de desconto
          </h2>
          <div id="coupon-box">
            {quote &&
              (quote.cupom ? (
                <CouponApplied
                  cupom={quote.cupom}
                  onRemove={() => {
                    prefs.coupon = "";
                    const next = { ...sel, cupom: "" };
                    setSel(next);
                    refresh(next, "");
                  }}
                />
              ) : (
                <>
                  <div className="coupon-row">
                    <label className="sr-only" htmlFor="cupom">
                      Cupom de desconto
                    </label>
                    <input
                      id="cupom"
                      ref={couponInput}
                      maxLength={30}
                      autoComplete="off"
                      placeholder="Digite seu cupom"
                      aria-invalid={couponError ? true : undefined}
                      aria-describedby={couponError ? "coupon-error" : undefined}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        applyCoupon();
                      }}
                    />
                    <button type="button" className="secondary" data-apply-coupon onClick={applyCoupon}>
                      Aplicar
                    </button>
                  </div>
                  {couponError && (
                    <p className="field-error" id="coupon-error" role="alert">
                      {couponError}
                    </p>
                  )}
                </>
              ))}
          </div>
        </section>
      </div>
      <aside className="panel summary-panel checkout-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Seu pedido</h2>
        <ul className="summary-items" id="summary-items">
          {(quote?.items || []).map((i) => {
            const product = byId.get(i.id) as Product | undefined;
            return (
              <li key={i.id}>
                <img src={product ? itemImage(product, i.cor) : productImage(product)} alt="" width={56} height={56} />
                <span className="summary-item-name">
                  {i.nome}
                  {i.cor && <small>Cor: {i.cor}</small>}
                  <small>
                    {i.quantidade} × {money(i.priceCents)}
                  </small>
                  {(i.servicos || []).map((sv) => (
                    <small className="summary-service" key={sv.nome}>
                      + {sv.nome}: {money(sv.priceCents * i.quantidade)}
                    </small>
                  ))}
                </span>
                <strong>{money(i.totalCents)}</strong>
              </li>
            );
          })}
        </ul>
        <div id="summary-totals">
          {quote ? (
            <Totals quote={quote} />
          ) : (
            <div className="loading">Calculando…</div>
          )}
        </div>
        <p className="payment-summary">
          <span className="muted">Pagamento:</span>{" "}
          <strong id="payment-summary">
            {paymentLabel[pagamento]}
            {parcel}
          </strong>
        </p>
        <SubmitButton className="full" disabled={!quote || quoting}>
          {quote ? (
            <>
              <Icon name="shield" size={18} />
              Confirmar pedido · {money(quote.totalCents)}
            </>
          ) : (
            "Carregando pedido…"
          )}
        </SubmitButton>
        <p className="secure-note">
          <Icon name="shield" size={16} />
          Preços, estoque e descontos são conferidos novamente ao confirmar.
        </p>
      </aside>
    </Form>
  );
}

// Mesma marcação inicial da página anterior (formulário com "Calculando…") no pré-render.
function Placeholder() {
  return (
    <form id="checkout-form" className="checkout-layout">
      <div className="checkout-main">
        <section className="panel checkout-section" aria-labelledby="delivery-title">
          <h2 id="delivery-title">
            <span className="step-num">1</span>Entrega
          </h2>
          <div className="loading" role="status">
            Calculando opções…
          </div>
        </section>
      </div>
      <aside className="panel summary-panel checkout-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Seu pedido</h2>
        <div className="loading">Calculando…</div>
        <button type="submit" className="full" disabled>
          Carregando pedido…
        </button>
      </aside>
    </form>
  );
}

export default function Checkout() {
  return (
    <Private
      loading={
        <Shell>
          <Placeholder />
        </Shell>
      }
    >
      {(user) => <CheckoutPage user={user} />}
    </Private>
  );
}
function CheckoutPage({ user }: { user: AccountUser }) {
  const [placed, setPlaced] = useState(false);
  return (
    <Shell done={placed}>
      <CheckoutForm user={user} onPlaced={() => setPlaced(true)} />
    </Shell>
  );
}
