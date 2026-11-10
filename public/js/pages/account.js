import { api, send, toast, bindForm, showError, requireUser, ordersHTML } from "../common.js";

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
  document.querySelector("#logout").onclick = async () => {
    try {
      await send("/auth/logout", {});
      location.href = "/";
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };
  const orders = document.querySelector("#orders");
  async function loadOrders() {
    orders.setAttribute("aria-busy", "true");
    orders.innerHTML = '<div class="loading" role="status">Carregando compras…</div>';
    try {
      orders.innerHTML = ordersHTML(await api("/orders"));
    } catch (error) {
      orders.replaceChildren();
      showError(orders, error);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Carregar histórico novamente";
      retry.onclick = loadOrders;
      orders.append(retry);
    } finally {
      orders.setAttribute("aria-busy", "false");
    }
  }
  await loadOrders();
}
