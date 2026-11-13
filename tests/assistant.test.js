import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { normalize, tokens, stem, features } from "../src/assistant/text.js";
import { train, classify } from "../src/assistant/classifier.js";
import { extract, extractPrice } from "../src/assistant/entities.js";
import { reply, model, catalogLink } from "../src/assistant/index.js";
import { recommend, buildSetup } from "../src/assistant/recommend.js";
import { sanitizeContext } from "../src/assistant/context.js";
import { faqAnswer } from "../src/assistant/faq.js";
import { evaluate } from "../src/assistant/evaluate.js";
import { examples } from "../src/assistant/intents.js";
import { evalSet } from "../src/assistant/eval-set.js";
import { seedProducts } from "../src/services/seed-products.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const byId = (id) => products.find((p) => p.id === id);
const nb = (s) => s.replace(/\s+/g, " ");
async function chat(lines, env = {}) {
  let contexto;
  const out = [];
  for (const mensagem of lines) {
    const r = await reply({ mensagem, contexto }, { products, user: { nome: "Ana Lima" }, ...env });
    contexto = r.contexto;
    out.push(r);
  }
  return out;
}

test("texto: acentos, caixa, vogal alongada, radicais e pares de palavras", () => {
  assert.equal(normalize("  Guitarra   CLÁSSICA “vintage” "), "guitarra classica vintage");
  assert.deepEqual(tokens("Oii, obrigadooo!"), ["oi", "obrigado"]);
  assert.equal(stem("guitarras"), stem("guitarra"));
  assert.equal(stem("amplificadores"), stem("amplificador"));
  assert.equal(stem("pedais"), "pedal");
  assert.equal(stem("procurando"), stem("procuro"));
  assert.equal(stem("queria"), stem("quero"));
  assert.deepEqual(features("Quero uma guitarra"), ["quer", "guitarr", "quer_guitarr"]);
});

test("classificador: aprende do exemplo, frase sem palavra conhecida tem confiança zero, tolera erro de digitação", () => {
  const tiny = train({ a: ["frete grátis", "prazo de entrega"], b: ["quero guitarra"] });
  assert.equal(classify(tiny, "qual o frete")[0].intent, "a");
  assert.equal(classify(tiny, "xyz qwe")[0].p, 0);
  assert.equal(classify(model, "qual o valor do frte")[0].intent, "entrega");
  const evalPhrases = new Set(evalSet.map(([m]) => normalize(m)));
  for (const phrases of Object.values(examples)) for (const p of phrases) assert.ok(!evalPhrases.has(normalize(p)), `"${p}" está no treino e na avaliação`);
});

test("entidades: preço em reais com mil, k, faixas e aproximação; 10x, watts e metros não são preço", () => {
  assert.deepEqual(extractPrice("até 3 mil"), { max: 300000 });
  assert.deepEqual(extractPrice("no máximo R$ 1.599,90"), { max: 159990 });
  assert.deepEqual(extractPrice("entre 1000 e 2500 reais"), { min: 100000, max: 250000 });
  assert.deepEqual(extractPrice("a partir de 2k"), { min: 200000 });
  assert.deepEqual(extractPrice("uns 1500"), { max: 172500 });
  assert.deepEqual(extractPrice("guitarra de 2 mil"), { max: 230000 });
  assert.deepEqual(extractPrice("parcelar em 10x"), {});
  assert.deepEqual(extractPrice("amp de 15 W e cabo de 3 m"), {});
  assert.deepEqual(extractPrice("som dos anos 60"), {});
});

test("entidades: gênero mais longo primeiro, formato, captação, tipo, marca e produto pelo nome", () => {
  const e = extract("quero uma les paul com humbucker para hard rock até 5 mil", products);
  assert.equal(e.genero, "Hard rock");
  assert.equal(e.formato, "Single cut");
  assert.equal(e.captacao, "Humbucker");
  assert.equal(e.categoria, "Guitarras");
  assert.equal(e.max, 500000);
  assert.equal(extract("single cut", products).captacao, undefined, "single cut é formato, não captação");
  assert.equal(extract("rock clássico", products).estilo, undefined, "clássico do gênero não vira estilo");
  assert.equal(extract("som vintage", products).estilo, "Vintage");
  assert.equal(extract("pedal de delay", products).tipo, "Delay");
  assert.equal(extract("um afinador", products).categoria, undefined, "afinador existe em pedal e acessório");
  assert.equal(extract("tem algo da ehx?", products).marca, "Electro-Harmonix");
  assert.equal(extract("tem algo da boss?", products).marca, "Boss");
  assert.equal(extract("procuro algo", products).marca, undefined, "\"procuro\" não é a marca Pro Co");
  const names = (m) => extract(m, products).produtos.map((p) => p.modelo);
  assert.deepEqual(names("quanto custa a AC30?"), ["AC30C2"]);
  assert.deepEqual(names("tem o ds 1?"), ["DS-1 Distortion"]);
  assert.deepEqual(names("e o rat 2"), ["RAT 2"]);
  assert.deepEqual(names("talvez blues rock"), [], "gênero não é nome de produto");
  assert.deepEqual(names("amplificador valvulado britânico"), [], "ficha técnica não é nome de produto");
});

