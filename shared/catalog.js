// Regras de catálogo usadas pela loja (web/), pelos testes e, quando preciso, pelo servidor:
// categorias, preço formatado, fotos e cores, busca tolerante e "Compre junto".
// Sem DOM e sem armazenamento: o estado do navegador fica em web/src/lib.
import { specText, affinity, UTILITY_EFFECTS } from "./specs.js";

/** @typedef {{ nome: string, hex: string, estoque?: number }} Cor */
/** @typedef {{ url: string, cor: string | null, vista?: string }} Foto */
/**
 * @typedef {{ id: string, rowKey?: string, marca: string, modelo: string, categoria: string, descricao?: string,
 *   priceCents: number, estoque: number, imageUrl?: string, blobName?: string, cores?: Cor[], fotos?: Foto[],
 *   ficha?: Record<string, unknown> }} Produto
 */

export const categories = ["Guitarras", "Pedais", "Amplificadores", "Cabos", "Correias", "Acessórios"];
/** @type {Record<string, string>} */
export const categoryInfo = {
  Guitarras: "Corpos marcantes e acabamentos feitos para o palco.",
  Pedais: "Efeitos, pedaleiras e pedalboards para moldar o timbre.",
  Amplificadores: "Valvulados e combos para ensaio, estúdio e show.",
  Cabos: "Conexões firmes do instrumento ao amplificador.",
  Correias: "Conforto e personalidade para tocar em pé.",
  Acessórios: "Suportes, palhetas e o que mais o setup pede.",
};
/** @param {number} cents */
export const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
/** @param {unknown} value */
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Busca sem diferenciar acentos e maiúsculas.
/** @param {unknown} value */
export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
/** Identificadores aceitos no carrinho, favoritos e comparação. @param {unknown} id */
export const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);

/** @param {Partial<Produto> | null | undefined} product */
export function productImage(product) {
  if (product?.blobName) return product.imageUrl || `/api/images/${encodeURIComponent(product.id || product.rowKey || "")}`;
  if (product?.imageUrl) return product.imageUrl;
  /** @type {Record<string, string>} */
  const fallbacks = {
    Guitarras: "/assets/product.svg",
    Pedais: "/assets/pedal.svg",
    Amplificadores: "/assets/amp.svg",
    Cabos: "/assets/accessory.svg",
    Correias: "/assets/accessory.svg",
    Acessórios: "/assets/accessory.svg",
  };
  return fallbacks[product?.categoria || ""] || "/assets/product.svg";
}
// Galeria por cor (etapa 29): fotos da cor escolhida, ou todas quando o produto não tem cores.
/** @param {Partial<Produto>} product @param {string | null | undefined} cor @returns {Foto[]} */
export function photosOf(product, cor) {
  const fotos = Array.isArray(product?.fotos) && product.fotos.length ? product.fotos : null;
  if (!fotos) return [{ url: productImage(product), cor: null, vista: "frente" }];
  const colored = cor ? fotos.filter((f) => f.cor === cor) : [];
  return colored.length ? colored : fotos.filter((f) => f.cor === fotos[0].cor);
}
/** @param {Partial<Produto> | null | undefined} product @returns {string[]} */
export const colorNames = (product) => (Array.isArray(product?.cores) ? product.cores.map((c) => c.nome) : []);
// Cor válida do item (a escolhida, se o produto tiver; senão a padrão) e a foto dela.
/** @param {Partial<Produto>} product @param {string | null | undefined} cor */
export const itemColor = (product, cor) => {
  const names = colorNames(product);
  return names.length ? (names.includes(/** @type {string} */ (cor)) ? /** @type {string} */ (cor) : names[0]) : null;
};
/** @param {Partial<Produto>} product @param {string | null | undefined} cor */
export const itemImage = (product, cor) => photosOf(product, itemColor(product, cor))[0].url;
/** @param {Produto} product */
export function stockState(product) {
  if (!product.estoque) return { key: "out", label: "Esgotado" };
  if (product.estoque <= 5) return { key: "low", label: "Últimas unidades" };
  return { key: "in", label: "Em estoque" };
}

