// Tema claro, escuro ou automático (segue o sistema), salvo neste navegador.
import { icon } from "./icons.js";

const KEY = "vv_theme";
const MODES = ["auto", "light", "dark"];
// Avaliado sob demanda: este módulo também é importado pelos testes em Node.
const system = () => matchMedia("(prefers-color-scheme: dark)");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function themeMode() {
  try {
    const saved = localStorage.getItem(KEY);
    return MODES.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}
const resolve = (mode) => (mode === "dark" || (mode === "auto" && system().matches) ? "dark" : "light");

function paint(mode) {
  const theme = resolve(mode);
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.innerHTML = icon(theme === "dark" ? "sun" : "moon");
  });
  document.querySelectorAll("input[data-theme-option]").forEach((input) => {
    input.checked = input.value === mode;
  });
}

export function themeSwitchHTML(name, { compact = false } = {}) {
  const options = [
    ["auto", "monitor", "Automático"],
    ["light", "sun", "Claro"],
    ["dark", "moon", "Escuro"],
  ];
  return `<fieldset class="theme-switch"><legend${compact ? ' class="sr-only"' : ""}>Aparência</legend><div class="theme-options">${options
    .map(
      ([value, symbol, label]) =>
        `<label><input type="radio" name="${name}" value="${value}" data-theme-option><span>${icon(symbol, { size: 16 })}${label}</span></label>`,
    )
    .join("")}</div></fieldset>`;
}

// Troca com revelação circular a partir do controle usado, quando o navegador permite.
export function setTheme(mode, origin) {
  try {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    // O tema muda nesta página mesmo sem armazenamento local.
  }
  const root = document.documentElement;
  if (!origin || !document.startViewTransition || reduced() || resolve(mode) === root.dataset.theme) {
    paint(mode);
    return;
  }
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theme-switching");
  const transition = document.startViewTransition(() => paint(mode));
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 480, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove("theme-switching"));
}

export function initTheme() {
  paint(themeMode());
  system().addEventListener("change", () => {
    if (themeMode() === "auto") paint("auto");
  });
  addEventListener("storage", (event) => {
    if (event.key === KEY) paint(themeMode());
  });
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-theme-toggle]");
    if (toggle) setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", toggle);
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches?.("input[data-theme-option]"))
      setTheme(event.target.value, event.target.closest("label"));
  });
}
