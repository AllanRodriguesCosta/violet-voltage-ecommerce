import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { helpGroups, helpEntries } from "../src/knowledge/help.js";
import { searchHelp, strongHelp } from "../src/assistant/help-search.js";
import { reply } from "../src/assistant/index.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";

const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("Central de Ajuda: a página publicada corresponde à fonte única", async () => {
  const page = await readFile(new URL("../public/ajuda.html", import.meta.url), "utf8");
  for (const g of helpGroups) {
    assert.ok(page.includes(`id="${g.id}"`) && page.includes(`href="#${g.id}"`), g.id);
    for (const [i, item] of g.itens.entries()) {
      assert.ok(page.includes(`id="${g.id}-${i + 1}"`), `${g.id}-${i + 1}`);
      assert.ok(page.includes(html(item.pergunta)), item.pergunta);
      assert.ok(page.includes(html(item.resposta)), `resposta de "${item.pergunta}" desatualizada na página`);
    }
  }
  const text = helpEntries.map((e) => e.resposta).join(" ");
  assert.match(text, /R\$ 999,00/);
  assert.match(text, /10x sem juros, com parcela mínima de R\$ 50,00/);
  assert.match(text, /pergunte ao assistente quais estão ativos agora/);
  for (const topic of ["Como troco minha senha?", "Como baixo uma cópia dos meus dados?", "Como excluo minha conta?", "Como funciona o assistente?", "O que é o Monte seu setup?"])
    assert.ok(helpEntries.some((e) => e.pergunta === topic), topic);
});

test("busca na ajuda: acha a pergunta certa e não responde a pedidos de compra", async () => {
  const anchor = (t) => (strongHelp(searchHelp(t)) ? searchHelp(t).entry.ancora : null);
  assert.equal(anchor("o preço muda depois de colocar no carrinho?"), "pagamentos-4");
  assert.equal(anchor("quero excluir minha conta"), "conta-5");
  assert.equal(anchor("como faço para baixar meus dados"), "conta-4");
  assert.equal(anchor("produto esgotado, vocês avisam quando voltar?"), "produtos-3");
  assert.equal(anchor("quero uma guitarra"), null);
  assert.equal(anchor("recomenda um equipamento"), null);
  const products = [];
  const ask = async (mensagem) => reply({ mensagem }, { products, user: { nome: "T" } });
  const r = await ask("o assistente guarda minhas conversas?");
  assert.equal(r.intencao, "central_ajuda");
  assert.ok(r.acoes.some((a) => a.href === "/ajuda.html#produtos-4"));
  const pass = await ask("quero trocar minha senha");
  assert.equal(pass.intencao, "conta", "trocar senha não é troca de produto");
  assert.match(pass.texto, /Dados e segurança/);
  assert.equal((await ask("quero trocar o pedal que comprei")).intencao, "troca");
});

