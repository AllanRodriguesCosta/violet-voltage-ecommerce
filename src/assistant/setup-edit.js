// Etapa 36: conversa sobre um setup já montado, sem recomeçar do zero.
// - "já tenho uma guitarra" / "só falta o amp": tira do setup o que o cliente já tem;
// - "troca só o amplificador", "outro pedal": troca uma peça e mantém as outras;
// - "mantém a guitarra": trava a peça para as próximas mudanças ("mais barato" não mexe nela);
// - "tira a correia" / "põe um pedal": remove ou devolve peças opcionais;
// - "por que essa guitarra?": explica a escolha pelo gênero, artista, som, cor e orçamento.
import { normalize } from "./text.js";
import { artistOf, soundOf, colorMatches, prefOf } from "./taste.js";
import { joinList, profileOf } from "./recommend.js";

const brl = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
// Palavras de cada peça do setup (com marcas e modelos comuns de quem já tem uma guitarra).
const PARTS = [
  ["Guitarras", /\b(guitarr\w*|violao|strato\w*|strat|les ?paul|tele(caster)?|sg|squier|epiphone|ibanez|instrumento)\b/],
  ["Amplificadores", /\b(amp|amps|amplificador\w*|cubo|caixa|combo|cabecote)\b/],
  ["Pedais", /\b(pedal|pedais|pedaleira|efeito|efeitos|distorcao|overdrive|fuzz|delay)\b/],
  ["Cabos", /\b(cabo|cabos)\b/],
  ["Correias", /\b(correia|correias|alca)\b/],
];
export const PART_NAME = { Guitarras: "guitarra", Amplificadores: "amplificador", Pedais: "pedal", Cabos: "cabo", Correias: "correia" };
const ART = { Guitarras: "a", Amplificadores: "o", Pedais: "o", Cabos: "o", Correias: "a" };
export const partsIn = (text) => PARTS.filter(([, re]) => re.test(text)).map(([c]) => c);