test("conversa-alvo: vintage → pergunta do gênero → blues rock → Strats explicadas pela base", async () => {
  const [ask, answer, amp] = await chat(["eu gostaria de uma guitarra mais vintage", "talvez blues rock", "E um amplificador?"]);
  assert.equal(ask.contexto.aguardando, "genero");
  assert.match(ask.texto, /Qual som vintage/);
  assert.ok(ask.sugestoes.includes("Blues rock"));
  assert.equal(answer.intencao, "recomendar");
  assert.match(answer.texto, /Stratocaster/);
  assert.ok(answer.cards.length >= 3 && answer.cards.every((c) => byId(c.id).categoria === "Guitarras" && byId(c.id).estoque > 0));
  assert.ok(answer.cards.filter((c) => byId(c.id).ficha.formato === "Strat").length >= 2);
  assert.ok(answer.cards.every((c) => byId(c.id).ficha.generos.includes("Blues rock")));
  assert.ok(amp.cards.every((c) => byId(c.id).categoria === "Amplificadores"), "\"e um amplificador?\" mantém o gênero e troca a categoria");
  assert.equal(amp.contexto.filtros.genero, "Blues rock");
});

test("refinar: mais barato mostra só itens mais baratos que os já vistos; pedido novo recomeça", async () => {
  const [first, cheaper, fresh] = await chat(["quero um amplificador para blues", "mais barato", "procuro um pedal de fuzz"]);
  const minShown = Math.min(...first.cards.map((c) => c.priceCents));
  assert.ok(cheaper.cards.length && cheaper.cards.every((c) => c.priceCents < minShown && !first.cards.some((x) => x.id === c.id)));
  assert.ok(fresh.cards.every((c) => byId(c.id).ficha.efeito === "Fuzz"));
  assert.equal(fresh.contexto.filtros.genero, undefined, "gênero da busca anterior não vaza para o pedido novo");
});

test("setup: pergunta estilo e orçamento, respeita o orçamento e devolve ações seguras", async () => {
  const steps = await chat(["quero montar um setup", "blues", "até 6 mil"]);
  assert.equal(steps[0].contexto.aguardando, "genero");
  assert.equal(steps[1].contexto.aguardando, "orcamento");
  const done = steps[2];
  const ids = done.cards.map((c) => c.id);
  const total = ids.reduce((s, id) => s + byId(id).priceCents, 0);
  assert.ok(total <= 600000, `total ${total}`);
  assert.deepEqual(new Set(ids.map((id) => byId(id).categoria)), new Set(["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias"]));
  assert.ok(byId(ids.find((id) => byId(id).categoria === "Cabos")).ficha.tipo !== "Patch");
  const cart = done.acoes.find((a) => a.tipo === "carrinho");
  assert.deepEqual(cart.itens, ids);
  for (const a of done.acoes.filter((x) => x.tipo === "link")) assert.match(a.href, /^\/[a-z]/);
  const setup = buildSetup(products, { genero: "Heavy metal", max: 400000 });
  assert.ok(setup.dentro && setup.total <= 400000);
  assert.ok(setup.items.every((x) => x.produto.estoque > 0));
});

test("respostas só com produtos reais em estoque; filtros viram link do catálogo", async () => {
  for (const m of ["guitarra para jazz", "pedal de overdrive até 900", "amplificador britânico", "cabo patch", "correia vintage"]) {
    const [r] = await chat([m]);
    for (const c of r.cards) {
      const p = byId(c.id);
      assert.ok(p && p.estoque > 0 && p.priceCents === c.priceCents && p.modelo === c.modelo, `${m}: ${c.id}`);
    }
  }
  assert.equal(catalogLink({ categoria: "Guitarras", genero: "Blues rock", formato: "Strat", max: 300000 }), "/catalogo.html?categoria=Guitarras&generos=Blues+rock&max=3000&formato=Strat");
  const none = recommend(products, { categoria: "Guitarras", max: 50000 });
  assert.equal(none.items.length, 0);
  const [cheap] = await chat(["guitarra até 500 reais"]);
  assert.match(cheap.texto, /Não encontrei/);
  assert.ok(cheap.cards.length, "mostra as mais acessíveis em vez de nada");
});

