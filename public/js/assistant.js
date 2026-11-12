// Assistente de compras: painel não modal, disponível só para quem está logado.
// As respostas vêm de /api/assistente (PLN local do servidor); o histórico fica nesta aba.
import { icon } from "./icons.js";
import { send, money, productImage, escapeHtml as esc, addCart } from "./common.js";
import { openCart } from "./drawer.js";

const KEY = "vv_assistente";
const LIMIT = 40;
const START = ["Quero uma guitarra vintage", "Montar um setup de rock", "Onde está meu pedido?", "Como funciona o frete?"];
const safeHref = (href) => (typeof href === "string" && /^\/(?!\/)/.test(href) ? href : "/");

function load(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return saved?.user === userId && Array.isArray(saved.mensagens) ? saved : null;
  } catch {
    return null;
  }
}
function save(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, mensagens: state.mensagens.slice(-LIMIT) }));
  } catch {
    // Sem armazenamento da aba, a conversa só não sobrevive à troca de página.
  }
}

function cardHTML(c) {
  const name = `${c.marca} ${c.modelo}`;
  return `<li class="assistant-card"><a href="/produto.html?id=${encodeURIComponent(c.id)}"><img src="${esc(productImage(c))}" alt="" width="64" height="64" loading="lazy"><span class="assistant-card-text"><small>${esc(c.marca)}</small><strong>${esc(c.modelo)}</strong>${c.motivo ? `<span class="assistant-card-why">${esc(c.motivo)}</span>` : ""}<span class="assistant-card-price">${money(c.priceCents)}</span></span></a><button type="button" class="icon-button" data-assistant-add="${esc(c.id)}"${c.estoque > 0 ? "" : " disabled"} aria-label="${c.estoque > 0 ? `Adicionar ${esc(name)} ao carrinho` : `${esc(name)} esgotado`}">${icon("bag", { size: 18 })}</button></li>`;
}
function messageHTML(m, last) {
  if (m.de === "voce") return `<div class="msg msg-user"><p>${esc(m.texto)}</p></div>`;
  const text = String(m.texto || "")
    .split("\n")
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
  const cards = m.cards?.length ? `<ul class="assistant-cards">${m.cards.map(cardHTML).join("")}</ul>` : "";
  const actions = m.acoes?.length
    ? `<div class="assistant-actions">${m.acoes
        .map((a) =>
          a.tipo === "carrinho"
            ? `<button type="button" class="button small" data-assistant-cart="${esc(a.itens.join(","))}">${icon("bag", { size: 16 })}${esc(a.rotulo)}</button>`
            : `<a class="button secondary small" href="${esc(safeHref(a.href))}">${esc(a.rotulo)}</a>`,
        )
        .join("")}</div>`
    : "";
  const chips = last && m.sugestoes?.length ? `<div class="assistant-chips">${m.sugestoes.map((s) => `<button type="button" class="chip" data-assistant-say="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : "";
  return `<div class="msg msg-bot${m.erro ? " msg-error" : ""}">${text}${cards}${actions}</div>${chips}`;
}

