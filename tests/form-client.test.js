// Formulários em React (components/Form.tsx e FormKit.tsx): a trava de envio ignora o toque
// repetido durante o envio e libera o botão depois do sucesso ou do erro (como o bindForm anterior).
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { web, html } from "./helpers/web.js";

const { createSubmitGuard } = await web("lib/submit.ts");
const { SubmitButton } = await web("components/FormKit.tsx");

function fixture() {
  const states = [];
  const guard = createSubmitGuard((busy) => states.push(busy));
  return { guard, states };
}

test("formulário ignora toque repetido durante envio e libera após sucesso", async () => {
  const ui = fixture();
  let finish;
  let calls = 0;
  const handler = async () => {
    calls++;
    await new Promise((resolve) => {
      finish = resolve;
    });
  };
  const pending = ui.guard.run(handler);
  assert.equal(ui.guard.busy, true);
  assert.deepEqual(ui.states, [true], "botão desabilitado (Aguarde…)");
  assert.deepEqual(await ui.guard.run(handler), { status: "skipped" });
  assert.equal(calls, 1);
  finish();
  assert.deepEqual(await pending, { status: "done" });
  assert.equal(ui.guard.busy, false);
  assert.deepEqual(ui.states, [true, false], "botão volta ao normal");
});

test("formulário recupera botão após erro e permite nova tentativa", async () => {
  const ui = fixture();
  let calls = 0;
  const handler = async () => {
    calls++;
    if (calls === 1) throw new Error("Conexão indisponível");
  };
  const first = await ui.guard.run(handler);
  assert.equal(first.status, "failed");
  assert.equal(first.error.message, "Conexão indisponível", "a mensagem aparece no formulário");
  assert.equal(ui.guard.busy, false);
  assert.deepEqual(await ui.guard.run(handler), { status: "done" });
  assert.equal(calls, 2);
});

test("botão de envio mostra Aguarde… e fica desabilitado só durante o envio", async () => {
  const idle = await html(createElement(SubmitButton, { kit: { busy: false } }, "Salvar"));
  assert.equal(idle, '<button type="submit">Salvar</button>');
  const busy = await html(createElement(SubmitButton, { kit: { busy: true } }, "Salvar"));
  assert.match(busy, /disabled=""/);
  assert.match(busy, /class="is-busy"/);
  assert.match(busy, />Aguarde…</);
});
