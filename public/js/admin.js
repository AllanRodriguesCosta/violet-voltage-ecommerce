import { icon } from "./icons.js";
import { api, send, money, productImage, escapeHtml as esc, bindForm, toast, requireUser, normalize, categories } from "./common.js";
import { orderCardHTML, statuses, statusClass } from "./orders.js";
import { confirmDialog, emptyState, errorState, loadingHTML } from "./components.js";
import { specFields } from "./specs.js";

const field = (key, label, value = "", type = "text", attributes = "") =>
  `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${esc(value)}" ${attributes}></div>`;
// Ficha técnica no painel: campos gerados pelo esquema da categoria escolhida.
function specsEditor(categoria, ficha = {}) {
  const fields = specFields(categoria);
  return `<fieldset class="admin-specs"><legend>Ficha técnica (opcional)</legend><p class="form-help">Usada nos filtros do catálogo e na página do produto.</p><div class="form-grid">${fields
    .map((f) => {
      const id = `spec-${f.key}`;
      const value = ficha?.[f.key];
      if (f.type === "multi")
        return `<fieldset class="field span-two"><legend>${esc(f.label)}</legend><div class="facet-list">${f.values.map((v) => `<label class="facet"><input type="checkbox" name="ficha.${f.key}" value="${esc(v)}"${value?.includes(v) ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div></fieldset>`;
      if (f.type === "enum")
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="ficha.${f.key}"><option value="">Não informado</option>${f.values.map((v) => `<option${v === value ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></div>`;
      if (f.type === "number")
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="ficha.${f.key}" type="number" min="${f.min}" max="${f.max}" step="any" value="${esc(value ?? "")}"></div>`;
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="ficha.${f.key}" type="text" maxlength="${f.maxLength}" value="${esc(value ?? "")}"></div>`;
    })
    .join("")}</div></fieldset>`;
}
function readSpecs(form, categoria) {
  const ficha = {};
  for (const f of specFields(categoria)) {
    const inputs = [...form.querySelectorAll(`[name="ficha.${f.key}"]`)];
    if (f.type === "multi") ficha[f.key] = inputs.filter((i) => i.checked).map((i) => i.value);
    else if (inputs[0]?.value !== "") ficha[f.key] = f.type === "number" ? Number(inputs[0].value) : inputs[0].value;
  }
  return ficha;
}
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
function chart(days) {
  const width = 560;
  const height = 190;
  const gap = 6;
  const bar = (width - gap * (days.length - 1)) / days.length;
  const max = Math.max(...days.map((d) => d.totalCents), 1);
  const total = days.reduce((s, d) => s + d.totalCents, 0);
  const count = days.reduce((s, d) => s + d.pedidos, 0);
  const bars = days
    .map((d, i) => {
      const h = d.totalCents ? Math.max(6, Math.round((d.totalCents / max) * (height - 34))) : 3;
      const x = i * (bar + gap);
      const label = shortDate.format(new Date(`${d.dia}T00:00:00Z`));
      return `<g><rect x="${x.toFixed(1)}" y="${height - 22 - h}" width="${bar.toFixed(1)}" height="${h}" rx="5" class="${d.totalCents ? "bar" : "bar empty"}"><title>${label}: ${money(d.totalCents)} em ${d.pedidos} ${d.pedidos === 1 ? "pedido" : "pedidos"}</title></rect>${i % 2 === 1 ? `<text x="${(x + bar / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${label}</text>` : ""}</g>`;
    })
    .join("");
  return `<svg class="sales-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Vendas dos últimos 14 dias: ${money(total)} em ${count} pedidos">${bars}</svg><p class="small muted">No período: <strong>${money(total)}</strong> em ${count} ${count === 1 ? "pedido" : "pedidos"}, sem cancelados.</p>`;
}
export async function adminPage(user) {
  if (!requireUser(user)) return;
  if (user.role !== "admin") {
    document.querySelector("#admin-content").innerHTML = emptyState({ symbol: "shield", title: "Acesso restrito", text: "Esta área está disponível apenas para administradores.", actions: '<a class="button" href="/">Voltar à loja</a>' });
    return;
  }
  let tab = "products";
  let items = [];
  let customers = [];
  let orderFilter = "todos";
  let query = "";
  const panel = document.querySelector("#admin-panel");
  async function stats() {
    const s = await api("/admin/summary");
    const totalStatus = Math.max(1, s.pedidos);
    document.querySelector("#stats").innerHTML = `<div class="kpis">${[
      ["card", "Volume de vendas", money(s.totalCents)],
      ["package", "Pedidos", s.pedidos],
      ["tag", "Ticket médio", money(s.ticketMedioCents)],
      ["user", "Clientes ativos", s.clientes],
      ["grid", "Produtos ativos", s.produtos],
      ["question", "Perguntas aguardando", s.perguntasPendentes || 0],
    ]
      .map(([symbol, label, value]) => `<div class="stat">${icon(symbol, { size: 20 })}<span>${label}</span><strong>${value}</strong></div>`)
      .join("")}</div><div class="dash-grid"><section class="panel chart-panel"><h2>Vendas nos últimos 14 dias</h2>${chart(s.vendasPorDia)}</section><section class="panel"><h2>Pedidos por status</h2><ul class="status-bars">${statuses
      .map((st) => `<li><span class="status status-${statusClass(st)}">${st}</span><span class="status-track"><span style="width:${Math.round((s.porStatus[st] / totalStatus) * 100)}%"></span></span><strong>${s.porStatus[st]}</strong></li>`)
      .join("")}</ul></section><section class="panel"><h2>Estoque baixo</h2>${s.estoqueBaixo.length ? `<ul class="low-stock">${s.estoqueBaixo.map((p) => { const wanted = (s.procura || []).find((x) => x.id === p.id)?.avisos || 0; return `<li><a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a>${wanted ? `<span class="badge badge-demand">${icon("bell", { size: 14 })}${wanted} ${wanted === 1 ? "aviso" : "avisos"}</span>` : ""}<span class="badge ${p.estoque ? "badge-low" : "badge-out"}">${p.estoque ? `${p.estoque} un.` : "Esgotado"}</span></li>`; }).join("")}</ul>${s.procura?.length ? `<p class="small muted">Avisos: clientes esperando a reposição. Repor o estoque notifica todos de uma vez.</p>` : ""}` : '<p class="muted">Nenhum produto com 5 unidades ou menos.</p>'}</section></div>`;
  }
  function toolbar(title, button) {
    return `<div class="admin-toolbar"><h2>${title}</h2><div class="row"><div class="admin-search">${icon("search", { size: 18 })}<label class="sr-only" for="admin-search">Buscar</label><input id="admin-search" type="search" placeholder="Buscar" value="${esc(query)}" autocomplete="off"></div>${button}</div></div>`;
  }
  function wireSearch(apply) {
    const input = panel.querySelector("#admin-search");
    input.addEventListener("input", () => {
      query = input.value;
      apply();
    });
    apply();
  }
  function filterRows() {
    const q = normalize(query);
    let shown = 0;
    panel.querySelectorAll("tbody tr").forEach((row) => {
      const match = !q || row.dataset.search.includes(q);
      row.hidden = !match;
      if (match) shown++;
    });
    const empty = panel.querySelector("#no-results");
    if (empty) empty.hidden = shown > 0;
  }
  function renderOrders() {
    const names = new Map(customers.map((c) => [c.id, c.nome]));
    const q = normalize(query);
    const list = items
      .filter((o) => orderFilter === "todos" || o.status === orderFilter)
      .filter((o) => !q || normalize(`${o.id} ${names.get(o.partitionKey) || ""}`).includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    panel.querySelector("#order-chips").innerHTML = ["todos", ...statuses]
      .map((st) => `<button type="button" class="chip" data-filter="${st}" aria-pressed="${orderFilter === st}">${st === "todos" ? "Todos" : st} <span class="chip-count">${st === "todos" ? items.length : items.filter((o) => o.status === st).length}</span></button>`)
      .join("");
    panel.querySelector("#order-list").innerHTML = list.length
      ? list.map((o) => orderCardHTML(o, { admin: true, customer: names.get(o.partitionKey) || "Cliente" })).join("")
      : emptyState({ symbol: "package", title: "Nenhum pedido encontrado.", level: 3 });
  }
  // Perguntas dos clientes: pendentes primeiro; responder notifica quem perguntou.
  function renderQuestions() {
    const q = normalize(query);
    const list = items.filter((x) => !q || normalize(`${x.produto} ${x.pergunta} ${x.autor}`).includes(q));
    const label = { pendente: "Aguardando resposta", respondida: "Respondida", oculta: "Oculta" };
    panel.querySelector("#question-list").innerHTML = list.length
      ? list
          .map(
            (x) => `<article class="panel question-admin" data-question="${esc(x.id)}"><header><span class="badge ${x.status === "pendente" ? "badge-low" : x.status === "oculta" ? "badge-out" : "badge-in"}">${label[x.status]}</span><a href="/produto.html?id=${encodeURIComponent(x.productId)}#perguntas">${esc(x.produto)}</a><small class="muted">${esc(x.autor)} · ${new Date(x.createdAt).toLocaleDateString("pt-BR")}</small></header><p class="question-text">${esc(x.pergunta)}</p>${
              x.status === "oculta"
                ? ""
                : `<form class="question-form" data-answer="${esc(x.id)}"><label for="answer-${esc(x.id)}">${x.resposta ? "Editar resposta" : "Resposta da loja"}</label><textarea id="answer-${esc(x.id)}" name="resposta" rows="3" minlength="2" maxlength="1000" required>${esc(x.resposta || "")}</textarea><div class="row"><button type="submit">${x.resposta ? "Salvar resposta" : "Responder"}</button>${x.status === "pendente" ? `<button type="button" class="text-button danger-text" data-hide="${esc(x.id)}">Ocultar pergunta</button>` : ""}</div></form>`
            }</article>`,
          )
          .join("")
      : emptyState({ symbol: "question", title: query ? "Nenhuma pergunta encontrada." : "Nenhuma pergunta ainda.", level: 3 });
  }
  async function load() {
    panel.innerHTML = loadingHTML();
    if (tab === "questions") {
      items = await api("/admin/questions");
      const pending = items.filter((x) => x.status === "pendente").length;
      panel.innerHTML = `${toolbar(`Perguntas ${pending ? `<span class="chip-count">${pending} aguardando</span>` : ""}`, "")}<p class="form-help">Só as perguntas respondidas aparecem na página do produto. Quem perguntou recebe a resposta nas notificações.</p><div class="question-list" id="question-list"></div>`;
      const list = panel.querySelector("#question-list");
      list.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target.closest("[data-answer]");
        const resposta = form.elements.resposta.value.trim();
        if (resposta.length < 2) return toast("Escreva a resposta antes de enviar.", { type: "error" });
        form.querySelector("[type=submit]").disabled = true;
        try {
          const updated = await send(`/admin/questions/${form.dataset.answer}`, { resposta }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          toast("Resposta publicada na página do produto.", { type: "success" });
          renderQuestions();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
          form.querySelector("[type=submit]").disabled = false;
        }
      });
      list.addEventListener("click", async (event) => {
        const hide = event.target.closest("[data-hide]");
        if (!hide || !(await confirmDialog({ title: "Ocultar esta pergunta?", text: "Ela não será publicada nem respondida.", confirm: "Ocultar", cancel: "Voltar", danger: true }))) return;
        try {
          const updated = await send(`/admin/questions/${hide.dataset.hide}`, { ocultar: true }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          renderQuestions();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
        }
      });
      wireSearch(renderQuestions);
      return;
    }
    if (tab === "orders") {
      [items, customers] = await Promise.all([api("/admin/orders"), api("/admin/customers")]);
      panel.innerHTML = `${toolbar("Pedidos", "")}<p class="form-help">Status avançam no fluxo; o cancelamento, permitido até a preparação, devolve os itens ao estoque.</p><div class="chip-row" id="order-chips"></div><div class="order-list" id="order-list"></div>`;
      panel.querySelector("#order-chips").addEventListener("click", (event) => {
        const chip = event.target.closest("[data-filter]");
        if (!chip) return;
        orderFilter = chip.dataset.filter;
        renderOrders();
      });
      panel.querySelector("#order-list").addEventListener("change", async (event) => {
        const select = event.target.closest("[data-status-select]");
        if (!select?.value) return;
        const id = select.closest("[data-order-id]").dataset.orderId;
        const status = select.value;
        if (status === "Cancelado" && !(await confirmDialog({ title: "Cancelar este pedido?", text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.", confirm: "Cancelar pedido", cancel: "Manter", danger: true }))) {
          select.value = "";
          return;
        }
        select.disabled = true;
        try {
          const updated = await send(`/admin/orders/${id}`, { status }, "PATCH");
          items = items.map((o) => (o.id === updated.id ? updated : o));
          renderOrders();
          toast(status === "Cancelado" ? "Pedido cancelado; itens devolvidos ao estoque." : `Status alterado para ${status}.`, { type: "success" });
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
          await load();
        }
      });
      wireSearch(renderOrders);
      return;
    }
    items = await api(tab === "products" ? "/products" : `/admin/${tab}`);
    const product = tab === "products";
    panel.innerHTML = `${toolbar(product ? "Equipamentos" : "Clientes", `<button id="new-record">${icon("plus", { size: 18 })}${product ? "Cadastrar produto" : "Cadastrar cliente"}</button>`)}<div id="editor"></div>${
      items.length
        ? `<div class="table-wrap"><table><thead><tr><th>${product ? "Produto" : "Cliente"}</th><th>${product ? "Preço" : "Contato"}</th><th>${product ? "Estoque" : "Papel"}</th><th>Ações</th></tr></thead><tbody>${items
            .map(
              (i) =>
                `<tr data-search="${esc(normalize(product ? `${i.marca} ${i.modelo} ${i.categoria}` : `${i.nome} ${i.email}`))}"><td>${product ? `<div class="admin-product"><img src="${esc(productImage(i))}" alt="" loading="lazy"><div><strong>${esc(i.modelo)}</strong><small>${esc(i.marca)} · ${esc(i.categoria)}</small></div></div>` : `<strong>${esc(i.nome)}</strong><small>${esc(i.email)}</small>`}</td><td>${product ? money(i.priceCents) : esc(i.telefone || "—")}</td><td>${product ? `<span class="badge ${i.estoque === 0 ? "badge-out" : i.estoque <= 5 ? "badge-low" : ""}">${i.estoque} un.</span>` : esc(i.role === "admin" ? "Administrador" : "Cliente")}</td><td class="actions"><button class="secondary" data-edit="${i.id}">Editar</button>${product ? `<button class="secondary" data-image="${i.id}">Imagem</button>` : `<button class="secondary" data-history="${i.id}">Compras</button>`}${i.role === "admin" ? "" : `<button class="danger" data-delete="${i.id}">Excluir</button>`}</td></tr>`,
            )
            .join("")}</tbody></table><div id="no-results" hidden>${emptyState({ symbol: "search", title: "Nada encontrado com essa busca.", level: 3 })}</div></div>`
        : emptyState({ symbol: "grid", title: "Nenhum registro cadastrado.", level: 3 })
    }`;
    panel.querySelector("#new-record").onclick = () => edit();
    panel.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(items.find((i) => i.id === b.dataset.edit))));
    panel.querySelectorAll("[data-image]").forEach((b) => (b.onclick = () => imageEditor(items.find((i) => i.id === b.dataset.image))));
    panel.querySelectorAll("[data-history]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            const orders = (await api("/admin/orders")).filter((o) => o.partitionKey === b.dataset.history);
            const editor = document.querySelector("#editor");
            editor.innerHTML = `<section class="admin-form"><h3>Compras de ${esc(items.find((i) => i.id === b.dataset.history).nome)}</h3>${orders.length ? orders.map((o) => orderCardHTML(o, { readonly: true })).join("") : '<p class="muted">Nenhuma compra registrada.</p>'}</section>`;
            editor.scrollIntoView({ block: "start" });
          } catch (e) {
            toast(e.message, { type: "error" });
          }
        }),
    );
    panel.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!(await confirmDialog({ title: "Excluir este registro?", text: "A exclusão é lógica: o histórico de pedidos é preservado.", confirm: "Excluir", danger: true }))) return;
          b.disabled = true;
          try {
            await api(`/admin/${tab}/${b.dataset.delete}`, { method: "DELETE" });
            toast("Registro excluído.", { type: "success" });
            await load();
            await stats();
          } catch (e) {
            toast(e.message, { type: "error" });
            b.disabled = false;
          }
        }),
    );
    wireSearch(filterRows);
  }
  function edit(item = {}) {
    const editor = document.querySelector("#editor");
    const product = tab === "products";
    editor.innerHTML = `<form class="admin-form" id="record-form"><h3>${item.id ? "Editar" : "Cadastrar"} ${product ? "produto" : "cliente"}</h3><div class="form-grid">${product ? `${field("marca", "Marca", item.marca, "text", 'required maxlength="200"')}${field("modelo", "Modelo", item.modelo, "text", 'required maxlength="200"')}<div class="field"><label for="edit-categoria">Categoria</label><select id="edit-categoria" name="categoria">${categories.map((c) => `<option${c === item.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></div>${field("preco", "Preço (R$)", item.priceCents ? (item.priceCents / 100).toFixed(2) : "", "number", 'required min="0.01" max="1000000" step="0.01"')}${field("estoque", "Estoque", item.estoque ?? 0, "number", 'required min="0" max="100000" step="1"')}<div class="field span-two"><label for="edit-descricao">Descrição</label><textarea id="edit-descricao" name="descricao" required minlength="10" maxlength="4000">${esc(item.descricao || "")}</textarea></div><div class="span-two" id="edit-specs">${specsEditor(item.categoria || categories[0], item.ficha)}</div>` : `${field("nome", "Nome completo", item.nome, "text", 'required minlength="2" maxlength="200"')}${field("email", "E-mail", item.email, "email", item.id ? "readonly" : 'required maxlength="200"')}${field("telefone", "Telefone", item.telefone, "tel", 'maxlength="30"')}${field("endereco", "Endereço", item.endereco, "text", 'maxlength="500"')}${item.id ? "" : field("senha", "Senha inicial (10 a 72 caracteres)", "", "password", 'required minlength="10" maxlength="72" autocomplete="new-password"')}`}</div><div class="row"><button type="submit">Salvar ${product ? "produto" : "cliente"}</button><button type="button" id="cancel-edit" class="secondary">Cancelar</button></div></form>`;
    document.querySelector("#cancel-edit").onclick = () => (editor.innerHTML = "");
    const form = document.querySelector("#record-form");
    form.querySelector("input").focus();
    // Trocar a categoria troca os campos da ficha (os valores anteriores não se aplicam).
    form.elements.categoria?.addEventListener("change", (event) => {
      form.querySelector("#edit-specs").innerHTML = specsEditor(event.target.value, event.target.value === item.categoria ? item.ficha : {});
    });
    bindForm(form, async (data) => {
      if (product) {
        data.priceCents = Math.round(Number(data.preco) * 100);
        data.estoque = Number(data.estoque);
        for (const key of Object.keys(data)) if (key.startsWith("ficha.")) delete data[key];
        data.ficha = readSpecs(form, data.categoria);
      }
      await send(`/admin/${tab}${item.id ? `/${item.id}` : ""}`, data, item.id ? "PATCH" : "POST");
      toast("Registro salvo.", { type: "success" });
      await load();
      await stats();
    });
  }
  function imageEditor(item) {
    const editor = document.querySelector("#editor");
    editor.innerHTML = `<form id="image-form" class="admin-form"><h3>Imagem de ${esc(item.modelo)}</h3><img class="image-preview" src="${esc(productImage(item))}" alt="Imagem atual de ${esc(item.modelo)}"><p class="form-help">JPEG, PNG ou WebP, até 5 MB. Use apenas imagens próprias ou licenciadas. A imagem anterior será substituída.</p><div class="field"><label for="image">Escolher imagem</label><input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp" required></div><button type="submit">Enviar imagem</button></form>`;
    bindForm(document.querySelector("#image-form"), async (_data, form) => {
      const file = form.elements.image.files[0];
      if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
      await api(`/admin/products/${item.id}/image`, { method: "POST", body: new FormData(form) });
      toast("Imagem atualizada.", { type: "success" });
      await load();
    });
  }
  document.querySelectorAll("[data-tab]").forEach((b, index, buttons) => {
    b.onclick = async () => {
      tab = b.dataset.tab;
      query = "";
      buttons.forEach((x) => {
        x.setAttribute("aria-selected", x === b);
        x.classList.toggle("secondary", x !== b);
      });
      panel.setAttribute("aria-labelledby", b.id);
      try {
        await load();
      } catch (e) {
        errorState(panel, e, () => b.click(), { title: "Não foi possível carregar esta aba." });
      }
    };
    b.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        buttons[next].click();
      }
    };
  });
  // Indicadores e lista falham de forma independente, cada um com nova tentativa.
  const retryStats = async () => {
    try {
      await stats();
    } catch (e) {
      errorState(document.querySelector("#stats"), e, retryStats, { title: "Não foi possível carregar os indicadores." });
    }
  };
  const retryLoad = async () => {
    try {
      await load();
    } catch (e) {
      errorState(panel, e, retryLoad, { title: "Não foi possível carregar esta aba." });
    }
  };
  await Promise.all([retryStats(), retryLoad()]);
}
