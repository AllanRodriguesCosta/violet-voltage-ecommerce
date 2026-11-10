import { icon } from "./icons.js";

export const categories = [
  "Guitarras",
  "Pedais",
  "Amplificadores",
  "Cabos",
  "Correias",
  "Acessórios",
];
export const money = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export function productImage(product) {
  if (product?.blobName) {
    return (
      product.imageUrl ||
      `/api/images/${encodeURIComponent(product.id || product.rowKey)}`
    );
  }
  if (product?.imageUrl) return product.imageUrl;
  const fallbacks = {
    Guitarras: "/assets/product.svg",
    Pedais: "/assets/pedal.svg",
    Amplificadores: "/assets/amp.svg",
    Cabos: "/assets/accessory.svg",
    Correias: "/assets/accessory.svg",
    Acessórios: "/assets/accessory.svg",
  };
  return fallbacks[product?.categoria] || "/assets/product.svg";
}
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Busca sem diferenciar acentos e maiúsculas.
export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export async function api(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" };
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      "Não foi possível conectar. Verifique sua conexão e tente novamente.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error(
      "O serviço não respondeu como esperado. Tente novamente em instantes.",
    );
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const e = new Error(result?.error?.message || "Não foi possível concluir.");
    e.field = result?.error?.field;
    e.status = response.status;
    throw e;
  }
  if (!result || typeof result !== "object" || !Object.hasOwn(result, "data")) {
    throw new Error(
      "O serviço retornou dados incompletos. Tente novamente em instantes.",
    );
  }
  return result.data;
}
export const send = (path, body, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });

// Catálogo compartilhado por cabeçalho, minicarrinho e páginas: uma consulta por visita.
let catalogRequest;
export function catalogProducts({ fresh = false } = {}) {
  if (fresh || !catalogRequest)
    catalogRequest = api("/products").catch((error) => {
      catalogRequest = undefined;
      throw error;
    });
  return catalogRequest.then((list) => [...list]);
}
export function searchProducts(products, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return products;
  return products
    .map((p) => {
      const title = normalize(`${p.marca} ${p.modelo}`);
      const facets = normalize(`${title} ${p.categoria}`);
      const all = `${facets} ${normalize(p.descricao)}`;
      if (!terms.every((t) => all.includes(t))) return null;
      let score = 0;
      for (const t of terms) {
        if (normalize(p.modelo).startsWith(t)) score += 4;
        if (title.includes(t)) score += 3;
        else if (facets.includes(t)) score += 2;
        else score += 0.5;
      }
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
}

// Eventos internos da loja; ignorados quando não há DOM (testes).
export function emit(name, detail) {
  const doc = globalThis.document;
  if (typeof doc?.dispatchEvent === "function")
    doc.dispatchEvent(new CustomEvent(name, { detail }));
}
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);
function readList(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data.filter(validId) : [];
  } catch {
    return [];
  }
}
export function getCart() {
  try {
    const data = JSON.parse(localStorage.getItem("vv_cart") || "[]");
    return Array.isArray(data)
      ? data.filter(
          (i) =>
            validId(i?.id) &&
            Number.isInteger(i.quantidade) &&
            i.quantidade > 0 &&
            i.quantidade <= 99,
        )
      : [];
  } catch {
    return [];
  }
}
export function setCart(items) {
  localStorage.setItem("vv_cart", JSON.stringify(items));
  updateCounts();
  emit("vv:cart", items);
}
export const cartQuantity = () =>
  getCart().reduce((sum, item) => sum + item.quantidade, 0);
function updateCounts() {
  const doc = globalThis.document;
  const cart = cartQuantity();
  const legacy = doc?.querySelector?.("#cart-count");
  if (legacy) legacy.textContent = cart;
  doc?.querySelectorAll?.("[data-cart-count]").forEach((el) => {
    el.textContent = cart;
    el.hidden = cart === 0;
  });
  const wishes = getWishlist().length;
  doc?.querySelectorAll?.("[data-wishlist-count]").forEach((el) => {
    el.textContent = wishes;
    el.hidden = wishes === 0;
  });
}
export function addCart(product, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    toast("Informe uma quantidade inteira entre 1 e 99.", { type: "error" });
    return false;
  }
  const cart = getCart();
  const current = cart.find((i) => i.id === product.id);
  if ((current?.quantidade || 0) + quantity > Math.min(99, product.estoque)) {
    toast("Quantidade maior que o estoque disponível.", { type: "error" });
    return false;
  }
  if (current) current.quantidade += quantity;
  else cart.push({ id: product.id, quantidade: quantity });
  try {
    setCart(cart);
  } catch {
    toast(
      "Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador e tente novamente.",
      { type: "error" },
    );
    return false;
  }
  emit("vv:cart-added", { product, quantity });
  return true;
}

