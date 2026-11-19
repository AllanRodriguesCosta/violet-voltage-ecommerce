// Visualização rápida a partir dos cartões: preço, parcelas, estoque, quantidade e favoritos sem
// sair da vitrine. A página do produto continua sendo o detalhe completo.
import { useEffect, useRef, useState } from "react";
import { Icon } from "../lib/icons";
import { addCart, money, productImage } from "../lib/shop";
import { closeQuickView, useQuickView } from "../lib/quickview";
import { fieldMessage } from "../lib/catalog";
import { useWishlist } from "../lib/store";
import { AlertButton, installmentText, productUrl, stockState, toggleWish, wishLabel } from "./ProductCard";
import { BodyPortal } from "./Portal";

function Dialog() {
  const { product: p, opener, seq } = useQuickView();
  const ref = useRef<HTMLDialogElement>(null);
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const wished = useWishlist().includes(p?.id || "");
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !p) return;
    setQty("1");
    setError("");
    if (!dialog.open) dialog.showModal();
    (dialog.querySelector<HTMLElement>("form.qv-buy [type=submit]") || dialog.querySelector<HTMLElement>(".alert-button"))?.focus();
  }, [p, seq]);
  if (!p) return <dialog className="quick-view" aria-labelledby="qv-title" ref={ref} />;
  const name = `${p.marca} ${p.modelo}`;
  const stock = stockState(p);
  const max = Math.min(99, p.estoque);
  const parcel = installmentText(p.priceCents);
  const stockText = stock.key === "out" ? "Produto esgotado" : stock.key === "low" ? `Últimas unidades: ${p.estoque} em estoque` : "Em estoque";
  const value = Number(qty);
  const step = (delta: number) => setQty(String(Math.min(max, Math.max(1, (Number(qty) || 1) + delta))));
  return (
    <dialog
      className="quick-view"
      aria-labelledby="qv-title"
      ref={ref}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target === e.currentTarget || target.closest("[data-qv-close]")) e.currentTarget.close();
      }}
      onClose={() => {
        closeQuickView();
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      }}
    >
      <button type="button" className="icon-button qv-close" data-qv-close aria-label="Fechar visualização rápida">
        <Icon name="close" />
      </button>
      <div className="qv-grid">
        <div className="qv-media">
          <img src={productImage(p)} alt={name} width={480} height={480} />
        </div>
        <div className="qv-info" data-name={name}>
          <span className="eyebrow">
            {p.categoria} · {p.marca}
          </span>
          <h2 id="qv-title">{p.modelo}</h2>
          <p className="qv-price">{money(p.priceCents)}</p>
          {parcel && <p className="product-installments">{parcel}</p>}
          <p className={`stock-pill stock-${stock.key}`}>
            <Icon name={stock.key === "out" ? "clock" : "check"} size={16} />
            {stockText}
          </p>
          <p className="qv-desc">{p.descricao || ""}</p>
          {p.estoque ? (
            <form
              className="qv-buy"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("quantidade") as HTMLInputElement;
                if (!input.checkValidity()) {
                  setError(fieldMessage(input));
                  input.focus();
                  return;
                }
                const image = ref.current?.querySelector(".qv-media img");
                if (addCart(p, Number(input.value), { source: image })) ref.current?.close();
              }}
            >
              <div className="stepper stepper-lg" role="group" aria-label="Quantidade">
                <button type="button" data-qty="-1" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => step(-1)}>
                  <Icon name="minus" size={16} />
                </button>
                <input
                  name="quantidade"
                  type="number"
                  value={qty}
                  min={1}
                  max={max}
                  inputMode="numeric"
                  aria-label="Quantidade"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "hint-quantidade" : undefined}
                  onChange={(e) => {
                    setQty(e.target.value);
                    if (error && e.target.checkValidity()) setError("");
                  }}
                />
                <button type="button" data-qty="1" aria-label="Aumentar quantidade" disabled={value >= max} onClick={() => step(1)}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              {error && (
                <p className="field-error" id="hint-quantidade">
                  {error}
                </p>
              )}
              <button type="submit">
                <Icon name="bag" size={18} />
                Adicionar ao carrinho
              </button>
            </form>
          ) : (
            <div className="qv-buy">
              <AlertButton product={p} />
            </div>
          )}
          <div className="qv-links">
            <button type="button" className="text-button" data-wish={p.id} data-name={name} aria-pressed={wished} aria-label={wishLabel(name, wished)} onClick={() => toggleWish(p.id)}>
              <Icon name="heart" size={18} />
              <span>Favoritos</span>
            </button>
            <a className="text-link" href={productUrl(p)}>
              Ver detalhes completos <Icon name="arrowRight" size={16} />
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function QuickView() {
  return (
    <BodyPortal>
      <Dialog />
    </BodyPortal>
  );
}
