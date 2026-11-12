// Perguntas e respostas dos produtos: o cliente pergunta, a loja responde pelo painel e só
// as respondidas aparecem na página. Sem notas nem avaliações.
import { randomUUID } from "node:crypto";
import { AppError, text } from "../utils/validation.js";
import { notify } from "./notifications.js";

export const MAX_PENDING_PER_CUSTOMER = 5;
// Nome público: primeiro nome e inicial do sobrenome ("Ana S.").
export function authorName(nome) {
  const parts = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Cliente";
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.` : parts[0];
}
export const publicQuestion = (q) => ({
  id: q.rowKey,
  productId: q.productId,
  pergunta: q.pergunta,
  resposta: q.resposta || null,
  autor: q.autor,
  createdAt: q.createdAt,
  respondidaEm: q.respondidaEm || null,
});
export const adminQuestion = (q, product) => ({
  ...publicQuestion(q),
  status: q.status,
  produto: product ? `${product.marca} ${product.modelo}` : q.productId,
});
export async function answeredQuestions(storage, productId) {
  return (await storage.listByPartition("questions", productId))
    .filter((q) => q.status === "respondida")
    .sort((a, b) => b.respondidaEm.localeCompare(a.respondidaEm))
    .map(publicQuestion);
}
export async function askQuestion(storage, user, product, body = {}) {
  const pergunta = text(body.pergunta, "pergunta", 10, 500);
  const mine = (await storage.list("questions")).filter((q) => q.customerId === user.id && q.status === "pendente");
  if (mine.length >= MAX_PENDING_PER_CUSTOMER)
    throw new AppError(429, `Você já tem ${MAX_PENDING_PER_CUSTOMER} perguntas aguardando resposta. Assim que a loja responder, você pode enviar outras.`);
  if (mine.some((q) => q.productId === product.rowKey && q.pergunta.toLowerCase() === pergunta.toLowerCase()))
    throw new AppError(409, "Você já enviou essa pergunta. A resposta chega em Notificações.", "pergunta");
  const q = {
    partitionKey: product.rowKey,
    rowKey: randomUUID(),
    productId: product.rowKey,
    customerId: user.id,
    autor: authorName(user.nome),
    pergunta,
    resposta: null,
    status: "pendente",
    createdAt: new Date().toISOString(),
  };
  await storage.create("questions", q);
  return q;
}
// Resposta da loja (ou ocultar pergunta imprópria). Responder avisa quem perguntou.
export async function moderateQuestion(storage, id, body = {}, product) {
  const q = await storage.getByRowKey("questions", String(id));
  if (!q) throw new AppError(404, "Pergunta não encontrada.");
  let next;
  if (body.ocultar === true) next = { ...q, status: "oculta", moderadaEm: new Date().toISOString() };
  else {
    const resposta = text(body.resposta, "resposta", 2, 1000);
    next = { ...q, resposta, status: "respondida", respondidaEm: q.respondidaEm || new Date().toISOString() };
  }
  const apply = async (scoped) => {
    await scoped.save("questions", next, q.etag);
    if (next.status === "respondida" && q.status !== "respondida" && q.customerId)
      await notify(scoped, q.customerId, {
        tipo: "pergunta",
        titulo: `Sua pergunta foi respondida${product ? `: ${product.marca} ${product.modelo}` : ""}`,
        texto: next.resposta.length > 140 ? `${next.resposta.slice(0, 137)}…` : next.resposta,
        link: `/produto.html?id=${encodeURIComponent(q.productId)}#perguntas`,
      });
  };
  await (storage.transaction && !storage.inTransaction ? storage.transaction(apply) : apply(storage));
  return next;
}
