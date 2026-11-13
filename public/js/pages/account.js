import { icon } from "../icons.js";
import {
  api,
  send,
  toast,
  bindForm,
  requireUser,
  catalogProducts,
  getCart,
  setCart,
  addCart,
  money,
  productImage,
  escapeHtml as esc,
  setNotificationCount,
  accountSections,
  initials,
  logout,
} from "../common.js";
import { orderCardHTML, timelineHTML, trackingHTML, statusClass, orderNumber } from "../orders.js";
import { confirmDialog, emptyState, errorState, maskPhone } from "../components.js";
import { openCart } from "../drawer.js";
import { addressFormHTML, wireAddressForm, formatAddress } from "../address.js";

const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const notificationIcon = { estoque: "bell", preco: "tag", pergunta: "question", pedido: "package" };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function paymentText(p) {
  if (!p) return "";
  if (p.metodo === "cartao") return `Cartão de crédito, ${p.parcelas > 1 ? `${p.parcelas}x sem juros` : "à vista"}`;
  return p.metodo === "pix" ? "Pix" : "Boleto";
}
const groups = {
  todos: () => true,
  andamento: (o) => ["Recebido", "Em preparação", "Enviado"].includes(o.status),
  concluidos: (o) => o.status === "Concluído",
  cancelados: (o) => o.status === "Cancelado",
};

// Estado compartilhado pelas seções: cada uma atualiza a sua parte e a visão geral.
const state = { user: null, orders: null, products: [], notifications: null, alerts: null };
const later = (text) => `<p class="muted small">${text}</p>`;

