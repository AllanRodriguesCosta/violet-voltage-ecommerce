// Assistente de compras: painel não modal, aberto a visitantes; pedidos, encomendas e trocas
// pedem login, e a pergunta é retomada sozinha depois que a pessoa entra.
// As respostas vêm de /api/assistente (PLN local do servidor); o histórico fica nesta aba
// (sessionStorage vv_assistente). Mesma marcação do assistente anterior.
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Icon } from "../lib/icons";
import { addCart, catalogProducts, getCart, getWishlist, send, toast, type Product, type User } from "../lib/shop";
import { money, productImage } from "../../../shared/catalog.js";
import { cartAdvice } from "../../../shared/compat.js";
import { confirmDialog } from "../lib/confirm";
import { openCart } from "../lib/drawer";
import { BodyPortal } from "./Portal";

const KEY = "vv_assistente";
const LIMIT = 40;
const START = ["Quero uma guitarra vintage", "Montar setup pelo meu gosto", "Onde está meu pedido?", "Quero encomendar uma guitarra"];
// Pergunta que pediu login: fica guardada na aba e é respondida assim que a pessoa entra.
const PENDING = "vv_assistente_pendente";
const PENDING_TTL = 30 * 60 * 1000;
const VOICE_OK = "vv_voz_ok";

type Card = Product & { cor?: string; motivo?: string };
type Action = { tipo: string; rotulo: string; itens?: string[]; codigo?: string; href?: string };
export type Message = {
  de: "voce" | "assistente";
  texto: string;
  cards?: Card[];
  acoes?: Action[];
  sugestoes?: string[];
  fonte?: string;
  interpretado?: string;
  erro?: boolean;
};
type Saved = { user: string; mensagens: Message[]; contexto?: unknown };

// Sugestões iniciais conforme a página: o assistente sabe qual produto está aberto.
function pageInfo() {
  const params = new URLSearchParams(location.search);
  if (location.pathname === "/produto.html" && params.get("id")) return { tipo: "produto", id: params.get("id") };
  if (location.pathname === "/carrinho.html") return { tipo: "carrinho" };
  if (location.pathname === "/comparar.html") return { tipo: "comparar" };
  if (location.pathname === "/checkout.html") return { tipo: "checkout" };
  return { tipo: "outra" };
}
function startChips() {
  const page = pageInfo();
  if (page.tipo === "produto") {
    const title = document.querySelector(".detail-info .eyebrow")?.textContent || "";
    return /Guitarras/.test(title)
      ? ["Quantos trastes tem essa?", "Ela serve para blues?", "Comparar com outra", "Adicionar ao carrinho"]
      : /Pedais/.test(title)
        ? ["Esse pedal precisa de fonte?", "Funciona no meu amplificador?", "Adicionar ao carrinho"]
        : ["Me conta mais sobre esse produto", "Tem em estoque?", "Adicionar ao carrinho"];
  }
  if (page.tipo === "carrinho") return ["O que falta no meu carrinho?", "Tem cupom de desconto?", "Qual o prazo de entrega?"];
  return START;
}
const safeHref = (href?: string) => (typeof href === "string" && /^\/(?!\/)/.test(href) ? href : "/");
function load(userId: string): Saved | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!Array.isArray(saved?.mensagens)) return null;
    if (saved.user === userId) return saved;
    // Quem conversou como visitante e acabou de entrar continua a mesma conversa.
    if (saved.user === "visitante" && userId !== "visitante") return { ...saved, user: userId };
    return null;
  } catch {
    return null;
  }
}
export function takePending(now = Date.now()) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
    sessionStorage.removeItem(PENDING);
    return pending && typeof pending.texto === "string" && now - pending.ts < PENDING_TTL ? (pending.texto as string).slice(0, 500) : null;
  } catch {
    return null;
  }
}
function save(state: Saved) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, mensagens: state.mensagens.slice(-LIMIT) }));
  } catch {
    // Sem armazenamento da aba, a conversa só não sobrevive à troca de página.
  }
}

