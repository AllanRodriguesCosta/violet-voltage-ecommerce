import {
  shell,
  api,
  send,
  money,
  productImage,
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
  const initial = new URLSearchParams(location.search);
  let category = categories.includes(initial.get("categoria")) ? initial.get("categoria") : "";
  const form = document.querySelector("#filters");
  const filterToggle = document.querySelector("#filters-toggle");
  const compactFilters = matchMedia("(max-width: 700px)");
  function setFilters(open) {
    form.hidden = !open;
    filterToggle.setAttribute("aria-expanded", String(open));
    filterToggle.textContent = open ? "Ocultar filtros" : "Mostrar filtros";
  }
  function syncFilters() {
    if (form.contains(document.activeElement) && compactFilters.matches) filterToggle.focus();
    filterToggle.hidden = !compactFilters.matches;
    setFilters(!compactFilters.matches);
  }
  filterToggle.addEventListener("click", () => setFilters(form.hidden));
  compactFilters.addEventListener("change", syncFilters);
  syncFilters();
  const sort = document.querySelector("#catalog-sort");
  if ([...sort.options].some(option => option.value === initial.get("sort"))) sort.value = initial.get("sort");
  for (const key of ["q", "marca", "modelo", "min", "max"]) {
    if (initial.has(key)) form.elements.namedItem(key).value = initial.get(key);
  }
  const chips = document.querySelector("#categories");
  const applied = document.createElement("div");
  applied.className = "applied-filters";
  applied.setAttribute("aria-label", "Filtros aplicados");
  chips.after(applied);
  chips.innerHTML = ["Todos", ...categories]
    .map(
      (c, i) =>
        `<button type="button" class="chip${i === 0 ? " active" : ""}" data-category="${i === 0 ? "" : c}" aria-pressed="${i === 0}">${c}</button>`,
    )
    .join("");
  let sequence = 0;
  async function load() {
    const minimum = form.elements.namedItem("min");
    const maximum = form.elements.namedItem("max");
    maximum.setCustomValidity("");
    if (minimum.value && maximum.value && Number(minimum.value) > Number(maximum.value)) {
      maximum.setCustomValidity("O preço máximo deve ser maior ou igual ao mínimo.");
      setFilters(true);
      form.reportValidity();
      return;
    }
    const current = ++sequence;
    const params = new URLSearchParams();
    const data = Object.fromEntries(new FormData(form));
    const address = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) if (value) address.set(key, value);
    if (category) address.set("categoria", category);
    if (sort.value !== "default") address.set("sort", sort.value);
    applied.replaceChildren();
    const labels = { q: "Busca", marca: "Marca", modelo: "Modelo", min: "Mínimo R$", max: "Máximo R$", categoria: "Categoria" };
    for (const [key, value] of address) {
      if (!labels[key]) continue;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip";
      remove.textContent = `${labels[key]}: ${value} ×`;
      remove.setAttribute("aria-label", `Remover filtro ${labels[key]}: ${value}`);
      remove.onclick = () => {
        if (key === "categoria") category = "";
        else form.elements.namedItem(key).value = "";
        load();
        document.querySelector("#catalog-sort").focus();
      };
      applied.append(remove);
    }
    history.replaceState(null, "", `${location.pathname}${address.size ? "?" + address : ""}${location.hash}`);
    chips.querySelectorAll("button").forEach(button => {
      const active = button.dataset.category === category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active);
    });
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
      if (sort.value === "price-asc") products.sort((a, b) => a.priceCents - b.priceCents);
      if (sort.value === "price-desc") products.sort((a, b) => b.priceCents - a.priceCents);
      if (sort.value === "name") products.sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, "pt-BR"));
      document.querySelector("#catalog-count").textContent =
        `${products.length} equipamento${products.length === 1 ? "" : "s"} encontrado${products.length === 1 ? "" : "s"}`;
      grid.innerHTML = products.length
        ? products
            .map(
              (p) =>
                `<article class="product-card"><a class="product-image" href="/produto.html?id=${p.id}"><span class="product-category">${esc(p.categoria)}</span><img src="${esc(productImage(p))}" alt="${esc(p.marca + " " + p.modelo)}" loading="lazy"></a><div class="product-content"><span class="product-brand">${esc(p.marca)}</span><h3><a href="/produto.html?id=${p.id}">${esc(p.modelo)}</a></h3><div class="price">${money(p.priceCents)}</div><small>${p.estoque > 0 ? "Disponível para seu próximo setup" : "Estoque esgotado"}</small><button data-add="${p.id}" ${p.estoque < 1 ? "disabled" : ""}>${p.estoque > 0 ? "+ Adicionar ao carrinho" : "Indisponível"}</button></div></article>`,
            )
            .join("")
        : '<div class="empty"><h3>Nenhum equipamento encontrado.</h3><p>Experimente remover um filtro ou explorar o catálogo completo.</p><button type="button" id="reset-empty">Limpar filtros</button></div>';
      grid.querySelector("#reset-empty")?.addEventListener("click", () => document.querySelector("#clear-filters").click());
      grid
        .querySelectorAll("[data-add]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              addCart(products.find((p) => p.id === b.dataset.add))),
        );
    } catch (e) {
      if (current !== sequence) return;
      document.querySelector("#catalog-count").textContent = "Não foi possível carregar os equipamentos.";
      grid.innerHTML = "";
      showError(grid, e);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Tentar novamente";
      retry.onclick = load;
      grid.append(retry);
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
  form.addEventListener("input", () => form.elements.namedItem("max").setCustomValidity(""));
  sort.addEventListener("change", load);
  document.querySelector("#clear-filters").onclick = () => {
    form.reset();
    sort.value = "default";
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
    document.title = `${p.marca} ${p.modelo} | Violet Voltage`;
    container.innerHTML = `<img class="detail-image" src="${esc(productImage(p))}" alt="${esc(p.marca + " " + p.modelo)}"><section class="detail-info"><span class="eyebrow">${esc(p.categoria)} · ${esc(p.marca)}</span><h1>${esc(p.modelo)}</h1><p class="lead">${esc(p.descricao)}</p><span class="price">${money(p.priceCents)}</span><p class="stock">${p.estoque ? `${p.estoque} unidade(s) em estoque` : "Produto esgotado"}</p><form id="add-product"><div class="field quantity"><label for="quantidade">Quantidade</label><input id="quantidade" name="quantidade" type="number" value="1" min="1" max="${Math.min(99, p.estoque)}" required ${p.estoque ? "" : "disabled"}></div><button type="submit" ${p.estoque ? "" : "disabled"}>Adicionar ao carrinho</button></form></section>`;
    const specs = document.createElement("section");
    specs.className = "product-specs";
    specs.innerHTML = `<h2>Sobre este equipamento</h2><dl><div><dt>Marca</dt><dd>${esc(p.marca)}</dd></div><div><dt>Modelo</dt><dd>${esc(p.modelo)}</dd></div><div><dt>Categoria</dt><dd>${esc(p.categoria)}</dd></div></dl><a class="text-button" href="/?categoria=${encodeURIComponent(p.categoria)}#catalogo">Explorar ${esc(p.categoria)} →</a>`;
    container.querySelector(".detail-info").append(specs);
    const feedback = document.createElement("p");
    feedback.setAttribute("role", "status");
    feedback.className = "cart-feedback";
    container.querySelector("#add-product").after(feedback);
    bindForm(document.querySelector("#add-product"), (data) => {
      if (addCart(p, Number(data.quantidade))) {
        feedback.innerHTML = 'Equipamento adicionado. <a href="/carrinho.html">Ver meu carrinho →</a>';
      } else feedback.textContent = "Não foi possível adicionar. Confira a quantidade e a mensagem exibida.";
    });
  } catch (e) {
    container.className = "";
    container.innerHTML = "";
    showError(container, e);
    const back = document.createElement("a");
    back.href = "/#catalogo";
    back.className = "button secondary";
    back.textContent = "Voltar aos equipamentos";
    container.append(back);
    if (e.status !== 404) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Tentar novamente";
      retry.onclick = detail;
      container.append(retry);
    }
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
  function retryCart(error) {
    container.className = "";
    container.replaceChildren();
    showError(container, error);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Carregar carrinho novamente";
    retry.onclick = () => render().catch(retryCart);
    container.append(retry);
  }
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
    container.innerHTML = `<div class="cart-layout"><section class="panel">${items.map((i) => `<article class="cart-item"><img src="${esc(productImage(i.product))}" alt="${esc(i.product?.modelo || "Produto indisponível")}"><div><h3>${esc(i.product ? `${i.product.marca} ${i.product.modelo}` : "Produto removido ou indisponível")}</h3>${!i.product || i.quantidade > i.product.estoque ? '<p class="field-error">Ajuste a quantidade ou remova este item.</p>' : ""}<span class="small muted">${money(i.product?.priceCents || 0)} por unidade</span><div class="cart-actions"><label for="qty-${i.id}" class="small">Qtd.</label><input id="qty-${i.id}" type="number" min="1" max="${Math.min(99, i.product?.estoque || 1)}" value="${i.quantidade}" data-qty="${i.id}" aria-label="Quantidade de ${esc(i.product?.modelo || "produto")}"><button class="text-button" data-remove="${i.id}">Remover</button></div></div><span class="price">${money((i.product?.priceCents || 0) * i.quantidade)}</span></article>`).join("")}</section><aside class="panel"><h2>Resumo do setup</h2><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal(items))}</strong></div><p class="small muted">Entrega calculada no checkout. Preços e estoque serão conferidos novamente.</p><a class="button full" href="/checkout.html" ${invalid ? 'aria-disabled="true" tabindex="-1"' : ""}>Continuar para checkout</a></aside></div>`;
    const checkout = container.querySelector("[aria-disabled]");
    if (checkout)
      checkout.onclick = (e) => {
        e.preventDefault();
        toast("Ajuste os itens indisponíveis primeiro.");
      };
    container.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          try {
            setCart(getCart().filter((i) => i.id !== b.dataset.remove));
            render().catch(retryCart);
          } catch {
            toast("Não foi possível remover o item. Verifique as permissões de armazenamento do navegador.");
          }
        }),
    );
    container.querySelectorAll("[data-qty]").forEach(
      (input) =>
        (input.onchange = () => {
          const qty = Number(input.value);
          if (!Number.isInteger(qty) || qty < 1 || qty > Number(input.max)) {
            toast("Quantidade inválida para o estoque disponível.");
            render().catch(retryCart);
            return;
          }
          const items = getCart();
          const item = items.find((i) => i.id === input.dataset.qty);
          if (!item) { render().catch(retryCart); return; }
          const previous = item.quantidade;
          item.quantidade = qty;
          try {
            setCart(items);
            render().catch(retryCart);
          } catch {
            input.value = previous;
            toast("Não foi possível salvar a quantidade. Tente novamente após permitir o armazenamento local.");
          }
        }),
    );
  }
  await render().catch(retryCart);
}
async function checkout() {
  if (!requireUser(user)) return;
  const form = document.querySelector("#checkout-form");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  let items;
  try { items = await cartData(); } catch (error) {
    const summary = document.querySelector("#checkout-summary");
    summary.replaceChildren();
    showError(summary, error);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Carregar pedido novamente";
    retry.onclick = () => { retry.disabled = true; checkout(); };
    summary.append(retry);
    return;
  }
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
  if (!form.elements.endereco.value) form.elements.endereco.value = user.endereco || "";
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
      form.elements.endereco.value = "Retirada na loja";
    refresh();
  };
  refresh();
  submit.disabled = false;
  submit.textContent = "Confirmar pedido";
  const requestId = crypto.randomUUID();
  bindForm(form, async (data) => {
    const order = await send("/orders", {
      ...data,
      requestId,
      items: getCart(),
    });
    let cartCleared = true;
    try { setCart([]); } catch { cartCleared = false; }
    document.querySelector("#checkout-content").innerHTML =
      `<div class="panel narrow confirmation" role="status" tabindex="-1"><div class="success-icon" aria-hidden="true">✓</div><h2>Seu pedido foi registrado.</h2><p class="lead">Os detalhes já estão disponíveis no seu histórico.</p><p class="small">Número do pedido</p><p class="order-number">${esc(order.id)}</p><p class="price">${money(order.totalCents)}</p>${cartCleared ? "" : '<p class="error">O pedido foi registrado, mas o navegador não conseguiu limpar o carrinho. Não repita a compra; confira seu histórico.</p>'}<a href="/minha-conta.html" class="button">Ver meu histórico</a><a href="/#catalogo" class="text-button">Continuar explorando</a></div>`;
    document.querySelector(".confirmation").focus();
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
  const orders = document.querySelector("#orders");
  async function loadOrders() {
    orders.setAttribute("aria-busy", "true");
    orders.innerHTML = '<div class="loading" role="status">Carregando compras…</div>';
    try { orders.innerHTML = ordersHTML(await api("/orders")); }
    catch (error) {
      orders.replaceChildren();
      showError(orders, error);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Carregar histórico novamente";
      retry.onclick = loadOrders;
      orders.append(retry);
    } finally { orders.setAttribute("aria-busy", "false"); }
  }
  await loadOrders();
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
