// "Avise-me quando chegar" para itens esgotados: aviso guardado na conta.
// Botões com data-alert em qualquer lugar da página (cards, produto, visualização
// rápida) são tratados aqui por delegação e sincronizados com os avisos ativos.
import { icon } from "./icons.js";
import { api, send, toast, sessionReady, escapeHtml as esc } from "./common.js";

let mine;
async function activeAlerts() {
  const user = await sessionReady;
  if (!user) return new Set();
  mine ||= api("/alerts")
    .then((list) => new Set(list.filter((a) => !a.notifiedAt).map((a) => a.productId)))
    .catch(() => new Set());
  return mine;
}
function paint(button, active) {
  button.setAttribute("aria-pressed", String(active));
  button.querySelector(".alert-icon").innerHTML = icon(active ? "check" : "bell", { size: 18 });
  button.querySelector(".alert-label").textContent = active ? "Aviso ativado" : button.dataset.short ? "Avise-me" : "Avise-me quando chegar";
}
export const alertButtonHTML = (product, { short = false, className = "secondary" } = {}) =>
  `<button type="button" class="${className} alert-button" data-alert="${esc(product.id)}"${short ? ' data-short="1"' : ""} aria-pressed="false"><span class="alert-icon">${icon("bell", { size: 18 })}</span><span class="alert-label">${short ? "Avise-me" : "Avise-me quando chegar"}</span><span class="sr-only"> quando ${esc(product.marca)} ${esc(product.modelo)} voltar ao estoque</span></button>`;

export async function syncAlertButtons(root = document) {
  const buttons = root.querySelectorAll("[data-alert]");
  if (!buttons.length) return;
  const ids = await activeAlerts();
  buttons.forEach((b) => paint(b, ids.has(b.dataset.alert)));
}
export async function toggleAlert(button) {
  const id = button.dataset.alert;
  const user = await sessionReady;
  if (!user) {
    toast("Entre na sua conta para receber o aviso quando voltar ao estoque.", {
      action: { label: "Entrar", onClick: () => (location.href = `/login.html?next=${encodeURIComponent(`/produto.html?id=${id}`)}`) },
    });
    return;
  }
  const ids = await activeAlerts();
  const active = ids.has(id);
  button.disabled = true;
  try {
    if (active) {
      await send(`/alerts/${encodeURIComponent(id)}`, {}, "DELETE");
      ids.delete(id);
      toast("Aviso cancelado.", { type: "info", action: { label: "Desfazer", onClick: () => toggleAlert(button) } });
    } else {
      await send("/alerts", { productId: id });
      ids.add(id);
      toast("Pronto! Avisamos em Minha conta quando voltar ao estoque.", {
        type: "success",
        action: { label: "Ver avisos", onClick: () => (location.href = "/minha-conta.html#avisos") },
      });
    }
    document.querySelectorAll(`[data-alert="${CSS.escape(id)}"]`).forEach((b) => paint(b, !active));
  } catch (error) {
    toast(error.message, { type: "error" });
  } finally {
    button.disabled = false;
  }
}
export function initAlerts() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-alert]");
    if (button) toggleAlert(button);
  });
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => syncAlertButtons(), 60);
  }).observe(document.body, { childList: true, subtree: true });
  syncAlertButtons();
}
