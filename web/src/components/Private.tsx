// Páginas que exigem login (checkout, pedido, minha conta): enquanto a sessão é verificada (e no
// pré-render) mostram o estado de carregamento; sem login, seguem para /login.html?next=...; se
// a verificação falhou, explicam e oferecem nova tentativa (mesmo painel de requireUser).
import { useEffect, type ReactNode } from "react";
import { useSession } from "../lib/session";
import type { User } from "../lib/shop";
import { safeNext } from "../../../shared/account.js";
import { State } from "./State";

export type AccountUser = User & {
  telefone?: string;
  endereco?: string;
  enderecos?: Address[];
  pagamento?: { metodo: string; parcelas?: number } | null;
};
export type Address = {
  id: string;
  apelido?: string;
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  principal?: boolean;
};

export function SessionFailed() {
  return (
    <section className="panel container state-panel">
      <h1>Não foi possível verificar sua sessão</h1>
      <p>Confira sua conexão e tente novamente. Seus dados não foram alterados.</p>
      <div className="row">
        <button type="button" id="retry-session" onClick={() => location.reload()}>
          Tentar novamente
        </button>
        <a className="button secondary" href="/">
          Voltar à loja
        </a>
      </div>
    </section>
  );
}

export function loginUrl() {
  const here = location.pathname + location.search + location.hash;
  return `/login.html?next=${encodeURIComponent(safeNext(here) ?? location.pathname)}`;
}

export function Private({ loading, children }: { loading: ReactNode; children: (user: AccountUser) => ReactNode }) {
  const { loading: checking, user } = useSession();
  useEffect(() => {
    if (!checking && user === null) location.href = loginUrl();
  }, [checking, user]);
  if (checking || user === null) return <>{loading}</>;
  if (user === undefined) return <SessionFailed />;
  return <>{children(user as AccountUser)}</>;
}

// Falha ao carregar, com nova tentativa (quando faz sentido) e um caminho de saída.
export function LoadError({
  error,
  retry,
  back,
  title = "Não foi possível carregar.",
  text,
  level = 2,
}: {
  error: Error;
  retry?: (() => void) | null;
  back?: { href: string; label: string };
  title?: string;
  text?: string;
  level?: 1 | 2 | 3;
}) {
  return (
    <State
      tone="error"
      title={title}
      text={text ?? error.message}
      level={level}
      actions={
        (retry || back) && (
          <>
            {retry && (
              <button type="button" data-retry onClick={retry}>
                Tentar novamente
              </button>
            )}
            {back && (
              <a className="button secondary" href={back.href}>
                {back.label}
              </a>
            )}
          </>
        )
      }
    />
  );
}

export const Loading = ({ text = "Carregando…" }: { text?: string }) => (
  <div className="loading" role="status">
    {text}
  </div>
);
