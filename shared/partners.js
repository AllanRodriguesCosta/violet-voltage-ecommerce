// Etapa 33: ficha de parceria (fornecedores, marcas, distribuidores e luthiers). O CNPJ é
// conferido na página e no servidor (src/services/requests.js) com a mesma regra.
export const PRODUCTS = ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias", "Acessórios", "Peças e componentes", "Luthieria e serviços", "Outros"];
/** @param {unknown} value */
export function validCnpj(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  /** @param {number} len */
  const digit = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}
/** @param {unknown} value */
export const maskCnpj = (value) =>
  String(value)
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
