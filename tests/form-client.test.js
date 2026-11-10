import test from "node:test";
import assert from "node:assert/strict";
import { bindForm } from "../public/js/common.js";

function fixture(t) {
  let submit;
  const messages = [];
  const button = { textContent: "Salvar", disabled: false };
  const form = {
    dataset: {},
    elements: { namedItem: () => null },
    addEventListener: (_event, fn) => { submit = fn; },
    querySelectorAll: () => [],
    querySelector: () => button,
    prepend: element => messages.push(element),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({ setAttribute() {} }),
  }});
  t.mock.method(globalThis, "FormData", function () { return new Map([["nome", "Pessoa de teste"]]); });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete globalThis.document;
  });
  return { form, button, messages, submit: () => submit({ preventDefault() {} }) };
}

test("formulário ignora toque repetido durante envio e libera após sucesso", async t => {
  const ui = fixture(t);
  let finish;
  let calls = 0;
  bindForm(ui.form, async data => {
    calls++;
    assert.equal(data.nome, "Pessoa de teste");
    await new Promise(resolve => { finish = resolve; });
  });
  const pending = ui.submit();
  assert.equal(ui.button.disabled, true);
  await ui.submit();
  assert.equal(calls, 1);
  finish();
  await pending;
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.textContent, "Salvar");
  assert.equal(ui.form.dataset.busy, undefined);
});

test("formulário recupera botão após erro e permite nova tentativa", async t => {
  const ui = fixture(t);
  let calls = 0;
  bindForm(ui.form, async () => {
    calls++;
    if (calls === 1) throw new Error("Conexão indisponível");
  });
  await ui.submit();
  assert.equal(ui.messages[0].textContent, "Conexão indisponível");
  assert.equal(ui.button.disabled, false);
  await ui.submit();
  assert.equal(calls, 2);
  assert.equal(ui.button.textContent, "Salvar");
});
