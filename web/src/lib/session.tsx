// Sessão do visitante: verificada uma vez por página e compartilhada pelos componentes.
// undefined = falha ao verificar; null = sem login. Com login, liga o carrinho salvo na conta
// e o contador de notificações não lidas.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { startCartSync } from "./cart";
import { setUnread } from "./notifications";
import { toast } from "./toast";
import type { User } from "./types";

type Session = { loading: boolean; user: User | null | undefined };
const SessionContext = createContext<Session>({ loading: true, user: null });

let request: Promise<User | null | undefined> | null = null;
export function loadSession() {
  request ??= api<User | null>("/auth/session").then(
    (user) => {
      if (user) {
        setUnread(user.naoLidas || 0);
        startCartSync(user);
      }
      return user;
    },
    () => {
      toast("Não foi possível verificar sua sessão.", { type: "error" });
      return undefined;
    },
  );
  return request;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Session>({ loading: true, user: null });
  useEffect(() => {
    let alive = true;
    loadSession().then((user) => alive && setState({ loading: false, user }));
    return () => {
      alive = false;
    };
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
