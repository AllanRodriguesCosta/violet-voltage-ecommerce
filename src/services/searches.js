// Etapa 35: o que os clientes procuram no catálogo. Cada busca vira um registro sem
// identificação (sem conta, IP ou sessão), com o termo normalizado e quantos produtos
// apareceram. Termos com e-mail ou muitos dígitos (telefone, CPF, pedido) são descartados.
// Ficam 90 dias; o painel mostra os mais buscados e os que não tiveram resultado.
import { randomUUID } from "node:crypto";
import { AppError } from "../utils/validation.js";

export const RETENTION_DAYS = 90;
export function searchTerm(value) {
  const t = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (t.length < 2 || /@/.test(String(value)) || (t.match(/\d/g) || []).length >= 6) return null;
  return t;
}
export async function logSearch(storage, body = {}, now = new Date()) {
  const termo = searchTerm(body.termo);
  const resultados = body.resultados;
  if (!Number.isInteger(resultados) || resultados < 0 || resultados > 10000) throw new AppError(400, "Busca inválida.");
  if (!termo) return false;
  const corrigido = body.corrigido ? searchTerm(body.corrigido) : null;
  const limit = new Date(now.getTime() - RETENTION_DAYS * 86400000).toISOString();
  for (const old of (await storage.list("searches")).filter((x) => x.createdAt < limit)) await storage.remove("searches", old.partitionKey, old.rowKey);
  await storage.create("searches", { partitionKey: "busca", rowKey: randomUUID(), termo, resultados, ...(corrigido && corrigido !== termo ? { corrigido } : {}), createdAt: now.toISOString() });
  return true;
}
// Agrupado por termo: vezes, resultados da última busca, correção sugerida e data.
export async function searchSummary(storage, limit = 10) {
  const groups = new Map();
  for (const x of await storage.list("searches")) {
    const g = groups.get(x.termo) || { termo: x.termo, vezes: 0, ultima: x.createdAt, resultados: x.resultados, corrigido: x.corrigido || null };
    g.vezes++;
    if (x.createdAt >= g.ultima) Object.assign(g, { ultima: x.createdAt, resultados: x.resultados, corrigido: x.corrigido || null });
    groups.set(x.termo, g);
  }
  const all = [...groups.values()].sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima));
  return {
    total: all.reduce((s, g) => s + g.vezes, 0),
    maisBuscados: all.slice(0, limit),
    semResultado: all.filter((g) => g.resultados === 0 && !g.corrigido).slice(0, limit),
    corrigidos: all.filter((g) => g.corrigido).slice(0, limit),
  };
}
export async function clearSearches(storage) {
  for (const x of await storage.list("searches")) await storage.remove("searches", x.partitionKey, x.rowKey);
}
