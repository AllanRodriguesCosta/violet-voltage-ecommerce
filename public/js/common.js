import { icon } from "./icons.js";
import { themeSwitchHTML } from "./theme.js";
import { specText } from "./specs.js";

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
      const facets = normalize(`${title} ${p.categoria} ${specText(p)}`);
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

// Tolerância a erros de digitação: distância de edição entre palavras (com transposição).
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
// "Você quis dizer": troca termos desconhecidos pela palavra mais próxima do catálogo
// (marca, modelo, categoria e descrição); devolve null quando a correção não traz resultados.
export function correctQuery(products, query) {
  const vocabulary = new Set(categories.map(normalize));
  for (const p of products)
    for (const word of normalize(`${p.marca} ${p.modelo} ${p.categoria} ${p.descricao || ""} ${specText(p)}`).split(/[^a-z0-9]+/))
      if (word.length >= 3) vocabulary.add(word);
  const words = [...vocabulary];
  let changed = false;
  const fixed = normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      if (term.length < 4 || words.some((w) => w.startsWith(term))) return term;
      const limit = term.length >= 7 ? 2 : 1;
      let best = null;
      let bestDistance = limit + 1;
      for (const w of words) {
        if (Math.abs(w.length - term.length) > limit) continue;
        const distance = editDistance(term, w);
        if (distance < bestDistance) [best, bestDistance] = [w, distance];
      }
      if (!best) return term;
      changed = true;
      return best;
    })
    .join(" ");
  return changed && searchProducts(products, fixed).length ? fixed : null;
}
// Buscas recentes neste navegador (até 5), mostradas nas sugestões.
export const recentSearches = () => {
  try {
    const list = JSON.parse(localStorage.getItem("vv_searches") || "[]");
    return Array.isArray(list) ? list.filter((q) => typeof q === "string" && q.length <= 80).slice(0, 5) : [];
  } catch {
    return [];
  }
};
export function rememberSearch(query) {
  const q = String(query || "").trim().slice(0, 80);
  if (normalize(q).length < 2) return;
  try {
    localStorage.setItem("vv_searches", JSON.stringify([q, ...recentSearches().filter((x) => normalize(x) !== normalize(q))].slice(0, 5)));
  } catch {
    // Sem armazenamento local, a busca segue sem histórico.
  }
}
export function clearSearches() {
  try {
    localStorage.removeItem("vv_searches");
  } catch {
    // Nada a limpar.
  }
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
export function addCart(product, quantity = 1, { notify = true, source } = {}) {
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
  if (notify) emit("vv:cart-added", { product, quantity, source });
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

// Aviso com tempo visível; pausa enquanto o cursor ou o foco estão nele.
let timer;
let toastLeft = 0;
let toastStarted = 0;
function pauseToast(el) {
  if (el.hidden || el.classList.contains("is-paused")) return;
  clearTimeout(timer);
  toastLeft = Math.max(1500, toastLeft - (Date.now() - toastStarted));
  el.classList.add("is-paused");
}
function resumeToast(el) {
  if (el.hidden || !el.classList.contains("is-paused")) return;
  el.classList.remove("is-paused");
  toastStarted = Date.now();
  timer = setTimeout(() => (el.hidden = true), toastLeft);
}
export function toast(message, { type = "info", action } = {}) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
    el.addEventListener("pointerenter", () => pauseToast(el));
    el.addEventListener("pointerleave", () => resumeToast(el));
    el.addEventListener("focusin", () => pauseToast(el));
    el.addEventListener("focusout", () => resumeToast(el));
  }
  const duration = action ? 7000 : 4500;
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
    el.insertAdjacentHTML("beforeend", `<span class="toast-timer" aria-hidden="true" style="--toast-ms:${duration}ms"></span>`);
  }
  el.hidden = false;
  clearTimeout(timer);
  toastLeft = duration;
  toastStarted = Date.now();
  timer = setTimeout(() => (el.hidden = true), duration);
}
export function showError(container, error) {
  container.querySelectorAll(".field-error,.error").forEach((e) => e.remove());
  let field = error.field && container.elements?.namedItem(error.field);
  if (field && typeof field.setAttribute !== "function") field = field[0] || null;
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
// Validação com mensagens em português ligadas ao campo (aria-invalid e aria-describedby),
// no lugar dos balões nativos, que variam conforme o idioma do navegador.
export function fieldMessage(input, custom) {
  const v = input.validity;
  if (custom) return custom;
  if (v.valueMissing) return input.type === "checkbox" ? "Marque esta opção para continuar." : "Preencha este campo.";
  if (v.typeMismatch && input.type === "email") return "Informe um e-mail válido, como nome@exemplo.com.";
  if (v.tooShort) return `Use pelo menos ${input.minLength} caracteres.`;
  if (v.tooLong) return `Use no máximo ${input.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `Informe um valor a partir de ${input.min}.`;
  if (v.rangeOverflow) return `Informe um valor até ${input.max}.`;
  if (v.badInput || v.stepMismatch) return "Informe um número inteiro válido.";
  if (v.patternMismatch) return input.title || "Confira o formato informado.";
  return input.validationMessage;
}
export function markField(input, message) {
  const id = `hint-${input.name || input.id}`;
  let hint = document.getElementById(id);
  const refs = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  if (!message) {
    hint?.remove();
    input.removeAttribute("aria-invalid");
    refs.delete(id);
    if (refs.size) input.setAttribute("aria-describedby", [...refs].join(" "));
    else input.removeAttribute("aria-describedby");
    return;
  }
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "field-error";
    hint.id = id;
    (input.closest(".password-field, .stepper, .search-box") || input).after(hint);
  }
  hint.textContent = message;
  input.setAttribute("aria-invalid", "true");
  refs.add(id);
  input.setAttribute("aria-describedby", [...refs].join(" "));
}
// Marca todos os campos inválidos e leva o foco ao primeiro; devolve se o formulário é válido.
export function validateForm(form, messages = {}) {
  const invalid = [...form.elements].filter((field) => field.willValidate && !field.checkValidity());
  invalid.forEach((field) => markField(field, fieldMessage(field, messages[field.name])));
  invalid[0]?.focus();
  return !invalid.length;
}
export function bindForm(form, handler, { messages = {} } = {}) {
  if (typeof form.checkValidity === "function") {
    form.noValidate = true;
    // Ao sair de um campo preenchido e inválido, o erro aparece; some assim que o valor fica válido.
    // Se a saída é o clique no botão de envio, o envio valida: inserir a mensagem antes deslocaria
    // o botão entre o pressionar e o soltar, e o clique se perderia.
    let pressingSubmit = false;
    form.addEventListener("pointerdown", (event) => (pressingSubmit = !!event.target.closest?.("[type=submit]")));
    addEventListener("pointerup", () => setTimeout(() => (pressingSubmit = false)));
    form.addEventListener("focusout", (event) => {
      const field = event.target;
      if (pressingSubmit || event.relatedTarget?.type === "submit") return;
      if (field.willValidate && field.value && !field.checkValidity()) markField(field, fieldMessage(field, messages[field.name]));
    });
    form.addEventListener("input", (event) => {
      const field = event.target;
      if (field.getAttribute?.("aria-invalid") === "true" && field.checkValidity?.()) markField(field, "");
    });
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      validateForm(form, messages);
      return;
    }
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
<div class="announcement"><div class="container announcement-inner"><span>${icon("truck", { size: 15 })} Frete grátis acima de R$ 999</span><span class="hide-sm">${icon("card", { size: 15 })} Até 10x sem juros no cartão</span><span class="hide-md">${icon("store", { size: 15 })} Retirada na loja sem custo</span></div></div>
<header class="site-header"><div class="container header-bar">
<button type="button" class="icon-button menu-toggle" data-open-menu aria-haspopup="dialog" aria-label="Abrir menu">${icon("menu")}</button>
<a class="brand" href="/" aria-label="Violet Voltage, início"><span class="brand-mark" aria-hidden="true">${icon("bolt", { size: 20 })}</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a>
<form class="header-search search-box" id="header-search" role="search" action="/catalogo.html"><label class="sr-only" for="header-q">Buscar equipamentos</label><span class="search-icon">${icon("search", { size: 18 })}</span><input id="header-q" name="q" type="search" placeholder="Buscar guitarras, pedais, marcas…" autocomplete="off" maxlength="80" role="combobox" aria-expanded="false" aria-controls="header-suggestions" aria-autocomplete="list"><div class="suggestions" id="header-suggestions" role="listbox" aria-label="Sugestões" hidden></div></form>
<nav class="header-actions" aria-label="Atalhos da loja">
<button type="button" class="icon-button search-trigger" data-open-search aria-haspopup="dialog" aria-label="Buscar">${icon("search")}</button>
<button type="button" class="icon-button theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Tema escuro">${icon("moon")}</button>
<a class="icon-button wish-link" href="/favoritos.html" aria-label="Favoritos">${icon("heart")}<span class="count" data-wishlist-count hidden>0</span></a>
<a class="icon-button notif-link" href="/minha-conta.html#notificacoes" aria-label="Notificações" hidden>${icon("bell")}<span class="count" data-notification-count hidden>0</span></a>
<a class="account-link" href="/login.html" id="account-link">${icon("user")}<span class="account-label">Entrar</span></a>
<a class="icon-button cart-link" href="/carrinho.html" data-open-cart aria-label="Carrinho">${icon("bag")}<span class="count" id="cart-count" data-cart-count hidden>0</span></a>
</nav></div></header>
<nav class="category-nav" aria-label="Categorias"><div class="container category-nav-inner"><a href="/catalogo.html">Todo o catálogo</a>${categories.map((c) => `<a href="${categoryLink(c)}">${c}</a>`).join("")}<a href="/setup.html" class="nav-setup">${icon("sparkle", { size: 16 })}Monte seu setup</a><a href="/kits.html" class="nav-kits">${icon("gift", { size: 16 })}Kits</a><a href="/ajuda.html" class="nav-help">Ajuda</a><a href="/admin.html" class="admin-link" hidden>Painel</a></div></nav>
<dialog class="menu-dialog" id="menu-dialog" aria-label="Menu"><div class="menu-panel"><div class="menu-head"><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span><button type="button" class="icon-button" data-close-dialog aria-label="Fechar menu">${icon("close")}</button></div><nav aria-label="Menu principal"><p class="menu-title">Categorias</p><a href="/catalogo.html">${icon("grid")}Todo o catálogo</a>${categories.map((c) => `<a href="${categoryLink(c)}">${icon("chevronRight", { size: 16 })}${c}</a>`).join("")}<a href="/setup.html">${icon("sparkle")}Monte seu setup</a><a href="/kits.html">${icon("gift")}Kits com desconto</a><a href="/comparar.html">${icon("compare")}Comparar produtos</a><p class="menu-title">Sua conta</p><a href="/minha-conta.html" class="menu-account">${icon("user")}Minha conta</a><a href="/favoritos.html">${icon("heart")}Favoritos</a><a href="/carrinho.html">${icon("bag")}Carrinho</a><p class="menu-title">Atendimento</p><a href="/ajuda.html">${icon("info")}Central de ajuda</a><a href="/admin.html" class="admin-link" hidden>${icon("grid")}Painel administrativo</a></nav>${themeSwitchHTML("theme-menu")}</div></dialog>
<dialog class="search-dialog" id="search-dialog" aria-label="Buscar"><form class="search-box" role="search" action="/catalogo.html"><label class="sr-only" for="dialog-q">Buscar equipamentos</label><span class="search-icon">${icon("search", { size: 18 })}</span><input id="dialog-q" name="q" type="search" placeholder="O que você procura?" autocomplete="off" maxlength="80" role="combobox" aria-expanded="false" aria-controls="dialog-suggestions" aria-autocomplete="list"><button type="button" class="icon-button" data-close-dialog aria-label="Fechar busca">${icon("close")}</button><div class="suggestions" id="dialog-suggestions" role="listbox" aria-label="Sugestões" hidden></div></form><div class="search-shortcuts"><p class="menu-title">Categorias</p><div class="chip-row">${categories.map((c) => `<a class="chip" href="${categoryLink(c)}">${c}</a>`).join("")}</div></div></dialog>`;
}
function footerHTML() {
  return `<footer class="footer"><div class="container footer-grid">
<div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${icon("bolt", { size: 20 })}</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a><p>Seu próximo som começa aqui. Guitarras, efeitos, amplificadores e acessórios para cada etapa da sua jornada.</p></div>
<nav aria-label="Loja"><h2>Loja</h2><a href="/catalogo.html">Todo o catálogo</a>${categories.slice(0, 3).map((c) => `<a href="${categoryLink(c)}">${c}</a>`).join("")}<a href="/kits.html">Kits com desconto</a><a href="/comparar.html">Comparar produtos</a></nav>
<nav aria-label="Sua conta"><h2>Sua conta</h2><a href="/minha-conta.html">Minha conta</a><a href="/minha-conta.html#pedidos">Meus pedidos</a><a href="/favoritos.html">Favoritos</a><a href="/carrinho.html">Carrinho</a></nav>
<nav aria-label="Atendimento"><h2>Atendimento</h2><a href="/ajuda.html">Central de ajuda</a><a href="/ajuda.html#entregas">Entregas e prazos</a><a href="/ajuda.html#pagamentos">Pagamentos e cupons</a><a href="/ajuda.html#trocas">Trocas e devoluções</a><a href="/privacidade.html">Privacidade</a><a href="/termos.html">Termos de uso</a></nav>
<div><h2>Formas de pagamento</h2><ul class="payment-list"><li>${icon("pix", { size: 18 })}Pix</li><li>${icon("card", { size: 18 })}Cartão de crédito</li><li>${icon("barcode", { size: 18 })}Boleto</li></ul></div>
</div><div class="container footer-bottom"><p>Projeto acadêmico · © ${new Date().getFullYear()} Violet Voltage</p>${themeSwitchHTML("theme-footer", { compact: true })}<p>Feito com Node.js, Express e PostgreSQL.</p></div></footer>`;
}
function bottomNavHTML() {
  const items = [
    ["/", "home", "Início"],
    ["/catalogo.html", "grid", "Catálogo"],
    ["/favoritos.html", "heart", "Favoritos", "data-wishlist-count"],
    ["/carrinho.html", "bag", "Carrinho", "data-cart-count"],
    ["/minha-conta.html", "user", "Conta", "data-notification-count"],
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
// Sessão compartilhada pelos módulos (avisos de estoque, visualização rápida etc.).
export let sessionReady = Promise.resolve(null);
export function setNotificationCount(count) {
  document.querySelectorAll("[data-notification-count]").forEach((el) => {
    el.textContent = count > 99 ? "99+" : count;
    el.hidden = !count;
  });
  const link = document.querySelector(".notif-link");
  if (link) link.setAttribute("aria-label", count ? `Notificações: ${count} não ${count === 1 ? "lida" : "lidas"}` : "Notificações");
}
export function shell() {
  sessionReady = loadShell();
  return sessionReady;
}
async function loadShell() {
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
    document.querySelector(".notif-link").hidden = false;
    setNotificationCount(user.naoLidas || 0);
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