// Lista de desejos e vistos recentemente ficam neste navegador.
export const getWishlist = () => readList("vv_wishlist");
export const isWished = (id) => getWishlist().includes(id);
export function setWishlist(ids) {
  localStorage.setItem("vv_wishlist", JSON.stringify(ids.filter(validId).slice(0, 100)));
  updateCounts();
  emit("vv:wishlist", ids);
}
export function toggleWishlist(id) {
  const list = getWishlist();
  const wished = list.includes(id);
  try {
    setWishlist(wished ? list.filter((x) => x !== id) : [id, ...list]);
  } catch {
    toast("Não foi possível salvar seus favoritos neste navegador.", { type: "error" });
    return wished;
  }
  return !wished;
}
export const getRecent = () => readList("vv_recent");
export function pushRecent(id) {
  if (!validId(id)) return;
  try {
    localStorage.setItem(
      "vv_recent",
      JSON.stringify([id, ...getRecent().filter((x) => x !== id)].slice(0, 12)),
    );
  } catch {
    // Sem armazenamento local, a vitrine apenas não mostra vistos recentemente.
  }
}

let timer;
export function toast(message, { type = "info", action } = {}) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.className = `toast toast-${type}`;
  el.textContent = message;
  if (typeof el.insertAdjacentHTML === "function") {
    const symbol = { success: "check", error: "alert", info: "info" }[type] || "info";
    el.insertAdjacentHTML("afterbegin", icon(symbol, { size: 18 }));
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        el.hidden = true;
        action.onClick();
      });
      el.append(button);
    }
  }
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), action ? 7000 : 4500);
}
export function showError(container, error) {
  container.querySelectorAll(".field-error,.error").forEach((e) => e.remove());
  const field = error.field && container.elements?.namedItem(error.field);
  const message = document.createElement("div");
  message.className = field ? "field-error" : "error";
  message.setAttribute("role", "alert");
  message.textContent = error.message;
  if (field) {
    message.id = `error-${error.field}`;
    field.setAttribute("aria-describedby", message.id);
    field.setAttribute("aria-invalid", "true");
    field.after(message);
    field.focus();
  } else container.prepend(message);
}
export function bindForm(form, handler) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "true";
    form.querySelectorAll(".field-error,.error").forEach((e) => e.remove());
    form.querySelectorAll("[aria-invalid]").forEach((e) => {
      e.removeAttribute("aria-invalid");
      const references = (e.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && document.getElementById(id));
      if (references.length)
        e.setAttribute("aria-describedby", references.join(" "));
      else e.removeAttribute("aria-describedby");
    });
    const button = form.querySelector("[type=submit]");
    const label = button.textContent;
    button.disabled = true;
    button.classList?.add("is-busy");
    button.textContent = "Aguarde…";
    try {
      await handler(Object.fromEntries(new FormData(form)), form);
    } catch (e) {
      showError(form, e);
    } finally {
      delete form.dataset.busy;
      button.disabled = false;
      button.classList?.remove("is-busy");
      button.textContent = label;
    }
  });
}

