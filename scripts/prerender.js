// Etapa 39: grava o HTML inicial de cada página React em dist/<pagina>.html, dentro de
// <div id="root">. Roda depois de "vite build" e "vite build --ssr" (npm run build).
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const ssr = fileURLToPath(new URL("../dist-ssr/prerender.js", import.meta.url));
// O pré-render roda em Node: os módulos que leem o navegador só agem depois da hidratação.
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { names, render } = await import(pathToFileURL(ssr).href);
for (const name of names) {
  const file = `${dist}${name}.html`;
  const html = await readFile(file, "utf8");
  if (!html.includes('<div id="root"></div>')) throw new Error(`${name}.html sem <div id="root"></div>`);
  await writeFile(file, html.replace('<div id="root"></div>', `<div id="root">${render(name)}</div>`));
}
await rm(fileURLToPath(new URL("../dist-ssr/", import.meta.url)), { recursive: true, force: true });
console.log(`Pré-render: ${names.length} página(s) em dist/.`);
