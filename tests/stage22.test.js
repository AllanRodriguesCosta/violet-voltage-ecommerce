import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { SERVICES, servicePrice, servicesFor, cleanServices } from "../public/js/services.js";
import { calculate } from "../src/services/checkout.js";
import { quote } from "../src/services/pricing.js";
import { checkSpecs, specRows, SPEC_FIELDS } from "../public/js/specs.js";
import { guides } from "../src/knowledge/guides.js";
import { glossary, glossaryId } from "../src/knowledge/glossary.js";
import { authorName } from "../src/services/questions.js";
import { deleteAccount } from "../src/services/account.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import bcrypt from "bcryptjs";

const catalog = seedProducts.map((p) => ({ ...p, ativo: true }));
const byId = (id) => catalog.find((p) => p.rowKey === id);

test("catálogo: IDs estáveis das etapas 21 e 22 e fichas das guitarras completas", () => {
  assert.equal(byId("demo-076").modelo, "Fonte 9V 1A Pedal Power");
  assert.equal(byId("demo-077").modelo, "JP-02 Fonte Isolada 10 Saídas");
  assert.deepEqual(["demo-078", "demo-079", "demo-080"].map((id) => byId(id).modelo), ["Affinity Telecaster Canhota", "GRG7221 7 Cordas", "EC-401"]);
  for (const p of catalog.filter((x) => x.categoria === "Guitarras")) {
    assert.equal(checkSpecs(p.categoria, p.ficha).erro, undefined, p.modelo);
    for (const key of ["mao", "cordas", "captadores", "trastes", "escala"]) assert.ok(p.ficha[key], `${p.modelo}: ${key}`);
  }
  const values = (key) => new Set(catalog.filter((x) => x.categoria === "Guitarras").map((p) => p.ficha[key]));
  assert.deepEqual([...values("mao")].sort(), ["Canhoto", "Destro"]);
  assert.deepEqual([...values("cordas")].sort(), ["6 cordas", "7 cordas"]);
  assert.deepEqual([...values("captadores")].sort(), ["Ativos", "Passivos"]);
  const escala = specRows(byId("demo-027")).find((r) => r.field.key === "escala");
  assert.equal(escala.text, '24,75"');
});

test("serviços: preço por categoria, garantia proporcional e validação no servidor", () => {
  const guitar = byId("demo-035");
  const pedal = byId("demo-049");
  assert.deepEqual(servicesFor(guitar).map((s) => s.id), ["regulagem", "cordas", "garantia"]);
  assert.deepEqual(servicesFor(pedal).map((s) => s.id), ["garantia"]);
  assert.deepEqual(servicesFor(byId("demo-021")), [], "cabo não tem serviço");
  assert.equal(servicePrice("garantia", guitar), Math.round((guitar.priceCents * 0.08) / 10) * 10);
  assert.equal(servicePrice("garantia", { categoria: "Pedais", priceCents: 1000 }), SERVICES.garantia.minCents);
  assert.deepEqual(cleanServices(["regulagem", "regulagem", "x", "cordas"], pedal), []);
  const items = calculate([{ id: "demo-035", quantidade: 2, servicos: ["regulagem", "garantia"] }, { id: "demo-021", quantidade: 1 }], catalog);
  assert.deepEqual(items[0].servicos.map((s) => s.id), ["regulagem", "garantia"]);
  assert.equal(items[1].servicos, undefined);
  assert.throws(() => calculate([{ id: "demo-021", quantidade: 1, servicos: ["regulagem"] }], catalog), /indisponível/);
  assert.throws(() => calculate([{ id: "demo-035", quantidade: 1, servicos: ["regulagem", "regulagem"] }], catalog), /inválidos/);
  assert.throws(() => calculate([{ id: "demo-035", quantidade: 1, servicos: "regulagem" }], catalog), /inválidos/);
  const t = quote(items, { entrega: "padrao", cupom: "VOLTAGE10" });
  const services = (12000 + servicePrice("garantia", guitar)) * 2;
  assert.equal(t.servicosCents, services);
  assert.equal(t.descontoCents, Math.round((t.subtotalCents * 10) / 100), "cupom não incide sobre serviços");
  assert.equal(t.totalCents, t.subtotalCents + services + t.freteCents - t.descontoCents);
});