export function mountAssistant(user) {
  if (document.querySelector(".assistant-launcher")) return;
  const first = String(user.nome || "").split(" ")[0];
  const state = load(user.id) || { user: user.id, mensagens: [], contexto: undefined };
  document.body.insertAdjacentHTML(
    "beforeend",
    `<button type="button" class="assistant-launcher" aria-expanded="false" aria-controls="assistant-panel">${icon("chat", { size: 22 })}<span class="assistant-launcher-label">Assistente</span></button>
<section class="assistant-panel" id="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title" hidden>
  <header class="assistant-head"><span class="assistant-avatar">${icon("sparkle", { size: 18 })}</span><div><h2 id="assistant-title">Assistente Violet</h2><p>Indica equipamentos e tira dúvidas da loja</p></div><button type="button" class="icon-button" data-assistant-reset aria-label="Começar nova conversa">${icon("refresh", { size: 18 })}</button><button type="button" class="icon-button" data-assistant-close aria-label="Fechar assistente">${icon("close", { size: 18 })}</button></header>
  <div class="assistant-log" role="log" aria-live="polite" aria-label="Conversa com o assistente" tabindex="0"></div>
  <form class="assistant-form"><label class="sr-only" for="assistant-input">Mensagem para o assistente</label><input id="assistant-input" name="mensagem" type="text" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Ex.: guitarra vintage para blues até 5 mil"><button type="submit" class="icon-button assistant-send" aria-label="Enviar mensagem">${icon("send", { size: 18 })}</button></form>
  <p class="assistant-note">Respostas automáticas com o catálogo e as regras da loja. Nada é comprado sem você clicar.</p>
</section>`,
  );
  const launcher = document.querySelector(".assistant-launcher");
  const panel = document.querySelector("#assistant-panel");
  const log = panel.querySelector(".assistant-log");
  const form = panel.querySelector(".assistant-form");
  const input = form.elements.mensagem;
  let busy = false;

  const greeting = () => ({
    de: "assistente",
    texto: `Oi${first ? `, ${first}` : ""}! Posso indicar equipamentos pelo seu estilo, montar um setup, contar em que etapa está seu pedido e tirar dúvidas sobre frete, pagamento e trocas.`,
    sugestoes: START,
  });
  function render() {
    const last = state.mensagens.length - 1;
    log.innerHTML = state.mensagens.map((m, i) => messageHTML(m, i === last)).join("") + (busy ? '<div class="msg msg-bot msg-typing" aria-hidden="true"><span></span><span></span><span></span></div>' : "");
    // Resposta nova aparece do começo; enquanto o assistente "digita", o fim fica à vista.
    const answers = log.querySelectorAll(".msg-bot:not(.msg-typing)");
    const latest = answers[answers.length - 1];
    log.scrollTop = !busy && latest && state.mensagens.at(-1)?.de === "assistente" ? latest.offsetTop - log.offsetTop - 8 : log.scrollHeight;
  }
  function open(show) {
    panel.hidden = !show;
    launcher.setAttribute("aria-expanded", String(show));
    document.body.classList.toggle("assistant-open", show);
    if (show) {
      if (!state.mensagens.length) state.mensagens.push(greeting());
      render();
      input.focus();
    } else launcher.focus();
  }
  async function ask(text) {
    const mensagem = text.trim().slice(0, 500);
    if (!mensagem || busy) return;
    state.mensagens.push({ de: "voce", texto: mensagem });
    busy = true;
    input.value = "";
    render();
    try {
      const r = await send("/assistente", { mensagem, contexto: state.contexto });
      state.contexto = r.contexto;
      state.mensagens.push({ de: "assistente", texto: r.texto, cards: r.cards, acoes: r.acoes, sugestoes: r.sugestoes });
    } catch (error) {
      state.mensagens.push({ de: "assistente", erro: true, texto: `Não consegui responder agora. ${error.message || "Tente de novo em instantes."}`, sugestoes: [mensagem] });
    }
    busy = false;
    save(state);
    render();
    input.focus();
  }
  const cardOf = (id) => state.mensagens.flatMap((m) => m.cards || []).findLast((c) => c.id === id);

  launcher.addEventListener("click", () => open(panel.hidden));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") open(false);
  });
  panel.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-assistant-close]")) open(false);
    else if (t.closest("[data-assistant-reset]")) {
      state.mensagens = [greeting()];
      state.contexto = undefined;
      save(state);
      render();
      input.focus();
    } else if (t.closest("[data-assistant-say]")) ask(t.closest("[data-assistant-say]").dataset.assistantSay);
    else if (t.closest("[data-assistant-add]")) {
      const button = t.closest("[data-assistant-add]");
      const card = cardOf(button.dataset.assistantAdd);
      if (card) addCart(card, 1, { source: button });
    } else if (t.closest("[data-assistant-cart]")) {
      const ids = t.closest("[data-assistant-cart]").dataset.assistantCart.split(",");
      const added = ids.map(cardOf).filter((c) => c && addCart(c, 1, { notify: false })).length;
      if (added) openCart(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho pelo assistente.`);
    }
  });
}
