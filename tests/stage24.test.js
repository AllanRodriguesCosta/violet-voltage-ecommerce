import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { reply } from "../src/assistant/index.js";
import { sanitizePage, findTerms, exchangeAnswer, favoritesAnswer } from "../src/assistant/actions.js";
import { extract } from "../src/assistant/entities.js";
import { anonymize, logMiss } from "../src/services/assistant-log.js";
import { exchangeWindow } from "../src/services/orders.js";
import { MemoryStorage } from "../src/repositories/memory.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const ask = (mensagem, extra = {}, deps = {}) => reply({ mensagem, ...extra }, { products, user: { nome: "Teste" }, ...deps });

test("página, carrinho e favoritos vindos do navegador são revalidados", () => {
  const page = sanitizePage({ pagina: { tipo: "produto", id: "demo-030" }, carrinho: [{ id: "demo-024", quantidade: 1 }, { id: "x", quantidade: 1 }, { id: "demo-047", quantidade: 0 }, { id: "demo-048", quantidade: 1.5 }], favoritos: ["demo-030", "demo-030", "nao-existe", 5] }, products);
  assert.equal(page.produto.id, "demo-030");
  assert.deepEqual(page.carrinho.map((l) => l.product.id), ["demo-024"]);
  assert.deepEqual(page.favoritos.map((p) => p.id), ["demo-030"]);
  assert.equal(sanitizePage({ pagina: { tipo: "hack", id: "demo-030" } }, products).produto, null);
  assert.equal(sanitizePage({ pagina: { tipo: "produto", id: "../x" } }, products).produto, null);
});

test("entidades novas: canhoto, 7 cordas, captadores ativos e trastes", () => {
  const e = extract("guitarra canhota de 7 cordas com captador ativo e 24 trastes", products);
  assert.deepEqual([e.categoria, e.mao, e.cordas, e.captadores, e.trastes, e.tipo], ["Guitarras", "Canhoto", "7 cordas", "Ativos", 24, undefined]);
});

test("assistente: glossário, ficha pela página, comparação e adicionar com confirmação", async () => {
  let r = await ask("o que significa floyd rose?");
  assert.equal(r.intencao, "glossario");
  assert.ok(r.acoes.some((a) => a.href === "/guias.html#floyd-rose"));
  assert.deepEqual(findTerms("diferenca entre fuzz e overdrive").map((t) => t.termo).sort(), ["Fuzz", "Overdrive"]);
  r = await ask("quantos trastes tem essa?", { pagina: { tipo: "produto", id: "demo-036" } });
  assert.equal(r.intencao, "ficha");
  assert.match(r.texto, /PRS SE Custom 24: Trastes: 24\./);
  r = await ask("ela serve pra metal?", { pagina: { tipo: "produto", id: "demo-024" } });
  assert.match(r.texto, /não é a indicação mais forte/);
  r = await ask("o holy grail precisa de fonte?");
  assert.match(r.texto, /Precisa de fonte de 9V/);
  r = await ask("a tonex precisa de fonte?");
  assert.match(r.texto, /Não precisa comprar fonte/);
  r = await ask("compara a ds-1 com o rat 2");
  assert.equal(r.intencao, "comparar");
  assert.ok(r.acoes[0].href.startsWith("/comparar.html?ids="));
  assert.equal(r.cards.length, 2);
  r = await ask("compara com a jackson js32", { pagina: { tipo: "produto", id: "demo-036" }, contexto: r.contexto });
  assert.deepEqual(r.cards.map((c) => c.id), ["demo-036", "demo-033"], "página atual entra na comparação");
  const second = await ask("adiciona a segunda no carrinho", { contexto: r.contexto });
  assert.equal(second.intencao, "adicionar");
  assert.deepEqual(second.acoes[0], { tipo: "carrinho", rotulo: "Confirmar e adicionar", itens: ["demo-033"] });
  const out = await reply({ mensagem: "coloca essa no carrinho", pagina: { tipo: "produto", id: "demo-030" } }, { products: products.map((p) => (p.id === "demo-030" ? { ...p, estoque: 0 } : p)), user: { nome: "T" } });
  assert.match(out.texto, /esgotad/);
  assert.equal(out.acoes.some((a) => a.tipo === "carrinho"), false, "esgotado não vira botão de compra");
});

test("assistente: carrinho, cupom, kit no orçamento, histórico, favoritos e troca", async () => {
  let r = await ask("o que falta no meu carrinho?", { carrinho: [{ id: "demo-024", quantidade: 1 }] });
  assert.equal(r.intencao, "carrinho");
  assert.match(r.texto, /Falta o cabo da guitarra/);
  assert.equal(r.acoes[0].tipo, "carrinho");
  r = await ask("o que falta no meu carrinho?");
  assert.match(r.texto, /vazio/);
  r = await ask("aplica o cupom fretevolt");
  assert.deepEqual(r.acoes[0], { tipo: "cupom", rotulo: "Aplicar FRETEVOLT", codigo: "FRETEVOLT" });
  r = await ask("tenho 3 mil para começar do zero");
  r = await ask("rock clássico", { contexto: r.contexto });
  assert.match(r.texto, /Total:/);
  assert.match(r.texto, /Kit primeira guitarra/);
  assert.ok(r.acoes.some((a) => a.rotulo === "Adicionar o Kit primeira guitarra" && a.itens.length === 6));
  const orders = async () => [{ id: "pedido-1", status: "Concluído", createdAt: new Date().toISOString(), statusHistory: [{ status: "Concluído", at: new Date().toISOString() }], itens: [{ id: "demo-033", quantidade: 1 }] }];
  r = await ask("me indica algo com base nas minhas compras", {}, { orders });
  assert.equal(r.intencao, "historico");
  assert.ok(r.cards.some((c) => c.categoria === "Cabos"), "completa a guitarra com cabo");
  assert.ok(!r.cards.some((c) => c.id === "demo-033"), "não indica o que já comprou");
  r = await ask("quero trocar a guitarra que comprei", {}, { orders });
  assert.equal(r.acoes[0].href, "/pedido.html?id=pedido-1#troca");
  assert.equal(exchangeAnswer([{ id: "p", status: "Concluído", createdAt: "2020-01-01T00:00:00Z", statusHistory: [{ status: "Concluído", at: "2020-01-02T00:00:00Z" }] }]), null, "fora do prazo");
  const fav = favoritesAnswer(sanitizePage({ favoritos: ["demo-030", "demo-031"] }, products), [{ tipo: "preco", productId: "demo-030", priceCents: 600000 }]);
  assert.match(fav.texto, /1 favorito baixou/);
});

