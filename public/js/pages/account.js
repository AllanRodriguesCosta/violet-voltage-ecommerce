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
} from "../common.js";
import { orderCardHTML } from "../orders.js";
import { confirmDialog, emptyState, errorState, maskPhone } from "../components.js";
import { openCart } from "../drawer.js";
import { addressFormHTML, wireAddressForm, formatAddress } from "../address.js";

const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// Notificações: status de pedidos e estoque de volta; "Marcar todas como lidas" zera o contador.
async function notifications() {
  const panel = document.querySelector("#notificacoes");
  const list = document.querySelector("#notification-list");
  const unread = document.querySelector("#notifications-unread");
  const readAll = document.querySelector("#notifications-read");
  let data;
  const render = () => {
    panel.hidden = !data.itens.length;
    unread.hidden = !data.naoLidas;
    unread.textContent = data.naoLidas;
    readAll.hidden = !data.naoLidas;
    setNotificationCount(data.naoLidas);
    list.innerHTML = data.itens
      .map(
        (n) =>
          `<li class="notification${n.lida ? "" : " is-unread"}"><span class="notification-icon">${icon(n.tipo === "estoque" ? "bell" : "package", { size: 18 })}</span><div><a href="${esc(n.link)}" data-read="${esc(n.id)}">${esc(n.titulo)}</a><p>${esc(n.texto)}</p><time datetime="${esc(n.createdAt)}">${when.format(new Date(n.createdAt))}</time></div>${n.lida ? "" : '<span class="unread-dot"><span class="sr-only">Não lida</span></span>'}</li>`,
      )
      .join("");
  };
  const mark = async (ids) => {
    const result = await send("/notifications/read", ids ? { ids } : {});
    data.itens = data.itens.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida: true } : n));
    data.naoLidas = result.naoLidas;
    render();
  };
  try {
    data = await api("/notifications");
  } catch {
    return; // Sem notificações, a conta continua utilizável.
  }
  render();
  if (location.hash === "#notificacoes") panel.scrollIntoView();
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

// Endereços de entrega: até 5, um principal, editados no próprio painel.
function addresses(user) {
  let items = user.enderecos || [];
  const list = document.querySelector("#address-list");
  const editor = document.querySelector("#address-editor");
  const add = document.querySelector("#address-add");
  const render = () => {
    add.hidden = items.length >= 5 || !!editor.firstChild;
    list.innerHTML = items.length
      ? items
          .map(
            (a) =>
              `<article class="address-card${a.principal ? " is-main" : ""}" data-address="${esc(a.id)}"><div class="address-text"><strong>${esc(a.apelido || "Endereço")}</strong>${a.principal ? '<span class="badge badge-main">Principal</span>' : ""}<p>${esc(formatAddress(a))}</p></div><div class="address-actions"><button type="button" class="text-button" data-edit>${icon("edit", { size: 16 })}Editar</button>${a.principal ? "" : '<button type="button" class="text-button" data-main>Tornar principal</button>'}<button type="button" class="text-button danger-text" data-delete>${icon("trash", { size: 16 })}Excluir</button></div></article>`,
          )
          .join("")
      : emptyState({ symbol: "pin", level: 3, title: "Nenhum endereço salvo.", text: "Salve onde você recebe seus pedidos para escolher em um toque no checkout." });
  };
  const close = () => {
    editor.innerHTML = "";
    render();
    add.focus();
  };
  const open = (current) => {
    editor.innerHTML = addressFormHTML(current, { first: !items.length || (current?.principal && items.length === 1) });
    const form = editor.querySelector("form");
    wireAddressForm(form);
    form.querySelector("[data-cancel-address]").addEventListener("click", close);
    bindForm(form, async (data) => {
      const body = { ...data, principal: form.elements.principal.checked };
      items = current ? await send(`/addresses/${encodeURIComponent(current.id)}`, body, "PATCH") : await send("/addresses", body);
      toast(current ? "Endereço atualizado." : "Endereço salvo.", { type: "success" });
      close();
    });
    add.hidden = true;
    form.elements.cep.focus();
  };
  add.addEventListener("click", () => open());
  list.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-address]");
    const current = items.find((a) => a.id === card?.dataset.address);
    if (!current) return;
    try {
      if (event.target.closest("[data-edit]")) open(current);
      else if (event.target.closest("[data-main]")) {
        items = await send(`/addresses/${encodeURIComponent(current.id)}`, { ...current, principal: true }, "PATCH");
        render();
        toast("Endereço principal atualizado.", { type: "success" });
      } else if (event.target.closest("[data-delete]")) {
        const ok = await confirmDialog({ title: "Excluir este endereço?", text: esc(formatAddress(current)), confirm: "Excluir", cancel: "Manter", danger: true });
        if (!ok) return;
        items = await send(`/addresses/${encodeURIComponent(current.id)}`, {}, "DELETE");
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

// Avisos "Avise-me": aguardando reposição ou disponíveis de novo.
async function alerts() {
  const box = document.querySelector("#alert-list");
  let items = [];
  const render = () => {
    const shown = items.filter((a) => a.produto);
    box.innerHTML = shown.length
      ? `<ul class="alert-items">${shown
          .map((a) => {
            const p = a.produto;
            const back = p.estoque > 0;
            return `<li class="alert-item"><img src="${esc(productImage(p))}" alt="" width="52" height="52"><div class="alert-info"><a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(p.marca)} ${esc(p.modelo)}</a><span class="alert-state ${back ? "is-back" : "is-waiting"}">${back ? "Disponível novamente" : "Aguardando reposição"}</span></div><div class="alert-actions">${back ? `<button type="button" class="button" data-alert-cart="${esc(p.id)}">${icon("bag", { size: 16 })}Adicionar</button>` : ""}<button type="button" class="text-button" data-alert-remove="${esc(p.id)}" aria-label="Remover aviso de ${esc(p.marca)} ${esc(p.modelo)}">Remover</button></div></li>`;
          })
          .join("")}</ul>`
      : emptyState({ symbol: "bell", level: 3, title: "Nenhum aviso ativo.", text: "Nos itens esgotados, toque em “Avise-me quando chegar”." });
  };
  const load = async () => {
    try {
      items = await api("/alerts");
      render();
    } catch (error) {
      errorState(box, error, load, { level: 3, title: "Não foi possível carregar seus avisos." });
    }
  };
  box.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-alert-remove]");
    const cart = event.target.closest("[data-alert-cart]");
    if (cart) {
      const a = items.find((x) => x.productId === cart.dataset.alertCart);
      if (a?.produto) addCart(a.produto, 1, { source: cart.closest("li").querySelector("img") });
    } else if (remove) {
      try {
        await send(`/alerts/${encodeURIComponent(remove.dataset.alertRemove)}`, {}, "DELETE");
        items = items.filter((x) => x.productId !== remove.dataset.alertRemove);
        render();
        toast("Aviso removido.", { type: "success" });
      } catch (error) {
        toast(error.message, { type: "error" });
      }
    }
  });
  await load();
}