/** @template {Produto} T @param {T[]} products @param {string} query @returns {T[]} */
export function searchProducts(products, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return products;
  return products
    .map((p) => {
      const title = normalize(`${p.marca} ${p.modelo}`);
      const facets = normalize(`${title} ${p.categoria} ${specText(p)}`);
      const all = `${facets} ${normalize(p.descricao)}`;
      if (!terms.every((t) => all.includes(t))) return null;
      let score = 0;
      for (const t of terms) {
        if (normalize(p.modelo).startsWith(t)) score += 4;
        if (title.includes(t)) score += 3;
        else if (facets.includes(t)) score += 2;
        else score += 0.5;
      }
      return { p, score };
    })
    .filter((r) => r !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
}
// Tolerância a erros de digitação: distância de edição entre palavras (com transposição).
/** @param {string} a @param {string} b */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
// "Você quis dizer": troca termos desconhecidos pela palavra mais próxima do catálogo
// (marca, modelo, categoria e descrição); devolve null quando a correção não traz resultados.
/** @param {Produto[]} products @param {string} query @returns {string | null} */
export function correctQuery(products, query) {
  const vocabulary = new Set(categories.map(normalize));
  for (const p of products)
    for (const word of normalize(`${p.marca} ${p.modelo} ${p.categoria} ${p.descricao || ""} ${specText(p)}`).split(/[^a-z0-9]+/))
      if (word.length >= 3) vocabulary.add(word);
  const words = [...vocabulary];
  let changed = false;
  const fixed = normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      if (term.length < 4 || words.some((w) => w.startsWith(term))) return term;
      const limit = term.length >= 7 ? 2 : 1;
      let best = null;
      let bestDistance = limit + 1;
      for (const w of words) {
        if (Math.abs(w.length - term.length) > limit) continue;
        const distance = editDistance(term, w);
        if (distance < bestDistance) [best, bestDistance] = [w, distance];
      }
      if (!best) return term;
      changed = true;
      return best;
    })
    .join(" ");
  return changed && searchProducts(products, fixed).length ? fixed : null;
}

// Compre junto: para cada categoria que completa o produto, o item em estoque que mais combina
// pela ficha (gêneros e estilo) e cabe no orçamento; empate fica com o mais acessível.
/** @param {Produto} x */
const instrumentCable = (x) => x.ficha?.tipo !== "Patch";
/** @param {Produto} x */
const effect = (x) => !UTILITY_EFFECTS.includes(/** @type {string} */ (x.ficha?.efeito));
/** @type {Record<string, [string, ((x: Produto, p: Produto) => boolean)?][]>} */
const complements = {
  Guitarras: [["Cabos", instrumentCable], ["Correias"], ["Amplificadores"]],
  Amplificadores: [["Cabos", instrumentCable], ["Pedais", effect]],
  Pedais: [["Cabos", (x) => x.ficha?.tipo === "Patch"], ["Pedais", (x, p) => (effect(p) ? ["Pedalboard", "Afinador"].includes(/** @type {string} */ (x.ficha?.efeito)) : effect(x))]],
  Cabos: [["Pedais", effect], ["Acessórios"]],
  Correias: [["Acessórios"], ["Cabos", instrumentCable]],
  Acessórios: [["Cabos", instrumentCable], ["Correias"]],
};
/** @template {Produto} T @param {T} p @param {T[]} others @returns {T[]} */
export function bundlePicks(p, others) {
  /** @type {T[]} */
  const picks = [];
  for (const [category, fits = () => true] of complements[p.categoria] || []) {
    const all = others.filter((x) => x.categoria === category && !picks.includes(x));
    const suitable = all.filter((x) => fits(x, p));
    const pool = suitable.length ? suitable : all;
    const affordable = pool.filter((x) => x.priceCents <= Math.max(p.priceCents * 1.5, 30000));
    const item = (affordable.length ? affordable : pool).sort((a, b) => affinity(p, b) - affinity(p, a) || a.priceCents - b.priceCents)[0];
    if (item) picks.push(item);
    if (picks.length === 2) break;
  }
  return picks;
}
