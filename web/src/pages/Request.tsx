// Encomendas (guitarra personalizada ou produto fora do catálogo). O formulário abre para todos
// (o assistente pode preenchê-lo pela URL); para enviar é preciso entrar: o rascunho fica no
// navegador e volta depois do login. Quem está logado vê "Minhas encomendas".
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Icon } from "../lib/icons";
import { api, money, send, toast } from "../lib/shop";
import { loadSession, useSession } from "../lib/session";
import { State } from "../components/State";
import { FieldHint, KitForm, SubmitButton, useFormKit, type FormValues } from "../components/FormKit";
import { fromQuery } from "../../../shared/request.js";

const DRAFT = "vv_encomenda_rascunho";
const STATUS_BADGE: Record<string, string> = { Recebida: "badge-low", "Em análise": "badge-low", "Orçamento enviado": "badge-in", Aprovada: "badge-in", Recusada: "badge-out", Concluída: "badge-in" };
const EMPTY = { tipo: "personalizado", produto: "", detalhes: "", orcamento: "", prazo: "Sem pressa", contato: "E-mail", telefone: "" };
type Values = typeof EMPTY;
type Encomenda = { id?: string; codigo: string; status: string; tipoNome: string; produto: string; resposta?: string; valorCents?: number; prazoDias?: number; createdAt: string };
type Mine = { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "ready"; items: Encomenda[] };

function RequestCard({ r }: { r: Encomenda }) {
  return (
    <article className="request-item">
      <header>
        <strong>{r.codigo}</strong>
        <span className={`badge ${STATUS_BADGE[r.status] || "badge-low"}`}>{r.status}</span>
      </header>
      <p>
        {r.tipoNome}: {r.produto}
      </p>
      {r.resposta && (
        <p className="request-answer">
          <strong>Resposta da loja:</strong> {r.resposta}
        </p>
      )}
      {r.valorCents || r.prazoDias ? (
        <p className="small">
          {r.valorCents ? `Orçamento: ${money(r.valorCents)}` : ""}
          {r.valorCents && r.prazoDias ? " · " : ""}
          {r.prazoDias ? `Prazo: ${r.prazoDias} dias` : ""}
        </p>
      ) : null}
      <small className="muted">Enviada em {new Date(r.createdAt).toLocaleDateString("pt-BR")}</small>
    </article>
  );
}

function readDraft(): Partial<Values> | null {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT) || "null");
  } catch {
    return null;
  }
}

