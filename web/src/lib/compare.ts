// Comparador: até 4 produtos escolhidos neste navegador (vv_compare). Os botões, a página
// comparar.html e a barra flutuante (components/CompareTray.tsx) leem daqui.
import { useSyncExternalStore } from "react";
import { validId } from "../../../shared/catalog.js";
import { emit } from "./cart";
import { toast } from "./toast";

export const MAX_COMPARE = 4;
const KEY = "vv_compare";
export function getCompare(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data) ? data.filter(validId).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}
export function setCompare(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.filter(validId).slice(0, MAX_COMPARE)));
  } catch {
    toast("Não foi possível salvar a comparação neste navegador.", { type: "error" });
    return false;
  }
  emit("vv:compare", ids);
  return true;
}
export function toggleCompare(id: string) {
  const list = getCompare();
  if (list.includes(id)) {
    setCompare(list.filter((x) => x !== id));
    return false;
  }
  if (list.length >= MAX_COMPARE) {
    toast(`Compare até ${MAX_COMPARE} produtos por vez. Remova um para incluir outro.`, {
      type: "info",
      action: { label: "Ver comparação", onClick: () => (location.href = "/comparar.html") },
    });
    return false;
  }
  setCompare([...list, id]);
  return true;
}

let cache: { key: string; ids: string[] } = { key: "[]", ids: [] };
const snapshot = () => {
  const ids = getCompare();
  const key = JSON.stringify(ids);
  if (key !== cache.key) cache = { key, ids };
  return cache.ids;
};
const subscribe = (notify: () => void) => {
  const onStorage = (e: StorageEvent) => e.key === KEY && notify();
  document.addEventListener("vv:compare", notify);
  addEventListener("storage", onStorage);
  return () => {
    document.removeEventListener("vv:compare", notify);
    removeEventListener("storage", onStorage);
  };
};
const EMPTY: string[] = [];
export const useCompare = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);
export function toggleCompareWithNotice(id: string, name: string) {
  const on = toggleCompare(id);
  if (on)
    toast(`${name} na comparação.`, {
      type: "success",
      action: getCompare().length > 1 ? { label: "Comparar agora", onClick: () => (location.href = "/comparar.html") } : undefined,
    });
}
