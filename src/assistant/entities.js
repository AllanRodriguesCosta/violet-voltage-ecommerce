// Extração de entidades por regras: categoria, tipo, gênero, estilo, formato, captação,
// tecnologia, sonoridade, uso, nível, marca, faixa de preço, ordem e produto citado.
import { normalize } from "./text.js";
import { genres } from "../knowledge/genres.js";
import { SPEC_FIELDS } from "../../public/js/specs.js";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (s) => new RegExp(`(?<![a-z0-9])${escape(s).replace(/ /g, "[\\s-]+")}(?![a-z0-9])`);
// Lista [padrões, valor]: o primeiro padrão encontrado define o valor.
const finder = (table) => {
  const compiled = table.map(([patterns, value]) => [patterns.map(word), value]);
  return (text) => compiled.find(([patterns]) => patterns.some((re) => re.test(text)))?.[1];
};

const findTipo = finder([
  [["overdrive", "drive", "od"], "Overdrive"],
  [["distorcao", "distorcedor", "distortion"], "Distorção"],
  [["fuzz"], "Fuzz"],
  [["compressor", "compressao"], "Compressor"],
  [["chorus"], "Chorus"],
  [["tremolo"], "Tremolo"],
  [["delay", "eco"], "Delay"],
  [["reverb", "reverber"], "Reverb"],
  [["wah", "wah wah", "cry baby"], "Wah"],
  [["afinador", "afinadores"], "Afinador"],
  [["looper", "loop"], "Looper"],
  [["pedaleira", "pedaleiras", "multiefeito", "multiefeitos", "multi efeitos"], "Multiefeitos"],
  [["pedalboard", "pedalboards", "board"], "Pedalboard"],
  [["patch", "patches"], "Patch"],
  [["espiral", "enrolado"], "Espiral"],
  [["palheta", "palhetas"], "Palhetas"],
  [["corda", "cordas", "encordoamento", "encordoamentos"], "Encordoamento"],
  [["capotraste", "capo"], "Capotraste"],
  [["suporte de parede", "gancho de parede"], "Suporte de parede"],
  [["suporte de chao", "pedestal", "estante"], "Suporte de chão"],
  [["kit de limpeza", "limpeza", "limpar"], "Limpeza"],
]);
const TIPO_CATEGORIA = {
  Patch: "Cabos",
  Espiral: "Cabos",
  Palhetas: "Acessórios",
  Encordoamento: "Acessórios",
  Capotraste: "Acessórios",
  "Suporte de parede": "Acessórios",
  "Suporte de chão": "Acessórios",
  Limpeza: "Acessórios",
  Afinador: null, // existe em pedal e de prender no braço
};
const findCategoria = finder([
  [["guitarra", "guitarras", "guita"], "Guitarras"],
  [["amplificador", "amplificadores", "amp", "amps", "cubo", "cubos", "combo", "caixa"], "Amplificadores"],
  [["pedal", "pedais", "efeito", "efeitos"], "Pedais"],
  [["cabo", "cabos", "p10"], "Cabos"],
  [["correia", "correias", "alca", "alcas", "strap"], "Correias"],
  [["acessorio", "acessorios", "suporte", "suportes"], "Acessórios"],
]);
const findFormato = finder([
  [["stratocaster", "strato", "strat", "estilo strat"], "Strat"],
  [["telecaster", "tele"], "Tele"],
  [["les paul", "lespaul", "single cut"], "Single cut"],
  [["sg", "double cut"], "Double cut"],
  [["semiacustica", "semi acustica", "semi solida", "hollow", "hollow body", "335"], "Semiacústica"],
  [["jazzmaster", "jaguar", "offset", "mustang"], "Offset"],
  [["superstrat", "super strat"], "Superstrat"],
]);
const findCaptacao = finder([
  [["single coil", "single coils", "singles", "single"], "Single-coil"],
  [["humbucker", "humbuckers", "captador duplo"], "Humbucker"],
  [["p90", "p 90"], "P90"],
]);
const findTecnologia = finder([
  [["valvulado", "valvulados", "valvula", "valvulas", "tube"], "Valvulado"],
  [["transistor", "transistorizado", "solid state"], "Transistor"],
  [["modelagem", "simulador de amplificador", "simulacao de amp"], "Modelagem digital"],
  [["analogico", "analogicos"], "Analógico"],
  [["digital", "digitais"], "Digital"],
]);
const findVoicing = finder([
  [["britanico", "britanica", "ingles", "inglesa", "british"], "Britânico"],
  [["americano", "americana", "american"], "Americano"],
  [["high gain", "alto ganho", "muito ganho"], "High gain"],
]);
const findEstilo = finder([
  [["vintage", "antigo", "antiga", "antigos", "classico", "classica", "retro", "anos 50", "anos 60", "anos 70", "old school", "raiz"], "Vintage"],
  [["moderno", "moderna", "modernos", "atual", "contemporaneo"], "Moderno"],
]);
const findUso = finder([
  [["em casa", "estudar", "estudo", "apartamento", "treinar", "praticar", "no quarto"], "Estudo em casa"],
  [["ensaio", "ensaios", "ensaiar", "banda"], "Ensaio"],
  [["palco", "show", "shows", "ao vivo", "tocar fora"], "Palco"],
  [["estudio", "gravar", "gravacao", "gravacoes", "home studio"], "Estúdio"],
]);
const findNivel = finder([
  [["iniciante", "iniciantes", "comecando", "comecar", "primeira guitarra", "aprendendo", "aprender", "leigo", "novato"], "Iniciante"],
  [["intermediario", "intermediaria"], "Intermediário"],
  [["profissional", "profissionais", "avancado", "top de linha"], "Profissional"],
]);
const BRAND_ALIASES = {
  "Electro-Harmonix": ["ehx", "electro harmonix", "electroharmonix"],
  "D'Addario": ["daddario", "d addario"],
  "Violet Voltage": ["violet voltage", "violet", "marca da loja", "marca propria"],
  "Line 6": ["line 6", "line6"],
  "TC Electronic": ["tc electronic", "tc"],
  "Pro Co": ["pro co", "proco"],
  "Music Man": ["music man", "musicman"],
  "M-Vave": ["m vave", "mvave"],
};