const OWNED = /\b(ja tenho|eu tenho|tenho (um|uma|o|a|meu|minha)|ja possuo|possuo (um|uma)|ja comprei)\b/;
const MISSING = /\b(so (falta|faltam|preciso( de)?|quero)|falta(m)? (so|apenas)?)\b/;
// "Já tenho uma Squier e um cubo" → Guitarras e Amplificadores; "só falta o amp" → todo o resto.
export function detectOwned(text) {
  const t = normalize(text);
  if (OWNED.test(t)) {
    const after = t.slice(t.search(OWNED));
    const clause = after.split(/\b(e quero|quero|mas|preciso|so falta|falta)\b/)[0];
    const tenho = partsIn(clause);
    if (tenho.length) return { tenho };
  }
  if (MISSING.test(t)) {
    const wanted = partsIn(t.slice(t.search(MISSING)));
    if (wanted.length && wanted.length < 5) return { tenho: ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias"].filter((c) => !wanted.includes(c)), falta: wanted };
  }
  return null;
}

const SWAP = /\b(troca|trocar|troque|muda|mudar|mude|substitui\w*|outr[oa]|nao gostei d[oa]|tem outr[oa])\b/;
const KEEP = /\b(mantem|mantenha|manter|mantém|deixa|deixe|fica com|fico com|gostei d[oa]|quero ess[ae]|pode manter|segura)\b/;
const DROP = /\b(tira|tirar|tire|remove|remover|sem|nao quero|nao preciso d[eoa]s?|dispenso)\b/;
const ADD = /\b(poe|por|coloca|colocar|coloque|inclui|incluir|inclua|adiciona|acrescenta|quero tambem|e (um|uma))\b/;
const WHY = /\b(por ?que|porque|pq|motivo|explica|como (voce )?escolheu)\b/;
// O que o cliente quer fazer com o setup mostrado. null quando a frase não é sobre as peças.
export function detectEdit(text) {
  const t = normalize(text);
  const parts = partsIn(t);
  if (WHY.test(t) && (parts.length || /\b(ess[ae]s?|setup|pecas|escolh\w*|isso)\b/.test(t))) return { acao: "porque", partes: parts };
  if (!parts.length) return null;
  if (KEEP.test(t) && !SWAP.test(t.replace(KEEP, ""))) return { acao: "manter", partes: parts };
  if (SWAP.test(t)) return { acao: "trocar", partes: parts };
  if (DROP.test(t)) return { acao: "tirar", partes: parts };
  if (ADD.test(t)) return { acao: "incluir", partes: parts };
  return null;
}

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const GROUP = { Guitarras: "guitarras", Amplificadores: "amplificadores", Pedais: "pedais" };
// Motivos de uma peça do setup, do mais forte para o mais fraco (no máximo três).
export function reasonsFor(item, f) {
  const p = item.produto || item;
  const fi = p.ficha || {};
  const out = [];
  if (item.fixo) out.push("você pediu para manter esta peça");
  const a = artistOf(f.artista);
  if (a) {
    const pref = prefOf({ artista: f.artista });
    const hits = [];
    if (pref.formato.includes(fi.formato)) hits.push(`o formato ${lower(fi.formato)}`);
    if (list(fi.captacao).some((c) => pref.captacao.includes(c))) hits.push(`a captação ${lower(list(fi.captacao)[0])}`);
    if (pref.voicing.includes(fi.voicing)) hits.push(`a sonoridade ${lower(fi.voicing)}`);
    if (list(fi.efeito).some((x) => pref.efeito.includes(x))) hits.push(`o efeito de ${lower(list(fi.efeito)[0])}`);
    if (pref.marcas.includes(p.marca)) hits.push(`a marca ${p.marca}`);
    if (hits.length) out.push(`tem ${joinList(hits.slice(0, 2))}, como o equipamento de ${a.nome}`);
  }
  const s = soundOf(f.som);
  if (s && out.length < 3) {
    const pref = prefOf({ som: f.som });
    const fit = [fi.formato, ...list(fi.captacao), fi.voicing, fi.tecnologia, ...list(fi.efeito), ...list(fi.timbre)].filter(Boolean).find((v) => Object.values(pref).some((vals) => vals.includes(v)));
    if (fit) out.push(`${lower(fit)} ajuda no som ${lower(s.rotulo)}`);
  }
  if (f.genero && out.length < 3) {
    const g = profileOf(f.genero)?.[GROUP[p.categoria]];
    const fitsGenre = list(fi.generos).includes(f.genero);
    const trait = g && Object.entries(g).flatMap(([k, vals]) => list(fi[k]).filter((v) => vals.slice(0, 2).includes(v))).at(0);
    if (fitsGenre || trait) out.push(`combina com ${f.genero.toLowerCase()}${trait ? ` (${lower(trait)})` : ""}`);
    else if (item.foraDoGenero) out.push(`não é a mais típica de ${f.genero.toLowerCase()}, mas foi a que coube no valor`);
  }
  if (f.cor && colorMatches(p, f.cor) && out.length < 3) out.push(`existe em ${f.cor.toLowerCase()}, a cor que você pediu`);
  if (f.max && item.fatia && out.length < 3) out.push(p.priceCents <= item.fatia ? `cabe na parte do orçamento reservada para ${ART[p.categoria] === "a" ? "a" : "o"} ${PART_NAME[p.categoria]} (até ${brl(Math.round(item.fatia))})` : "foi a opção mais em conta que manteve o resto do setup no valor");
  if (!out.length) out.push(f.max ? "é o melhor equilíbrio entre preço e ficha técnica para o resto do setup" : "é a mais bem avaliada pela ficha técnica para o que você pediu");
  return out.slice(0, 3);
}
// Explicação de uma peça (quando o cliente aponta qual) ou do setup inteiro.
export function explainSetup(items, f, partes = []) {
  const chosen = partes.length ? items.filter((x) => partes.includes((x.produto || x).categoria)) : items;
  if (!chosen.length) return null;
  const lines = chosen.map((x) => {
    const p = x.produto || x;
    return `• ${p.marca} ${p.modelo}: ${joinList(reasonsFor(x, f))}.`;
  });
  const intro = partes.length === 1 ? `Escolhi ${ART[partes[0]]} ${PART_NAME[partes[0]]} assim:` : "Por que cada peça entrou no setup:";
  return [intro, ...lines].join("\n");
}
export const describeParts = (cats) => joinList(cats.map((c) => `${ART[c]} ${PART_NAME[c]}`));
