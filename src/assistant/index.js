// Assistente de compras da Violet Voltage: PLN local (intenção + entidades + diálogo com
// perguntas de afunilamento), respondendo só com dados reais da loja. Sem chave e sem internet.
import { train, classify } from "./classifier.js";
import { examples } from "./intents.js";
import { extract } from "./entities.js";
import { normalize } from "./text.js";
import { recommend, reasonFor, genreIntro, buildSetup, GROUP } from "./recommend.js";
import { faqAnswer, brl } from "./faq.js";
import { searchHelp, strongHelp } from "./help-search.js";
import { sanitizeContext } from "./context.js";
import { genreQuestion } from "../knowledge/genres.js";
import { maxInstallments, delivery, FREE_SHIPPING_CENTS } from "../services/pricing.js";
import {
  sanitizePage,
  targets,
  GLOSSARY_Q,
  findTerms,
  glossaryAnswer,
  compareAnswer,
  SPEC_WORDS,
  PRONOUN,
  specAnswer,
  addAnswer,
  couponAnswer,
  cartAnswer,
  kitsWithin,
  historyAnswer,
  favoritesAnswer,
  exchangeAnswer,
} from "./actions.js";

export const model = train(examples);
export const THRESHOLD = 0.45;

// Palavras que confirmam cada intenção informativa: sem elas, uma frase com produto vira busca.
const INFO = {
  entrega: /frete|entreg|prazo|cheg|retir|envio|correio|sedex|demor/,
  pagamento: /pag|pix|boleto|cart|parcel|juros|vezes|\d+ ?x\b/,
  cupom: /cupo|desconto|promo|codigo/,
  troca: /^(?!.*\b(senha|e-?mail|endereco|dados)\b).*(\btroc|devol|garantia|defeito|estragad|quebrad)/,
  conta: /senha|dados|e-?mail|endereco|favorit|cadastr|telefone|minha conta|da conta|na conta/,
  pedido_status: /\bpedidos?\b|minhas? compras?|encomenda|rastre|status|enviad|cheg|\bsaiu\b|recebi/,
  pedido_cancelar: /cancel|desist|arrepend/,
};
const CONVERSATION = ["saudacao", "ajuda", "agradecimento", "despedida", "setup", "fora_escopo"];
const SETUP_WORDS = /setup|complet|comec|tudo|equipamento|mont|junt|kit para|kit de guitarra/;
const SKIP = /\b(tanto faz|qualquer( um| uma)?|nao sei|sem preferencia|nao importa|pular|sem limite|sem orcamento)\b/;
const FILTERS = ["categoria", "tipo", "genero", "estilo", "formato", "captacao", "tecnologia", "voicing", "uso", "nivel", "marca", "min", "max", "mao", "cordas", "captadores", "trastes"];
const SPECIFIC = ["formato", "captacao", "tecnologia", "voicing", "tipo", "marca", "min", "max", "mao", "cordas", "captadores", "trastes"];
const START = ["Quero uma guitarra vintage", "Montar um setup de rock", "Onde está meu pedido?", "Como funciona o frete?"];
const GENRE_CHIPS = {
  Vintage: ["Blues", "Blues rock", "Rock clássico", "Surf", "Jazz", "Tanto faz"],
  Moderno: ["Heavy metal", "Pop", "Indie", "Shoegaze", "Tanto faz"],
  default: ["Rock clássico", "Blues", "Heavy metal", "Pop", "Indie", "Tanto faz"],
};

