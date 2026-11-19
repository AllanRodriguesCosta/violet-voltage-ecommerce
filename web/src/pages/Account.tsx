// Minha conta: visão geral, pedidos, dados e segurança, endereços, pagamento preferido, avisos,
// notificações e ajuda. O endereço (#pedidos, #dados...) escolhe a seção, como antes.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../lib/icons";
import { accountSections, addCart, api, catalogProducts, getCart, initials, logout, money, productImage, send, setCart, toast, type Product } from "../lib/shop";
import { confirmDialog } from "../lib/confirm";
import { openCart } from "../lib/drawer";
import { maskPhone } from "../lib/forms";
import { setUnread } from "../lib/notifications";
import { formatAddress } from "../../../shared/address.js";
import { paymentText, routeFromHash } from "../../../shared/account.js";
import { AddressForm } from "../components/AddressForm";
import { Form, FieldError, Input, SubmitButton } from "../components/Form";
import { OrderCard, Timeline, Tracking, numberOf, statusOf, type Order } from "../components/OrderParts";
import { PasswordInput } from "./Auth";
import { LoadError, Loading, Private, type AccountUser, type Address } from "../components/Private";
import { State } from "../components/State";

type Section = { id: string; icon: IconName; label: string; href: string; nav: boolean };
type Notification = { id: string; tipo: string; titulo: string; texto: string; link: string; lida: boolean; createdAt: string };
type Notifications = { itens: Notification[]; naoLidas: number };
type Alert = { productId: string; tipo?: string; notifiedAt?: string; priceCents: number; produto?: Product };
type Route = { view: string; anchor?: string };