function CardItem({ c }: { c: Card }) {
  const name = `${c.marca} ${c.modelo}`;
  return (
    <li className="assistant-card">
      <a href={`/produto.html?id=${encodeURIComponent(c.id)}${c.cor ? `&cor=${encodeURIComponent(c.cor)}` : ""}`}>
        <img src={productImage(c)} alt="" width={64} height={64} loading="lazy" />
        <span className="assistant-card-text">
          <small>{c.marca}</small>
          <strong>{c.modelo}</strong>
          {c.motivo && <span className="assistant-card-why">{c.motivo}</span>}
          <span className="assistant-card-price">{money(c.priceCents)}</span>
        </span>
      </a>
      <button type="button" className="icon-button" data-assistant-add={c.id} disabled={!(c.estoque > 0)} aria-label={c.estoque > 0 ? `Adicionar ${name} ao carrinho` : `${name} esgotado`}>
        <Icon name="bag" size={18} />
      </button>
    </li>
  );
}
function ActionButton({ a }: { a: Action }) {
  const here = encodeURIComponent(location.pathname + location.search);
  if (a.tipo === "carrinho")
    return (
      <button type="button" className="button small" data-assistant-cart={(a.itens || []).join(",")}>
        <Icon name="bag" size={16} />
        {a.rotulo}
      </button>
    );
  if (a.tipo === "cupom")
    return (
      <button type="button" className="button small" data-assistant-coupon={a.codigo}>
        <Icon name="tag" size={16} />
        {a.rotulo}
      </button>
    );
  if (a.tipo === "login")
    return (
      <>
        <a className="button small" data-assistant-login href={`/login.html?next=${here}`}>
          <Icon name="user" size={16} />
          Entrar
        </a>
        <a className="button small ghost" data-assistant-login href={`/cadastro.html?next=${here}`}>
          Criar conta
        </a>
      </>
    );
  return (
    <a className="button secondary small" href={safeHref(a.href)}>
      {a.rotulo}
    </a>
  );
}
function MessageView({ m, last }: { m: Message; last: boolean }) {
  if (m.de === "voce")
    return (
      <div className="msg msg-user">
        <p>{m.texto}</p>
      </div>
    );
  return (
    <>
      <div className={`msg msg-bot${m.erro ? " msg-error" : ""}`}>
        {String(m.texto || "")
          .split("\n")
          .map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        {!!m.cards?.length && (
          <ul className="assistant-cards">
            {m.cards.map((c) => (
              <CardItem key={c.id} c={c} />
            ))}
          </ul>
        )}
        {!!m.acoes?.length && (
          <div className="assistant-actions">
            {m.acoes.map((a, i) => (
              <ActionButton key={i} a={a} />
            ))}
          </div>
        )}
        {m.fonte === "gemini" ? (
          <p className="msg-source">
            <Icon name="sparkle" size={12} />
            Resposta gerada com o Gemini (Google) a partir do catálogo da loja. Confira preço e estoque na página do produto.
          </p>
        ) : m.fonte === "gemini-interpretou" ? (
          <p className="msg-source">
            <Icon name="sparkle" size={12} />
            Entendi como “{m.interpretado || ""}” (interpretação com o Gemini; produtos, preços e estoque vêm da loja).
          </p>
        ) : null}
      </div>
      {last && !!m.sugestoes?.length && (
        <div className="assistant-chips">
          {m.sugestoes.map((s) => (
            <button type="button" className="chip" key={s} data-assistant-say={s}>
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

type Recognizer = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
// Entrada por voz (Web Speech API do navegador). No Chrome e no Edge o áudio é transcrito pelo
// serviço de voz do navegador; o aviso aparece no primeiro uso.
const recognition = () => {
  const g = globalThis as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return g.SpeechRecognition || g.webkitSpeechRecognition;
};

function Panel({ user }: { user: User | null }) {
  const first = String(user?.nome || "").split(" ")[0];
  const owner = user?.id || "visitante";
  const [state, setState] = useState<Saved>(() => load(owner) || { user: owner, mensagens: [], contexto: undefined });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [hint, setHint] = useState(0);
  const [voice, setVoice] = useState("");
  const [listening, setListening] = useState<Recognizer | null>(null);
  const listeningRef = useRef<Recognizer | null>(null);
  listeningRef.current = listening;
  const Recognition = recognition();
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const mic = useRef<HTMLButtonElement>(null);
  const inerted = useRef<HTMLElement[]>([]);

  const greeting = useCallback(
    (): Message => ({
      de: "assistente",
      texto: `Oi${first ? `, ${first}` : ""}! Posso indicar e comparar equipamentos, montar um setup pelo seu orçamento ou pelo seu gosto (artistas, tipo de som, cores), responder sobre a ficha do produto que você está vendo, conferir o que falta no carrinho e ajudar com encomendas${user ? ", além de contar em que etapa está seu pedido" : ". Para ver pedidos ou pedir trocas, eu peço para você entrar e continuo de onde parou"}.`,
      sugestoes: startChips(),
    }),
    [first, user],
  );
  // No celular o painel ocupa a tela: o resto da página fica inerte (teclado e leitor de tela).
  const setModal = useCallback((on: boolean) => {
    for (const el of inerted.current) el.inert = false;
    inerted.current = on ? ([...document.body.children] as HTMLElement[]).filter((el) => el !== panel.current && !el.inert && el.tagName !== "SCRIPT") : [];
    for (const el of inerted.current) el.inert = true;
    panel.current?.setAttribute("aria-modal", String(on));
  }, []);
  const show = useCallback(
    (on: boolean) => {
      if (!on) listeningRef.current?.stop();
      setOpen(on);
      setModal(on && matchMedia("(max-width: 699px)").matches);
      document.body.classList.toggle("assistant-open", on);
      if (on && !stateRef.current.mensagens.length) setState((s) => ({ ...s, mensagens: [greeting()] }));
      if (on) requestAnimationFrame(() => input.current?.focus());
      else launcher.current?.focus();
    },
    [greeting, setModal],
  );
  useEffect(() => {
    const fullScreen = matchMedia("(max-width: 699px)");
    const onChange = () => open && setModal(fullScreen.matches);
    fullScreen.addEventListener("change", onChange);
    return () => fullScreen.removeEventListener("change", onChange);
  }, [open, setModal]);
  useEffect(
    () => () => {
      for (const el of inerted.current) el.inert = false;
      document.body.classList.remove("assistant-open");
    },
    [],
  );
  // Resposta nova aparece do começo; enquanto o assistente "digita", o fim fica à vista.
  useEffect(() => {
    const box = log.current;
    if (!box || !open) return;
    const answers = box.querySelectorAll<HTMLElement>(".msg-bot:not(.msg-typing)");
    const latest = answers[answers.length - 1];
    box.scrollTop = !busy && latest && state.mensagens.at(-1)?.de === "assistente" ? latest.offsetTop - box.offsetTop - 8 : box.scrollHeight;
  }, [state.mensagens, busy, open]);

  const ask = useCallback(async (text: string) => {
    const mensagem = text.trim().slice(0, 500);
    if (!mensagem || busyRef.current) return;
    const before = { ...stateRef.current, mensagens: [...stateRef.current.mensagens, { de: "voce", texto: mensagem } as Message] };
    setState(before);
    busyRef.current = true;
    setBusy(true);
    if (input.current) input.current.value = "";
    let next: Saved;
    try {
      // Só IDs e quantidades: o servidor confere tudo no catálogo.
      const r = await send<{ texto: string; cards?: Card[]; acoes?: Action[]; sugestoes?: string[]; fonte?: string; interpretado?: string; contexto?: unknown }>("/assistente", {
        mensagem,
        contexto: before.contexto,
        pagina: pageInfo(),
        carrinho: getCart().map(({ id, quantidade }) => ({ id, quantidade })),
        favoritos: getWishlist().slice(0, 100),
      });
      next = { ...before, contexto: r.contexto, mensagens: [...before.mensagens, { de: "assistente", texto: r.texto, cards: r.cards, acoes: r.acoes, sugestoes: r.sugestoes, fonte: r.fonte, interpretado: r.interpretado }] };
    } catch (error) {
      next = { ...before, mensagens: [...before.mensagens, { de: "assistente", erro: true, texto: `Não consegui responder agora. ${(error as Error).message || "Tente de novo em instantes."}`, sugestoes: [mensagem] }] };
    }
    busyRef.current = false;
    setBusy(false);
    setState(next);
    save(next);
    input.current?.focus();
  }, []);

  // Voltou do login com uma pergunta pendente: abre o painel e responde.
  useEffect(() => {
    const pending = user ? takePending() : null;
    if (pending) {
      show(true);
      ask(pending);
    }
    // Só ao montar: a sessão já foi verificada.
  }, []);
  // No carrinho, o botão avisa quando falta algo essencial (cabo, amplificador, fonte...).
  useEffect(() => {
    if (location.pathname !== "/carrinho.html") return;
    const update = async () => {
      try {
        const products = await catalogProducts();
        const lines = getCart()
          .map((i) => ({ product: products.find((p) => p.id === i.id), quantidade: i.quantidade }))
          .filter((l) => l.product);
        setHint(cartAdvice(lines, products).filter((a: { nivel: string }) => a.nivel === "essencial").length);
      } catch {
        /* a dica é opcional */
      }
    };
    update();
    document.addEventListener("vv:cart", update);
    return () => document.removeEventListener("vv:cart", update);
  }, []);

  // Voz: preenche o campo enquanto você fala; enviar continua sendo um toque seu.
  const onMic = async () => {
    if (listening) return listening.stop();
    if (!Recognition) return;
    let agreed = false;
    try {
      agreed = localStorage.getItem(VOICE_OK) === "1";
    } catch {
      agreed = false;
    }
    if (!agreed) {
      const ok = await confirmDialog({
        title: "Usar o microfone?",
        text: "O navegador transcreve a sua fala em texto. No Chrome e no Edge, o áudio é processado pelo serviço de reconhecimento de voz do navegador (Google ou Microsoft). A loja recebe só o texto, como se você tivesse digitado.",
        confirm: "Usar o microfone",
        cancel: "Agora não",
      });
      if (!ok) return mic.current?.focus();
      try {
        localStorage.setItem(VOICE_OK, "1");
      } catch {
        /* pergunta de novo na próxima vez */
      }
    }
    const rec = new Recognition();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    setListening(rec);
    setVoice("Ouvindo… fale a sua pergunta.");
    let status = "Ouvindo… fale a sua pergunta.";
    rec.onresult = (event) => {
      if (input.current)
        input.current.value = [...Array.from(event.results)]
          .map((r) => r[0].transcript)
          .join(" ")
          .trim()
          .slice(0, 500);
    };
    rec.onerror = (event) => {
      status =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "O microfone foi bloqueado. Libere o acesso nas configurações do navegador."
          : event.error === "no-speech"
            ? "Não ouvi nada. Toque no microfone e tente de novo."
            : "Não foi possível usar a voz agora. Digite a mensagem.";
      setVoice(status);
    };
    rec.onend = () => {
      setListening(null);
      if (input.current?.value.trim() && /Ouvindo/.test(status)) setVoice("Pronto. Confira o texto e toque em enviar.");
      input.current?.focus();
    };
    try {
      rec.start();
    } catch {
      rec.onend?.();
      setVoice("Não foi possível usar a voz agora. Digite a mensagem.");
    }
  };

  const cardOf = (id: string) =>
    stateRef.current.mensagens
      .flatMap((m) => m.cards || [])
      .reverse()
      .find((c) => c.id === id);
  const onPanelClick = (event: MouseEvent<HTMLElement>) => {
    const t = event.target as HTMLElement;
    if (t.closest("[data-assistant-close]")) show(false);
    else if (t.closest("[data-assistant-reset]")) {
      const next = { ...stateRef.current, mensagens: [greeting()], contexto: undefined };
      setState(next);
      save(next);
      input.current?.focus();
    } else if (t.closest("[data-assistant-login]")) {
      // Guarda a pergunta que pediu login para responder assim que a pessoa voltar.
      const texto = [...stateRef.current.mensagens].reverse().find((m) => m.de === "voce")?.texto;
      try {
        if (texto) sessionStorage.setItem(PENDING, JSON.stringify({ texto, ts: Date.now() }));
      } catch {
        /* sem armazenamento, a pessoa pergunta de novo */
      }
    } else if (t.closest("[data-assistant-say]")) ask((t.closest("[data-assistant-say]") as HTMLElement).dataset.assistantSay || "");
    else if (t.closest("[data-assistant-add]")) {
      const button = t.closest<HTMLElement>("[data-assistant-add]")!;
      const card = cardOf(button.dataset.assistantAdd || "");
      if (card) addCart(card, 1, { source: button });
    } else if (t.closest("[data-assistant-cart]")) {
      const ids = (t.closest<HTMLElement>("[data-assistant-cart]")!.dataset.assistantCart || "").split(",");
      // Itens de kit podem não estar entre os cartões: completa com o catálogo atual.
      catalogProducts()
        .catch(() => [] as Product[])
        .then((products) => {
          const added = ids
            .map((id) => cardOf(id) || products.find((p) => p.id === id))
            .filter((c): c is Product => !!c && addCart(c, 1, { notify: false })).length;
          if (added) openCart(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho pelo assistente.`);
          else toast("Esses itens já estão no carrinho no limite do estoque.", { type: "info" });
        });
    } else if (t.closest("[data-assistant-coupon]")) {
      const code = t.closest<HTMLElement>("[data-assistant-coupon]")!.dataset.assistantCoupon || "";
      try {
        localStorage.setItem("vv_coupon", code);
        toast(`Cupom ${code} aplicado. Ele aparece no carrinho e no checkout.`, { type: "success", action: { label: "Ver carrinho", onClick: () => (location.href = "/carrinho.html") } });
      } catch {
        toast("Não foi possível guardar o cupom neste navegador.", { type: "error" });
      }
    }
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    listening?.stop();
    setVoice("");
    ask(input.current?.value || "");
  };
  const last = state.mensagens.length - 1;
  return (
    <>
      <button
        type="button"
        className="assistant-launcher"
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={hint ? `Assistente: ${hint} ${hint === 1 ? "dica" : "dicas"} para o seu carrinho` : location.pathname === "/carrinho.html" ? "Assistente" : undefined}
        ref={launcher}
        onClick={() => show(!open)}
      >
        <Icon name="chat" size={22} />
        <span className="assistant-launcher-label">Assistente</span>
        {hint > 0 && <span className="assistant-hint">{hint}</span>}
      </button>
      <section
        className="assistant-panel"
        id="assistant-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="assistant-title"
        hidden={!open}
        ref={panel}
        onKeyDown={(event) => event.key === "Escape" && show(false)}
        onClick={onPanelClick}
      >
        <header className="assistant-head">
          <span className="assistant-avatar">
            <Icon name="sparkle" size={18} />
          </span>
          <div>
            <h2 id="assistant-title">Assistente Violet</h2>
            <p>Indica equipamentos e tira dúvidas da loja</p>
          </div>
          <button type="button" className="icon-button" data-assistant-reset aria-label="Começar nova conversa">
            <Icon name="refresh" size={18} />
          </button>
          <button type="button" className="icon-button" data-assistant-close aria-label="Fechar assistente">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="assistant-log" role="log" aria-live="polite" aria-label="Conversa com o assistente" tabIndex={0} ref={log}>
          {state.mensagens.map((m, i) => (
            <MessageView key={i} m={m} last={i === last} />
          ))}
          {busy && (
            <div className="msg msg-bot msg-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <form className="assistant-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="assistant-input">
            Mensagem para o assistente
          </label>
          <input id="assistant-input" name="mensagem" type="text" maxLength={500} autoComplete="off" enterKeyHint="send" placeholder="Ex.: guitarra vintage para blues até 5 mil" ref={input} />
          {Recognition && (
            <button
              type="button"
              className={`icon-button assistant-mic${listening ? " is-listening" : ""}`}
              data-assistant-mic
              aria-pressed={!!listening}
              aria-label={listening ? "Parar de ouvir" : "Falar a mensagem"}
              ref={mic}
              onClick={onMic}
            >
              <Icon name="mic" size={18} />
            </button>
          )}
          <button type="submit" className="icon-button assistant-send" aria-label="Enviar mensagem">
            <Icon name="send" size={18} />
          </button>
        </form>
        <p className="assistant-voice" role="status" aria-live="polite">
          {voice}
        </p>
        <p className="assistant-note">Respostas automáticas com o catálogo e as regras da loja. Nada é comprado sem você clicar.</p>
      </section>
    </>
  );
}

// Carregado depois da sessão (pedidos, histórico e trocas pedem login); fora do painel administrativo.
export function Assistant({ user, loading }: { user: User | null | undefined; loading: boolean }) {
  const [here, setHere] = useState("");
  useEffect(() => setHere(location.pathname), []);
  if (loading || user === undefined || !here || here === "/admin.html") return null;
  return (
    <BodyPortal>
      <Panel user={user} />
    </BodyPortal>
  );
}