test("guias e glossário: página publicada em dia e atalhos do catálogo válidos", async () => {
  const html = await readFile(new URL("../public/guias.html", import.meta.url), "utf8");
  for (const g of guides) {
    assert.ok(html.includes(`id="${g.id}"`), g.id);
    for (const [, href] of g.links) {
      const url = new URL(href, "http://x");
      if (url.pathname !== "/catalogo.html") continue;
      const categoria = url.searchParams.get("categoria");
      for (const [key, value] of url.searchParams) {
        if (key === "categoria") continue;
        const field = SPEC_FIELDS[categoria].find((f) => f.key === key);
        assert.ok(field?.filter && field.values.includes(value), `${g.id}: ${key}=${value}`);
      }
    }
  }
  assert.equal(new Set(glossary.map((t) => glossaryId(t.termo))).size, glossary.length, "ids únicos");
  for (const t of glossary) {
    assert.ok(html.includes(`id="${glossaryId(t.termo)}"`), t.termo);
    if (t.guia) assert.ok(guides.some((g) => g.id === t.guia), t.termo);
  }
});

test("API: serviços no pedido, aviso de queda de preço e perguntas e respostas", async (t) => {
  const { call, register, admin } = await storeFixture(t);
  const ana = await register("ana@s22.test");
  const bia = await register("bia@s22.test");
  const boss = await admin();
  // Serviços persistem no pedido.
  const order = await call("/orders", { cookie: ana, body: { requestId: randomUUID(), items: [{ id: "demo-035", quantidade: 1, servicos: ["regulagem"] }], entrega: "retirada", pagamento: "pix", endereco: "Retirada na loja" } });
  assert.equal(order.status, 201);
  assert.equal(order.body.data.servicosCents, 12000);
  assert.equal(order.body.data.itens[0].servicos[0].nome, "Regulagem por luthier");
  assert.equal(order.body.data.totalCents, order.body.data.subtotalCents + 12000);
  // Aviso de queda de preço em item disponível.
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "demo-024", tipo: "preco" } })).status, 201);
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "demo-024", tipo: "outro" } })).status, 400);
  assert.equal((await call("/alerts", { cookie: ana, body: { productId: "demo-024" } })).status, 409, "estoque continua só para esgotados");
  const current = (await call("/products/demo-024", { method: "GET" })).body.data;
  const edit = (priceCents) => call("/admin/products/demo-024", { method: "PATCH", cookie: boss, body: { marca: current.marca, modelo: current.modelo, categoria: current.categoria, descricao: current.descricao, estoque: current.estoque, priceCents } });
  await edit(current.priceCents + 1000);
  let notes = (await call("/notifications", { method: "GET", cookie: ana })).body.data.itens.filter((n) => n.tipo === "preco");
  assert.equal(notes.length, 0, "aumento não avisa");
  await edit(current.priceCents - 50000);
  notes = (await call("/notifications", { method: "GET", cookie: ana })).body.data.itens.filter((n) => n.tipo === "preco");
  assert.equal(notes.length, 1);
  assert.match(notes[0].titulo, /Baixou o preço/);
  assert.match(notes[0].texto, /R\$ 3\.499,00 por R\$ 2\.999,00/);
  await edit(current.priceCents - 60000);
  assert.equal((await call("/notifications", { method: "GET", cookie: ana })).body.data.itens.filter((n) => n.tipo === "preco").length, 1, "avisa uma vez");
  const alerts = (await call("/alerts", { method: "GET", cookie: ana })).body.data;
  assert.equal(alerts[0].tipo, "preco");
  assert.ok(alerts[0].notifiedAt);
  assert.equal((await call("/alerts/demo-024?tipo=preco", { method: "DELETE", cookie: ana })).status, 200);
  assert.equal((await call("/alerts", { method: "GET", cookie: ana })).body.data.length, 0);
  // Perguntas e respostas.
  assert.equal((await call("/products/demo-031/questions", { body: { pergunta: "Serve para jazz com cordas lisas?" } })).status, 401);
  assert.equal((await call("/products/demo-031/questions", { cookie: ana, body: { pergunta: "curta" } })).status, 400);
  const asked = await call("/products/demo-031/questions", { cookie: ana, body: { pergunta: "Serve para jazz com cordas lisas?" } });
  assert.equal(asked.status, 201);
  assert.equal(asked.body.data.autor, "Cliente T.");
  assert.equal((await call("/products/demo-031/questions", { cookie: ana, body: { pergunta: "Serve para jazz com cordas lisas?" } })).status, 409, "pergunta repetida");
  assert.deepEqual((await call("/products/demo-031/questions", { method: "GET" })).body.data, [], "pendente não aparece");
  assert.equal((await call("/admin/summary", { method: "GET", cookie: boss })).body.data.perguntasPendentes, 1);
  assert.equal((await call(`/admin/questions/${asked.body.data.id}`, { method: "PATCH", cookie: ana, body: { resposta: "Sim" } })).status, 403);
  await call(`/admin/questions/${asked.body.data.id}`, { method: "PATCH", cookie: boss, body: { resposta: "Serve sim: o captador e o corpo semiacústico combinam com jazz." } });
  const published = (await call("/products/demo-031/questions", { method: "GET" })).body.data;
  assert.equal(published.length, 1);
  assert.match(published[0].resposta, /semiacústico/);
  const note = (await call("/notifications", { method: "GET", cookie: ana })).body.data.itens.find((n) => n.tipo === "pergunta");
  assert.equal(note.link, "/produto.html?id=demo-031#perguntas");
  const hidden = await call("/products/demo-031/questions", { cookie: bia, body: { pergunta: "Pergunta fora do assunto da loja" } });
  await call(`/admin/questions/${hidden.body.data.id}`, { method: "PATCH", cookie: boss, body: { ocultar: true } });
  assert.equal((await call("/products/demo-031/questions", { method: "GET" })).body.data.length, 1, "oculta não aparece");
  for (let i = 0; i < 5; i++) await call(`/products/demo-0${40 + i}/questions`, { cookie: bia, body: { pergunta: `Pergunta número ${i} sobre o produto` } });
  assert.equal((await call("/products/demo-050/questions", { cookie: bia, body: { pergunta: "Mais uma pergunta sobre o produto" } })).status, 429);
  // Cópia dos dados e exclusão: pendentes somem, respondidas ficam sem nome.
  const exported = (await call("/account/export", { method: "GET", cookie: ana })).body;
  assert.equal(exported.perguntas.length, 1);
  assert.equal(authorName("Maria da Silva"), "Maria S.");
  assert.equal(authorName(""), "Cliente");
});

test("exclusão da conta: perguntas pendentes somem e respondidas ficam sem nome", async () => {
  const storage = new MemoryStorage();
  const user = { partitionKey: "cliente", rowKey: "q@t.test", id: "u1", nome: "Quem Pergunta", role: "customer", ativo: true, passwordHash: await bcrypt.hash("senha-teste-1", 4) };
  await storage.create("customers", user);
  const base = { productId: "p1", partitionKey: "p1", customerId: "u1", autor: "Quem P.", createdAt: new Date().toISOString() };
  await storage.create("questions", { ...base, rowKey: "q1", pergunta: "Pergunta respondida aqui", resposta: "Sim", status: "respondida", respondidaEm: base.createdAt });
  await storage.create("questions", { ...base, rowKey: "q2", pergunta: "Pergunta ainda pendente", status: "pendente" });
  await deleteAccount(storage, await storage.get("customers", "cliente", "q@t.test"), { senha: "senha-teste-1" });
  const left = await storage.list("questions");
  assert.deepEqual(left.map((q) => [q.rowKey, q.autor, q.customerId]), [["q1", "Cliente", null]]);
});