const groups = {
  todos: () => true,
  andamento: (o) => ["Recebido", "Em preparação", "Enviado"].includes(o.status),
  concluidos: (o) => o.status === "Concluído",
  cancelados: (o) => o.status === "Cancelado",
};
export default async function account(session) {
  const user = await session;
  if (!requireUser(user)) return;
  const form = document.querySelector("#profile-form");
  for (const key of ["nome", "email", "telefone", "endereco"]) form.elements[key].value = user[key] || "";
  maskPhone(form.elements.telefone);
  document.querySelector("#account-greeting").textContent = `Olá, ${user.nome.split(" ")[0]}.`;
  addresses(user);
  notifications();
  alerts();
  bindForm(form, async (data) => {
    await send("/profile", data, "PATCH");
    toast("Dados atualizados.", { type: "success" });
  });
  document.querySelector("#logout").addEventListener("click", async () => {
    try {
      await send("/auth/logout", {});
      location.href = "/";
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  });
  const list = document.querySelector("#orders");
  const filters = document.querySelector("#order-filters");
  let orders = [];
  let products = [];
  let group = "todos";
  function render() {
    const valid = orders.filter((o) => o.status !== "Cancelado");
    document.querySelector("#account-stats").innerHTML = [
      ["package", orders.length, orders.length === 1 ? "pedido" : "pedidos"],
      ["truck", orders.filter(groups.andamento).length, "em andamento"],
      ["card", money(valid.reduce((s, o) => s + o.totalCents, 0)), "em compras"],
    ]
      .map(([symbol, value, label]) => `<div class="account-stat">${icon(symbol, { size: 20 })}<strong>${value}</strong><span>${label}</span></div>`)
      .join("");
    filters.querySelectorAll("[data-group]").forEach((b) => {
      const count = orders.filter(groups[b.dataset.group]).length;
      b.querySelector(".chip-count").textContent = count;
      b.setAttribute("aria-pressed", String(b.dataset.group === group));
    });
    const shown = orders.filter(groups[group]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    list.innerHTML = shown.length
      ? shown.map((o) => orderCardHTML(o, { products })).join("")
      : orders.length
        ? emptyState({ symbol: "package", title: "Nenhum pedido neste filtro.", level: 3 })
        : emptyState({ symbol: "package", level: 3, title: "Nenhuma compra por aqui ainda.", text: "Quando você finalizar um pedido, ele aparece aqui com cada etapa da entrega.", actions: '<a class="button" href="/catalogo.html">Explorar equipamentos</a>' });
  }
  async function load() {
    list.setAttribute("aria-busy", "true");
    list.innerHTML = '<div class="loading" role="status">Carregando compras…</div>';
    try {
      [orders, products] = await Promise.all([api("/orders"), catalogProducts().catch(() => [])]);
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
    const order = orders.find((o) => o.id === card.dataset.orderId);
    if (event.target.closest("[data-reorder]")) {
      const cart = getCart();
      let added = 0;
      let missing = 0;
      for (const item of order.itens) {
        const p = products.find((x) => x.id === item.id);
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
        title: `Cancelar o pedido #${order.id.slice(0, 8).toUpperCase()}?`,
        text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.",
        confirm: "Cancelar pedido",
        cancel: "Manter pedido",
        danger: true,
      });
      if (!ok) return;
      try {
        const updated = await send(`/orders/${order.id}/cancel`, {});
        orders = orders.map((o) => (o.id === updated.id ? updated : o));
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
