// Busca na Central de Ajuda (src/knowledge/help.js) por palavras em comum, com peso maior
// para as raras (IDF). Pergunta e termos valem inteiro; o texto da resposta vale 30%.
import { helpEntries } from "../knowledge/help.js";
import { tokens, STOPWORDS, stem } from "./text.js";

const QUESTION_WORDS = new Set(["qual", "quais", "quand", "ond", "porqu", "pod", "poss", "consig", "fac", "faz", "algum", "sab", "quer", "quer", "voc"]);
const terms = (value) => [...new Set(tokens(value).filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem).filter((s) => !QUESTION_WORDS.has(s)))];
const index = helpEntries.map((entry) => ({ entry, question: new Set(terms(`${entry.pergunta} ${entry.termos || ""}`)), answer: new Set(terms(entry.resposta)) }));
const df = new Map();
for (const { question, answer } of index) for (const s of new Set([...question, ...answer])) df.set(s, (df.get(s) || 0) + 1);
const idf = (s) => Math.log(1 + index.length / (df.get(s) || 0.5));

export function searchHelp(text) {
  const query = terms(text);
  if (!query.length) return null;
  const total = query.reduce((sum, s) => sum + idf(s), 0);
  let best = null;
  for (const item of index) {
    let score = 0;
    let hits = 0;
    for (const s of query) {
      if (item.question.has(s)) {
        score += idf(s);
        hits++;
      } else if (item.answer.has(s)) score += 0.3 * idf(s);
    }
    if (!best || score > best.score) best = { entry: item.entry, score, hits, ratio: score / total };
  }
  return best;
}
// Forte o bastante para responder sozinha: duas palavras da pergunta e boa parte da frase.
export const strongHelp = (hit) => Boolean(hit && hit.hits >= 2 && hit.ratio >= 0.5);