const link = (rotulo, href) => ({ tipo: "link", rotulo, href });
const card = (p, genero, prefixo) => ({
  id: p.id,
  marca: p.marca,
  modelo: p.modelo,
  categoria: p.categoria,
  priceCents: p.priceCents,
  estoque: p.estoque,
  imageUrl: p.imageUrl || "",
  motivo: [prefixo, reasonFor(p, genero)].filter(Boolean).join(" · "),
});
const parcels = (cents) => {
  const n = maxInstallments(cents);
  return n > 1 ? ` ou ${n}x de ${brl(Math.ceil(cents / n))} sem juros` : "";
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function describe(f) {
  const noun = f.tipo ? (f.categoria === "Pedais" ? `pedais de ${f.tipo.toLowerCase()}` : f.tipo.toLowerCase()) : f.categoria ? f.categoria.toLowerCase() : "equipamentos";
  const price = f.min && f.max ? ` entre ${brl(f.min)} e ${brl(f.max)}` : f.max ? ` até ${brl(f.max)}` : f.min ? ` a partir de ${brl(f.min)}` : "";
  const genre = f.genero && (!f.categoria || GROUP[f.categoria]) ? ` para ${f.genero.toLowerCase()}` : "";
  const traits = [f.mao === "Canhoto" ? "para canhotos" : "", f.cordas && f.cordas !== "6 cordas" ? `de ${f.cordas}` : "", f.captadores === "Ativos" ? "com captadores ativos" : "", f.trastes ? `com ${f.trastes} trastes` : ""].filter(Boolean).join(" ");
  return `${noun}${traits ? ` ${traits}` : ""}${f.marca ? ` da ${f.marca}` : ""}${f.estilo ? ` de estilo ${f.estilo.toLowerCase()}` : ""}${genre}${price}`;
}
export function catalogLink(f) {
  const params = new URLSearchParams();
  if (f.categoria) params.set("categoria", f.categoria);
  if (f.genero) params.set("generos", f.genero);
  if (f.estilo) params.set("estilo", f.estilo);
  if (f.marca) params.set("marca", f.marca);
  if (f.min) params.set("min", String(Math.floor(f.min / 100)));
  if (f.max) params.set("max", String(Math.ceil(f.max / 100)));
  if (f.categoria === "Guitarras") for (const k of ["formato", "captacao", "mao", "cordas", "captadores"]) if (f[k]) params.set(k, f[k]);
  if (f.categoria === "Amplificadores") {
    if (f.tecnologia) params.set("tecnologia", f.tecnologia === "Digital" ? "Modelagem digital" : f.tecnologia);
    if (f.voicing) params.set("voicing", f.voicing);
  }
  if (f.tipo && f.categoria === "Pedais") params.set("efeito", f.tipo);
  if (f.tipo && ["Cabos", "Acessórios"].includes(f.categoria)) params.set("tipo", f.tipo);
  return `/catalogo.html${params.size ? `?${params}` : ""}`;
}
const stockText = (p) =>
  !p.estoque ? "Está esgotado no momento; na página do produto dá para ativar o Avise-me." : p.estoque <= 5 ? `Últimas unidades: ${p.estoque} em estoque.` : "Em estoque.";

function ask(slot, f, perguntas, intent) {
  perguntas.add(slot);
  const contexto = { intent, filtros: f, aguardando: slot, perguntas: [...perguntas], mostrados: [] };
  if (slot === "categoria")
    return { texto: "Claro! O que você procura: guitarra, amplificador, pedal ou acessório?", sugestoes: ["Guitarra", "Amplificador", "Pedal", "Acessórios"], contexto };
  if (slot === "orcamento")
    return { texto: "E qual é o orçamento total, mais ou menos?", sugestoes: ["Até R$ 3 mil", "Até R$ 6 mil", "Até R$ 10 mil", "Sem limite"], contexto };
  const texto =
    intent === "setup"
      ? "Vamos montar! Para qual estilo musical é o setup?"
      : genreQuestion[f.estilo] || "Para qual estilo musical? Assim eu indico o timbre certo.";
  return { texto, sugestoes: GENRE_CHIPS[f.estilo] || GENRE_CHIPS.default, contexto };
}

function productInfo(found, f, perguntas) {
  const items = (f.categoria && found.some((p) => p.categoria === f.categoria) ? found.filter((p) => p.categoria === f.categoria) : found).slice(0, 3);
  const p = items[0];
  const texto =
    items.length === 1
      ? `${p.marca} ${p.modelo}: ${brl(p.priceCents)}${parcels(p.priceCents)}. ${stockText(p)} ${p.descricao}`
      : `Encontrei ${plural(items.length, "modelo", "modelos")} com esse nome:`;
  return {
    texto,
    cards: items.map((x) => card(x, f.genero)),
    acoes: items.length === 1 ? [link("Ver página do produto", `/produto.html?id=${encodeURIComponent(p.id)}`)] : [],
    sugestoes: [`Parecidos com ${p.modelo}`, "Como funciona o frete?"],
    contexto: { intent: "recomendar", filtros: { categoria: p.categoria, ...(f.genero ? { genero: f.genero } : {}) }, aguardando: null, perguntas: [...perguntas], mostrados: items.map((x) => x.id) },
  };
}

// Pedido novo ("quero um amplificador...") começa do zero; "e um amplificador?" ou a resposta
// a uma pergunta continuam a conversa e herdam gênero, estilo e nível.
const FRESH = /^(?:(?:eu|oi|ola|entao|bom dia|boa tarde|boa noite|agora)[,!.\s]+)*(quero|procuro|preciso|busco|gostaria|me (indica|mostra|sugere|recomenda)|estou procurando|to procurando|tem |voces tem|qual|quais|indica|recomenda)/;
function handleRecommend(e, ctx, products, { refine = false } = {}) {
  const fresh = !ctx.aguardando && FRESH.test(e.texto) && Boolean(e.categoria || e.tipo || e.genero);
  const carry = !fresh && (ctx.intent === "recomendar" || ctx.intent === "setup");
  const f = carry ? { ...ctx.filtros } : {};
  if (e.categoria && e.categoria !== f.categoria) for (const k of SPECIFIC) delete f[k];
  if (e.tipo && !e.categoria) {
    delete f.categoria;
    for (const k of SPECIFIC) delete f[k];
  }
  // Marca nova sem categoria nem tipo ("tem algo da Boss?"): a busca fica aberta à marca toda.
  if (e.marca && !e.categoria && !e.tipo && !e.formato) {
    delete f.categoria;
    for (const k of SPECIFIC) delete f[k];
  }
  for (const k of FILTERS) if (e[k] !== undefined) f[k] = e[k];
  const perguntas = new Set(carry ? ctx.perguntas : []);
  if (ctx.aguardando && SKIP.test(e.texto)) perguntas.add(ctx.aguardando);

  // "Parecidos com X": mesma categoria e gênero, sem repetir o produto.
  const similar = /^parecidos com /.test(e.texto);
  if (e.produtos.length && !similar) return productInfo(e.produtos, f, perguntas);
  if (similar && e.produtos[0]) {
    f.categoria = e.produtos[0].categoria;
    f.genero ??= e.produtos[0].ficha?.generos?.[0];
    refine = true;
    ctx = { ...ctx, mostrados: [...ctx.mostrados, e.produtos[0].id] };
  }

  if (!f.categoria && !f.tipo) {
    if (f.genero) {
      const picks = ["Guitarras", "Amplificadores", "Pedais"].map((categoria) => recommend(products, { ...f, categoria }, { limit: 1 }).items[0]).filter(Boolean);
      return {
        texto: `${genreIntro(f.genero, null, f.estilo)} Uma guitarra, um amplificador e um pedal que combinam:`,
        cards: picks.map((p) => card(p, f.genero)),
        sugestoes: [`Mais guitarras de ${f.genero}`, `Montar setup de ${f.genero}`, "E um pedal de overdrive?"],
        acoes: [link("Ver tudo no catálogo", catalogLink(f))],
        contexto: { intent: "recomendar", filtros: f, aguardando: null, perguntas: [...perguntas], mostrados: picks.map((p) => p.id) },
      };
    }
    if (!perguntas.has("categoria") && !f.marca && !f.max && !f.min) return ask("categoria", f, perguntas, "recomendar");
  }
  if (GROUP[f.categoria] && !f.genero && !perguntas.has("genero") && !SPECIFIC.some((k) => f[k]) && !refine) return ask("genero", f, perguntas, "recomendar");

  const exclude = refine ? ctx.mostrados : [];
  // "Mais barato"/"mais caro" comparam com o que já foi mostrado nesta busca.
  const bound = {};
  const shownPrices = ctx.mostrados.map((id) => products.find((p) => p.id === id)).filter((p) => p && (!f.categoria || p.categoria === f.categoria)).map((p) => p.priceCents);
  if (refine && shownPrices.length && e.ordem === "asc") bound.max = Math.min(f.max || Infinity, Math.min(...shownPrices) - 1);
  if (refine && shownPrices.length && e.ordem === "desc") bound.min = Math.max(f.min || 0, Math.max(...shownPrices) + 1);
  let result = recommend(products, { ...f, ...bound }, { exclude, ordem: e.ordem });
  let lead;
  if (!result.items.length && !refine) {
    if (f.max || f.min) {
      const loose = { ...f };
      delete loose.max;
      delete loose.min;
      const cheapest = recommend(products, loose, { ordem: "asc" });
      if (cheapest.items.length) {
        lead = `Não encontrei ${describe(f)}. ${f.max ? "Os mais acessíveis nessa linha:" : "As opções mais próximas:"}`;
        result = cheapest;
      }
    }
    if (!result.items.length) {
      const loose = { ...f };
      for (const k of ["formato", "captacao", "tecnologia", "voicing", "marca"]) delete loose[k];
      const near = recommend(products, loose, { ordem: e.ordem });
      if (near.items.length) {
        lead = `Não achei exatamente ${describe(f)}; estas são as opções mais próximas:`;
        result = near;
      }
    }
  }
  const shown = refine ? [...ctx.mostrados, ...result.items.map((p) => p.id)] : result.items.map((p) => p.id);
  const contexto = { intent: "recomendar", filtros: f, aguardando: null, perguntas: [...perguntas], mostrados: shown.slice(-30) };
  if (!result.items.length)
    return {
      texto: refine
        ? e.ordem === "asc"
          ? "As opções que mostrei já são as mais em conta com esses critérios."
          : e.ordem === "desc"
            ? "As opções que mostrei já são as mais completas com esses critérios."
            : "Essas eram todas as opções com esses critérios."
        : `Não encontrei ${describe(f)} em estoque agora.`,
      sugestoes: ["Quero uma guitarra", "Montar um setup", "Ver pedais"],
      acoes: [link("Ver o catálogo", catalogLink({ categoria: f.categoria }))],
      contexto,
    };
  const intro = f.genero && GROUP[f.categoria] && !refine && !lead ? genreIntro(f.genero, f.categoria, f.estilo) : "";
  const texto =
    lead ||
    (refine
      ? e.ordem === "asc"
        ? "Opções mais em conta:"
        : e.ordem === "desc"
          ? "Opções mais completas:"
          : "Mais opções:"
      : intro
        ? `${intro} Separei estas opções:`
        : `Separei ${result.items.length === 1 ? "esta opção" : "estas opções"} de ${describe(f)}:`);
  const sugestoes = [];
  if (result.remaining) sugestoes.push("Outras opções");
  if (e.ordem !== "asc") sugestoes.push("Mais barato");
  if (f.genero && f.categoria === "Guitarras") sugestoes.push("E um amplificador?");
  else if (f.genero && f.categoria === "Amplificadores") sugestoes.push("E um pedal?");
  if (f.genero && GROUP[f.categoria]) sugestoes.push(`Montar setup de ${f.genero}`);
  return {
    texto,
    cards: result.items.map((p) => card(p, f.genero)),
    sugestoes: sugestoes.slice(0, 4),
    acoes: [link("Ver tudo no catálogo", catalogLink(f))],
    contexto,
  };
}

function handleSetup(e, ctx, products, override = {}, titulo) {
  const continuing = ctx.intent === "setup" || ctx.intent === "recomendar";
  const f = {};
  for (const k of ["genero", "estilo", "nivel", "uso", "max"]) {
    if (continuing && ctx.filtros[k] !== undefined) f[k] = ctx.filtros[k];
    if (e[k] !== undefined) f[k] = e[k];
  }
  Object.assign(f, override);
  const perguntas = new Set(ctx.intent === "setup" ? ctx.perguntas : []);
  if (ctx.aguardando && SKIP.test(e.texto)) perguntas.add(ctx.aguardando);
  if (!f.genero && !perguntas.has("genero")) return ask("genero", f, perguntas, "setup");
  if (!f.max && !perguntas.has("orcamento")) return ask("orcamento", f, perguntas, "setup");
  const { items, total, dentro } = buildSetup(products, f);
  const contexto = { intent: "setup", filtros: f, aguardando: null, perguntas: [...perguntas], mostrados: items.map((x) => x.produto.id) };
  if (!items.length) return { texto: "Não consegui montar um setup com o estoque de agora.", sugestoes: START, contexto };
  const ids = items.map((x) => x.produto.id);
  const lines = items.map((x) => `• ${x.rotulo}: ${x.produto.marca} ${x.produto.modelo} (${brl(x.produto.priceCents)})`);
  const texto = [
    titulo || `Montei um setup${f.genero ? ` de ${f.genero.toLowerCase()}` : ""}${f.max ? ` para até ${brl(f.max)}` : ""}:`,
    ...lines,
    `Total: ${brl(total)}${parcels(total)}.${total >= FREE_SHIPPING_CENTS ? " A entrega padrão sai grátis." : ""}${dentro ? "" : " Passou do orçamento: é o setup mais acessível que consegui com essas peças."}`,
  ].join("\n");
  // Kit pronto que cabe no orçamento: alternativa com desconto.
  const kit = f.max ? kitsWithin(products, f.max, f.genero)[0] : null;
  return {
    texto: kit ? `${texto}\nOu comece pelo ${kit.kit.nome}: ${brl(kit.price.precoCents)} com ${kit.kit.descontoPct}% de desconto (${kit.kit.itens.length} itens).` : texto,
    cards: items.map((x) => card(x.produto, f.genero, x.rotulo)),
    sugestoes: ["Mais barato", "Mais completo", "Como funciona o frete?"],
    acoes: [
      { tipo: "carrinho", rotulo: "Adicionar tudo ao carrinho", itens: ids },
      ...(kit ? [{ tipo: "carrinho", rotulo: `Adicionar o ${kit.kit.nome}`, itens: kit.kit.itens }] : []),
      link("Ajustar no Monte seu setup", `/setup.html?itens=${ids.join(",")}${f.genero ? `&genero=${encodeURIComponent(f.genero)}` : ""}`),
    ],
    contexto,
  };
}

// Resposta tirada da Central de Ajuda, com link para a pergunta exata.
function helpAnswer(entry) {
  const acoes = [link("Ver na Central de Ajuda", `/ajuda.html#${entry.ancora}`)];
  if (entry.link) acoes.push(link(entry.link.rotulo, entry.link.href));
  return { texto: entry.resposta, acoes, sugestoes: START.slice(0, 3) };
}

const STATUS_TEXT = {
  Recebido: () => "recebemos o pedido e ele ainda pode ser cancelado em Minha conta",
  "Em preparação": () => "estamos separando os itens",
  Enviado: (o) => (o.entrega === "retirada" ? "já está disponível para retirada na loja" : `já saiu para entrega (${delivery[o.entrega]?.label.toLowerCase() || "entrega"}, ${delivery[o.entrega]?.prazo || "no prazo informado"})`),
  Concluído: (o) => (o.entrega === "retirada" ? "o pedido foi retirado" : "o pedido foi entregue"),
  Cancelado: () => "o pedido foi cancelado",
};
async function handleOrders(intent, text, loadOrders) {
  const orders = [...(await loadOrders())].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const conta = link("Ver em Minha conta", "/minha-conta.html");
  if (!orders.length)
    return { texto: "Você ainda não tem pedidos nesta conta. Quando comprar, eu conto aqui em que etapa cada um está.", sugestoes: ["Quero uma guitarra", "Como funciona o frete?"], acoes: [] };
  const code = text.match(/#?\b([0-9a-f]*\d[0-9a-f]*)\b/g)?.map((c) => c.replace("#", "")).find((c) => c.length >= 6 && c.length <= 8);
  const order = (code && orders.find((o) => o.id.startsWith(code))) || orders[0];
  const short = `#${order.id.slice(0, 8).toUpperCase()}`;
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(order.createdAt));
  const units = (order.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);
  const summary = `${short} (${date}, ${plural(units, "item", "itens")}, ${brl(order.totalCents)})`;
  const others = orders.filter((o) => o !== order && !["Concluído", "Cancelado"].includes(o.status)).length;
  const tail = others ? ` Você tem mais ${plural(others, "pedido", "pedidos")} em andamento.` : "";
  if (intent === "pedido_cancelar")
    return {
      texto: `Dá para cancelar enquanto o status for “Recebido”, em Minha conta: os itens voltam ao estoque e o pedido não pode ser reaberto. Depois que a preparação começa, o cancelamento é feito pela loja. ${order.status === "Recebido" ? `Seu pedido ${summary} ainda pode ser cancelado.` : `Seu pedido ${summary} está “${order.status}”, então já não dá para cancelar pelo site.`}${tail}`,
      acoes: [conta],
    };
  return {
    texto: `Seu pedido ${code && order !== orders[0] ? "" : "mais recente "}${summary} está “${order.status}”: ${(STATUS_TEXT[order.status] || (() => "acompanhe os detalhes em Minha conta"))(order)}.${tail}`,
    acoes: [conta],
    sugestoes: order.status === "Recebido" ? ["Como cancelo o pedido?", "Qual o prazo de entrega?"] : ["Qual o prazo de entrega?", "Como faço uma troca?"],
  };
}

// Pedidos de ação e perguntas sobre produtos específicos, antes da classificação geral.
const ADD = /\b(adiciona|adicione|adicionar|coloca|coloque|colocar|poe|ponha|bota|joga|inclui|incluir|manda)\b.*\b(carrinho|sacola)\b|^(adiciona|adicione|coloca|coloque|quero comprar|vou levar|compra|comprar) /;
const ADD_ALL = /\b(tudo|todos|todas|o setup|esses itens|essas opcoes|os tres|as tres)\b/;
const COMPARE = /compar|diferenca|\bvs\b|versus|qual (e |eh )?(a |o )?melhor|melhor (a|o) /;
const CART_Q = /(o que|oque) (mais )?(falta|esta faltando)|(falta|faltando) (algo|alguma coisa|algum|no meu carrinho)|esqueci (algo|alguma)|(meu|no|do) carrinho.*(falta|precis|complet|compat|funciona)|(confere|revisa|olha|checa) (o |meu )?carrinho/;
const HISTORY = /(com base|baseado|pelo que|de acordo com).*(compr|pedido)|parecid\w* com (o que|oq) (eu )?compr|combina com (o que|oq) (eu )?compr|(minhas|meus) (compras|pedidos) (anteriores|passad)/;
const FAVORITES = /favorit|lista de desejos/;
const COUPON_APPLY = /(aplica|aplique|aplicar|usa|usar|use|ativa|ativar|coloca|colocar) (o |um )?cupom|cupom (voltage10|primeiroacorde|fretevolt)/;
const BUDGET_START = /(do zero|comecar a tocar|comecando agora|primeiro setup|tudo (o )?que (eu )?preciso)/;
function special(text, e, ctx, page, products) {
  if (GLOSSARY_Q.test(text) || /diferenca entre/.test(text)) {
    const terms = findTerms(text);
    if (terms.length && !e.produtos.length) return { intent: "glossario", out: glossaryAnswer(terms[0], /diferenca|\bou\b|\be\b/.test(text) ? terms[1] : null) };
  }
  if (COUPON_APPLY.test(text)) {
    const out = couponAnswer(text);
    if (out) return { intent: "cupom_aplicar", out };
  }
  const found = () => targets(text, e, ctx, page, products);
  if (ADD.test(text)) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = ADD_ALL.test(text) && ctx.mostrados.length ? ctx.mostrados.map((id) => byId.get(id)).filter(Boolean).slice(0, 8) : found().slice(0, 4);
    return { intent: "adicionar", out: addAnswer(items) };
  }
  if (CART_Q.test(text)) return { intent: "carrinho", out: cartAnswer(page, products) };
  const referenced = e.produtos.length > 0 || PRONOUN.test(text) || /\b(primeir|segund|terceir|as duas|os dois)/.test(text);
  if (COMPARE.test(text) && referenced) {
    let items = found();
    if (items.length === 1 && page.produto && page.produto.id !== items[0].id) items = [page.produto, items[0]];
    if (items.length === 1) {
      const other = ctx.mostrados.map((id) => products.find((p) => p.id === id)).find((p) => p && p.id !== items[0].id && p.categoria === items[0].categoria);
      if (other) items = [items[0], other];
    }
    if (items.length >= 2) return { intent: "comparar", out: compareAnswer(items) };
  }
  if (HISTORY.test(text)) return { intent: "historico" };
  if (FAVORITES.test(text) && /preco|baix|promo|desconto|barat|valor/.test(text)) return { intent: "favoritos" };
  const browsing = e.categoria && !PRONOUN.test(text) && /^(tem|quero|procuro|preciso|busco|voces (tem|vendem)|vende|gostaria|me (indica|mostra))\b/.test(text);
  if (SPEC_WORDS.test(text) && !browsing && (e.produtos.length || PRONOUN.test(text) || (page.produto && !e.categoria && !e.tipo))) {
    const [p] = found();
    if (p) return { intent: "ficha", out: specAnswer(p, text) };
  }
  if (BUDGET_START.test(text) && (e.max || e.min)) return { intent: "setup" };
  return null;
}

