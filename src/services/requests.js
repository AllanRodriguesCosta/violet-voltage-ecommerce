// Etapa 33: encomendas (guitarra personalizada ou produto fora do catálogo) e fichas de
// parceria de fornecedores. Encomenda exige conta e avisa o cliente quando a loja responde;
// a ficha de parceria é pública (o fornecedor não precisa ser cliente).
import { randomUUID } from "node:crypto";
import { AppError, text, email } from "../utils/validation.js";
import { notify } from "./notifications.js";

export const REQUEST_TYPES = { personalizado: "Guitarra personalizada", importacao: "Produto fora do catálogo" };
export const REQUEST_STATUS = ["Recebida", "Em análise", "Orçamento enviado", "Aprovada", "Recusada", "Concluída"];
export const PRAZOS = ["Sem pressa", "Até 30 dias", "Até 60 dias"];
export const CONTATOS = ["E-mail", "WhatsApp", "Telefone"];
export const MAX_OPEN_REQUESTS = 3;
const OPEN = (r) => !["Recusada", "Concluída"].includes(r.status);
const optional = (value, field, max) => (value === undefined || value === null || String(value).trim() === "" ? "" : text(String(value), field, 1, max));
const phone = (value, field = "telefone") => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) throw new AppError(400, "Informe o telefone com DDD (10 ou 11 dígitos).", field);
  return digits;
};
const cents = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isSafeInteger(value) || value < 10000 || value > 100_000_000) throw new AppError(400, "Informe um orçamento entre R$ 100 e R$ 1.000.000.", field);
  return value;
};
const pick = (value, list, field, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (!list.includes(value)) throw new AppError(400, `Opção inválida para ${field}.`, field);
  return value;
};

export const publicRequest = (r) => ({
  id: r.rowKey,
  codigo: `E-${r.rowKey.slice(0, 6).toUpperCase()}`,
  tipo: r.tipo,
  tipoNome: REQUEST_TYPES[r.tipo],
  produto: r.produto,
  detalhes: r.detalhes,
  orcamentoCents: r.orcamentoCents,
  prazo: r.prazo,
  contato: r.contato,
  status: r.status,
  resposta: r.resposta || "",
  valorCents: r.valorCents ?? null,
  prazoDias: r.prazoDias ?? null,
  createdAt: r.createdAt,
  respondidaEm: r.respondidaEm || null,
});
export const adminRequest = (r) => ({ ...publicRequest(r), cliente: r.cliente, email: r.email, telefone: r.telefone || "" });