const categoryLink = (c) => `/catalogo.html?categoria=${encodeURIComponent(c)}`;
function headerHTML() {
  return `<a class="skip" href="#main">Pular para o conteúdo</a>
<div class="announcement"><div class="container announcement-inner"><span>${icon("store", { size: 15 })} Retirada na loja sem custo</span><span class="hide-sm">${icon("truck", { size: 15 })} Entrega expressa em 1 a 3 dias úteis</span><span class="hide-md">${icon("refresh", { size: 15 })} Troca em até 7 dias</span></div></div>
<header class="site-header"><div class="container header-bar">
<button type="button" class="icon-button menu-toggle" data-open-menu aria-haspopup="dialog" aria-label="Abrir menu">${icon("menu")}</button>
<a class="brand" href="/" aria-label="Violet Voltage, início"><span class="brand-mark" aria-hidden="true">${icon("bolt", { size: 20 })}</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a>
<form class="header-search search-box" id="header-search" role="search" action="/catalogo.html"><label class="sr-only" for="header-q">Buscar equipamentos</label><span class="search-icon">${icon("search", { size: 18 })}</span><input id="header-q" name="q" type="search" placeholder="Buscar guitarras, pedais, marcas…" autocomplete="off" maxlength="80" role="combobox" aria-expanded="false" aria-controls="header-suggestions" aria-autocomplete="list"><div class="suggestions" id="header-suggestions" role="listbox" aria-label="Sugestões" hidden></div></form>
<nav class="header-actions" aria-label="Atalhos da loja">
<button type="button" class="icon-button search-trigger" data-open-search aria-haspopup="dialog" aria-label="Buscar">${icon("search")}</button>
<a class="icon-button wish-link" href="/favoritos.html" aria-label="Favoritos">${icon("heart")}<span class="count" data-wishlist-count hidden>0</span></a>
<a class="account-link" href="/login.html" id="account-link">${icon("user")}<span class="account-label">Entrar</span></a>
<a class="icon-button cart-link" href="/carrinho.html" data-open-cart aria-label="Carrinho">${icon("bag")}<span class="count" id="cart-count" data-cart-count hidden>0</span></a>
</nav></div></header>
<nav class="category-nav" aria-label="Categorias"><div class="container category-nav-inner"><a href="/catalogo.html">Todo o catálogo</a>${categories.map((c) => `<a href="${categoryLink(c)}">${c}</a>`).join("")}<a href="/admin.html" class="admin-link" hidden>Painel</a></div></nav>
<dialog class="menu-dialog" id="menu-dialog" aria-label="Menu"><div class="menu-panel"><div class="menu-head"><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span><button type="button" class="icon-button" data-close-dialog aria-label="Fechar menu">${icon("close")}</button></div><nav aria-label="Menu principal"><p class="menu-title">Categorias</p><a href="/catalogo.html">${icon("grid")}Todo o catálogo</a>${categories.map((c) => `<a href="${categoryLink(c)}">${icon("chevronRight", { size: 16 })}${c}</a>`).join("")}<p class="menu-title">Sua conta</p><a href="/minha-conta.html" class="menu-account">${icon("user")}Minha conta</a><a href="/favoritos.html">${icon("heart")}Favoritos</a><a href="/carrinho.html">${icon("bag")}Carrinho</a><a href="/admin.html" class="admin-link" hidden>${icon("grid")}Painel administrativo</a></nav></div></dialog>
<dialog class="search-dialog" id="search-dialog" aria-label="Buscar"><form class="search-box" role="search" action="/catalogo.html"><label class="sr-only" for="dialog-q">Buscar equipamentos</label><span class="search-icon">${icon("search", { size: 18 })}</span><input id="dialog-q" name="q" type="search" placeholder="O que você procura?" autocomplete="off" maxlength="80" role="combobox" aria-expanded="false" aria-controls="dialog-suggestions" aria-autocomplete="list"><button type="button" class="icon-button" data-close-dialog aria-label="Fechar busca">${icon("close")}</button><div class="suggestions" id="dialog-suggestions" role="listbox" aria-label="Sugestões" hidden></div></form><div class="search-shortcuts"><p class="menu-title">Categorias</p><div class="chip-row">${categories.map((c) => `<a class="chip" href="${categoryLink(c)}">${c}</a>`).join("")}</div></div></dialog>`;
}
function footerHTML() {
  return `<footer class="footer"><div class="container footer-grid">
<div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${icon("bolt", { size: 20 })}</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a><p>Seu próximo som começa aqui. Guitarras, efeitos, amplificadores e acessórios para cada etapa da sua jornada.</p></div>
<nav aria-label="Loja"><h2>Loja</h2><a href="/catalogo.html">Todo o catálogo</a>${categories.slice(0, 4).map((c) => `<a href="${categoryLink(c)}">${c}</a>`).join("")}</nav>
<nav aria-label="Sua conta"><h2>Sua conta</h2><a href="/minha-conta.html">Minha conta</a><a href="/minha-conta.html#pedidos">Meus pedidos</a><a href="/favoritos.html">Favoritos</a><a href="/carrinho.html">Carrinho</a></nav>
<div><h2>Formas de pagamento</h2><ul class="payment-list"><li>${icon("pix", { size: 18 })}Pix</li><li>${icon("card", { size: 18 })}Cartão de crédito</li><li>${icon("barcode", { size: 18 })}Boleto</li></ul></div>
</div><div class="container footer-bottom"><p>Projeto acadêmico · © ${new Date().getFullYear()} Violet Voltage</p><p>Feito com Node.js, Express e PostgreSQL.</p></div></footer>`;
}
function bottomNavHTML() {
  const items = [
    ["/", "home", "Início"],
    ["/catalogo.html", "grid", "Catálogo"],
    ["/favoritos.html", "heart", "Favoritos", "data-wishlist-count"],
    ["/carrinho.html", "bag", "Carrinho", "data-cart-count"],
    ["/minha-conta.html", "user", "Conta"],
  ];
  return `<nav class="bottom-nav" aria-label="Navegação rápida">${items
    .map(
      ([href, name, label, counter]) =>
        `<a href="${href}">${icon(name, { size: 22 })}<span>${label}</span>${counter ? `<span class="count" ${counter} hidden>0</span>` : ""}</a>`,
    )
    .join("")}</nav>`;
}
function markCurrent() {
  const path = location.pathname === "/index.html" ? "/" : location.pathname;
  const category = new URLSearchParams(location.search).get("categoria");
  document.querySelectorAll(".bottom-nav a").forEach((a) => {
    if (new URL(a.href).pathname === path) a.setAttribute("aria-current", "page");
  });
  document.querySelectorAll(".category-nav a").forEach((a) => {
    const url = new URL(a.href);
    if (url.pathname === path && url.searchParams.get("categoria") === category)
      a.setAttribute("aria-current", "page");
  });
}
function wireDialogs() {
  const menu = document.querySelector("#menu-dialog");
  document.querySelector("[data-open-menu]").addEventListener("click", () => menu.showModal());
  for (const dialog of document.querySelectorAll(".menu-dialog, .search-dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-close-dialog]")) dialog.close();
    });
  }
}
export async function shell() {
  document.querySelector("#header").innerHTML = headerHTML();
  document.querySelector("#footer").innerHTML = footerHTML();
  document.body.insertAdjacentHTML("beforeend", bottomNavHTML());
  wireDialogs();
  markCurrent();
  updateCounts();
  addEventListener("storage", (event) => {
    if (["vv_cart", "vv_wishlist"].includes(event.key)) updateCounts();
  });
  let user = null;
  try {
    user = await api("/auth/session");
    if (!user) return null;
    const account = document.querySelector("#account-link");
    account.href = "/minha-conta.html";
    account.querySelector(".account-label").textContent = `Olá, ${user.nome.split(" ")[0]}`;
    account.setAttribute("aria-label", `Minha conta, ${user.nome}`);
    document.querySelectorAll(".admin-link").forEach((a) => (a.hidden = user.role !== "admin"));
  } catch {
    user = undefined;
    toast("Não foi possível verificar sua sessão.", { type: "error" });
  }
  return user;
}
export function requireUser(user) {
  if (user === undefined) {
    const main = document.querySelector("#main");
    main.innerHTML =
      '<section class="panel container state-panel"><h1>Não foi possível verificar sua sessão</h1><p>Confira sua conexão e tente novamente. Seus dados não foram alterados.</p><div class="row"><button type="button" id="retry-session">Tentar novamente</button><a class="button secondary" href="/">Voltar à loja</a></div></section>';
    document.querySelector("#retry-session").onclick = () => location.reload();
    return false;
  }
  if (!user) {
    location.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
    return false;
  }
  return true;
}
const paymentLabels = { pix: "Pix", cartao: "Cartão de crédito", boleto: "Boleto" };
const deliveryLabels = { padrao: "Entrega padrão", expressa: "Entrega expressa", retirada: "Retirada na loja" };
export const statusClass = (status) =>
  ({ Recebido: "received", "Em preparação": "preparing", Enviado: "shipped", Concluído: "done", Cancelado: "canceled" })[status] || "received";
