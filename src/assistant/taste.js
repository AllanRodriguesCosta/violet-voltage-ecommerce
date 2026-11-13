// Etapa 33: gosto pessoal na conversa. Reconhece artista ou banda, tipo de som em palavras
// leigas e cor; junta tudo em preferências que pontuam a recomendação e o setup.
import { artists, sounds, colors, productColors } from "../knowledge/taste.js";
import { normalize } from "./text.js";
import { galleryColors } from "../services/seed-gallery.js";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrase = (s) => new RegExp(`(?<![a-z0-9])${escape(normalize(s)).replace(/ /g, "[\\s.-]*")}(?![a-z0-9])`);
const ARTIST_RES = artists
  .flatMap((a) => a.aliases.map((alias) => [phrase(alias), a.nome, alias.length]))
  .sort((a, b) => b[2] - a[2]);
const COLOR_RES = colors.map((c) => [new RegExp(`(?<![a-z0-9])(${c.sinonimos.join("|")})(?![a-z0-9])`), c.nome]);
export const ARTISTAS = artists.map((a) => a.nome);
export const SONS = sounds.map((s) => s.id);
export const CORES = colors.map((c) => c.nome);
export const artistOf = (nome) => artists.find((a) => a.nome === nome);
export const soundOf = (id) => sounds.find((s) => s.id === id);
export const colorOf = (nome) => colors.find((c) => c.nome === nome);
// Botões das perguntas de gosto.
export const TASTE_CHIPS = ["Som do Slash", "Pesado e intenso", "Suave e melódico", "Espacial, com eco", "Rock clássico", "Blues"];
export const COLOR_CHIPS = ["Preto", "Vermelho", "Sunburst", "Azul", "Branco", "Tanto faz"];
const COLOR_CONTEXT = /\b(cor|cores|colorid\w*|acabamento|pintura|visual|tom de)\b/;
// "Gosto de Fulano": artista que a base não conhece (para responder sem fingir que conhece).
const LIKES = /\b(gosto|curto|adoro|amo|sou fa|fa) (muito )?(d[aoe]s?|da banda|do|de) ([a-z0-9][a-z0-9 .&-]{1,30})$/;

// Artista, som e cor citados. A cor só vale quando o assunto é cor ou equipamento
// ("guitarra vermelha"), ou quando o assistente perguntou a cor: "som limpo" não é cor.
export function extractTaste(text, { aguardando, temProduto = false } = {}) {
  let rest = normalize(text);
  let artista;
  for (const [re, nome] of ARTIST_RES)
    if (re.test(rest)) {
      artista = nome;
      rest = rest.replace(re, " ");
      break;
    }
  const som = sounds.find((s) => s.padroes.test(rest))?.id;
  let cor;
  if (aguardando === "cor" || COLOR_CONTEXT.test(rest) || temProduto || /\bsunburst\b/.test(rest)) cor = COLOR_RES.find(([re]) => re.test(rest))?.[1];
  const desconhecido = !artista && !som ? rest.match(LIKES)?.[4]?.trim() : undefined;
  return { artista, som, cor, desconhecido, resto: rest };
}

// Preferências somadas: artista primeiro (mais específico), depois o tipo de som.
export function prefOf(f) {
  const out = { formato: [], captacao: [], voicing: [], tecnologia: [], efeito: [], marcas: [], timbre: [] };
  for (const source of [artistOf(f.artista)?.pref, soundOf(f.som)?.pref])
    for (const [k, values] of Object.entries(source || {})) for (const v of values) if (!out[k].includes(v)) out[k].push(v);
  return out;
}
export const hasTaste = (f) => Boolean(f.artista || f.som || f.cor);

// Cores do produto: variações com foto (amplificadores), tabela das fotos ou nome do modelo.
export function colorsOf(p) {
  if (Array.isArray(p.cores) && p.cores.length) return p.cores.map((c) => c.nome);
  if (productColors[p.modelo]) return productColors[p.modelo];
  const gallery = galleryColors(p.modelo);
  if (gallery.length) return gallery.map((c) => c.nome);
  const name = normalize(`${p.modelo}`);
  return COLOR_RES.filter(([re]) => re.test(name)).map(([, nome]) => nome);
}
// Variação de cor do produto que bate com a cor pedida (para abrir a página já nela).
export const variantFor = (p, cor) => (cor && (Array.isArray(p.cores) && p.cores.length ? p.cores : galleryColors(p.modelo)).some((c) => c.nome === cor) ? cor : undefined);
export const colorMatches = (p, cor) => Boolean(cor) && colorsOf(p).includes(cor);

const KEY = { Guitarras: ["formato", "captacao", "timbre"], Amplificadores: ["voicing", "tecnologia"], Pedais: ["efeito"] };
// Pontos de gosto: posição na lista de preferência (a primeira vale mais), marca e cor.
export function tasteScore(p, f, pref = prefOf(f)) {
  const fi = p.ficha || {};
  let s = 0;
  for (const key of KEY[p.categoria] || []) {
    const field = key === "efeito" ? fi.efeito : fi[key];
    const values = Array.isArray(field) ? field : [field];
    const positions = values.map((v) => pref[key].indexOf(v)).filter((i) => i >= 0);
    if (positions.length) s += Math.max(0.5, (key === "formato" ? 3 : key === "efeito" ? 2.5 : 1.5) - Math.min(...positions) * 0.5);
  }
  if (pref.marcas.includes(p.marca)) s += 1.5;
  if (colorMatches(p, f.cor)) s += ["Guitarras", "Correias"].includes(p.categoria) ? 3 : 2;
  return s;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// Frase de abertura que explica de onde vieram as escolhas.
export function tasteIntro(f, { cor = true } = {}) {
  const parts = [];
  const a = artistOf(f.artista);
  const s = soundOf(f.som);
  if (a) parts.push(`${a.nome} é conhecido por usar ${a.usa}. Não vendemos os modelos assinatura, mas separei as peças do catálogo mais próximas desse som.`);
  if (s) parts.push(a ? `E como você quer um som ${lowerFirst(s.rotulo)}, ${lowerFirst(s.explica.replace(/^Para um som [^,]+, /, ""))}` : s.explica);
  if (f.cor && cor) parts.push(`Dei preferência a peças em ${f.cor.toLowerCase()} quando existe opção.`);
  return parts.join(" ");
}
// Gênero sugerido pelo gosto, quando o cliente não disse o gênero.
export const genreFromTaste = (f) => artistOf(f.artista)?.genero || soundOf(f.som)?.generos?.[0];
// Rótulo do som a partir do texto do botão ("Pesado e intenso" → pesado).
export const soundByLabel = (text) => sounds.find((s) => normalize(s.rotulo) === normalize(text))?.id;
