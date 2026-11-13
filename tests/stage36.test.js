// Etapa 36: setup com o que o cliente já tem, troca de uma peça, peças travadas, tirar/incluir,
// "por que essa peça?" e memória do gosto para quem tem conta.
import test from "node:test";
import assert from "node:assert/strict";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { reply, describeTaste } from "../src/assistant/index.js";
import { buildSetup } from "../src/assistant/recommend.js";
import { detectOwned, detectEdit, reasonsFor } from "../src/assistant/setup-edit.js";
import { sanitizeContext } from "../src/assistant/context.js";
import { tasteOf } from "../src/services/assistant-profile.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const byId = (id) => products.find((p) => p.id === id);
const chat = (deps = {}) => {
  let contexto;
  return async (mensagem) => {
    const r = await reply({ mensagem, contexto }, { products, user: { nome: "Ana" }, ...deps });
    contexto = r.contexto;
    return r;
  };
};
const cat = (r, c) => r.cards.find((x) => x.categoria === c);
const total = (r) => r.cards.reduce((s, c) => s + c.priceCents, 0);

test("detecção: o que já tem, o que falta e o que fazer com o setup", () => {
  assert.deepEqual(detectOwned("já tenho uma squier e um cubo").tenho, ["Guitarras", "Amplificadores"]);
  assert.deepEqual(detectOwned("só falta o amp e o pedal").falta, ["Amplificadores", "Pedais"]);
  assert.equal(detectOwned("quero uma guitarra"), null);
  const cases = { "troca só o amplificador": "trocar", "quero outro amp": "trocar", "mantém a guitarra": "manter", "tira a correia": "tirar", "põe um pedal": "incluir", "por que essa guitarra?": "porque", "por que essas peças?": "porque" };
  for (const [frase, acao] of Object.entries(cases)) assert.equal(detectEdit(frase)?.acao, acao, frase);
  assert.equal(detectEdit("qual o prazo de entrega?"), null);
});

test("buildSetup: sem o que o cliente tem, verba redistribuída; travadas não mudam; excluídas não voltam", () => {
  const base = buildSetup(products, { genero: "Rock clássico", max: 300000 });
  const owned = buildSetup(products, { genero: "Rock clássico", max: 300000, tenho: ["Guitarras"] });
  assert.ok(!owned.items.some((x) => x.produto.categoria === "Guitarras"));
  const amp = (r) => r.items.find((x) => x.produto.categoria === "Amplificadores").produto;
  assert.ok(amp(owned).priceCents >= amp(base).priceCents, "sem guitarra, o amplificador pode ser melhor");
  assert.ok(owned.total <= 300000);
  const guitar = base.items.find((x) => x.produto.categoria === "Guitarras").produto;
  const locked = buildSetup(products, { genero: "Rock clássico", max: 150000, fixos: [guitar.id] });
  assert.equal(locked.items.find((x) => x.produto.categoria === "Guitarras").produto.id, guitar.id, "travada fica mesmo com menos verba");
  const swapped = buildSetup(products, { genero: "Rock clássico", max: 300000, excluir: [amp(base).id] });
  assert.notEqual(amp(swapped).id, amp(base).id);
});

test("conversa: troca só o amplificador e mantém as outras peças", async () => {
  const say = chat();
  const first = await say("monta um setup de rock clássico até 6 mil");
  const second = await say("troca só o amplificador");
  assert.equal(second.intencao, "setup_trocar");
  assert.match(second.texto, /^Troquei /);
  assert.notEqual(cat(second, "Amplificadores").id, cat(first, "Amplificadores").id);
  for (const c of ["Guitarras", "Pedais", "Cabos", "Correias"]) assert.equal(cat(second, c)?.id, cat(first, c)?.id, c);
  assert.ok(total(second) <= 600000);
  assert.ok(second.sugestoes.includes("Por que essas peças?"));
});

test("conversa: mantém a guitarra e pede mais barato; a guitarra continua", async () => {
  const say = chat();
  const first = await say("monta um setup de rock clássico até 6 mil");
  const keep = await say("mantém a guitarra");
  assert.equal(keep.intencao, "setup_manter");
  assert.deepEqual(keep.contexto.filtros.fixos, [cat(first, "Guitarras").id]);
  const cheaper = await say("mais barato");
  assert.equal(cat(cheaper, "Guitarras").id, cat(first, "Guitarras").id);
  assert.ok(total(cheaper) < total(first));
  assert.match(cheaper.texto, /· mantida/);
});

test("conversa: já tenho guitarra e amplificador; o setup monta só o resto", async () => {
  const say = chat();
  const r1 = await say("quero montar um setup, já tenho uma squier e um cubo");
  assert.equal(r1.intencao, "setup_tenho");
  assert.match(r1.texto, /já tem a guitarra e o amplificador/);
  await say("rock");
  const r3 = await say("até 2 mil");
  assert.ok(r3.cards.length >= 2);
  assert.ok(!r3.cards.some((c) => ["Guitarras", "Amplificadores"].includes(c.categoria)));
  assert.match(r3.texto, /porque você já tem/);
  assert.doesNotMatch(r3.texto, /Kit primeira guitarra/);
});

