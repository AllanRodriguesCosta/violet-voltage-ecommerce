// Peças do carrinho e do checkout com a mesma marcação das páginas anteriores: progresso para o
// frete grátis, totais do pedido e cupom aplicado. Os valores vêm do servidor (/checkout/quote).
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../lib/icons";
import { FREE_SHIPPING_CENTS, installmentValue, maxInstallments, money } from "../lib/shop";

export type Quote = {
  subtotalCents: number;
  servicosCents?: number;
  freteCents: number;
  descontoCents: number;
  totalCents: number;
  parcelasMax?: number;
  kits?: { nome: string; quantidade: number; descontoCents: number }[];
  cupom?: { codigo: string; descricao: string } | null;
  regiao?: { nome: string } | null;
  entregas?: { id: string; label: string; prazo: string; priceCents: number }[];
  items?: { id: string; nome: string; cor?: string; quantidade: number; priceCents: number; totalCents: number; servicos?: { nome: string; priceCents: number }[] }[];
};

export function FreeShipping({ subtotalCents }: { subtotalCents: number }) {
  const missing = Math.max(0, FREE_SHIPPING_CENTS - subtotalCents);
  const percent = Math.min(100, Math.round((subtotalCents / FREE_SHIPPING_CENTS) * 100));
  return (
    <div className={`ship-progress${missing ? "" : " is-done"}`}>
      <p>
        {missing ? (
          <>
            <Icon name="truck" size={18} />
            <span>
              Faltam <strong>{money(missing)}</strong> para frete grátis na entrega padrão.
            </span>
          </>
        ) : (
          <>
            <Icon name="check" size={18} />
            <span>
              Você ganhou <strong>frete grátis</strong> na entrega padrão.
            </span>
          </>
        )}
      </p>
      <div className="ship-bar" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` } as CSSProperties} />
      </div>
    </div>
  );
}

const Line = ({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) => (
  <div className={`summary-line${className ? ` ${className}` : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export function Totals({ quote }: { quote: Quote }) {
  const count = maxInstallments(quote.totalCents);
  return (
    <>
      <Line label="Subtotal" value={money(quote.subtotalCents)} />
      {!!quote.servicosCents && <Line label="Serviços" value={money(quote.servicosCents)} />}
      {(quote.kits || []).map((k) => (
        <Line key={k.nome} className="discount" label={`Desconto ${k.nome}${k.quantidade > 1 ? ` (${k.quantidade}x)` : ""}`} value={`− ${money(k.descontoCents)}`} />
      ))}
      <Line label="Frete" value={quote.freteCents ? money(quote.freteCents) : <strong className="free">Grátis</strong>} />
      {!!quote.descontoCents && <Line className="discount" label={`Desconto${quote.cupom ? ` (${quote.cupom.codigo})` : ""}`} value={`− ${money(quote.descontoCents)}`} />}
      <Line className="summary-total" label="Total" value={money(quote.totalCents)} />
      {count > 1 && (
        <p className="installments-note">
          ou até {count}x de {money(installmentValue(quote.totalCents, count))} sem juros no cartão
        </p>
      )}
    </>
  );
}

export function CouponApplied({ cupom, onRemove }: { cupom: { codigo: string; descricao: string }; onRemove: () => void }) {
  return (
    <div className="coupon-applied">
      <Icon name="tag" size={18} />
      <span>
        <strong>{cupom.codigo}</strong>
        <small>{cupom.descricao}</small>
      </span>
      <button type="button" className="text-button" data-remove-coupon onClick={onRemove}>
        Remover
      </button>
    </div>
  );
}
