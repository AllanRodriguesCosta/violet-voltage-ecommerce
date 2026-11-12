// O contexto da conversa vai e volta pelo navegador. Tudo que chega é revalidado aqui:
// só chaves conhecidas, valores das listas do esquema e limites de tamanho.
import { GENEROS, ESTILOS, NIVEIS, USOS, SPEC_FIELDS } from "../../public/js/specs.js";
import { categories } from "../utils/validation.js";

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
};
export const SLOTS = ["categoria", "genero", "orcamento"];
const cents = (v) => (Number.isSafeInteger(v) && v > 0 && v <= 100_000_000 ? v : undefined);

export function sanitizeContext(input, brands = []) {
  const empty = { intent: null, filtros: {}, aguardando: null, perguntas: [], mostrados: [] };
  if (!input || typeof input !== "object" || Array.isArray(input)) return empty;
  const filtros = {};
  const source = input.filtros && typeof input.filtros === "object" ? input.filtros : {};
  for (const [key, allowed] of Object.entries(ALLOWED)) if (allowed.includes(source[key])) filtros[key] = source[key];
  if (brands.includes(source.marca)) filtros.marca = source.marca;
  for (const key of ["min", "max"]) if (cents(source[key])) filtros[key] = source[key];
  return {
    intent: ["recomendar", "setup"].includes(input.intent) ? input.intent : null,
    filtros,
    aguardando: SLOTS.includes(input.aguardando) ? input.aguardando : null,
    perguntas: Array.isArray(input.perguntas) ? [...new Set(input.perguntas.filter((s) => SLOTS.includes(s)))] : [],
    mostrados: Array.isArray(input.mostrados) ? input.mostrados.filter((id) => typeof id === "string" && /^[\w-]{1,64}$/.test(id)).slice(-30) : [],
  };
}
