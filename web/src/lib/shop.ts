// Ponto de entrada da lógica da loja para páginas e componentes: estado do navegador
// (lib/cart.ts, lib/api.ts, lib/toast.ts) e regras compartilhadas com o servidor (shared/).
export { api, send } from "./api";
export { toast, type ToastOptions } from "./toast";
export {
  catalogProducts,
  getCart,
  setCart,
  cartQuantity,
  addCart,
  getWishlist,
  isWished,
  setWishlist,
  toggleWishlist,
  getRecent,
  pushRecent,
  logout,
  emit,
} from "./cart";
export { categories, money, productImage, escapeHtml, normalize } from "../../../shared/catalog.js";
export { accountSections, initials, safeNext } from "../../../shared/account.js";
export { maxInstallments, installmentValue, FREE_SHIPPING_CENTS } from "../../../shared/pricing.js";
export type { Product, User, CartItem } from "./types";
