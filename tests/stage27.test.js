// Etapa 27: menu da conta no cabeçalho, Minha conta em seções e forma de pagamento preferida.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storeFixture } from "./helpers/api-fixture.js";
import { accountSections, safeNext, initials } from "../public/js/common.js";
import { routeFromHash, paymentText } from "../public/js/pages/account.js";

test("forma de pagamento preferida: valida, guarda só método e parcelas e vale na sessão", async (t) => {
  const { call, register } = await storeFixture(t);
  assert.equal((await call("/account/payment", { method: "PATCH", body: { metodo: "pix" } })).status, 401);
  const ana = await register("ana@s27.test");
  assert.equal((await call("/auth/session", { method: "GET", cookie: ana })).body.data.pagamento, null);

  const bad = await call("/account/payment", { method: "PATCH", cookie: ana, body: { metodo: "cheque" } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.field, "metodo");
  const tooMany = await call("/account/payment", { method: "PATCH", cookie: ana, body: { metodo: "cartao", parcelas: 11 } });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.error.field, "parcelas");

  const card = await call("/account/payment", { method: "PATCH", cookie: ana, body: { metodo: "cartao", parcelas: 6, numero: "4111111111111111", cvv: "123" } });
  assert.equal(card.status, 200);
  assert.deepEqual(card.body.data.pagamento, { metodo: "cartao", parcelas: 6 }, "nada além de método e parcelas");
  const pix = await call("/account/payment", { method: "PATCH", cookie: ana, body: { metodo: "pix", parcelas: 8 } });
  assert.deepEqual(pix.body.data.pagamento, { metodo: "pix", parcelas: 1 }, "parcelas só no cartão");

  const session = await call("/auth/session", { method: "GET", cookie: ana });
  assert.deepEqual(session.body.data.pagamento, { metodo: "pix", parcelas: 1 });
  const exported = await call("/account/export", { method: "GET", cookie: ana });
  assert.deepEqual(exported.body.conta.pagamento, { metodo: "pix", parcelas: 1 }, "entra na cópia dos dados");
  assert.doesNotMatch(JSON.stringify(exported.body), /4111|cvv/i);
});

test("excluir a conta apaga a forma de pagamento preferida", async (t) => {
  const { call, storage } = await storeFixture(t);
  const senha = "senha-da-bia-2026";
  const bia = (await call("/auth/register", { body: { nome: "Bia Teste", email: "bia@s27.test", senha } })).cookie;
  await call("/account/payment", { method: "PATCH", cookie: bia, body: { metodo: "boleto" } });
  assert.equal((await call("/account/delete", { cookie: bia, body: { senha } })).status, 200);
  const [stored] = (await storage.list("customers")).filter((c) => c.rowKey !== "admin@loja.test");
  assert.equal(stored.pagamento, null);
});

test("menu da conta: cada atalho leva a uma seção que existe na página", async () => {
  const html = await readFile(new URL("../public/minha-conta.html", import.meta.url), "utf8");
  for (const s of accountSections) {
    if (s.href.startsWith("/minha-conta.html#")) assert.match(html, new RegExp(`id="${s.id}"[^>]*data-view`), s.label);
    else if (s.href !== "/minha-conta.html") await readFile(new URL(`../public${s.href}`, import.meta.url));
  }
  const menu = accountSections.filter((s) => s.menu).map((s) => s.label);
  for (const label of ["Meus pedidos", "Dados e segurança", "Métodos de pagamento", "Preciso de ajuda"]) assert.ok(menu.includes(label), label);
  assert.match(html, /id="seguranca"/, "links antigos para #seguranca continuam valendo");
  assert.match(html, /<nav class="account-nav" id="account-nav" aria-label="Seções da conta">/);
  assert.equal((html.match(/data-view /g) || []).length, accountSections.filter((s) => s.nav).length);
});

test("rotas da página e retorno depois do login", () => {
  assert.deepEqual(routeFromHash("#pedidos"), { view: "pedidos" });
  assert.deepEqual(routeFromHash("#seguranca"), { view: "dados", anchor: "seguranca" });
  assert.deepEqual(routeFromHash(""), { view: "visao-geral" });
  assert.deepEqual(routeFromHash("#nao-existe"), { view: "visao-geral" });
  assert.equal(paymentText({ metodo: "cartao", parcelas: 3 }), "Cartão de crédito, 3x sem juros");
  assert.equal(paymentText({ metodo: "cartao", parcelas: 1 }), "Cartão de crédito, à vista");
  assert.equal(paymentText({ metodo: "boleto", parcelas: 1 }), "Boleto");
  assert.equal(initials("Ana Maria Souza"), "AS");
  for (const ok of ["/minha-conta.html#pedidos", "/produto.html?id=demo-001", "/checkout.html", "/"]) assert.equal(safeNext(ok), ok);
  for (const bad of ["//evil.test", "https://evil.test", "/login.html", "/cadastro.html?next=/", "/\\evil.test", "javascript:alert(1)", "/a.html#" + "x".repeat(60)])
    assert.equal(safeNext(bad), null, bad);
});
