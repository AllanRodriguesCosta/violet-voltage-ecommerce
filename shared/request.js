// Etapa 33: encomendas. Dados vindos do assistente pelo endereço:
// ?tipo=personalizado&itens=Base: ...; Captadores: ...&descricao=...
/** @param {string} search @returns {{ tipo: string, produto: string, detalhes: string } | null} */
export function fromQuery(search) {
  const q = new URLSearchParams(search);
  if (!q.get("descricao") && !q.get("itens")) return null;
  const itens = (q.get("itens") || "").split(";").map((s) => s.trim()).filter(Boolean);
  const base = itens.find((i) => /^Base:/.test(i))?.replace(/^Base:\s*/, "");
  const descricao = (q.get("descricao") || "").slice(0, 300);
  return {
    tipo: q.get("tipo") === "importacao" ? "importacao" : "personalizado",
    produto: (base || descricao || "").slice(0, 120),
    detalhes: [itens.filter((i) => !/^Base:/.test(i)).join("\n"), descricao && `Pedido ao assistente: “${descricao}”`].filter(Boolean).join("\n\n").slice(0, 1500),
  };
}
