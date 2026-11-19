// Testes do frontend (web/src, TypeScript e React) direto no Node: importações sem extensão
// resolvem para .ts/.tsx, o TypeScript e o JSX são convertidos pelo esbuild (o mesmo que o Vite
// usa) e o CSS vira um módulo vazio. Uso: const { addCart } = await web("lib/cart.ts");
import { createRequire, registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const esbuild = createRequire(import.meta.resolve("vite"))("esbuild");
const root = new URL("../../web/src/", import.meta.url).href;
const relative = /^\.{1,2}\//;

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(root) && relative.test(specifier)) {
      if (/\.css$/.test(specifier)) return { url: "data:text/javascript,export%20default%20%7B%7D", shortCircuit: true };
      if (!/\.[cm]?[jt]sx?$/.test(specifier))
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          const url = new URL(specifier + ext, context.parentURL).href;
          if (existsSync(fileURLToPath(url))) return { url, format: "module", shortCircuit: true };
        }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && /\.tsx?$/.test(url)) {
      const file = fileURLToPath(url);
      const { code } = esbuild.transformSync(readFileSync(file, "utf8"), { loader: file.endsWith("x") ? "tsx" : "ts", jsx: "automatic", format: "esm", sourcefile: file, target: "es2022" });
      return { format: "module", source: code, shortCircuit: true };
    }
    return next(url, context);
  },
});

export const web = (path) => import(new URL(path, root).href);
// HTML de um componente React (sem navegador), para conferir marcação e textos.
export async function html(element) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element);
}