export default function Request() {
  const { loading, user } = useSession();
  const [values, setValues] = useState<Values>(EMPTY);
  const [fromAssistant, setFromAssistant] = useState(false);
  const [mine, setMine] = useState<Mine>({ status: "idle" });
  const needsPhone = values.contato !== "E-mail";

  // Dados do assistente (?tipo=&itens=&descricao=) ou o rascunho guardado antes do login.
  useEffect(() => {
    const incoming = fromQuery(location.search) as Partial<Values> | null;
    const draft = incoming ? null : readDraft();
    const data = incoming || draft;
    if (!data) return;
    setValues((v) => {
      const next = { ...v };
      for (const key of Object.keys(EMPTY) as (keyof Values)[]) if (data[key] !== undefined && data[key] !== null) next[key] = String(data[key]);
      return next;
    });
    if (incoming) setFromAssistant(true);
  }, []);

  const loadMine = useCallback(async () => {
    setMine((m) => (m.status === "ready" ? m : { status: "loading" }));
    try {
      setMine({ status: "ready", items: (await api("/encomendas")) as Encomenda[] });
    } catch (e) {
      setMine({ status: "error", message: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    if (user) loadMine();
  }, [user, loadMine]);
  useEffect(() => {
    if (mine.status === "ready" && location.hash === "#minhas") document.getElementById("minhas")?.scrollIntoView({ block: "start" });
  }, [mine.status]);

  const kit = useFormKit({
    onSubmit: async (data: FormValues) => {
      const current = await loadSession();
      if (!current) {
        try {
          sessionStorage.setItem(DRAFT, JSON.stringify({ ...data }));
        } catch {
          /* sem armazenamento, a pessoa preenche de novo */
        }
        location.href = `/login.html?next=${encodeURIComponent("/encomenda.html")}`;
        return;
      }
      const saved = (await send("/encomendas", {
        tipo: data.tipo,
        produto: data.produto,
        detalhes: data.detalhes,
        prazo: data.prazo,
        contato: data.contato,
        telefone: data.telefone,
        ...(data.orcamento ? { orcamentoCents: Math.round(Number(data.orcamento) * 100) } : {}),
      })) as Encomenda;
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {
        /* nada a limpar */
      }
      setValues(EMPTY);
      history.replaceState(null, "", "/encomenda.html#minhas");
      toast(`Encomenda ${saved.codigo} enviada. A resposta chega nas Notificações.`, { type: "success" });
      await loadMine();
    },
  });
  const bind = (name: keyof Values) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [name]: e.target.value })),
    ...kit.a11y(name),
  });
  const option = (tipo: string, icon: "wrench" | "package", title: string, text: string) => (
    <label className="option-card">
      <input type="radio" name="tipo" value={tipo} checked={values.tipo === tipo} onChange={() => setValues((v) => ({ ...v, tipo }))} />
      <span className="option-icon">
        <Icon name={icon} size={22} />
      </span>
      <span className="option-text">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );

  return (
    <div className="container page-wrap">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Encomendas</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Sob medida</span>
          <h1 className="page-title">Encomendas e importação.</h1>
          <p className="lead">
            Guitarra personalizada, montada pela nossa oficina parceira, ou um produto que não está no catálogo. A equipe responde com orçamento e prazo em até 2 dias úteis, e o pagamento só
            acontece se você aprovar.
          </p>
        </div>
      </header>
      <div className="request-layout">
        <section className="panel request-form-panel" aria-labelledby="request-title">
          <h2 id="request-title">Nova encomenda</h2>
          <p className="form-help" id="request-from-assistant" hidden={!fromAssistant}>
            Preenchemos com o que você contou ao assistente. Confira e ajuste antes de enviar.
          </p>
          <KitForm kit={kit} id="request-form">
            <fieldset>
              <legend>O que você quer encomendar?</legend>
              <div className="option-cards">
                {option("personalizado", "wrench", "Guitarra personalizada", "Escolha a base e as peças: captadores, tarraxas, ponte, madeiras e cor.")}
                {option("importacao", "package", "Produto fora do catálogo", "Um modelo pronto que a loja não tem: buscamos com fornecedores e importadores.")}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="request-produto">Produto ou base da guitarra</label>
              <input id="request-produto" type="text" required minLength={3} maxLength={120} placeholder="Ex.: Les Paul com captadores Seymour Duncan" {...bind("produto")} />
              <FieldHint kit={kit} name="produto" />
            </div>
            <div className="field">
              <label htmlFor="request-detalhes">Detalhes (opcional)</label>
              <textarea id="request-detalhes" rows={5} maxLength={1500} placeholder="Peças, cor, madeira da escala, ponte, referência de modelo ou link do fabricante." {...bind("detalhes")} />
              <FieldHint kit={kit} name="detalhes" />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="request-orcamento">Orçamento máximo em R$ (opcional)</label>
                <input id="request-orcamento" type="number" min={100} max={1000000} step={1} inputMode="numeric" {...bind("orcamento")} />
                <FieldHint kit={kit} name="orcamento" />
              </div>
              <div className="field">
                <label htmlFor="request-prazo">Prazo desejado</label>
                <select id="request-prazo" {...bind("prazo")}>
                  <option>Sem pressa</option>
                  <option>Até 30 dias</option>
                  <option>Até 60 dias</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="request-contato">Como prefere receber a resposta?</label>
                <select id="request-contato" {...bind("contato")}>
                  <option>E-mail</option>
                  <option>WhatsApp</option>
                  <option>Telefone</option>
                </select>
              </div>
              <div className="field" id="request-telefone-field" hidden={!needsPhone}>
                <label htmlFor="request-telefone">Telefone com DDD</label>
                <input id="request-telefone" type="tel" maxLength={20} autoComplete="tel" required={needsPhone} {...bind("telefone")} />
                <FieldHint kit={kit} name="telefone" />
              </div>
            </div>
            <SubmitButton kit={kit}>Enviar encomenda</SubmitButton>
            <p className="form-help" id="request-login-note" hidden={loading || Boolean(user)}>
              Para enviar, você entra na sua conta (ou cria uma). O que você escreveu fica guardado neste navegador.
            </p>
          </KitForm>
        </section>
        <aside className="request-aside">
          <section className="panel">
            <h2>Como funciona</h2>
            <ol className="steps-list">
              <li>
                <strong>Você descreve</strong> o que quer, com o máximo de detalhes.
              </li>
              <li>
                <strong>A equipe responde</strong> com orçamento, prazo e alternativas, nas Notificações e pelo contato escolhido.
              </li>
              <li>
                <strong>Você aprova</strong> (ou não). Sem aprovação, nada é cobrado.
              </li>
            </ol>
            <p className="small muted">Prefere conversar? O assistente da loja ajuda a descrever a encomenda.</p>
          </section>
          <section className="panel" id="minhas" aria-labelledby="mine-title" hidden={!user}>
            <h2 id="mine-title">Minhas encomendas</h2>
            <div id="request-list">
              {mine.status === "error" && <p className="field-error">{mine.message}</p>}
              {mine.status === "ready" &&
                (mine.items.length ? (
                  mine.items.map((r) => <RequestCard key={r.id || r.codigo} r={r} />)
                ) : (
                  <State symbol="package" title="Nenhuma encomenda ainda." text="As respostas da loja aparecem aqui e nas Notificações." level={3} />
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
