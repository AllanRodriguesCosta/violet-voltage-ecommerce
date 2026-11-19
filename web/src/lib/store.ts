// Estado do navegador (carrinho, favoritos, tema) lido com useSyncExternalStore.
// No pré-render (servidor) tudo começa vazio; no navegador o valor real entra logo após a
// hidratação, sem divergência entre o HTML gerado e o primeiro render.
import { useSyncExternalStore } from "react";
import { getCart, getWishlist } from "./shop";

function subscribeTo(events: string[], storageKeys: string[]) {
  return (notify: () => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || storageKeys.includes(e.key)) notify();
    };
    events.forEach((name) => document.addEventListener(name, notify));
    addEventListener("storage", onStorage);
    return () => {
      events.forEach((name) => document.removeEventListener(name, notify));
      removeEventListener("storage", onStorage);
    };
  };
}
const cartSub = subscribeTo(["vv:cart"], ["vv_cart"]);
const wishSub = subscribeTo(["vv:wishlist"], ["vv_wishlist"]);
let wishCache: { key: string; list: string[] } = { key: "[]", list: [] };
const wishSnapshot = () => {
  const list = getWishlist() as string[];
  const key = JSON.stringify(list);
  if (key !== wishCache.key) wishCache = { key, list };
  return wishCache.list;
};
const EMPTY: string[] = [];

export const useCartCount = () =>
  useSyncExternalStore(
    cartSub,
    () => (getCart() as { quantidade: number }[]).reduce((sum, i) => sum + i.quantidade, 0),
    () => 0,
  );
export const useWishlist = () => useSyncExternalStore(wishSub, wishSnapshot, () => EMPTY);

// Verdadeiro só depois da hidratação (para conteúdo que depende do navegador).
const noop = () => () => {};
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);