// Seções da página (visão geral, pedidos, dados...). O endereço (#pedidos) escolhe a seção, e
// links antigos como #seguranca abrem a seção certa já na parte indicada.
const VIEWS = accountSections.filter((s) => s.nav);
const ALIASES = { seguranca: "dados", perfil: "dados" };
export function routeFromHash(hash) {
  const id = decodeURIComponent(String(hash || "").replace(/^#/, ""));
  if (VIEWS.some((v) => v.id === id)) return { view: id };
  if (ALIASES[id]) return { view: ALIASES[id], anchor: id };
  return { view: "visao-geral" };
}
function renderNav() {
  const nav = document.querySelector("#account-nav ul");
  nav.innerHTML = VIEWS.map((v) => `<li><a href="${v.id === "visao-geral" ? "#visao-geral" : `#${v.id}`}" data-view-link="${v.id}">${icon(v.icon, { size: 18 })}<span>${v.label}</span>${v.id === "notificacoes" ? '<span class="nav-count" id="nav-unread" hidden></span>' : ""}</a></li>`).join("");
}
function showView({ moveFocus = false } = {}) {
  const { view, anchor } = routeFromHash(location.hash);
  for (const section of document.querySelectorAll("[data-view]")) section.hidden = section.id !== view;
  const nav = document.querySelector("#account-nav");
  nav.querySelectorAll("[data-view-link]").forEach((a) => {
    if (a.dataset.viewLink === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const label = VIEWS.find((v) => v.id === view).label;
  document.querySelector("#account-crumb").textContent = label;
  document.title = `${view === "visao-geral" ? "Minha conta" : label} | Violet Voltage`;
  // Na navegação em abas (celular), a aba ativa fica à vista.
  const list = nav.querySelector("ul");
  const active = nav.querySelector('[aria-current="page"]');
  if (active && list.scrollWidth > list.clientWidth) list.scrollTo({ left: Math.max(0, active.parentElement.offsetLeft - 16) });
  const section = document.getElementById(view);
  if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  else if (moveFocus) {
    const layout = document.querySelector(".account-layout");
    if (layout.getBoundingClientRect().top < 0) layout.scrollIntoView({ block: "start" });
    section.querySelector("h2").focus({ preventScroll: true });
  }
}

// Visão geral: cartões com o resumo de cada seção, distribuídos pela largura da tela.
function renderStats() {
  const orders = state.orders || [];
  const valid = orders.filter((o) => o.status !== "Cancelado");
  const active = (state.alerts || []).filter((a) => a.produto && !a.notifiedAt).length;
  document.querySelector("#account-stats").innerHTML = [
    ["package", state.orders ? orders.length : "–", orders.length === 1 ? "pedido" : "pedidos", "#pedidos"],
    ["truck", state.orders ? orders.filter(groups.andamento).length : "–", "em andamento", "#pedidos"],
    ["card", state.orders ? money(valid.reduce((s, o) => s + o.totalCents, 0)) : "–", "em compras", "#pedidos"],
    ["tag", state.alerts ? active : "–", active === 1 ? "aviso ativo" : "avisos ativos", "#avisos"],
  ]
    .map(([symbol, value, label, href]) => `<a class="account-stat" href="${href}">${icon(symbol, { size: 20 })}<strong>${value}</strong><span>${label}</span></a>`)
    .join("");
}
function lastOrderHTML() {
  if (!state.orders) return later("Carregando pedidos…");
  const latest = [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest)
    return `<div class="overview-empty">${icon("package", { size: 22 })}<p><strong>Nenhum pedido ainda.</strong> Quando você comprar, a etapa da entrega aparece aqui.</p><a class="button small-button" href="/catalogo.html">Explorar equipamentos</a></div>`;
  const count = latest.itens.reduce((s, i) => s + i.quantidade, 0);
  return `<div class="overview-order"><div><strong>Pedido #${esc(orderNumber(latest))}</strong><small>${day.format(new Date(latest.createdAt))} · ${plural(count, "item", "itens")} · ${money(latest.totalCents)}</small></div><span class="status status-${statusClass(latest.status)}">${esc(latest.status)}</span></div>${timelineHTML(latest)}${trackingHTML(latest)}<div class="overview-actions"><a class="button secondary small-button" href="/pedido.html?id=${encodeURIComponent(latest.id)}">${icon("package", { size: 16 })}Ver comprovante</a></div>`;
}
function notificationsMiniHTML() {
  if (!state.notifications) return later("Carregando notificações…");
  const items = state.notifications.itens.slice(0, 3);
  if (!items.length) return later("Nada novo por aqui. Mudanças nos pedidos, respostas e avisos aparecem nesta área.");
  return `<ul class="mini-list">${items.map((n) => `<li class="${n.lida ? "" : "is-unread"}">${icon(notificationIcon[n.tipo] || "bell", { size: 16 })}<span><a href="${esc(n.link)}">${esc(n.titulo)}</a><small>${when.format(new Date(n.createdAt))}${n.lida ? "" : " · não lida"}</small></span></li>`).join("")}</ul>`;
}
function alertsMiniHTML() {
  if (!state.alerts) return later("Carregando avisos…");
  const live = state.alerts.filter((a) => a.produto && !a.notifiedAt);
  const price = live.filter((a) => a.tipo === "preco").length;
  const stock = live.length - price;
  if (!live.length) return later("Nenhum aviso ativo. Em qualquer produto, “Avisar se baixar o preço”; nos esgotados, “Avise-me”.");
  return `<p class="overview-big">${live.length}</p><p class="muted small">${[stock ? plural(stock, "aviso de reposição", "avisos de reposição") : "", price ? plural(price, "aviso de queda de preço", "avisos de queda de preço") : ""].filter(Boolean).join(" · ")}</p>`;
}
function renderOverview() {
  renderStats();
  const u = state.user;
  const main = (u.enderecos || []).find((a) => a.principal) || (u.enderecos || [])[0];
  const card = (id, title, body, link, { wide = false, linkText } = {}) =>
    `<section class="panel overview-card${wide ? " span-2" : ""}" aria-labelledby="ov-${id}"><div class="overview-card-head"><h3 id="ov-${id}">${title}</h3>${link ? `<a class="text-link small" href="${link}">${linkText || "Ver"}${icon("arrowRight", { size: 14 })}</a>` : ""}</div>${body}</section>`;
  document.querySelector("#overview-grid").innerHTML = [
    card("pedido", "Último pedido", lastOrderHTML(), "#pedidos", { wide: true, linkText: "Todos os pedidos" }),
    card("notificacoes", "Notificações", notificationsMiniHTML(), "#notificacoes", { linkText: "Ver todas" }),
    card("dados", "Meus dados", `<dl class="mini-facts"><div><dt>Nome</dt><dd>${esc(u.nome)}</dd></div><div><dt>E-mail</dt><dd>${esc(u.email)}</dd></div><div><dt>Telefone</dt><dd>${esc(u.telefone || "Não informado")}</dd></div></dl>`, "#dados", { linkText: "Editar" }),
    card("endereco", "Endereço principal", main ? `<p class="overview-text"><strong>${esc(main.apelido || "Endereço")}</strong><br>${esc(formatAddress(main))}</p>` : later("Nenhum endereço salvo. Salve um para escolher em um toque no checkout."), "#enderecos", { linkText: main ? "Gerenciar" : "Adicionar" }),
    card("pagamento", "Pagamento preferido", u.pagamento ? `<p class="overview-text">${icon(u.pagamento.metodo === "pix" ? "pix" : u.pagamento.metodo === "cartao" ? "card" : "barcode", { size: 18 })}<strong>${esc(paymentText(u.pagamento))}</strong></p><p class="muted small">Já vem marcado no checkout.</p>` : later("Ainda não escolhido. A forma preferida já vem marcada no checkout."), "#pagamentos", { linkText: u.pagamento ? "Alterar" : "Escolher" }),
    card("avisos", "Avisos", alertsMiniHTML(), "#avisos", { linkText: "Ver avisos" }),
    card("ajuda", "Precisa de ajuda?", `<ul class="quick-links"><li><a href="#pedidos">${icon("truck", { size: 16 })}Acompanhar um pedido</a></li><li><a href="#ajuda">${icon("refresh", { size: 16 })}Trocar ou devolver</a></li><li><button type="button" class="text-button" data-open-assistant>${icon("chat", { size: 16 })}Falar com o assistente</button></li><li><a href="/ajuda.html">${icon("info", { size: 16 })}Central de ajuda</a></li></ul>`, "#ajuda", { wide: true, linkText: "Mais assuntos" }),
  ].join("");
}

// Notificações: status de pedidos, estoque, preço e respostas; "Marcar todas como lidas" zera o contador.
async function notifications() {
  const list = document.querySelector("#notification-list");
  const empty = document.querySelector("#notifications-empty");
  const unread = document.querySelector("#notifications-unread");
  const readAll = document.querySelector("#notifications-read");
  const render = () => {
    const data = state.notifications;
    unread.hidden = !data.naoLidas;
    unread.textContent = data.naoLidas;
    readAll.hidden = !data.naoLidas;
    const navCount = document.querySelector("#nav-unread");
    if (navCount) {
      navCount.hidden = !data.naoLidas;
      navCount.textContent = data.naoLidas;
    }
    setNotificationCount(data.naoLidas);
    list.hidden = !data.itens.length;
    empty.hidden = !!data.itens.length;
    empty.innerHTML = data.itens.length ? "" : emptyState({ symbol: "bell", level: 3, title: "Nenhuma notificação.", text: "Mudanças nos seus pedidos, respostas às suas perguntas e avisos de estoque e preço aparecem aqui." });
    list.innerHTML = data.itens
      .map(
        (n) =>
          `<li class="notification${n.lida ? "" : " is-unread"}"><span class="notification-icon">${icon(notificationIcon[n.tipo] || "bell", { size: 18 })}</span><div><a href="${esc(n.link)}" data-read="${esc(n.id)}">${esc(n.titulo)}</a><p>${esc(n.texto)}</p><time datetime="${esc(n.createdAt)}">${when.format(new Date(n.createdAt))}</time></div>${n.lida ? "" : '<span class="unread-dot"><span class="sr-only">Não lida</span></span>'}</li>`,
      )
      .join("");
    renderOverview();
  };
  const mark = async (ids) => {
    const result = await send("/notifications/read", ids ? { ids } : {});
    state.notifications.itens = state.notifications.itens.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida: true } : n));
    state.notifications.naoLidas = result.naoLidas;
    render();
  };
  try {
    state.notifications = await api("/notifications");
  } catch {
    state.notifications = { itens: [], naoLidas: 0 };
  }
  render();
  readAll.addEventListener("click", async () => {
    try {
      await mark();
      toast("Notificações marcadas como lidas.", { type: "success" });
    } catch (error) {
      toast(error.message, { type: "error" });
    }
  });
  list.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-read]");
    if (!link || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    await mark([link.dataset.read]).catch(() => {});
    location.href = link.href;
  });
}

// Endereços de entrega: até 5, um principal, em cartões lado a lado.
function addresses() {
  const list = document.querySelector("#address-list");
  const editor = document.querySelector("#address-editor");
  const add = document.querySelector("#address-add");
  const items = () => state.user.enderecos || [];
  const set = (enderecos) => {
    state.user = { ...state.user, enderecos };
    renderOverview();
  };
  const render = () => {
    add.hidden = items().length >= 5 || !!editor.firstChild;
    list.innerHTML = items().length
      ? items()
          .map(
            (a) =>
              `<article class="address-card${a.principal ? " is-main" : ""}" data-address="${esc(a.id)}"><div class="address-text"><strong>${esc(a.apelido || "Endereço")}</strong>${a.principal ? '<span class="badge badge-main">Principal</span>' : ""}<p>${esc(formatAddress(a))}</p></div><div class="address-actions"><button type="button" class="text-button" data-edit>${icon("edit", { size: 16 })}Editar</button>${a.principal ? "" : '<button type="button" class="text-button" data-main>Tornar principal</button>'}<button type="button" class="text-button danger-text" data-delete>${icon("trash", { size: 16 })}Excluir</button></div></article>`,
          )
          .join("")
      : emptyState({ symbol: "pin", level: 3, title: "Nenhum endereço salvo.", text: "Salve onde você recebe seus pedidos para escolher em um toque no checkout." });
  };
  const close = () => {
    editor.innerHTML = "";
    editor.classList.remove("panel");
    render();
    add.focus();
  };
  const open = (current) => {
    editor.classList.add("panel");
    editor.innerHTML = addressFormHTML(current, { first: !items().length || (current?.principal && items().length === 1) });
    const form = editor.querySelector("form");
    wireAddressForm(form);
    form.querySelector("[data-cancel-address]").addEventListener("click", close);
    bindForm(form, async (data) => {
      const body = { ...data, principal: form.elements.principal.checked };
      set(current ? await send(`/addresses/${encodeURIComponent(current.id)}`, body, "PATCH") : await send("/addresses", body));
      toast(current ? "Endereço atualizado." : "Endereço salvo.", { type: "success" });
      close();
    });
    add.hidden = true;
    form.elements.cep.focus();
  };
  add.addEventListener("click", () => open());
  list.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-address]");
    const current = items().find((a) => a.id === card?.dataset.address);
    if (!current) return;
    try {
      if (event.target.closest("[data-edit]")) open(current);
      else if (event.target.closest("[data-main]")) {
        set(await send(`/addresses/${encodeURIComponent(current.id)}`, { ...current, principal: true }, "PATCH"));
        render();
        toast("Endereço principal atualizado.", { type: "success" });
      } else if (event.target.closest("[data-delete]")) {
        const ok = await confirmDialog({ title: "Excluir este endereço?", text: esc(formatAddress(current)), confirm: "Excluir", cancel: "Manter", danger: true });
        if (!ok) return;
        set(await send(`/addresses/${encodeURIComponent(current.id)}`, {}, "DELETE"));
        render();
        toast("Endereço excluído.", { type: "success" });
        add.focus();
      }
    } catch (error) {
      toast(error.message, { type: "error" });
    }
  });
  render();
}