const VIEWS = (accountSections as Section[]).filter((s) => s.nav);
const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const notificationIcon: Record<string, IconName> = { estoque: "bell", preco: "tag", pergunta: "question", pedido: "package" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const groups: Record<string, (o: Order) => boolean> = {
  todos: () => true,
  andamento: (o) => ["Recebido", "Em preparação", "Enviado"].includes(o.status),
  concluidos: (o) => o.status === "Concluído",
  cancelados: (o) => o.status === "Cancelado",
};
const groupLabels: [string, string][] = [
  ["todos", "Todos"],
  ["andamento", "Em andamento"],
  ["concluidos", "Concluídos"],
  ["cancelados", "Cancelados"],
];
const Later = ({ children }: { children: ReactNode }) => <p className="muted small">{children}</p>;
const fail = (error: unknown) => toast((error as Error).message, { type: "error" });


// ---------- Visão geral ----------
function OverviewCard({ id, title, link, linkText = "Ver", wide = false, children }: { id: string; title: string; link?: string; linkText?: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`panel overview-card${wide ? " span-2" : ""}`} aria-labelledby={`ov-${id}`}>
      <div className="overview-card-head">
        <h3 id={`ov-${id}`}>{title}</h3>
        {link && (
          <a className="text-link small" href={link}>
            {linkText}
            <Icon name="arrowRight" size={14} />
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function Overview({ user, orders, notifications, alerts, openAssistant }: { user: AccountUser; orders: Order[] | null; notifications: Notifications | null; alerts: Alert[] | null; openAssistant: () => void }) {
  const list = orders || [];
  const valid = list.filter((o) => o.status !== "Cancelado");
  const live = (alerts || []).filter((a) => a.produto && !a.notifiedAt);
  const stats: [IconName, ReactNode, string, string][] = [
    ["package", orders ? list.length : "–", list.length === 1 ? "pedido" : "pedidos", "#pedidos"],
    ["truck", orders ? list.filter(groups.andamento).length : "–", "em andamento", "#pedidos"],
    ["card", orders ? money(valid.reduce((s, o) => s + o.totalCents, 0)) : "–", "em compras", "#pedidos"],
    ["tag", alerts ? live.length : "–", live.length === 1 ? "aviso ativo" : "avisos ativos", "#avisos"],
  ];
  const latest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const main = (user.enderecos || []).find((a) => a.principal) || (user.enderecos || [])[0];
  const price = live.filter((a) => a.tipo === "preco").length;
  const stock = live.length - price;
  const pay = user.pagamento;
  return (
    <>
      <div className="account-stats" id="account-stats">
        {stats.map(([symbol, value, label, href]) => (
          <a className="account-stat" href={href} key={label + symbol}>
            <Icon name={symbol} size={20} />
            <strong>{value}</strong>
            <span>{label}</span>
          </a>
        ))}
      </div>
      <div className="overview-grid" id="overview-grid">
        <OverviewCard id="pedido" title="Último pedido" link="#pedidos" wide linkText="Todos os pedidos">
          {!orders ? (
            <Later>Carregando pedidos…</Later>
          ) : !latest ? (
            <div className="overview-empty">
              <Icon name="package" size={22} />
              <p>
                <strong>Nenhum pedido ainda.</strong> Quando você comprar, a etapa da entrega aparece aqui.
              </p>
              <a className="button small-button" href="/catalogo.html">
                Explorar equipamentos
              </a>
            </div>
          ) : (
            <>
              <div className="overview-order">
                <div>
                  <strong>Pedido #{numberOf(latest)}</strong>
                  <small>
                    {day.format(new Date(latest.createdAt))} · {plural(latest.itens.reduce((s, i) => s + i.quantidade, 0), "item", "itens")} · {money(latest.totalCents)}
                  </small>
                </div>
                <span className={`status status-${statusOf(latest.status)}`}>{latest.status}</span>
              </div>
              <Timeline order={latest} />
              <Tracking order={latest} />
              <div className="overview-actions">
                <a className="button secondary small-button" href={`/pedido.html?id=${encodeURIComponent(latest.id)}`}>
                  <Icon name="package" size={16} />
                  Ver comprovante
                </a>
              </div>
            </>
          )}
        </OverviewCard>
        <OverviewCard id="notificacoes" title="Notificações" link="#notificacoes" linkText="Ver todas">
          {!notifications ? (
            <Later>Carregando notificações…</Later>
          ) : !notifications.itens.length ? (
            <Later>Nada novo por aqui. Mudanças nos pedidos, respostas e avisos aparecem nesta área.</Later>
          ) : (
            <ul className="mini-list">
              {notifications.itens.slice(0, 3).map((n) => (
                <li key={n.id} className={n.lida ? undefined : "is-unread"}>
                  <Icon name={notificationIcon[n.tipo] || "bell"} size={16} />
                  <span>
                    <a href={n.link}>{n.titulo}</a>
                    <small>
                      {when.format(new Date(n.createdAt))}
                      {n.lida ? "" : " · não lida"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
        <OverviewCard id="dados" title="Meus dados" link="#dados" linkText="Editar">
          <dl className="mini-facts">
            <div>
              <dt>Nome</dt>
              <dd>{user.nome}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{user.telefone || "Não informado"}</dd>
            </div>
          </dl>
        </OverviewCard>
        <OverviewCard id="endereco" title="Endereço principal" link="#enderecos" linkText={main ? "Gerenciar" : "Adicionar"}>
          {main ? (
            <p className="overview-text">
              <strong>{main.apelido || "Endereço"}</strong>
              <br />
              {formatAddress(main)}
            </p>
          ) : (
            <Later>Nenhum endereço salvo. Salve um para escolher em um toque no checkout.</Later>
          )}
        </OverviewCard>
        <OverviewCard id="pagamento" title="Pagamento preferido" link="#pagamentos" linkText={pay ? "Alterar" : "Escolher"}>
          {pay ? (
            <>
              <p className="overview-text">
                <Icon name={pay.metodo === "pix" ? "pix" : pay.metodo === "cartao" ? "card" : "barcode"} size={18} />
                <strong>{paymentText(pay)}</strong>
              </p>
              <p className="muted small">Já vem marcado no checkout.</p>
            </>
          ) : (
            <Later>Ainda não escolhido. A forma preferida já vem marcada no checkout.</Later>
          )}
        </OverviewCard>
        <OverviewCard id="avisos" title="Avisos" link="#avisos" linkText="Ver avisos">
          {!alerts ? (
            <Later>Carregando avisos…</Later>
          ) : !live.length ? (
            <Later>Nenhum aviso ativo. Em qualquer produto, “Avisar se baixar o preço”; nos esgotados, “Avise-me”.</Later>
          ) : (
            <>
              <p className="overview-big">{live.length}</p>
              <p className="muted small">
                {[stock ? plural(stock, "aviso de reposição", "avisos de reposição") : "", price ? plural(price, "aviso de queda de preço", "avisos de queda de preço") : ""].filter(Boolean).join(" · ")}
              </p>
            </>
          )}
        </OverviewCard>
        <OverviewCard id="ajuda" title="Precisa de ajuda?" link="#ajuda" wide linkText="Mais assuntos">
          <ul className="quick-links">
            <li>
              <a href="#pedidos">
                <Icon name="truck" size={16} />
                Acompanhar um pedido
              </a>
            </li>
            <li>
              <a href="#ajuda">
                <Icon name="refresh" size={16} />
                Trocar ou devolver
              </a>
            </li>
            <li>
              <button type="button" className="text-button" data-open-assistant onClick={openAssistant}>
                <Icon name="chat" size={16} />
                Falar com o assistente
              </button>
            </li>
            <li>
              <a href="/ajuda.html">
                <Icon name="info" size={16} />
                Central de ajuda
              </a>
            </li>
          </ul>
        </OverviewCard>
      </div>
    </>
  );
}

// ---------- Pedidos ----------
function OrdersView({ orders, products, error, retry, setOrders }: { orders: Order[] | null; products: Product[]; error: Error | null; retry: () => void; setOrders: (o: Order[]) => void }) {
  const [group, setGroup] = useState("todos");
  const list = orders || [];
  const shown = list.filter(groups[group]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reorder = async (order: Order) => {
    const cart = getCart() as { id: string; quantidade: number }[];
    let added = 0;
    let missing = 0;
    for (const item of order.itens) {
      const p = products.find((x) => x.id === item.id);
      const current = cart.find((i) => i.id === item.id);
      const room = p ? Math.min(99, p.estoque) - (current?.quantidade || 0) : 0;
      const quantity = Math.min(item.quantidade, room);
      if (quantity < 1) {
        missing++;
        continue;
      }
      if (current) current.quantidade += quantity;
      else cart.push({ id: item.id, quantidade: quantity });
      added++;
    }
    if (!added) return toast("Os itens deste pedido não estão disponíveis agora.", { type: "info" });
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`${added} ${added === 1 ? "item voltou" : "itens voltaram"} para o carrinho.`);
    if (missing) toast(`${missing} ${missing === 1 ? "item está indisponível" : "itens estão indisponíveis"} no momento.`, { type: "info" });
  };
  const cancel = async (order: Order) => {
    const ok = await confirmDialog({
      title: `Cancelar o pedido #${numberOf(order)}?`,
      text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.",
      confirm: "Cancelar pedido",
      cancel: "Manter pedido",
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = (await send(`/orders/${order.id}/cancel`, {})) as Order;
      setOrders(list.map((o) => (o.id === updated.id ? updated : o)));
      toast("Pedido cancelado.", { type: "success" });
    } catch (e) {
      fail(e);
      retry();
    }
  };
  return (
    <>
      <div className="orders-head">
        <h2 id="orders-title" tabIndex={-1}>
          Meus pedidos
        </h2>
        <div className="chip-row" id="order-filters" role="group" aria-label="Filtrar pedidos">
          {groupLabels.map(([id, label]) => (
            <button type="button" className="chip" data-group={id} aria-pressed={group === id} key={id} onClick={() => setGroup(id)}>
              {label} <span className="chip-count">{list.filter(groups[id]).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div id="orders" className="order-list" aria-busy={!orders && !error}>
        {error ? (
          <LoadError error={error} retry={retry} level={3} title="Não foi possível carregar seus pedidos." />
        ) : !orders ? (
          <Loading text="Carregando compras…" />
        ) : shown.length ? (
          shown.map((o) => <OrderCard key={o.id} order={o} products={products} onReorder={() => reorder(o)} onCancel={() => cancel(o)} />)
        ) : list.length ? (
          <State symbol="package" title="Nenhum pedido neste filtro." level={3} />
        ) : (
          <State
            symbol="package"
            level={3}
            title="Nenhuma compra por aqui ainda."
            text="Quando você finalizar um pedido, ele aparece aqui com cada etapa da entrega."
            actions={
              <a className="button" href="/catalogo.html">
                Explorar equipamentos
              </a>
            }
          />
        )}
      </div>
    </>
  );
}

// ---------- Dados e segurança ----------
function ProfileForm({ user, onSaved }: { user: AccountUser; onSaved: (u: Partial<AccountUser>) => void }) {
  const phone = useRef<HTMLInputElement>(null);
  useEffect(() => maskPhone(phone.current), []);
  return (
    <Form
      id="profile-form"
      onSubmit={async (data) => {
        onSaved((await send("/profile", data, "PATCH")) as Partial<AccountUser>);
        toast("Dados atualizados.", { type: "success" });
      }}
    >
      <div className="field">
        <label htmlFor="nome">Nome completo</label>
        <Input id="nome" name="nome" type="text" required minLength={2} maxLength={200} autoComplete="name" defaultValue={user.nome || ""} />
      </div>
      <div className="field">
        <label htmlFor="email">E-mail de acesso</label>
        <Input id="email" name="email" type="email" readOnly describedBy="email-help" defaultValue={user.email || ""} />
        <p className="form-help" id="email-help">
          O e-mail identifica a conta e não pode ser alterado.
        </p>
      </div>
      <div className="field">
        <label htmlFor="telefone">Telefone</label>
        <Input id="telefone" name="telefone" type="tel" maxLength={30} autoComplete="tel" defaultValue={user.telefone || ""} ref={phone} />
      </div>
      <div className="field">
        <label htmlFor="endereco">Endereço do cadastro (opcional)</label>
        <Input id="endereco" name="endereco" type="text" maxLength={500} autoComplete="street-address" describedBy="endereco-help" defaultValue={user.endereco || ""} />
        <p className="form-help" id="endereco-help">
          Para entregas, prefira os <a href="#enderecos">endereços de entrega</a>: eles aparecem prontos no checkout.
        </p>
      </div>
      <SubmitButton className="full">Salvar meus dados</SubmitButton>
    </Form>
  );
}

function DeleteAccount({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    if (open) (form.current?.elements.namedItem("senha") as HTMLInputElement | null)?.focus();
    else opener.current?.focus();
  }, [open]);
  const toggle = (show: boolean) => {
    moved.current = true;
    setOpen(show);
  };
  return (
    <section className="panel privacy-block danger-zone" aria-labelledby="delete-title">
      <h3 id="delete-title">Excluir conta</h3>
      <p className="form-help" id="delete-help">
        {admin
          ? "Contas de administrador não podem ser excluídas por aqui."
          : "Apaga nome, telefone, endereços, avisos e notificações e encerra o acesso. Os pedidos ficam guardados sem seus dados pessoais, como registro da venda."}
      </p>
      <button type="button" className="danger full" id="delete-open" aria-expanded={open} aria-controls="delete-form" hidden={open} disabled={admin} ref={opener} onClick={() => toggle(true)}>
        Excluir minha conta
      </button>
      <Form
        id="delete-form"
        hidden={!open}
        formRef={form}
        onSubmit={async (data) => {
          const ok = await confirmDialog({
            title: "Excluir sua conta?",
            text: "Seus dados pessoais serão apagados e você sairá da loja. Essa ação não pode ser desfeita.",
            confirm: "Excluir conta",
            cancel: "Manter conta",
            danger: true,
          });
          if (!ok) return;
          await send("/account/delete", { senha: data.senha });
          try {
            sessionStorage.removeItem("vv_assistente");
          } catch {
            // Sem armazenamento da aba, não há conversa para apagar.
          }
          location.href = "/?conta=excluida";
        }}
      >
        <div className="field">
          <label htmlFor="delete-senha">Confirme com sua senha</label>
          <Input id="delete-senha" name="senha" type="password" required maxLength={72} autoComplete="current-password" describedBy="delete-help" />
        </div>
        <div className="row">
          <button
            type="button"
            className="secondary"
            id="delete-cancel"
            onClick={() => {
              form.current?.reset();
              toggle(false);
            }}
          >
            Manter conta
          </button>
          <SubmitButton className="danger-solid">Excluir definitivamente</SubmitButton>
        </div>
      </Form>
    </section>
  );
}

function DataView({ user, onSaved }: { user: AccountUser; onSaved: (u: Partial<AccountUser>) => void }) {
  return (
    <>
      <h2 id="data-title" tabIndex={-1}>
        Dados e segurança
      </h2>
      <div className="account-cards">
        <section className="panel profile-panel" aria-labelledby="profile-title">
          <h3 id="profile-title">Meus dados</h3>
          <ProfileForm user={user} onSaved={onSaved} />
        </section>
        <section className="panel security-panel" id="seguranca" aria-labelledby="password-title">
          <h3 id="password-title">Trocar senha</h3>
          <Form
            id="password-form"
            messages={{ nova: "Use de 10 a 72 caracteres." }}
            onSubmit={async (data, form) => {
              if (data.nova !== data.confirmacao) throw Object.assign(new Error("As duas senhas novas não são iguais."), { field: "confirmacao" });
              await send("/account/password", { atual: data.atual, nova: data.nova });
              form.reset();
              toast("Senha trocada. As outras sessões foram encerradas.", { type: "success" });
            }}
          >
            <div className="field">
              <label htmlFor="senha-atual">Senha atual</label>
              <PasswordInput id="senha-atual" name="atual" required maxLength={72} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="senha-nova">Nova senha</label>
              <PasswordInput id="senha-nova" name="nova" required minLength={10} maxLength={72} autoComplete="new-password" describedBy="senha-nova-help" />
              <p className="form-help" id="senha-nova-help">
                De 10 a 72 caracteres. As sessões abertas em outros aparelhos serão encerradas.
              </p>
            </div>
            <div className="field">
              <label htmlFor="senha-confirmacao">Repita a nova senha</label>
              <PasswordInput id="senha-confirmacao" name="confirmacao" required minLength={10} maxLength={72} autoComplete="new-password" />
            </div>
            <SubmitButton className="secondary full">Trocar senha</SubmitButton>
          </Form>
        </section>
        <section className="panel privacy-block" aria-labelledby="export-title">
          <h3 id="export-title">Baixar meus dados</h3>
          <p className="form-help">Arquivo com seu cadastro, endereços, pedidos, avisos de estoque e de preço, perguntas e notificações.</p>
          <a className="button secondary full" href="/api/account/export" download="violet-voltage-meus-dados.json" id="export-data">
            <Icon name="package" size={18} />
            Baixar meus dados
          </a>
          <p className="form-help">
            <a href="/privacidade.html">Como usamos seus dados</a>
          </p>
        </section>
        <DeleteAccount admin={user.role === "admin"} />
      </div>
    </>
  );
}

// ---------- Endereços ----------
function AddressesView({ addresses, onChange }: { addresses: Address[]; onChange: (list: Address[]) => void }) {
  const [editing, setEditing] = useState<{ current?: Address } | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const focusAdd = useRef(false);
  useEffect(() => {
    if (focusAdd.current && !editing) {
      focusAdd.current = false;
      add.current?.focus();
    }
  });
  const close = () => {
    focusAdd.current = true;
    setEditing(null);
  };
  const act = async (current: Address, action: "main" | "delete") => {
    try {
      if (action === "main") {
        onChange((await send(`/addresses/${encodeURIComponent(current.id)}`, { ...current, principal: true }, "PATCH")) as Address[]);
        toast("Endereço principal atualizado.", { type: "success" });
      } else {
        const ok = await confirmDialog({ title: "Excluir este endereço?", text: formatAddress(current), confirm: "Excluir", cancel: "Manter", danger: true });
        if (!ok) return;
        onChange((await send(`/addresses/${encodeURIComponent(current.id)}`, {}, "DELETE")) as Address[]);
        toast("Endereço excluído.", { type: "success" });
        focusAdd.current = true;
      }
    } catch (e) {
      fail(e);
    }
  };
  return (
    <>
      <div className="view-head">
        <h2 id="addresses-title" tabIndex={-1}>
          Endereços de entrega
        </h2>
        <button type="button" id="address-add" ref={add} hidden={addresses.length >= 5 || !!editing} onClick={() => setEditing({})}>
          <Icon name="plus" size={18} />
          Adicionar endereço
        </button>
      </div>
      <p className="form-help view-help">Até 5 endereços. O principal já vem escolhido no checkout, e o CEP preenche o estado sozinho.</p>
      <div id="address-editor" className={editing ? "address-editor panel" : "address-editor"}>
        {editing && (
          <AddressForm
            key={editing.current?.id || "novo"}
            current={editing.current}
            first={!addresses.length || Boolean(editing.current?.principal && addresses.length === 1)}
            onCancel={close}
            onSaved={(list) => {
              onChange(list);
              toast(editing.current ? "Endereço atualizado." : "Endereço salvo.", { type: "success" });
              close();
            }}
          />
        )}
      </div>
      <div className="address-list" id="address-list">
        {addresses.length ? (
          addresses.map((a) => (
            <article className={`address-card${a.principal ? " is-main" : ""}`} data-address={a.id} key={a.id}>
              <div className="address-text">
                <strong>{a.apelido || "Endereço"}</strong>
                {a.principal && <span className="badge badge-main">Principal</span>}
                <p>{formatAddress(a)}</p>
              </div>
              <div className="address-actions">
                <button type="button" className="text-button" data-edit onClick={() => setEditing({ current: a })}>
                  <Icon name="edit" size={16} />
                  Editar
                </button>
                {!a.principal && (
                  <button type="button" className="text-button" data-main onClick={() => act(a, "main")}>
                    Tornar principal
                  </button>
                )}
                <button type="button" className="text-button danger-text" data-delete onClick={() => act(a, "delete")}>
                  <Icon name="trash" size={16} />
                  Excluir
                </button>
              </div>
            </article>
          ))
        ) : (
          <State symbol="pin" level={3} title="Nenhum endereço salvo." text="Salve onde você recebe seus pedidos para escolher em um toque no checkout." />
        )}
      </div>
    </>
  );
}

// ---------- Métodos de pagamento ----------
const paymentCards: [string, IconName, string, string][] = [
  ["pix", "pix", "Pix", "Aprovação imediata após o pagamento."],
  ["cartao", "card", "Cartão de crédito", "Em até 10x sem juros, com parcela mínima de R$ 50,00."],
  ["boleto", "barcode", "Boleto", "Compensação em até 2 dias úteis."],
];
function PaymentsView({ saved, onSaved }: { saved: AccountUser["pagamento"]; onSaved: (p: AccountUser["pagamento"]) => void }) {
  const [metodo, setMetodo] = useState(saved?.metodo || "");
  return (
    <>
      <h2 id="payments-title" tabIndex={-1}>
        Métodos de pagamento
      </h2>
      <p className="lead view-help">Escolha a forma preferida: ela já vem marcada no checkout, e você pode trocar em cada compra.</p>
      <Form
        id="payment-form"
        className="payment-pref"
        onSubmit={async (data) => {
          if (!data.metodo) throw new Error("Escolha uma forma de pagamento.");
          const u = (await send("/account/payment", { metodo: data.metodo, parcelas: Number(data.parcelas || 1) }, "PATCH")) as AccountUser;
          onSaved(u.pagamento);
          toast(`Preferência salva: ${paymentText(u.pagamento)}.`, { type: "success" });
        }}
      >
        <fieldset>
          <legend className="sr-only">Forma de pagamento preferida</legend>
          <div className="payment-cards">
            {paymentCards.map(([id, symbol, label, text], index) => (
              // O selo "Preferida" fica na forma salva; o rádio marcado mostra a escolha ainda não salva.
              <label className={`payment-card${saved?.metodo === id ? " is-saved" : ""}`} key={id}>
                <input type="radio" name="metodo" value={id} required={index === 0} checked={metodo === id} onChange={() => setMetodo(id)} />
                <span className="payment-icon">
                  <Icon name={symbol} size={24} />
                </span>
                <span className="payment-text">
                  <strong>{label}</strong>
                  <small>{text}</small>
                </span>
                <span className="payment-check">
                  <Icon name="check" size={16} />
                  Preferida
                </span>
              </label>
            ))}
          </div>
          <FieldError name="metodo" />
        </fieldset>
        <div className="field payment-installments" id="payment-installments" hidden={metodo !== "cartao"}>
          <label htmlFor="payment-parcelas">Parcelas preferidas no cartão</label>
          <select id="payment-parcelas" name="parcelas" aria-describedby="payment-parcelas-help" defaultValue={String(saved?.parcelas || 1)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "À vista (1x)" : `${n}x sem juros`}
              </option>
            ))}
          </select>
          <p className="form-help" id="payment-parcelas-help">
            Se o total do pedido não permitir esse número de parcelas, o checkout usa o máximo disponível.
          </p>
        </div>
        <SubmitButton>Salvar preferência</SubmitButton>
      </Form>
      <aside className="panel payment-safe" aria-labelledby="payment-safe-title">
        <span className="help-card-icon">
          <Icon name="shield" size={22} />
        </span>
        <div>
          <h3 id="payment-safe-title">Seus dados de pagamento ficam com você</h3>
          <p>A Violet Voltage não pede nem guarda número de cartão, código de segurança ou dados bancários. O pedido registra só a forma escolhida e o número de parcelas.</p>
        </div>
      </aside>
    </>
  );
}

// ---------- Avisos ----------
function AlertsView({ alerts, error, retry, setAlerts }: { alerts: Alert[] | null; error: Error | null; retry: () => void; setAlerts: (a: Alert[]) => void }) {
  const shown = (alerts || []).filter((a) => a.produto);
  const remove = async (id: string, tipo: string) => {
    try {
      await send(`/alerts/${encodeURIComponent(id)}${tipo === "preco" ? "?tipo=preco" : ""}`, {}, "DELETE");
      setAlerts((alerts || []).filter((x) => !(x.productId === id && (x.tipo || "estoque") === tipo)));
      toast("Aviso removido.", { type: "success" });
    } catch (e) {
      fail(e);
    }
  };
  let body: ReactNode;
  if (error) body = <LoadError error={error} retry={retry} level={3} title="Não foi possível carregar seus avisos." />;
  else if (!alerts) body = <Loading text="Carregando avisos…" />;
  else if (!shown.length)
    body = <State symbol="bell" level={3} title="Nenhum aviso ativo." text="Nos itens esgotados, toque em “Avise-me quando chegar”. Em qualquer produto, “Avisar se baixar o preço”." />;
  else
    body = (
      <ul className="alert-items">
        {shown.map((a) => {
          const p = a.produto!;
          const price = a.tipo === "preco";
          const back = price ? Boolean(a.notifiedAt) || p.priceCents < a.priceCents : p.estoque > 0;
          const stateText = price ? (back ? `Baixou: agora ${money(p.priceCents)}` : `Aguardando queda de preço (hoje ${money(p.priceCents)})`) : back ? "Disponível novamente" : "Aguardando reposição";
          return (
            <li className="alert-item" key={`${p.id}|${price ? "preco" : "estoque"}`}>
              <img src={productImage(p)} alt="" width={52} height={52} />
              <div className="alert-info">
                <a href={`/produto.html?id=${encodeURIComponent(p.id)}`}>
                  {p.marca} {p.modelo}
                </a>
                <span className={`alert-state ${back ? "is-back" : "is-waiting"}`}>
                  <Icon name={price ? "tag" : "bell"} size={14} />
                  {stateText}
                </span>
              </div>
              <div className="alert-actions">
                {back && p.estoque > 0 && (
                  <button
                    type="button"
                    className="button"
                    data-alert-cart={p.id}
                    onClick={(e) => addCart(p, 1, { source: e.currentTarget.closest("li")?.querySelector("img") })}
                  >
                    <Icon name="bag" size={16} />
                    Adicionar
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  data-alert-remove={`${p.id}|${price ? "preco" : "estoque"}`}
                  aria-label={`Remover aviso ${price ? "de preço" : "de estoque"} de ${p.marca} ${p.modelo}`}
                  onClick={() => remove(p.id, price ? "preco" : "estoque")}
                >
                  Remover
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  return (
    <>
      <h2 id="alerts-title" tabIndex={-1}>
        Avisos de estoque e preço
      </h2>
      <p className="form-help view-help">
        Nos itens esgotados, “Avise-me quando chegar”. Em qualquer produto ou nos <a href="/favoritos.html">favoritos</a>, “Avisar se baixar o preço”.
      </p>
      <div id="alert-list">{body}</div>
    </>
  );
}

// ---------- Notificações ----------
function NotificationsView({ data, mark }: { data: Notifications | null; mark: (ids?: string[]) => Promise<void> }) {
  const items = data?.itens || [];
  const unread = data?.naoLidas || 0;
  return (
    <>
      <div className="view-head">
        <h2 id="notifications-title" tabIndex={-1}>
          Notificações{" "}
          <span className="chip-count" id="notifications-unread" hidden={!unread}>
            {unread || ""}
          </span>
        </h2>
        <button
          type="button"
          className="text-button"
          id="notifications-read"
          hidden={!unread}
          onClick={async () => {
            try {
              await mark();
              toast("Notificações marcadas como lidas.", { type: "success" });
            } catch (e) {
              fail(e);
            }
          }}
        >
          Marcar todas como lidas
        </button>
      </div>
      <div className="panel">
        <ul className="notification-list" id="notification-list" hidden={!items.length}>
          {items.map((n) => (
            <li className={`notification${n.lida ? "" : " is-unread"}`} key={n.id}>
              <span className="notification-icon">
                <Icon name={notificationIcon[n.tipo] || "bell"} size={18} />
              </span>
              <div>
                <a
                  href={n.link}
                  data-read={n.id}
                  onClick={async (event) => {
                    if (event.metaKey || event.ctrlKey) return;
                    event.preventDefault();
                    const href = event.currentTarget.href;
                    await mark([n.id]).catch(() => {});
                    location.href = href;
                  }}
                >
                  {n.titulo}
                </a>
                <p>{n.texto}</p>
                <time dateTime={n.createdAt}>{when.format(new Date(n.createdAt))}</time>
              </div>
              {!n.lida && (
                <span className="unread-dot">
                  <span className="sr-only">Não lida</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div id="notifications-empty" hidden={!data || !!items.length}>
          {data && !items.length && (
            <State symbol="bell" level={3} title="Nenhuma notificação." text="Mudanças nos seus pedidos, respostas às suas perguntas e avisos de estoque e preço aparecem aqui." />
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Ajuda ----------
function HelpView({ openAssistant }: { openAssistant: () => void }) {
  const card = (symbol: IconName, title: string, text: string, action: ReactNode) => (
    <article className="panel help-card" key={title}>
      <span className="help-card-icon">
        <Icon name={symbol} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </article>
  );
  const link = (href: string, label: string) => (
    <a className="text-link" href={href}>
      {label} <Icon name="arrowRight" size={16} />
    </a>
  );
  return (
    <>
      <h2 id="help-title" tabIndex={-1}>
        Preciso de ajuda
      </h2>
      <p className="lead view-help">Escolha o assunto. Se a dúvida continuar, o assistente responde na hora.</p>
      <div className="help-cards">
        {card("truck", "Onde está meu pedido?", "Cada pedido mostra a etapa atual, a previsão de entrega e, depois de enviado, o código de rastreio.", link("#pedidos", "Ver meus pedidos"))}
        {card(
          "refresh",
          "Trocar ou devolver",
          "Até 7 dias depois do recebimento: abra o comprovante do pedido concluído e use “Troca ou devolução”. A loja responde nas notificações.",
          link("#pedidos", "Escolher o pedido"),
        )}
        {card(
          "close",
          "Cancelar um pedido",
          "Enquanto o pedido estiver “Recebido”, use “Cancelar pedido” no cartão dele. Depois que a preparação começa, quem cancela é a loja.",
          link("#pedidos", "Ver pedidos em andamento"),
        )}
        {card(
          "chat",
          "Falar com o assistente",
          "Dúvidas sobre produtos, frete, pagamento e pedidos, respondidas na hora.",
          <button type="button" className="secondary" data-open-assistant onClick={openAssistant}>
            <Icon name="chat" size={18} />
            Abrir o assistente
          </button>,
        )}
        {card("shield", "Senha e dados", "Troque a senha, baixe uma cópia dos seus dados ou exclua a conta.", link("#dados", "Dados e segurança"))}
        {card("info", "Central de ajuda", "Entregas, pagamentos, cupons, produtos e trocas em respostas diretas.", link("/ajuda.html", "Abrir a Central de ajuda"))}
      </div>
    </>
  );
}

// "Falar com o assistente": abre o painel do assistente, se ele já carregou.
function openAssistant() {
  const launcher = document.querySelector<HTMLElement>(".assistant-launcher");
  if (launcher) {
    if (launcher.getAttribute("aria-expanded") !== "true") launcher.click();
  } else toast("O assistente ainda está carregando. Tente de novo em instantes ou use a Central de ajuda.", { type: "info" });
}

// ---------- Página ----------
function Shell({ user, crumb = "Visão geral", children }: { user?: AccountUser; crumb?: string; children: ReactNode }) {
  return (
    <div className="container page-wrap account-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <a href="/minha-conta.html" id="account-crumb-home">
          Minha conta
        </a>
        <span aria-hidden="true">/</span>
        <span id="account-crumb" aria-current="page">
          {crumb}
        </span>
      </nav>
      <header className="account-hero">
        <span className="account-avatar account-avatar-lg" id="account-avatar" aria-hidden="true">
          {user ? initials(user.nome) : ""}
        </span>
        <div className="account-hero-text">
          <span className="eyebrow">Minha conta</span>
          <h1 className="page-title" id="account-greeting">
            {user ? `Olá, ${user.nome.split(" ")[0]}.` : "Seu espaço, seu som."}
          </h1>
          <p className="lead" id="account-email">
            {user ? user.email : "Pedidos, dados, endereços e avisos em um só lugar."}
          </p>
        </div>
        <button type="button" id="logout" className="secondary" onClick={() => logout()}>
          <Icon name="logout" size={18} />
          Sair da conta
        </button>
      </header>
      {children}
    </div>
  );
}

function AccountPage({ initialUser }: { initialUser: AccountUser }) {
  const [user, setUser] = useState(initialUser);
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash) as Route);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<Error | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notifications | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [alertsError, setAlertsError] = useState<Error | null>(null);
  const navList = useRef<HTMLUListElement>(null);
  const moveFocus = useRef(false);

  const loadOrders = useCallback(async () => {
    setOrdersError(null);
    setOrders(null);
    try {
      const [list, catalog] = await Promise.all([api("/orders") as Promise<Order[]>, (catalogProducts() as Promise<Product[]>).catch(() => [] as Product[])]);
      setProducts(catalog);
      setOrders(list);
    } catch (error) {
      setOrdersError(error as Error);
    }
  }, []);
  const loadAlerts = useCallback(async () => {
    setAlertsError(null);
    try {
      setAlerts((await api("/alerts")) as Alert[]);
    } catch (error) {
      setAlerts([]);
      setAlertsError(error as Error);
    }
  }, []);
  useEffect(() => {
    loadOrders();
    loadAlerts();
    (api("/notifications") as Promise<Notifications>).then(setNotifications, () => setNotifications({ itens: [], naoLidas: 0 }));
    const onHash = () => {
      moveFocus.current = true;
      setRoute(routeFromHash(location.hash) as Route);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [loadOrders, loadAlerts]);
  useEffect(() => {
    if (notifications) setUnread(notifications.naoLidas);
  }, [notifications]);

  const label = VIEWS.find((v) => v.id === route.view)!.label;
  useEffect(() => {
    document.title = `${route.view === "visao-geral" ? "Minha conta" : label} | Violet Voltage`;
    // Na navegação em abas (celular), a aba ativa fica à vista.
    const list = navList.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && active && list.scrollWidth > list.clientWidth) list.scrollTo({ left: Math.max(0, active.parentElement!.offsetLeft - 16) });
    if (route.anchor) document.getElementById(route.anchor)?.scrollIntoView({ block: "start" });
    else if (moveFocus.current) {
      const layout = document.querySelector(".account-layout");
      if (layout && layout.getBoundingClientRect().top < 0) layout.scrollIntoView({ block: "start" });
      document.getElementById(route.view)?.querySelector("h2")?.focus({ preventScroll: true });
    }
    moveFocus.current = false;
  }, [route, label]);

  const mark = async (ids?: string[]) => {
    const result = (await send("/notifications/read", ids ? { ids } : {})) as { naoLidas: number };
    setNotifications((current) =>
      current && {
        itens: current.itens.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida: true } : n)),
        naoLidas: result.naoLidas,
      },
    );
  };
  const view = (id: string, labelledBy: string, children: ReactNode, className = "account-view") => (
    <section className={className} id={id} data-view aria-labelledby={labelledBy} hidden={route.view !== id}>
      {children}
    </section>
  );
  const unread = notifications?.naoLidas || 0;
  return (
    <Shell user={user} crumb={label}>
      <div className="account-layout">
        <nav className="account-nav" id="account-nav" aria-label="Seções da conta">
          <ul ref={navList}>
            {VIEWS.map((v) => (
              <li key={v.id}>
                <a href={`#${v.id}`} data-view-link={v.id} aria-current={route.view === v.id ? "page" : undefined}>
                  <Icon name={v.icon} size={18} />
                  <span>{v.label}</span>
                  {v.id === "notificacoes" && (
                    <span className="nav-count" id="nav-unread" hidden={!unread}>
                      {unread || ""}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="account-views">
          {view(
            "visao-geral",
            "overview-title",
            <>
              <h2 id="overview-title" tabIndex={-1}>
                Visão geral
              </h2>
              <Overview user={user} orders={orders} notifications={notifications} alerts={alerts} openAssistant={openAssistant} />
            </>,
          )}
          {view("pedidos", "orders-title", <OrdersView orders={orders} products={products} error={ordersError} retry={loadOrders} setOrders={setOrders} />)}
          {view("dados", "data-title", <DataView user={user} onSaved={(u) => setUser((current) => ({ ...current, ...u }))} />)}
          {view("enderecos", "addresses-title", <AddressesView addresses={user.enderecos || []} onChange={(enderecos) => setUser((current) => ({ ...current, enderecos }))} />)}
          {view("pagamentos", "payments-title", <PaymentsView saved={user.pagamento} onSaved={(pagamento) => setUser((current) => ({ ...current, pagamento }))} />)}
          {view("avisos", "alerts-title", <AlertsView alerts={alerts} error={alertsError} retry={loadAlerts} setAlerts={setAlerts} />)}
          {view("notificacoes", "notifications-title", <NotificationsView data={notifications} mark={mark} />, "account-view notifications-panel")}
          {view("ajuda", "help-title", <HelpView openAssistant={openAssistant} />)}
        </div>
      </div>
    </Shell>
  );
}

export default function Account() {
  return (
    <Private
      loading={
        <Shell>
          <Loading text="Carregando sua conta…" />
        </Shell>
      }
    >
      {(user) => <AccountPage initialUser={user} />}
    </Private>
  );
}
