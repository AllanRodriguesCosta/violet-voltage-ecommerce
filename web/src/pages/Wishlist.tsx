// Favoritos: lista de desejos deste navegador, com "adicionar disponíveis ao carrinho",
// aviso de queda de preço para todos e limpar (com desfazer).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../lib/icons";
import { catalogProducts, getCart, getWishlist, setCart, toast, type Product } from "../lib/shop";
import { useWishlist } from "../lib/store";
import { loadSession } from "../lib/session";
import { openCart, setWishlist } from "../lib/catalog";
import { refreshPriceAlerts, setPriceAlert, watchedPrices } from "../lib/priceAlerts";
import { ProductCard, SkeletonCards } from "../components/ProductCard";
import { ErrorState, State } from "../components/State";

type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };

export default function Wishlist() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const ids = useWishlist();
  const fetchProducts = useCallback(() => {
    setLoad({ status: "loading" });
    (catalogProducts() as Promise<Product[]>).then(
      (products) => setLoad({ status: "ready", products }),
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(fetchProducts, [fetchProducts]);

  const products = load.status === "ready" ? load.products : null;
  const list = products ? ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)) : [];
  // Produtos que saíram do catálogo deixam a lista.
  useEffect(() => {
    if (!products || list.length === ids.length) return;
    try {
      setWishlist(list.map((p) => p.id));
    } catch {
      // Mantém a lista salva; produtos indisponíveis apenas não aparecem.
    }
  });

  const addAll = () => {
    if (!products) return;
    const cart = getCart() as { id: string; quantidade: number }[];
    let added = 0;
    for (const id of getWishlist() as string[]) {
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
  };
  // Aviso de queda de preço para todos os favoritos de uma vez (conta necessária).
  const watchAll = async () => {
    if (!(await loadSession())) {
      toast("Entre na sua conta para receber avisos de preço dos favoritos.", {
        action: { label: "Entrar", onClick: () => (location.href = "/login.html?next=%2Ffavoritos.html") },
      });
      return;
    }
    const watched = await watchedPrices();
    const pending = (getWishlist() as string[]).filter((id) => products?.some((p) => p.id === id) && !watched.has(id));
    if (!pending.length) return toast("Todos os favoritos já têm aviso de preço ativo.", { type: "info" });
    setBusy(true);
    let done = 0;
    for (const id of pending) {
      try {
        await setPriceAlert(id, true);
        done++;
      } catch {
        /* segue com os demais */
      }
    }
    setBusy(false);
    await refreshPriceAlerts();
    toast(done ? `Aviso de preço ativado para ${done} ${done === 1 ? "favorito" : "favoritos"}.` : "Não foi possível ativar os avisos agora.", {
      type: done ? "success" : "error",
      action: done ? { label: "Ver avisos", onClick: () => (location.href = "/minha-conta.html#avisos") } : undefined,
    });
  };
  const clear = () => {
    const previous = getWishlist() as string[];
    try {
      setWishlist([]);
    } catch {
      return toast("Não foi possível alterar seus favoritos.", { type: "error" });
    }
    toast("Lista de desejos limpa.", { type: "info", action: { label: "Desfazer", onClick: () => setWishlist(previous) } });
  };

  return (
    <div className="container page-wrap">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Favoritos</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Lista de desejos</span>
          <h1 className="page-title">Seus favoritos.</h1>
          <p className="lead" id="wishlist-meta">
            {list.length ? `${list.length} ${list.length === 1 ? "equipamento salvo" : "equipamentos salvos"} neste navegador.` : ""}
          </p>
        </div>
        <div className="row" id="wishlist-actions" hidden={!list.length}>
          <button type="button" className="button secondary" id="wishlist-clear" onClick={clear}>
            <Icon name="trash" size={18} />
            Limpar lista
          </button>
          <button type="button" className="button secondary" id="wishlist-price" disabled={busy} onClick={watchAll}>
            <Icon name="tag" size={18} />
            Avisar se baixar o preço
          </button>
          <button type="button" className="button" id="wishlist-add-all" onClick={addAll}>
            Adicionar disponíveis ao carrinho
          </button>
        </div>
      </header>
      <div className="product-grid product-grid-wide" id="wishlist-grid">
        {load.status === "loading" && <SkeletonCards count={3} />}
        {load.status === "error" && <ErrorState error={load.error} retry={fetchProducts} />}
        {products &&
          (list.length ? (
            list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
          ) : (
            <State
              symbol="heart"
              title="Sua lista de desejos está vazia."
              text="Toque no coração dos equipamentos para guardar ideias para o seu próximo setup."
              actions={
                <a className="button" href="/catalogo.html">
                  Explorar catálogo
                </a>
              }
            />
          ))}
      </div>
    </div>
  );
}
