// Assistente de compras da Violet Voltage: PLN local (intenção + entidades + diálogo com
// perguntas de afunilamento), respondendo só com dados reais da loja. Sem chave e sem internet.
import { train, classify } from "./classifier.js";
import { examples } from "./intents.js";
import { extract } from "./entities.js";
import { normalize } from "./text.js";
import { recommend, reasonFor, genreIntro, buildSetup, GROUP, joinList } from "./recommend.js";
import { detectOwned, detectEdit, explainSetup, describeParts, PART_NAME } from "./setup-edit.js";
import { faqAnswer, brl } from "./faq.js";
import { searchHelp, strongHelp } from "./help-search.js";
import { sanitizeContext } from "./context.js";
import { genreQuestion } from "../knowledge/genres.js";
import { extractTaste, hasTaste, tasteIntro, genreFromTaste, variantFor, colorMatches, TASTE_CHIPS, COLOR_CHIPS } from "./taste.js";
import { ENCOMENDA, ENCOMENDA_STATUS, parseCustom, looksCustom, requestLink } from "./custom-order.js";
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
  defaultCoupons,
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
const FILTERS = ["categoria", "tipo", "genero", "estilo", "formato", "captacao", "tecnologia", "voicing", "uso", "nivel", "marca", "min", "max", "mao", "cordas", "captadores", "trastes", "artista", "som", "cor"];
const SPECIFIC = ["formato", "captacao", "tecnologia", "voicing", "tipo", "marca", "min", "max", "mao", "cordas", "captadores", "trastes"];
const START = ["Quero uma guitarra vintage", "Montar setup pelo meu gosto", "Onde está meu pedido?", "Como funciona o frete?"];
const GENRE_CHIPS = {
  Vintage: ["Blues", "Blues rock", "Rock clássico", "Surf", "Jazz", "Tanto faz"],
  Moderno: ["Heavy metal", "Pop", "Indie", "Shoegaze", "Tanto faz"],
  default: ["Rock clássico", "Blues", "Heavy metal", "Pop", "Indie", "Tanto faz"],
};

const link = (rotulo, href) => ({ tipo: "link", rotulo, href });
const FEM = { Preto: "preta", Branco: "branca", Vermelho: "vermelha", Amarelo: "amarela", Roxo: "roxa", Dourado: "dourada" };
const card = (p, genero, prefixo, cor) => ({
  id: p.id,
  marca: p.marca,
  modelo: p.modelo,
  categoria: p.categoria,
  priceCents: p.priceCents,
  estoque: p.estoque,
  imageUrl: p.imageUrl || "",
  // Variação de cor pedida: o card abre a página do produto já nela.
  ...(variantFor(p, cor) ? { cor: variantFor(p, cor) } : {}),
  motivo: [prefixo, reasonFor(p, genero), colorMatches(p, cor) ? `cor ${cor.toLowerCase()}` : ""].filter(Boolean).join(" · "),
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
    return hasTaste(f)
      ? { texto: "Por último: quer um teto de valor ou monto só pelo seu gosto, sem limite?", sugestoes: ["Sem limite", "Até R$ 5 mil", "Até R$ 10 mil", "Até R$ 20 mil"], contexto }
      : { texto: "E qual é o orçamento total, mais ou menos? Se preferir, eu monto só pelo seu gosto, sem limite.", sugestoes: ["Até R$ 3 mil", "Até R$ 6 mil", "Até R$ 10 mil", "Sem limite"], contexto };
  if (slot === "cor")
    return { texto: "Boa! E a cor da guitarra, tem preferência? Se o amplificador tiver opção de cor, eu uso a mesma.", sugestoes: COLOR_CHIPS, contexto };
  if (intent === "setup")
    return {
      texto: "Vamos montar! Me conta do que você gosta: um estilo musical, um artista ou banda, ou como quer que soe (pesado, suave, espacial...). Não precisa de termo técnico.",
      sugestoes: [...TASTE_CHIPS, "Tanto faz"],
      contexto,
    };
  const texto = genreQuestion[f.estilo] || "Para qual estilo musical? Assim eu indico o timbre certo. Também vale citar um artista que você curte.";
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
  // Artista ou tipo de som sem gênero: o gênero vem do gosto (Slash → hard rock).
  if (!f.genero && (f.artista || f.som)) f.genero = genreFromTaste(f);
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
        texto: `${hasTaste(f) ? tasteIntro(f) : genreIntro(f.genero, null, f.estilo)} Uma guitarra, um amplificador e um pedal que combinam:`,
        cards: picks.map((p) => card(p, f.genero, undefined, f.cor)),
        sugestoes: hasTaste(f) ? ["Mais guitarras assim", "Montar setup completo", "E um pedal?"] : [`Mais guitarras de ${f.genero}`, `Montar setup de ${f.genero}`, "E um pedal de overdrive?"],
        acoes: [link("Ver tudo no catálogo", catalogLink(f))],
        contexto: { intent: "recomendar", filtros: f, aguardando: null, perguntas: [...perguntas], mostrados: picks.map((p) => p.id) },
      };
    }
    if (!perguntas.has("categoria") && !f.marca && !f.max && !f.min) return ask("categoria", f, perguntas, "recomendar");
  }
  if (GROUP[f.categoria] && !f.genero && !hasTaste(f) && !perguntas.has("genero") && !SPECIFIC.some((k) => f[k]) && !refine) return ask("genero", f, perguntas, "recomendar");

  const exclude = refine ? ctx.mostrados : [];
  // "Mais barato"/"mais caro" comparam com o que já foi mostrado nesta busca.
  const bound = {};
  const shownPrices = ctx.mostrados.map((id) => products.find((p) => p.id === id)).filter((p) => p && (!f.categoria || p.categoria === f.categoria)).map((p) => p.priceCents);
  if (refine && shownPrices.length && e.ordem === "asc") bound.max = Math.min(f.max || Infinity, Math.min(...shownPrices) - 1);
  if (refine && shownPrices.length && e.ordem === "desc") bound.min = Math.max(f.min || 0, Math.max(...shownPrices) + 1);
  let result = recommend(products, { ...f, ...bound }, { exclude, ordem: e.ordem });
  let lead;
  // Cor pedida: só as peças daquela cor; sem nenhuma, avisa e mostra as outras.
  if (f.cor && result.items.length) {
    const colored = recommend(products, { ...f, ...bound }, { exclude, ordem: e.ordem, onlyColor: f.cor });
    if (colored.items.length) result = colored;
    else if (!refine) lead = `Não encontrei ${describe(f)} em ${f.cor.toLowerCase()} agora. Estas são as mais próximas do que você pediu:`;
  }
  const colorShown = f.cor && result.items.some((p) => colorMatches(p, f.cor));
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
      sugestoes: refine ? ["Quero uma guitarra", "Montar um setup", "Ver pedais"] : [`Encomendar ${describe(f)}`.slice(0, 80), "Quero uma guitarra", "Montar um setup"],
      acoes: [link("Ver o catálogo", catalogLink({ categoria: f.categoria }))],
      contexto,
    };
  // Artista ou som novo nesta mensagem: explica a escolha; só a cor: diz que filtrou por ela.
  const intro = refine || lead
    ? ""
    : (e.artista || e.som) && hasTaste(f)
      ? `${tasteIntro(f, { cor: false })}${colorShown ? ` Em ${f.cor.toLowerCase()}:` : ""}`
      : colorShown
        ? `Em ${f.cor.toLowerCase()}, `
        : f.genero && GROUP[f.categoria] ? genreIntro(f.genero, f.categoria, f.estilo) : "";
  const texto =
    lead ||
    (refine
      ? e.ordem === "asc"
        ? "Opções mais em conta:"
        : e.ordem === "desc"
          ? "Opções mais completas:"
          : "Mais opções:"
      : intro
        ? /, $/.test(intro) ? `${intro}separei ${result.items.length === 1 ? "esta opção" : "estas opções"}:` : /:$/.test(intro) ? intro : `${intro} Separei estas opções:`
        : `Separei ${result.items.length === 1 ? "esta opção" : "estas opções"} de ${describe(f)}:`);
  const sugestoes = [];
  if (f.cor && !colorShown && f.categoria === "Guitarras") sugestoes.push(`Encomendar guitarra ${FEM[f.cor] || f.cor.toLowerCase()}`);
  if (result.remaining) sugestoes.push("Outras opções");
  if (e.ordem !== "asc") sugestoes.push("Mais barato");
  if (f.genero && f.categoria === "Guitarras") sugestoes.push("E um amplificador?");
  else if (f.genero && f.categoria === "Amplificadores") sugestoes.push("E um pedal?");
  if (f.genero && GROUP[f.categoria]) sugestoes.push(`Montar setup de ${f.genero}`);
  return {
    texto,
    cards: result.items.map((p) => card(p, f.genero, undefined, f.cor)),
    sugestoes: sugestoes.slice(0, 4),
    acoes: [link("Ver tudo no catálogo", catalogLink(f))],
    contexto,
  };
}

