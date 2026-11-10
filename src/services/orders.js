import { AppError } from "../utils/validation.js";
import { exclusive } from "./checkout.js";

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
    const order = (await storage.list("orders")).find(
      (o) => o.rowKey === orderId && (!options.customerId || o.partitionKey === options.customerId),
    );
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
    if (status === "Cancelado") {
      // Devolve os itens ao estoque; no PostgreSQL, na mesma transação do pedido.
      const products = await storage.list("products");
      for (const item of JSON.parse(order.itens)) {
        const p = products.find((x) => x.rowKey === item.id);
        if (!p) continue;
        await storage.save("products", { ...p, estoque: p.estoque + item.quantidade }, p.etag);
        p.estoque += item.quantidade;
      }
      next.estoqueDevolvido = true;
    }
    await storage.save("orders", next, order.etag);
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
