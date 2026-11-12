// Assistente de compras: painel não modal, disponível só para quem está logado.
// As respostas vêm de /api/assistente (PLN local do servidor); o histórico fica nesta aba.
import { icon } from "./icons.js";
import { send, money, productImage, escapeHtml as esc, addCart, getCart, getWishlist, catalogProducts, toast } from "./common.js";
import { openCart } from "./drawer.js";

const KEY = "vv_assistente";
const LIMIT = 40;
const START = ["Quero uma guitarra vintage", "Montar um setup de rock", "Onde está meu pedido?", "O que é humbucker?"];
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
            : a.tipo === "cupom"
              ? `<button type="button" class="button small" data-assistant-coupon="${esc(a.codigo)}">${icon("tag", { size: 16 })}${esc(a.rotulo)}</button>`
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
    texto: `Oi${first ? `, ${first}` : ""}! Posso indicar e comparar equipamentos, responder sobre a ficha do produto que você está vendo, conferir o que falta no carrinho, montar um setup, explicar termos e contar em que etapa está seu pedido.`,
    sugestoes: startChips(),
  });
  function render() {
    const last = state.mensagens.length - 1;
    log.innerHTML = state.mensagens.map((m, i) => messageHTML(m, i === last)).join("") + (busy ? '<div class="msg msg-bot msg-typing" aria-hidden="true"><span></span><span></span><span></span></div>' : "");
    // Resposta nova aparece do começo; enquanto o assistente "digita", o fim fica à vista.
    const answers = log.querySelectorAll(".msg-bot:not(.msg-typing)");
    const latest = answers[answers.length - 1];
    log.scrollTop = !busy && latest && state.mensagens.at(-1)?.de === "assistente" ? latest.offsetTop - log.offsetTop - 8 : log.scrollHeight;
  }
  // No celular o painel ocupa a tela: o resto da página fica inerte (teclado e leitor de tela).
  const fullScreen = matchMedia("(max-width: 699px)");
  let inerted = [];
  function setModal(on) {
    for (const el of inerted) el.inert = false;
    inerted = on ? [...document.body.children].filter((el) => el !== panel && !el.inert && el.tagName !== "SCRIPT") : [];
    for (const el of inerted) el.inert = true;
    panel.setAttribute("aria-modal", String(on));
  }
  fullScreen.addEventListener("change", () => !panel.hidden && setModal(fullScreen.matches));
  function open(show) {
    panel.hidden = !show;
    setModal(show && fullScreen.matches);
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
      // Só IDs e quantidades: o servidor confere tudo no catálogo.
      const r = await send("/assistente", {
        mensagem,
        contexto: state.contexto,
        pagina: pageInfo(),
        carrinho: getCart().map(({ id, quantidade }) => ({ id, quantidade })),
        favoritos: getWishlist().slice(0, 100),
      });
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
  // No carrinho, o botão avisa quando falta algo essencial (cabo, amplificador, fonte...).
  if (location.pathname === "/carrinho.html") {
    const hint = async () => {
      try {
        const [{ cartAdvice }, products] = await Promise.all([import("./compat.js"), catalogProducts()]);
        const lines = getCart().map((i) => ({ product: products.find((p) => p.id === i.id), quantidade: i.quantidade })).filter((l) => l.product);
        const n = cartAdvice(lines, products).filter((a) => a.nivel === "essencial").length;
        launcher.querySelector(".assistant-hint")?.remove();
        if (n) launcher.insertAdjacentHTML("beforeend", `<span class="assistant-hint">${n}</span>`);
        launcher.setAttribute("aria-label", n ? `Assistente: ${n} ${n === 1 ? "dica" : "dicas"} para o seu carrinho` : "Assistente");
      } catch {
        /* a dica é opcional */
      }
    };
    hint();
    document.addEventListener("vv:cart", hint);
  }
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
      // Itens de kit podem não estar entre os cartões: completa com o catálogo atual.
      catalogProducts()
        .catch(() => [])
        .then((products) => {
          const added = ids.map((id) => cardOf(id) || products.find((p) => p.id === id)).filter((c) => c && addCart(c, 1, { notify: false })).length;
          if (added) openCart(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho pelo assistente.`);
          else toast("Esses itens já estão no carrinho no limite do estoque.", { type: "info" });
        });
    } else if (t.closest("[data-assistant-coupon]")) {
      const code = t.closest("[data-assistant-coupon]").dataset.assistantCoupon;
      try {
        localStorage.setItem("vv_coupon", code);
        toast(`Cupom ${code} aplicado. Ele aparece no carrinho e no checkout.`, { type: "success", action: { label: "Ver carrinho", onClick: () => (location.href = "/carrinho.html") } });
      } catch {
        toast("Não foi possível guardar o cupom neste navegador.", { type: "error" });
      }
    }
  });
}
