// Minicarrinho: <dialog> lateral com itens, quantidade, remoção (com desfazer), progresso para o
// frete grátis e atalhos para o checkout. E o aviso compacto "Adicionado ao carrinho", que
// aparece depois do produto voar até o ícone do carrinho.
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Icon } from "../lib/icons";
import { catalogProducts, cartQuantity, getCart, setCart, toast, type Product } from "../lib/shop";
import { itemColor, itemImage, money, productImage } from "../../../shared/catalog.js";
import { closeCart, openCart, useDrawer } from "../lib/drawer";
import { flyToCart } from "../lib/motion";
import type { CartAdded } from "../lib/cart";
import { useCartCount } from "../lib/store";
import { FreeShipping } from "./Commerce";
import { BodyPortal } from "./Portal";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
type Row = { id: string; quantidade: number; cor?: string; product?: Product };

function DrawerItems({ rows, onChange }: { rows: Row[]; onChange: () => void }) {
  const step = (id: string, delta: number, max: number) => {
    const cart = getCart();
    const item = cart.find((i) => i.id === id);
    if (!item) return onChange();
    try {
      item.quantidade = Math.max(1, Math.min(max, item.quantidade + delta));
      setCart(cart);
    } catch {
      toast("Não foi possível atualizar o carrinho neste navegador.", { type: "error" });
    }
    onChange();
  };
  const remove = (id: string) => {
    const previous = getCart();
    try {
      setCart(previous.filter((i) => i.id !== id));
      toast("Item removido do carrinho.", {
        type: "info",
        action: {
          label: "Desfazer",
          onClick: () => {
            setCart(previous);
            onChange();
          },
        },
      });
    } catch {
      toast("Não foi possível atualizar o carrinho neste navegador.", { type: "error" });
    }
    onChange();
  };
  return (
    <ul className="drawer-items">
      {rows.map((r) => {
        const p = r.product;
        const name = p ? `${p.marca} ${p.modelo}` : "Produto indisponível";
        const max = Math.min(99, p?.estoque || 0);
        const color = p ? itemColor(p, r.cor) : null;
        return (
          <li className="drawer-item" key={r.id}>
            <img src={p ? itemImage(p, r.cor) : productImage(p)} alt="" width={72} height={72} />
            <div className="drawer-item-info">
              {p ? (
                <>
                  <a href={`/produto.html?id=${encodeURIComponent(p.id)}`}>{name}</a>
                  {color && <span className="item-color small">Cor: {color}</span>}
                  <span className="small muted">{money(p.priceCents)} cada</span>
                </>
              ) : (
                <strong>{name}</strong>
              )}
              {(!p || r.quantidade > max) && <span className="field-error">Indisponível nessa quantidade.</span>}
              <div className="stepper" role="group" aria-label={`Quantidade de ${name}`}>
                <button type="button" data-step="-1" data-id={r.id} data-max={max} aria-label="Diminuir quantidade" disabled={r.quantidade <= 1} onClick={() => step(r.id, -1, max)}>
                  <Icon name="minus" size={16} />
                </button>
                <output aria-live="polite">{r.quantidade}</output>
                <button type="button" data-step="1" data-id={r.id} data-max={max} aria-label="Aumentar quantidade" disabled={r.quantidade >= max} onClick={() => step(r.id, 1, max)}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
            <div className="drawer-item-end">
              <strong>{money((p?.priceCents || 0) * r.quantidade)}</strong>
              <button type="button" className="icon-button" data-remove data-id={r.id} aria-label={`Remover ${name}`} onClick={() => remove(r.id)}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Load = { state: "idle" | "loading" | "ready" | "error"; rows: Row[]; error?: string };
function Drawer() {
  const { open, message, seq } = useDrawer();
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle", rows: [] });
  const count = useCartCount();
  const refresh = useCallback(async () => {
    const cart = getCart();
    if (!cart.length) return setLoad({ state: "ready", rows: [] });
    setLoad((current) => (current.rows.length ? current : { state: "loading", rows: [] }));
    try {
      const products = await catalogProducts();
      setLoad({ state: "ready", rows: getCart().map((item) => ({ ...item, product: products.find((p) => p.id === item.id) })) });
    } catch (error) {
      setLoad({ state: "error", rows: [], error: (error as Error).message });
    }
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    refresh();
    dialog.querySelector<HTMLElement>(".drawer-panel")?.focus?.();
  }, [open, seq, refresh]);
  useEffect(() => {
    if (!open) return;
    document.addEventListener("vv:cart", refresh);
    return () => document.removeEventListener("vv:cart", refresh);
  }, [open, refresh]);
  const close = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open) return closeCart();
    const done = () => {
      setClosing(false);
      dialog.close();
      closeCart();
    };
    if (reduced()) done();
    else {
      setClosing(true);
      setTimeout(done, 180);
    }
  }, []);
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.closest("[data-drawer-close]")) close();
  };
  const rows = load.rows;
  const subtotal = rows.reduce((s, r) => s + (r.product?.priceCents || 0) * r.quantidade, 0);
  const invalid = rows.some((r) => !r.product || r.quantidade > r.product.estoque);
  const empty = load.state === "ready" && !rows.length;
  return (
    <dialog
      className={`drawer${closing ? " is-closing" : ""}`}
      id="cart-drawer"
      aria-labelledby="cart-drawer-title"
      ref={ref}
      onClick={onClick}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={() => closeCart()}
    >
      <div className="drawer-panel">
        <header className="drawer-header">
          <h2 id="cart-drawer-title">
            Seu carrinho{" "}
            <span className="muted">
              ({count} {count === 1 ? "item" : "itens"})
            </span>
          </h2>
          <button type="button" className="icon-button" data-drawer-close aria-label="Fechar carrinho">
            <Icon name="close" />
          </button>
        </header>
        <p className="drawer-status" role="status">
          {message}
        </p>
        <div className="drawer-body">
          {empty ? (
            <div className="drawer-empty">
              <Icon name="bag" size={34} />
              <h3>Seu carrinho está vazio.</h3>
              <p>Que tal começar pelo instrumento principal?</p>
              <a className="button" href="/catalogo.html">
                Explorar catálogo
              </a>
            </div>
          ) : load.state === "error" ? (
            <div className="error" role="alert">
              {load.error}
            </div>
          ) : rows.length ? (
            <DrawerItems rows={rows} onChange={refresh} />
          ) : (
            open && <div className="loading">Carregando itens…</div>
          )}
        </div>
        <footer className="drawer-footer">
          {load.state === "error" ? (
            <a className="button secondary full" href="/carrinho.html">
              Abrir carrinho
            </a>
          ) : (
            rows.length > 0 && (
              <>
                <FreeShipping subtotalCents={subtotal} />
                <div className="summary-line summary-total">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <p className="small muted">Frete, cupom e parcelas no checkout.</p>
                {invalid && <p className="field-error">Ajuste os itens indisponíveis antes de finalizar.</p>}
                <a
                  className="button full"
                  href="/checkout.html"
                  aria-disabled={invalid || undefined}
                  data-blocked={invalid || undefined}
                  onClick={(e) => {
                    if (!invalid) return;
                    e.preventDefault();
                    location.href = "/carrinho.html";
                  }}
                >
                  Finalizar compra <Icon name="arrowRight" size={18} />
                </a>
                <a className="button secondary full" href="/carrinho.html">
                  Ver carrinho completo
                </a>
              </>
            )
          )}
        </footer>
      </div>
    </dialog>
  );
}

// Aviso compacto de item adicionado: não bloqueia a página, some sozinho e pausa com foco ou cursor.
const NOTICE_MS = 6000;
type Notice = CartAdded & { count: number; seq: number; style?: CSSProperties };
function CartNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState("");
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const box = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const left = useRef(NOTICE_MS);
  const started = useRef(0);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setLeaving(true);
    setTimeout(
      () => {
        setVisible(false);
        setLeaving(false);
      },
      reduced() ? 0 : 160,
    );
  }, []);
  const run = useCallback(() => {
    clearTimeout(timer.current);
    started.current = Date.now();
    timer.current = setTimeout(hide, left.current);
    setPaused(false);
  }, [hide]);
  const pause = () => {
    if (!visible || paused) return;
    clearTimeout(timer.current);
    left.current = Math.max(1200, left.current - (Date.now() - started.current));
    setPaused(true);
  };
  useEffect(() => {
    const onAdded = async (event: Event) => {
      const detail = (event as CustomEvent<CartAdded>).detail;
      if (location.pathname === "/carrinho.html") {
        toast("Produto adicionado ao carrinho.", { type: "success" });
        return;
      }
      await flyToCart(detail.source);
      const count = cartQuantity();
      const name = `${detail.product.marca} ${detail.product.modelo}`;
      setLive(`${name} adicionado ao carrinho. ${count} ${count === 1 ? "item" : "itens"} no carrinho.`);
      const header = document.querySelector(".site-header");
      const cartLink = document.querySelector(".site-header .cart-link");
      const style =
        header && cartLink && matchMedia("(min-width: 900px)").matches
          ? { top: `${Math.max(0, header.getBoundingClientRect().bottom) + 8}px`, right: `${Math.max(12, innerWidth - cartLink.getBoundingClientRect().right - 8)}px` }
          : undefined;
      setNotice((old) => ({ ...detail, quantity: detail.quantity || 1, count, style, seq: (old?.seq || 0) + 1 }));
      setSubtotal(null);
      setVisible(true);
      setLeaving(false);
      left.current = NOTICE_MS;
      run();
      try {
        const products = await catalogProducts();
        setSubtotal(getCart().reduce((sum, item) => sum + (products.find((p) => p.id === item.id)?.priceCents || 0) * item.quantidade, 0));
      } catch {
        // O aviso continua útil sem o progresso de frete.
      }
    };
    document.addEventListener("vv:cart-added", onAdded);
    return () => {
      document.removeEventListener("vv:cart-added", onAdded);
      clearTimeout(timer.current);
    };
  }, [run]);
  const p = notice?.product;
  return (
    <>
      <section
        className={`cart-notice${paused ? " is-paused" : ""}${leaving ? " is-leaving" : ""}`}
        aria-labelledby="cart-notice-title"
        hidden={!visible}
        ref={box}
        style={{ ...notice?.style, "--notice-ms": `${NOTICE_MS}ms` } as CSSProperties}
        onPointerEnter={pause}
        onPointerLeave={() => !box.current?.contains(document.activeElement) && run()}
        onFocus={pause}
        onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && run()}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          hide();
          document.querySelector<HTMLElement>(".site-header .cart-link")?.focus();
        }}
      >
        {p && notice && (
          <Fragment key={notice.seq}>
            <div className="cart-notice-head">
              <span className="cart-notice-check">
                <Icon name="check" size={16} />
              </span>
              <h2 id="cart-notice-title">Adicionado ao carrinho</h2>
              <button type="button" className="icon-button" data-notice-close aria-label="Fechar aviso" onClick={hide}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="cart-notice-item">
              <img src={itemImage(p, notice.cor)} alt="" width={56} height={56} />
              <div>
                <span className="product-brand">{p.marca}</span>
                <strong>{p.modelo}</strong>
                {notice.cor && (
                  <span className="item-color small">
                    Cor: {notice.cor}
                    {notice.recolored ? " (cor do item no carrinho atualizada)" : ""}
                  </span>
                )}
                <span className="small muted">
                  {notice.quantity} × {money(p.priceCents)}
                </span>
              </div>
            </div>
            <div className="cart-notice-ship">{subtotal !== null && <FreeShipping subtotalCents={subtotal} />}</div>
            <div className="cart-notice-actions">
              <a
                className="button secondary"
                href="/carrinho.html"
                data-notice-cart
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  hide();
                  openCart();
                }}
              >
                Ver carrinho ({notice.count})
              </a>
              <a className="button" href="/checkout.html">
                Finalizar compra
              </a>
            </div>
            <span className="cart-notice-timer" aria-hidden="true" />
          </Fragment>
        )}
      </section>
      <p className="sr-only" role="status">
        {live}
      </p>
    </>
  );
}

export function CartWidgets() {
  return (
    <BodyPortal>
      <Drawer />
      <CartNotice />
    </BodyPortal>
  );
}
