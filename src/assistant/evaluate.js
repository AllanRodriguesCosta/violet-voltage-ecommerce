// Avaliação do assistente pelo pipeline completo (classificador + regras + diálogo),
// com o catálogo do manifesto. Usada pelo teste e por "npm run agente:eval".
import { reply } from "./index.js";
import { extract } from "./entities.js";
import { evalSet, dialogs } from "./eval-set.js";
import { seedProducts } from "../services/seed-products.js";

export async function evaluate(products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }))) {
  const perIntent = {};
  const errors = [];
  const entityErrors = [];
  for (const [mensagem, expected, entities, extra = {}] of evalSet) {
    const r = await reply({ mensagem, ...extra }, { products, user: { nome: "Avaliação" } });
    const stats = (perIntent[expected] ||= { total: 0, ok: 0 });
    stats.total++;
    if (r.intencao === expected) stats.ok++;
    else errors.push({ mensagem, esperado: expected, obtido: r.intencao, confianca: r.confianca });
    if (entities) {
      const found = extract(mensagem, products);
      for (const [key, value] of Object.entries(entities))
        if (found[key] !== value) entityErrors.push({ mensagem, campo: key, esperado: value, obtido: found[key] });
    }
  }
  const dialogErrors = [];
  for (const d of dialogs) {
    let contexto;
    for (const [mensagem, intent, pattern, extra = {}] of d.passos) {
      const r = await reply({ mensagem, contexto, ...extra }, { products, user: { nome: "Avaliação" } });
      contexto = r.contexto;
      if (r.intencao !== intent || !pattern.test(r.texto)) dialogErrors.push({ conversa: d.nome, mensagem, intencao: r.intencao, texto: r.texto.slice(0, 120) });
    }
  }
  const total = evalSet.length;
  const ok = Object.values(perIntent).reduce((s, x) => s + x.ok, 0);
  const entityChecks = evalSet.reduce((s, [, , e]) => s + (e ? Object.keys(e).length : 0), 0);
  return {
    acuracia: ok / total,
    total,
    porIntencao: Object.fromEntries(Object.entries(perIntent).map(([k, v]) => [k, { ...v, acuracia: v.ok / v.total }])),
    erros: errors,
    entidades: { total: entityChecks, acertos: entityChecks - entityErrors.length, erros: entityErrors },
    dialogos: { total: dialogs.length, erros: dialogErrors },
  };
}