// Sinônimos de gênero do mais longo para o mais curto: "blues rock" antes de "blues" e "rock".
const GENRE_SYNONYMS = genres
  .flatMap((g) => [g.nome, ...g.sinonimos].map((s) => [normalize(s), g.nome]))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([s, nome]) => [word(s), nome]);

// Preço em centavos. Só conta número com marca de dinheiro (R$, mil, k, reais) ou
// precedido de expressão de preço; "10x", "15 W" e "3 m" ficam de fora.
const MAX_WORDS = /(ate|no maximo|maximo|max|menos de|abaixo de|nao passar de|orcamento de|orcamento|gastar|teto de|limite de|tenho|so tenho|disponho de|tenho so|posso gastar|da pra gastar)\s*(de\s*)?(r\$\s*)?$/;
const MIN_WORDS = /(acima de|a partir de|mais de|no minimo|minimo de|pelo menos|partir de)\s*(r\$\s*)?$/;
const ABOUT_WORDS = /(uns|umas|cerca de|por volta de|em torno de|aproximadamente|perto de|na faixa de|faixa de)\s*(r\$\s*)?$/;
const NUMBER = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k)?(?![a-z0-9])\s*(reais|conto|contos|pila)?/g;
export function extractPrice(value) {
  const text = normalize(value);
  const found = [];
  for (const m of text.matchAll(NUMBER)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    if (/^\s*(x|w|m\b|mm|cm|watt)/.test(after)) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    let value = Number(m[2].replace(/\./g, "")) + (m[3] ? Number(`0.${m[3]}`) : 0);
    if (m[4]) value *= 1000;
    const money = Boolean(m[1] || m[4] || m[5]);
    const kind = MAX_WORDS.test(before) ? "max" : MIN_WORDS.test(before) ? "min" : ABOUT_WORDS.test(before) ? "about" : /entre\s*(r\$\s*)?$/.test(before) ? "between" : /\be\s*(r\$\s*)?$/.test(before) && found.at(-1)?.kind === "between" ? "and" : money ? "about" : null;
    if (!kind || value < 5 || value > 1_000_000) continue;
    found.push({ kind, cents: Math.round(value * 100) });
  }
  const price = {};
  for (const [i, f] of found.entries()) {
    if (f.kind === "max") price.max = f.cents;
    else if (f.kind === "min") price.min = f.cents;
    else if (f.kind === "between" && found[i + 1]?.kind === "and") {
      price.min = Math.min(f.cents, found[i + 1].cents);
      price.max = Math.max(f.cents, found[i + 1].cents);
    } else if (f.kind === "about" && price.max === undefined) price.max = Math.round(f.cents * 1.15);
  }
  return price;
}

