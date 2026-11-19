// Minicarrinho (components/CartDrawer.tsx): aberto pelo ícone do carrinho, pelos kits, pelo
// montador, pelo assistente e por "Comprar novamente". Estado simples fora do React para poder
// ser aberto de qualquer lugar.
import { useSyncExternalStore } from "react";

type Drawer = { open: boolean; message: string; seq: number };
let state: Drawer = { open: false, message: "", seq: 0 };
const listeners = new Set<() => void>();
const set = (next: Drawer) => {
  state = next;
  listeners.forEach((l) => l());
};
export function openCart(message = "") {
  set({ open: true, message, seq: state.seq + 1 });
}
export function closeCart() {
  if (state.open) set({ ...state, open: false });
}
const CLOSED: Drawer = { open: false, message: "", seq: 0 };
export const useDrawer = () =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => state,
    () => CLOSED,
  );