// Avisos "Avise-me" e de queda de preço, em cartões.
async function alerts() {
  const box = document.querySelector("#alert-list");
  const render = () => {
    const shown = (state.alerts || []).filter((a) => a.produto);
    box.innerHTML = shown.length
      ? `<ul class="alert-items">${shown
          .map((a) => {
            const p = a.produto;
            const price = a.tipo === "preco";
            const back = price ? Boolean(a.notifiedAt) || p.priceCents < a.priceCents : p.estoque > 0;
            const stateText = price ? (back ? `Baixou: agora ${money(p.priceCents)}` : `Aguardando queda de preço (hoje ${money(p.priceCents)})`) : back ? "Disponível novamente" : "Aguardando reposição";
            const key = `${p.id}|${price ? "preco" : "estoque"}`;
            return `<li class="alert-item"><img src="${esc(productImage(p))}" alt="" width="52" height="52"><div class="alert-info"><a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(p.marca)} ${esc(p.modelo)}</a><span class="alert-state ${back ? "is-back" : "is-waiting"}">${icon(price ? "tag" : "bell", { size: 14 })}${stateText}</span></div><div class="alert-actions">${back && p.estoque > 0 ? `<button type="button" class="button" data-alert-cart="${esc(p.id)}">${icon("bag", { size: 16 })}Adicionar</button>` : ""}<button type="button" class="text-button" data-alert-remove="${esc(key)}" aria-label="Remover aviso ${price ? "de preço" : "de estoque"} de ${esc(p.marca)} ${esc(p.modelo)}">Remover</button></div></li>`;
          })
          .join("")}</ul>`
      : emptyState({ symbol: "bell", level: 3, title: "Nenhum aviso ativo.", text: "Nos itens esgotados, toque em “Avise-me quando chegar”. Em qualquer produto, “Avisar se baixar o preço”." });
    renderOverview();
  };
  const load = async () => {
    try {
      state.alerts = await api("/alerts");
      render();
    } catch (error) {
      state.alerts = [];
      errorState(box, error, load, { level: 3, title: "Não foi possível carregar seus avisos." });
      renderOverview();
    }
  };
  box.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-alert-remove]");
    const cart = event.target.closest("[data-alert-cart]");
    if (cart) {
      const a = state.alerts.find((x) => x.productId === cart.dataset.alertCart);
      if (a?.produto) addCart(a.produto, 1, { source: cart.closest("li").querySelector("img") });
    } else if (remove) {
      const [id, tipo] = remove.dataset.alertRemove.split("|");
      try {
        await send(`/alerts/${encodeURIComponent(id)}${tipo === "preco" ? "?tipo=preco" : ""}`, {}, "DELETE");
        state.alerts = state.alerts.filter((x) => !(x.productId === id && (x.tipo || "estoque") === tipo));
        render();
        toast("Aviso removido.", { type: "success" });
      } catch (error) {
        toast(error.message, { type: "error" });
      }
    }
  });
  await load();
}

