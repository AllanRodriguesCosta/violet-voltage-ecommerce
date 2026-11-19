// "Avisar se baixar o preço" (qualquer produto ativo), guardado na conta. Estado compartilhado
// pelos botões da página (produto, favoritos, visualização rápida) e atualizado sem recarregar.
import { useSyncExternalStore } from "react";
import { api, send } from "./api";
import { toast } from "./toast";
import { loadSession } from "./session";

let active = new Set<string>();
let loaded: Promise<Set<string>> | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  active = new Set(active);
  listeners.forEach((l) => l());
};
// Avisos de preço ativos da conta (uma consulta por página; vazio sem login).
export function watchedPrices(): Promise<Set<string>> {
  loaded ??= loadSession().then(async (user) => {
    if (user)
      try {
        const list = await api<{ productId: string; notifiedAt?: string; tipo?: string }[]>("/alerts");
        active = new Set(list.filter((a) => !a.notifiedAt && a.tipo === "preco").map((a) => a.productId));
        changed();
      } catch {
        // Sem a lista, os botões começam desligados.
      }
    return active;
  });
  return loaded.then(() => active);
}
export async function setPriceAlert(id: string, on: boolean) {
  await watchedPrices();
  if (on) await send("/alerts", { productId: id, tipo: "preco" });
  else await send(`/alerts/${encodeURIComponent(id)}?tipo=preco`, {}, "DELETE");
  if (on) active.add(id);
  else active.delete(id);
  changed();
}
export const refreshPriceAlerts = () => watchedPrices().then(() => undefined);
const EMPTY = new Set<string>();
export function usePriceAlerts() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      watchedPrices();
      return () => listeners.delete(notify);
    },
    () => active,
    () => EMPTY,
  );
}
export async function togglePriceAlert(id: string) {
  if (!(await loadSession())) {
    toast("Entre na sua conta para receber o aviso quando o preço baixar.", {
      action: { label: "Entrar", onClick: () => (location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`) },
    });
    return;
  }
  const on = (await watchedPrices()).has(id);
  try {
    await setPriceAlert(id, !on);
    toast(on ? "Aviso de preço cancelado." : "Pronto! Avisamos em Minha conta se o preço baixar.", {
      type: on ? "info" : "success",
      action: on ? undefined : { label: "Ver avisos", onClick: () => (location.href = "/minha-conta.html#avisos") },
    });
  } catch (error) {
    toast((error as Error).message, { type: "error" });
  }
}
