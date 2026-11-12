import { normalize } from "../common.js";

// Busca no glossário (sem acento e sem diferenciar maiúsculas) e destaque do termo do link.
export default function guidesPage() {
  const input = document.querySelector("#glossary-q");
  const status = document.querySelector("#glossary-status");
  const terms = [...document.querySelectorAll(".glossary-list .term")];
  input?.addEventListener("input", () => {
    const q = normalize(input.value.trim());
    let shown = 0;
    for (const term of terms) {
      const match = !q || normalize(`${term.dataset.terms} ${term.textContent}`).includes(q);
      term.hidden = !match;
      if (match) shown++;
    }
    status.textContent = q ? (shown ? `${shown} ${shown === 1 ? "termo encontrado" : "termos encontrados"}.` : "Nenhum termo encontrado. Tente outra palavra.") : "";
  });
  const highlight = () => {
    document.querySelectorAll(".term.is-target").forEach((t) => t.classList.remove("is-target"));
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target?.classList.contains("term")) {
      // Link para um termo limpa a busca para o termo aparecer no contexto do glossário.
      if (input?.value) {
        input.value = "";
        input.dispatchEvent(new Event("input"));
      }
      target.classList.add("is-target");
    }
  };
  addEventListener("hashchange", highlight);
  highlight();
}
