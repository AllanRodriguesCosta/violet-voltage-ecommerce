import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";

// CSS da loja em web/src/styles (empacotado pelo Vite); páginas em web/*.html e, no build, dist/.
const webDir = new URL("../web/", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const css = await readFile(new URL("src/styles/style.css", webDir), "utf8");

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `bloco ${selector} não encontrado`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\b/gi)].map(([, name, value]) => [name, value]),
  );
}
function luminance(hex) {
  const value = hex.length === 4 ? hex.slice(1).replace(/./g, "$&$&") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Pares de texto e fundo usados pelos componentes (4,5:1); anel de foco e borda de campos (3:1).
const pairs = [
  ["ink", "bg"], ["ink", "surface"], ["ink-2", "surface"], ["muted", "surface"], ["muted", "bg"],
  ["muted", "surface-2"], ["violet", "surface"], ["violet", "bg"], ["violet", "surface-2"],
  ["violet", "violet-soft"], ["violet-strong", "violet-soft"], ["on-accent", "violet"],
  ["on-accent", "violet-strong"], ["on-accent", "ink"], ["on-accent", "success"], ["on-accent", "danger"],
  ["success", "success-soft"], ["warning", "warning-soft"], ["danger", "danger-soft"], ["info", "info-soft"],
  ["success", "surface"], ["danger", "surface"], ["media-ink", "media-bg"],
  ["focus", "surface", 3], ["focus", "bg", 3],
  ["field-line", "surface", 3], ["field-line", "bg", 3], ["field-line", "surface-2", 3],
];

test("tokens de cor mantêm contraste AA nos temas claro e escuro", () => {
  const light = tokens(":root");
  const themes = { claro: light, escuro: { ...light, ...tokens(':root[data-theme="dark"]') } };
  for (const [name, theme] of Object.entries(themes)) {
    for (const [fg, bg, min = 4.5] of pairs) {
      assert.ok(theme[fg] && theme[bg], `tema ${name}: token ausente em ${fg}/${bg}`);
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= min, `tema ${name}: ${fg} sobre ${bg} tem ${ratio.toFixed(2)}:1 (mínimo ${min}:1)`);
    }
  }
});

async function checkPages(dir, { built = false } = {}) {
  const pages = (await readdir(dir)).filter((file) => file.endsWith(".html"));
  assert.ok(pages.length >= 20);
  for (const page of pages) {
    const html = await readFile(new URL(page, dir), "utf8");
    const init = html.indexOf('<script src="/js/theme-init.js"></script>');
    assert.ok(init > 0, `${page} sem theme-init.js`);
    const style = html.search(/<link rel="stylesheet"/);
    // No código-fonte o Vite ainda não injetou o CSS; no build ele vem depois do tema.
    if (built) assert.ok(style > init, `${page} carrega CSS antes do tema`);
    else assert.ok(style === -1 || style > init, `${page} carrega CSS antes do tema`);
  }
}
test("todas as páginas aplicam o tema salvo antes das folhas de estilo", () => checkPages(webDir));
test("build: tema aplicado antes do CSS empacotado", { skip: !existsSync(new URL("index.html", distDir)) && "rode npm run build" }, () => checkPages(distDir, { built: true }));
test("theme-init.js continua um script clássico e pequeno em public/", async () => {
  const init = await readFile(new URL("../public/js/theme-init.js", import.meta.url), "utf8");
  assert.doesNotMatch(init, /^\s*(import|export)\b/m);
  assert.ok(init.length < 1200);
});
