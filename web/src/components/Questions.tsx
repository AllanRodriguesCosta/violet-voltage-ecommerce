// Perguntas e respostas na página do produto: lista das respondidas e formulário para quem
// está logado. A loja responde pelo painel; a resposta também chega nas notificações.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../lib/icons";
import { api, send, type Product, type User } from "../lib/shop";
import { loadSession } from "../lib/session";
import { useFieldError } from "../lib/forms";

type Question = { id?: string; pergunta: string; autor: string; createdAt: string; resposta: string; respondidaEm: string };
const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function AskForm({ product }: { product: Product }) {
  const field = useFieldError<HTMLTextAreaElement>("pergunta", "Escreva sua pergunta com pelo menos 10 caracteres.");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [sent, setSent] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !field.validate()) return;
    setBusy(true);
    setFailure("");
    try {
      await send(`/products/${encodeURIComponent(product.id)}/questions`, { pergunta: field.props.ref.current?.value || "" });
      form.current?.reset();
      setSent("Pergunta enviada! Avisamos nas suas notificações quando a loja responder.");
    } catch (error) {
      const e = error as Error & { field?: string };
      if (e.field === "pergunta") {
        field.setError(e.message);
        field.props.ref.current?.focus();
      } else setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form id="qa-form" ref={form} noValidate onSubmit={onSubmit}>
        {failure && (
          <div className="error" role="alert">
            {failure}
          </div>
        )}
        <label htmlFor="qa-text">Faça uma pergunta</label>
        <textarea
          id="qa-text"
          name="pergunta"
          rows={4}
          minLength={10}
          maxLength={500}
          required
          aria-describedby={field.error ? `qa-help ${field.hintId}` : "qa-help"}
          {...field.props}
        />
        {field.error && (
          <p className="field-error" id={field.hintId}>
            {field.error}
          </p>
        )}
        <p className="form-help" id="qa-help">
          De 10 a 500 caracteres. A equipe responde aqui na página e você recebe um aviso nas notificações. Não inclua dados pessoais.
        </p>
        <button type="submit" disabled={busy} className={busy ? "is-busy" : undefined}>
          {busy ? (
            "Aguarde…"
          ) : (
            <>
              <Icon name="send" size={18} />
              Enviar pergunta
            </>
          )}
        </button>
      </form>
      <p className="qa-sent" role="status">
        {sent}
      </p>
    </>
  );
}

export function Questions({ product }: { product: Product }) {
  const [data, setData] = useState<{ list: Question[]; user: User | null | undefined } | null>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let list: Question[] = [];
      try {
        list = (await api(`/products/${encodeURIComponent(product.id)}/questions`)) as Question[];
      } catch {
        list = [];
      }
      const user = await loadSession();
      if (alive) setData({ list, user });
    })();
    return () => {
      alive = false;
    };
  }, [product.id]);
  useEffect(() => {
    if (data && location.hash === "#perguntas") section.current?.scrollIntoView();
  }, [data]);
  const next = encodeURIComponent(`/produto.html?id=${product.id}#perguntas`);
  return (
    <section ref={section} className="section-tight qa-section" id="perguntas" aria-labelledby="qa-title" hidden={!data}>
      {data && (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Dúvidas sobre este equipamento</span>
              <h2 id="qa-title">Perguntas e respostas</h2>
            </div>
          </div>
          <div className="qa-layout">
            <div className="qa-list">
              {data.list.length ? (
                <ul className="qa-items">
                  {data.list.map((q, i) => (
                    <li key={q.id ?? i} className="qa-item">
                      <p className="qa-question">
                        <Icon name="question" size={18} />
                        <span>
                          {q.pergunta}
                          <small>
                            {q.autor} · {when(q.createdAt)}
                          </small>
                        </span>
                      </p>
                      <p className="qa-answer">
                        <strong>Resposta da Violet Voltage</strong>
                        {q.resposta}
                        <small>{when(q.respondidaEm)}</small>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted qa-empty">Ainda não há perguntas respondidas sobre este produto. Seja o primeiro a perguntar.</p>
              )}
            </div>
            <div className="panel qa-ask">
              {data.user ? (
                <AskForm product={product} />
              ) : (
                <>
                  <p>
                    <strong>Ficou com alguma dúvida?</strong>
                  </p>
                  <p className="muted">Entre na sua conta para perguntar. A resposta aparece aqui e nas suas notificações.</p>
                  <a className="button secondary" href={`/login.html?next=${next}`}>
                    Entrar para perguntar
                  </a>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