export function ordersHTML(orders, admin = false) {
  if (!orders.length)
    return `<div class="empty">${icon("package", { size: 28 })}<h3>Nenhuma compra por aqui ainda.</h3><p>Quando você finalizar um pedido, ele aparece aqui com status e detalhes.</p><a class="button secondary" href="/catalogo.html">Explorar equipamentos</a></div>`;
  return [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (o) =>
        `<details class="order"><summary><span class="order-head"><strong>Pedido ${escapeHtml(o.id.slice(0, 8).toUpperCase())}</strong><span class="status status-${statusClass(o.status)}">${escapeHtml(o.status)}</span></span><span class="order-meta"><span>${new Date(o.createdAt).toLocaleString("pt-BR")}</span><strong>${money(o.totalCents)}</strong></span><span class="order-toggle">Ver detalhes ${icon("chevronDown", { size: 16 })}</span></summary><div class="order-body"><ul class="order-items">${o.itens.map((i) => `<li><span>${i.quantidade} × ${escapeHtml(i.nome)}</span><strong>${money(i.priceCents * i.quantidade)}</strong></li>`).join("")}</ul><dl class="order-facts"><div><dt>Subtotal</dt><dd>${money(o.subtotalCents)}</dd></div><div><dt>Frete</dt><dd>${money(o.freteCents)}</dd></div><div><dt>Pagamento</dt><dd>${escapeHtml(paymentLabels[o.pagamento] || o.pagamento)}</dd></div><div><dt>Entrega</dt><dd>${escapeHtml(deliveryLabels[o.entrega] || o.entrega)}</dd></div><div class="wide"><dt>Endereço</dt><dd>${escapeHtml(o.endereco)}</dd></div><div class="wide"><dt>Número completo</dt><dd>${escapeHtml(o.id)}</dd></div></dl>${admin ? `<label for="status-${o.id}">Status do pedido</label><select class="order-status" id="status-${o.id}" data-order="${o.id}">${["Recebido", "Em preparação", "Enviado", "Concluído", "Cancelado"].map((s) => `<option${o.status === s ? " selected" : ""}>${s}</option>`).join("")}</select>` : ""}</div></details>`,
    )
    .join("");
}
