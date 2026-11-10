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
export async function api(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" };
  let response;
  try { response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    credentials: "same-origin",
  }); } catch {
    throw new Error("Não foi possível conectar. Verifique sua conexão e tente novamente.");
  }
  let result;
  try { result = await response.json(); } catch {
    const error = new Error("O serviço não respondeu como esperado. Tente novamente em instantes.");
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
    throw new Error("O serviço retornou dados incompletos. Tente novamente em instantes.");
  }
  return result.data;
}
export const send = (path, body, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export function getCart() {
  try {
    const data = JSON.parse(localStorage.getItem("vv_cart") || "[]");
    return Array.isArray(data)
      ? data.filter(
          (i) =>
            typeof i.id === "string" &&
            /^[a-zA-Z0-9-]{1,100}$/.test(i.id) &&
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
  updateBadge();
}
function updateBadge() {
  const el = document.querySelector("#cart-count");
  if (el) el.textContent = getCart().reduce((s, i) => s + i.quantidade, 0);
}
export function addCart(product, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    toast("Informe uma quantidade inteira entre 1 e 99.");
    return false;
  }
  const cart = getCart();
  const current = cart.find((i) => i.id === product.id);
  if ((current?.quantidade || 0) + quantity > Math.min(99, product.estoque)) {
    toast("Quantidade maior que o estoque disponível.");
    return false;
  }
  if (current) current.quantidade += quantity;
  else cart.push({ id: product.id, quantidade: quantity });
  try {
    setCart(cart);
  } catch {
    toast("Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador e tente novamente.");
    return false;
  }
  toast("Produto adicionado ao carrinho.");
  return true;
}
let timer;
export function toast(message) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), 4500);
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
    form
      .querySelectorAll("[aria-invalid]")
      .forEach((e) => {
        e.removeAttribute("aria-invalid");
        const references = (e.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && document.getElementById(id));
        if (references.length) e.setAttribute("aria-describedby", references.join(" "));
        else e.removeAttribute("aria-describedby");
      });
    const button = form.querySelector("[type=submit]");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Aguarde…";
    try {
      await handler(Object.fromEntries(new FormData(form)), form);
    } catch (e) {
      showError(form, e);
    } finally {
      delete form.dataset.busy;
      button.disabled = false;
      button.textContent = label;
    }
  });
}
export async function shell() {
  document.querySelector("#header").innerHTML =
    `<a class="skip" href="#main">Pular para o conteúdo</a><div class="announcement">VIOLET VOLTAGE · EQUIPAMENTO CERTO. SEU SOM, MAIS ALTO.</div><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Violet Voltage, início"><span class="brand-mark" aria-hidden="true">ϟ</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a><button class="menu-button" id="menu" aria-controls="navigation" aria-expanded="false">Menu ☰</button><nav class="nav" id="navigation" aria-label="Navegação principal"><a href="/#catalogo">Equipamentos</a><a href="/#essencia">Nossa essência</a><a href="/minha-conta.html" id="account-link">Minha conta</a><a href="/admin.html" id="admin-link" hidden>Administração</a><a href="/login.html" id="login-link">Entrar</a><a class="cart-link" href="/carrinho.html">Carrinho <span class="badge" id="cart-count">0</span></a></nav></div></header>`;
  document.querySelector("#footer").innerHTML =
    `<footer class="footer"><div class="container footer-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">ϟ</span><span class="brand-words">VIOLET VOLTAGE<small>TURN UP YOUR TONE</small></span></a><p>Seu próximo som começa aqui.<br>Guitarras, equipamentos e possibilidades.</p><p class="footer-note">Projeto acadêmico<br>© ${new Date().getFullYear()} Violet Voltage</p></div></footer>`;
  document.querySelector("#menu").onclick = () => {
    const nav = document.querySelector("#navigation");
    nav.classList.toggle("open");
    document
      .querySelector("#menu")
      .setAttribute("aria-expanded", nav.classList.contains("open"));
  };
  const menu = document.querySelector("#menu");
  const navigation = document.querySelector("#navigation");
  const closeMenu = () => {
    navigation.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  };
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && navigation.classList.contains("open")) {
      closeMenu();
      menu.focus();
    }
  });
  navigation.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".site-header")) closeMenu();
  });
  updateBadge();
  let user = null;
  try {
    user = await api("/auth/me");
    document.querySelector("#login-link").hidden = true;
    document.querySelector("#account-link").textContent =
      `Olá, ${user.nome.split(" ")[0]}`;
    document.querySelector("#admin-link").hidden = user.role !== "admin";
  } catch (e) {
    if (e.status !== 401) {
      user = undefined;
      toast("Não foi possível verificar sua sessão.");
    }
  }
  return user;
}
export function requireUser(user) {
  if (user === undefined) {
    const main = document.querySelector("#main");
    main.innerHTML = '<section class="panel container"><h1>Não foi possível verificar sua sessão</h1><p>Confira sua conexão e tente novamente. Seus dados não foram alterados.</p><button type="button" id="retry-session">Tentar novamente</button><a class="text-button" href="/">Voltar ao catálogo</a></section>';
    document.querySelector("#retry-session").onclick = () => location.reload();
    return false;
  }
  if (!user) {
    location.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
    return false;
  }
  return true;
}
export function ordersHTML(orders, admin = false) {
  if (!orders.length)
    return '<div class="empty">Nenhuma compra por aqui ainda.</div>';
  return [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (o) =>
        `<details class="order"><summary><strong>Pedido ${escapeHtml(o.id.slice(0, 8).toUpperCase())}</strong><span class="status">${escapeHtml(o.status)}</span> ${money(o.totalCents)}<br><span class="muted small">${new Date(o.createdAt).toLocaleString("pt-BR")} · Ver detalhes</span></summary><p class="small">Número completo: ${escapeHtml(o.id)}</p><ul>${o.itens.map((i) => `<li>${i.quantidade} × ${escapeHtml(i.nome)} — ${money(i.priceCents * i.quantidade)}</li>`).join("")}</ul><p class="small">Subtotal: ${money(o.subtotalCents)} · Frete: ${money(o.freteCents)}</p><p class="small">Pagamento: ${escapeHtml(o.pagamento)} · Entrega: ${escapeHtml(o.entrega)}</p><p class="small">Endereço: ${escapeHtml(o.endereco)}</p>${admin ? `<label for="status-${o.id}">Status do pedido</label><select class="order-status" id="status-${o.id}" data-order="${o.id}">${["Recebido", "Em preparação", "Enviado", "Concluído", "Cancelado"].map((s) => `<option${o.status === s ? " selected" : ""}>${s}</option>`).join("")}</select>` : ""}</details>`,
    )
    .join("");
}