// override: filtros do cliente (ex.: orçamento dito por ele). alvo: teto interno de "mais barato"
// e "mais completo", que não substitui o orçamento do cliente nem aparece como se fosse dele.
function handleSetup(e, ctx, products, override = {}, titulo, { alvo } = {}) {
  const continuing = ctx.intent === "setup" || ctx.intent === "recomendar";
  const f = {};
  for (const k of ["genero", "estilo", "nivel", "uso", "max", "artista", "som", "cor", "tenho", "sem", "fixos", "excluir"]) {
    if (continuing && ctx.filtros[k] !== undefined) f[k] = ctx.filtros[k];
    if (e[k] !== undefined) f[k] = e[k];
  }
  // Artista novo troca o gênero que veio do artista anterior.
  if (e.artista && !e.genero) f.genero = genreFromTaste({ artista: e.artista });
  else if (e.som && !e.genero && !f.artista && continuing && ctx.filtros.som !== e.som) f.genero = genreFromTaste({ som: e.som });
  Object.assign(f, override);
  const perguntas = new Set(ctx.intent === "setup" ? ctx.perguntas : []);
  if (ctx.aguardando && SKIP.test(e.texto)) perguntas.add(ctx.aguardando);
  // Etapa 33: o setup pode partir do gosto (artista, tipo de som, cor) e não só do orçamento.
  const taste = Boolean(f.artista || f.som);
  if (!f.genero && taste) f.genero = genreFromTaste(f);
  if (!f.genero && !perguntas.has("genero")) return ask("genero", f, perguntas, "setup");
  if (taste && !f.cor && !perguntas.has("cor")) return ask("cor", f, perguntas, "setup");
  if (!f.max && !perguntas.has("orcamento")) return ask("orcamento", f, perguntas, "setup");
  const { items, total } = buildSetup(products, alvo ? { ...f, max: alvo } : f);
  const dentro = !f.max || total <= f.max;
  const contexto = { intent: "setup", filtros: f, aguardando: null, perguntas: [...perguntas], mostrados: items.map((x) => x.produto.id) };
  if (!items.length) return { texto: "Não consegui montar um setup com o estoque de agora.", sugestoes: START, contexto };
  const ids = items.map((x) => x.produto.id);
  const lines = items.map((x) => `• ${x.rotulo}: ${x.produto.marca} ${x.produto.modelo} (${brl(x.produto.priceCents)})${(ctx.filtros.fixos || []).includes(x.produto.id) ? " · mantida" : ""}`);
  // Etapa 36: o que o cliente já tem fica de fora (e a verba vai para o resto).
  const ownedText = f.tenho?.length ? `Sem ${describeParts(f.tenho).replace(/\b(a|o) /g, "")}, porque você já tem${f.max ? ": a verba foi para o resto" : ""}.` : "";
  // Peça fora do gênero pedido: explica a troca e mostra a opção do gênero que ficou de fora.
  const swaps = f.genero ? items.filter((x) => x.foraDoGenero) : [];
  const swapText = swaps.length
    ? `Para respeitar o valor, ${joinList(swaps.map((x) => `${x.rotulo === "Correia" ? "a" : "o"} ${x.rotulo.toLowerCase()} (${x.produto.marca} ${x.produto.modelo})`))} não ${swaps.length > 1 ? "são" : "é"} dos mais típicos de ${f.genero.toLowerCase()}, mas ${swaps.length > 1 ? "atendem" : "atende"} bem.${swaps
        .filter((x) => x.alternativa && !alvo)
        .map((x) => ` Se fizer questão do timbre clássico do estilo, ${x.rotulo === "Correia" ? "a" : "o"} ${x.rotulo.toLowerCase()} mais em conta para ${f.genero.toLowerCase()} é ${x.alternativa.marca} ${x.alternativa.modelo} (${brl(x.alternativa.priceCents)}).`)
        .join("")}`
    : "";
  // Pelo gosto e sem limite: a guitarra mais próxima do original, com a alternativa mais em conta.
  const guitar = items.find((x) => x.rotulo === "Guitarra")?.produto;
  const cheaperGuitar =
    taste && !f.max && !alvo && guitar && !(f.fixos || []).includes(guitar.id)
      ? recommend(products, { categoria: "Guitarras", formato: guitar.ficha?.formato, genero: f.genero, artista: f.artista, som: f.som, cor: f.cor }, { limit: 50 }).items.find((p) => p.priceCents <= guitar.priceCents * 0.7 && !(f.excluir || []).includes(p.id))
      : undefined;
  const texto = [
    ...(taste && !titulo && !alvo ? [tasteIntro(f)] : []),
    titulo || (taste ? `Montei um setup pelo seu gosto${f.max ? `, para até ${brl(f.max)}` : ""}:` : `Montei um setup${f.genero ? ` de ${f.genero.toLowerCase()}` : ""}${f.max ? ` para até ${brl(f.max)}` : ""}:`),
    ...lines,
    ...(ownedText ? [ownedText] : []),
    `Total: ${brl(total)}${parcels(total)}.${total >= FREE_SHIPPING_CENTS ? " A entrega padrão sai grátis." : ""}${dentro ? "" : ` Passou do seu orçamento de ${brl(f.max)}: é o setup mais acessível que consigo montar com o estoque de agora.`}`,
    ...(swapText ? [swapText] : []),
    ...(cheaperGuitar ? [`Quer gastar menos? A ${cheaperGuitar.marca} ${cheaperGuitar.modelo} tem o mesmo formato por ${brl(cheaperGuitar.priceCents)}.`] : []),
  ].join("\n");
  // Kit pronto que cabe no orçamento: alternativa com desconto.
  const kit = f.max && !override.fixos && !f.tenho?.length ? kitsWithin(products, f.max, f.genero).find((k) => k.price.precoCents < total) : null;
  return {
    texto: kit ? `${texto}\nOu comece pelo ${kit.kit.nome}: ${brl(kit.price.precoCents)} com ${kit.kit.descontoPct}% de desconto (${kit.kit.itens.length} itens).` : texto,
    cards: items.map((x) => card(x.produto, f.genero, x.rotulo, f.cor)),
    sugestoes: taste ? ["Mais barato", "Por que essas peças?", "Quero em preto", "Outro artista", "Troca o amplificador"].filter((c) => c !== `Quero em ${String(f.cor).toLowerCase()}`) : ["Mais barato", "Por que essas peças?", "Troca o amplificador", "Mais completo", "Pelo meu gosto"],
    acoes: [
      { tipo: "carrinho", rotulo: "Adicionar tudo ao carrinho", itens: ids },
      ...(kit ? [{ tipo: "carrinho", rotulo: `Adicionar o ${kit.kit.nome}`, itens: kit.kit.itens }] : []),
      link("Ajustar no Monte seu setup", `/setup.html?itens=${ids.join(",")}${f.genero ? `&genero=${encodeURIComponent(f.genero)}` : ""}`),
    ],
    contexto,
  };
}

