// Etapa 34: frete por região. O primeiro dígito do CEP indica a região (faixas dos Correios);
// cada região tem um fator sobre o frete base e dias a mais no prazo. O servidor usa este mesmo
// arquivo (src/services/pricing.js), então vitrine e checkout nunca divergem.
export const REGIONS = Object.freeze([
  { id: "sp", nome: "Estado de São Paulo", digitos: "01", fator: 1, dias: 0 },
  { id: "rj-es", nome: "Rio de Janeiro e Espírito Santo", digitos: "2", fator: 1.1, dias: 1 },
  { id: "mg", nome: "Minas Gerais", digitos: "3", fator: 1.1, dias: 1 },
  { id: "ba-se", nome: "Bahia e Sergipe", digitos: "4", fator: 1.3, dias: 2 },
  { id: "ne", nome: "Pernambuco, Alagoas, Paraíba e Rio Grande do Norte", digitos: "5", fator: 1.4, dias: 3 },
  { id: "n", nome: "Norte, Ceará, Piauí e Maranhão", digitos: "6", fator: 1.6, dias: 4 },
  { id: "co", nome: "Centro-Oeste, Tocantins e Rondônia", digitos: "7", fator: 1.3, dias: 2 },
  { id: "pr-sc", nome: "Paraná e Santa Catarina", digitos: "8", fator: 1.15, dias: 1 },
  { id: "rs", nome: "Rio Grande do Sul", digitos: "9", fator: 1.2, dias: 2 },
]);
export const DELIVERY_DAYS = Object.freeze({ padrao: [5, 8], expressa: [1, 3] });
export function cepDigits(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}
// CEP dentro de um endereço digitado ("Rua X, 10 - 01310-100 São Paulo").
export function cepFromText(value) {
  const m = String(value ?? "").match(/(?:^|\D)(\d{5})-?(\d{3})(?!\d)/);
  return m ? m[1] + m[2] : null;
}
export function regionFor(cep) {
  const d = cepDigits(cep);
  return d ? REGIONS.find((r) => r.digitos.includes(d[0])) || null : null;
}
// Preço arredondado para múltiplos de R$ 0,10; a retirada continua grátis.
export const regionalPrice = (baseCents, region) => (region && baseCents ? Math.round((baseCents * region.fator) / 10) * 10 : baseCents);
export function regionalPrazo(entrega, region) {
  const days = DELIVERY_DAYS[entrega];
  if (!days || !region || !region.dias) return null;
  const extra = entrega === "expressa" ? Math.ceil(region.dias / 2) : region.dias;
  return `${days[0] + extra} a ${days[1] + extra} dias úteis`;
}
export const formatCep = (cep) => {
  const d = cepDigits(cep);
  return d ? `${d.slice(0, 5)}-${d.slice(5)}` : "";
};
