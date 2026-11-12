// Ficha técnica estruturada: o mesmo esquema serve à loja (filtros, página do produto,
// painel) e ao servidor (validação e, na Fase 3, ao assistente de compras).
// Sem dependência de DOM: este módulo é importado também pelo Node.

export const GENEROS = [
  "Blues",
  "Blues rock",
  "Rock clássico",
  "Hard rock",
  "Heavy metal",
  "Punk",
  "Grunge",
  "Indie",
  "Pop",
  "Funk",
  "Jazz",
  "Country",
  "Surf",
  "Rockabilly",
  "Shoegaze",
  "MPB",
];
export const ESTILOS = ["Vintage", "Moderno", "Atemporal"];
export const NIVEIS = ["Iniciante", "Intermediário", "Profissional"];
export const USOS = ["Estudo em casa", "Ensaio", "Palco", "Estúdio"];

// Campos comuns a todas as categorias. "generos" vazio significa uso versátil.
const comuns = [
  { key: "estilo", label: "Estilo", type: "enum", values: ESTILOS, filter: true },
  { key: "generos", label: "Indicado para", type: "multi", values: GENEROS, filter: true, max: 8 },
];

export const SPEC_FIELDS = {
  Guitarras: [
    ...comuns,
    { key: "formato", label: "Formato", type: "enum", filter: true, values: ["Strat", "Tele", "Single cut", "Double cut", "Semiacústica", "Offset", "Superstrat"] },
    { key: "captacao", label: "Captação", type: "enum", filter: true, values: ["Single-coil", "Humbucker", "P90", "Humbucker e single-coil"] },
    { key: "ponte", label: "Ponte", type: "enum", values: ["Tremolo", "Fixa", "Tune-o-matic", "Floyd Rose"] },
    { key: "timbre", label: "Timbre", type: "multi", filter: true, values: ["Brilhante", "Encorpado", "Equilibrado", "Agressivo", "Quente"], max: 3 },
    { key: "nivel", label: "Nível", type: "enum", filter: true, values: NIVEIS },
  ],
  Amplificadores: [
    ...comuns,
    { key: "tecnologia", label: "Tecnologia", type: "enum", filter: true, values: ["Valvulado", "Transistor", "Modelagem digital"] },
    { key: "potencia", label: "Potência (W)", type: "number", min: 1, max: 500 },
    { key: "falantes", label: "Falantes", type: "enum", values: ["1x8", "1x10", "1x12", "2x10", "2x12", "4x12"] },
    { key: "voicing", label: "Sonoridade", type: "enum", filter: true, values: ["Britânico", "Americano", "High gain", "Versátil"] },
    { key: "uso", label: "Uso", type: "multi", filter: true, values: USOS, max: 4 },
    { key: "nivel", label: "Nível", type: "enum", values: NIVEIS },
  ],
  Pedais: [
    ...comuns,
    { key: "efeito", label: "Tipo", type: "enum", filter: true, values: ["Overdrive", "Distorção", "Fuzz", "Chorus", "Delay", "Reverb", "Wah", "Multiefeitos", "Gabinete virtual (IR)", "Pedalboard"] },
    { key: "tecnologia", label: "Tecnologia", type: "enum", values: ["Analógico", "Digital", "Não se aplica"] },
    { key: "uso", label: "Uso", type: "multi", values: USOS, max: 4 },
    { key: "nivel", label: "Nível", type: "enum", values: NIVEIS },
  ],
  Cabos: [
    ...comuns,
    { key: "tipo", label: "Tipo", type: "enum", filter: true, values: ["Instrumento", "Patch", "Espiral"] },
    { key: "conectores", label: "Conectores", type: "enum", values: ["P10 reto / reto", "P10 reto / L", "P10 L / L"] },
    { key: "comprimento", label: "Comprimento (m)", type: "number", min: 0.1, max: 20 },
  ],
  Correias: [
    ...comuns,
    { key: "material", label: "Material", type: "enum", filter: true, values: ["Nylon", "Couro", "Tecido", "Algodão"] },
    { key: "visual", label: "Visual", type: "enum", values: ["Liso", "Estampado"] },
  ],
  Acessórios: [
    ...comuns,
    { key: "tipo", label: "Tipo", type: "enum", filter: true, values: ["Suporte de parede", "Suporte de chão", "Palhetas", "Afinador", "Encordoamento", "Capotraste", "Limpeza"] },
    { key: "compatibilidade", label: "Compatível com", type: "text", maxLength: 80 },
  ],
};

export const specFields = (categoria) => SPEC_FIELDS[categoria] || [];
export const specField = (categoria, key) => specFields(categoria).find((f) => f.key === key);

// Valida e normaliza uma ficha; devolve { ficha, erro } sem lançar exceção.
export function checkSpecs(categoria, input) {
  if (input === undefined || input === null) return { ficha: null };
  if (typeof input !== "object" || Array.isArray(input)) return { erro: "Ficha técnica inválida." };
  const fields = specFields(categoria);
  const ficha = {};
  for (const [key, raw] of Object.entries(input)) {
    const field = fields.find((f) => f.key === key);
    if (!field) return { erro: `Campo “${key}” não pertence à ficha de ${categoria}.` };
    if (raw === "" || raw === null || (Array.isArray(raw) && !raw.length)) continue;
    if (field.type === "enum") {
      if (!field.values.includes(raw)) return { erro: `${field.label}: valor inválido.` };
      ficha[key] = raw;
    } else if (field.type === "multi") {
      if (!Array.isArray(raw) || raw.some((v) => !field.values.includes(v))) return { erro: `${field.label}: valor inválido.` };
      const unique = [...new Set(raw)];
      if (unique.length > field.max) return { erro: `${field.label}: no máximo ${field.max} opções.` };
      ficha[key] = unique;
    } else if (field.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < field.min || n > field.max) return { erro: `${field.label}: use um número entre ${field.min} e ${field.max}.` };
      ficha[key] = Math.round(n * 100) / 100;
    } else {
      if (typeof raw !== "string" || raw.trim().length > field.maxLength) return { erro: `${field.label}: até ${field.maxLength} caracteres.` };
      if (raw.trim()) ficha[key] = raw.trim();
    }
  }
  return { ficha: Object.keys(ficha).length ? ficha : null };
}

// Texto exibível de um valor da ficha.
export function specValue(field, value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "number") return field.key === "potencia" ? `${value} W` : field.key === "comprimento" ? `${String(value).replace(".", ",")} m` : String(value);
  return String(value);
}

// Linhas da ficha na ordem do esquema; "Indicado para" vazio vira "Versátil".
export function specRows(product) {
  const ficha = product?.ficha || {};
  return specFields(product?.categoria)
    .map((field) => {
      const value = ficha[field.key];
      if (field.key === "generos" && (!value || !value.length)) return Object.keys(ficha).length ? { field, text: "Versátil, vários gêneros" } : null;
      const text = specValue(field, value);
      return text ? { field, text } : null;
    })
    .filter(Boolean);
}

// Palavras da ficha usadas na busca ("vintage", "blues", "humbucker"...).
export function specText(product) {
  const ficha = product?.ficha;
  if (!ficha) return "";
  return Object.values(ficha)
    .flat()
    .filter((v) => typeof v === "string")
    .join(" ");
}

// Valores de um campo para filtro (sempre lista).
export const specList = (product, key) => {
  const value = product?.ficha?.[key];
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
};
