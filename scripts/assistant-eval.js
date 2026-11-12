// Relatório de acerto do assistente (PLN local): npm run agente:eval
import { evaluate } from "../src/assistant/evaluate.js";

const r = await evaluate();
const pct = (x) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
console.log(`Intenção: ${pct(r.acuracia)} de acerto em ${r.total} frases que não estão no treino.\n`);
console.log("Intenção            Acertos  Acurácia");
for (const [intent, s] of Object.entries(r.porIntencao).sort())
  console.log(`${intent.padEnd(20)}${`${s.ok}/${s.total}`.padEnd(9)}${pct(s.acuracia)}`);
console.log(`\nEntidades: ${r.entidades.acertos}/${r.entidades.total} campos corretos.`);
console.log(`Conversas: ${r.dialogos.total - new Set(r.dialogos.erros.map((e) => e.conversa)).size}/${r.dialogos.total} sem erro.`);
if (r.erros.length) console.log(`\nErros de intenção:\n${r.erros.map((e) => `  "${e.mensagem}": esperado ${e.esperado}, obtido ${e.obtido} (${e.confianca})`).join("\n")}`);
if (r.entidades.erros.length) console.log(`\nErros de entidade:\n${r.entidades.erros.map((e) => `  "${e.mensagem}": ${e.campo} esperado ${e.esperado}, obtido ${e.obtido}`).join("\n")}`);
if (r.dialogos.erros.length) console.log(`\nErros nas conversas:\n${r.dialogos.erros.map((e) => `  [${e.conversa}] "${e.mensagem}" → ${e.intencao}: ${e.texto}`).join("\n")}`);
if (r.acuracia < 0.9 || r.dialogos.erros.length) process.exitCode = 1;
