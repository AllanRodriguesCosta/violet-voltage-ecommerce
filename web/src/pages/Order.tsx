// Comprovante do pedido: tela e impressão (o botão usa a impressão do navegador, que salva em
// PDF), com troca ou devolução dentro do prazo.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { api, money, send, toast } from "../lib/shop";
import { Form, FieldError, SubmitButton, useFieldA11y } from "../components/Form";
import { LoadError, Loading, Private } from "../components/Private";
import { deliveryName, Fact, numberOf, paymentName, statusOf, Timeline, TotalsFacts, Tracking, type Order as OrderData } from "../components/OrderParts";

type Load = { status: "loading" } | { status: "error"; error: Error & { status?: number } } | { status: "ready"; order: OrderData };
const exchangeStatus: Record<string, string> = { Aberta: "Em análise", Aprovada: "Aprovada", Recusada: "Recusada" };

function Shell({ crumb = "Pedido", children }: { crumb?: string; children: ReactNode }) {
  return (
    <div className="container page-wrap receipt-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <a href="/minha-conta.html#pedidos">Meus pedidos</a>
        <span aria-hidden="true">/</span>
        <span id="crumb-current" aria-current="page">
          {crumb}
        </span>
      </nav>
      {children}
    </div>
  );
}
const LoadingOrder = () => (
  <Shell>
    <div id="order-content" aria-busy="true">
      <Loading text="Carregando pedido…" />
    </div>
  </Shell>
);

function Motivo() {
  const a11y = useFieldA11y("motivo");
  return (
    <div className="field">
      <label htmlFor="exchange-motivo">Motivo</label>
      <textarea id="exchange-motivo" name="motivo" rows={3} minLength={10} maxLength={500} required {...a11y} />
      <FieldError name="motivo" />
    </div>
  );
}
function ItemsFieldset({ order }: { order: OrderData }) {
  return (
    <fieldset>
      <legend>Quais itens?</legend>
      {order.itens.map((i) => (
        <label className="check" key={i.id}>
          <input type="checkbox" name="itens" value={i.id} />
          <span>{i.nome}</span>
        </label>
      ))}
      <FieldError name="itens" />
    </fieldset>
  );
}

