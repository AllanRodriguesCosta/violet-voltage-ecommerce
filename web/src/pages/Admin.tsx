// Painel administrativo: indicadores e abas de produtos (cadastro, ficha técnica, estoque por cor
// e imagem), clientes, pedidos (status e trocas), perguntas, encomendas, parcerias, cupons e
// frases que o assistente não entendeu. Só para administradores; a API confere o papel.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { api, send, toast, type Product } from "../lib/shop";
import { confirmDialog } from "../lib/confirm";
import { useSession } from "../lib/session";
import { categories, money, normalize, productImage } from "../../../shared/catalog.js";
import { allowedNext, statuses } from "../../../shared/orders.js";
import { specFields, type SpecField } from "../lib/catalog";
import { Stats, type Summary } from "../components/AdminDashboard";
import { Fact, Timeline, TotalsFacts, Tracking, deliveryName, numberOf, paymentName, statusOf, type Order } from "../components/OrderParts";
import { LoadError, Loading, Private } from "../components/Private";
import { State } from "../components/State";
import { FieldHint, KitForm, SubmitButton, useFormKit, type FormKit, type FormValues } from "../components/FormKit";

type Tab = "products" | "customers" | "orders" | "questions" | "requests" | "partners" | "coupons" | "assistant";
const TABS: [Tab, string][] = [
  ["products", "Produtos"],
  ["customers", "Clientes"],
  ["orders", "Pedidos"],
  ["questions", "Perguntas"],
  ["requests", "Encomendas"],
  ["partners", "Parcerias"],
  ["coupons", "Cupons"],
  ["assistant", "Assistente"],
];
type Customer = { id: string; nome: string; email: string; telefone?: string; endereco?: string; role: string };
type AdminProduct = Product & { cores?: { nome: string; hex: string; estoque?: number }[] };
type AdminOrder = Order & { partitionKey: string };
const fail = (e: unknown) => toast((e as Error).message, { type: "error" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// Busca da aba (filtra a lista já carregada).
function Toolbar({ title, query, onQuery, children }: { title: ReactNode; query: string; onQuery: (q: string) => void; children?: ReactNode }) {
  return (
    <div className="admin-toolbar">
      <h2>{title}</h2>
      <div className="row">
        <div className="admin-search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="admin-search">
            Buscar
          </label>
          <input id="admin-search" type="search" placeholder="Buscar" value={query} autoComplete="off" onChange={(e) => onQuery(e.target.value)} />
        </div>
        {children}
      </div>
    </div>
  );
}
const matches = (query: string, text: string) => !normalize(query) || normalize(text).includes(normalize(query));

// ---------- Produtos e clientes ----------
function SpecsEditor({ categoria, ficha = {} }: { categoria: string; ficha?: Record<string, unknown> }) {
  const fields = specFields(categoria) as (SpecField & { type?: string; min?: number; max?: number; maxLength?: number })[];
  return (
    <fieldset className="admin-specs">
      <legend>Ficha técnica (opcional)</legend>
      <p className="form-help">Usada nos filtros do catálogo e na página do produto.</p>
      <div className="form-grid">
        {fields.map((f) => {
          const id = `spec-${f.key}`;
          const value = ficha?.[f.key];
          if (f.type === "multi")
            return (
              <fieldset className="field span-two" key={f.key}>
                <legend>{f.label}</legend>
                <div className="facet-list">
                  {(f.values || []).map((v) => (
                    <label className="facet" key={v}>
                      <input type="checkbox" name={`ficha.${f.key}`} value={v} defaultChecked={Array.isArray(value) && value.includes(v)} />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          if (f.type === "enum")
            return (
              <div className="field" key={f.key}>
                <label htmlFor={id}>{f.label}</label>
                <select id={id} name={`ficha.${f.key}`} defaultValue={typeof value === "string" ? value : ""}>
                  <option value="">Não informado</option>
                  {(f.values || []).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            );
          if (f.type === "number")
            return (
              <div className="field" key={f.key}>
                <label htmlFor={id}>{f.label}</label>
                <input id={id} name={`ficha.${f.key}`} type="number" min={f.min} max={f.max} step="any" defaultValue={value === undefined || value === null ? "" : String(value)} />
              </div>
            );
          return (
            <div className="field" key={f.key}>
              <label htmlFor={id}>{f.label}</label>
              <input id={id} name={`ficha.${f.key}`} type="text" maxLength={f.maxLength} defaultValue={value === undefined || value === null ? "" : String(value)} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
function readSpecs(form: HTMLFormElement, categoria: string) {
  const ficha: Record<string, unknown> = {};
  for (const f of specFields(categoria) as (SpecField & { type?: string })[]) {
    const inputs = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="ficha.${f.key}"]`)];
    if (f.type === "multi") ficha[f.key] = inputs.filter((i) => (i as HTMLInputElement).checked).map((i) => i.value);
    else if (inputs[0] && inputs[0].value !== "") ficha[f.key] = f.type === "number" ? Number(inputs[0].value) : inputs[0].value;
  }
  return ficha;
}

function Field({ kit, name, label, children }: { kit: FormKit; name: string; label: string; children: (a11y: ReturnType<FormKit["a11y"]>) => ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={`edit-${name}`}>{label}</label>
      {children(kit.a11y(name))}
      <FieldHint kit={kit} name={name} />
    </div>
  );
}

function RecordForm({ product, item, onSaved, onCancel }: { product: boolean; item: Partial<AdminProduct & Customer>; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [categoria, setCategoria] = useState(item.categoria || categories[0]);
  const kit = useFormKit({
    onSubmit: async (data: FormValues, form) => {
      const body: Record<string, unknown> = { ...data };
      if (product) {
        body.priceCents = Math.round(Number(data.preco) * 100);
        body.estoque = Number(data.estoque);
        for (const key of Object.keys(body)) if (key.startsWith("ficha.")) delete body[key];
        body.ficha = readSpecs(form, data.categoria);
        const colorInputs = [...form.querySelectorAll<HTMLInputElement>("[data-color-stock]")];
        if (colorInputs.length) body.estoqueCores = Object.fromEntries(colorInputs.map((el) => [el.dataset.colorStock, el.value === "" ? null : Number(el.value)]));
      }
      await send(`/admin/${product ? "products" : "customers"}${item.id ? `/${item.id}` : ""}`, body, item.id ? "PATCH" : "POST");
      toast("Registro salvo.", { type: "success" });
      await onSaved();
    },
  });
  useEffect(() => kit.ref.current?.querySelector("input")?.focus(), [kit.ref]);
  return (
    <KitForm kit={kit} className="admin-form" id="record-form">
      <h3>
        {item.id ? "Editar" : "Cadastrar"} {product ? "produto" : "cliente"}
      </h3>
      <div className="form-grid">
        {product ? (
          <>
            <Field kit={kit} name="marca" label="Marca">
              {(a) => <input id="edit-marca" name="marca" type="text" defaultValue={item.marca || ""} required maxLength={200} {...a} />}
            </Field>
            <Field kit={kit} name="modelo" label="Modelo">
              {(a) => <input id="edit-modelo" name="modelo" type="text" defaultValue={item.modelo || ""} required maxLength={200} {...a} />}
            </Field>
            <div className="field">
              <label htmlFor="edit-categoria">Categoria</label>
              <select id="edit-categoria" name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <Field kit={kit} name="preco" label="Preço (R$)">
              {(a) => (
                <input id="edit-preco" name="preco" type="number" defaultValue={item.priceCents ? (item.priceCents / 100).toFixed(2) : ""} required min="0.01" max="1000000" step="0.01" {...a} />
              )}
            </Field>
            <Field kit={kit} name="estoque" label="Estoque">
              {(a) => <input id="edit-estoque" name="estoque" type="number" defaultValue={item.estoque ?? 0} required min="0" max="100000" step="1" {...a} />}
            </Field>
            {Array.isArray(item.cores) && item.cores.length > 0 && (
              <fieldset className="field field-wide color-stock-editor">
                <legend>Estoque por cor (opcional)</legend>
                <p className="form-help">Deixe em branco para não controlar por cor. A soma não pode passar do estoque total.</p>
                <div className="form-grid">
                  {item.cores.map((c, i) => (
                    <div className="field" key={c.nome}>
                      <label htmlFor={`cor-estoque-${i}`}>{c.nome}</label>
                      <input id={`cor-estoque-${i}`} type="number" min="0" max="100000" step="1" data-color-stock={c.nome} defaultValue={Number.isInteger(c.estoque) ? c.estoque : ""} />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="field span-two">
              <label htmlFor="edit-descricao">Descrição</label>
              <textarea id="edit-descricao" name="descricao" required minLength={10} maxLength={4000} defaultValue={item.descricao || ""} {...kit.a11y("descricao")} />
              <FieldHint kit={kit} name="descricao" />
            </div>
            <div className="span-two" id="edit-specs">
              {/* Trocar a categoria troca os campos da ficha (os valores anteriores não se aplicam). */}
              <SpecsEditor key={categoria} categoria={categoria} ficha={categoria === item.categoria ? item.ficha : {}} />
            </div>
          </>
        ) : (
          <>
            <Field kit={kit} name="nome" label="Nome completo">
              {(a) => <input id="edit-nome" name="nome" type="text" defaultValue={item.nome || ""} required minLength={2} maxLength={200} {...a} />}
            </Field>
            <Field kit={kit} name="email" label="E-mail">
              {(a) => <input id="edit-email" name="email" type="email" defaultValue={item.email || ""} {...(item.id ? { readOnly: true } : { required: true, maxLength: 200 })} {...a} />}
            </Field>
            <Field kit={kit} name="telefone" label="Telefone">
              {(a) => <input id="edit-telefone" name="telefone" type="tel" defaultValue={item.telefone || ""} maxLength={30} {...a} />}
            </Field>
            <Field kit={kit} name="endereco" label="Endereço">
              {(a) => <input id="edit-endereco" name="endereco" type="text" defaultValue={item.endereco || ""} maxLength={500} {...a} />}
            </Field>
            {!item.id && (
              <Field kit={kit} name="senha" label="Senha inicial (10 a 72 caracteres)">
                {(a) => <input id="edit-senha" name="senha" type="password" required minLength={10} maxLength={72} autoComplete="new-password" {...a} />}
              </Field>
            )}
          </>
        )}
      </div>
      <div className="row">
        <SubmitButton kit={kit}>Salvar {product ? "produto" : "cliente"}</SubmitButton>
        <button type="button" id="cancel-edit" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </KitForm>
  );
}

function ImageForm({ item, onSaved }: { item: AdminProduct; onSaved: () => Promise<void> }) {
  const kit = useFormKit({
    onSubmit: async (_data, form) => {
      const file = (form.elements.namedItem("image") as HTMLInputElement).files?.[0];
      if (file && file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
      await api(`/admin/products/${item.id}/image`, { method: "POST", body: new FormData(form) });
      toast("Imagem atualizada.", { type: "success" });
      await onSaved();
    },
  });
  return (
    <KitForm kit={kit} id="image-form" className="admin-form">
      <h3>Imagem de {item.modelo}</h3>
      <img className="image-preview" src={productImage(item)} alt={`Imagem atual de ${item.modelo}`} />
      <p className="form-help">JPEG, PNG ou WebP, até 5 MB. Use apenas imagens próprias ou licenciadas. A imagem anterior será substituída.</p>
      <div className="field">
        <label htmlFor="image">Escolher imagem</label>
        <input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp" required {...kit.a11y("image")} />
        <FieldHint kit={kit} name="image" />
      </div>
      <SubmitButton kit={kit}>Enviar imagem</SubmitButton>
    </KitForm>
  );
}

type Editor = { kind: "edit"; item: Partial<AdminProduct & Customer> } | { kind: "image"; item: AdminProduct } | { kind: "history"; customer: Customer; orders: AdminOrder[] } | null;
function RecordsTab({ product, onStats }: { product: boolean; onStats: () => void }) {
  const [items, setItems] = useState<(AdminProduct & Customer)[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      setItems(await api(product ? "/products" : "/admin/customers"));
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, [product]);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const saved = async () => {
    setEditor(null);
    await load();
    onStats();
  };
  const searchText = (i: AdminProduct & Customer) => (product ? `${i.marca} ${i.modelo} ${i.categoria}` : `${i.nome} ${i.email}`);
  const visible = items.filter((i) => matches(query, searchText(i)));
  const remove = async (id: string, button: HTMLButtonElement) => {
    if (!(await confirmDialog({ title: "Excluir este registro?", text: "A exclusão é lógica: o histórico de pedidos é preservado.", confirm: "Excluir", danger: true }))) return;
    button.disabled = true;
    try {
      await api(`/admin/${product ? "products" : "customers"}/${id}`, { method: "DELETE" });
      toast("Registro excluído.", { type: "success" });
      await load();
      onStats();
    } catch (e) {
      fail(e);
      button.disabled = false;
    }
  };
  const history = async (customer: Customer) => {
    try {
      const orders = (await api<AdminOrder[]>("/admin/orders")).filter((o) => o.partitionKey === customer.id);
      setEditor({ kind: "history", customer, orders });
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: "start" }));
    } catch (e) {
      fail(e);
    }
  };
  return (
    <>
      <Toolbar title={product ? "Equipamentos" : "Clientes"} query={query} onQuery={setQuery}>
        <button id="new-record" onClick={() => setEditor({ kind: "edit", item: {} })}>
          <Icon name="plus" size={18} />
          {product ? "Cadastrar produto" : "Cadastrar cliente"}
        </button>
      </Toolbar>
      <div id="editor" ref={editorRef}>
        {editor?.kind === "edit" && <RecordForm key={editor.item.id || "novo"} product={product} item={editor.item} onSaved={saved} onCancel={() => setEditor(null)} />}
        {editor?.kind === "image" && <ImageForm key={editor.item.id} item={editor.item} onSaved={saved} />}
        {editor?.kind === "history" && (
          <section className="admin-form">
            <h3>Compras de {editor.customer.nome}</h3>
            {editor.orders.length ? editor.orders.map((o) => <AdminOrderCard key={o.id} order={o} readonly />) : <p className="muted">Nenhuma compra registrada.</p>}
          </section>
        )}
      </div>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{product ? "Produto" : "Cliente"}</th>
                <th>{product ? "Preço" : "Contato"}</th>
                <th>{product ? "Estoque" : "Papel"}</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} data-search={normalize(searchText(i))} hidden={!visible.includes(i)}>
                  <td>
                    {product ? (
                      <div className="admin-product">
                        <img src={productImage(i)} alt="" loading="lazy" />
                        <div>
                          <strong>{i.modelo}</strong>
                          <small>
                            {i.marca} · {i.categoria}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <>
                        <strong>{i.nome}</strong>
                        <small>{i.email}</small>
                      </>
                    )}
                  </td>
                  <td>{product ? money(i.priceCents) : i.telefone || "—"}</td>
                  <td>{product ? <span className={`badge ${i.estoque === 0 ? "badge-out" : i.estoque <= 5 ? "badge-low" : ""}`}>{i.estoque} un.</span> : i.role === "admin" ? "Administrador" : "Cliente"}</td>
                  <td className="actions">
                    <button className="secondary" data-edit={i.id} onClick={() => setEditor({ kind: "edit", item: i })}>
                      Editar
                    </button>
                    {product ? (
                      <button className="secondary" data-image={i.id} onClick={() => setEditor({ kind: "image", item: i })}>
                        Imagem
                      </button>
                    ) : (
                      <button className="secondary" data-history={i.id} onClick={() => history(i)}>
                        Compras
                      </button>
                    )}
                    {i.role !== "admin" && (
                      <button className="danger" data-delete={i.id} onClick={(e) => remove(i.id, e.currentTarget)}>
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div id="no-results" hidden={visible.length > 0}>
            <State symbol="search" title="Nada encontrado com essa busca." level={3} />
          </div>
        </div>
      ) : (
        <State symbol="grid" title="Nenhum registro cadastrado." level={3} />
      )}
    </>
  );
}

// ---------- Pedidos ----------
function AdminExchange({ order, admin, onUpdated }: { order: AdminOrder; admin: boolean; onUpdated?: (o: AdminOrder) => void }) {
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
      {admin && t.status === "Aberta" && (
        <form
          className="exchange-admin"
          data-exchange={order.id}
          onSubmit={async (event) => {
            event.preventDefault();
            const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const status = submitter?.value;
            const resposta = (event.currentTarget.elements.namedItem("resposta") as HTMLInputElement).value;
            try {
              const updated = await send<AdminOrder>(`/admin/orders/${order.id}/troca`, { status, resposta }, "PATCH");
              onUpdated?.(updated);
              toast(`Solicitação ${status === "Aprovada" ? "aprovada" : "recusada"}; o cliente foi avisado.`, { type: "success" });
            } catch (e) {
              fail(e);
            }
          }}
        >
          <label className="sr-only" htmlFor={`exchange-reply-${order.id}`}>
            Resposta ao cliente
          </label>
          <input id={`exchange-reply-${order.id}`} name="resposta" maxLength={500} placeholder="Resposta ao cliente (opcional)" />
          <button type="submit" name="status" value="Aprovada" className="small-button">
            Aprovar
          </button>
          <button type="submit" name="status" value="Recusada" className="secondary small-button">
            Recusar
          </button>
        </form>
      )}
    </div>
  );
}
function AdminOrderCard({ order, customer, readonly = false, onStatus, onUpdated }: { order: AdminOrder; customer?: string; readonly?: boolean; onStatus?: (status: string, select: HTMLSelectElement) => void; onUpdated?: (o: AdminOrder) => void }) {
  const items = order.itens;
  const count = items.reduce((s, i) => s + i.quantidade, 0);
  const next = allowedNext(order.status);
  return (
    <article className="order-card" data-order-id={order.id}>
      <header className="order-card-head">
        <div>
          <strong>Pedido #{numberOf(order)}</strong>
          <small>
            {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            {customer ? ` · ${customer}` : ""}
          </small>
        </div>
        <span className={`status status-${statusOf(order.status)}`}>{order.status}</span>
      </header>
      <div className="order-thumbs">
        {items.slice(0, 4).map((i, index) => (
          <img key={`${i.id}-${index}`} src={productImage({ categoria: "" })} alt={i.nome} width={52} height={52} title={i.nome} />
        ))}
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
      <AdminExchange order={order} admin={!readonly} onUpdated={onUpdated} />
      {!readonly && (
        <footer className="order-actions">
          {next.length ? (
            <>
              <label className="sr-only" htmlFor={`status-${order.id}`}>
                Novo status
              </label>
              <select id={`status-${order.id}`} data-status-select defaultValue="" onChange={(e) => e.target.value && onStatus?.(e.target.value, e.target)}>
                <option value="">Alterar status…</option>
                {next.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="small muted">Pedido encerrado.</span>
          )}
        </footer>
      )}
    </article>
  );
}
function OrdersTab({ onStats }: { onStats: () => void }) {
  const [data, setData] = useState<{ orders: AdminOrder[]; customers: Customer[] } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const [orders, customers] = await Promise.all([api<AdminOrder[]>("/admin/orders"), api<Customer[]>("/admin/customers")]);
      setData({ orders, customers });
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!data) return <Loading />;
  const names = new Map(data.customers.map((c) => [c.id, c.nome]));
  const replace = (updated: AdminOrder) => setData((d) => d && { ...d, orders: d.orders.map((o) => (o.id === updated.id ? updated : o)) });
  const list = data.orders
    .filter((o) => filter === "todos" || o.status === filter)
    .filter((o) => matches(query, `${o.id} ${names.get(o.partitionKey) || ""}`))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const changeStatus = async (order: AdminOrder, status: string, select: HTMLSelectElement) => {
    if (status === "Cancelado" && !(await confirmDialog({ title: "Cancelar este pedido?", text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.", confirm: "Cancelar pedido", cancel: "Manter", danger: true }))) {
      select.value = "";
      return;
    }
    select.disabled = true;
    try {
      const updated = await send<AdminOrder>(`/admin/orders/${order.id}`, { status }, "PATCH");
      replace(updated);
      select.value = "";
      select.disabled = false;
      toast(status === "Cancelado" ? "Pedido cancelado; itens devolvidos ao estoque." : `Status alterado para ${status}.`, { type: "success" });
      onStats();
    } catch (e) {
      fail(e);
      // O cartão continua o mesmo (status inalterado): o seletor volta a funcionar para nova tentativa.
      select.value = "";
      select.disabled = false;
      await load();
    }
  };
  return (
    <>
      <Toolbar title="Pedidos" query={query} onQuery={setQuery} />
      <p className="form-help">Status avançam no fluxo; o cancelamento, permitido até a preparação, devolve os itens ao estoque.</p>
      <div className="chip-row" id="order-chips">
        {["todos", ...statuses].map((st) => (
          <button type="button" className="chip" data-filter={st} aria-pressed={filter === st} key={st} onClick={() => setFilter(st)}>
            {st === "todos" ? "Todos" : st} <span className="chip-count">{st === "todos" ? data.orders.length : data.orders.filter((o) => o.status === st).length}</span>
          </button>
        ))}
      </div>
      <div className="order-list" id="order-list">
        {list.length ? (
          list.map((o) => <AdminOrderCard key={`${o.id}-${o.status}`} order={o} customer={names.get(o.partitionKey) || "Cliente"} onStatus={(status, select) => changeStatus(o, status, select)} onUpdated={replace} />)
        ) : (
          <State symbol="package" title="Nenhum pedido encontrado." level={3} />
        )}
      </div>
    </>
  );
}

// Lista carregada pela aba, com nova tentativa em caso de falha.
function useTabData<T>(path: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await api<T[]>(path));
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, setItems, error, load };
}

// ---------- Perguntas ----------
type Question = { id: string; productId: string; produto: string; pergunta: string; autor: string; createdAt: string; status: string; resposta?: string };
function QuestionsTab({ onStats }: { onStats: () => void }) {
  const { items, setItems, error, load } = useTabData<Question>("/admin/questions");
  const [query, setQuery] = useState("");
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const pending = items.filter((x) => x.status === "pendente").length;
  const list = items.filter((x) => matches(query, `${x.produto} ${x.pergunta} ${x.autor}`));
  const label: Record<string, string> = { pendente: "Aguardando resposta", respondida: "Respondida", oculta: "Oculta" };
  const replace = (updated: Question) => setItems((all) => all && all.map((x) => (x.id === updated.id ? updated : x)));
  return (
    <>
      <Toolbar
        title={
          <>
            Perguntas {pending ? <span className="chip-count">{pending} aguardando</span> : null}
          </>
        }
        query={query}
        onQuery={setQuery}
      />
      <p className="form-help">Só as perguntas respondidas aparecem na página do produto. Quem perguntou recebe a resposta nas notificações.</p>
      <div className="question-list" id="question-list">
        {list.length ? (
          list.map((x) => (
            <article className="panel question-admin" data-question={x.id} key={x.id}>
              <header>
                <span className={`badge ${x.status === "pendente" ? "badge-low" : x.status === "oculta" ? "badge-out" : "badge-in"}`}>{label[x.status]}</span>
                <a href={`/produto.html?id=${encodeURIComponent(x.productId)}#perguntas`}>{x.produto}</a>
                <small className="muted">
                  {x.autor} · {day(x.createdAt)}
                </small>
              </header>
              <p className="question-text">{x.pergunta}</p>
              {x.status !== "oculta" && (
                <form
                  className="question-form"
                  data-answer={x.id}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const resposta = (form.elements.namedItem("resposta") as HTMLTextAreaElement).value.trim();
                    if (resposta.length < 2) return toast("Escreva a resposta antes de enviar.", { type: "error" });
                    const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
                    button.disabled = true;
                    try {
                      replace(await send<Question>(`/admin/questions/${x.id}`, { resposta }, "PATCH"));
                      toast("Resposta publicada na página do produto.", { type: "success" });
                      onStats();
                    } catch (e) {
                      fail(e);
                    }
                    button.disabled = false;
                  }}
                >
                  <label htmlFor={`answer-${x.id}`}>{x.resposta ? "Editar resposta" : "Resposta da loja"}</label>
                  <textarea id={`answer-${x.id}`} name="resposta" rows={3} minLength={2} maxLength={1000} required defaultValue={x.resposta || ""} />
                  <div className="row">
                    <button type="submit">{x.resposta ? "Salvar resposta" : "Responder"}</button>
                    {x.status === "pendente" && (
                      <button
                        type="button"
                        className="text-button danger-text"
                        data-hide={x.id}
                        onClick={async () => {
                          if (!(await confirmDialog({ title: "Ocultar esta pergunta?", text: "Ela não será publicada nem respondida.", confirm: "Ocultar", cancel: "Voltar", danger: true }))) return;
                          try {
                            replace(await send<Question>(`/admin/questions/${x.id}`, { ocultar: true }, "PATCH"));
                            onStats();
                          } catch (e) {
                            fail(e);
                          }
                        }}
                      >
                        Ocultar pergunta
                      </button>
                    )}
                  </div>
                </form>
              )}
            </article>
          ))
        ) : (
          <State symbol="question" title={query ? "Nenhuma pergunta encontrada." : "Nenhuma pergunta ainda."} level={3} />
        )}
      </div>
    </>
  );
}

// ---------- Encomendas e parcerias (etapa 33) ----------
type RequestItem = { id: string; codigo: string; tipoNome: string; status: string; cliente: string; email: string; telefone?: string; contato?: string; createdAt: string; produto: string; detalhes?: string; orcamentoCents?: number; prazo: string; valorCents?: number; prazoDias?: number; resposta?: string };
const REQUEST_STATUS = ["Recebida", "Em análise", "Orçamento enviado", "Aprovada", "Recusada", "Concluída"];
function RequestsTab({ onStats }: { onStats: () => void }) {
  const { items, setItems, error, load } = useTabData<RequestItem>("/admin/encomendas");
  const [query, setQuery] = useState("");
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const list = items.filter((x) => matches(query, `${x.codigo} ${x.produto} ${x.cliente} ${x.detalhes || ""}`));
  return (
    <>
      <Toolbar title="Encomendas" query={query} onQuery={setQuery} />
      <p className="form-help">Guitarras personalizadas e produtos fora do catálogo pedidos pelos clientes (pelo site ou pelo assistente). Mudar o status ou a resposta avisa o cliente nas notificações.</p>
      <div className="question-list" id="request-admin-list">
        {list.length ? (
          list.map((x) => (
            <article className="panel question-admin" key={x.id}>
              <header>
                <span className={`badge ${["Recebida", "Em análise"].includes(x.status) ? "badge-low" : x.status === "Recusada" ? "badge-out" : "badge-in"}`}>{x.status}</span>
                <strong>
                  {x.codigo} · {x.tipoNome}
                </strong>
                <small className="muted">
                  {x.cliente} · {x.email}
                  {x.telefone ? ` · ${x.telefone} (${x.contato})` : ""} · {day(x.createdAt)}
                </small>
              </header>
              <p className="question-text">
                <strong>{x.produto}</strong>
              </p>
              {x.detalhes && <p className="small pre-line">{x.detalhes}</p>}
              <p className="small muted">
                Orçamento do cliente: {x.orcamentoCents ? money(x.orcamentoCents) : "não informado"} · Prazo: {x.prazo}
              </p>
              <form
                className="question-form"
                data-request={x.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const el = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
                  const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
                  button.disabled = true;
                  try {
                    const updated = await send<RequestItem>(
                      `/admin/encomendas/${x.id}`,
                      { status: el("status").value, resposta: el("resposta").value.trim(), valorCents: el("valor").value ? Math.round(Number(el("valor").value) * 100) : null, prazoDias: el("prazoDias").value ? Number(el("prazoDias").value) : null },
                      "PATCH",
                    );
                    setItems((all) => all && all.map((r) => (r.id === updated.id ? updated : r)));
                    toast("Encomenda atualizada; o cliente foi avisado.", { type: "success" });
                    onStats();
                  } catch (e) {
                    fail(e);
                  }
                  button.disabled = false;
                }}
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={`rs-${x.id}`}>Status</label>
                    <select id={`rs-${x.id}`} name="status" defaultValue={x.status}>
                      {REQUEST_STATUS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`rv-${x.id}`}>Valor orçado (R$)</label>
                    <input id={`rv-${x.id}`} name="valor" type="number" min="100" step="1" defaultValue={x.valorCents ? x.valorCents / 100 : ""} />
                  </div>
                  <div className="field">
                    <label htmlFor={`rp-${x.id}`}>Prazo (dias)</label>
                    <input id={`rp-${x.id}`} name="prazoDias" type="number" min="1" max="365" defaultValue={x.prazoDias || ""} />
                  </div>
                </div>
                <label htmlFor={`rr-${x.id}`}>Resposta para o cliente</label>
                <textarea id={`rr-${x.id}`} name="resposta" rows={3} maxLength={1500} defaultValue={x.resposta || ""} />
                <div className="row">
                  <button type="submit">Salvar e avisar o cliente</button>
                </div>
              </form>
            </article>
          ))
        ) : (
          <State symbol="wrench" title="Nenhuma encomenda ainda." level={3} />
        )}
      </div>
    </>
  );
}
type Partner = { id: string; status: string; razaoSocial: string; nomeFantasia?: string; cnpj: string; modalidade: string; createdAt: string; produtos: string[]; marcas?: string; contatoNome: string; cargo?: string; email: string; telefone: string; site?: string; mensagem?: string; notas?: string };
function PartnersTab({ onStats }: { onStats: () => void }) {
  const { items, setItems, error, load } = useTabData<Partner>("/admin/parcerias");
  const [query, setQuery] = useState("");
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const list = items.filter((x) => matches(query, `${x.razaoSocial} ${x.nomeFantasia || ""} ${x.cnpj} ${x.contatoNome} ${x.produtos.join(" ")} ${x.marcas || ""}`));
  return (
    <>
      <Toolbar title="Parcerias e fornecedores" query={query} onQuery={setQuery} />
      <p className="form-help">Fichas enviadas pela página Seja um parceiro. As notas são internas.</p>
      <div className="question-list" id="partner-admin-list">
        {list.length ? (
          list.map((x) => (
            <article className="panel question-admin" key={x.id}>
              <header>
                <span className={`badge ${x.status === "Nova" ? "badge-low" : x.status === "Recusada" ? "badge-out" : "badge-in"}`}>{x.status}</span>
                <strong>{x.nomeFantasia || x.razaoSocial}</strong>
                <small className="muted">
                  CNPJ {x.cnpj} · {x.modalidade} · {day(x.createdAt)}
                </small>
              </header>
              <p className="small">
                <strong>Produtos:</strong> {x.produtos.join(", ")}
                {x.marcas && (
                  <>
                    {" "}
                    · <strong>Marcas:</strong> {x.marcas}
                  </>
                )}
              </p>
              <p className="small">
                <strong>Contato:</strong> {x.contatoNome}
                {x.cargo ? ` (${x.cargo})` : ""} · <a href={`mailto:${x.email}`}>{x.email}</a> · {x.telefone}
                {x.site && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={x.site} rel="noopener noreferrer" target="_blank">
                      site
                    </a>
                  </>
                )}
              </p>
              {x.mensagem && <p className="small pre-line">{x.mensagem}</p>}
              <form
                className="question-form"
                data-partner={x.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  try {
                    const updated = await send<Partner>(
                      `/admin/parcerias/${x.id}`,
                      { status: (form.elements.namedItem("status") as HTMLSelectElement).value, notas: (form.elements.namedItem("notas") as HTMLTextAreaElement).value.trim() },
                      "PATCH",
                    );
                    setItems((all) => all && all.map((p) => (p.id === updated.id ? updated : p)));
                    toast("Ficha atualizada.", { type: "success" });
                    onStats();
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={`ps-${x.id}`}>Status</label>
                    <select id={`ps-${x.id}`} name="status" defaultValue={x.status}>
                      {["Nova", "Em contato", "Aprovada", "Recusada"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label htmlFor={`pn-${x.id}`}>Notas internas</label>
                <textarea id={`pn-${x.id}`} name="notas" rows={2} maxLength={1000} defaultValue={x.notas || ""} />
                <div className="row">
                  <button type="submit">Salvar</button>
                </div>
              </form>
            </article>
          ))
        ) : (
          <State symbol="store" title="Nenhuma ficha de parceria ainda." level={3} />
        )}
      </div>
    </>
  );
}

// ---------- Cupons (etapa 34) ----------
type Coupon = { codigo: string; description: string; type: "percent" | "fixed" | "shipping"; value?: number; maxCents?: number; minCents?: number; usos?: number; limiteUsos?: number; umPorCliente?: boolean; validoAte?: string; situacao: string; ativo?: boolean; padrao?: boolean };
const COUPON_TYPE = { percent: "Porcentagem", fixed: "Valor fixo", shipping: "Frete grátis" };
const COUPON_BADGE: Record<string, string> = { Ativo: "badge-in", Desativado: "badge-out", Expirado: "badge-out", Esgotado: "badge-low" };
const couponValue = (c: Coupon) => (c.type === "percent" ? `${c.value}%${c.maxCents ? ` (até ${money(c.maxCents)})` : ""}` : c.type === "fixed" ? money(c.value || 0) : "Frete");
function CouponsTab() {
  const { items, setItems, error, load } = useTabData<Coupon>("/admin/cupons");
  const [query, setQuery] = useState("");
  const kit = useFormKit({
    onSubmit: async (data, form) => {
      const reais = (v?: string) => (v === "" || v === undefined ? null : Math.round(Number(v) * 100));
      const created = await send<Coupon>("/admin/cupons", {
        codigo: data.codigo,
        type: data.type,
        value: data.type === "percent" ? Number(data.valor) : data.type === "fixed" ? reais(data.valor) : null,
        minCents: reais(data.minimo),
        maxCents: data.type === "percent" ? reais(data.maximo) : null,
        validoAte: data.validoAte || null,
        limiteUsos: data.limiteUsos ? Number(data.limiteUsos) : null,
        description: data.description,
        umPorCliente: (form.elements.namedItem("umPorCliente") as HTMLInputElement).checked,
      });
      setItems((all) => [...(all || []), created]);
      form.reset();
      toast(`Cupom ${created.codigo} criado.`, { type: "success" });
    },
  });
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const toggle = async (c: Coupon) => {
    try {
      const updated = await send<Coupon>(`/admin/cupons/${encodeURIComponent(c.codigo)}`, { ativo: c.ativo === false }, "PATCH");
      setItems((all) => all && all.map((x) => (x.codigo === updated.codigo ? updated : x)));
      toast(`Cupom ${updated.codigo} ${updated.ativo ? "ativado" : "desativado"}.`, { type: "success" });
    } catch (e) {
      fail(e);
    }
  };
  const field = (id: string, name: string, label: string, props: Record<string, unknown>, wide = false) => (
    <div className={`field${wide ? " field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} {...props} {...kit.a11y(name)} />
      <FieldHint kit={kit} name={name} />
    </div>
  );
  return (
    <>
      <Toolbar title="Cupons" query={query} onQuery={setQuery} />
      <p className="form-help">O cupom é conferido de novo no checkout. Desativar, vencer ou atingir o limite tira o cupom do carrinho, da ajuda e do assistente na hora.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Desconto</th>
              <th>Usos</th>
              <th>Validade</th>
              <th>Situação</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody id="coupon-rows">
            {items
              .filter((c) => matches(query, `${c.codigo} ${c.description}`))
              .map((c) => (
                <tr key={c.codigo}>
                  <th scope="row">
                    {c.codigo}
                    {c.padrao && (
                      <>
                        {" "}
                        <span className="badge">padrão</span>
                      </>
                    )}
                  </th>
                  <td>{c.description}</td>
                  <td>
                    {COUPON_TYPE[c.type]} · {couponValue(c)}
                    {c.minCents ? (
                      <>
                        <br />
                        <small className="muted">mínimo {money(c.minCents)}</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {c.usos || 0}
                    {c.limiteUsos ? ` / ${c.limiteUsos}` : ""}
                    {c.umPorCliente && (
                      <>
                        <br />
                        <small className="muted">1 por cliente</small>
                      </>
                    )}
                  </td>
                  <td>{c.validoAte ? new Date(`${c.validoAte}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem validade"}</td>
                  <td>
                    <span className={`badge ${COUPON_BADGE[c.situacao] || ""}`}>{c.situacao}</span>
                  </td>
                  <td>
                    <button type="button" className="text-button" data-coupon-toggle={c.codigo} data-on={String(c.ativo !== false)} onClick={() => toggle(c)}>
                      {c.ativo !== false ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <KitForm kit={kit} className="admin-form panel" id="coupon-form">
        <h3>Novo cupom</h3>
        <div className="form-grid">
          {field("cp-codigo", "codigo", "Código", { required: true, maxLength: 30, pattern: "[A-Za-z0-9]{3,30}", autoComplete: "off" })}
          <div className="field">
            <label htmlFor="cp-type">Tipo</label>
            <select id="cp-type" name="type">
              <option value="percent">Porcentagem</option>
              <option value="fixed">Valor fixo</option>
              <option value="shipping">Frete grátis</option>
            </select>
          </div>
          {field("cp-value", "valor", "Valor (% ou R$)", { type: "number", min: 1, step: 1 })}
          {field("cp-min", "minimo", "Compra mínima (R$)", { type: "number", min: 1, step: 1 })}
          {field("cp-max", "maximo", "Desconto máximo (R$)", { type: "number", min: 1, step: 1 })}
          {field("cp-validade", "validoAte", "Válido até", { type: "date" })}
          {field("cp-limite", "limiteUsos", "Limite de usos", { type: "number", min: 1, step: 1 })}
          {field("cp-desc", "description", "Descrição para o cliente", { required: true, minLength: 3, maxLength: 120 }, true)}
          <label className="check">
            <input type="checkbox" name="umPorCliente" />
            <span>Um uso por cliente</span>
          </label>
        </div>
        <div className="row">
          <SubmitButton kit={kit}>Criar cupom</SubmitButton>
        </div>
      </KitForm>
    </>
  );
}

// ---------- Assistente ----------
type Miss = { texto: string; vezes: number; ultima: string };
function AssistantTab() {
  const { items, error, load } = useTabData<Miss>("/admin/assistente");
  const [query, setQuery] = useState("");
  if (error) return <LoadError error={error} retry={load} title="Não foi possível carregar esta aba." />;
  if (!items) return <Loading />;
  const visible = items.filter((x) => matches(query, x.texto));
  return (
    <>
      <Toolbar title="Frases que o assistente não entendeu" query={query} onQuery={setQuery}>
        {items.length > 0 && (
          <button
            type="button"
            className="secondary"
            id="clear-misses"
            onClick={async () => {
              if (!(await confirmDialog({ title: "Limpar a lista?", text: "As frases guardadas serão apagadas.", confirm: "Limpar", cancel: "Voltar", danger: true }))) return;
              try {
                await send("/admin/assistente", {}, "DELETE");
                toast("Lista limpa.", { type: "success" });
                await load();
              } catch (e) {
                fail(e);
              }
            }}
          >
            <Icon name="trash" size={18} />
            Limpar lista
          </button>
        )}
      </Toolbar>
      <p className="form-help">
        Guardadas sem identificar o cliente (sem conta, e-mail, códigos de pedido ou telefones), por até 90 dias. Use para ensinar novas frases ao assistente em <code>src/assistant/intents.js</code> ou na Central de Ajuda.
      </p>
      {items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Frase</th>
                  <th>Vezes</th>
                  <th>Última</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.texto} data-search={normalize(x.texto)} hidden={!visible.includes(x)}>
                    <td>{x.texto}</td>
                    <td>{x.vezes}</td>
                    <td>{day(x.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p id="no-results" className="muted" hidden={visible.length > 0}>
            Nenhuma frase encontrada.
          </p>
        </>
      ) : (
        <State symbol="chat" title="Nenhuma frase pendente." text="Quando o assistente não entender uma mensagem, ela aparece aqui." level={3} />
      )}
    </>
  );
}

// ---------- Página ----------
function Dashboard() {
  const [tab, setTab] = useState<Tab>("products");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statsError, setStatsError] = useState<Error | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // Indicadores e lista falham de forma independente, cada um com nova tentativa.
  const stats = useCallback(async () => {
    try {
      setSummary(await api<Summary>("/admin/summary"));
      setStatsError(null);
    } catch (e) {
      setStatsError(e as Error);
    }
  }, []);
  useEffect(() => {
    stats();
  }, [stats]);
  const choose = (next: Tab) => {
    setTab(next);
    tabs.current[TABS.findIndex(([id]) => id === next)]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    choose(TABS[next][0]);
  };
  const refreshStats = () => void stats();
  return (
    <>
      <div id="stats" className="stats">
        {statsError ? <LoadError error={statsError} retry={stats} title="Não foi possível carregar os indicadores." /> : summary && <Stats s={summary} onTab={(t) => choose(t as Tab)} />}
      </div>
      <div className="admin-tabs" role="tablist" aria-label="Administração">
        {TABS.map(([id, label], index) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-controls="admin-panel"
            aria-selected={tab === id}
            className={tab === id ? undefined : "secondary"}
            data-tab={id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            onClick={() => setTab(id)}
            onKeyDown={(e) => onKey(e, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel" id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "products" && <RecordsTab key="products" product onStats={refreshStats} />}
        {tab === "customers" && <RecordsTab key="customers" product={false} onStats={refreshStats} />}
        {tab === "orders" && <OrdersTab onStats={refreshStats} />}
        {tab === "questions" && <QuestionsTab onStats={refreshStats} />}
        {tab === "requests" && <RequestsTab onStats={refreshStats} />}
        {tab === "partners" && <PartnersTab onStats={refreshStats} />}
        {tab === "coupons" && <CouponsTab />}
        {tab === "assistant" && <AssistantTab />}
      </section>
    </>
  );
}

export default function Admin() {
  const { user } = useSession();
  const restricted = user && user.role !== "admin";
  return (
    <div className="container page-wrap" id="admin-content">
      {restricted ? (
        <State symbol="shield" title="Acesso restrito" text="Esta área está disponível apenas para administradores." actions={<a className="button" href="/">Voltar à loja</a>} />
      ) : (
        <>
          <nav className="breadcrumb" aria-label="Trilha de navegação">
            <a href="/">Início</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Administração</span>
          </nav>
          <header className="page-head">
            <div>
              <span className="eyebrow">Painel</span>
              <h1 className="page-title">Nos bastidores do som.</h1>
              <p className="lead">Gerencie produtos, clientes e pedidos da Violet Voltage.</p>
            </div>
          </header>
          <Private
            loading={
              <section className="panel" id="admin-panel">
                <div className="loading">Verificando acesso…</div>
              </section>
            }
          >
            {() => <Dashboard />}
          </Private>
        </>
      )}
    </div>
  );
}
