// Estado da loja neste navegador: carrinho (espelhado na conta com login, etapa 34), favoritos,
// vistos recentemente, buscas recentes e o catálogo carregado uma vez por visita.
// Mudanças avisam a página por eventos (vv:cart, vv:wishlist, vv:cart-added) lidos em store.ts.
import { createCartSync } from "../../../shared/cart-sync.js";
import { colorNames, itemColor, normalize, validId } from "../../../shared/catalog.js";
import { api, send } from "./api";
import { toast } from "./toast";
import type { CartItem, Product, User } from "./types";

// Eventos internos da loja; ignorados quando não há DOM (pré-render e testes).
export function emit(name: string, detail?: unknown) {
  const doc = globalThis.document;
  if (typeof doc?.dispatchEvent === "function") doc.dispatchEvent(new CustomEvent(name, { detail }));
}
function readList(key: string): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data.filter(validId) : [];
  } catch {
    return [];
  }
}

// Catálogo compartilhado por cabeçalho, minicarrinho e páginas: uma consulta por visita.
let catalogRequest: Promise<Product[]> | undefined;
export function catalogProducts({ fresh = false } = {}): Promise<Product[]> {
  if (fresh || !catalogRequest)
    catalogRequest = api<Product[]>("/products").catch((error) => {
      catalogRequest = undefined;
      throw error;
    });
  return catalogRequest.then((list) => [...list]);
}

const SERVICE_IDS = ["regulagem", "cordas", "garantia"];
export function getCart(): CartItem[] {
  try {
    const data = JSON.parse(localStorage.getItem("vv_cart") || "[]");
    // Serviços opcionais por item (ids conhecidos; o servidor confere a categoria).
    return Array.isArray(data)
      ? data
          .filter((i) => validId(i?.id) && Number.isInteger(i.quantidade) && i.quantidade > 0 && i.quantidade <= 99)
          .map((i) => {
            const servicos: string[] = Array.isArray(i.servicos) ? [...new Set<string>(i.servicos.filter((s: string) => SERVICE_IDS.includes(s)))] : [];
            const cor = typeof i.cor === "string" && i.cor.length <= 30 ? { cor: i.cor as string } : {};
            return servicos.length ? { id: i.id, quantidade: i.quantidade, ...cor, servicos } : { id: i.id, quantidade: i.quantidade, ...cor };
          })
      : [];
  } catch {
    return [];
  }
}
const write = (items: CartItem[]) => {
  localStorage.setItem("vv_cart", JSON.stringify(items));
  emit("vv:cart", items);
};
// Com login, o carrinho também fica salvo na conta (outro aparelho e lembrete).
const cartSync = createCartSync({
  request: (path: string, body?: unknown, method?: string) => (body === undefined ? api(path) : send(path, body, method)),
  read: () => getCart(),
  write,
});
export function setCart(items: CartItem[]) {
  write(items);
  cartSync.changed(items);
}
export const cartQuantity = () => getCart().reduce((sum, item) => sum + item.quantidade, 0);
export const startCartSync = (user: User) => cartSync.start(user);

export type AddOptions = { notify?: boolean; source?: Element | null; cor?: string };
export type CartAdded = { product: Product; quantity: number; source?: Element | null; cor?: string; recolored: boolean };
export function addCart(product: Product, quantity = 1, { notify = true, source, cor }: AddOptions = {}) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    toast("Informe uma quantidade inteira entre 1 e 99.", { type: "error" });
    return false;
  }
  const cart = getCart();
  const current = cart.find((i) => i.id === product.id);
  if ((current?.quantidade || 0) + quantity > Math.min(99, product.estoque)) {
    toast("Quantidade maior que o estoque disponível.", { type: "error" });
    return false;
  }
  // Uma linha por produto: escolher outra cor troca a cor da linha (e o aviso diz isso).
  const chosen = cor && colorNames(product).includes(cor) ? cor : undefined;
  const recolored = Boolean(current && chosen && itemColor(product, current.cor) !== chosen);
  if (current) {
    current.quantidade += quantity;
    if (chosen) current.cor = chosen;
  } else cart.push({ id: product.id, quantidade: quantity, ...(chosen ? { cor: chosen } : {}) });
  try {
    setCart(cart);
  } catch {
    toast("Não foi possível salvar o carrinho. Verifique as permissões de armazenamento do navegador e tente novamente.", { type: "error" });
    return false;
  }
  if (notify) emit("vv:cart-added", { product, quantity, source, cor: chosen, recolored });
  return true;
}

// Lista de desejos e vistos recentemente ficam neste navegador.
export const getWishlist = () => readList("vv_wishlist");
export const isWished = (id: string) => getWishlist().includes(id);
export function setWishlist(ids: string[]) {
  localStorage.setItem("vv_wishlist", JSON.stringify(ids.filter(validId).slice(0, 100)));
  emit("vv:wishlist", ids);
}
export function toggleWishlist(id: string) {
  const list = getWishlist();
  const wished = list.includes(id);
  try {
    setWishlist(wished ? list.filter((x) => x !== id) : [id, ...list]);
  } catch {
    toast("Não foi possível salvar seus favoritos neste navegador.", { type: "error" });
    return wished;
  }
  return !wished;
}
export const getRecent = () => readList("vv_recent");
export function pushRecent(id: string) {
  if (!validId(id)) return;
  try {
    localStorage.setItem("vv_recent", JSON.stringify([id, ...getRecent().filter((x) => x !== id)].slice(0, 12)));
  } catch {
    // Sem armazenamento local, a vitrine apenas não mostra vistos recentemente.
  }
}

// Buscas recentes neste navegador (até 5), mostradas nas sugestões.
export const recentSearches = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem("vv_searches") || "[]");
    return Array.isArray(list) ? list.filter((q) => typeof q === "string" && q.length <= 80).slice(0, 5) : [];
  } catch {
    return [];
  }
};
export function rememberSearch(query: string) {
  const q = String(query || "").trim().slice(0, 80);
  if (normalize(q).length < 2) return;
  try {
    localStorage.setItem("vv_searches", JSON.stringify([q, ...recentSearches().filter((x) => normalize(x) !== normalize(q))].slice(0, 5)));
  } catch {
    // Sem armazenamento local, a busca segue sem histórico.
  }
}
export function clearSearches() {
  try {
    localStorage.removeItem("vv_searches");
  } catch {
    // Nada a limpar.
  }
}

// Sair: encerra a sessão no servidor e apaga a conversa do assistente desta aba.
export async function logout() {
  try {
    await send("/auth/logout", {});
    cartSync.stop();
  } catch (error) {
    toast((error as Error).message, { type: "error" });
    return;
  }
  try {
    sessionStorage.removeItem("vv_assistente");
  } catch {
    // Sem armazenamento da aba, não há conversa para apagar.
  }
  location.href = "/";
}
