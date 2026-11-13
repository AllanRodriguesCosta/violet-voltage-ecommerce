import { checkSpecs } from "../../public/js/specs.js";
export class AppError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}
export function text(value, field, min = 1, max = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new AppError(
      400,
      `Informe ${field} entre ${min} e ${max} caracteres.`,
      field,
    );
  return value.trim();
}
export function email(value) {
  const result = text(value, "email", 5, 200).toLowerCase();
  if (!/^[^\s@/\\#?]+@[^\s@/\\#?]+\.[^\s@/\\#?]+$/.test(result))
    throw new AppError(400, "Informe um e-mail válido.", "email");
  return result;
}
export function integer(value, field, min = 0, max = 100000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new AppError(400, `Valor inválido para ${field}.`, field);
  return value;
}
export const categories = [
  "Guitarras",
  "Pedais",
  "Amplificadores",
  "Cabos",
  "Correias",
  "Acessórios",
];
export function productInput(body) {
  const categoria = text(body.categoria, "categoria");
  if (!categories.includes(categoria))
    throw new AppError(400, "Categoria inválida.", "categoria");
  return {
    marca: text(body.marca, "marca"),
    modelo: text(body.modelo, "modelo"),
    categoria,
    descricao: text(body.descricao, "descricao", 10, 4000),
    priceCents: integer(body.priceCents, "priceCents", 1),
    estoque: integer(body.estoque, "estoque", 0, 100000),
    ...fichaInput(categoria, body.ficha),
  };
}
// Etapa 34: estoque por cor. Recebe { "Preto": 3, "Roxo": null }; null ou vazio tira o controle.
export function colorStockInput(cores, value, total) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError(400, "Estoque por cor inválido.", "estoqueCores");
  const next = cores.map((c) => {
    const raw = value[c.nome];
    const rest = { ...c };
    delete rest.estoque;
    if (raw === undefined || raw === null || raw === "") return rest;
    return { ...rest, estoque: integer(raw, `estoque da cor ${c.nome}`, 0, 100000) };
  });
  const sum = next.reduce((s, c) => s + (c.estoque ?? 0), 0);
  if (sum > total) throw new AppError(400, "A soma do estoque das cores passa do estoque total.", "estoqueCores");
  return next;
}
// Ficha técnica opcional: ausente preserva a atual; null limpa.
function fichaInput(categoria, value) {
  if (value === undefined) return {};
  const { ficha, erro } = checkSpecs(categoria, value);
  if (erro) throw new AppError(400, erro, "ficha");
  return { ficha };
}
export function profileInput(body) {
  return {
    nome: text(body.nome, "nome", 2),
    telefone: text(body.telefone || "", "telefone", 0, 30),
    endereco: text(body.endereco || "", "endereco", 0, 500),
  };
}
