// Carrinho e checkout: itens com o produto atual do catálogo, totais exibidos, preferências
// guardadas neste navegador (cupom, CEP, entrega) e a cotação do servidor (/checkout/quote).
import { cepDigits } from "../../../shared/regions.js";
import { servicePrice } from "../../../shared/services.js";
import { send } from "./api";
import { catalogProducts, getCart } from "./cart";
import type { CartItem, Product } from "./types";

export type CartRow = CartItem & { product?: Product };
export async function cartData(): Promise<CartRow[]> {
  const cart = getCart();
  const products = await catalogProducts({ fresh: true });
  return cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }));
}
export const subtotal = (items: CartRow[]) => items.reduce((sum, i) => sum + (i.product?.priceCents || 0) * i.quantidade, 0);
export const servicesTotal = (items: CartRow[]) =>
  items.reduce((sum, i) => sum + (i.servicos || []).reduce((t, id) => t + (i.product ? servicePrice(id, i.product) : 0), 0) * i.quantidade, 0);
// Preferências do checkout guardadas neste navegador.
export const prefs = {
  get coupon() {
    try {
      return localStorage.getItem("vv_coupon") || "";
    } catch {
      return "";
    }
  },
  set coupon(value: string) {
    try {
      if (value) localStorage.setItem("vv_coupon", value);
      else localStorage.removeItem("vv_coupon");
    } catch {
      /* opcional */
    }
  },
  // Etapa 34: CEP para calcular o frete por região (só os 8 dígitos).
  get cep() {
    try {
      return cepDigits(localStorage.getItem("vv_cep")) || "";
    } catch {
      return "";
    }
  },
  set cep(value: string) {
    try {
      const digits = cepDigits(value);
      if (digits) localStorage.setItem("vv_cep", digits);
      else localStorage.removeItem("vv_cep");
    } catch {
      /* opcional */
    }
  },
  get delivery() {
    try {
      return localStorage.getItem("vv_delivery") || "padrao";
    } catch {
      return "padrao";
    }
  },
  set delivery(value: string) {
    try {
      localStorage.setItem("vv_delivery", value);
    } catch {
      /* opcional */
    }
  },
};
export const fetchQuote = <T = unknown>(entrega: string, cupom?: string, cep: string | null = prefs.cep) =>
  send<T>("/checkout/quote", { items: getCart(), entrega, ...(cupom ? { cupom } : {}), ...(cepDigits(cep) ? { cep: cepDigits(cep) } : {}) });
