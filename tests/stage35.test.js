// Etapa 35: buscas no painel (sem identificar quem buscou), carrinhos esquecidos e frases não
// entendidas no resumo, e os testes de navegador e Lighthouse no CI.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storeFixture } from "./helpers/api-fixture.js";
import { searchTerm, logSearch, searchSummary } from "../src/services/searches.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { demandHTML } from "../public/js/admin.js";

const read = (f) => readFile(new URL(`../${f}`, import.meta.url), "utf8");

test("termo de busca: normalizado e sem dado pessoal", () => {
  assert.equal(searchTerm("  Stratocaster  SSS!! "), "stratocaster sss");
  assert.equal(searchTerm("Guitarra Elétrica"), "guitarra eletrica");
  assert.equal(searchTerm("a"), null);
  assert.equal(searchTerm("ana@exemplo.com"), null);
  assert.equal(searchTerm("pedido 12345678"), null);
  assert.equal(searchTerm("11 98888-7777"), null);
  assert.equal(searchTerm("ds-1"), "ds-1");
});

test("resumo de buscas: mais buscados, sem resultado, corrigidos e retenção de 90 dias", async () => {
  const storage = new MemoryStorage();
  const old = new Date(Date.now() - 100 * 86400000);
  await logSearch(storage, { termo: "velho", resultados: 0 }, old);
  for (let i = 0; i < 3; i++) await logSearch(storage, { termo: "Les Paul", resultados: 4 });
  await logSearch(storage, { termo: "theremin", resultados: 0 });
  await logSearch(storage, { termo: "theremin", resultados: 0 });
  await logSearch(storage, { termo: "strato", resultados: 0, corrigido: "stratocaster" });
  assert.equal(await logSearch(storage, { termo: "x", resultados: 1 }), false);
  await assert.rejects(() => logSearch(storage, { termo: "ok", resultados: -1 }), /inválida/);
  const s = await searchSummary(storage);
  assert.equal(s.total, 6, "a busca de 100 dias atrás saiu");
  assert.deepEqual(s.maisBuscados.map((x) => x.termo), ["les paul", "theremin", "strato"]);
  assert.deepEqual(s.semResultado.map((x) => x.termo), ["theremin"], "corrigida não conta como sem resultado");
  assert.equal(s.corrigidos[0].corrigido, "stratocaster");
});

test("API: /buscas é pública e anônima; o resumo do painel traz buscas, carrinhos e assistente", async (t) => {
  const { call, admin, register, storage } = await storeFixture(t);
  assert.equal((await call("/buscas", { body: { termo: "theremin", resultados: 0 } })).status, 202);
  assert.equal((await call("/buscas", { body: { termo: "theremin", resultados: "0" } })).status, 400);
  const saved = await storage.list("searches");
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0]).sort(), ["createdAt", "etag", "partitionKey", "resultados", "rowKey", "termo"]);
  const ana = await register("ana@s35.test");
  await call("/cart", { method: "PUT", cookie: ana, body: { itens: [{ id: "demo-001", quantidade: 2 }] } });
  await call("/assistente", { body: { mensagem: "qual a capital da mongólia?" } });
  const boss = await admin();
  const s = (await call("/admin/summary", { method: "GET", cookie: boss })).body.data;
  assert.equal(s.buscas.semResultado[0].termo, "theremin");
  assert.equal(s.carrinhos.carrinhosSalvos, 1);
  assert.equal(s.carrinhos.abandonados, 0, "ainda não passou 24 h");
  assert.equal(typeof s.assistente.frasesNaoEntendidas, "number");
  assert.equal((await call("/admin/buscas", { method: "GET", cookie: ana })).status, 403);
  assert.equal((await call("/admin/buscas", { method: "DELETE", cookie: boss })).status, 200);
  assert.equal((await storage.list("searches")).length, 0);
  const html = demandHTML(s);
  assert.match(html, /O que mais procuram/);
  assert.match(html, /“theremin”/);
  assert.match(html, /role="img"/);
});

test("CI: roteiro de navegador e Lighthouse; catálogo envia a busca; privacidade explica", async () => {
  const [workflow, smoke, server, lhci, catalog, privacy, gitignore] = await Promise.all(
    [".github/workflows/quality.yml", "tests/e2e/smoke.mjs", "scripts/e2e-server.js", "lighthouserc.json", "public/js/pages/catalog.js", "public/privacidade.html", ".gitignore"].map(read),
  );
  assert.match(workflow, /\n  e2e:\n/);
  assert.match(workflow, /node tests\/e2e\/smoke\.mjs/);
  assert.match(workflow, /\n  lighthouse:\n/);
  assert.match(workflow, /@lhci\/cli/);
  assert.match(smoke, /process\.exit\(failed \? 1 : 0\)/);
  assert.match(server, /MemoryStorage/);
  const config = JSON.parse(lhci);
  assert.deepEqual(config.ci.assert.assertions["categories:accessibility"], ["error", { minScore: 0.9 }]);
  assert.match(config.ci.collect.startServerCommand, /e2e-server/);
  assert.match(catalog, /send\("\/buscas"/);
  assert.match(privacy, /sem identificar quem buscou/);
  assert.match(gitignore, /lighthouse-relatorios/);
});