test("registro anônimo das frases não entendidas", async () => {
  assert.equal(anonymize("meu email é ana@teste.com e o pedido 5004c8bc, tel (11) 98765-4321"), "meu email é [e-mail] e o pedido [código], tel [número]");
  const storage = new MemoryStorage();
  await storage.create("assistantLog", { partitionKey: "faltas", rowKey: "velha", texto: "antiga", createdAt: "2020-01-01T00:00:00Z" });
  await logMiss(storage, "frase   nova");
  assert.deepEqual((await storage.list("assistantLog")).map((x) => x.texto), ["frase nova"], "remove registros com mais de 90 dias");
});

test("API: assistente com página e carrinho, registro no painel e troca pelo comprovante", async (t) => {
  const { call, register, admin, storage } = await storeFixture(t);
  const ana = await register("ana@s24.test");
  const bia = await register("bia@s24.test");
  const boss = await admin();
  const r = (await call("/assistente", { cookie: ana, body: { mensagem: "quantos trastes tem essa?", pagina: { tipo: "produto", id: "demo-033" }, carrinho: [{ id: "demo-033", quantidade: 1 }], favoritos: [] } })).body.data;
  assert.match(r.texto, /Trastes: 24/);
  assert.equal((await call("/assistente", { cookie: ana, body: { mensagem: "oi", carrinho: Array.from({ length: 400 }, () => ({ id: "demo-001-xxxxxxxx", quantidade: 1 })) } })).status, 400);
  await call("/assistente", { cookie: ana, body: { mensagem: "blablabla xyz ana@teste.com" } });
  const misses = (await call("/admin/assistente", { method: "GET", cookie: boss })).body.data;
  assert.equal(misses[0].texto, "blablabla xyz [e-mail]");
  assert.equal(misses[0].vezes, 1);
  assert.equal((await call("/admin/assistente", { method: "GET", cookie: ana })).status, 403);
  assert.equal((await call("/admin/assistente", { method: "DELETE", cookie: boss })).status, 200);
  assert.deepEqual((await call("/admin/assistente", { method: "GET", cookie: boss })).body.data, []);
  // Troca
  const order = (await call("/orders", { cookie: ana, body: { requestId: randomUUID(), items: [{ id: "demo-047", quantidade: 1 }, { id: "demo-021", quantidade: 1 }], entrega: "padrao", pagamento: "pix", endereco: "Rua das Trocas, 7 - São Paulo/SP" } })).body.data;
  const troca = (cookie, body) => call(`/orders/${order.id}/troca`, { cookie, body });
  assert.equal((await troca(ana, { itens: ["demo-047"], motivo: "Veio com defeito no footswitch" })).status, 409, "ainda não concluído");
  await call(`/admin/orders/${order.id}`, { method: "PATCH", cookie: boss, body: { status: "Concluído" } });
  assert.equal((await call(`/orders/${order.id}`, { method: "GET", cookie: ana })).body.data.prazoTroca.aberta, true);
  assert.equal((await troca(bia, { itens: ["demo-047"], motivo: "Veio com defeito no footswitch" })).status, 404, "pedido de outra pessoa");
  assert.equal((await troca(ana, { itens: ["demo-999"], motivo: "Veio com defeito no footswitch" })).status, 400);
  assert.equal((await troca(ana, { itens: ["demo-047"], motivo: "curto" })).status, 400);
  const ok = await troca(ana, { itens: ["demo-047"], tipo: "devolucao", motivo: "Veio com defeito no footswitch" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.trocas[0].tipo, "devolucao");
  assert.equal((await troca(ana, { itens: ["demo-021"], motivo: "Quero trocar o cabo também" })).status, 409, "uma solicitação por vez");
  assert.equal((await call(`/admin/orders/${order.id}/troca`, { method: "PATCH", cookie: boss, body: { status: "Talvez" } })).status, 400);
  const answered = await call(`/admin/orders/${order.id}/troca`, { method: "PATCH", cookie: boss, body: { status: "Aprovada", resposta: "Pode enviar pelos Correios com o código 123." } });
  assert.equal(answered.body.data.trocas[0].status, "Aprovada");
  const notes = (await call("/notifications", { method: "GET", cookie: ana })).body.data.itens.map((n) => n.titulo);
  assert.ok(notes.some((x) => /Devolução aprovada/.test(x)) && notes.some((x) => /Devolução solicitada/.test(x)));
  // Prazo vencido
  const stored = await storage.getByRowKey("orders", order.id);
  assert.equal(exchangeWindow({ ...stored, statusHistory: [{ status: "Concluído", at: "2020-01-01T00:00:00Z" }] }).aberta, false);
});
