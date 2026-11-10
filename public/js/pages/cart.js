import { icon } from "../icons.js";
import {
  catalogProducts,
  money,
  productImage,
  escapeHtml as esc,
  getCart,
  setCart,
  toast,
  showError,
} from "../common.js";
import { emptyState } from "../components.js";

export async function cartData() {
  const cart = getCart();
  const products = await catalogProducts({ fresh: true });
  return cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }));
}
export const subtotal = (items) =>
  items.reduce((sum, i) => sum + (i.product?.priceCents || 0) * i.quantidade, 0);

export default async function cartPage() {
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
  function save(items, message) {
    const previous = getCart();
    try {
      setCart(items);
    } catch {
      toast("Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador.", { type: "error" });
      return;
    }
    if (message)
      toast(message, {
        type: "info",
        action: { label: "Desfazer", onClick: () => { setCart(previous); render().catch(retryCart); } },
      });
    render().catch(retryCart);
  }
  async function render() {
    const items = await cartData();
    container.className = "";
    if (!items.length) {
      container.innerHTML = emptyState({
        symbol: "bag",
        title: "Seu carrinho está esperando o primeiro acorde.",
        text: "Explore o catálogo e monte o seu próximo setup.",
        actions: '<a class="button" href="/catalogo.html">Explorar catálogo</a>',
      });
      return;
    }
    const invalid = items.some((i) => !i.product || i.quantidade > i.product.estoque);
    container.innerHTML = `<div class="cart-layout"><section class="panel cart-list" aria-label="Itens do carrinho">${items
      .map((i) => {
        const p = i.product;
        const name = p ? `${p.marca} ${p.modelo}` : "Produto removido ou indisponível";
        const max = Math.min(99, p?.estoque || 1);
        return `<article class="cart-item"><img src="${esc(productImage(p))}" alt="" width="96" height="96"><div class="cart-item-info"><h3>${p ? `<a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(name)}</a>` : esc(name)}</h3>${!p || i.quantidade > p.estoque ? '<p class="field-error">Ajuste a quantidade ou remova este item.</p>' : ""}<span class="small muted">${money(p?.priceCents || 0)} por unidade</span><div class="cart-actions"><label for="qty-${esc(i.id)}" class="small">Qtd.</label><input id="qty-${esc(i.id)}" type="number" min="1" max="${max}" value="${i.quantidade}" inputmode="numeric" data-qty="${esc(i.id)}"><button type="button" class="text-button" data-remove-item="${esc(i.id)}">${icon("trash", { size: 16 })}Remover</button></div></div><strong class="price">${money((p?.priceCents || 0) * i.quantidade)}</strong></article>`;
      })
      .join("")}</section><aside class="panel summary-panel"><h2>Resumo</h2><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal(items))}</strong></div><p class="small muted">Frete calculado no checkout. Preços e estoque são conferidos novamente ao finalizar.</p><a class="button full" href="/checkout.html"${invalid ? ' aria-disabled="true"' : ""}>Continuar para o checkout ${icon("arrowRight", { size: 18 })}</a><a class="button secondary full" href="/catalogo.html">Continuar comprando</a></aside></div>`;
    container.querySelector('[aria-disabled="true"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Ajuste os itens indisponíveis primeiro.", { type: "error" });
    });
    container.querySelectorAll("[data-remove-item]").forEach((b) =>
      b.addEventListener("click", () =>
        save(getCart().filter((i) => i.id !== b.dataset.removeItem), "Item removido do carrinho."),
      ),
    );
    container.querySelectorAll("[data-qty]").forEach((input) =>
      input.addEventListener("change", () => {
        const qty = Number(input.value);
        if (!Number.isInteger(qty) || qty < 1 || qty > Number(input.max)) {
          toast("Quantidade inválida para o estoque disponível.", { type: "error" });
          render().catch(retryCart);
          return;
        }
        const cart = getCart();
        const item = cart.find((i) => i.id === input.dataset.qty);
        if (!item) return render().catch(retryCart);
        item.quantidade = qty;
        save(cart);
      }),
    );
  }
  document.addEventListener("vv:cart", () => {
    if (!container.contains(document.activeElement)) render().catch(retryCart);
  });
  await render().catch(retryCart);
}