// "Mais barato": precisa sair mais barato de verdade. Tenta uns 20% a menos; se o estoque não
// permitir, aceita qualquer economia; se já é o mínimo, diz isso em vez de repetir o setup.
function cheaperSetup(e, ctx, products, total, titulo = "Uma versão mais em conta do setup:") {
  const before = new Set(shownOf(ctx, products).map((p) => p.categoria));
  let out;
  for (const alvo of [Math.floor(total * 0.8), total - 1]) {
    out = handleSetup(e, ctx, products, {}, titulo, { alvo });
    const novo = (out.cards || []).reduce((s, c) => s + c.priceCents, 0);
    if (out.cards?.length && novo < total) {
      // Peças opcionais que saíram para caber no valor: o cliente fica sabendo.
      const after = new Set(out.cards.map((c) => c.categoria));
      const dropped = [["Pedais", "o pedal"], ["Correias", "a correia"]].filter(([c]) => before.has(c) && !after.has(c)).map(([, n]) => n);
      out.texto += `\nSão ${brl(total - novo)} a menos que o anterior.${dropped.length ? ` Para economizar, deixei de fora ${joinList(dropped)}; dá para incluir depois.` : ""}`;
      return out;
    }
  }
  return {
    texto: `Esse já é o setup mais em conta que consigo montar com o estoque de agora (${brl(total)}${parcels(total)}). Dá para economizar mais tirando uma peça que você já tenha, montando peça por peça no montador ou começando por um kit com desconto.`,
    sugestoes: ["Quais kits vocês têm?", "Outro estilo", "Como funciona o frete?"],
    acoes: [link("Ajustar no Monte seu setup", `/setup.html?itens=${ctx.mostrados.join(",")}`), link("Ver os kits com desconto", "/kits.html")],
    contexto: { ...ctx, aguardando: null },
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
    const out = couponAnswer(text, page.cupons);
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

// ---------- Etapa 33: encomendas, parcerias e gosto pessoal ----------
const PARCERIA = /\b(parceri\w*|(sou|somos) (um |uma |o |a )?(fornecedor\w*|distribuidor\w*|fabricante\w*|representante\w*|importador\w*|lojista|revendedor\w*|luthier|dono de uma marca|de uma marca)|tenho uma (marca|fabrica|distribuidora|empresa) d\w+|quero (ser|virar|me tornar) (um |uma )?(fornecedor\w*|parceir\w*|revendedor\w*|distribuidor\w*)|fornecer (para|pra|a) (voces|loja|violet)|vender (meus|nossos|os meus|os nossos) produtos|(meus|nossos) produtos (na|para|pra) (loja|voces|violet)|representante comercial|seja um parceiro)\b/;
const TASTE_START = /\b(pelo|pelos|por|de acordo com o|com base no|conforme o) (meu|meus) gostos?\b|^outro (artista|som|gosto)\b|^(quero )?trocar (o )?artista\b/;
const FORMATO_DA_BASE = { "Les Paul (single cut)": "Single cut", "SG (double cut)": "Double cut", Stratocaster: "Strat", Telecaster: "Tele", "Offset (Jazzmaster/Jaguar)": "Offset", Semiacústica: "Semiacústica", Superstrat: "Superstrat" };
function customAnswer(mensagem, products, guest) {
  const parsed = parseCustom(mensagem);
  const form = link("Abrir o formulário de encomenda", "/encomenda.html");
  if (!parsed.itens.length && normalize(mensagem).split(" ").length <= 6)
    return {
      texto: "Claro! Fazemos encomendas de guitarras personalizadas, montadas pela nossa oficina parceira, e buscamos produtos que não estão no catálogo. Me conta o que você quer, por exemplo: “Les Paul com captadores Seymour Duncan e tarraxas Gotoh” ou “quero importar um pedal que vocês não têm”.",
      sugestoes: ["Les Paul com captadores Seymour Duncan", "Strato com ponte Floyd Rose", "Minhas encomendas"],
      acoes: [form],
    };
  const lines = parsed.itens.map(([k, v]) => `• ${k}: ${v}`);
  const missing = parsed.tipo === "personalizado" ? ["Cor", "Escala", "Ponte"].filter((k) => !parsed.itens.some(([x]) => x === k)) : [];
  const base = parsed.itens.find(([k]) => k === "Base")?.[1];
  const formato = FORMATO_DA_BASE[base];
  const near = formato ? recommend(products, { categoria: "Guitarras", formato }, { limit: 2 }).items : [];
  const texto = [
    parsed.tipo === "personalizado" ? "Dá para encomendar, sim! Entendi assim:" : "Podemos buscar esse produto para você. Entendi assim:",
    ...(lines.length ? lines : [`• Pedido: ${String(mensagem).trim().slice(0, 160)}`]),
    `${missing.length ? `Se quiser, diga também ${joinList(missing.map((m) => (m === "Cor" ? "a cor" : m === "Escala" ? "a madeira da escala" : "a ponte")))}; dá para completar no formulário. ` : ""}A equipe responde com orçamento e prazo em até 2 dias úteis, e o pagamento só acontece se você aprovar.${guest ? " Para enviar, você entra na conta (ou cria uma); o que você escreveu fica guardado." : ""}`,
    ...(near.length ? ["Enquanto isso, a pronta entrega mais parecida:"] : []),
  ].join("\n");
  return {
    texto,
    cards: near.map((p) => card(p, undefined, "Pronta entrega")),
    acoes: [link("Revisar e enviar a encomenda", requestLink(parsed, mensagem))],
    sugestoes: ["Minhas encomendas", "Como funciona o frete?"],
  };
}
function requestsAnswer(requests) {
  const conta = link("Ver minhas encomendas", "/encomenda.html#minhas");
  if (!requests.length)
    return { texto: "Você ainda não fez nenhuma encomenda. Posso ajudar a descrever uma guitarra personalizada ou um produto que não está no catálogo.", sugestoes: ["Quero encomendar uma guitarra"], acoes: [link("Fazer uma encomenda", "/encomenda.html")] };
  const sorted = [...requests].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const lines = sorted.slice(0, 3).map((r) => `• ${r.codigo} · ${r.produto}: ${r.status}${r.resposta ? `. Resposta da loja: ${r.resposta.slice(0, 160)}` : ""}`);
  return { texto: [`Suas encomendas mais recentes:`, ...lines].join("\n"), acoes: [conta], sugestoes: ["Quero encomendar outra", "Onde está meu pedido?"] };
}
const partnerAnswer = (e) => ({
  texto: "Que bom ter você por aqui! Fornecedores, marcas, distribuidores e luthiers falam com a equipe comercial pela página de parceiros: lá você informa a empresa (com CNPJ), o tipo de produto e quem é o contato. A resposta chega pelo e-mail informado em até 5 dias úteis. Não precisa ter conta na loja.",
  acoes: [link("Preencher a ficha de parceria", `/parceiros.html${e.categoria ? `?produto=${encodeURIComponent(e.categoria)}` : ""}`)],
  sugestoes: [],
});
function early(text, mensagem, e, ctx, products, guest) {
  if (PARCERIA.test(text)) return { intent: "parceria", out: partnerAnswer(e) };
  // "Encomenda" também é o pacote do pedido: com palavra de entrega, é sobre o pedido.
  const delivery = /\b(receb\w*|cheg\w*|entreg\w*|rastre\w*|correios?|transportador\w*|enviad\w*|saiu|despach\w*|extravi\w*|atrasad\w*|pacote)\b/.test(text);
  if (delivery && !looksCustom(mensagem)) return null;
  if (ENCOMENDA_STATUS.test(text)) return { intent: "encomenda_status" };
  if (ENCOMENDA.test(text) || looksCustom(mensagem)) return { intent: "encomenda", out: customAnswer(mensagem, products, guest) };
  if (TASTE_START.test(text)) {
    const f = ctx.intent === "setup" && ctx.filtros.max ? { max: ctx.filtros.max } : {};
    return { intent: "setup", out: ask("genero", f, new Set(ctx.filtros.max ? ["orcamento"] : []), "setup") };
  }
  return null;
}

// Reações à resposta anterior: achou caro, não gostou, gostou. Continuam a conversa em vez de
// cair numa intenção genérica (ex.: "muito caro" não é agradecimento).
const PRICE_OBJECTION = /\b(caro|cara|caros|caras|carissim\w*|salgad\w*|puxad\w*|pesad\w* (no|pro|para o) bolso|fora do (meu )?orcamento|acima do (meu )?orcamento|passou do (meu )?orcamento|nao (tenho|posso gastar|da pra gastar) (isso|tudo isso|esse valor)|nao cabe no (meu )?bolso|muito dinheiro)\b/;
const DISLIKE = /\b(nao gostei|nao curti|nao era isso|nao e (bem )?isso|nao me agradou|feia|feio|nao combina comigo|tem outra|outra opcao|outras opcoes|mostra outr[ao]s?)\b/;
const LIKE = /^(gostei|adorei|curti|amei|essa (e|eh|ficou) (boa|otima|perfeita)|essa ai|show de bola|perfeita|perfeito)(!|\.|\s|$)/;
const BUDGET_CHIPS = ["Até R$ 1.500", "Até R$ 3.000", "Até R$ 5.000"];
function shownOf(ctx, products) {
  return ctx.mostrados.map((id) => products.find((p) => p.id === id)).filter(Boolean);
}
// Etapa 36: mudanças num setup já mostrado (trocar, manter, tirar, incluir, "por quê?") e o que
// o cliente já tem. Devolve { intent, out } como reaction(), ou null.
const SETUP_CATS = ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias"];
const OWNED_CONTEXT = /\b(setup|monta\w*|montar|resto|complet\w*|equipamento\w*|o que falta|kit)\b/;
const PRICEY = /\b(barat\w*|economi\w*|car[oa]s?|gastar menos)\b/;
function setupEditAnswer(text, mensagem, e, ctx, products) {
  const setupNow = ctx.intent === "setup" && ctx.mostrados.length > 0;
  const owned = detectOwned(mensagem);
  if (owned && (ctx.intent === "setup" || OWNED_CONTEXT.test(text))) {
    const sem = (ctx.filtros.sem || []).filter((c) => !owned.tenho.includes(c));
    const out = handleSetup(e, { ...ctx, intent: "setup", aguardando: null }, products, { tenho: owned.tenho, ...(sem.length ? { sem } : { sem: undefined }), fixos: undefined, excluir: undefined });
    out.texto = `Anotado: você já tem ${describeParts(owned.tenho)}, então ${owned.tenho.length > 1 ? "ficam" : "fica"} de fora.\n${out.texto}`;
    return { intent: "setup_tenho", out };
  }
  if (!setupNow) return null;
  const edit = detectEdit(mensagem);
  if (!edit || (PRICEY.test(text) && edit.acao !== "trocar")) return null;
  const shown = shownOf(ctx, products);
  const f = ctx.filtros;
  const inSetup = (cat) => shown.find((p) => p.categoria === cat);
  const parts = edit.partes.filter((c) => !(f.tenho || []).includes(c));
  if (edit.acao === "porque") {
    const built = buildSetup(products, f).items;
    const items = shown.map((p) => built.find((x) => x.produto.id === p.id) || { produto: p, fixo: (f.fixos || []).includes(p.id) });
    const texto = explainSetup(items, f, edit.partes.filter((c) => inSetup(c)));
    if (!texto) return { intent: "setup_porque", out: { texto: `${describeParts(edit.partes)} não está neste setup.`, sugestoes: ["Por que essas peças?"], contexto: { ...ctx, aguardando: null } } };
    return { intent: "setup_porque", out: { texto, sugestoes: ["Troca o amplificador", "Mantém a guitarra", "Mais barato"], contexto: { ...ctx, aguardando: null } } };
  }
  if (!parts.length) return { intent: "setup_editar", out: { texto: `Você me disse que já tem ${describeParts(edit.partes)}, então ${edit.partes.length > 1 ? "elas ficaram" : "ficou"} de fora do setup. Quer que eu inclua mesmo assim?`, sugestoes: [`Põe ${edit.partes[0] === "Amplificadores" ? "um amplificador" : `um ${PART_NAME[edit.partes[0]]}`}`, "Mais barato"], contexto: { ...ctx, filtros: { ...f, tenho: (f.tenho || []).filter((c) => !edit.partes.includes(c)) }, aguardando: null } } };
  const keepIds = (cats) => shown.filter((p) => !cats.includes(p.categoria)).map((p) => p.id);
  // Peças que já estavam fora do setup (tiradas para caber no valor) continuam fora.
  const absent = SETUP_CATS.filter((c) => !inSetup(c) && !(f.tenho || []).includes(c) && !parts.includes(c));
  const rebuild = (override, titulo) => {
    // As outras peças ficam travadas só nesta montagem; os "mantém" do cliente continuam valendo.
    const sem = override.sem === undefined ? f.sem || [] : override.sem;
    const out = handleSetup(e, ctx, products, { ...override, sem: [...new Set([...sem, ...absent])], fixos: [...new Set([...(f.fixos || []), ...keepIds(parts)])] }, titulo);
    if (out.contexto?.filtros) {
      const filtros = { ...out.contexto.filtros, sem, fixos: (f.fixos || []).filter((id) => !parts.includes(products.find((p) => p.id === id)?.categoria)) };
      for (const k of ["sem", "fixos"]) if (!filtros[k].length) delete filtros[k];
      out.contexto.filtros = filtros;
    }
    return out;
  };
  if (edit.acao === "manter") {
    const ids = parts.map(inSetup).filter(Boolean).map((p) => p.id);
    if (!ids.length) return null;
    const names = ids.map((id) => products.find((p) => p.id === id)).map((p) => `${p.marca} ${p.modelo}`);
    return { intent: "setup_manter", out: { texto: `Combinado: ${joinList(names)} ${ids.length > 1 ? "ficam" : "fica"}. Se pedir mais barato ou trocar outra peça, ${ids.length > 1 ? "elas continuam" : "ela continua"} no setup.`, sugestoes: ["Troca o amplificador", "Mais barato", "Por que essas peças?"], contexto: { ...ctx, filtros: { ...f, fixos: [...new Set([...(f.fixos || []), ...ids])] }, aguardando: null } } };
  }
  if (edit.acao === "trocar") {
    const current = parts.map(inSetup).filter(Boolean);
    if (!current.length) return null;
    const locked = current.filter((p) => (f.fixos || []).includes(p.id));
    const out = rebuild({ excluir: [...new Set([...(f.excluir || []), ...current.map((p) => p.id)])], fixos: undefined }, "Setup com a troca:");
    const swaps = current.map((old) => ({ old, neu: (out.cards || []).find((c) => c.categoria === old.categoria) }));
    const done = swaps.filter((x) => x.neu && x.neu.id !== x.old.id);
    const header = done.length
      ? `Troquei ${joinList(done.map((x) => `${x.old.marca} ${x.old.modelo} por ${x.neu.marca} ${x.neu.modelo} (${x.neu.priceCents < x.old.priceCents ? `${brl(x.old.priceCents - x.neu.priceCents)} a menos` : x.neu.priceCents > x.old.priceCents ? `${brl(x.neu.priceCents - x.old.priceCents)} a mais` : "mesmo preço"})`))}.`
      : `Não encontrei outr${current[0].categoria === "Guitarras" || current[0].categoria === "Correias" ? "a" : "o"} ${PART_NAME[current[0].categoria]} que combine e caiba no valor; deixei como estava.`;
    out.texto = `${locked.length ? "Você tinha pedido para manter, mas troquei como pediu agora. " : ""}${header}\n${out.texto.replace(/^.*\n/, "")}`;
    return { intent: "setup_trocar", out };
  }
  if (edit.acao === "tirar") {
    const present = parts.filter(inSetup);
    if (!present.length) return { intent: "setup_editar", out: { texto: `O setup já está sem ${describeParts(parts)}.`, sugestoes: ["Por que essas peças?", "Mais barato"], contexto: { ...ctx, aguardando: null } } };
    const out = rebuild({ sem: [...new Set([...(f.sem || []), ...present])] }, `Tirei ${describeParts(present)}:`);
    return { intent: "setup_tirar", out };
  }
  if (edit.acao === "incluir") {
    const missing = parts.filter((c) => !inSetup(c));
    if (!missing.length) return null;
    const out = rebuild({ sem: (f.sem || []).filter((c) => !missing.includes(c)) }, `Incluí ${describeParts(missing)}:`);
    const added = missing.filter((c) => (out.cards || []).some((x) => x.categoria === c));
    if (added.length < missing.length) out.texto += `\n${describeParts(missing.filter((c) => !added.includes(c)))} não coube no orçamento de ${brl(f.max || 0)}. Se aumentar um pouco o valor, eu incluo.`;
    return { intent: "setup_incluir", out };
  }
  return null;
}
// Etapa 36: "usar o mesmo gosto" e "esquece meu gosto" (só com conta).
const SAME_TASTE = /\b(mesmo gosto|(igual|mesmo|mesma coisa|como) (d|n)a ultima vez|o de sempre|meu gosto salvo)\b/;
const FORGET_TASTE = /\b(esquec\w*|apag\w*|limp\w*|remov\w*|nao guard\w*) (o |os |a |as )?(meu |meus |minha |minhas )?(gosto|gostos|preferencias?|historico de gosto)\b/;
export function describeTaste(t) {
  const parts = [];
  if (t.genero) parts.push(`de ${t.genero.toLowerCase()}`);
  if (t.artista) parts.push(`no estilo de ${t.artista}`);
  if (t.som && !t.artista) parts.push(`com som ${t.som}`);
  if (t.cor) parts.push(`em ${t.cor.toLowerCase()}`);
  parts.push(t.max ? `até ${brl(t.max)}` : "sem limite de valor");
  if (t.tenho?.length) parts.push(`sem ${describeParts(t.tenho).replace(/\b(a|o) /g, "")}, que você já tem`);
  return parts.join(", ");
}
async function memoryAnswer(text, e, ctx, products, perfil, guest) {
  const same = SAME_TASTE.test(text);
  const forget = FORGET_TASTE.test(text);
  if (!same && !forget) return null;
  if (guest) return { intent: "memoria", out: { ...loginAnswer("eu lembrar do seu gosto entre uma visita e outra"), contexto: { ...ctx, aguardando: null } } };
  if (!perfil) return null;
  if (forget) {
    await perfil.esquecer();
    return { intent: "memoria_apagar", out: { texto: "Pronto, esqueci o gosto que eu tinha guardado. Nos próximos setups eu pergunto tudo de novo.", sugestoes: ["Montar setup pelo meu gosto"], contexto: { ...ctx, aguardando: null } } };
  }
  const saved = await perfil.carregar();
  if (!saved) return { intent: "memoria", out: { texto: "Ainda não tenho um gosto seu guardado. Vamos montar o primeiro setup?", sugestoes: ["Montar setup pelo meu gosto"], contexto: { ...ctx, aguardando: null } } };
  const fresh = { intent: null, filtros: {}, aguardando: null, perguntas: ["cor", "orcamento"], mostrados: [] };
  const out = handleSetup(e, fresh, products, saved, `Partindo do seu gosto da última vez (${describeTaste(saved)}):`);
  return { intent: "setup", out };
}
function reaction(text, e, ctx, products) {
  const shown = shownOf(ctx, products);
  if (PRICE_OBJECTION.test(text) && !/\bmais car/.test(text) && !e.produtos.length) {
    if (ctx.intent === "setup" && shown.length) {
      const total = shown.reduce((s, p) => s + p.priceCents, 0);
      const out = e.max
        ? handleSetup(e, ctx, products, { max: e.max }, `Sem problema! Ajustei o setup para caber em até ${brl(e.max)}:`)
        : cheaperSetup(e, ctx, products, total, "Entendi, ficou acima do que você queria. Troquei algumas peças por opções mais em conta:");
      const newTotal = (out.cards || []).reduce((s, c) => s + c.priceCents, 0);
      const saved = total - newTotal;
      out.texto += `${saved > 0 && !e.max ? "" : saved > 0 ? `\nSão ${brl(saved)} a menos que o anterior.` : ""}${e.max ? "" : " Se me disser quanto quer gastar no total, eu ajusto certinho."} No cartão, dá para parcelar em até 10x sem juros.`;
      out.sugestoes = e.max ? ["Ainda está caro", "Quais kits vocês têm?", "Como funciona o frete?"] : BUDGET_CHIPS;
      if (!e.max) out.contexto = { ...out.contexto, aguardando: "orcamento" };
      return { intent: "objecao_preco", out };
    }
    if (ctx.intent === "recomendar" && shown.length) {
      const out = e.max ? handleRecommend(e, ctx, products) : handleRecommend({ ...e, ordem: "asc" }, ctx, products, { refine: true });
      const empty = !(out.cards || []).length;
      const cheapest = Math.min(...shown.map((p) => p.priceCents));
      out.texto = empty
        ? `Essas já são as opções mais acessíveis com esses critérios (a partir de ${brl(cheapest)}${parcels(cheapest)}). Se me disser quanto quer gastar, procuro alternativas, como outro estilo ou um kit com desconto.`
        : `Entendi! ${e.max ? `Até ${brl(e.max)}, estas cabem:` : "Separei opções mais em conta:"}${e.max ? "" : " Se me disser um valor máximo, eu filtro por ele."}`;
      out.sugestoes = e.max ? ["Outras opções", "Quais kits vocês têm?"] : BUDGET_CHIPS;
      if (!e.max) out.contexto = { ...out.contexto, aguardando: "orcamento" };
      return { intent: "objecao_preco", out };
    }
    return {
      intent: "objecao_preco",
      out: {
        texto: "Entendo, equipamento pesa no bolso. Me diz o que você procura e quanto quer gastar que eu acho opções que cabem. Dicas: os kits têm até 10% de desconto, o cartão parcela em até 10x sem juros e o cupom PRIMEIROACORDE dá R$ 30 na primeira compra a partir de R$ 200.",
        sugestoes: ["Guitarra até R$ 1.500", "Setup completo até R$ 3.000", "Quais kits vocês têm?"],
        acoes: [{ tipo: "link", rotulo: "Ver os kits com desconto", href: "/kits.html" }],
        contexto: { ...ctx, aguardando: null },
      },
    };
  }
  if (DISLIKE.test(text) && shown.length && !e.categoria && !e.produtos.length) {
    if (ctx.intent === "setup")
      return {
        intent: "objecao",
        out: {
          texto: "Sem problema! Me diz o que não agradou (o estilo, uma das peças ou o valor) que eu ajusto. Se preferir escolher peça por peça, abra o setup no montador.",
          sugestoes: ["Muito caro", "Quero outro estilo", "Mais completo"],
          acoes: [{ tipo: "link", rotulo: "Ajustar no Monte seu setup", href: `/setup.html?itens=${ctx.mostrados.join(",")}` }],
          contexto: { ...ctx, aguardando: null },
        },
      };
    const out = handleRecommend(e, ctx, products, { refine: true });
    if ((out.cards || []).length) out.texto = `Sem problema! Outras opções: ${out.texto === "Mais opções:" ? "" : out.texto}`.trim();
    out.sugestoes = ["Mais barato", "Outro estilo", "Montar um setup"];
    return { intent: "objecao", out };
  }
  if (LIKE.test(text) && shown.length && (ctx.intent === "recomendar" || ctx.intent === "setup")) {
    if (ctx.intent === "setup")
      return { intent: "aprovacao", out: { texto: "Que bom que curtiu o setup! Toque em “Adicionar tudo ao carrinho” ou me peça para trocar alguma peça.", sugestoes: ["Adiciona tudo no carrinho", "Mais barato"], contexto: { ...ctx, aguardando: null } } };
    if (shown.length === 1) return { intent: "aprovacao", out: { ...addAnswer(shown), texto: `Boa escolha! ${addAnswer(shown).texto}`, contexto: { ...ctx, aguardando: null } } };
    return {
      intent: "aprovacao",
      out: { texto: "Boa! Qual delas você quer levar?", sugestoes: ["Adicionar a primeira", "Adicionar a segunda", "Comparar as duas primeiras"], contexto: { ...ctx, aguardando: null } },
    };
  }
  return null;
}
// "2500", "2 mil", "R$ 3.000" sozinho quando o assistente pediu o orçamento.
function bareBudget(text) {
  const m = text.match(/^\D{0,20}?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?\s*(mil|k)?\s*(reais|conto|pila)?\D{0,10}$/);
  if (!m) return undefined;
  const value = Number(m[1].replace(/\./g, "")) * (m[2] ? 1000 : 1);
  return value >= 50 && value <= 1_000_000 ? value * 100 : undefined;
}
// "Ajuda", "socorro", "tive um problema": o cliente quer resolver algo. Em vez de explicar o que o
// assistente faz, pergunta o assunto (com os mais comuns em botões) e, logado, já cita o pedido em
// andamento. "O que você faz?" continua com a apresentação do assistente.
const SUPPORT = /^(ajuda|socorro|help|sos|suporte|atendimento|atendente|me ajud\w*)\W*$|\b(socorro|suporte|atendente|atendimento|reclama\w*|tive (um )?problema|estou com (um )?problema|deu (um )?problema|deu errado|preciso de (uma )?ajuda|falar com (alguem|uma pessoa|humano))\b/;
// Pedido de contato vale mesmo com palavra de produto ("falar com o suporte" não é o suporte de chão).
const CONTACT = /\b(falar|conversar|contato) com (o |a |um |uma |algum |alguem )?(suporte|atendimento|atendente|alguem|pessoa|humano|vendedor|loja)\b|\b(suporte|atendimento) (ao cliente|tecnico)\b|^(preciso de |quero )?(suporte|atendimento)\W*$/;
const ABOUT_BOT = /\b(voce|vc|assistente|chat|chatbot|robo|ia|inteligencia artificial|bot|funcoes|perguntar|serve|sabe fazer|consegue fazer|quem e|pode fazer|pode me ajudar|pode ajudar|usar o)\b/;
function supportAnswer(orders, guest) {
  const open = [...orders]
    .filter((o) => !["Concluído", "Cancelado"].includes(o.status))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const pedido = open ? ` Vi que seu pedido #${open.id.slice(0, 8).toUpperCase()} está “${open.status}”: se for sobre ele, toque em “Onde está meu pedido?”.` : "";
  return {
    texto: `Claro, estou aqui para ajudar! Me conta o que aconteceu ou escolha um assunto abaixo.${pedido}${guest ? " Para assuntos de um pedido, vou pedir para você entrar na conta." : ""}`,
    sugestoes: ["Onde está meu pedido?", "Quero trocar um produto", "Problema com o pagamento", "Não consigo entrar na conta", "Me indica uma guitarra"],
    acoes: [link("Central de Ajuda", "/ajuda.html"), ...(guest ? [] : [link("Ajuda em Minha conta", "/minha-conta.html#ajuda")])],
  };
}
const LOGIN_NEEDED = { pedido_status: "ver seus pedidos", pedido_cancelar: "cancelar um pedido", historico: "sugerir pelo que você já comprou", troca_pedido: "pedir uma troca", encomenda_status: "ver suas encomendas" };
// O botão leva ao login (ou cadastro) e volta para esta página; o navegador guarda a pergunta e
// o assistente responde sozinho assim que a pessoa entra.
const loginAnswer = (motivo) => ({
  texto: `Para ${motivo}, entre na sua conta (ou crie uma, leva 1 minuto). Assim que você entrar, eu continuo daqui com a sua pergunta. Enquanto isso, posso indicar equipamentos e tirar dúvidas sem login.`,
  acoes: [{ tipo: "login", rotulo: "Entrar ou criar conta", href: "/login.html" }],
  sugestoes: ["Quero uma guitarra vintage", "Como funciona o frete?"],
});

export async function reply({ mensagem, contexto, pagina, carrinho, favoritos }, { products, orders = async () => [], alerts = async () => [], requests = async () => [], cupons = async () => defaultCoupons(), perfil, user } = {}) {
  const brands = [...new Set(products.map((p) => p.marca))];
  let ctx = sanitizeContext(contexto, brands);
  const page = sanitizePage({ pagina, carrinho, favoritos }, products);
  page.cupons = await cupons();
  const text = normalize(mensagem);
  const ranking = classify(model, mensagem);
  const top = ranking[0];
  const e = extract(mensagem, products);
  if (ctx.aguardando === "orcamento" && !e.max && !e.min) e.max = bareBudget(text);
  // Etapa 33: gosto pessoal. Tipo de som só conta quando o assunto é música ("site pesado" não é
  // timbre); cor, quando fala de cor ou de equipamento, ou numa resposta curta durante a busca.
  const words = text.split(" ").length;
  const taste = extractTaste(mensagem, { aguardando: ctx.aguardando, temProduto: Boolean(e.categoria || e.formato) || (Boolean(ctx.intent) && words <= 4) });
  e.artista = taste.artista;
  if (taste.som && (ctx.aguardando || e.artista || e.categoria || e.formato || words <= 4 || /\b(som|timbre|tocar|toco|soar|soe|soando|musica|setup|banda|estilo)\b/.test(text))) e.som = taste.som;
  e.cor = taste.cor;
  const shopping = Boolean(e.categoria || e.tipo || e.genero || e.estilo || e.formato || e.captacao || e.tecnologia || e.voicing || e.marca || e.mao || e.cordas || e.captadores || e.trastes || e.produtos.length || e.artista || e.som || e.cor);
  const slotAnswer = shopping || e.min || e.max || e.estilo || e.uso || e.nivel || SKIP.test(text);
  const confirmed = (intent) => INFO[intent]?.test(text);
  const help = searchHelp(mensagem);
  // Intenção informativa confirmada por palavra-chave entre as três mais prováveis.
  const informative = ranking.slice(0, 3).find((r, i) => confirmed(r.intent) && r.p >= (i ? 0.15 : 0.35));

  const accepted = top.p >= THRESHOLD && top.coverage >= (top.intent === "fora_escopo" ? 0.2 : 0.34) && !INFO[top.intent] && top.intent !== "refinar";
  let intent;
  const guest = !user;
  const memo = await memoryAnswer(text, e, ctx, products, perfil, guest);
  const first0 = memo || early(text, mensagem, e, ctx, products, guest);
  const react = first0 || setupEditAnswer(text, mensagem, e, ctx, products) || reaction(text, e, ctx, products);
  const action = react || (ctx.aguardando && slotAnswer ? null : special(text, e, ctx, page, products));
  // Gosto novo no meio de um setup ("quero em preto", "e no estilo do Hendrix?") remonta o setup.
  const tasteInSetup = ctx.intent === "setup" && !ctx.aguardando && (e.artista || e.som || e.cor) && !e.categoria && !e.produtos.length;
  if (react) intent = react.intent;
  else if (tasteInSetup && !action) intent = "setup";
  else if (ctx.aguardando && slotAnswer && !(confirmed(top.intent) && top.p >= 0.5)) intent = ctx.intent || "recomendar";
  else if (action) intent = action.intent;
  else if (CONTACT.test(text) || (SUPPORT.test(text) && !shopping && !Object.values(INFO).some((re) => re.test(text)))) intent = "ajuda";
  else if (SUPPORT.test(text) && INFO.pedido_status.test(text) && !INFO.troca.test(text) && !INFO.pedido_cancelar.test(text)) intent = "pedido_status";
  else if (GLOSSARY_Q.test(text) && strongHelp(help)) intent = "central_ajuda";
  else if (informative) intent = informative.intent;
  else if (top.intent === "setup" && top.p >= 0.35 && SETUP_WORDS.test(text)) intent = "setup";
  else if (SETUP_WORDS.test(text) && (e.artista || e.som) && !e.categoria) intent = "setup";
  else if (top.intent === "refinar" && top.p >= 0.35 && !shopping) intent = ctx.intent ? "refinar" : "recomendar";
  else if (shopping) intent = "recomendar";
  else if (e.ordem && ctx.intent) intent = "refinar";
  else if ((e.max || e.min) && ctx.intent) intent = ctx.intent;
  else if (strongHelp(help) && !(accepted && CONVERSATION.includes(top.intent))) intent = "central_ajuda";
  else if (accepted) intent = top.intent;
  else intent = "nao_entendi";

  const keep = { ...ctx, aguardando: null };
  const first = String(user?.nome || "").split(" ")[0];
  let out;
  // Artista que a base não conhece: diz isso e pede uma descrição do som, sem inventar.
  const unknownArtist = taste.desconhecido && !shopping && !react && !action && !INFO[intent] && !["pedido_status", "pedido_cancelar"].includes(intent);
  if (unknownArtist) {
    intent = "gosto_desconhecido";
    out = {
      texto: `Ainda não conheço o som de “${taste.desconhecido}”. Me conta como é: mais pesado, suave, espacial, dançante? Ou cite um artista parecido que eu monto a partir dele.`,
      sugestoes: ["Pesado e intenso", "Suave e melódico", "Espacial, com eco", "Dançante, com groove", "Som do Slash"],
      contexto: ctx.aguardando ? ctx : keep,
    };
  } else if (first0?.out) out = { ...first0.out, contexto: first0.out.contexto || keep };
  else if (react && !first0) out = react.out;
  else if (action?.out) {
    // Produtos mostrados pela ação viram referência para "a primeira", "essa" e "adiciona tudo".
    const shown = (action.out.cards || []).map((c) => c.id);
    const replaces = ["comparar", "carrinho"].includes(intent);
    out = { ...action.out, contexto: replaces && shown.length ? { ...keep, intent: null, mostrados: shown } : keep };
  } else if (guest && LOGIN_NEEDED[intent]) out = { ...loginAnswer(LOGIN_NEEDED[intent]), contexto: keep };
  else if (intent === "encomenda_status") {
    // Sem encomenda feita, "minha encomenda" provavelmente é o pedido: responde sobre ele.
    const mine = await requests();
    out = !mine.length && (await orders()).length ? { ...(await handleOrders("pedido_status", text, orders)), contexto: keep } : { ...requestsAnswer(mine), contexto: keep };
  }
  else if (guest && intent === "troca" && /\b(meu|minha|comprei|pedido)\b/.test(text)) out = { ...faqAnswer("troca", text), texto: `${faqAnswer("troca", text).texto} Para abrir a solicitação, entre na sua conta e use o comprovante do pedido.`, acoes: loginAnswer("").acoes, contexto: keep };
  else if (intent === "historico") out = { ...historyAnswer(await orders(), products), contexto: keep };
  else if (intent === "favoritos") out = { ...favoritesAnswer(page, guest ? [] : await alerts()), ...(guest ? { acoes: [{ tipo: "link", rotulo: "Abrir favoritos", href: "/favoritos.html" }, ...loginAnswer("").acoes] } : {}), contexto: keep };
  else if (intent === "troca" && !/senha/.test(text) && exchangeAnswer(await orders())) out = { ...exchangeAnswer(await orders()), contexto: keep };
  else if (intent === "recomendar") {
    out = handleRecommend(e, ctx, products);
    if (ctx.aguardando === "orcamento" && e.max && out.cards?.length && out.cards.every((c) => c.priceCents <= e.max)) out.texto = `Até ${brl(e.max)}, estas cabem:`;
  }
  else if (intent === "refinar") {
    if (ctx.intent === "setup") {
      const total = ctx.mostrados.map((id) => products.find((p) => p.id === id)?.priceCents || 0).reduce((a, b) => a + b, 0);
      const up = e.ordem === "desc" || /complet|melhor|car/.test(text);
      out = up ? handleSetup(e, ctx, products, {}, "Uma versão mais completa do setup:", { alvo: Math.ceil(total * 1.5) }) : cheaperSetup(e, ctx, products, total);
    } else out = handleRecommend(e, ctx, products, { refine: true });
  } else if (intent === "setup") out = handleSetup(e, ctx, products);
  else if (intent === "pedido_status" || intent === "pedido_cancelar") out = { ...(await handleOrders(intent, text, orders)), contexto: keep };
  else if (intent === "central_ajuda" || (intent === "conta" && strongHelp(help)))
    out = { ...helpAnswer(help.entry), contexto: keep };
  else if (INFO[intent]) out = { ...faqAnswer(intent, text, page.cupons), sugestoes: START.slice(0, 3), contexto: keep };
  else if (intent === "saudacao")
    out = { texto: `Oi${first ? `, ${first}` : ""}! Sou o assistente da Violet Voltage. Posso indicar equipamentos pelo seu estilo, montar um setup, comparar produtos e tirar dúvidas sobre frete, pagamento e trocas${guest ? "" : ", e contar em que etapa está seu pedido"}. Por onde começamos?`, sugestoes: START, contexto: keep };
  else if (intent === "ajuda" && !ABOUT_BOT.test(text)) out = { ...supportAnswer(guest ? [] : await orders(), guest), contexto: keep };
  else if (intent === "ajuda")
    out = { texto: "Eu entendo frases como “quero uma guitarra vintage para blues até 5 mil”, “monta um setup de rock”, “onde está meu pedido?” ou “aceita pix?”. Indico só o que existe na loja, com preço e estoque de agora; nada é comprado sem você clicar.", sugestoes: START, contexto: keep };
  else if (intent === "agradecimento" && !/obrigad|valeu|brigad|agradec|ajudou|vlw|thanks/.test(text)) out = { texto: "Certo! Quer que eu ajuste alguma coisa? Posso procurar opções mais em conta, outro estilo ou montar um setup.", sugestoes: ["Mais barato", "Outras opções", "Montar um setup"], contexto: keep };
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
  // Etapa 36: memória do gosto. Setup montado para quem tem conta fica salvo; ao começar outro
  // setup (ou na saudação), o assistente oferece partir do gosto da última vez.
  if (perfil && out.contexto?.intent === "setup" && out.cards?.length) await perfil.salvar(out.contexto.filtros).catch(() => {});
  const startingSetup = intent === "setup" && out.contexto?.aguardando === "genero" && ctx.intent !== "setup";
  if (perfil && (startingSetup || intent === "saudacao")) {
    const saved = await perfil.carregar().catch(() => null);
    if (saved) {
      out = { ...out, texto: `${intent === "saudacao" ? out.texto : out.texto.replace(/^Vamos montar! /, "")}\nDa última vez você montou um setup ${describeTaste(saved)}. Quer partir dele?`, sugestoes: ["Usar o mesmo gosto", ...(out.sugestoes || []).slice(0, 4)] };
      if (intent === "setup") out.texto = `Vamos montar! ${out.texto}`;
    }
  }
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
