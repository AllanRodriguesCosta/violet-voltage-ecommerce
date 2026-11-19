// Serviços da loja contratados por item do carrinho (por unidade). Sem DOM: o servidor
// valida e cobra com estas mesmas regras (src/services/checkout.js e pricing.js).
export const SERVICES = Object.freeze({
  regulagem: {
    nome: "Regulagem por luthier",
    texto: "Altura das cordas, oitavas, tensor e captadores ajustados antes do envio.",
    priceCents: 12000,
    categorias: ["Guitarras"],
  },
  cordas: {
    nome: "Troca de cordas",
    texto: "Encordoamento 0.10 novo instalado e afinado (cordas inclusas).",
    priceCents: 4500,
    categorias: ["Guitarras"],
  },
  garantia: {
    nome: "Garantia estendida de 12 meses",
    texto: "Mais 12 meses além da garantia do fabricante, com conserto ou troca.",
    percent: 8,
    minCents: 2990,
    categorias: ["Guitarras", "Amplificadores", "Pedais"],
  },
});
export const SERVICE_IDS = Object.keys(SERVICES);
export const servicesFor = (product) =>
  SERVICE_IDS.filter((id) => product && SERVICES[id].categorias.includes(product.categoria)).map((id) => ({ id, ...SERVICES[id], priceCents: servicePrice(id, product) }));
// Preço por unidade do produto; a garantia acompanha o valor do item.
export function servicePrice(id, product) {
  const s = SERVICES[id];
  if (!s || !product) return 0;
  if (s.percent) return Math.max(s.minCents, Math.round((product.priceCents * s.percent) / 100 / 10) * 10);
  return s.priceCents;
}
// Normaliza a lista de serviços de um item: só os conhecidos e aplicáveis, sem repetição.
export function cleanServices(list, product) {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(servicesFor(product).map((s) => s.id));
  return [...new Set(list.filter((id) => typeof id === "string" && allowed.has(id)))];
}
