// Etapa 33: encomendas. O cliente descreve uma guitarra personalizada ("Les Paul com
// captadores Seymour Duncan e tarraxas Gotoh") ou um produto que não está no catálogo; o
// assistente resume o que entendeu e leva para /encomenda.html, onde a solicitação é revisada
// e enviada. A equipe responde com orçamento e prazo; nada é cobrado sem aprovação.
import { normalize } from "./text.js";

// [rótulo, [regex, valor]...]: a primeira regex que casar define o valor do componente.
const COMPONENTS = [
  ["Captadores", [[/s[aeiy]{0,2}m[ao]u?re? ?duncan|\bduncan\b/, "Seymour Duncan"], [/di ?marzio/, "DiMarzio"], [/\bemg\b/, "EMG"], [/fishman/, "Fishman"], [/bare ?knuckle/, "Bare Knuckle"], [/burstbucker/, "Gibson Burstbucker"], [/\bp ?90\b/, "P90"], [/humbuckers?/, "Humbucker"], [/single ?coils?/, "Single-coil"]]],
  ["Tarraxas", [[/gotoh/, "Gotoh"], [/grover/, "Grover"], [/schaller/, "Schaller"], [/kluson/, "Kluson"], [/hipshot/, "Hipshot"], [/sperzel/, "Sperzel"], [/tarraxa\w* (com trava|blocante\w*|locking)/, "Com trava"]]],
  ["Ponte", [[/floyd( rose)?/, "Floyd Rose"], [/bigsby/, "Bigsby"], [/tune ?o ?matic/, "Tune-o-matic"], [/hard ?tail|ponte fixa/, "Fixa (hardtail)"], [/evertune/, "EverTune"]]],
  ["Trastes", [[/inox|stainless|aco inoxidavel/, "Aço inox"], [/jumbo/, "Jumbo"]]],
  ["Escala", [[/ebano/, "Ébano"], [/jacaranda|rosewood/, "Jacarandá (rosewood)"], [/pau ferro/, "Pau-ferro"], [/\bmaple\b/, "Maple"]]],
  ["Corpo", [[/mogno|mahogany/, "Mogno"], [/\balder\b|amieiro/, "Alder"], [/swamp ash|freixo|\bash\b/, "Ash"], [/basswood|tilia/, "Basswood"]]],
  ["Acabamento", [[/\brelic\b|envelhecid\w*|\baged\b/, "Relic (envelhecido)"], [/fosc\w*|satin/, "Fosco"], [/flame\w*|flamead\w*|quilt\w*/, "Tampo flamed"], [/brilhant\w* (de )?(verniz|acabamento)|gloss/, "Brilhante"]]],
];
const BASES = [
  [/les ?paul|single ?cut/, "Les Paul (single cut)"],
  [/\bsg\b|double ?cut/, "SG (double cut)"],
  [/strato\w*|\bstrat\b/, "Stratocaster"],
  [/\btele(caster)?\b/, "Telecaster"],
  [/jazzmaster|jaguar|mustang|offset/, "Offset (Jazzmaster/Jaguar)"],
  [/semi ?acustica|es ?335|hollow/, "Semiacústica"],
  [/explorer/, "Explorer"],
  [/flying ?v/, "Flying V"],
  [/superstrat|dinky|soloist/, "Superstrat"],
  [/\bcontrabaixo|\bbaixo (eletrico|de [4-6] cordas|[4-6] cordas)/, "Baixo"],
  [/violao|violoes/, "Violão"],
  [/\bguitarra/, "Guitarra elétrica"],
];
const COLORS = [[/preta|preto|black/, "Preto"], [/branc[ao]|white/, "Branco"], [/vermelh\w*|cherry|cereja/, "Vermelho"], [/azul|blue/, "Azul"], [/verde|green/, "Verde"], [/amarel\w*|butterscotch/, "Amarelo"], [/sunburst/, "Sunburst"], [/rosa|pink/, "Rosa"], [/roxa|roxo|purple|violeta/, "Roxo"], [/dourad\w*|gold/, "Dourado"], [/natural|madeira/, "Natural"]];

export const ENCOMENDA = /\b(encomend\w*|personaliz\w*|sob medida|customiz\w*|custom shop|luthier|(?<!nao )importa(r|cao|do|da|m)?|trazer de fora|do exterior|de fora do pais|fora do catalogo|nao (tem|tinha|encontrei|achei|vi) (isso |ele |ela )?no (catalogo|site)|(conseguem|consegue|podem|pode|voces) (me )?(trazer|importar|conseguir|encomendar|fabricar|montar uma guitarra)|solicitar (um |uma )?(produto|item|modelo)|monta(r|m)? (uma|minha) guitarra (do zero|com))\b/;
export const ENCOMENDA_STATUS = /\b(minhas? (encomendas?|solicitac\w*)|status da (minha )?(encomenda|solicitacao)|(como|onde) (esta|anda|ficou) (a |minha )?(encomenda|solicitacao)|respond\w* (minha|a) (encomenda|solicitacao))\b/;
const TIPO_IMPORT = /importa|trazer de fora|do exterior|fora do pais|fora do catalogo|nao (tem|tinha|encontrei|achei|vi)/;

export function parseCustom(message) {
  const text = normalize(message);
  const itens = [];
  const base = BASES.find(([re]) => re.test(text))?.[1];
  if (base) itens.push(["Base", base]);
  for (const [rotulo, options] of COMPONENTS) {
    const hit = options.find(([re]) => re.test(text));
    if (hit) itens.push([rotulo, hit[1]]);
  }
  const cor = COLORS.find(([re]) => re.test(text))?.[1];
  if (cor) itens.push(["Cor", cor]);
  const componentes = itens.filter(([k]) => !["Base", "Cor"].includes(k)).length;
  // Guitarra descrita por peças ou cor é personalizada; produto pronto que a loja não tem é importação.
  const tipo = componentes || (base && (cor || /personaliz|sob medida|custom|luthier|montar/.test(text))) ? "personalizado" : TIPO_IMPORT.test(text) ? "importacao" : base && base !== "Guitarra elétrica" ? "personalizado" : "importacao";
  return { tipo, itens, componentes };
}
// "Les Paul com captadores Seymour Duncan": guitarra + componentes de marca = encomenda.
export const looksCustom = (message) => {
  const { componentes, itens } = parseCustom(message);
  const text = normalize(message);
  const brandParts = itens.filter(([k, v]) => ["Captadores", "Tarraxas", "Ponte"].includes(k) && !["Humbucker", "Single-coil", "P90"].includes(v)).length;
  return brandParts > 0 && componentes >= 1 && /\bcom\b/.test(text);
};
export function requestLink({ tipo, itens }, message) {
  const params = new URLSearchParams({ tipo });
  if (itens.length) params.set("itens", itens.map(([k, v]) => `${k}: ${v}`).join("; ").slice(0, 300));
  params.set("descricao", String(message).trim().slice(0, 300));
  return `/encomenda.html?${params}`;
}
