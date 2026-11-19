// Partes de um pedido (linha do tempo, previsão e rastreio, totais e cartão do pedido) com a
// mesma marcação anterior; as regras (etapas, prazos, rótulos) vêm de shared/orders.js.
import type { ReactNode } from "react";
import { Icon, type IconName } from "../lib/icons";
import { money, productImage, type Product } from "../lib/shop";
import { itemImage } from "../../../shared/catalog.js";
import { deliveryLabels, deliveryWindow, orderNumber, paymentLabels, statusClass } from "../../../shared/orders.js";

export type OrderItem = { id: string; nome: string; quantidade: number; priceCents: number; cor?: string; servicos?: { nome: string; priceCents: number }[] };
export type Exchange = { status: string; tipo: string; itens: string[]; motivo: string; at: string; resposta?: string };
export type Order = {
  id: string;
  status: string;
  createdAt: string;
  itens: OrderItem[];
  totalCents: number;
  subtotalCents: number;
  servicosCents?: number;
  freteCents?: number;
  descontoCents?: number;
  cupom?: string;
  kits?: { nome: string; quantidade: number; descontoCents: number }[];
  pagamento: string;
  parcelas?: number;
  entrega: string;
  endereco: string;
  rastreio?: string;
  statusHistory?: { status: string; at: string }[];
  estoqueDevolvido?: boolean;
  trocas?: Exchange[];
  prazoTroca?: { aberta?: boolean; ate?: string; motivo?: string };
};

export const numberOf = (order: Order) => orderNumber(order) as string;
export const statusOf = (status: string) => statusClass(status) as string;
export const paymentName = (id: string) => (paymentLabels as Record<string, string>)[id] || id;
export const deliveryName = (id: string) => (deliveryLabels as Record<string, string>)[id] || id;
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const flow = ["Recebido", "Em preparação", "Enviado", "Concluído"];
const steps: [string, IconName][] = [
  ["Recebido", "package"],
  ["Em preparação", "store"],
  ["Enviado", "truck"],
  ["Concluído", "check"],
];