// Troca ou devolução: situação das solicitações e formulário dentro do prazo.
function Exchange({ order, onSent }: { order: OrderData; onSent: () => Promise<void> }) {
  if (order.status !== "Concluído") return null;
  const names = new Map(order.itens.map((i) => [i.id, i.nome]));
  const requests = order.trocas || [];
  const open = requests.some((t) => t.status === "Aberta");
  const win = order.prazoTroca || {};
  const until = win.ate ? new Date(win.ate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "";
  return (
    <section className="panel exchange-panel no-print" id="troca" aria-labelledby="exchange-title">
      <h2 id="exchange-title" tabIndex={-1}>
        Troca ou devolução
      </h2>
      {requests.length > 0 && (
        <ul className="exchange-list">
          {requests.map((t, index) => (
            <li className="exchange-item" key={`${t.at}-${index}`}>
              <span className={`badge ${t.status === "Aprovada" ? "badge-in" : t.status === "Recusada" ? "badge-out" : "badge-low"}`}>{exchangeStatus[t.status] || t.status}</span>
              <strong>
                {t.tipo === "troca" ? "Troca" : "Devolução"} de {t.itens.map((id) => names.get(id) || id).join(", ")}
              </strong>
              <small>
                Pedida em {new Date(t.at).toLocaleDateString("pt-BR")} · {t.motivo}
              </small>
              {t.resposta && (
                <p className="exchange-answer">
                  <strong>Resposta da loja:</strong> {t.resposta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {win.aberta && !open ? (
        <Form
          id="exchange-form"
          className="exchange-form"
          messages={{ motivo: "Conte o motivo em pelo menos 10 caracteres." }}
          onSubmit={async (data, form) => {
            const itens = [...form.querySelectorAll<HTMLInputElement>("input[name=itens]:checked")].map((x) => x.value);
            if (!itens.length) throw Object.assign(new Error("Escolha pelo menos um item."), { field: "itens" });
            await send(`/orders/${encodeURIComponent(order.id)}/troca`, { itens, tipo: data.tipo, motivo: data.motivo });
            toast("Solicitação enviada. A loja responde nas notificações.", { type: "success" });
            await onSent();
          }}
        >
          <p className="form-help">Você pode pedir até {until}. O produto precisa estar sem sinais de uso, com acessórios e embalagem original.</p>
          <ItemsFieldset order={order} />
          <fieldset>
            <legend>O que você prefere?</legend>
            <label className="check">
              <input type="radio" name="tipo" value="troca" defaultChecked />
              <span>Trocar por outro item</span>
            </label>
            <label className="check">
              <input type="radio" name="tipo" value="devolucao" />
              <span>Devolver e receber o valor</span>
            </label>
          </fieldset>
          <Motivo />
          <SubmitButton className="secondary">
            <Icon name="refresh" size={18} />
            Enviar solicitação
          </SubmitButton>
        </Form>
      ) : (
        !requests.length && <p className="muted">{win.motivo || "Fora do prazo de troca."}</p>
      )}
    </section>
  );
}

function Receipt({ order, reload }: { order: OrderData; reload: () => Promise<void> }) {
  const number = numberOf(order);
  const created = new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  return (
    <>
      <header className="page-head receipt-head">
        <div>
          <span className="eyebrow">Comprovante do pedido</span>
          <h1 className="page-title">Pedido #{number}</h1>
          <p className="lead">Feito em {created}</p>
        </div>
        <div className="row no-print">
          <span className={`status status-${statusOf(order.status)}`}>{order.status}</span>
          <button type="button" className="secondary" data-print onClick={() => print()}>
            <Icon name="printer" size={18} />
            Imprimir ou salvar PDF
          </button>
        </div>
      </header>
      <div className="receipt-grid">
        <section className="panel receipt-status" aria-labelledby="receipt-status-title">
          <h2 id="receipt-status-title">Acompanhamento</h2>
          <Timeline order={order} />
          <Tracking order={order} />
        </section>
        <section className="panel" aria-labelledby="receipt-items-title">
          <h2 id="receipt-items-title">Itens</h2>
          <div className="table-wrap">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Qtd.</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.itens.map((i, index) => (
                  <tr key={`${i.id}-${index}`}>
                    <td>
                      <a href={`/produto.html?id=${encodeURIComponent(i.id)}`}>{i.nome}</a>
                      {i.cor && <small className="receipt-service">Cor: {i.cor}</small>}
                      {(i.servicos || []).map((s) => (
                        <small className="receipt-service" key={s.nome}>
                          + {s.nome}: {money(s.priceCents)} cada
                        </small>
                      ))}
                    </td>
                    <td>{i.quantidade}</td>
                    <td>{money(i.priceCents)}</td>
                    <td>{money(i.priceCents * i.quantidade + (i.servicos || []).reduce((t, s) => t + s.priceCents * i.quantidade, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="order-facts receipt-totals">
            <TotalsFacts order={order} />
            <Fact label="Total" className="total">
              {money(order.totalCents)}
            </Fact>
          </dl>
        </section>
        <section className="panel" aria-labelledby="receipt-info-title">
          <h2 id="receipt-info-title">Pagamento e entrega</h2>
          <dl className="order-facts">
            <Fact label="Pagamento">
              {paymentName(order.pagamento)}
              {(order.parcelas || 1) > 1 ? ` em ${order.parcelas}x de ${money(Math.ceil(order.totalCents / order.parcelas!))}` : ""}
            </Fact>
            <Fact label="Entrega">{deliveryName(order.entrega)}</Fact>
            <Fact label={order.entrega === "retirada" ? "Retirada" : "Endereço"} className="wide">
              {order.entrega === "retirada" ? "Loja Violet Voltage. Leve um documento com foto e o número do pedido." : order.endereco}
            </Fact>
            <div className="wide">
              <dt>Número completo</dt>
              <dd className="mono">{order.id}</dd>
            </div>
          </dl>
        </section>
      </div>
      <Exchange
        order={order}
        onSent={async () => {
          await reload();
          document.querySelector("#troca")?.scrollIntoView();
          document.querySelector<HTMLElement>("#troca h2")?.focus();
        }}
      />
      <p className="small muted receipt-note">
        Este comprovante resume o pedido e não substitui a nota fiscal. Dúvidas? <a href="/ajuda.html#pedidos">Central de ajuda</a>.
      </p>
      <div className="row no-print">
        <a className="button secondary" href="/minha-conta.html#pedidos">
          <Icon name="chevronLeft" size={16} />
          Meus pedidos
        </a>
      </div>
    </>
  );
}

function OrderPage() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const scrolled = useRef(false);
  const fetchOrder = useCallback(async () => {
    const id = new URLSearchParams(location.search).get("id") || "";
    try {
      const order = (await api(`/orders/${encodeURIComponent(id)}`)) as OrderData;
      setLoad({ status: "ready", order });
    } catch (error) {
      setLoad({ status: "error", error: error as Error });
    }
  }, []);
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);
  useEffect(() => {
    if (load.status !== "ready") return;
    const number = numberOf(load.order);
    document.title = `Pedido #${number} | Violet Voltage`;
    if (!scrolled.current && location.hash === "#troca") document.querySelector("#troca")?.scrollIntoView();
    scrolled.current = true;
  }, [load]);

  if (load.status === "loading") return <LoadingOrder />;
  if (load.status === "error") {
    const missing = load.error.status === 404;
    return (
      <Shell>
        <div id="order-content">
          <LoadError
            error={load.error}
            retry={missing ? null : () => (setLoad({ status: "loading" }), fetchOrder())}
            level={1}
            title={missing ? "Pedido não encontrado." : "Não foi possível carregar o pedido."}
            text={missing ? "Confira o link ou abra o pedido pela lista em Minha conta." : undefined}
            back={{ href: "/minha-conta.html#pedidos", label: "Ver meus pedidos" }}
          />
        </div>
      </Shell>
    );
  }
  return (
    <Shell crumb={`Pedido #${numberOf(load.order)}`}>
      <div id="order-content">
        <Receipt order={load.order} reload={fetchOrder} />
      </div>
    </Shell>
  );
}

export default function Order() {
  return <Private loading={<LoadingOrder />}>{() => <OrderPage />}</Private>;
}
