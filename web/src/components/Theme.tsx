import { Icon } from "../lib/icons";
import { setTheme, useTheme, type ThemeMode } from "../lib/theme";

// Botão do cabeçalho: alterna claro/escuro.
export function ThemeToggle() {
  const { dark } = useTheme();
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-pressed={dark}
      aria-label="Tema escuro"
      onClick={(e) => setTheme(dark ? "light" : "dark", e.currentTarget)}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

const OPTIONS: [ThemeMode, "monitor" | "sun" | "moon", string][] = [
  ["auto", "monitor", "Automático"],
  ["light", "sun", "Claro"],
  ["dark", "moon", "Escuro"],
];
// Seletor de aparência (menu e rodapé).
export function ThemeSwitch({ name, compact = false }: { name: string; compact?: boolean }) {
  const { mode } = useTheme();
  return (
    <fieldset className="theme-switch">
      <legend className={compact ? "sr-only" : undefined}>Aparência</legend>
      <div className="theme-options">
        {OPTIONS.map(([value, symbol, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={mode === value}
              onChange={(e) => setTheme(value, e.currentTarget.closest("label"))}
            />
            <span>
              <Icon name={symbol} size={16} />
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
