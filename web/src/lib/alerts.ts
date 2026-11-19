// "Avise-me quando chegar" (itens esgotados), guardado na conta. Estado compartilhado entre
// os botões da página e atualizado sem recarregar.
import { useSyncExternalStore } from "react";
import { api, send, toast } from "./shop";
import { loadSession } from "./session";

let active = new Set<string>();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  active = new Set(active);
  listeners.forEach((l) => l());
};
function ensure() {
  loaded ??= loadSession().then(async (user) => {
    if (!user) return;
    try {
      const list = (await api("/alerts")) as { productId: string; notifiedAt?: string; tipo?: string }[];
      active = new Set(list.filter((a) => !a.notifiedAt && a.tipo !== "preco").map((a) => a.productId));
      changed();
    } catch {
      // Sem a lista, os botões começam desligados.
    }
  });
}
const EMPTY = new Set<string>();
export function useStockAlerts() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      ensure();
      return () => listeners.delete(notify);
    },
    () => active,
    () => EMPTY,
  );
}
export async function toggleStockAlert(id: string) {
  const user = await loadSession();
  if (!user) {
    toast("Entre na sua conta para receber o aviso quando voltar ao estoque.", {
      action: { label: "Entrar", onClick: () => (location.href = `/login.html?next=${encodeURIComponent(`/produto.html?id=${id}`)}`) },
    });
    return;
  }
  const on = active.has(id);
  try {
    if (on) {
      await send(`/alerts/${encodeURIComponent(id)}`, {}, "DELETE");
      active.delete(id);
      toast("Aviso cancelado.", { type: "info", action: { label: "Desfazer", onClick: () => toggleStockAlert(id) } });
    } else {
      await send("/alerts", { productId: id });
      active.add(id);
      toast("Pronto! Avisamos em Minha conta quando voltar ao estoque.", {
        type: "success",
        action: { label: "Ver avisos", onClick: () => (location.href = "/minha-conta.html#avisos") },
      });
    }
    changed();
  } catch (error) {
    toast((error as Error).message, { type: "error" });
  }
}
