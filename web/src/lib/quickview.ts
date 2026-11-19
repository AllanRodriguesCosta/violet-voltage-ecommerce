// Visualização rápida a partir dos cartões (components/QuickView.tsx).
import { useSyncExternalStore } from "react";
import type { Product } from "./types";

type Quick = { product: Product | null; opener: HTMLElement | null; seq: number };
let state: Quick = { product: null, opener: null, seq: 0 };
const listeners = new Set<() => void>();
const set = (next: Quick) => {
  state = next;
  listeners.forEach((l) => l());
};
export const openQuickView = (product: Product, opener: HTMLElement | null) => set({ product, opener, seq: state.seq + 1 });
export const closeQuickView = () => state.product && set({ ...state, product: null });
const EMPTY: Quick = { product: null, opener: null, seq: 0 };
export const useQuickView = () =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => state,
    () => EMPTY,
  );
