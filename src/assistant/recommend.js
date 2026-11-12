// Recomendação pelo catálogo real: filtros obrigatórios (categoria, preço, marca, tipo,
// formato...) e pontuação pela ficha técnica e pela base de conhecimento de gêneros.
import { genres } from "../knowledge/genres.js";
import { UTILITY_EFFECTS, fitsGenre } from "../../public/js/specs.js";

export const GROUP = { Guitarras: "guitarras", Amplificadores: "amplificadores", Pedais: "pedais" };
export const profileOf = (nome) => genres.find((g) => g.nome === nome);
const list = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

function techMatches(value, wanted) {
  if (value === wanted) return true;
  return (wanted === "Digital" && value === "Modelagem digital") || (wanted === "Modelagem digital" && value === "Digital");
}
export function matches(p, f) {
  const fi = p.ficha || {};
  if (f.categoria && p.categoria !== f.categoria) return false;
  if (f.marca && p.marca !== f.marca) return false;
  if (f.min && p.priceCents < f.min) return false;
  if (f.max && p.priceCents > f.max) return false;
  if (f.tipo && fi.efeito !== f.tipo && fi.tipo !== f.tipo) return false;
  if (f.formato && fi.formato !== f.formato) return false;
  if (f.captacao && fi.captacao !== f.captacao) return false;
  if (f.tecnologia && !techMatches(fi.tecnologia, f.tecnologia)) return false;
  if (f.voicing && fi.voicing !== f.voicing) return false;
  return true;
}

// Pontos: gênero indicado na ficha (4), cada característica que a base de conhecimento associa
// ao gênero (2 para a primeira da lista, 1 para as demais), estilo (2), nível e uso (1,5).
export function score(p, f) {
  const fi = p.ficha || {};
  let s = 0;
  if (f.genero) {
    if (list(fi.generos).includes(f.genero)) s += 4;
    else if (!list(fi.generos).length) s += 0.5;
    const profile = profileOf(f.genero)?.[GROUP[p.categoria]];
    for (const [key, values] of Object.entries(profile || {})) {
      const positions = list(fi[key]).map((v) => values.indexOf(v)).filter((i) => i >= 0);
      if (positions.length) s += Math.min(...positions) === 0 ? 2 : 1;
    }
  }
  if (f.estilo && fi.estilo === f.estilo) s += 2;
  else if (f.estilo === "Vintage" && fi.estilo === "Atemporal") s += 0.5;
  if (f.nivel && fi.nivel === f.nivel) s += 1.5;
  if (f.uso && list(fi.uso).includes(f.uso)) s += 1.5;
  return s;
}

export function recommend(products, f, { exclude = [], ordem, limit = 3 } = {}) {
  const pool = products.filter((p) => p.ativo !== false && p.estoque > 0 && matches(p, f));
  let fits = pool;
  // Gênero pedido: nas categorias principais, só itens indicados para ele ou versáteis.
  if (f.genero) {
    const tagged = pool.filter((p) => !GROUP[p.categoria] || fitsGenre(p, f.genero));
    if (tagged.length) fits = tagged;
  }
  const tagged = (p) => (f.genero && list(p.ficha?.generos).includes(f.genero) ? 1 : 0);
  const ranked = fits
    .map((p) => ({ p, s: score(p, f) }))
    .sort((a, b) =>
      ordem && tagged(b.p) !== tagged(a.p)
        ? tagged(b.p) - tagged(a.p)
        : ordem === "asc"
        ? a.p.priceCents - b.p.priceCents
        : ordem === "desc"
          ? b.p.priceCents - a.p.priceCents
          : b.s - a.s || a.p.priceCents - b.p.priceCents,
    )
    .map((r) => r.p);
  const rest = ranked.filter((p) => !exclude.includes(p.id));
  return { items: rest.slice(0, limit), total: fits.length, remaining: Math.max(0, rest.length - limit) };
}

// Motivo curto mostrado em cada card.
export function reasonFor(p, genero) {
  const fi = p.ficha || {};
  const parts = {
    Guitarras: [fi.formato, fi.captacao, fi.estilo],
    Amplificadores: [fi.tecnologia, fi.potencia && `${fi.potencia} W`, fi.voicing],
    Pedais: [fi.efeito, fi.tecnologia !== "Não se aplica" && fi.tecnologia],
    Cabos: [fi.tipo, fi.comprimento && `${String(fi.comprimento).replace(".", ",")} m`],
    Correias: [fi.material, fi.estilo],
    Acessórios: [fi.tipo, fi.compatibilidade],
  }[p.categoria] || [];
  const tail = genero && list(fi.generos).includes(genero) ? `indicado para ${genero.toLowerCase()}` : "";
  return [...parts.filter(Boolean), tail].filter(Boolean).join(" · ");
}

