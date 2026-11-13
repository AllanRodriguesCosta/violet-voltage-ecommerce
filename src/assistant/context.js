// O contexto da conversa vai e volta pelo navegador. Tudo que chega é revalidado aqui:
// só chaves conhecidas, valores das listas do esquema e limites de tamanho.
import { GENEROS, ESTILOS, NIVEIS, USOS, SPEC_FIELDS } from "../../public/js/specs.js";
import { categories } from "../utils/validation.js";
import { ARTISTAS, SONS, CORES } from "./taste.js";

const values = (key) => [...new Set(Object.values(SPEC_FIELDS).flat().filter((f) => f.key === key).flatMap((f) => f.values || []))];
const ALLOWED = {
  categoria: categories,
  genero: GENEROS,
  estilo: ESTILOS,
  nivel: NIVEIS,
  uso: USOS,
  formato: values("formato"),
  captacao: values("captacao"),
  tecnologia: [...values("tecnologia"), "Digital"],
  voicing: values("voicing"),
  tipo: [...values("efeito"), ...values("tipo")],
  mao: values("mao"),
  cordas: values("cordas"),
  captadores: values("captadores"),
  // Etapa 33: gosto pessoal.
  artista: ARTISTAS,
  som: SONS,
  cor: CORES,
};
export const SLOTS = ["categoria", "genero", "orcamento", "cor"];
const cents = (v) => (Number.isSafeInteger(v) && v > 0 && v <= 100_000_000 ? v : undefined);

export function sanitizeContext(input, brands = []) {
  const empty = { intent: null, filtros: {}, aguardando: null, perguntas: [], mostrados: [] };
  if (!input || typeof input !== "object" || Array.isArray(input)) return empty;
  const filtros = {};
  const source = input.filtros && typeof input.filtros === "object" ? input.filtros : {};
  for (const [key, allowed] of Object.entries(ALLOWED)) if (allowed.includes(source[key])) filtros[key] = source[key];
  if (brands.includes(source.marca)) filtros.marca = source.marca;
  for (const key of ["min", "max"]) if (cents(source[key])) filtros[key] = source[key];
  if (Number.isInteger(source.trastes) && source.trastes >= 18 && source.trastes <= 30) filtros.trastes = source.trastes;
  // Etapa 36: peças que o cliente já tem ou tirou do setup, travadas e descartadas.
  const SETUP = ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias"];
  for (const key of ["tenho", "sem"]) if (Array.isArray(source[key])) {
    const list = [...new Set(source[key].filter((c) => SETUP.includes(c)))];
    if (list.length) filtros[key] = list;
  }
  for (const [key, max] of [["fixos", 5], ["excluir", 20]]) if (Array.isArray(source[key])) {
    const list = [...new Set(source[key].filter((id) => typeof id === "string" && /^[\w-]{1,64}$/.test(id)))].slice(-max);
    if (list.length) filtros[key] = list;
  }
  return {
    intent: ["recomendar", "setup"].includes(input.intent) ? input.intent : null,
    filtros,
    aguardando: SLOTS.includes(input.aguardando) ? input.aguardando : null,
    perguntas: Array.isArray(input.perguntas) ? [...new Set(input.perguntas.filter((s) => SLOTS.includes(s)))] : [],
    mostrados: Array.isArray(input.mostrados) ? input.mostrados.filter((id) => typeof id === "string" && /^[\w-]{1,64}$/.test(id)).slice(-30) : [],
  };
}