export async function reply({ mensagem, contexto, pagina, carrinho, favoritos }, { products, orders = async () => [], alerts = async () => [], user } = {}) {
  const brands = [...new Set(products.map((p) => p.marca))];
  let ctx = sanitizeContext(contexto, brands);
  const page = sanitizePage({ pagina, carrinho, favoritos }, products);
  const text = normalize(mensagem);
  const ranking = classify(model, mensagem);
  const top = ranking[0];
  const e = extract(mensagem, products);
  const shopping = Boolean(e.categoria || e.tipo || e.genero || e.estilo || e.formato || e.captacao || e.tecnologia || e.voicing || e.marca || e.mao || e.cordas || e.captadores || e.trastes || e.produtos.length);
  const slotAnswer = shopping || e.min || e.max || e.estilo || e.uso || e.nivel || SKIP.test(text);
  const confirmed = (intent) => INFO[intent]?.test(text);
  const help = searchHelp(mensagem);
  // Intenção informativa confirmada por palavra-chave entre as três mais prováveis.
  const informative = ranking.slice(0, 3).find((r, i) => confirmed(r.intent) && r.p >= (i ? 0.15 : 0.35));

  const accepted = top.p >= THRESHOLD && top.coverage >= (top.intent === "fora_escopo" ? 0.2 : 0.34) && !INFO[top.intent] && top.intent !== "refinar";
  let intent;
  const action = ctx.aguardando && slotAnswer ? null : special(text, e, ctx, page, products);
  if (ctx.aguardando && slotAnswer && !(confirmed(top.intent) && top.p >= 0.5)) intent = ctx.intent || "recomendar";
  else if (action) intent = action.intent;
  else if (GLOSSARY_Q.test(text) && strongHelp(help)) intent = "central_ajuda";
  else if (informative) intent = informative.intent;
  else if (top.intent === "setup" && top.p >= 0.35 && SETUP_WORDS.test(text)) intent = "setup";
  else if (top.intent === "refinar" && top.p >= 0.35 && !shopping) intent = ctx.intent ? "refinar" : "recomendar";
  else if (shopping) intent = "recomendar";
  else if (e.ordem && ctx.intent) intent = "refinar";
  else if (strongHelp(help) && !(accepted && CONVERSATION.includes(top.intent))) intent = "central_ajuda";
  else if (accepted) intent = top.intent;
  else intent = "nao_entendi";

  const keep = { ...ctx, aguardando: null };
  const first = String(user?.nome || "").split(" ")[0];
  let out;
  if (action?.out) {
    // Produtos mostrados pela ação viram referência para "a primeira", "essa" e "adiciona tudo".
    const shown = (action.out.cards || []).map((c) => c.id);
    const replaces = ["comparar", "carrinho"].includes(intent);
    out = { ...action.out, contexto: replaces && shown.length ? { ...keep, intent: null, mostrados: shown } : keep };
  } else if (intent === "historico") out = { ...historyAnswer(await orders(), products), contexto: keep };
  else if (intent === "favoritos") out = { ...favoritesAnswer(page, await alerts()), contexto: keep };
  else if (intent === "troca" && !/senha/.test(text) && exchangeAnswer(await orders())) out = { ...exchangeAnswer(await orders()), contexto: keep };
  else if (intent === "recomendar") out = handleRecommend(e, ctx, products);
  else if (intent === "refinar") {
    if (ctx.intent === "setup") {
      const total = ctx.mostrados.map((id) => products.find((p) => p.id === id)?.priceCents || 0).reduce((a, b) => a + b, 0);
      const up = e.ordem === "desc" || /complet|melhor|car/.test(text);
      out = handleSetup(e, ctx, products, { max: up ? Math.ceil(total * 1.5) : Math.floor(total * 0.8) }, up ? "Uma versão mais completa do setup:" : "Uma versão mais em conta do setup:");
    } else out = handleRecommend(e, ctx, products, { refine: true });
  } else if (intent === "setup") out = handleSetup(e, ctx, products);
  else if (intent === "pedido_status" || intent === "pedido_cancelar") out = { ...(await handleOrders(intent, text, orders)), contexto: keep };
  else if (intent === "central_ajuda" || (intent === "conta" && strongHelp(help)))
    out = { ...helpAnswer(help.entry), contexto: keep };
  else if (INFO[intent]) out = { ...faqAnswer(intent, text), sugestoes: START.slice(0, 3), contexto: keep };
  else if (intent === "saudacao")
    out = { texto: `Oi${first ? `, ${first}` : ""}! Sou o assistente da Violet Voltage. Posso indicar equipamentos pelo seu estilo, montar um setup, contar em que etapa está seu pedido e tirar dúvidas sobre frete, pagamento e trocas. Por onde começamos?`, sugestoes: START, contexto: keep };
  else if (intent === "ajuda")
    out = { texto: "Eu entendo frases como “quero uma guitarra vintage para blues até 5 mil”, “monta um setup de rock”, “onde está meu pedido?” ou “aceita pix?”. Indico só o que existe na loja, com preço e estoque de agora; nada é comprado sem você clicar.", sugestoes: START, contexto: keep };
  else if (intent === "agradecimento") out = { texto: "Por nada! Se precisar de mais alguma coisa, é só chamar.", sugestoes: START.slice(0, 2), contexto: keep };
  else if (intent === "despedida") out = { texto: "Até mais! Bons ensaios.", sugestoes: [], contexto: keep };
  else if (intent === "fora_escopo")
    out = { texto: "Essa eu não sei responder: aqui eu cuido só da Violet Voltage. Posso ajudar com equipamentos, setups, pedidos, frete, pagamento e trocas.", sugestoes: START, contexto: keep };
  else
    out = {
      texto: "Não entendi bem. Pode dizer de outro jeito? Por exemplo: “quero um pedal de overdrive até R$ 800” ou “qual o prazo de entrega?”.",
      sugestoes: START,
      contexto: keep,
    };
  return {
    texto: out.texto,
    cards: out.cards || [],
    sugestoes: out.sugestoes || [],
    acoes: out.acoes || [],
    intencao: intent,
    confianca: Math.round(top.p * 100) / 100,
    entendeu: intent !== "nao_entendi",
    contexto: out.contexto,
  };
}
