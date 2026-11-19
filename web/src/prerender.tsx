// Entrada do pré-render (Vite SSR): HTML inicial de cada página, gravado em dist/ no build.
// Buscadores, prévias de link e o Agent_generator leem esse HTML sem executar JavaScript.
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { Layout } from "./components/Layout";
import { bare, pages } from "./pages";

export const names = Object.keys(pages);
export function render(name: string) {
  const Page = pages[name];
  if (!Page) throw new Error(`Página sem componente: ${name}`);
  if (bare.has(name)) return renderToString(<Page />);
  return renderToString(
    <StrictMode>
      <Layout>
        <Page />
      </Layout>
    </StrictMode>,
  );
}
