// Etapa 24: o assistente que age. Comparação, perguntas sobre a ficha, "essa" pela página
// atual, o que falta no carrinho, adicionar com confirmação, glossário, histórico de
// compras, favoritos com preço e pedido de troca. Tudo com dados da loja; nada é comprado
// ou alterado sem o clique do cliente.
import { normalize } from "./text.js";
import { extract } from "./entities.js";
import { brl } from "./faq.js";
import { recommend, reasonFor } from "./recommend.js";
import { compareRows, specRows, fitsGenre, needsPower, GENEROS } from "../../public/js/specs.js";
import { cartAdvice } from "../../public/js/compat.js";
import { KITS, kitPrice } from "../../public/js/kits.js";
import { glossary, glossaryId } from "../knowledge/glossary.js";
import { guides } from "../knowledge/guides.js";
import { coupons } from "../services/pricing.js";

const ID = /^[\w-]{1,64}$/;
const link = (rotulo, href) => ({ tipo: "link", rotulo, href });
const name = (p) => `${p.marca} ${p.modelo}`;
const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
export const card = (p, motivo = "") => ({
  id: p.id,
  marca: p.marca,
  modelo: p.modelo,
  categoria: p.categoria,
  priceCents: p.priceCents,
  estoque: p.estoque,
  imageUrl: p.imageUrl || "",
  motivo,
});

// O navegador informa a página atual, o carrinho e os favoritos. Só IDs e quantidades,
// revalidados aqui contra o catálogo.
export function sanitizePage(input = {}, products = []) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pagina = input.pagina && typeof input.pagina === "object" ? input.pagina : {};
  const tipo = ["produto", "carrinho", "comparar", "checkout", "outra"].includes(pagina.tipo) ? pagina.tipo : "outra";
  const produto = tipo === "produto" && typeof pagina.id === "string" && ID.test(pagina.id) ? byId.get(pagina.id) || null : null;
  const carrinho = (Array.isArray(input.carrinho) ? input.carrinho : [])
    .slice(0, 30)
    .filter((i) => i && typeof i.id === "string" && byId.has(i.id) && Number.isInteger(i.quantidade) && i.quantidade > 0 && i.quantidade <= 99)
    .map((i) => ({ product: byId.get(i.id), quantidade: i.quantidade }));
  const favoritos = [...new Set((Array.isArray(input.favoritos) ? input.favoritos : []).slice(0, 100).filter((id) => typeof id === "string" && byId.has(id)))].map((id) => byId.get(id));
  return { tipo, produto, carrinho, favoritos };
}

// "essa", "esse produto", "a primeira", "a segunda": produto da página ou da última lista.
export const PRONOUN = /\b(ess[ae]s?|est[ae]s?|del[ae]|ela|ele|dess[ae]|dest[ae]|nessa|nesse|neste|nesta|o produto|a guitarra|o pedal|o amp|o amplificador)\b/;
const ORDINAL = [/\b(primeir[ao]|1[ºoa]?)\b/, /\b(segund[ao]|2[ºoa]?)\b/, /\b(terceir[ao]|3[ºoa]?)\b/];
// Produtos citados em partes diferentes da frase ("a SG com a Les Paul", "DS-1 ou RAT 2").
export function mentions(text, products) {
  const found = [];
  for (const part of text.split(/\s(?:com|e|ou|x|vs|versus|contra)\s|,/)) {
    const [p] = extract(part, products).produtos;
    if (p && !found.includes(p)) found.push(p);
  }
  return found;
}
export function targets(text, e, ctx, page, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const found = [...e.produtos];
  for (const p of mentions(text, products)) if (!found.includes(p)) found.push(p);
  const shown = ctx.mostrados.map((id) => byId.get(id)).filter(Boolean);
  ORDINAL.forEach((re, i) => {
    if (re.test(text) && shown[i] && !found.includes(shown[i])) found.push(shown[i]);
  });
  if (/\b(as|os) (duas|dois)\b/.test(text)) for (const p of shown.slice(0, 2)) if (!found.includes(p)) found.push(p);
  if ((PRONOUN.test(text) || !found.length) && page.produto && !found.includes(page.produto)) found.push(page.produto);
  else if (PRONOUN.test(text) && !found.length && shown[0]) found.push(shown[0]);
  return found;
}