test("pedidos: só os do próprio usuário, mais recente, código e cancelamento", async () => {
  const orders = async () => [
    { id: "aaaa1111-x", status: "Concluído", entrega: "padrao", createdAt: "2026-10-01T10:00:00Z", totalCents: 5990, itens: [{ quantidade: 1 }] },
    { id: "bbbb2222-x", status: "Recebido", entrega: "retirada", createdAt: "2026-11-11T10:00:00Z", totalCents: 159900, itens: [{ quantidade: 2 }] },
  ];
  const [status] = await chat(["onde está meu pedido?"], { orders });
  assert.match(nb(status.texto), /mais recente #BBBB2222 .*2 itens.*“Recebido”/);
  const [old] = await chat(["e o pedido aaaa1111?"], { orders });
  assert.match(old.texto, /#AAAA1111/);
  const [cancel] = await chat(["quero cancelar meu pedido"], { orders });
  assert.match(cancel.texto, /ainda pode ser cancelado/);
  const [empty] = await chat(["cadê meu pedido?"], { orders: async () => [] });
  assert.match(empty.texto, /ainda não tem pedidos/);
});

test("dúvidas usam as regras do checkout", () => {
  assert.match(nb(faqAnswer("entrega", "frete gratis").texto), /R\$ 999,00/);
  assert.match(nb(faqAnswer("pagamento", "pix").texto), /10x sem juros.*R\$ 50,00/);
  assert.match(faqAnswer("cupom", "cupom").texto, /VOLTAGE10.*PRIMEIROACORDE.*FRETEVOLT/);
  assert.match(faqAnswer("conta", "esqueci a senha").texto, /recuperação de senha/);
});

test("contexto vindo do navegador é revalidado", () => {
  const ctx = sanitizeContext(
    {
      intent: "admin",
      filtros: { categoria: "Guitarras", genero: "Forró", marca: "Inexistente", max: -5, min: "100", formato: "Strat", __proto__: { x: 1 }, preco: 1 },
      aguardando: "senha",
      perguntas: ["genero", "genero", "outra"],
      mostrados: ["demo-001", "<script>", ...Array(40).fill("demo-002")],
    },
    ["Fender"],
  );
  assert.equal(ctx.intent, null);
  assert.deepEqual(ctx.filtros, { categoria: "Guitarras", formato: "Strat" });
  assert.equal(ctx.aguardando, null);
  assert.deepEqual(ctx.perguntas, ["genero"]);
  assert.ok(ctx.mostrados.length === 30 && !ctx.mostrados.includes("<script>"));
  assert.deepEqual(sanitizeContext("x").filtros, {});
});

test("avaliação: acerto de intenção acima de 90% em frases fora do treino, entidades e conversas corretas", async () => {
  const r = await evaluate(products);
  assert.ok(r.acuracia >= 0.9, `acurácia ${r.acuracia}`);
  for (const [intent, s] of Object.entries(r.porIntencao)) assert.ok(s.acuracia >= 0.6, `${intent}: ${s.acuracia}`);
  assert.deepEqual(r.entidades.erros, []);
  assert.deepEqual(r.dialogos.erros, []);
});

test("API do assistente: só logado, valida mensagem e contexto, isola pedidos e limita o ritmo", async (t) => {
  const storage = new MemoryStorage();
  for (const source of seedProducts.slice(12, 15)) {
    const data = { ...source };
    delete data.file;
    await storage.create("products", { ...data, partitionKey: "guitarras", ativo: true, blobName: "", imageUrl: "" });
  }
  const http = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const register = async (email) => (await call("/auth/register", { body: { nome: "Cliente Chat", email, senha: randomBytes(12).toString("hex") } })).cookie;
  // Visitante usa o assistente; pedidos pedem login (etapa 26).
  const visitor = await call("/assistente", { body: { mensagem: "onde está meu pedido?" } });
  assert.equal(visitor.status, 200);
  assert.equal(visitor.body.data.acoes[0].tipo, "login");
  const ana = await register("ana-chat@teste.test");
  const bia = await register("bia-chat@teste.test");
  await storage.create("orders", { partitionKey: "outra-pessoa", rowKey: "pedido-de-outra-1", status: "Recebido", itens: "[]", totalCents: 1, createdAt: new Date().toISOString() });
  assert.equal((await call("/assistente", { cookie: ana, body: { mensagem: "   " } })).status, 400);
  assert.equal((await call("/assistente", { cookie: ana, body: { mensagem: "a".repeat(501) } })).status, 400);
  assert.equal((await call("/assistente", { cookie: ana, body: { mensagem: "oi", contexto: { mostrados: Array(500).fill("demo-001") } } })).status, 400);
  const first = await call("/assistente", { cookie: ana, body: { mensagem: "quero uma guitarra vintage" } });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.contexto.aguardando, "genero");
  const second = await call("/assistente", { cookie: ana, body: { mensagem: "blues rock", contexto: first.body.data.contexto } });
  assert.ok(second.body.data.cards.length >= 1 && second.body.data.cards.every((c) => c.categoria === "Guitarras"));
  const orders = await call("/assistente", { cookie: ana, body: { mensagem: "onde está meu pedido?" } });
  assert.match(orders.body.data.texto, /ainda não tem pedidos/, "pedido de outra pessoa não aparece");
  let limited = 0;
  for (let i = 0; i < 45 && !limited; i++) if ((await call("/assistente", { cookie: bia, body: { mensagem: "oi" } })).status === 429) limited = i;
  assert.equal(limited, 40, "41ª mensagem em 5 minutos é recusada");
  assert.equal((await call("/assistente", { cookie: ana, body: { mensagem: "oi" } })).status, 200, "limite de um usuário não afeta outro");
});
