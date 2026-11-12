import test from "node:test";
import assert from "node:assert/strict";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { geminiConfig, askGemini, limiter, grounding, DEFAULT_MODEL } from "../src/assistant/gemini.js";
import { configuration } from "../src/config/index.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const config = { apiKey: "chave-de-teste", model: "modelo-teste", timeoutMs: 200, perMinute: 2 };
const answer = (text, status = 200) => async () => ({ ok: status === 200, status, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });

test("Gemini: configuração só pelo ambiente, padrões e limites", () => {
  assert.equal(geminiConfig({}), null);
  assert.equal(geminiConfig({ GEMINI_API_KEY: "  " }), null);
  const c = geminiConfig({ GEMINI_API_KEY: "abc", GEMINI_MODEL: "x y; drop", GEMINI_TIMEOUT_MS: "999999", GEMINI_PER_MINUTE: "0" });
  assert.deepEqual(c, { apiKey: "abc", model: DEFAULT_MODEL, timeoutMs: 15000, perMinute: 8 });
  assert.equal(geminiConfig({ GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.5-flash" }).model, "gemini-2.5-flash");
  assert.equal(configuration({ DEV_MEMORY_STORAGE: "true" }).gemini, null);
  let t = 0;
  const take = limiter(2, () => t);
  assert.deepEqual([take(), take(), take()], [true, true, false]);
  t = 61000;
  assert.equal(take(), true, "libera depois de um minuto");
});

test("Gemini: resposta validada, dados da loja e falhas caem para a resposta local", async () => {
  let sent;
  const spy = async (url, init) => {
    sent = { url, init, body: JSON.parse(init.body) };
    return answer('```json\n{"texto": "<b>A</b> Jazzmaster   é ótima para surf.", "produtos": ["demo-032", "inventado", "demo-016"]}\n```')();
  };
  const outOfStock = products.map((p) => (p.id === "demo-016" ? { ...p, estoque: 0 } : p));
  const r = await askGemini("tenho o email ana@x.com, qual guitarra para surf?", outOfStock, config, { fetchImpl: spy });
  assert.deepEqual(r, { texto: "A Jazzmaster é ótima para surf.", produtos: ["demo-032"] });
  assert.match(sent.url, /models\/modelo-teste:generateContent$/);
  assert.equal(sent.init.headers["x-goog-api-key"], "chave-de-teste");
  assert.ok(!sent.url.includes("chave-de-teste"), "chave fora da URL");
  assert.equal(sent.body.contents[0].parts[0].text, "tenho o email [e-mail], qual guitarra para surf?");
  assert.match(sent.body.systemInstruction.parts[0].text, /demo-032 \| Squier Classic Vibe '60s Jazzmaster \| Guitarras \| R\$ 3699,00/);
  assert.match(grounding(products).rules, /frete grátis|Frete/i);
  assert.equal(await askGemini("x", products, config, { fetchImpl: answer("{}", 429) }), null, "limite do plano gratuito");
  assert.equal(await askGemini("x", products, config, { fetchImpl: answer("não é json") }), null);
  assert.equal(await askGemini("x", products, config, { fetchImpl: answer('{"texto": ""}') }), null);
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("abortado"))));
  assert.equal(await askGemini("x", products, config, { fetchImpl: slow }), null, "tempo limite");
  assert.equal(await askGemini("x", products, null), null, "sem chave");
});

test("API: só frases não entendidas vão ao Gemini, com aviso e limite por minuto", async (t) => {
  let calls = 0;
  const geminiFetch = async (...args) => {
    calls++;
    return answer('{"texto": "Para timbre de surf, uma offset com tremolo combina.", "produtos": ["demo-032"]}')(...args);
  };
  const { call, register } = await storeFixture(t, { config: { gemini: { ...config, perMinute: 1 }, geminiFetch } });
  const ana = await register("ana@s25.test");
  const understood = (await call("/assistente", { cookie: ana, body: { mensagem: "quero uma guitarra para blues" } })).body.data;
  assert.equal(understood.fonte, undefined);
  assert.equal(calls, 0, "PLN local entendeu: Gemini não é chamado");
  const g = (await call("/assistente", { cookie: ana, body: { mensagem: "blablabla som praiano dos anos sessenta" } })).body.data;
  assert.equal(g.fonte, "gemini");
  assert.equal(g.intencao, "gemini");
  assert.equal(g.cards[0].id, "demo-032");
  const local = (await call("/assistente", { cookie: ana, body: { mensagem: "xyzzy plugh frobozz" } })).body.data;
  assert.equal(local.intencao, "nao_entendi", "acima do limite por minuto, fica a resposta local");
  assert.equal(calls, 1);
  assert.equal((await call("/health", { method: "GET" })).body.data.assistente, "pln-local+gemini");
});