// Forma de pagamento preferida: vem marcada no checkout (sem dados de cartão).
function payments() {
  const form = document.querySelector("#payment-form");
  const installments = document.querySelector("#payment-installments");
  const sync = () => {
    installments.hidden = form.querySelector("input[name=metodo]:checked")?.value !== "cartao";
  };
  // O selo "Preferida" fica na forma salva; a marcação do rádio mostra a escolha ainda não salva.
  const markSaved = () =>
    form.querySelectorAll(".payment-card").forEach((card) => card.classList.toggle("is-saved", card.querySelector("input").value === state.user.pagamento?.metodo));
  const current = state.user.pagamento;
  if (current) {
    const radio = form.querySelector(`input[name=metodo][value="${current.metodo}"]`);
    if (radio) radio.checked = true;
    form.elements.parcelas.value = String(current.parcelas || 1);
  }
  sync();
  markSaved();
  form.addEventListener("change", sync);
  bindForm(form, async (data) => {
    if (!data.metodo) throw new Error("Escolha uma forma de pagamento.");
    const u = await send("/account/payment", { metodo: data.metodo, parcelas: Number(data.parcelas || 1) }, "PATCH");
    state.user = { ...state.user, pagamento: u.pagamento };
    markSaved();
    toast(`Preferência salva: ${paymentText(u.pagamento)}.`, { type: "success" });
    renderOverview();
  });
}

