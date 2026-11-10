import { icon } from "../icons.js";
import { catalogProducts, getWishlist, setWishlist, getCart, setCart, toast } from "../common.js";
import { productCard, skeletonCards, bindCards, emptyState, errorState } from "../components.js";
import { openCart } from "../drawer.js";

export default async function wishlist() {
  const grid = document.querySelector("#wishlist-grid");
  const meta = document.querySelector("#wishlist-meta");
  const actions = document.querySelector("#wishlist-actions");
  let products = [];
  grid.innerHTML = skeletonCards(3);
  function render() {
    const ids = getWishlist();
    const list = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    if (list.length !== ids.length) {
      try {
        setWishlist(list.map((p) => p.id));
      } catch {
        // Mantém a lista salva; produtos indisponíveis apenas não aparecem.
      }
    }
    meta.textContent = list.length
      ? `${list.length} ${list.length === 1 ? "equipamento salvo" : "equipamentos salvos"} neste navegador.`
      : "";
    actions.hidden = !list.length;
    grid.innerHTML = list.length
      ? list.map((p, i) => productCard(p, i)).join("")
      : emptyState({
          symbol: "heart",
          title: "Sua lista de desejos está vazia.",
          text: "Toque no coração dos equipamentos para guardar ideias para o seu próximo setup.",
          actions: '<a class="button" href="/catalogo.html">Explorar catálogo</a>',
        });
  }
  bindCards(grid, () => products, { onWishChange: render });
  document.querySelector("#wishlist-add-all").addEventListener("click", () => {
    const cart = getCart();
    let added = 0;
    for (const id of getWishlist()) {
      const p = products.find((x) => x.id === id);
      if (!p || p.estoque < 1) continue;
      const current = cart.find((i) => i.id === id);
      if ((current?.quantidade || 0) + 1 > Math.min(99, p.estoque)) continue;
      if (current) current.quantidade++;
      else cart.push({ id, quantidade: 1 });
      added++;
    }
    if (!added) return toast("Nenhum favorito disponível para adicionar agora.", { type: "info" });
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`${added} ${added === 1 ? "favorito adicionado" : "favoritos adicionados"} ao carrinho.`);
  });
  document.querySelector("#wishlist-clear").addEventListener("click", () => {
    const previous = getWishlist();
    try {
      setWishlist([]);
    } catch {
      return toast("Não foi possível alterar seus favoritos.", { type: "error" });
    }
    render();
    toast("Lista de desejos limpa.", {
      type: "info",
      action: { label: "Desfazer", onClick: () => { setWishlist(previous); render(); } },
    });
  });
  document.querySelector("#wishlist-clear").insertAdjacentHTML("afterbegin", icon("trash", { size: 18 }));
  async function load() {
    try {
      products = await catalogProducts();
      render();
    } catch (error) {
      errorState(grid, error, load);
    }
  }
  await load();
}
