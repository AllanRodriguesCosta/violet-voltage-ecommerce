import { AppError, integer } from "../utils/validation.js";
import { kitDiscounts } from "../../public/js/kits.js";
import { regionFor, regionalPrice, regionalPrazo } from "../../public/js/regions.js";

// Regras comerciais únicas para cotação e pedido. Valores em centavos.
export const shipping = { padrao: 2500, expressa: 4500, retirada: 0 };
export const delivery = {
  padrao: { label: "Entrega padrão", prazo: "5 a 8 dias úteis" },
  expressa: { label: "Entrega expressa", prazo: "1 a 3 dias úteis" },
  retirada: { label: "Retirada na loja", prazo: "Disponível em 1 dia útil" },
};
export const FREE_SHIPPING_CENTS = 99900;
export const MAX_INSTALLMENTS = 10;
export const MIN_INSTALLMENT_CENTS = 5000;
export const coupons = Object.freeze({
  VOLTAGE10: { type: "percent", value: 10, maxCents: 50000, description: "10% de desconto nos produtos, até R$ 500,00" },
  PRIMEIROACORDE: { type: "fixed", value: 3000, minCents: 20000, description: "R$ 30,00 de desconto a partir de R$ 200,00" },
  FRETEVOLT: { type: "shipping", description: "Frete grátis na entrega padrão ou expressa" },
});
const brl = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function maxInstallments(totalCents) {
  return Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(totalCents / MIN_INSTALLMENT_CENTS)));
}
export function couponCode(value) {
  if (value === undefined || value === null || value === "") return null;
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{3,30}$/.test(code)) throw new AppError(400, "Cupom inválido ou expirado.", "cupom");
  return code;
}
// Frete base de uma forma de entrega, ajustado pela região do CEP (etapa 34).
export const freightFor = (entrega, cep) => regionalPrice(shipping[entrega], regionFor(cep));
// items: itens já validados por calculate(), com priceCents do servidor.
// rules: cupons válidos agora (src/services/coupons.js); sem eles valem os cupons padrão.
export function quote(items, { entrega, cupom, cep, rules = coupons } = {}) {
  if (!Object.hasOwn(shipping, entrega)) throw new AppError(400, "Forma de entrega inválida.", "entrega");
  const region = regionFor(cep);
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantidade, 0);
  // Kits completos no carrinho ganham desconto automático; o cupom vale sobre o restante.
  const { kits, descontoKitsCents } = kitDiscounts(items);
  const baseCents = subtotalCents - descontoKitsCents;
  const servicosCents = items.reduce((sum, i) => sum + (i.servicos || []).reduce((t, s) => t + s.priceCents, 0) * i.quantidade, 0);
  const freteGratis = entrega === "padrao" && subtotalCents >= FREE_SHIPPING_CENTS;
  let freteCents = freteGratis ? 0 : regionalPrice(shipping[entrega], region);
  let descontoCents = 0;
  let applied = null;
  const code = couponCode(cupom);
  if (code) {
    const rule = Object.hasOwn(rules, code) ? rules[code] : null;
    if (!rule) throw new AppError(400, "Cupom inválido ou expirado.", "cupom");
    if (rule.minCents && subtotalCents < rule.minCents)
      throw new AppError(400, `Este cupom vale para compras a partir de ${brl(rule.minCents)}.`, "cupom");
    if (rule.type === "percent")
      descontoCents = Math.min(Math.round((baseCents * rule.value) / 100), rule.maxCents || Infinity);
    else if (rule.type === "fixed") descontoCents = Math.min(rule.value, baseCents);
    else if (rule.type !== "shipping") throw new AppError(400, "Cupom inválido ou expirado.", "cupom");
    else if (freteCents === 0)
      throw new AppError(400, "O frete desta compra já é grátis.", "cupom");
    else freteCents = 0;
    applied = { codigo: code, descricao: rule.description || rule.descricao };
  }
  const totalCents = baseCents + servicosCents + freteCents - descontoCents;
  return {
    subtotalCents,
    freteCents,
    descontoCents,
    descontoKitsCents,
    kits,
    servicosCents,
    totalCents,
    freteGratis,
    faltaFreteGratisCents: Math.max(0, FREE_SHIPPING_CENTS - subtotalCents),
    cupom: applied,
    regiao: region ? { id: region.id, nome: region.nome } : null,
    parcelasMax: maxInstallments(totalCents),
  };
}
export function installments(pagamento, value, totalCents) {
  if (pagamento !== "cartao" || value === undefined || value === null) return 1;
  return integer(value, "parcelas", 1, maxInstallments(totalCents));
}
export function deliveryOptions(subtotalCents, cep) {
  const region = regionFor(cep);
  return Object.entries(delivery).map(([id, info]) => ({
    id,
    ...info,
    prazo: regionalPrazo(id, region) || info.prazo,
    priceCents: id === "padrao" && subtotalCents >= FREE_SHIPPING_CENTS ? 0 : regionalPrice(shipping[id], region),
  }));
}
