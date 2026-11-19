// Comportamentos globais do navegador, ligados uma vez por página em mount.tsx (nunca no
// pré-render): imagem substituta quando uma foto falha e aviso de conexão. O pré-carregamento
// das páginas vem do servidor (cabeçalho Speculation-Rules, ver shared/speculation.js).
import { toast } from "./toast";

// Foto que não carregou (arquivo ausente, link quebrado) vira a ilustração da categoria, em vez
// do ícone de imagem quebrada. data-fallback no <img> escolhe outra ilustração.
export const FALLBACK_IMAGE = "/assets/product.svg";

export function replaceBrokenImage(img: HTMLImageElement) {
  const fallback = img.dataset.fallback || FALLBACK_IMAGE;
  if (img.dataset.broken || img.getAttribute("src") === fallback) return false;
  img.dataset.broken = "1";
  img.src = fallback;
  return true;
}

export function imageFallbacks(doc: Document = document) {
  doc.addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLImageElement) replaceBrokenImage(event.target);
    },
    true,
  );
  // Fotos do HTML pré-renderizado que falharam antes do JavaScript chegar.
  for (const img of Array.from(doc.images)) if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) replaceBrokenImage(img);
}

// Aviso quando a conexão cai e volta (o service worker segura as páginas já visitadas).
export function connectionNotices(win: Window = window) {
  win.addEventListener("offline", () => toast("Você está sem conexão. As páginas já visitadas continuam disponíveis.", { type: "error" }));
  win.addEventListener("online", () => toast("Conexão restabelecida.", { type: "success" }));
}
