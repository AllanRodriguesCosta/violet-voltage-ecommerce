// Estados padronizados em React (components/State.tsx e LoadError em Private.tsx) e mensagens
// de validação em português (shared/forms.js).
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { fieldMessage } from "../shared/forms.js";
import { web, html } from "./helpers/web.js";

const { State } = await web("components/State.tsx");
const { LoadError } = await web("components/Private.tsx");

test("estados padronizados usam o nível de título pedido e alerta só em falhas", async () => {
  const empty = await html(createElement(State, { title: "Nada por aqui." }));
  assert.match(empty, /<h2>Nada por aqui\.<\/h2>/);
  assert.doesNotMatch(empty, /role="alert"/);
  const nested = await html(createElement(State, { title: "Sem pedidos.", level: 3 }));
  assert.match(nested, /<h3>Sem pedidos\.<\/h3>/);
  const error = await html(createElement(State, { tone: "error", title: "Falhou.", level: 1 }));
  assert.match(error, /class="empty state-error" role="alert"/);
  assert.match(error, /<h1>Falhou\.<\/h1>/);
});

test("estado de erro escapa a mensagem e oferece nova tentativa e saída quando pedidas", async () => {
  const back = await html(createElement(LoadError, { error: new Error("<b>indisponível</b>"), back: { href: "/catalogo.html", label: "Voltar ao catálogo" } }));
  assert.match(back, /&lt;b&gt;indisponível&lt;\/b&gt;/);
  assert.doesNotMatch(back, /data-retry/);
  assert.match(back, /href="\/catalogo\.html"/);
  const withRetry = await html(createElement(LoadError, { error: new Error("Falha"), retry: () => {} }));
  assert.match(withRetry, /data-retry/);
  assert.match(withRetry, /Tentar novamente/);
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
