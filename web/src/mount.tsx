// Monta uma página: hidrata o HTML pré-renderizado (ou renderiza do zero, se não houver).
import { StrictMode, type ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Layout } from "./components/Layout";
import { connectionNotices, imageFallbacks } from "./lib/browser";
import "./styles/style.css";
import "./styles/ui.css";
import "./styles/react.css";

export function mount(Page: ComponentType) {
  const html = document.documentElement;
  html.classList.add("js");
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) html.classList.add("motion");
  const root = document.getElementById("root")!;
  const app = (
    <StrictMode>
      <Layout>
        <Page />
      </Layout>
    </StrictMode>
  );
  if (root.firstElementChild) hydrateRoot(root, app);
  else createRoot(root).render(app);
  // Depois da hidratação, para não alterar o HTML que o React ainda está conferindo.
  setTimeout(() => {
    imageFallbacks();
    connectionNotices();
  });
}