export function Timeline({ order }: { order: Order }) {
  const history = order.statusHistory?.length ? order.statusHistory : [{ status: "Recebido", at: order.createdAt }];
  const when = Object.fromEntries(history.map((h) => [h.status, h.at])) as Record<string, string | undefined>;
  if (order.status === "Cancelado")
    return (
      <ol className="timeline is-canceled">
        <li className="done">
          <span className="dot">
            <Icon name="package" size={16} />
          </span>
          <span>
            <strong>Recebido</strong>
            <small>{date(when.Recebido || order.createdAt)}</small>
          </span>
        </li>
        <li className="canceled">
          <span className="dot">
            <Icon name="close" size={16} />
          </span>
          <span>
            <strong>Cancelado</strong>
            <small>
              {when.Cancelado ? date(when.Cancelado) : ""}
              {order.estoqueDevolvido ? " · itens devolvidos ao estoque" : ""}
            </small>
          </span>
        </li>
      </ol>
    );
  const reached = flow.indexOf(order.status);
  return (
    <ol className="timeline">
      {steps.map(([status, symbol], i) => (
        <li key={status} className={i < reached ? "done" : i === reached ? "current" : undefined} aria-current={i === reached ? "step" : undefined}>
          <span className="dot">
            <Icon name={symbol} size={16} />
          </span>
          <span>
            <strong>{status}</strong>
            <small>{when[status] ? date(when[status]!) : i <= reached ? "—" : "Próxima etapa"}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Tracking({ order }: { order: Order }) {
  const win = deliveryWindow(order) as { text: string } | null;
  if (!win && !order.rastreio) return null;
  return (
    <p className="order-tracking">
      {win && (
        <span>
          <Icon name="clock" size={16} />
          {win.text}
        </span>
      )}
      {order.rastreio && (
        <span>
          <Icon name="truck" size={16} />
          Código de rastreio: <strong className="mono">{order.rastreio}</strong>
        </span>
      )}
    </p>
  );
}

const Fact = ({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) => (
  <div className={className}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);
export function TotalsFacts({ order }: { order: Order }) {
  return (
    <>
      <Fact label="Subtotal">{money(order.subtotalCents)}</Fact>
      {!!order.servicosCents && <Fact label="Serviços">{money(order.servicosCents)}</Fact>}
      {(order.kits || []).map((k) => (
        <Fact key={k.nome} label={`Desconto ${k.nome}${k.quantidade > 1 ? ` (${k.quantidade}x)` : ""}`}>
          − {money(k.descontoCents)}
        </Fact>
      ))}
      <Fact label="Frete">{order.freteCents ? money(order.freteCents) : "Grátis"}</Fact>
      {!!order.descontoCents && <Fact label={`Desconto${order.cupom ? ` (${order.cupom})` : ""}`}>− {money(order.descontoCents)}</Fact>}
    </>
  );
}
export { Fact };

function ExchangeNote({ order }: { order: Order }) {
  const t = (order.trocas || []).at(-1);
  if (!t) return null;
  const names = new Map(order.itens.map((i) => [i.id, i.nome]));
  const label = `${t.tipo === "troca" ? "Troca" : "Devolução"} ${t.status === "Aberta" ? "solicitada" : t.status === "Aprovada" ? "aprovada" : "recusada"}`;
  return (
    <div className={`exchange-note${t.status === "Aberta" ? " is-open" : ""}`}>
      <p>
        <Icon name="refresh" size={16} />
        <strong>{label}</strong>: {t.itens.map((id) => names.get(id) || id).join(", ")}. <span className="muted">“{t.motivo}”</span>
      </p>
    </div>
  );
}

// Cartão do pedido em Minha conta (comprovante, comprar novamente e cancelar).
export function OrderCard({ order, products, onReorder, onCancel }: { order: Order; products: Product[]; onReorder: () => void; onCancel: () => void }) {
  const items = order.itens;
  const byId = new Map(products.map((p) => [p.id, p]));
  const count = items.reduce((s, i) => s + i.quantidade, 0);
  return (
    <article className="order-card" data-order-id={order.id}>
      <header className="order-card-head">
        <div>
          <strong>Pedido #{numberOf(order)}</strong>
          <small>{new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</small>
        </div>
        <span className={`status status-${statusOf(order.status)}`}>{order.status}</span>
      </header>
      <div className="order-thumbs">
        {items.slice(0, 4).map((i, index) => {
          const p = byId.get(i.id);
          return <img key={`${i.id}-${index}`} src={p ? itemImage(p, i.cor) : productImage({ categoria: "" })} alt={i.nome} width={52} height={52} title={i.nome} />;
        })}
        {items.length > 4 && <span>+{items.length - 4}</span>}
        <p>
          <strong>{money(order.totalCents)}</strong>
          <small>
            {count} {count === 1 ? "item" : "itens"} · {paymentName(order.pagamento)}
            {(order.parcelas || 1) > 1 ? ` em ${order.parcelas}x` : ""}
          </small>
        </p>
      </div>
      <Timeline order={order} />
      <Tracking order={order} />
      <details className="order-details">
        <summary>
          Detalhes do pedido <Icon name="chevronDown" size={16} />
        </summary>
        <ul className="order-items">
          {items.map((i, index) => (
            <li key={`${i.id}-${index}`}>
              <span>
                {i.quantidade} × {i.nome}
                {i.cor && <small className="order-service">Cor: {i.cor}</small>}
                {(i.servicos || []).map((s) => (
                  <small className="order-service" key={s.nome}>
                    + {s.nome}
                  </small>
                ))}
              </span>
              <strong>{money((i.priceCents + (i.servicos || []).reduce((t, s) => t + s.priceCents, 0)) * i.quantidade)}</strong>
            </li>
          ))}
        </ul>
        <dl className="order-facts">
          <TotalsFacts order={order} />
          <Fact label="Entrega">{deliveryName(order.entrega)}</Fact>
          <Fact label="Endereço" className="wide">
            {order.endereco}
          </Fact>
          <Fact label="Número completo" className="wide">
            {order.id}
          </Fact>
        </dl>
      </details>
      <ExchangeNote order={order} />
      <footer className="order-actions">
        <a className="button secondary" href={`/pedido.html?id=${encodeURIComponent(order.id)}`}>
          <Icon name="package" size={16} />
          Comprovante
        </a>
        <button type="button" className="secondary" data-reorder onClick={onReorder}>
          <Icon name="refresh" size={16} />
          Comprar novamente
        </button>
        {order.status === "Recebido" && (
          <button type="button" className="text-button danger-text" data-cancel onClick={onCancel}>
            Cancelar pedido
          </button>
        )}
      </footer>
    </article>
  );
}
