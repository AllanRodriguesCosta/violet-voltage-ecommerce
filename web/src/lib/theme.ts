// Tema claro, escuro ou automático (chave vv_theme, a mesma lida por public/js/theme-init.js).
import { useSyncExternalStore } from "react";

export type ThemeMode = "auto" | "light" | "dark";
const KEY = "vv_theme";
const MODES: ThemeMode[] = ["auto", "light", "dark"];
const system = () => matchMedia("(prefers-color-scheme: dark)");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function themeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY) as ThemeMode | null;
    return saved && MODES.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}
const resolve = (mode: ThemeMode) => (mode === "dark" || (mode === "auto" && system().matches) ? "dark" : "light");
const listeners = new Set<() => void>();
const paint = (mode: ThemeMode) => {
  document.documentElement.dataset.theme = resolve(mode);
  listeners.forEach((l) => l());
};

export function setTheme(mode: ThemeMode, origin?: Element | null) {
  try {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    // Sem armazenamento local, o tema muda só nesta página.
  }
  const root = document.documentElement;
  if (!origin || !document.startViewTransition || reduced() || resolve(mode) === root.dataset.theme) {
    paint(mode);
    return;
  }
  // Revelação circular a partir do controle usado.
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

function subscribe(notify: () => void) {
  listeners.add(notify);
  const media = system();
  const onMedia = () => themeMode() === "auto" && paint("auto");
  const onStorage = (e: StorageEvent) => e.key === KEY && paint(themeMode());
  media.addEventListener("change", onMedia);
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    media.removeEventListener("change", onMedia);
    removeEventListener("storage", onStorage);
  };
}
type ThemeState = { mode: ThemeMode; dark: boolean };
let cache: ThemeState = { mode: "auto", dark: false };
const snapshot = () => {
  const mode = themeMode();
  const dark = document.documentElement.dataset.theme === "dark";
  if (mode !== cache.mode || dark !== cache.dark) cache = { mode, dark };
  return cache;
};
const SERVER: ThemeState = { mode: "auto", dark: false };
export const useTheme = () => useSyncExternalStore(subscribe, snapshot, () => SERVER);