// Segurança e privacidade: trocar senha, baixar os dados e excluir a conta.
function security(user) {
  const passwordForm = document.querySelector("#password-form");
  bindForm(
    passwordForm,
    async (data) => {
      if (data.nova !== data.confirmacao) throw Object.assign(new Error("As duas senhas novas não são iguais."), { field: "confirmacao" });
      await send("/account/password", { atual: data.atual, nova: data.nova });
      passwordForm.reset();
      toast("Senha trocada. As outras sessões foram encerradas.", { type: "success" });
    },
    { messages: { nova: "Use de 10 a 72 caracteres." } },
  );
  const open = document.querySelector("#delete-open");
  const form = document.querySelector("#delete-form");
  const toggle = (show) => {
    form.hidden = !show;
    open.hidden = show;
    open.setAttribute("aria-expanded", String(show));
    if (show) form.elements.senha.focus();
    else open.focus();
  };
  if (user.role === "admin") {
    open.disabled = true;
    document.querySelector("#delete-help").textContent = "Contas de administrador não podem ser excluídas por aqui.";
  }
  open.addEventListener("click", () => toggle(true));
  document.querySelector("#delete-cancel").addEventListener("click", () => {
    form.reset();
    toggle(false);
  });
  bindForm(form, async (data) => {
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
      for (const key of ["vv_assistente"]) sessionStorage.removeItem(key);
    } catch {
      // Sem armazenamento da aba, não há conversa para apagar.
    }
    location.href = "/?conta=excluida";
  });
}

