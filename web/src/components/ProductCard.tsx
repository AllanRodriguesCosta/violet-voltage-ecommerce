// Cartão de produto (vitrine, catálogo, favoritos). Mesma marcação do cartão anterior.
// Comparar, "Avise-me" e a visualização rápida usam o estado de lib/ (compare, alerts, quickview).
import type { CSSProperties } from "react";
import { Icon } from "../lib/icons";
import { addCart, money, productImage, toast, toggleWishlist, maxInstallments, installmentValue, type Product } from "../lib/shop";
import { useWishlist } from "../lib/store";
import { toggleStockAlert, useStockAlerts } from "../lib/alerts";
import { toggleCompareWithNotice, useCompare } from "../lib/compare";
import { openQuickView } from "../lib/quickview";

export const productUrl = (p: Product) => `/produto.html?id=${encodeURIComponent(p.id)}`;
export function stockState(p: Product) {
  if (!p.estoque) return { key: "out", label: "Esgotado" } as const;
  if (p.estoque <= 5) return { key: "low", label: "Últimas unidades" } as const;
  return { key: "in", label: "Em estoque" } as const;
}
export function installmentText(totalCents: number) {
  const count = maxInstallments(totalCents);
  return count > 1 ? `ou ${count}x de ${money(installmentValue(totalCents, count))} sem juros` : "";
}
export const wishLabel = (name: string, wished: boolean) => (wished ? `Remover ${name} dos favoritos` : `Salvar ${name} nos favoritos`);

export function toggleWish(id: string, onChange?: () => void) {
  const wished = toggleWishlist(id);
  toast(wished ? "Salvo nos favoritos." : "Removido dos favoritos.", {
    type: "success",
    action: wished
      ? { label: "Ver favoritos", onClick: () => (location.href = "/favoritos.html") }
      : {
          label: "Desfazer",
          onClick: () => {
            toggleWishlist(id);
            onChange?.();
          },
        },
  });
  onChange?.();
  return wished;
}

export function WishButton({ product, className = "wish-button" }: { product: Product; className?: string }) {
  const wished = useWishlist().includes(product.id);
  const name = `${product.marca} ${product.modelo}`;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={wished}
      aria-label={wishLabel(name, wished)}
      onClick={(e) => {
        const button = e.currentTarget;
        toggleWish(product.id);
        button.classList.remove("pop");
        void button.offsetWidth;
        button.classList.add("pop");
      }}
    >
      <Icon name="heart" />
    </button>
  );
}

const swatch = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#888888");

export function ProductCard({ product: p, index = 0 }: { product: Product; index?: number }) {
  const stock = stockState(p);
  const name = `${p.marca} ${p.modelo}`;
  const parcel = installmentText(p.priceCents);
  return (
    <article className={`product-card${stock.key === "out" ? " is-out" : ""}`} style={{ "--i": index % 12 } as CSSProperties}>
      <div className="product-media">
        <img src={productImage(p)} data-fallback={productImage({ categoria: p.categoria })} alt="" loading="lazy" decoding="async" width={480} height={480} />
        <div className="product-badges">
          <span className="badge badge-category">{p.categoria}</span>
          {stock.key !== "in" && <span className={`badge badge-${stock.key}`}>{stock.label}</span>}
        </div>
        <WishButton product={p} />
        <button
          type="button"
          className="quick-button"
          aria-label={`Visualização rápida de ${name}`}
          onClick={(e) => {
            const button = e.currentTarget;
            openQuickView(p, button);
          }}
        >
          <Icon name="eye" size={18} />
          <span>Ver rápido</span>
        </button>
      </div>
      <div className="product-body">
        <span className="product-brand">{p.marca}</span>
        <h3 className="product-title">
          <a href={productUrl(p)}>
            <span className="sr-only">{p.marca} </span>
            {p.modelo}
          </a>
        </h3>
        <p className="product-price">{money(p.priceCents)}</p>
        {parcel && <p className="product-installments">{parcel}</p>}
        {Array.isArray(p.cores) && p.cores.length > 1 && (
          <p className="card-colors">
            <span className="card-dots" aria-hidden="true">
              {p.cores.map((c) => (
                <span key={c.nome} className="card-dot" style={{ "--swatch": swatch(c.hex) } as CSSProperties} />
              ))}
            </span>
            {p.cores.length} cores
          </p>
        )}
        <CompareButton product={p} />
        {stock.key === "out" ? (
          <AlertButton product={p} short className="button secondary add-button" />
        ) : (
          <button
            type="button"
            className="button add-button"
            aria-label={`Adicionar ${name} ao carrinho`}
            onClick={(e) => addCart(p, 1, { source: e.currentTarget.closest(".product-card")?.querySelector(".product-media img") })}
          >
            <Icon name="bag" size={18} />
            <span>Adicionar</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="product-card skeleton" aria-hidden="true">
      <div className="product-media" />
      <div className="product-body">
        <span className="sk-line w40" />
        <span className="sk-line w80" />
        <span className="sk-line w50" />
        <span className="sk-block" />
      </div>
    </div>
  ));
}

export function CompareButton({ product: p, className = "compare-toggle" }: { product: Product; className?: string }) {
  const on = useCompare().includes(p.id);
  const name = `${p.marca} ${p.modelo}`;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={on ? `Remover ${name} da comparação` : `Comparar ${name}`}
      onClick={() => toggleCompareWithNotice(p.id, name)}
    >
      <Icon name="compare" size={16} />
      <span>Comparar</span>
    </button>
  );
}

export function AlertButton({ product: p, short = false, className = "secondary" }: { product: Product; short?: boolean; className?: string }) {
  const on = useStockAlerts().has(p.id);
  return (
    <button type="button" className={`${className} alert-button`} aria-pressed={on} onClick={() => toggleStockAlert(p.id)}>
      <span className="alert-icon">
        <Icon name={on ? "check" : "bell"} size={18} />
      </span>
      <span className="alert-label">{on ? "Aviso ativado" : short ? "Avise-me" : "Avise-me quando chegar"}</span>
      <span className="sr-only">
        {" "}
        quando {p.marca} {p.modelo} voltar ao estoque
      </span>
    </button>
  );
}
