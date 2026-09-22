import {
  shell,
  api,
  send,
  money,
  escapeHtml as esc,
  addCart,
  getCart,
  setCart,
  toast,
  bindForm,
  showError,
  requireUser,
  ordersHTML,
} from "./common.js";
const user = await shell();
const page = location.pathname;
const categories = [
  "Guitarras",
  "Pedais",
  "Amplificadores",
  "Cabos",
  "Correias",
  "Acessórios",
];
const empty = (message) =>
  `<div class="empty"><h3>${message}</h3><a class="button secondary" href="/#catalogo">Explorar equipamentos</a></div>`;
async function catalog() {
  let category = "";
  const form = document.querySelector("#filters");
  const chips = document.querySelector("#categories");
  chips.innerHTML = ["Todos", ...categories]
    .map(
      (c, i) =>
        `<button type="button" class="chip${i === 0 ? " active" : ""}" data-category="${i === 0 ? "" : c}" aria-pressed="${i === 0}">${c}</button>`,
    )
    .join("");
  let sequence = 0;
  async function load() {
    const current = ++sequence;
    const params = new URLSearchParams();
    const data = Object.fromEntries(new FormData(form));
    for (const [k, v] of Object.entries(data))
      if (v)
        params.set(
          k,
          ["min", "max"].includes(k) ? Math.round(Number(v) * 100) : v,
        );
    if (category) params.set("categoria", category);
    const grid = document.querySelector("#products");
    grid.innerHTML = '<div class="loading">Buscando equipamentos…</div>';
    try {
      const products = await api(`/products?${params}`);
      if (current !== sequence) return;
      document.querySelector("#catalog-count").textContent =
        `${products.length} equipamento${products.length === 1 ? "" : "s"} encontrado${products.length === 1 ? "" : "s"}`;
      grid.innerHTML = products.length
        ? products
            .map(
              (p) =>
                `<article class="product-card"><a class="product-image" href="/produto.html?id=${p.id}"><span class="product-category">${esc(p.categoria)}</span><img src="${esc(p.imageUrl)}" alt="${esc(p.marca + " " + p.modelo)}" loading="lazy"></a><div class="product-content"><span class="product-brand">${esc(p.marca)}</span><h3><a href="/produto.html?id=${p.id}">${esc(p.modelo)}</a></h3><div class="price">${money(p.priceCents)}</div><small>${p.estoque > 0 ? "Disponível para seu próximo setup" : "Estoque esgotado"}</small><button data-add="${p.id}" ${p.estoque < 1 ? "disabled" : ""}>${p.estoque > 0 ? "+ Adicionar ao carrinho" : "Indisponível"}</button></div></article>`,
            )
            .join("")
        : empty("Nenhum equipamento encontrado.");
      grid
        .querySelectorAll("[data-add]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              addCart(products.find((p) => p.id === b.dataset.add))),
        );
    } catch (e) {
      grid.innerHTML = "";
      showError(grid, e);
    }
  }
  chips.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        chips.querySelectorAll("button").forEach((x) => {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-pressed", x === b);
        });
        load();
      }),
  );
  bindForm(form, load);
  document.querySelector("#clear-filters").onclick = () => {
    form.reset();
    category = "";
    chips.querySelector("button").click();
  };
  await load();
}
async function detail() {
  const container = document.querySelector("#product-detail");
  try {
    const p = await api(
      `/products/${encodeURIComponent(new URLSearchParams(location.search).get("id") || "")}`,
    );
    container.className = "detail-grid";
    container.innerHTML = `<img class="detail-image" src="${esc(p.imageUrl)}" alt="${esc(p.marca + " " + p.modelo)}"><section class="detail-info"><span class="eyebrow">${esc(p.categoria)} · ${esc(p.marca)}</span><h1>${esc(p.modelo)}</h1><p class="lead">${esc(p.descricao)}</p><span class="price">${money(p.priceCents)}</span><p class="small muted">Pagamento demonstrativo, sem cobrança real.</p><p class="stock">${p.estoque ? `${p.estoque} unidade(s) em estoque` : "Produto esgotado"}</p><form id="add-product"><div class="field quantity"><label for="quantidade">Quantidade</label><input id="quantidade" name="quantidade" type="number" value="1" min="1" max="${Math.min(99, p.estoque)}" required ${p.estoque ? "" : "disabled"}></div><button type="submit" ${p.estoque ? "" : "disabled"}>Adicionar ao carrinho</button></form></section>`;
    bindForm(document.querySelector("#add-product"), (data) =>
      addCart(p, Number(data.quantidade)),
    );
  } catch (e) {
    container.className = "";
    container.innerHTML = "";
    showError(container, e);
  }
}
async function cartData() {
  const cart = getCart();
  const products = await api("/products");
  return cart.map((item) => ({
    ...item,
    product: products.find((p) => p.id === item.id),
  }));
}
function subtotal(items) {
  return items.reduce(
    (sum, i) => sum + (i.product?.priceCents || 0) * i.quantidade,
    0,
  );
}
async function cartPage() {
  const container = document.querySelector("#cart-content");
  async function render() {
    const items = await cartData();
    container.className = "";
    if (!items.length) {
      container.innerHTML = empty(
        "Seu carrinho está esperando o primeiro acorde.",
      );
      return;
    }
    const invalid = items.some(
      (i) => !i.product || i.quantidade > i.product.estoque,
    );
    container.innerHTML = `<div class="cart-layout"><section class="panel">${items.map((i) => `<article class="cart-item"><img src="${esc(i.product?.imageUrl || "/assets/product.svg")}" alt="${esc(i.product?.modelo || "Produto indisponível")}"><div><h3>${esc(i.product ? `${i.product.marca} ${i.product.modelo}` : "Produto removido ou indisponível")}</h3>${!i.product || i.quantidade > i.product.estoque ? '<p class="field-error">Ajuste a quantidade ou remova este item.</p>' : ""}<span class="small muted">${money(i.product?.priceCents || 0)} por unidade</span><div class="cart-actions"><label for="qty-${i.id}" class="small">Qtd.</label><input id="qty-${i.id}" type="number" min="1" max="${Math.min(99, i.product?.estoque || 1)}" value="${i.quantidade}" data-qty="${i.id}" aria-label="Quantidade de ${esc(i.product?.modelo || "produto")}"><button class="text-button" data-remove="${i.id}">Remover</button></div></div><span class="price">${money((i.product?.priceCents || 0) * i.quantidade)}</span></article>`).join("")}</section><aside class="panel"><h2>Resumo do setup</h2><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal(items))}</strong></div><p class="small muted">Entrega calculada no checkout. Preços e estoque serão conferidos novamente.</p><a class="button full" href="/checkout.html" ${invalid ? 'aria-disabled="true" tabindex="-1"' : ""}>Continuar para checkout</a><p class="form-help">Pagamento exclusivamente demonstrativo.</p></aside></div>`;
    const checkout = container.querySelector("[aria-disabled]");
    if (checkout)
      checkout.onclick = (e) => {
        e.preventDefault();
        toast("Ajuste os itens indisponíveis primeiro.");
      };
    container.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          setCart(getCart().filter((i) => i.id !== b.dataset.remove));
          render().catch((e) => showError(container, e));
        }),
    );
    container.querySelectorAll("[data-qty]").forEach(
      (input) =>
        (input.onchange = () => {
          const qty = Number(input.value);
          if (!Number.isInteger(qty) || qty < 1 || qty > Number(input.max)) {
            toast("Quantidade inválida para o estoque disponível.");
            render().catch((e) => showError(container, e));
            return;
          }
          const items = getCart();
          items.find((i) => i.id === input.dataset.qty).quantidade = qty;
          setCart(items);
          render().catch((e) => showError(container, e));
        }),
    );
  }
  await render();
}
async function checkout() {
  if (!requireUser(user)) return;
  const items = await cartData();
  if (!items.length) {
    document.querySelector("#checkout-content").innerHTML = empty(
      "Seu carrinho está vazio.",
    );
    return;
  }
  if (items.some((i) => !i.product || i.quantidade > i.product.estoque)) {
    document.querySelector("#checkout-content").innerHTML =
      '<div class="error">Existem itens indisponíveis. <a href="/carrinho.html">Revise o carrinho</a> antes de continuar.</div>';
    return;
  }
  const form = document.querySelector("#checkout-form");
  form.elements.endereco.value = user.endereco || "";
  const summary = document.querySelector("#checkout-summary");
  function refresh() {
    const freight = { padrao: 2500, expressa: 4500, retirada: 0 }[
      form.elements.entrega.value
    ];
    summary.innerHTML = `<h2>Seu pedido</h2>${items.map((i) => `<div class="summary-line"><span>${i.quantidade} × ${esc(i.product.modelo)}</span><strong>${money(i.product.priceCents * i.quantidade)}</strong></div>`).join("")}<div class="summary-line"><span>Frete</span><strong>${money(freight)}</strong></div><div class="summary-line summary-total"><span>Total</span><span>${money(subtotal(items) + freight)}</span></div>`;
  }
  form.elements.entrega.onchange = () => {
    if (
      form.elements.entrega.value === "retirada" &&
      !form.elements.endereco.value
    )
      form.elements.endereco.value = "Retirada na loja (demonstração)";
    refresh();
  };
  refresh();
  const requestId = crypto.randomUUID();
  bindForm(form, async (data) => {
    const order = await send("/orders", {
      ...data,
      requestId,
      items: getCart(),
    });
    setCart([]);
    document.querySelector("#checkout-content").innerHTML =
      `<div class="panel narrow confirmation" role="status"><div class="success-icon" aria-hidden="true">✓</div><h2>Seu som está a caminho!</h2><p class="lead">Pedido demonstrativo confirmado. Nenhum valor foi cobrado.</p><p class="small">Número do pedido</p><p class="order-number">${esc(order.id)}</p><p class="price">${money(order.totalCents)}</p><a href="/minha-conta.html" class="button">Acompanhar minhas compras</a></div>`;
  });
}
function authentication() {
  const login = document.querySelector("#login-form");
  if (login)
    bindForm(login, async (data) => {
      await send("/auth/login", data);
      const next = new URLSearchParams(location.search).get("next");
      location.href = [
        "/checkout.html",
        "/minha-conta.html",
        "/admin.html",
      ].includes(next)
        ? next
        : "/minha-conta.html";
    });
  const register = document.querySelector("#register-form");
  if (register)
    bindForm(register, async (data) => {
      await send("/auth/register", data);
      location.href = "/minha-conta.html";
    });
}
async function account() {
  if (!requireUser(user)) return;
  const form = document.querySelector("#profile-form");
  for (const key of ["nome", "email", "telefone", "endereco"])
    form.elements[key].value = user[key] || "";
  bindForm(form, async (data) => {
    await send("/profile", data, "PATCH");
    toast("Dados atualizados.");
  });
  document.querySelector("#logout").onclick = async () => {
    try {
      await send("/auth/logout", {});
      location.href = "/";
    } catch (e) {
      toast(e.message);
    }
  };
  document.querySelector("#orders").innerHTML = ordersHTML(
    await api("/orders"),
  );
}
try {
  if (page === "/" || page === "/index.html") await catalog();
  else if (page === "/produto.html") await detail();
  else if (page === "/carrinho.html") await cartPage();
  else if (page === "/checkout.html") await checkout();
  else if (page === "/minha-conta.html") await account();
  else if (page === "/admin.html") {
    const { adminPage } = await import("./admin.js");
    await adminPage(user);
  } else authentication();
} catch (e) {
  showError(document.querySelector("#main"), e);
}
