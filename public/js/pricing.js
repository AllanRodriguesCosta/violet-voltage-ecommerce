// Regras exibidas na vitrine. O servidor recalcula tudo; um teste garante que
// estes valores são iguais aos de src/services/pricing.js.
export const shipping = { padrao: 2500, expressa: 4500, retirada: 0 };
export const delivery = {
  padrao: { label: "Entrega padrão", prazo: "5 a 8 dias úteis" },
  expressa: { label: "Entrega expressa", prazo: "1 a 3 dias úteis" },
  retirada: { label: "Retirada na loja", prazo: "Disponível em 1 dia útil" },
};
export const FREE_SHIPPING_CENTS = 99900;
export const MAX_INSTALLMENTS = 10;
export const MIN_INSTALLMENT_CENTS = 5000;
export function maxInstallments(totalCents) {
  return Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(totalCents / MIN_INSTALLMENT_CENTS)));
}
// Maior parcela (arredondada para cima), para nunca anunciar valor menor que o cobrado.
export const installmentValue = (totalCents, count) => Math.ceil(totalCents / count);
