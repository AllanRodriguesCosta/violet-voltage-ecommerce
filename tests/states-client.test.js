import test from "node:test";
import assert from "node:assert/strict";
import { stateHTML, emptyState, errorState } from "../public/js/components.js";
import { fieldMessage } from "../public/js/common.js";

test("estados padronizados usam o nível de título pedido e alerta só em falhas", () => {
  const empty = emptyState({ title: "Nada por aqui." });
  assert.match(empty, /<h2>Nada por aqui\.<\/h2>/);
  assert.doesNotMatch(empty, /role="alert"/);
  const nested = emptyState({ title: "Sem pedidos.", level: 3 });
  assert.match(nested, /<h3>Sem pedidos\.<\/h3>/);
  const error = stateHTML({ tone: "error", title: "Falhou.", level: 1 });
  assert.match(error, /class="empty state-error" role="alert"/);
  assert.match(error, /<h1>Falhou\.<\/h1>/);
});

test("estado de erro escapa a mensagem e oferece nova tentativa e saída quando pedidas", () => {
  const container = { innerHTML: "", querySelector: () => null };
  errorState(container, new Error("<b>indisponível</b>"), null, { back: { href: "/catalogo.html", label: "Voltar ao catálogo" } });
  assert.match(container.innerHTML, /&lt;b&gt;indisponível&lt;\/b&gt;/);
  assert.doesNotMatch(container.innerHTML, /data-retry/);
  assert.match(container.innerHTML, /href="\/catalogo\.html"/);
  let listened = false;
  const withRetry = { innerHTML: "", querySelector: () => ({ addEventListener: () => (listened = true) }) };
  errorState(withRetry, new Error("Falha"), () => {});
  assert.match(withRetry.innerHTML, /data-retry/);
  assert.equal(listened, true);
});

test("mensagens de validação em português, com mensagem própria quando informada", () => {
  const field = (validity, extra = {}) => ({ validity, type: "text", validationMessage: "native", ...extra });
  assert.equal(fieldMessage(field({ valueMissing: true })), "Preencha este campo.");
  assert.equal(fieldMessage(field({ typeMismatch: true }, { type: "email" })), "Informe um e-mail válido, como nome@exemplo.com.");
  assert.equal(fieldMessage(field({ tooShort: true }, { minLength: 10 })), "Use pelo menos 10 caracteres.");
  assert.equal(fieldMessage(field({ rangeOverflow: true }, { max: "3" })), "Informe um valor até 3.");
  assert.equal(fieldMessage(field({ rangeUnderflow: true }, { min: "1" })), "Informe um valor a partir de 1.");
  assert.equal(fieldMessage(field({ valueMissing: true }), "Informe seu nome."), "Informe seu nome.");
});
