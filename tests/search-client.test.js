import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, correctQuery, searchProducts, rememberSearch, recentSearches, clearSearches } from "../public/js/common.js";
import { seedProducts } from "../src/services/seed-products.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey }));

test("distância de edição considera troca de letras vizinhas", () => {
  assert.equal(editDistance("pedal", "pedal"), 0);
  assert.equal(editDistance("pedla", "pedal"), 1);
  assert.equal(editDistance("guitara", "guitarra"), 1);
  assert.equal(editDistance("berhinger", "behringer"), 1);
});

test("busca sugere correção só quando o termo não acha nada e a correção acha", () => {
  assert.equal(searchProducts(products, "amplificaor").length, 0);
  assert.equal(correctQuery(products, "amplificaor"), "amplificador");
  assert.equal(correctQuery(products, "berhinger"), "behringer");
  assert.ok(searchProducts(products, correctQuery(products, "valvulao")).some((p) => p.modelo === "AC15 Valvulado"));
  assert.equal(correctQuery(products, "xyzxyz"), null);
  assert.equal(correctQuery(products, "pedal"), null, "termo certo não é trocado");
  assert.equal(correctQuery(products, "ped"), null, "prefixo curto não é tratado como erro");
});

test("buscas recentes: sem repetição, até cinco e limpeza", (t) => {
  let saved = null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => saved, setItem: (_k, v) => (saved = v), removeItem: () => (saved = null) },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  for (const q of ["pedal", "Guitarra", "a", "cabo", "PEDAL", "amp", "correia", "suporte"]) rememberSearch(q);
  assert.deepEqual(recentSearches(), ["suporte", "correia", "amp", "PEDAL", "cabo"]);
  clearSearches();
  assert.deepEqual(recentSearches(), []);
});
