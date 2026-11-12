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
  // Itens vendidos (pedidos não cancelados): categoria, mais vendidos, serviços e kits.
  const byId = new Map(products.map((p) => [p.rowKey, p]));
  const categoria = new Map();
  const vendidos = new Map();
  const servicos = new Map();
  const kits = new Map();
  for (const o of valid) {
    const itens = typeof o.itens === "string" ? JSON.parse(o.itens) : o.itens || [];
    for (const i of itens) {
      const cat = byId.get(i.id)?.categoria || "Outros";
      const c = categoria.get(cat) || { categoria: cat, totalCents: 0, unidades: 0 };
      c.totalCents += i.priceCents * i.quantidade;
      c.unidades += i.quantidade;
      categoria.set(cat, c);
      const v = vendidos.get(i.id) || { id: i.id, nome: i.nome, unidades: 0, totalCents: 0 };
      v.unidades += i.quantidade;
      v.totalCents += i.priceCents * i.quantidade;
      vendidos.set(i.id, v);
      for (const sv of i.servicos || []) {
        const x = servicos.get(sv.id) || { id: sv.id, nome: sv.nome, quantidade: 0, totalCents: 0 };
        x.quantidade += i.quantidade;
        x.totalCents += sv.priceCents * i.quantidade;
        servicos.set(sv.id, x);
      }
    }
    for (const k of o.kits || []) {
      const x = kits.get(k.id) || { id: k.id, nome: k.nome, quantidade: 0, descontoCents: 0 };
      x.quantidade += k.quantidade;
      x.descontoCents += k.descontoCents;
      kits.set(k.id, x);
    }
  }
  const canceled = orders.filter((o) => o.status === "Cancelado").length;
  return {
    porCategoria: [...categoria.values()].sort((a, b) => b.totalCents - a.totalCents),
    maisVendidos: [...vendidos.values()].sort((a, b) => b.unidades - a.unidades || b.totalCents - a.totalCents).slice(0, 5),
    servicos: [...servicos.values()].sort((a, b) => b.totalCents - a.totalCents),
    kits: [...kits.values()].sort((a, b) => b.quantidade - a.quantidade),
    cancelamentoPct: orders.length ? Math.round((canceled / orders.length) * 100) : 0,
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

// Troca ou devolução: até 7 dias depois da conclusão, pelo próprio cliente, uma por vez.
export const EXCHANGE_DAYS = 7;
export function exchangeWindow(order, now = new Date()) {
  if (order.status !== "Concluído") return { aberta: false, motivo: "O pedido precisa estar concluído (entregue ou retirado)." };
  const done = history(order).findLast((h) => h.status === "Concluído")?.at || order.createdAt;
  const ate = new Date(new Date(done).getTime() + EXCHANGE_DAYS * 86400000);
  return now <= ate ? { aberta: true, ate: ate.toISOString() } : { aberta: false, ate: ate.toISOString(), motivo: "O prazo de 7 dias depois do recebimento terminou." };
}
export async function requestExchange(storage, user, orderId, body = {}, now = new Date()) {
  const found = await storage.getByRowKey("orders", String(orderId));
  if (!found || found.partitionKey !== user.id) throw new AppError(404, "Pedido não encontrado.");
  const win = exchangeWindow(found, now);
  if (!win.aberta) throw new AppError(409, win.motivo);
  if ((found.trocas || []).some((t) => t.status === "Aberta")) throw new AppError(409, "Já existe uma solicitação em análise para este pedido.");
  const tipo = body.tipo === "devolucao" ? "devolucao" : "troca";
  const itens = JSON.parse(found.itens);
  const wanted = Array.isArray(body.itens) ? [...new Set(body.itens.filter((id) => typeof id === "string"))] : [];
  if (!wanted.length || wanted.some((id) => !itens.some((i) => i.id === id))) throw new AppError(400, "Escolha os itens do pedido que você quer trocar ou devolver.", "itens");
  const motivo = String(body.motivo ?? "").trim();
  if (motivo.length < 10 || motivo.length > 500) throw new AppError(400, "Conte o motivo em 10 a 500 caracteres.", "motivo");
  const solicitacao = { id: randomInt(100000, 999999).toString(), tipo, itens: wanted, motivo, status: "Aberta", at: now.toISOString() };
  const next = { ...found, trocas: [...(found.trocas || []), solicitacao] };
  const apply = async (scoped) => {
    await scoped.save("orders", next, found.etag);
    await notify(scoped, user.id, {
      tipo: "pedido",
      titulo: `${tipo === "troca" ? "Troca" : "Devolução"} solicitada: pedido #${found.rowKey.slice(0, 8).toUpperCase()}`,
      texto: "Recebemos sua solicitação. A loja analisa em até 2 dias úteis e responde por aqui.",
      link: `/pedido.html?id=${encodeURIComponent(found.rowKey)}#troca`,
    });
  };
  await (storage.transaction && !storage.inTransaction ? storage.transaction(apply) : apply(storage));
  return next;
}
// Resposta da loja à solicitação aberta (aprovada ou recusada), com aviso ao cliente.
export async function answerExchange(storage, orderId, body = {}) {
  const found = await storage.getByRowKey("orders", String(orderId));
  if (!found) throw new AppError(404, "Pedido não encontrado.");
  const open = (found.trocas || []).find((t) => t.status === "Aberta");
  if (!open) throw new AppError(409, "Não há solicitação aberta neste pedido.");
  if (!["Aprovada", "Recusada"].includes(body.status)) throw new AppError(400, "Use Aprovada ou Recusada.", "status");
  const resposta = String(body.resposta ?? "").trim().slice(0, 500);
  const done = { ...open, status: body.status, resposta, respondidaEm: new Date().toISOString() };
  const next = { ...found, trocas: found.trocas.map((t) => (t === open ? done : t)) };
  const apply = async (scoped) => {
    await scoped.save("orders", next, found.etag);
    await notify(scoped, found.partitionKey, {
      tipo: "pedido",
      titulo: `${open.tipo === "troca" ? "Troca" : "Devolução"} ${body.status === "Aprovada" ? "aprovada" : "recusada"}: pedido #${found.rowKey.slice(0, 8).toUpperCase()}`,
      texto: resposta || (body.status === "Aprovada" ? "Enviamos as instruções de postagem no comprovante do pedido." : "Veja o motivo no comprovante do pedido."),
      link: `/pedido.html?id=${encodeURIComponent(found.rowKey)}#troca`,
    });
  };
  await (storage.transaction && !storage.inTransaction ? storage.transaction(apply) : apply(storage));
  return next;
}
