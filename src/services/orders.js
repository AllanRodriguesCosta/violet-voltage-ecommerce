import { randomInt } from "node:crypto";
import { AppError } from "../utils/validation.js";
import { exclusive } from "./checkout.js";
import { notify, orderNotice, restockAlerts } from "./notifications.js";

export const statuses = ["Recebido", "Em preparação", "Enviado", "Concluído", "Cancelado"];
const flow = statuses.slice(0, 4);
// Avança no fluxo (pode pular etapas); cancelamento só antes do envio.
export function allowedNext(status) {
  const index = flow.indexOf(status);
  if (index < 0 || status === "Concluído") return [];
  const forward = flow.slice(index + 1);
  return index <= 1 ? [...forward, "Cancelado"] : forward;
}
export function history(order) {
  return order.statusHistory?.length ? order.statusHistory : [{ status: "Recebido", at: order.createdAt }];
}
export async function updateOrderStatus(storage, orderId, status, options = {}) {
  if (storage.transaction && !storage.inTransaction)
    return storage.transaction((scoped) => updateOrderStatus(scoped, orderId, status, options));
  return exclusive(async () => {
    if (!statuses.includes(status)) throw new AppError(400, "Status inválido.");
    const found = await storage.getByRowKey("orders", String(orderId));
    const order = found && (!options.customerId || found.partitionKey === options.customerId) ? found : null;
    if (!order) throw new AppError(404, "Pedido não encontrado.");
    if (order.status === status) return order;
    const allowed = options.onlyFrom && !options.onlyFrom.includes(order.status) ? [] : allowedNext(order.status);
    if (!allowed.includes(status))
      throw new AppError(409, `Não é possível alterar o pedido de "${order.status}" para "${status}".`);
    const next = {
      ...order,
      status,
      statusHistory: [...history(order), { status, at: new Date().toISOString() }],
    };
    // Envio pela transportadora gera o código de rastreio (retirada na loja não tem).
    if (status === "Enviado" && order.entrega !== "retirada" && !order.rastreio)
      next.rastreio = `VV${String(randomInt(0, 1e9)).padStart(9, "0")}BR`;
    if (status === "Cancelado") {
      // Devolve os itens ao estoque; no PostgreSQL, na mesma transação do pedido.
      const items = JSON.parse(order.itens);
      const products = await storage.getManyByRowKeys("products", items.map((i) => i.id));
      for (const item of items) {
        const p = products.find((x) => x.rowKey === item.id);
        if (!p) continue;
        const restocked = { ...p, estoque: p.estoque + item.quantidade };
        await storage.save("products", restocked, p.etag);
        // Item que estava esgotado volta ao estoque: avisa quem pediu "Avise-me".
        if (p.estoque === 0) await restockAlerts(storage, restocked);
        p.estoque += item.quantidade;
      }
      next.estoqueDevolvido = true;
    }
    await storage.save("orders", next, order.etag);
    // Mudanças feitas pela loja geram notificação para o cliente, na mesma transação.
    if (options.notify) await notify(storage, order.partitionKey, orderNotice(next, status));
    return next;
  });
}
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
export function summary(products, customers, orders, now = new Date()) {
  const valid = orders.filter((o) => o.status !== "Cancelado");
  const totalCents = valid.reduce((s, o) => s + o.totalCents, 0);
  const days = Array.from({ length: 14 }, (_, i) => day.format(new Date(now.getTime() - (13 - i) * 86400000)));
  const sales = Object.fromEntries(days.map((d) => [d, { dia: d, totalCents: 0, pedidos: 0 }]));
  for (const o of valid) {
    const bucket = sales[day.format(new Date(o.createdAt))];
    if (bucket) {
      bucket.totalCents += o.totalCents;
      bucket.pedidos++;
    }
  }
  return {
    produtos: products.filter((p) => p.ativo).length,
    clientes: customers.filter((c) => c.ativo && c.role === "customer").length,
    pedidos: orders.length,
    totalCents,
    ticketMedioCents: valid.length ? Math.round(totalCents / valid.length) : 0,
    porStatus: Object.fromEntries(statuses.map((s) => [s, orders.filter((o) => o.status === s).length])),
    estoqueBaixo: products
      .filter((p) => p.ativo && p.estoque <= 5)
      .map((p) => ({ id: p.rowKey, nome: `${p.marca} ${p.modelo}`, estoque: p.estoque }))
      .sort((a, b) => a.estoque - b.estoque),
    vendasPorDia: days.map((d) => sales[d]),
  };
}