test("conta: trocar senha encerra outras sessões, baixar dados e excluir a conta", async (t) => {
  const storage = new MemoryStorage();
  await storage.create("products", { partitionKey: "pedais", rowKey: "p-1", marca: "Teste", modelo: "Fuzz", categoria: "Pedais", descricao: "Pedal de teste da conta.", priceCents: 20000, estoque: 5, ativo: true });
  const adminPassword = randomBytes(16).toString("hex");
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@seg.test", ADMIN_PASSWORD: adminPassword, ADMIN_NAME: "Admin Seg" });
  const http = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { method = "POST", body, cookie } = {}) => {
    const r = await fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body && JSON.stringify(body) });
    const raw = await r.text();
    return { status: r.status, headers: r.headers, body: raw ? JSON.parse(raw) : null, cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const senha = "senha-original-123";
  const ana = (await call("/auth/register", { body: { nome: "Ana Souza", email: "ana@seg.test", senha, telefone: "11 99999-0000" } })).cookie;
  const outra = (await call("/auth/login", { body: { email: "ana@seg.test", senha } })).cookie;
  const bia = (await call("/auth/register", { body: { nome: "Bia Lima", email: "bia@seg.test", senha } })).cookie;
  await sleep(1100); // a troca de senha precisa ser posterior ao segundo em que as sessões foram abertas

  // Trocar senha.
  const wrong = await call("/account/password", { cookie: ana, body: { atual: "errada-123456", nova: "senha-nova-4567" } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.field, "atual");
  assert.equal((await call("/account/password", { cookie: ana, body: { atual: senha, nova: "curta" } })).status, 400);
  assert.equal((await call("/account/password", { cookie: ana, body: { atual: senha, nova: senha } })).body.error.field, "nova");
  const changed = await call("/account/password", { cookie: ana, body: { atual: senha, nova: "senha-nova-4567" } });
  assert.equal(changed.status, 200);
  const nova = changed.cookie;
  assert.ok(nova, "sessão atual recebe cookie novo");
  assert.equal((await call("/auth/me", { method: "GET", cookie: nova })).status, 200);
  assert.equal((await call("/auth/me", { method: "GET", cookie: outra })).status, 401, "sessão aberta antes da troca é encerrada");
  assert.equal((await call("/auth/login", { body: { email: "ana@seg.test", senha } })).status, 401);
  assert.equal((await call("/auth/login", { body: { email: "ana@seg.test", senha: "senha-nova-4567" } })).status, 200);

  // Pedido e aviso para a cópia dos dados.
  const order = (await call("/orders", { cookie: nova, body: { items: [{ id: "p-1", quantidade: 1 }], pagamento: "pix", entrega: "retirada", endereco: "Retirada na loja", requestId: randomUUID() } })).body.data;
  await storage.create("alerts", { partitionKey: (await storage.get("customers", "cliente", "ana@seg.test")).id, rowKey: "x:p-2", productId: "p-2", createdAt: new Date().toISOString(), notifiedAt: null });
  const exported = await call("/account/export", { method: "GET", cookie: nova });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition"), /attachment; filename="violet-voltage-meus-dados.json"/);
  assert.equal(exported.headers.get("cache-control"), "no-store");
  assert.equal(exported.body.conta.email, "ana@seg.test");
  assert.equal(exported.body.pedidos.length, 1);
  assert.equal(exported.body.avisos.length, 1);
  const raw = JSON.stringify(exported.body);
  assert.ok(!raw.includes("passwordHash") && !raw.includes("bia@seg.test"), "sem senha e sem dados de outra pessoa");
  assert.equal((await call("/account/export", { method: "GET" })).status, 401);

  // Excluir conta.
  assert.equal((await call("/account/delete", { cookie: nova, body: { senha: "errada-123456" } })).status, 400);
  const blocked = await call("/account/delete", { cookie: nova, body: { senha: "senha-nova-4567" } });
  assert.equal(blocked.status, 409, "pedido em andamento impede a exclusão");
  assert.match(blocked.body.error.message, /1 pedido em andamento/);
  await call(`/orders/${order.id}/cancel`, { cookie: nova });
  const deleted = await call("/account/delete", { cookie: nova, body: { senha: "senha-nova-4567" } });
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get("set-cookie"), /vv_session=;/);
  assert.equal((await call("/auth/me", { method: "GET", cookie: nova })).status, 401);
  assert.equal((await call("/auth/login", { body: { email: "ana@seg.test", senha: "senha-nova-4567" } })).status, 401);
  const record = await storage.get("customers", "cliente", "ana@seg.test");
  assert.equal(record.ativo, false);
  assert.equal(record.nome, "Conta excluída");
  assert.equal(record.telefone, "");
  assert.deepEqual(record.enderecos, []);
  assert.equal(record.passwordHash, "");
  assert.equal((await storage.listByPartition("alerts", record.id)).length, 0);
  assert.equal((await storage.listByPartition("orders", record.id)).length, 1, "pedido fica como registro da venda");
  assert.equal((await call("/auth/me", { method: "GET", cookie: bia })).status, 200, "outra conta não é afetada");

  // Mesmo e-mail pode criar conta nova, sem herdar nada.
  const again = await call("/auth/register", { body: { nome: "Ana Nova", email: "ana@seg.test", senha: "outra-senha-890" } });
  assert.equal(again.status, 201);
  assert.notEqual(again.body.data.id, record.id);
  assert.equal((await call("/orders", { method: "GET", cookie: again.cookie })).body.data.length, 0);

  // Administrador não se exclui por aqui.
  const admin = (await call("/auth/login", { body: { email: "admin@seg.test", senha: adminPassword } })).cookie;
  assert.equal((await call("/account/delete", { cookie: admin, body: { senha: adminPassword } })).status, 400);
});
