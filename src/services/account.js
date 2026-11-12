// Segurança e privacidade da conta: troca de senha, cópia dos dados (portabilidade)
// e exclusão pelo próprio cliente.
import bcrypt from "bcryptjs";
import { AppError, text } from "../utils/validation.js";
import { safeCustomer } from "../middleware/auth.js";
import { publicOrder } from "../controllers/serialization.js";
import { publicNotification } from "./notifications.js";

export const IN_PROGRESS = ["Recebido", "Em preparação", "Enviado"];

function newPassword(value, field = "nova") {
  const senha = text(value, "a nova senha", 10, 72);
  if (Buffer.byteLength(senha) > 72) throw new AppError(400, "A nova senha excede 72 bytes.", field);
  return senha;
}
async function checkPassword(user, value, field) {
  const senha = typeof value === "string" ? value : "";
  if (!senha || !user.passwordHash || !(await bcrypt.compare(senha, user.passwordHash)))
    throw new AppError(400, "Senha atual incorreta.", field);
}

// A troca registra a data: sessões abertas antes dela deixam de valer (ver middleware/auth.js).
export async function changePassword(storage, user, body = {}) {
  const nova = newPassword(body.nova);
  await checkPassword(user, body.atual, "atual");
  if (body.atual === nova) throw new AppError(400, "A nova senha precisa ser diferente da atual.", "nova");
  const now = new Date().toISOString();
  const next = { ...user, passwordHash: await bcrypt.hash(nova, 12), passwordChangedAt: now, updatedAt: now };
  await storage.save("customers", next, user.etag);
  return next;
}

export async function exportData(storage, user) {
  const [orders, alerts, notifications, questions] = await Promise.all([
    storage.listByPartition("orders", user.id),
    storage.listByPartition("alerts", user.id),
    storage.listByPartition("notifications", user.id),
    storage.list("questions"),
  ]);
  const conta = safeCustomer(user);
  delete conta.role;
  delete conta.ativo;
  return {
    geradoEm: new Date().toISOString(),
    loja: "Violet Voltage",
    conta: { ...conta, criadaEm: user.createdAt || null },
    pedidos: orders.map(publicOrder).map((o) => ({ ...o, partitionKey: undefined, requestId: undefined })),
    avisos: alerts.map((a) => ({ tipo: a.tipo === "preco" ? "preço" : "estoque", produto: a.productId, ...(a.tipo === "preco" ? { precoNoPedidoCents: a.priceCents } : {}), criadoEm: a.createdAt, avisadoEm: a.notifiedAt || null })),
    perguntas: questions
      .filter((q) => q.customerId === user.id)
      .map((q) => ({ produto: q.productId, pergunta: q.pergunta, resposta: q.resposta || null, situacao: q.status, criadaEm: q.createdAt })),
    notificacoes: notifications.map(publicNotification),
    armazenadoNoNavegador: "Carrinho, favoritos, vistos recentemente, buscas recentes, tema e conversa do assistente ficam só no seu navegador e não fazem parte desta cópia.",
  };
}

// Exclusão: dados pessoais apagados e acesso encerrado. Pedidos ficam (registro da venda),
// ligados a um cadastro sem nome, telefone nem endereços. Com pedido em andamento, não exclui.
export async function deleteAccount(storage, user, body = {}) {
  if (user.role === "admin") throw new AppError(400, "Contas de administrador não podem ser excluídas por aqui.");
  await checkPassword(user, body.senha, "senha");
  const orders = await storage.listByPartition("orders", user.id);
  const open = orders.filter((o) => IN_PROGRESS.includes(o.status)).length;
  if (open)
    throw new AppError(409, `Você tem ${open} ${open === 1 ? "pedido em andamento" : "pedidos em andamento"}. Aguarde a conclusão ou cancele antes de excluir a conta.`);
  for (const table of ["alerts", "notifications"])
    for (const item of await storage.listByPartition(table, user.id)) await storage.remove(table, item.partitionKey, item.rowKey);
  // Perguntas: as pendentes somem; as respondidas ficam na página do produto sem o nome.
  for (const q of (await storage.list("questions")).filter((x) => x.customerId === user.id)) {
    if (q.status === "respondida") await storage.save("questions", { ...q, customerId: null, autor: "Cliente" }, q.etag);
    else await storage.remove("questions", q.partitionKey, q.rowKey);
  }
  const now = new Date().toISOString();
  await storage.save(
    "customers",
    { ...user, ativo: false, nome: "Conta excluída", telefone: "", endereco: "", enderecos: [], passwordHash: "", excluidaEm: now, updatedAt: now },
    user.etag,
  );
}
