// Teste rápido do Gemini com a chave real: npm run agente:smoke
// Precisa de GEMINI_API_KEY no .env (nunca é exibida). Não usa banco: catálogo do manifesto.
import "dotenv/config";
import { geminiConfig, askGemini } from "../src/assistant/gemini.js";
import { seedProducts } from "../src/services/seed-products.js";

const config = geminiConfig();
if (!config) {
  console.error("GEMINI_API_KEY não configurada no .env. Veja docs/FERRAMENTAS-E-BIBLIOTECAS.txt (Google AI Studio).");
  process.exit(1);
}
const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const perguntas = [
  "qual guitarra o Jimi Hendrix usava e vocês têm algo parecido?",
  "meu amplificador está chiando quando ligo o pedal, o que pode ser?",
  "quem ganhou a copa de 2002?",
];
console.log(`Modelo: ${config.model} (tempo limite ${config.timeoutMs} ms)\n`);
let falhas = 0;
for (const pergunta of perguntas) {
  const inicio = Date.now();
  const r = await askGemini(pergunta, products, config);
  const ms = Date.now() - inicio;
  if (!r) falhas++;
  console.log(`> ${pergunta}\n  ${r ? r.texto : "(sem resposta: o site usaria a resposta local)"}${r?.produtos.length ? `\n  produtos: ${r.produtos.join(", ")}` : ""}\n  ${ms} ms\n`);
}
console.log(falhas ? `${falhas} de ${perguntas.length} sem resposta. Confira a chave, o modelo (GEMINI_MODEL) e os limites em aistudio.google.com/rate-limit.` : "Gemini respondendo.");
process.exitCode = falhas === perguntas.length ? 1 : 0;