function greet() {
  const u = state.user;
  document.querySelector("#account-greeting").textContent = `Olá, ${u.nome.split(" ")[0]}.`;
  document.querySelector("#account-email").textContent = u.email;
  document.querySelector("#account-avatar").textContent = initials(u.nome);
}

export default async function account(session) {
  const user = await session;
  if (!requireUser(user)) return;
  state.user = user;
  renderNav();
  showView();
  addEventListener("hashchange", () => showView({ moveFocus: true }));
  greet();
  renderOverview();
  const form = document.querySelector("#profile-form");
  for (const key of ["nome", "email", "telefone", "endereco"]) form.elements[key].value = user[key] || "";
  maskPhone(form.elements.telefone);
  addresses();
  notifications();
  alerts();
  payments();
  security(user);
  bindForm(form, async (data) => {
    const u = await send("/profile", data, "PATCH");
    state.user = { ...state.user, ...u };
    greet();
    renderOverview();
    toast("Dados atualizados.", { type: "success" });
  });
  document.querySelector("#logout").addEventListener("click", logout);
  // "Falar com o assistente": abre o painel do assistente, se ele já carregou.
  document.querySelector(".account-page").addEventListener("click", (event) => {
    if (!event.target.closest("[data-open-assistant]")) return;
    const launcher = document.querySelector(".assistant-launcher");
    if (launcher) {
      if (launcher.getAttribute("aria-expanded") !== "true") launcher.click();
    } else toast("O assistente ainda está carregando. Tente de novo em instantes ou use a Central de ajuda.", { type: "info" });
  });
  const list = document.querySelector("#orders");
  const filters = document.querySelector("#order-filters");
  let group = "todos";
  function render() {
    const orders = state.orders || [];
    filters.querySelectorAll("[data-group]").forEach((b) => {
      const count = orders.filter(groups[b.dataset.group]).length;
      b.querySelector(".chip-count").textContent = count;
      b.setAttribute("aria-pressed", String(b.dataset.group === group));
    });
    const shown = orders.filter(groups[group]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    list.innerHTML = shown.length
      ? shown.map((o) => orderCardHTML(o, { products: state.products })).join("")
      : orders.length
        ? emptyState({ symbol: "package", title: "Nenhum pedido neste filtro.", level: 3 })
        : emptyState({ symbol: "package", level: 3, title: "Nenhuma compra por aqui ainda.", text: "Quando você finalizar um pedido, ele aparece aqui com cada etapa da entrega.", actions: '<a class="button" href="/catalogo.html">Explorar equipamentos</a>' });
    renderOverview();
  }
  async function load() {
    list.setAttribute("aria-busy", "true");
    list.innerHTML = '<div class="loading" role="status">Carregando compras…</div>';
    try {
      const [orders, products] = await Promise.all([api("/orders"), catalogProducts().catch(() => [])]);
      state.orders = orders;
      state.products = products;
      render();
    } catch (error) {
      errorState(list, error, load, { level: 3, title: "Não foi possível carregar seus pedidos." });
    } finally {
      list.setAttribute("aria-busy", "false");
    }
  }
  filters.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-group]");
    if (!chip) return;
    group = chip.dataset.group;
    render();
  });
  list.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-order-id]");
    if (!card) return;
    const order = state.orders.find((o) => o.id === card.dataset.orderId);
    if (event.target.closest("[data-reorder]")) {
      const cart = getCart();
      let added = 0;
      let missing = 0;
      for (const item of order.itens) {
        const p = state.products.find((x) => x.id === item.id);
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
    } else if (event.target.closest("[data-cancel]")) {
      const ok = await confirmDialog({
        title: `Cancelar o pedido #${orderNumber(order)}?`,
        text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.",
        confirm: "Cancelar pedido",
        cancel: "Manter pedido",
        danger: true,
      });
      if (!ok) return;
      try {
        const updated = await send(`/orders/${order.id}/cancel`, {});
        state.orders = state.orders.map((o) => (o.id === updated.id ? updated : o));
        render();
        toast("Pedido cancelado.", { type: "success" });
      } catch (error) {
        toast(error.message, { type: "error" });
        load();
      }
    }
  });
  await load();
}
