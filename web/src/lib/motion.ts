// Microinterações: uma cópia da imagem do produto voa até o carrinho e o contador pulsa.
// Sem animação (movimento reduzido ou sem imagem de origem), só o contador pulsa.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const visible = (el: Element | null | undefined): el is HTMLElement => !!el && el.getClientRects().length > 0;

export function bumpCart() {
  if (reduced()) return;
  document
    .querySelectorAll<HTMLElement>(".site-header .cart-link .count, .bottom-nav a[href='/carrinho.html'] .count")
    .forEach((el) => el.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" }));
  document
    .querySelector<SVGElement>(".site-header .cart-link .icon")
    ?.animate?.([{ transform: "none" }, { transform: "rotate(-12deg) scale(1.15)" }, { transform: "rotate(8deg)" }, { transform: "none" }], { duration: 520, easing: "ease-out" });
}

// Resolve quando a animação termina, para o aviso aparecer depois dela.
export function flyToCart(source?: Element | null): Promise<void> {
  return new Promise((resolve) => {
    const target = [...document.querySelectorAll(".site-header .cart-link, .bottom-nav a[href='/carrinho.html']")].find(visible);
    const from = source?.getBoundingClientRect?.();
    const image = source as HTMLImageElement | null | undefined;
    if (!target || !from?.width || reduced() || !image?.animate) {
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
    ghost.src = image.currentSrc || image.src || image.querySelector?.("img")?.src || "";
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
  });
}
