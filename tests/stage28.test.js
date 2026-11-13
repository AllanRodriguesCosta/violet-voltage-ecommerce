import test from "node:test";
import assert from "node:assert/strict";
import { seedProducts, ORIGINAL_SEED_COUNT } from "../src/services/seed-products.js";
import { reply } from "../src/assistant/index.js";
import { buildSetup } from "../src/assistant/recommend.js";

const all = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
// Catálogo publicado antes do seed das fotos novas: só os 22 produtos originais.
const original = all.slice(0, ORIGINAL_SEED_COUNT);
const chat = (products, user = { nome: "Ana" }, orders = async () => []) => {
  let contexto;
  return async (mensagem) => {
    const r = await reply({ mensagem, contexto }, { products, user, orders });
    contexto = r.contexto;
    return r;
  };
};
const total = (r) => r.cards.reduce((s, c) => s + c.priceCents, 0);
const cheapest = (products, categoria, fits = () => true) =>
  Math.min(...products.filter((p) => p.categoria === categoria && p.estoque > 0 && fits(p)).map((p) => p.priceCents));

test("“ajuda” sozinho abre a triagem de atendimento; “o que você faz?” apresenta o assistente", async () => {
  for (const m of ["ajuda", "Ajuda!", "socorro", "help", "preciso de ajuda", "tive um problema", "quero falar com atendente"]) {
    const r = await chat(all, null)(m);
    assert.equal(r.intencao, "ajuda", m);
    assert.match(r.texto, /estou aqui para ajudar/, m);
    assert.ok(r.sugestoes.includes("Onde está meu pedido?") && r.sugestoes.includes("Problema com o pagamento"), m);
    assert.ok(r.acoes.some((a) => a.href === "/ajuda.html"), m);
    assert.match(r.texto, /entrar na conta/, "visitante: avisa que pedido pede login");
  }
  assert.equal((await chat(all, null)("queria falar com o suporte")).intencao, "ajuda", "suporte = atendimento");
  assert.equal((await chat(all, null)("tem suporte de chão?")).intencao, "recomendar", "suporte de chão = produto");
  const about = await chat(all, null)("o que você faz?");
  assert.match(about.texto, /Eu entendo frases/);
});

test("triagem logada cita o pedido em andamento e os botões levam ao assunto certo", async () => {
  const orders = async () => [
    { id: "abcdef1234", status: "Concluído", createdAt: "2026-11-01", itens: [], totalCents: 1000 },
    { id: "99887766aa", status: "Enviado", createdAt: "2026-11-10", itens: [], totalCents: 2000, entrega: "padrao" },
  ];
  const r = await chat(all, { nome: "Ana" }, orders)("ajuda");
  assert.match(r.texto, /#99887766/);
  assert.ok(r.acoes.some((a) => a.href === "/minha-conta.html#ajuda"));
  const expected = { "Onde está meu pedido?": "pedido_status", "Quero trocar um produto": "troca", "Problema com o pagamento": "pagamento", "Não consigo entrar na conta": "conta", "Me indica uma guitarra": "recomendar" };
  for (const chip of r.sugestoes) assert.equal((await chat(all, { nome: "Ana" }, orders)(chip)).intencao, expected[chip], chip);
  assert.match((await chat(all)("Problema com o pagamento")).texto, /tela de confirmação/);
  assert.match((await chat(all)("Não consigo entrar na conta")).texto, /15 minutos/);
  assert.equal((await chat(all, { nome: "Ana" }, orders)("tive um problema com meu pedido")).intencao, "pedido_status");
});

test("setup respeita o orçamento antes do gênero: troca a peça por outra de perfil diferente e explica", async () => {
  const say = chat(original);
  await say("Montar um setup de rock");
  const first = await say("Até R$ 6 mil");
  assert.ok(total(first) <= 600000, `total ${total(first)}`);
  assert.doesNotMatch(first.texto, /Passou do seu orçamento/);
  assert.match(first.texto, /Para respeitar o valor, o amplificador/);
  assert.match(first.texto, /mais em conta para rock clássico é/);
  // Cada "mais barato" sai mais barato de verdade ou diz que chegou no mínimo; nunca repete igual.
  let previous = first;
  for (let i = 0; i < 4; i++) {
    const next = await say("Mais barato");
    if (next.cards.length) {
      assert.ok(total(next) < total(previous), `rodada ${i}: ${total(next)} >= ${total(previous)}`);
      assert.match(next.texto, /a menos que o anterior/);
      previous = next;
    } else {
      assert.match(next.texto, /já é o setup mais em conta/);
      break;
    }
  }
  assert.ok(total(previous) < total(first));
  // Pedal e correia que saíram para economizar são citados.
  const dropped = ["Pedais", "Correias"].filter((c) => first.cards.some((x) => x.categoria === c) && !previous.cards.some((x) => x.categoria === c));
  if (dropped.length) assert.match(previous.texto + (await say("Mais barato")).texto, /deixei de fora|já é o setup mais em conta/);
});

test("buildSetup: se as peças obrigatórias mais baratas cabem, o setup fica dentro do orçamento", () => {
  for (const products of [original, all]) {
    const floor = cheapest(products, "Guitarras") + cheapest(products, "Amplificadores") + cheapest(products, "Cabos", (p) => p.ficha?.tipo !== "Patch");
    for (const genero of ["Rock clássico", "Blues", "Heavy metal", "Jazz", "Pop"]) {
      for (const max of [floor, floor + 50000, 300000, 450000, 600000, 1000000]) {
        if (max < floor) continue;
        const setup = buildSetup(products, { genero, max });
        assert.ok(setup.dentro, `${genero} até ${max}: ${setup.total}`);
        assert.ok(["Guitarra", "Amplificador", "Cabo"].every((r) => setup.items.some((x) => x.rotulo === r)), `${genero} até ${max}`);
      }
    }
  }
});
