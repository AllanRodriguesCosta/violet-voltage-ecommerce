import { normalize } from "../common.js";
import { emptyState } from "../components.js";

export default function help() {
  const input = document.querySelector("#faq-q");
  const items = [...document.querySelectorAll(".faq-item")];
  const status = document.querySelector("#faq-status");
  const empty = document.querySelector("#faq-empty");
  const openFromHash = () => {
    // getElementById aceita qualquer âncora; sem âncora não há grupo para abrir.
    const group = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (group?.classList.contains("faq-group")) group.querySelector(".faq-item")?.setAttribute("open", "");
  };
  input.addEventListener("input", () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const match = terms.every((t) => normalize(item.textContent).includes(t));
      item.hidden = !match;
      item.open = terms.length > 0 && match;
      if (match) shown++;
    }
    document.querySelectorAll(".faq-group").forEach((g) => (g.hidden = !g.querySelector(".faq-item:not([hidden])")));
    status.textContent = terms.length ? `${shown} ${shown === 1 ? "resposta encontrada" : "respostas encontradas"}.` : "";
    empty.hidden = shown > 0;
    empty.innerHTML = shown ? "" : emptyState({ title: "Nenhuma resposta com esses termos.", text: "Tente palavras como frete, parcelas, cupom ou troca." });
  });
  input.closest("form").addEventListener("submit", (event) => event.preventDefault());
  addEventListener("hashchange", openFromHash);
  openFromHash();
}
