import {
  api,
  send,
  money,
  productImage,
  escapeHtml as esc,
  bindForm,
  toast,
  requireUser,
  ordersHTML,
  showError,
} from "./common.js";
const categories = [
  "Guitarras",
  "Pedais",
  "Amplificadores",
  "Cabos",
  "Correias",
  "Acessórios",
];
const field = (key, label, value = "", type = "text", attributes = "") =>
  `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${esc(value)}" ${attributes}></div>`;
export async function adminPage(user) {
  if (!requireUser(user)) return;
  if (user.role !== "admin") {
    document.querySelector("#admin-content").innerHTML =
      '<div class="empty"><h1>Acesso restrito</h1><p>Esta área está disponível apenas para administradores.</p><a class="button" href="/">Voltar à loja</a></div>';
    return;
  }
  let tab = "products";
  let items = [];
  const panel = document.querySelector("#admin-panel");
  async function stats() {
    const s = await api("/admin/summary");
    document.querySelector("#stats").innerHTML = [
      ["Produtos ativos", s.produtos],
      ["Clientes ativos", s.clientes],
      ["Pedidos", s.pedidos],
      ["Volume de pedidos", money(s.totalCents)],
    ]
      .map(
        ([label, value]) =>
          `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`,
      )
      .join("");
  }
  async function load() {
    panel.innerHTML = '<div class="loading">Carregando…</div>';
    items = await api(tab === "products" ? "/products" : `/admin/${tab}`);
    if (tab === "orders") {
      panel.innerHTML =
        '<h2>Pedidos</h2><p class="form-help">Alterar o status não restitui estoque automaticamente. Cancelamentos precisam de conferência manual do estoque.</p>' +
        ordersHTML(items, true);
      panel.querySelectorAll("[data-order]").forEach(
        (select) =>
          (select.onchange = async () => {
            select.disabled = true;
            try {
              await send(
                `/admin/orders/${select.dataset.order}`,
                { status: select.value },
                "PATCH",
              );
              toast("Status atualizado.");
              await stats();
            } catch (e) {
              toast(e.message);
              await load();
            } finally {
              select.disabled = false;
            }
          }),
      );
      return;
    }
    panel.innerHTML = `<div class="admin-toolbar"><h2>${tab === "products" ? "Equipamentos" : "Clientes"}</h2><button id="new-record">+ ${tab === "products" ? "Cadastrar produto" : "Cadastrar cliente"}</button></div><div id="editor"></div>${items.length ? `<div class="table-wrap"><table><thead><tr><th>${tab === "products" ? "Produto" : "Cliente"}</th><th>${tab === "products" ? "Preço" : "Contato"}</th><th>${tab === "products" ? "Estoque" : "Papel"}</th><th>Ações</th></tr></thead><tbody>${items.map((i) => `<tr><td>${tab === "products" ? `<div class="admin-product"><img src="${esc(productImage(i))}" alt="${esc(i.marca + " " + i.modelo)}" loading="lazy"><div><strong>${esc(i.modelo)}</strong><small>${esc(i.marca)}</small></div></div>` : `<strong>${esc(i.nome)}</strong><small>${esc(i.email)}</small>`}</td><td>${tab === "products" ? money(i.priceCents) : esc(i.telefone || "—")}</td><td>${tab === "products" ? i.estoque : esc(i.role)}</td><td><button class="secondary" data-edit="${i.id}">Editar</button>${tab === "products" ? `<button class="secondary" data-image="${i.id}">Imagem</button>` : `<button class="secondary" data-history="${i.id}">Compras</button>`}${i.role === "admin" ? "" : `<button class="danger" data-delete="${i.id}">Excluir</button>`}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Nenhum registro cadastrado.</div>'}`;
    document.querySelector("#new-record").onclick = () => edit();
    panel
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () => edit(items.find((i) => i.id === b.dataset.edit))),
      );
    panel
      .querySelectorAll("[data-image]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            imageEditor(items.find((i) => i.id === b.dataset.image))),
      );
    panel.querySelectorAll("[data-history]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            const orders = await api("/admin/orders");
            document.querySelector("#editor").innerHTML =
              `<h3>Compras de ${esc(items.find((i) => i.id === b.dataset.history).nome)}</h3>` +
              ordersHTML(
                orders.filter((o) => o.partitionKey === b.dataset.history),
              );
          } catch (e) {
            toast(e.message);
          }
        }),
    );
    panel.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (
            !confirm(
              "Excluir este registro? O histórico de pedidos será preservado.",
            )
          )
            return;
          b.disabled = true;
          try {
            await api(`/admin/${tab}/${b.dataset.delete}`, {
              method: "DELETE",
            });
            toast("Registro excluído.");
            await load();
            await stats();
          } catch (e) {
            toast(e.message);
            b.disabled = false;
          }
        }),
    );
  }
  function edit(item = {}) {
    const editor = document.querySelector("#editor");
    const product = tab === "products";
    editor.innerHTML = `<form class="admin-form" id="record-form"><h3>${item.id ? "Editar" : "Cadastrar"} ${product ? "produto" : "cliente"}</h3><div class="form-grid">${product ? `${field("marca", "Marca", item.marca, "text", 'required maxlength="200"')}${field("modelo", "Modelo", item.modelo, "text", 'required maxlength="200"')}<div class="field"><label for="edit-categoria">Categoria</label><select id="edit-categoria" name="categoria">${categories.map((c) => `<option${c === item.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></div>${field("preco", "Preço (R$)", item.priceCents ? (item.priceCents / 100).toFixed(2) : "", "number", 'required min="0.01" max="1000000" step="0.01"')}${field("estoque", "Estoque", item.estoque ?? 0, "number", 'required min="0" max="100000" step="1"')}<div class="field span-two"><label for="edit-descricao">Descrição</label><textarea id="edit-descricao" name="descricao" required minlength="10" maxlength="4000">${esc(item.descricao || "")}</textarea></div>` : `${field("nome", "Nome completo", item.nome, "text", 'required minlength="2" maxlength="200"')}${field("email", "E-mail", item.email, "email", item.id ? "readonly" : 'required maxlength="200"')}${field("telefone", "Telefone", item.telefone, "tel", 'maxlength="30"')}${field("endereco", "Endereço", item.endereco, "text", 'maxlength="500"')}${item.id ? "" : field("senha", "Senha inicial (10 a 72 caracteres)", "", "password", 'required minlength="10" maxlength="72" autocomplete="new-password"')}`}</div><div class="row"><button type="submit">Salvar ${product ? "produto" : "cliente"}</button><button type="button" id="cancel-edit" class="secondary">Cancelar</button></div></form>`;
    document.querySelector("#cancel-edit").onclick = () =>
      (editor.innerHTML = "");
    const form = document.querySelector("#record-form");
    form.querySelector("input").focus();
    bindForm(form, async (data) => {
      if (product) {
        data.priceCents = Math.round(Number(data.preco) * 100);
        data.estoque = Number(data.estoque);
      }
      await send(
        `/admin/${tab}${item.id ? `/${item.id}` : ""}`,
        data,
        item.id ? "PATCH" : "POST",
      );
      toast("Registro salvo.");
      await load();
      await stats();
    });
  }
  function imageEditor(item) {
    const editor = document.querySelector("#editor");
    editor.innerHTML = `<form id="image-form" class="admin-form"><h3>Imagem de ${esc(item.modelo)}</h3><img class="image-preview" src="${esc(productImage(item))}" alt="Imagem atual de ${esc(item.modelo)}"><p class="form-help">JPEG, PNG ou WebP, até 5 MB. Use apenas imagens próprias ou licenciadas. A imagem anterior será substituída.</p><div class="field"><label for="image">Escolher imagem</label><input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp" required></div><button type="submit">Enviar imagem</button></form>`;
    bindForm(document.querySelector("#image-form"), async (_data, form) => {
      const file = form.elements.image.files[0];
      if (file.size > 5 * 1024 * 1024)
        throw new Error("A imagem deve ter no máximo 5 MB.");
      await api(`/admin/products/${item.id}/image`, {
        method: "POST",
        body: new FormData(form),
      });
      toast("Imagem atualizada.");
      await load();
    });
  }
  document.querySelectorAll("[data-tab]").forEach((b, index, buttons) => {
    b.onclick = async () => {
      tab = b.dataset.tab;
      buttons.forEach((x) => x.setAttribute("aria-selected", x === b));
      panel.setAttribute("aria-labelledby", b.id);
      try {
        await load();
      } catch (e) {
        showError(panel, e);
      }
    };
    b.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length;
        buttons[next].focus();
        buttons[next].click();
      }
    };
  });
  await stats();
  await load();
}
