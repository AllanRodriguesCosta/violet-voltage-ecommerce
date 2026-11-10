import { icon } from "../icons.js";
import { api, send, toast, bindForm, requireUser, catalogProducts, getCart, setCart, money } from "../common.js";
import { orderCardHTML } from "../orders.js";
import { confirmDialog, emptyState, errorState } from "../components.js";
import { openCart } from "../drawer.js";

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
  document.querySelector("#account-greeting").textContent = `Olá, ${user.nome.split(" ")[0]}.`;
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
        ? emptyState({ symbol: "package", title: "Nenhum pedido neste filtro." })
        : emptyState({ symbol: "package", title: "Nenhuma compra por aqui ainda.", text: "Quando você finalizar um pedido, ele aparece aqui com cada etapa da entrega.", actions: '<a class="button" href="/catalogo.html">Explorar equipamentos</a>' });
  }
  async function load() {
    list.setAttribute("aria-busy", "true");
    list.innerHTML = '<div class="loading" role="status">Carregando compras…</div>';
    try {
      [orders, products] = await Promise.all([api("/orders"), catalogProducts().catch(() => [])]);
      render();
    } catch (error) {
      errorState(list, error, load);
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
