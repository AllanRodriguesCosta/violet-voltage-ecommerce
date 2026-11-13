// Etapa 37: perguntas técnicas com sim/não, uso em casa, baixo, peças do setup, carrinho com
// confirmação e avaliação com mais de 300 frases.
import test from "node:test";
import assert from "node:assert/strict";
import { seedProducts } from "../src/services/seed-products.js";
import { reply } from "../src/assistant/index.js";
import { specAnswer } from "../src/assistant/actions.js";
import { extract } from "../src/assistant/entities.js";
import { evalSet } from "../src/assistant/eval-set.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const find = (fn) => products.find(fn);
const ask = (mensagem, id, contexto) => reply({ mensagem, contexto, pagina: id ? { tipo: "produto", id } : undefined }, { products });
const tube = find((p) => p.categoria === "Amplificadores" && p.ficha.tecnologia === "Valvulado" && p.ficha.potencia >= 30);
const small = find((p) => p.categoria === "Amplificadores" && p.ficha.potencia <= 20);
const fixed = find((p) => p.categoria === "Guitarras" && p.ficha.ponte === "Fixa" && p.ficha.mao === "Destro");

test("sim ou não pela ficha: tecnologia, ponte, mão, captação", async () => {
  assert.match((await ask("esse amp é valvulado?", tube.id)).texto, /: Sim, é valvulado\./);
  assert.match((await ask("é transistor?", tube.id)).texto, /Não, não é transistorizado\. Tecnologia: Valvulado/);
  assert.match((await ask("tem alavanca?", fixed.id)).texto, /Não, não tem alavanca\. Ponte: Fixa/);
  assert.match(specAnswer(fixed, "e canhota").texto, /Não, não é para canhoto/);
  assert.doesNotMatch(specAnswer(tube, "qual a tecnologia").texto, /Sim|Não,/, "pergunta aberta recebe só o dado");
});

test("uso em casa e baixo: respostas honestas pela potência e pela categoria", async () => {
  assert.match((await ask("dá pra usar em apartamento?", tube.id)).texto, /valvulado é alto/);
  assert.match((await ask("dá pra estudar em casa com ele?", small.id)).texto, /ótimo para estudar em casa/);
  assert.match((await ask("serve para baixo?", tube.id)).texto, /Não é indicado para baixo/);
  const cable = find((p) => p.categoria === "Cabos");
  assert.match(specAnswer(cable, "serve para baixo").texto, /Serve sim/);
  const r = await ask("tem preço mais baixo?", fixed.id);
  assert.notEqual(r.intencao, "ficha", "“mais baixo” não é pergunta sobre baixo");
});

test("no setup, a pergunta vai para a peça certa", async () => {
  const set = await ask("monta um setup de rock clássico até 6 mil");
  const amp = set.cards.find((c) => c.categoria === "Amplificadores");
  const r = await ask("o amplificador é valvulado?", undefined, set.contexto);
  assert.equal(r.intencao, "ficha");
  assert.ok(r.texto.startsWith(`${amp.marca} ${amp.modelo}:`), r.texto);
  const pedal = await ask("o pedal precisa de fonte?", undefined, set.contexto);
  assert.match(pedal.texto, /^[^:]+: Alimentação/);
  assert.equal(pedal.cards[0].categoria, "Pedais");
});

test("carrinho: o setup inteiro entra só depois do toque no botão", async () => {
  const set = await ask("monta um setup de blues até 4 mil");
  const add = await ask("coloca o setup no carrinho", undefined, set.contexto);
  assert.equal(add.intencao, "adicionar");
  assert.match(add.texto, /^Confirma\?/);
  const action = add.acoes.find((a) => a.tipo === "carrinho");
  assert.deepEqual(action.itens.sort(), set.cards.map((c) => c.id).sort());
});

test("entidades: cabo de guitarra é cabo; suporte (atendimento) não é acessório", () => {
  assert.equal(extract("queria um cabo de guitarra", products).categoria, "Cabos");
  assert.equal(extract("pedal pra guitarra", products).categoria, "Pedais");
  assert.equal(extract("preciso de suporte urgente", products).categoria, undefined);
  assert.equal(extract("suporte de parede para guitarra", products).categoria, "Acessórios");
});

test("avaliação com mais de 300 frases, sem repetição", () => {
  assert.ok(evalSet.length >= 300);
  assert.equal(new Set(evalSet.map(([m]) => m.toLowerCase())).size, evalSet.length);
});
