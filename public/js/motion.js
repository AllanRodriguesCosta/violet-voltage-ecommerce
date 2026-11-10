// Microinterações: produto voando até o carrinho, contador em destaque,
// cabeçalho com sombra ao rolar e botão de voltar ao topo.
import { icon } from "./icons.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const visible = (el) => el && el.getClientRects().length > 0;

export function bumpCart() {
  if (reduced()) return;
  document.querySelectorAll("[data-cart-count]:not([hidden])").forEach((el) =>
    el.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" }),
  );
  document.querySelector(".site-header .cart-link .icon")?.animate?.(
    [{ transform: "none" }, { transform: "rotate(-12deg) scale(1.15)" }, { transform: "rotate(8deg)" }, { transform: "none" }],
    { duration: 520, easing: "ease-out" },
  );
}

// Uma cópia da imagem segue um arco até o ícone do carrinho; sem animação, só o contador pulsa.
// Resolve quando a animação termina, para o aviso aparecer depois dela.
export function flyToCart(source) {
  return new Promise((resolve) => fly(source, resolve));
}
function fly(source, resolve) {
  const target = [...document.querySelectorAll(".site-header .cart-link, .bottom-nav a[href='/carrinho.html']")].find(visible);
  const from = source?.getBoundingClientRect?.();
  if (!target || !from?.width || reduced() || !source.animate) {
    bumpCart();
    resolve();
    return;
  }
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 160);
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);
  const ghost = document.createElement("img");
  ghost.src = source.currentSrc || source.src;
  ghost.alt = "";
  ghost.className = "fly-ghost";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, { left: `${startX}px`, top: `${startY}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(ghost);
  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 70}px) scale(0.55)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.35 },
    ],
    { duration: 700, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
  );
  const done = () => {
    ghost.remove();
    bumpCart();
    resolve();
  };
  animation.onfinish = done;
  animation.oncancel = done;
}

export function initMotion() {
  const header = document.querySelector(".site-header");
  const top = document.createElement("button");
  top.type = "button";
  top.className = "to-top";
  top.setAttribute("aria-label", "Voltar ao topo");
  top.innerHTML = icon("arrowUp");
  top.hidden = true;
  top.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    document.querySelector("#main")?.focus({ preventScroll: true });
  });
  document.body.append(top);
  let ticking = false;
  const sync = () => {
    ticking = false;
    header?.classList.toggle("is-scrolled", scrollY > 8);
    top.hidden = scrollY < innerHeight * 1.5;
  };
  addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(sync);
      }
    },
    { passive: true },
  );
  sync();
}
