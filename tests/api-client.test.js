import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../public/js/common.js";

test("API cliente rejeita sucesso malformado e permite nova tentativa válida", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json(calls === 1 ? null : { data: [{ id: "demo-001" }] });
  });
  await assert.rejects(api("/products"), /dados incompletos/);
  assert.deepEqual(await api("/products"), [{ id: "demo-001" }]);
});

test("API cliente apresenta mensagem útil em falha de rede", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api("/products"), /Verifique sua conexão/);
});

test("API cliente trata resposta HTML do provedor sem expor seu conteúdo", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>unavailable</html>", { status: 503 }));
  await assert.rejects(api("/orders"), error => error.status === 503 && /Tente novamente/.test(error.message));
});

test("API cliente preserva status e campo de erro para validação de formulário", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "Nome obrigatório", field: "nome" } }, { status: 400 }));
  await assert.rejects(api("/profile"), error => error.status === 400 && error.field === "nome" && error.message === "Nome obrigatório");
});
