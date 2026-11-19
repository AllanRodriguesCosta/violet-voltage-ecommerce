// Todas as páginas da loja: nome do arquivo .html -> componente.
// Usado pelo pré-render (scripts/prerender.js) e pelos testes. As páginas em "bare" são
// pré-renderizadas sem o Layout e sem hidratação (offline.html, servida pelo service worker).
import type { ComponentType } from "react";
import Home from "./Home";
import Catalog from "./Catalog";
import Product from "./Product";
import Compare from "./Compare";
import Wishlist from "./Wishlist";
import Cart from "./Cart";
import Checkout from "./Checkout";
import Order from "./Order";
import Account from "./Account";
import Login from "./Login";
import Register from "./Register";
import Setup from "./Setup";
import Kits from "./Kits";
import Request from "./Request";
import Partners from "./Partners";
import Guides from "./Guides";
import Help from "./Help";
import Terms from "./Terms";
import Privacy from "./Privacy";
import NotFound from "./NotFound";
import Offline from "./Offline";
import Admin from "./Admin";

export const pages: Record<string, ComponentType> = {
  index: Home,
  catalogo: Catalog,
  produto: Product,
  comparar: Compare,
  favoritos: Wishlist,
  carrinho: Cart,
  checkout: Checkout,
  pedido: Order,
  "minha-conta": Account,
  login: Login,
  cadastro: Register,
  setup: Setup,
  kits: Kits,
  encomenda: Request,
  parceiros: Partners,
  guias: Guides,
  ajuda: Help,
  termos: Terms,
  privacidade: Privacy,
  "404": NotFound,
  offline: Offline,
  admin: Admin,
};
export const bare = new Set(["offline"]);
