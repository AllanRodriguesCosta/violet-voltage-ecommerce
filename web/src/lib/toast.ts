// Aviso com tempo visível (#toast); pausa enquanto o cursor ou o foco estão nele. Fica fora do
// React porque é chamado de qualquer lugar (carrinho, favoritos, formulários) e sobrevive a
// mudanças de tela.
import { iconSVG } from "./iconPaths";

export type ToastOptions = { type?: "info" | "success" | "error"; action?: { label: string; onClick: () => void } };
let timer: ReturnType<typeof setTimeout> | undefined;
let left = 0;
let started = 0;
function pause(el: HTMLElement) {
  if (el.hidden || el.classList.contains("is-paused")) return;
  clearTimeout(timer);
  left = Math.max(1500, left - (Date.now() - started));
  el.classList.add("is-paused");
}
function resume(el: HTMLElement) {
  if (el.hidden || !el.classList.contains("is-paused")) return;
  el.classList.remove("is-paused");
  started = Date.now();
  timer = setTimeout(() => (el.hidden = true), left);
}
export function toast(message: string, { type = "info", action }: ToastOptions = {}) {
  let el = document.querySelector<HTMLElement>("#toast");
  if (!el) {
    const created = document.createElement("div");
    created.id = "toast";
    created.setAttribute("role", "status");
    document.body.append(created);
    created.addEventListener("pointerenter", () => pause(created));
    created.addEventListener("pointerleave", () => resume(created));
    created.addEventListener("focusin", () => pause(created));
    created.addEventListener("focusout", () => resume(created));
    el = created;
  }
  const box = el;
  const duration = action ? 7000 : 4500;
  box.className = `toast toast-${type}`;
  box.textContent = message;
  if (typeof box.insertAdjacentHTML === "function") {
    box.insertAdjacentHTML("afterbegin", iconSVG(({ success: "check", error: "alert", info: "info" } as const)[type] || "info", { size: 18 }));
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        box.hidden = true;
        action.onClick();
      });
      box.append(button);
    }
    box.insertAdjacentHTML("beforeend", `<span class="toast-timer" aria-hidden="true" style="--toast-ms:${duration}ms"></span>`);
  }
  box.hidden = false;
  clearTimeout(timer);
  left = duration;
  started = Date.now();
  timer = setTimeout(() => (box.hidden = true), duration);
}
