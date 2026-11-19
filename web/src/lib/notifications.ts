// Notificações não lidas da conta: o número vem da sessão (naoLidas) e muda quando a pessoa lê
// ou apaga notificações em Minha conta. O cabeçalho e a navegação inferior leem daqui.
import { useSyncExternalStore } from "react";

let unread = 0;
const listeners = new Set<() => void>();
export function setUnread(count: number) {
  const next = Math.max(0, Math.floor(Number(count) || 0));
  if (next === unread) return;
  unread = next;
  listeners.forEach((l) => l());
}
export const getUnread = () => unread;
export const useUnread = () =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => unread,
    () => 0,
  );