// Produto citado pelo nome ("a AC30", "o TS9", "Vintera"): termos raros do nome do modelo.
const GENERIC = new Set(
  "guitarra guitarras pedal pedais cabo cabos correia correias kit standard classic vibe player series light regular combo digital chromatic tuner distortion encordoamento suporte chao parede vintage cable cables patch flat stratocaster telecaster jazzmaster les paul delay reverb chorus fuzz tremolo overdrive looper mini ".split(" "),
);
// Palavras de gênero e de ficha técnica descrevem o que se procura, não um modelo específico.
for (const g of genres) for (const s of [g.nome, ...g.sinonimos]) for (const t of normalize(s).split(/[^a-z0-9]+/)) GENERIC.add(t);
for (const field of Object.values(SPEC_FIELDS).flat()) for (const v of field.values || []) for (const t of normalize(v).split(/[^a-z0-9]+/)) GENERIC.add(t);
const compact = (s) => normalize(s).replace(/\b([a-z]{2})[\s-](\d{1,3})\b/g, "$1$2").replace(/-/g, " ");
let productIndex = { key: "", entries: [] };
function indexProducts(products) {
  const key = products.map((p) => p.id).join(",");
  if (productIndex.key === key) return productIndex.entries;
  const termsOf = (p) => [...new Set(compact(p.modelo).split(/[^a-z0-9]+/))];
  const frequency = new Map();
  for (const p of products) for (const t of termsOf(p)) frequency.set(t, (frequency.get(t) || 0) + 1);
  const entries = products.map((p) => ({
    product: p,
    full: compact(p.modelo),
    terms: termsOf(p).filter((t) => !GENERIC.has(t) && (frequency.get(t) || 0) <= 2 && ((/\d/.test(t) && /[a-z]/.test(t) && t.length >= 3) || (/^[a-z]+$/.test(t) && t.length >= 4))),
  }));
  productIndex = { key, entries };
  return entries;
}
function findProducts(text, products) {
  const message = compact(text);
  const words = new Set(message.split(/[^a-z0-9]+/));
  let best = 0;
  const scored = indexProducts(products).map(({ product, full, terms }) => {
    let score = full.length >= 4 && word(full).test(message) ? 10 : 0;
    for (const t of terms) if (words.has(t) || (/\d/.test(t) && [...words].some((w) => w.length >= 3 && /\d/.test(w) && t.startsWith(w)))) score++;
    best = Math.max(best, score);
    return { product, score };
  });
  if (!best) return [];
  return scored.filter((s) => s.score === best).map((s) => s.product).slice(0, 3);
}

export function extract(message, products = []) {
  const text = normalize(message);
  let rest = text;
  let genero;
  for (const [re, nome] of GENRE_SYNONYMS)
    if (re.test(rest)) {
      genero = nome;
      rest = rest.replace(re, " ");
      break;
    }
  // "7 cordas" é característica da guitarra, não encordoamento.
  const cordas = /\b(7|sete) cordas\b/.test(rest) ? "7 cordas" : /\b(8|oito) cordas\b/.test(rest) ? "8 cordas" : undefined;
  if (cordas) rest = rest.replace(/\b(7|sete|8|oito) cordas\b/, " ");
  const tipo = findTipo(rest);
  const formato = findFormato(rest);
  rest = rest.replace(/(single|double)[\s-]+cut/g, " ");
  const captacao = findCaptacao(rest);
  const tecnologia = findTecnologia(rest);
  const voicing = findVoicing(rest);
  // Etapa 24: mão, número de cordas, captadores ativos e trastes (ficha das guitarras).
  const mao = /\bcanhot[oa]s?\b|mao esquerda/.test(rest) ? "Canhoto" : undefined;
  const captadores = /captador(es)? ativos?|\bativos?\b.*captador|\bemg\b/.test(rest) ? "Ativos" : undefined;
  const trastes = Number(rest.match(/\b(2[0-9])\s*trastes\b/)?.[1]) || undefined;
  let categoria = findCategoria(rest);
  if (!categoria && (formato || captacao || mao || cordas || captadores || trastes)) categoria = "Guitarras";
  if (!categoria && tipo) categoria = tipo in TIPO_CATEGORIA ? TIPO_CATEGORIA[tipo] || undefined : "Pedais";
  if (!categoria && (voicing || ["Valvulado", "Transistor", "Modelagem digital"].includes(tecnologia))) categoria = "Amplificadores";
  const brands = [...new Set(products.map((p) => p.marca))];
  const marca = brands.find((b) => [b, ...(BRAND_ALIASES[b] || [])].some((alias) => word(normalize(alias)).test(rest)));
  const ordem = /\b(mais barat\w*|barat\w*|em conta|economic\w*|acessive\w*|menor preco|mais em conta)\b/.test(text)
    ? "asc"
    : /\b(mais car\w*|premium|top de linha|mais completo)\b/.test(text)
      ? "desc"
      : undefined;
  return {
    texto: text,
    categoria,
    tipo,
    genero,
    estilo: findEstilo(rest),
    formato,
    captacao,
    tecnologia,
    voicing,
    uso: findUso(rest),
    nivel: findNivel(rest),
    mao,
    cordas,
    captadores,
    trastes,
    marca,
    ordem,
    ...extractPrice(text),
    produtos: findProducts(text, products),
  };
}
