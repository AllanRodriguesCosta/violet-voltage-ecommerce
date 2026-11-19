// Endereços de entrega: UFs, máscara de CEP, sugestão de UF pelo CEP e o texto do endereço
// (mesmo formato do servidor em src/services/addresses.js, conferido por teste).
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
// Faixas de CEP por estado, usadas apenas para sugerir a UF; a pessoa pode trocar.
/** @type {[string, number, number][]} */
const RANGES = [
  ["SP", 1000, 19999], ["RJ", 20000, 28999], ["ES", 29000, 29999], ["MG", 30000, 39999], ["BA", 40000, 48999],
  ["SE", 49000, 49999], ["PE", 50000, 56999], ["AL", 57000, 57999], ["PB", 58000, 58999], ["RN", 59000, 59999],
  ["CE", 60000, 63999], ["PI", 64000, 64999], ["MA", 65000, 65999], ["PA", 66000, 68899], ["AP", 68900, 68999],
  ["AM", 69000, 69299], ["RR", 69300, 69399], ["AM", 69400, 69899], ["AC", 69900, 69999], ["DF", 70000, 72799],
  ["GO", 72800, 72999], ["DF", 73000, 73699], ["GO", 73700, 76799], ["RO", 76800, 76999], ["TO", 77000, 77999],
  ["MT", 78000, 78899], ["MS", 79000, 79999], ["PR", 80000, 87999], ["SC", 88000, 89999], ["RS", 90000, 99999],
];
/** @param {unknown} cep */
export function ufFromCep(cep) {
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length < 5) return "";
  const prefix = Number(digits.slice(0, 5));
  return RANGES.find(([, from, to]) => prefix >= from && prefix <= to)?.[0] || "";
}
/** @param {unknown} value */
export function formatCep(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
/** @param {{ logradouro: string, numero: string, complemento?: string, bairro: string, cidade: string, uf: string, cep: string }} a */
export const formatAddress = (a) =>
  `${a.logradouro}, ${a.numero}${a.complemento ? ` - ${a.complemento}` : ""}, ${a.bairro}, ${a.cidade} - ${a.uf}, CEP ${a.cep}`;
