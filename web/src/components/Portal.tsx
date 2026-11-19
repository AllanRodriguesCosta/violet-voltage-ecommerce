// Recursos globais (minicarrinho, avisos, assistente, visualização rápida, barra de comparação)
// ficam direto no <body>, como antes: sobrepõem a página e o painel do assistente pode deixar o
// resto da página inerte. Só existem depois da hidratação (o pré-render não tem <body>).
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "../lib/store";

export function BodyPortal({ children }: { children: ReactNode }) {
  return useHydrated() ? createPortal(children, document.body) : null;
}