const FORMATO_NOME = {
  Strat: "Stratocaster",
  Tele: "Telecaster",
  "Single cut": "single cut (estilo Les Paul)",
  "Double cut": "double cut (estilo SG)",
  Semiacústica: "semiacústica",
  Offset: "offset (estilo Jazzmaster)",
  Superstrat: "superstrat",
};
export const joinList = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Explicação do gênero para a categoria, a partir da base de conhecimento.
export function genreIntro(genero, categoria, estilo) {
  const g = profileOf(genero);
  if (!g) return "";
  const vintage = estilo === "Vintage" && g.estilo !== "Vintage" ? " com pegada vintage" : "";
  let text = `Para ${g.nome.toLowerCase()}${vintage}: ${lower(g.resumo)}`;
  if (categoria === "Guitarras")
    text += ` Os formatos mais usados são ${joinList(g.guitarras.formato.slice(0, 2).map((f) => FORMATO_NOME[f] || f))}, com captação ${joinList(g.guitarras.captacao.slice(0, 2).map(lower))}.`;
  else if (categoria === "Amplificadores")
    text += ` Combina com amplificador ${lower(g.amplificadores.tecnologia[0])} de sonoridade ${lower(g.amplificadores.voicing[0])}.`;
  else if (categoria === "Pedais") text += ` Os efeitos mais usados são ${joinList(g.pedais.efeito.slice(0, 3).map(lower))}.`;
  return text;
}

// Setup completo dentro do orçamento: cada peça recebe uma fatia; estourou, troca a mais cara
// por uma alternativa mais barata (ou tira os opcionais); sobrou, melhora guitarra e amplificador.
const SLOTS = [
  { categoria: "Guitarras", rotulo: "Guitarra", share: 0.45 },
  { categoria: "Amplificadores", rotulo: "Amplificador", share: 0.35 },
  { categoria: "Pedais", rotulo: "Pedal", share: 0.1, optional: true, fits: (p) => !UTILITY_EFFECTS.includes(p.ficha?.efeito) },
  { categoria: "Cabos", rotulo: "Cabo", share: 0.05, fits: (p) => p.ficha?.tipo !== "Patch" },
  { categoria: "Correias", rotulo: "Correia", share: 0.05, optional: true },
];
// Abaixo de um preço: com gênero, o mais bem pontuado; sem gênero, o mais caro que cabe.
function pickBelow(ranked, limit, byScore) {
  const below = ranked.filter((p) => p.priceCents < limit);
  if (byScore) return below[0];
  return below.reduce((a, b) => (!a || b.priceCents > a.priceCents ? b : a), undefined);
}
export function buildSetup(products, f) {
  const budget = f.max || Infinity;
  const picks = SLOTS.map((slot) => {
    const ranked = recommend(products, { categoria: slot.categoria, genero: f.genero, estilo: f.estilo, nivel: f.nivel, uso: f.uso }, { limit: 100 }).items.filter((p) => !slot.fits || slot.fits(p));
    const allowance = budget * slot.share;
    const within = ranked.filter((p) => p.priceCents <= allowance);
    let choice;
    if (f.genero) choice = within[0];
    else if (within.length) choice = within.reduce((a, b) => (b.priceCents > a.priceCents ? b : a));
    if (!choice) {
      const byPrice = [...ranked].sort((a, b) => a.priceCents - b.priceCents);
      choice = budget === Infinity && !f.genero && f.nivel !== "Iniciante" ? byPrice[Math.floor(byPrice.length / 2)] : byPrice[0];
    }
    return { slot, ranked, choice };
  });
  const total = () => picks.reduce((s, x) => s + (x.choice?.priceCents || 0), 0);
  while (total() > budget) {
    const cheaper = picks
      .filter((x) => x.choice)
      .sort((a, b) => b.choice.priceCents - a.choice.priceCents)
      .map((x) => [x, pickBelow(x.ranked, x.choice.priceCents, f.genero)])
      .find(([, p]) => p);
    if (cheaper) cheaper[0].choice = cheaper[1];
    else {
      const optional = picks.find((x) => x.slot.optional && x.choice);
      if (!optional) break;
      optional.choice = null;
    }
  }
  for (const categoria of ["Guitarras", "Amplificadores"]) {
    const x = picks.find((y) => y.slot.categoria === categoria);
    if (!x?.choice || budget === Infinity) continue;
    const spare = budget - total();
    const better = f.genero
      ? x.ranked.slice(0, x.ranked.indexOf(x.choice)).find((p) => p.priceCents - x.choice.priceCents <= spare)
      : pickBelow(x.ranked.filter((p) => p.priceCents > x.choice.priceCents), x.choice.priceCents + spare + 1, false);
    if (better) x.choice = better;
  }
  const items = picks.filter((x) => x.choice).map((x) => ({ rotulo: x.slot.rotulo, produto: x.choice }));
  const sum = total();
  return { items, total: sum, dentro: sum <= budget };
}
