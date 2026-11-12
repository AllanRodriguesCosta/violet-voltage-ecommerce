// Perguntas e respostas na página do produto: lista das respondidas e formulário para quem
// está logado. A loja responde pelo painel; a resposta também chega nas notificações.
import { icon } from "./icons.js";
import { api, send, escapeHtml as esc, sessionReady, bindForm } from "./common.js";

const when = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
export async function mountQuestions(product) {
  const section = document.querySelector("#perguntas");
  if (!section) return;
  let list = [];
  try {
    list = await api(`/products/${encodeURIComponent(product.id)}/questions`);
  } catch {
    list = [];
  }
  const user = await sessionReady;
  const next = encodeURIComponent(`/produto.html?id=${product.id}#perguntas`);
  section.innerHTML = `<div class="section-head"><div><span class="eyebrow">Dúvidas sobre este equipamento</span><h2 id="qa-title">Perguntas e respostas</h2></div></div><div class="qa-layout"><div class="qa-list">${
    list.length
      ? `<ul class="qa-items">${list
          .map((q) => `<li class="qa-item"><p class="qa-question">${icon("question", { size: 18 })}<span>${esc(q.pergunta)}<small>${esc(q.autor)} · ${when(q.createdAt)}</small></span></p><p class="qa-answer"><strong>Resposta da Violet Voltage</strong>${esc(q.resposta)}<small>${when(q.respondidaEm)}</small></p></li>`)
          .join("")}</ul>`
      : `<p class="muted qa-empty">Ainda não há perguntas respondidas sobre este produto. Seja o primeiro a perguntar.</p>`
  }</div><div class="panel qa-ask">${
    user
      ? `<form id="qa-form" novalidate><label for="qa-text">Faça uma pergunta</label><textarea id="qa-text" name="pergunta" rows="4" minlength="10" maxlength="500" required aria-describedby="qa-help"></textarea><p class="form-help" id="qa-help">De 10 a 500 caracteres. A equipe responde aqui na página e você recebe um aviso nas notificações. Não inclua dados pessoais.</p><button type="submit">${icon("send", { size: 18 })}Enviar pergunta</button></form><p class="qa-sent" role="status"></p>`
      : `<p><strong>Ficou com alguma dúvida?</strong></p><p class="muted">Entre na sua conta para perguntar. A resposta aparece aqui e nas suas notificações.</p><a class="button secondary" href="/login.html?next=${next}">Entrar para perguntar</a>`
  }</div></div>`;
  section.hidden = false;
  const form = section.querySelector("#qa-form");
  if (form)
    bindForm(
      form,
      async (data) => {
        await send(`/products/${encodeURIComponent(product.id)}/questions`, { pergunta: data.pergunta });
        form.reset();
        section.querySelector(".qa-sent").textContent = "Pergunta enviada! Avisamos nas suas notificações quando a loja responder.";
      },
      { messages: { pergunta: "Escreva sua pergunta com pelo menos 10 caracteres." } },
    );
  if (location.hash === "#perguntas") section.scrollIntoView();
}
