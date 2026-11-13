import test from "node:test";
import assert from "node:assert/strict";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { reply } from "../src/assistant/index.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const chat = (user = { nome: "Ana" }) => {
  let contexto;
  return async (mensagem, extra = {}) => {
    const r = await reply({ mensagem, contexto, ...extra }, { products, user });
    contexto = r.contexto;
    return r;
  };
};
const total = (r) => r.cards.reduce((s, c) => s + c.priceCents, 0);

test("achou caro no setup: versão mais barata, pergunta o orçamento e ajusta", async () => {
  const say = chat();
  const first = await say("monta um setup de rock clássico até 5 mil");
  const cheaper = await say("muito caro");
  assert.equal(cheaper.intencao, "objecao_preco", "não vira agradecimento");
  assert.ok(total(cheaper) < total(first));
  assert.match(cheaper.texto, /a menos que o anterior/);
  assert.equal(cheaper.contexto.aguardando, "orcamento");
  const fit = await say("2500");
  assert.equal(fit.intencao, "setup");
  assert.ok(total(fit) <= 250000 || /Passou do orçamento/.test(fit.texto));
  const again = await say("achei caro, tenho até 2 mil");
  assert.equal(again.intencao, "objecao_preco");
  assert.match(again.texto, /até R\$\s2\.000/);
});

test("achou caro, não gostou e gostou na recomendação", async () => {
  const say = chat();
  const first = await say("quero um pedal de overdrive");
  const shown = first.cards.map((c) => c.id);
  const other = await say("não gostei");
  assert.equal(other.intencao, "objecao");
  assert.ok(other.cards.every((c) => !shown.includes(c.id)), "não repete os já mostrados");
  const cheap = await say("achei caro");
  assert.equal(cheap.intencao, "objecao_preco");
  const budget = await say("800");
  assert.ok(budget.cards.length && budget.cards.every((c) => c.priceCents <= 80000));
  assert.match(budget.texto, /Até R\$\s800/);
  const liked = await say("gostei");
  assert.equal(liked.intencao, "aprovacao");
  // Sem contexto: orienta e oferece kits, sem "por nada".
  const cold = await chat()("muito caro");
  assert.equal(cold.intencao, "objecao_preco");
  assert.ok(cold.acoes.some((a) => a.href === "/kits.html"));
  assert.equal((await chat()("obrigado")).intencao, "agradecimento");
});

test("visitante: recomenda sem login e pede login só para pedidos, histórico e trocas", async () => {
  const say = chat(null);
  assert.equal((await say("quero uma guitarra para blues")).cards.length > 0, true);
  for (const m of ["onde está meu pedido?", "quero cancelar meu pedido", "me indica algo com base nas minhas compras", "quero trocar o pedal que comprei"]) {
    const r = await chat(null)(m);
    assert.ok(r.acoes.some((a) => a.tipo === "login"), m);
  }
  const fav = await chat(null)("algum favorito baixou de preço?", { favoritos: ["demo-030"] });
  assert.ok(fav.acoes.some((a) => a.tipo === "login"));
  assert.match(fav.texto, /ES-335/);
});

test("API: visitante conversa com limite próprio e sem acesso a pedidos", async (t) => {
  const { call, register } = await storeFixture(t);
  const r = await call("/assistente", { body: { mensagem: "quero um pedal de delay" } });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.cards.length);
  assert.equal((await call("/assistente", { body: { mensagem: "onde está meu pedido?" } })).body.data.acoes[0].tipo, "login");
  const ana = await register("ana@s26.test");
  assert.match((await call("/assistente", { cookie: ana, body: { mensagem: "onde está meu pedido?" } })).body.data.texto, /ainda não tem pedidos/);
});
