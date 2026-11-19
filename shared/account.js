// Minha conta: seções (menu "Olá, ..." e navegação da página), iniciais do avatar, endereço de
// retorno depois do login, texto do método de pagamento preferido e rota pela âncora (#pedidos).

/** @typedef {{ id: string, icon: string, label: string, href: string, menu: boolean, nav: boolean }} Secao */
// menu: aparece no menu do cabeçalho; nav: aparece na navegação lateral da conta.
/** @type {Secao[]} */
export const accountSections = [
  { id: "visao-geral", icon: "grid", label: "Visão geral", href: "/minha-conta.html", menu: true, nav: true },
  { id: "pedidos", icon: "package", label: "Meus pedidos", href: "/minha-conta.html#pedidos", menu: true, nav: true },
  { id: "dados", icon: "user", label: "Dados e segurança", href: "/minha-conta.html#dados", menu: true, nav: true },
  { id: "enderecos", icon: "pin", label: "Endereços", href: "/minha-conta.html#enderecos", menu: true, nav: true },
  { id: "pagamentos", icon: "card", label: "Métodos de pagamento", href: "/minha-conta.html#pagamentos", menu: true, nav: true },
  { id: "avisos", icon: "tag", label: "Avisos de estoque e preço", href: "/minha-conta.html#avisos", menu: true, nav: true },
  { id: "notificacoes", icon: "bell", label: "Notificações", href: "/minha-conta.html#notificacoes", menu: false, nav: true },
  { id: "favoritos", icon: "heart", label: "Favoritos", href: "/favoritos.html", menu: true, nav: false },
  { id: "encomendas", icon: "wrench", label: "Encomendas", href: "/encomenda.html#minhas", menu: true, nav: false },
  { id: "ajuda", icon: "question", label: "Preciso de ajuda", href: "/minha-conta.html#ajuda", menu: true, nav: true },
];
/** @param {string | null | undefined} nome */
export const initials = (nome) =>
  String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (i === 0 || i === all.length - 1 ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
// Endereço de retorno depois do login: só páginas internas da loja (com busca e âncora opcionais).
/** @param {unknown} next @returns {string | null} */
export function safeNext(next) {
  if (typeof next !== "string" || next.length > 300) return null;
  if (!/^\/(?!\/)(?:[a-z0-9-]+\.html)?(?:\?[\w=&%.,+-]{0,200})?(?:#[\w-]{1,40})?$/i.test(next)) return null;
  return /^\/(login|cadastro)\.html/.test(next) ? null : next;
}
/** @param {{ metodo: string, parcelas?: number } | null | undefined} p */
export function paymentText(p) {
  if (!p) return "";
  if (p.metodo === "cartao") return `Cartão de crédito, ${(p.parcelas || 1) > 1 ? `${p.parcelas}x sem juros` : "à vista"}`;
  return p.metodo === "pix" ? "Pix" : "Boleto";
}
// Seções da página: a âncora (#pedidos) escolhe a seção, e links antigos como #seguranca abrem
// a seção certa já na parte indicada.
const VIEWS = accountSections.filter((s) => s.nav);
/** @type {Record<string, string>} */
const ALIASES = { seguranca: "dados", perfil: "dados" };
/** @param {string | null | undefined} hash @returns {{ view: string, anchor?: string }} */
export function routeFromHash(hash) {
  const id = decodeURIComponent(String(hash || "").replace(/^#/, ""));
  if (VIEWS.some((v) => v.id === id)) return { view: id };
  if (ALIASES[id]) return { view: ALIASES[id], anchor: id };
  return { view: "visao-geral" };
}