export async function createRequest(storage, user, body = {}) {
  const tipo = pick(body.tipo, Object.keys(REQUEST_TYPES), "tipo");
  if (!tipo) throw new AppError(400, "Escolha o tipo da encomenda.", "tipo");
  const produto = text(body.produto, "produto", 3, 120);
  const detalhes = optional(body.detalhes, "detalhes", 1500);
  const contato = pick(body.contato, CONTATOS, "contato", "E-mail");
  const telefone = contato === "E-mail" ? "" : phone(body.telefone);
  const mine = await storage.listByPartition("requests", user.id);
  if (mine.filter(OPEN).length >= MAX_OPEN_REQUESTS)
    throw new AppError(429, `Você já tem ${MAX_OPEN_REQUESTS} encomendas em andamento. Assim que a loja responder, você pode enviar outras.`);
  if (mine.some((r) => OPEN(r) && r.produto.toLowerCase() === produto.toLowerCase()))
    throw new AppError(409, "Você já enviou uma encomenda com esse produto. Acompanhe a resposta em Minhas encomendas.", "produto");
  const item = {
    partitionKey: user.id,
    rowKey: randomUUID(),
    customerId: user.id,
    cliente: user.nome,
    email: user.email || user.rowKey,
    tipo,
    produto,
    detalhes,
    orcamentoCents: cents(body.orcamentoCents, "orcamento"),
    prazo: pick(body.prazo, PRAZOS, "prazo", "Sem pressa"),
    contato,
    telefone,
    status: "Recebida",
    createdAt: new Date().toISOString(),
  };
  await storage.create("requests", item);
  return item;
}
export async function myRequests(storage, user) {
  return (await storage.listByPartition("requests", user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
// Resposta da loja: status, mensagem, valor e prazo. Mudança relevante avisa o cliente.
export async function answerRequest(storage, id, body = {}) {
  const r = await storage.getByRowKey("requests", String(id));
  if (!r) throw new AppError(404, "Encomenda não encontrada.");
  const status = pick(body.status, REQUEST_STATUS, "status", r.status);
  const resposta = body.resposta === undefined ? r.resposta || "" : optional(body.resposta, "resposta", 1500);
  if (status === "Orçamento enviado" && !resposta) throw new AppError(400, "Escreva a resposta com o orçamento para o cliente.", "resposta");
  const valorCents = body.valorCents === undefined ? (r.valorCents ?? null) : cents(body.valorCents, "valor");
  let prazoDias = r.prazoDias ?? null;
  if (body.prazoDias !== undefined) prazoDias = body.prazoDias === null || body.prazoDias === "" ? null : Number(body.prazoDias);
  if (prazoDias !== null && (!Number.isInteger(prazoDias) || prazoDias < 1 || prazoDias > 365)) throw new AppError(400, "Informe o prazo em dias (1 a 365).", "prazoDias");
  const changed = status !== r.status || resposta !== (r.resposta || "");
  const next = { ...r, status, resposta, valorCents, prazoDias, respondidaEm: changed && resposta ? new Date().toISOString() : r.respondidaEm || null };
  const apply = async (scoped) => {
    await scoped.save("requests", next, r.etag);
    if (changed)
      await notify(scoped, r.customerId, {
        tipo: "encomenda",
        titulo: `Encomenda ${publicRequest(r).codigo}: ${status.toLowerCase()}`,
        texto: resposta ? (resposta.length > 140 ? `${resposta.slice(0, 137)}…` : resposta) : `${r.produto} está com status “${status}”.`,
        link: "/encomenda.html#minhas",
      });
  };
  await (storage.transaction && !storage.inTransaction ? storage.transaction(apply) : apply(storage));
  return next;
}

// ---------- Parcerias e fornecedores ----------
export const PARTNER_PRODUCTS = ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias", "Acessórios", "Peças e componentes", "Luthieria e serviços", "Outros"];
export const PARTNER_KINDS = ["Fabricante ou marca", "Distribuidor ou importador", "Luthier ou oficina", "Outro"];
export const PARTNER_STATUS = ["Nova", "Em contato", "Aprovada", "Recusada"];

// CNPJ com dígitos verificadores (só números; aceita a máscara 00.000.000/0000-00).
export function validCnpj(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digit = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}
export const formatCnpj = (d) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export const adminPartner = (p) => ({
  id: p.rowKey,
  razaoSocial: p.razaoSocial,
  nomeFantasia: p.nomeFantasia,
  cnpj: formatCnpj(p.cnpj),
  modalidade: p.modalidade,
  produtos: p.produtos,
  marcas: p.marcas,
  contatoNome: p.contatoNome,
  cargo: p.cargo,
  email: p.email,
  telefone: p.telefone,
  site: p.site,
  mensagem: p.mensagem,
  status: p.status,
  notas: p.notas || "",
  createdAt: p.createdAt,
});

export async function createPartner(storage, body = {}) {
  // Campo invisível para robôs: preenchido, a ficha é descartada sem avisar.
  if (body.website) return null;
  const razaoSocial = text(body.razaoSocial, "razão social", 2, 120);
  if (!validCnpj(body.cnpj)) throw new AppError(400, "Confira o CNPJ: os dígitos verificadores não batem.", "cnpj");
  const cnpj = String(body.cnpj).replace(/\D/g, "");
  const produtos = Array.isArray(body.produtos) ? [...new Set(body.produtos)].filter((x) => PARTNER_PRODUCTS.includes(x)) : [];
  if (!produtos.length) throw new AppError(400, "Marque pelo menos um tipo de produto ou serviço.", "produtos");
  if (body.aceite !== true) throw new AppError(400, "Confirme que concorda com o uso dos dados para avaliar a parceria.", "aceite");
  const site = optional(body.site, "site", 200);
  if (site && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(site)) throw new AppError(400, "Informe o site começando com http:// ou https://.", "site");
  const existing = (await storage.listByPartition("partners", "parceria")).find((p) => p.cnpj === cnpj && ["Nova", "Em contato"].includes(p.status));
  if (existing) throw new AppError(409, "Já recebemos uma ficha com este CNPJ e ela está em análise. A equipe comercial entra em contato pelo e-mail informado.", "cnpj");
  const item = {
    partitionKey: "parceria",
    rowKey: randomUUID(),
    razaoSocial,
    nomeFantasia: optional(body.nomeFantasia, "nome fantasia", 120),
    cnpj,
    modalidade: pick(body.modalidade, PARTNER_KINDS, "modalidade", "Outro"),
    produtos,
    marcas: optional(body.marcas, "marcas", 300),
    contatoNome: text(body.contatoNome, "nome do contato", 3, 100),
    cargo: optional(body.cargo, "cargo", 80),
    email: email(body.email),
    telefone: phone(body.telefone),
    site,
    mensagem: optional(body.mensagem, "mensagem", 1500),
    status: "Nova",
    createdAt: new Date().toISOString(),
  };
  await storage.create("partners", item);
  return item;
}
export async function updatePartner(storage, id, body = {}) {
  const p = await storage.getByRowKey("partners", String(id));
  if (!p) throw new AppError(404, "Ficha de parceria não encontrada.");
  const next = { ...p, status: pick(body.status, PARTNER_STATUS, "status", p.status), notas: body.notas === undefined ? p.notas || "" : optional(body.notas, "notas", 1000) };
  await storage.save("partners", next, p.etag);
  return next;
}
