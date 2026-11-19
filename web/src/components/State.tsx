// Estados padronizados (vazio, erro, sucesso e informação); alerta só para falhas.
import { createElement, type ReactNode } from "react";
import { Icon, type IconName } from "../lib/icons";

type Tone = "empty" | "error" | "success" | "info";
const SYMBOLS: Record<Tone, IconName> = { empty: "search", error: "alert", success: "check", info: "info" };
type Props = { tone?: Tone; symbol?: IconName; title: ReactNode; text?: ReactNode; actions?: ReactNode; level?: 1 | 2 | 3 };

export function State({ tone = "empty", symbol, title, text, actions, level = 2 }: Props) {
  return (
    <div className={`empty state-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon name={symbol ?? SYMBOLS[tone]} size={30} />
      {createElement(`h${level}`, null, title)}
      {text && <p>{text}</p>}
      {actions && <div className="row center">{actions}</div>}
    </div>
  );
}
// Falha com explicação e nova tentativa.
export function ErrorState({ error, retry, title = "Não foi possível carregar.", level = 2 }: { error: Error; retry?: () => void; title?: string; level?: 1 | 2 | 3 }) {
  return (
    <State
      tone="error"
      title={title}
      text={error.message}
      level={level}
      actions={
        retry && (
          <button type="button" onClick={retry}>
            Tentar novamente
          </button>
        )
      }
    />
  );
}