// Glossário: "o que é humbucker?", "pra que serve um looper?".
export const GLOSSARY_Q = /\b(o que (e|eh|significa|quer dizer)|significad|pra que serve|para que serve|o que faz (um|uma|o|a)|como funciona (um|uma)|explica)\b/;
const glossaryIndex = glossary.map((t) => ({
  term: t,
  keys: [t.termo, ...t.sinonimos.split(",")].map((k) => normalize(k).trim()).filter((k) => k.length >= 2),
}));
const escapeRe = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Termos citados na frase, do mais específico ao mais curto, sem repetir o mesmo verbete.
export function findTerms(text) {
  const hits = [];
  for (const { term, keys } of glossaryIndex) {
    const len = Math.max(0, ...keys.filter((k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k)}([^a-z0-9]|$)`).test(text)).map((k) => k.length));
    if (len) hits.push({ term, len });
  }
  return hits.sort((a, b) => b.len - a.len).map((h) => h.term);
}
export const findTerm = (text) => findTerms(text)[0] || null;
export function glossaryAnswer(term, other) {
  const guide = term.guia && guides.find((g) => g.id === term.guia);
  return {
    texto: other ? `${term.termo}: ${term.definicao}\n${other.termo}: ${other.definicao}` : `${term.termo}: ${term.definicao}`,
    acoes: [link("Ver no glossário", `/guias.html#${glossaryId(term.termo)}`), ...(guide ? [link(`Guia: ${guide.titulo}`, `/guias.html#${guide.id}`)] : [])],
    sugestoes: ["O que é humbucker?", "Qual a ordem dos pedais?", "Quero uma guitarra"],
  };
}

// Comparação de 2 a 4 produtos: diferenças da ficha e de preço, com link para a tabela.
export function compareAnswer(items) {
  const chosen = items.slice(0, 4);
  const rows = compareRows(chosen).filter((r) => r.differs && !["marca", "generos"].includes(r.key));
  const [a, b] = chosen;
  const cheaper = [...chosen].sort((x, y) => x.priceCents - y.priceCents)[0];
  const lines = rows.slice(0, 5).map((r) => `• ${r.label}: ${chosen.map((p, i) => `${p.modelo} ${r.values[i]}`).join(" × ")}`);
  const genres = chosen.map((p) => (p.ficha?.generos?.length ? p.ficha.generos.slice(0, 3).join(", ") : "versátil"));
  return {
    texto: [
      `${list(chosen.map(name))} lado a lado:`,
      ...(lines.length ? lines : ["• As fichas são bem parecidas: a diferença está no preço e na marca."]),
      `• Indicadas para: ${chosen.map((p, i) => `${p.modelo} ${genres[i]}`).join(" × ")}`,
      `• Preço: ${chosen.map((p) => `${p.modelo} ${brl(p.priceCents)}`).join(" × ")}. ${chosen.length === 2 ? `A ${cheaper.modelo} sai ${brl(Math.abs(a.priceCents - b.priceCents))} mais em conta.` : `A mais em conta é a ${cheaper.modelo}.`}`,
    ].join("\n"),
    cards: chosen.map((p) => card(p)),
    acoes: [link("Abrir a comparação completa", `/comparar.html?ids=${chosen.map((p) => p.id).join(",")}`)],
    sugestoes: [`Qual serve melhor para blues?`, "Adicionar a primeira ao carrinho", "Mais barato"],
  };
}

// Perguntas sobre a ficha de um produto.
const SPEC_Q = [
  [/trast|casas\b|frets?\b/, ["trastes"]],
  [/escala|comprimento de escala|scale/, ["escala"]],
  [/alavanca|tremolo|ponte|floyd/, ["ponte"]],
  [/captac|captador|single|humbucker|p90/, ["captacao", "captadores"]],
  [/ativ[oa]s?\b|passiv/, ["captadores"]],
  [/canhot|destr|mao esquerda/, ["mao"]],
  [/cordas\b|7 cordas|sete cordas/, ["cordas"]],
  [/formato|modelo de corpo|corpo/, ["formato"]],
  [/potencia|watts?\b|\bw\b|volume|alto/, ["potencia"]],
  [/falante|alto-?falante|speaker/, ["falantes"]],
  [/valvul|transistor|digital|tecnologia|analogic/, ["tecnologia"]],
  [/fonte|bateria|pilha|alimenta|9 ?v\b|energia/, ["alimentacao"]],
  [/conector|plug|p10|reto|em l\b/, ["conectores"]],
  [/comprimento|metros?\b|tamanho/, ["comprimento"]],
  [/material|couro|nylon|tecido|algodao/, ["material"]],
  [/timbre|som dela|som dele|soa\b/, ["timbre", "voicing"]],
  [/iniciante|nivel|profissional|comecando|intermediari/, ["nivel"]],
  [/compativel|compatibilidade|serve em|serve no|serve na/, ["compatibilidade"]],
  [/efeito|tipo de pedal/, ["efeito"]],
  [/uso|palco|ensaio|estudio|estudar em casa/, ["uso"]],
];
export const SPEC_WORDS = /trast|escala|metros?\b|tamanho|alavanca|tremolo|ponte|floyd|captac|captador|canhot|cordas|formato|potencia|watts|falante|valvul|transistor|tecnologia|fonte|bateria|alimenta|9 ?v\b|conector|plug|comprimento|material|timbre|compativel|funciona (com|no|na|em)|serve (pra|para)|bo[am] (pra|para)|combina com|da pra tocar|estoque|tem (em|no) estoque|garantia|regulagem|ativ[oa]s?\b|passiv|pesad|nivel/;
export function specAnswer(p, text) {
  const rows = specRows(p);
  const fields = new Set();
  for (const [re, keys] of SPEC_Q) if (re.test(text)) for (const k of keys) fields.add(k);
  const answers = rows.filter((r) => fields.has(r.field.key)).map((r) => `${r.field.label}: ${r.text}`);
  const extra = [];
  // "Serve para metal?" / "combina com blues?"
  const genre = GENEROS.find((g) => text.includes(normalize(g)) || (g === "Heavy metal" && /\bmetal\b/.test(text)));
  if (genre && /serve|bo[am]|combina|da pra|indicad|funciona/.test(text))
    extra.push(
      fitsGenre(p, genre)
        ? `Serve sim para ${genre.toLowerCase()}: ${p.ficha?.generos?.length ? `é indicada para ${list(p.ficha.generos.slice(0, 4))}` : "é um item versátil, sem estilo específico"}.`
        : `Para ${genre.toLowerCase()} ela não é a indicação mais forte: a ficha aponta ${list(p.ficha.generos.slice(0, 4))}. Posso sugerir opções de ${genre.toLowerCase()}.`,
    );
  if (/fonte|bateria|pilha|alimenta|9 ?v\b|energia/.test(text) && p.categoria === "Pedais")
    extra.push(needsPower(p) ? "Precisa de fonte de 9V centro negativo, que não vem na caixa (na loja tem fonte simples e fonte isolada)." : `Não precisa comprar fonte: ${String(p.ficha?.alimentacao || "a alimentação vem com o produto").toLowerCase()}.`);
  if (/funciona (com|no|na|em)|compativel|serve (no|na|em) (meu|minha)/.test(text) && ["Pedais", "Cabos"].includes(p.categoria))
    extra.push("Pedais e cabos P10 funcionam com qualquer guitarra e amplificador de guitarra: o plugue é padrão.");
  if (/estoque|tem (ainda|disponivel)|acabou|esgot/.test(text)) extra.push(p.estoque ? `${p.estoque <= 5 ? `Últimas unidades: ${p.estoque}` : `${p.estoque} unidades`} em estoque.` : "Está esgotado agora; na página dá para ativar o Avise-me.");
  if (/quanto custa|preco|valor|parcel/.test(text)) extra.push(`Custa ${brl(p.priceCents)}.`);
  if (/garantia|regulagem/.test(text)) extra.push(p.categoria === "Guitarras" ? "No carrinho dá para incluir regulagem por luthier, troca de cordas e garantia estendida de 12 meses." : ["Amplificadores", "Pedais"].includes(p.categoria) ? "No carrinho dá para incluir garantia estendida de 12 meses." : "Este item não tem serviços adicionais.");
  const lines = [answers.length ? `${answers.join("; ")}.` : "", ...extra].filter(Boolean);
  const texto = lines.length
    ? `${name(p)}: ${lines.join(" ")}`
    : `Não achei esse dado na ficha da ${name(p)}. O que ela informa: ${rows.filter((r) => r.field.key !== "generos").map((r) => `${r.field.label.toLowerCase()} ${r.text}`).slice(0, 5).join(", ")}.`;
  return {
    texto,
    cards: [card(p, reasonFor(p))],
    acoes: [link("Ver a ficha completa", `/produto.html?id=${encodeURIComponent(p.id)}`)],
    sugestoes: p.categoria === "Guitarras" ? ["Quantos trastes tem?", "Serve para metal?", "Comparar com outra", "Adicionar ao carrinho"] : ["Precisa de fonte?", "Tem em estoque?", "Adicionar ao carrinho"],
  };
}

// Adicionar ao carrinho: o assistente propõe, o cliente confirma no botão.
export function addAnswer(items) {
  const available = items.filter((p) => p.estoque > 0);
  if (!available.length)
    return {
      texto: items.length ? `${list(items.map(name))} ${items.length === 1 ? "está esgotado" : "estão esgotados"} agora. Na página do produto dá para ativar o Avise-me.` : "Qual produto você quer adicionar? Diga o nome ou abra a página dele e me peça de novo.",
      acoes: items[0] ? [link("Ver o produto", `/produto.html?id=${encodeURIComponent(items[0].id)}`)] : [],
      sugestoes: ["Quero uma guitarra", "Montar um setup"],
    };
  const total = available.reduce((s, p) => s + p.priceCents, 0);
  return {
    texto: `Confirma? ${available.length === 1 ? `${name(available[0])} por ${brl(total)}` : `${available.length} itens por ${brl(total)} no total`}. Toque no botão para colocar no carrinho.`,
    cards: available.map((p) => card(p)),
    acoes: [{ tipo: "carrinho", rotulo: available.length === 1 ? "Confirmar e adicionar" : `Adicionar os ${available.length} itens`, itens: available.map((p) => p.id) }, link("Ver o carrinho", "/carrinho.html")],
    sugestoes: ["O que falta no meu carrinho?", "Tem cupom de desconto?"],
  };
}

// Cupom: "aplica o cupom VOLTAGE10".
export function couponAnswer(text) {
  const code = Object.keys(coupons).find((c) => text.includes(c.toLowerCase()));
  if (!code) return null;
  return {
    texto: `${code}: ${coupons[code].description}. Toque para deixar o cupom aplicado no carrinho; o valor é conferido de novo no checkout.`,
    acoes: [{ tipo: "cupom", rotulo: `Aplicar ${code}`, codigo: code }],
    sugestoes: ["O que falta no meu carrinho?"],
  };
}

// O que falta no carrinho: as mesmas regras do aviso de compatibilidade da página.
export function cartAnswer(page, products) {
  if (!page.carrinho.length)
    return { texto: "Seu carrinho está vazio por enquanto. Quer que eu monte um setup ou indique um kit?", sugestoes: ["Montar um setup", "Quais kits vocês têm?"], acoes: [link("Ver os kits", "/kits.html")] };
  const advice = cartAdvice(page.carrinho, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const picks = advice.map((a) => byId.get(a.sugestao)).filter(Boolean);
  if (!advice.length)
    return { texto: `Seu carrinho (${page.carrinho.length} ${page.carrinho.length === 1 ? "item" : "itens"}) está completo: não falta cabo, fonte nem acessório essencial para o que você escolheu.`, acoes: [link("Ir para o carrinho", "/carrinho.html")], sugestoes: ["Tem cupom de desconto?", "Qual o prazo de entrega?"] };
  return {
    texto: ["Conferi o seu carrinho:", ...advice.map((a) => `• ${a.titulo}: ${a.texto}`)].join("\n"),
    cards: picks.map((p) => card(p, "Sugestão para o carrinho")),
    acoes: picks.length ? [{ tipo: "carrinho", rotulo: `Adicionar ${picks.length === 1 ? "a sugestão" : `as ${picks.length} sugestões`}`, itens: picks.map((p) => p.id) }, link("Ir para o carrinho", "/carrinho.html")] : [link("Ir para o carrinho", "/carrinho.html")],
    sugestoes: ["Tem cupom de desconto?", "Qual o prazo de entrega?"],
  };
}

// Kits que cabem no orçamento (para o "tenho R$ 3 mil para começar").
export function kitsWithin(products, maxCents, genero) {
  return KITS.map((kit) => ({ kit, price: kitPrice(kit, products) }))
    .filter(({ price }) => price?.disponivel && (!maxCents || price.precoCents <= maxCents))
    .filter(({ price }) => !genero || price.items.some((p) => p.categoria === "Guitarras" && fitsGenre(p, genero)))
    .sort((a, b) => b.price.precoCents - a.price.precoCents);
}

// Recomendações pelo histórico: o que completa as compras e itens do mesmo estilo.
export function historyAnswer(orders, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const bought = [...new Set(orders.filter((o) => o.status !== "Cancelado").flatMap((o) => (o.itens || []).map((i) => i.id)))].map((id) => byId.get(id)).filter(Boolean);
  if (!bought.length) return { texto: "Ainda não encontrei compras nesta conta para usar de referência. Me conta seu estilo que eu indico!", sugestoes: ["Quero uma guitarra vintage", "Montar um setup de rock"] };
  const advice = cartAdvice(bought.map((p) => ({ product: p, quantidade: 1 })), products).filter((a) => a.nivel === "essencial" || a.id === "cordas");
  const complements = advice.map((a) => byId.get(a.sugestao)).filter(Boolean);
  const genres = bought.flatMap((p) => p.ficha?.generos || []);
  const genero = genres.sort((a, b) => genres.filter((g) => g === b).length - genres.filter((g) => g === a).length)[0];
  const main = bought.find((p) => p.categoria === "Guitarras") || bought[0];
  const similar = recommend(products, { categoria: main.categoria === "Guitarras" ? "Pedais" : main.categoria, ...(genero ? { genero } : {}) }, { exclude: bought.map((p) => p.id), limit: 2 }).items;
  const picks = [...new Map([...complements, ...similar].map((p) => [p.id, p])).values()].slice(0, 4);
  return {
    texto: `Pelo que você já comprou (${list(bought.slice(0, 3).map((p) => p.modelo))}${bought.length > 3 ? " e mais" : ""})${genero ? `, seu som puxa para ${genero.toLowerCase()}` : ""}. Combinariam bem:`,
    cards: picks.map((p) => card(p, complements.includes(p) ? "Completa o que você comprou" : reasonFor(p, genero))),
    acoes: picks.length ? [{ tipo: "carrinho", rotulo: "Adicionar ao carrinho", itens: picks.map((p) => p.id) }] : [],
    sugestoes: genero ? [`Mais pedais de ${genero}`, "Onde está meu pedido?"] : ["Quero um pedal", "Onde está meu pedido?"],
  };
}

// Favoritos: preço de hoje e avisos de queda de preço.
export function favoritesAnswer(page, alerts) {
  if (!page.favoritos.length) return { texto: "Não vi favoritos salvos neste navegador. Toque no coração dos produtos para guardar e eu acompanho os preços.", sugestoes: ["Quero uma guitarra"] };
  const watch = new Map(alerts.filter((a) => a.tipo === "preco").map((a) => [a.productId, a]));
  const lines = page.favoritos.slice(0, 6).map((p) => {
    const a = watch.get(p.id);
    if (!a) return `• ${name(p)}: ${brl(p.priceCents)} (sem aviso de preço)`;
    return p.priceCents < a.priceCents ? `• ${name(p)}: baixou de ${brl(a.priceCents)} para ${brl(p.priceCents)}!` : `• ${name(p)}: ${brl(p.priceCents)}, igual ou acima do dia do aviso`;
  });
  const dropped = page.favoritos.filter((p) => watch.has(p.id) && p.priceCents < watch.get(p.id).priceCents);
  const unwatched = page.favoritos.filter((p) => !watch.has(p.id)).length;
  return {
    texto: [dropped.length ? `Boa notícia: ${dropped.length === 1 ? "1 favorito baixou" : `${dropped.length} favoritos baixaram`} de preço.` : "Nenhum favorito com aviso baixou de preço por enquanto.", ...lines, unwatched ? `Em Favoritos, “Avisar se baixar o preço” liga o aviso para ${unwatched === 1 ? "o item que falta" : `os ${unwatched} itens que faltam`}.` : ""].filter(Boolean).join("\n"),
    cards: (dropped.length ? dropped : page.favoritos.slice(0, 3)).map((p) => card(p)),
    acoes: [link("Abrir favoritos", "/favoritos.html")],
    sugestoes: ["O que falta no meu carrinho?"],
  };
}

// Troca: pedido concluído há até 7 dias pode abrir a solicitação pelo comprovante.
export function exchangeAnswer(orders, now = new Date()) {
  const done = orders
    .filter((o) => o.status === "Concluído")
    .map((o) => ({ o, at: new Date((o.statusHistory || []).findLast?.((h) => h.status === "Concluído")?.at || o.createdAt) }))
    .sort((a, b) => b.at - a.at);
  const open = done.find(({ at }) => now - at <= 7 * 86400000);
  if (open) {
    const short = `#${open.o.id.slice(0, 8).toUpperCase()}`;
    return {
      texto: `Seu pedido ${short} ainda está no prazo de troca (até 7 dias após o recebimento). No comprovante, em “Solicitar troca”, escolha os itens e conte o motivo: a loja responde nas notificações. O produto precisa estar sem sinais de uso, com acessórios e embalagem.`,
      acoes: [link("Solicitar troca", `/pedido.html?id=${encodeURIComponent(open.o.id)}#troca`)],
      sugestoes: ["Onde está meu pedido?"],
    };
  }
  return null;
}
