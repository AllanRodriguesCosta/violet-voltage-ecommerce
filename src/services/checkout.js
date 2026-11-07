import { randomUUID } from "node:crypto";
import { AppError, integer, text } from "../utils/validation.js";
export const shipping = { padrao: 2500, expressa: 4500, retirada: 0 };
export function calculate(items, products) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30)
    throw new AppError(400, "Carrinho inválido.");
  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string")
      throw new AppError(400, "Item de carrinho inválido.");
    if (seen.has(item.id)) throw new AppError(400, "Produto duplicado.");
    seen.add(item.id);
    const p = products.find((p) => p.rowKey === item.id && p.ativo);
    const quantidade = integer(item.quantidade, "quantidade", 1, 99);
    if (!p || p.estoque < quantidade)
      throw new AppError(409, "Produto indisponível ou estoque insuficiente.");
    return {
      id: p.rowKey,
      nome: `${p.marca} ${p.modelo}`,
      marca: p.marca,
      modelo: p.modelo,
      quantidade,
      priceCents: p.priceCents,
    };
  });
}
// Serializa mutações de estoque no único processo do serviço; ETags detectam escritores externos.
let tail = Promise.resolve();
export function exclusive(fn) {
  const next = tail.then(fn, fn);
  tail = next.catch(() => {});
  return next;
}
export async function placeOrder(storage, user, body) {
  if (storage.transaction && !storage.inTransaction) {
    return storage.transaction((scoped) => placeOrder(scoped, user, body));
  }
  return exclusive(async () => {
    const requestId = text(body.requestId, "requestId", 16, 100);
    if (!/^[a-zA-Z0-9-]+$/.test(requestId))
      throw new AppError(400, "Identificador inválido.");
    const previous = (await storage.list("orders")).find(
      (o) => o.partitionKey === user.id && o.requestId === requestId,
    );
    if (previous) return previous;
    if (
      !["pix", "cartao", "boleto"].includes(body.pagamento) ||
      !Object.hasOwn(shipping, body.entrega)
    )
      throw new AppError(400, "Pagamento ou entrega inválidos.");
    const endereco = text(body.endereco, "endereco", 5, 500);
    const products = await storage.list("products");
    const items = calculate(body.items, products);
    const subtotal = items.reduce((s, i) => s + i.priceCents * i.quantidade, 0);
    const freight = shipping[body.entrega];
    const order = {
      partitionKey: user.id,
      rowKey: randomUUID(),
      requestId,
      itens: JSON.stringify(items),
      subtotalCents: subtotal,
      freteCents: freight,
      totalCents: subtotal + freight,
      pagamento: body.pagamento,
      entrega: body.entrega,
      endereco,
      status: "Recebido",
      createdAt: new Date().toISOString(),
    };
    const changed = [];
    try {
      for (const item of items) {
        const p = products.find((p) => p.rowKey === item.id);
        await storage.save(
          "products",
          { ...p, estoque: p.estoque - item.quantidade },
          p.etag,
        );
        changed.push({ p, quantidade: item.quantidade });
      }
      await storage.create("orders", order);
      return order;
    } catch (error) {
      // PostgreSQL reverte estoque e pedido juntos, sem compensação manual.
      if (storage.inTransaction) throw error;
      for (const { p, quantidade } of changed) {
        try {
          const current = await storage.get(
            "products",
            p.partitionKey,
            p.rowKey,
          );
          await storage.save(
            "products",
            { ...current, estoque: current.estoque + quantidade },
            current.etag,
          );
        } catch {
          console.error(
            "Falha na compensação de estoque; revisão administrativa necessária.",
          );
        }
      }
      if (error.statusCode === 412)
        throw new AppError(
          409,
          "Estoque alterado. Atualize o carrinho e tente novamente.",
        );
      throw error;
    }
  });
}