test("conversa: tirar e incluir peça; peça que saiu para caber no valor não volta sozinha", async () => {
  const say = chat();
  const first = await say("monta um setup de rock clássico até 6 mil");
  const out = await say("tira a correia");
  assert.equal(out.intencao, "setup_tirar");
  assert.ok(!cat(out, "Correias"));
  assert.equal(cat(out, "Pedais")?.id, cat(first, "Pedais")?.id);
  assert.deepEqual(out.contexto.filtros.sem, ["Correias"]);
  const back = await say("põe uma correia");
  assert.equal(back.intencao, "setup_incluir");
  assert.ok(cat(back, "Correias"));
  assert.equal(back.contexto.filtros.sem, undefined);
});

test("por que essa peça: motivos pelo artista, gênero, cor e orçamento", async () => {
  const say = chat();
  await say("setup no estilo do Slash");
  await say("Vermelho");
  const set = await say("até 8 mil");
  const why = await say("por que essa guitarra?");
  assert.equal(why.intencao, "setup_porque");
  assert.match(why.texto, /Escolhi a guitarra assim/);
  assert.match(why.texto, /Slash/);
  const all = await say("por que essas peças?");
  assert.equal(all.texto.split("\n").filter((l) => l.startsWith("• ")).length, set.cards.length);
  const reasons = reasonsFor({ produto: byId(cat(set, "Guitarras").id), fatia: 360000 }, { genero: "Hard rock", max: 800000 });
  assert.ok(reasons.length >= 1 && reasons.length <= 3);
});

test("memória: salva o gosto do setup, oferece na volta, reaproveita e esquece", async () => {
  let saved = null;
  const perfil = { carregar: async () => saved, salvar: async (f) => (saved = tasteOf(f)), esquecer: async () => (saved = null) };
  const say = chat({ perfil });
  await say("setup no estilo do Slash");
  await say("Vermelho");
  await say("até 8 mil");
  assert.deepEqual(saved, { genero: "Hard rock", artista: "Slash", cor: "Vermelho", max: 800000 });
  const again = chat({ perfil });
  const hi = await again("oi");
  assert.match(hi.texto, /Da última vez você montou um setup de hard rock, no estilo de Slash, em vermelho, até R\$\s8\.000,00/);
  assert.equal(hi.sugestoes[0], "Usar o mesmo gosto");
  const reuse = await again("Usar o mesmo gosto");
  assert.equal(reuse.intencao, "setup");
  assert.ok(reuse.cards.length >= 4);
  const start = await chat({ perfil })("monta um setup");
  assert.match(start.texto, /Quer partir dele\?/);
  const forget = await again("esquece meu gosto");
  assert.equal(forget.intencao, "memoria_apagar");
  assert.equal(saved, null);
  const guest = await reply({ mensagem: "usar o mesmo gosto" }, { products });
  assert.ok(guest.acoes.some((a) => a.tipo === "login"));
  assert.match(describeTaste({ genero: "Blues", max: 300000, tenho: ["Guitarras"] }), /sem guitarra, que você já tem/);
});

test("contexto aceita só categorias e IDs válidos nas mudanças do setup", () => {
  const ctx = sanitizeContext({ intent: "setup", filtros: { tenho: ["Guitarras", "Naves"], sem: ["Correias"], fixos: ["demo-001", "<script>"], excluir: Array.from({ length: 30 }, (_, i) => `demo-${i}`) } });
  assert.deepEqual(ctx.filtros.tenho, ["Guitarras"]);
  assert.deepEqual(ctx.filtros.fixos, ["demo-001"]);
  assert.equal(ctx.filtros.excluir.length, 20);
});

test("API: gosto salvo na conta, na cópia de dados e apagado com a conta", async (t) => {
  const { call, register, storage } = await storeFixture(t);
  const ana = await register("ana@s36.test");
  let contexto;
  for (const mensagem of ["setup no estilo do Slash", "Vermelho", "até 8 mil"]) contexto = (await call("/assistente", { cookie: ana, body: { mensagem, contexto } })).body.data.contexto;
  assert.equal((await storage.list("profiles")).length, 1);
  const hi = (await call("/assistente", { cookie: ana, body: { mensagem: "oi" } })).body.data;
  assert.match(hi.texto, /Da última vez/);
  const exported = await call("/account/export", { method: "GET", cookie: ana });
  assert.equal(exported.body.gostoNoAssistente.artista, "Slash");
  const guestHi = (await call("/assistente", { body: { mensagem: "oi" } })).body.data;
  assert.doesNotMatch(guestHi.texto, /Da última vez/);
  await call("/assistente", { cookie: ana, body: { mensagem: "esquece meu gosto" } });
  assert.equal((await storage.list("profiles")).length, 0);
});
