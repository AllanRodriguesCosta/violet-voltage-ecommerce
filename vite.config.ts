// Frontend em React + TypeScript (migração em etapas). Cada página da loja continua sendo um
// arquivo .html próprio (mesmos endereços, SEO feito no servidor e leitura pelo Agent_generator):
// o Vite gera uma entrada por página em dist/ e o pré-render (scripts/prerender.js) grava o HTML
// inicial de cada uma, que o React "hidrata" no navegador.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./web", import.meta.url));
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(/\.html$/, ""), `${root}/${f}`]),
);

// React, React DOM e scheduler ficam num arquivo próprio (app/react-HASH.js): mudam pouco, então
// o navegador reaproveita o cache entre publicações e só baixa de novo o código da loja.
const vendor = /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/;

export default defineConfig(({ isSsrBuild }) => ({
  root,
  plugins: [react()],
  // Fontes, ícones e imagens continuam em public/ e são servidos pelo Express.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "app",
    target: "es2022",
    rollupOptions: {
      input: pages,
      output: isSsrBuild ? {} : { manualChunks: (id: string) => (vendor.test(id) ? "react" : undefined) },
    },
  },
}));
