import test from "node:test";
import assert from "node:assert/strict";
import { addCart, getCart } from "../public/js/common.js";

function browser(t, failWrite = false) {
  let saved = "[]";
  const notice = { textContent: "", hidden: true };
  t.mock.method(globalThis, "setTimeout", () => 0);
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => saved,
    setItem: (_key, value) => { if (failWrite) throw new Error("Storage blocked"); saved = value; },
  }});
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    querySelector: selector => selector === "#toast" ? notice : null,
  }});
  t.after(() => {
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else delete globalThis.localStorage;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
  });
  return notice;
}

test("carrinho cliente rejeita quantidade inválida e excesso acumulado sem alterar itens", t => {
  browser(t);
  const product = { id: "demo-001", estoque: 3 };
  for (const quantity of [0, -1, 1.5, NaN, 100]) assert.equal(addCart(product, quantity), false);
  assert.deepEqual(getCart(), []);
  assert.equal(addCart(product, 2), true);
  assert.equal(addCart(product, 2), false);
  assert.deepEqual(getCart(), [{ id: "demo-001", quantidade: 2 }]);
});

test("carrinho cliente não anuncia sucesso quando armazenamento está bloqueado", t => {
  const notice = browser(t, true);
  assert.equal(addCart({ id: "demo-001", estoque: 3 }), false);
  assert.match(notice.textContent, /Não foi possível salvar/);
  assert.deepEqual(getCart(), []);
});

test("carrinho cliente impede item esgotado e acumula unidades até o limite", t => {
  browser(t);
  assert.equal(addCart({ id: "demo-002", estoque: 0 }), false);
  const product = { id: "demo-001", estoque: 2 };
  assert.equal(addCart(product), true);
  assert.equal(addCart(product), true);
  assert.equal(addCart(product), false);
  assert.deepEqual(getCart(), [{ id: "demo-001", quantidade: 2 }]);
});
