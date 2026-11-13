import { randomUUID } from "node:crypto";
import { AppError, integer, text } from "../utils/validation.js";
import { quote, installments, shipping } from "./pricing.js";
import { activeRules, checkCustomerUse, countUse } from "./coupons.js";
// O CEP do próprio endereço vale mais que o enviado à parte (não dá para pagar frete de outra região).
import { cepFromText, cepDigits } from "../../public/js/regions.js";
import { clearCart } from "./carts.js";
import { SERVICES, servicePrice } from "../../public/js/services.js";
export { shipping };
// IDs pedidos pelo cliente, para buscar só os produtos necessários.
export const itemIds = (items) =>
  Array.isArray(items)
    ? items.slice(0, 30).map((i) => i?.id).filter((id) => typeof id === "string")
    : [];
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
    // Serviços por unidade (regulagem, troca de cordas, garantia), com preço do servidor.
    const requested = item.servicos === undefined ? [] : item.servicos;
    if (!Array.isArray(requested) || requested.length > 3 || new Set(requested).size !== requested.length)
      throw new AppError(400, "Serviços inválidos.");
    const servicos = requested.map((id) => {
      if (typeof id !== "string" || !Object.hasOwn(SERVICES, id) || !SERVICES[id].categorias.includes(p.categoria))
        throw new AppError(400, "Serviço indisponível para este item.");
      return { id, nome: SERVICES[id].nome, priceCents: servicePrice(id, p) };
    });
    // Cor: só as do produto. Sem escolha (ou com uma cor que saiu de linha), vale a cor padrão,
    // a mesma que o carrinho mostra (itemColor em public/js/common.js).
    const cores = Array.isArray(p.cores) ? p.cores.map((c) => c.nome) : [];
    if (item.cor !== undefined && item.cor !== null && (typeof item.cor !== "string" || item.cor.length > 30))
      throw new AppError(400, "Cor inválida.");
    const cor = cores.length ? (cores.includes(item.cor) ? item.cor : cores[0]) : undefined;
    // Etapa 34: estoque por cor (opcional). Sem número na cor, vale só o estoque total.
    const corInfo = cor && p.cores.find((c) => c.nome === cor);
    if (corInfo && Number.isInteger(corInfo.estoque) && corInfo.estoque < quantidade)
      throw new AppError(409, corInfo.estoque ? `Só ${corInfo.estoque} ${corInfo.estoque === 1 ? "unidade" : "unidades"} na cor ${cor}.` : `${p.marca} ${p.modelo} está esgotado na cor ${cor}.`);
    return {
      id: p.rowKey,
      nome: `${p.marca} ${p.modelo}`,
      marca: p.marca,
      modelo: p.modelo,
      quantidade,
      priceCents: p.priceCents,
      ...(cor ? { cor } : {}),
      ...(servicos.length ? { servicos } : {}),
    };
  });
}
// Baixa (sinal -1) ou devolve (+1) o estoque total e, se houver, o da cor.
export function adjustStock(p, item, sign) {
  const next = { ...p, estoque: p.estoque + sign * item.quantidade };
  if (item.cor && Array.isArray(p.cores) && p.cores.some((c) => c.nome === item.cor && Number.isInteger(c.estoque)))
    next.cores = p.cores.map((c) => (c.nome === item.cor && Number.isInteger(c.estoque) ? { ...c, estoque: Math.max(0, c.estoque + sign * item.quantidade) } : c));
  return next;
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
    const previous = await storage.findOrderByRequest(user.id, requestId);
    if (previous) return previous;
    if (
      !["pix", "cartao", "boleto"].includes(body.pagamento) ||
      !Object.hasOwn(shipping, body.entrega)
    )
      throw new AppError(400, "Pagamento ou entrega inválidos.");
    const endereco = text(body.endereco, "endereco", 5, 500);
    const products = await storage.getManyByRowKeys("products", itemIds(body.items));
    const items = calculate(body.items, products);
    const rules = await activeRules(storage);
    const totals = quote(items, { entrega: body.entrega, cupom: body.cupom, cep: body.entrega === "retirada" ? null : cepFromText(endereco) || cepDigits(body.cep), rules });
    await checkCustomerUse(storage, user, totals.cupom?.codigo, rules);
    const parcelas = installments(body.pagamento, body.parcelas, totals.totalCents);
    const createdAt = new Date().toISOString();
    const order = {
      partitionKey: user.id,
      rowKey: randomUUID(),
      requestId,
      itens: JSON.stringify(items),
      subtotalCents: totals.subtotalCents,
      freteCents: totals.freteCents,
      descontoCents: totals.descontoCents,
      descontoKitsCents: totals.descontoKitsCents,
      servicosCents: totals.servicosCents,
      kits: totals.kits,
      cupom: totals.cupom?.codigo || null,
      totalCents: totals.totalCents,
      pagamento: body.pagamento,
      parcelas,
      entrega: body.entrega,
      endereco,
      status: "Recebido",
      statusHistory: [{ status: "Recebido", at: createdAt }],
      createdAt,
    };
    const changed = [];
    try {
      for (const item of items) {
        const p = products.find((p) => p.rowKey === item.id);
        await storage.save("products", adjustStock(p, item, -1), p.etag);
        changed.push({ p, item });
      }
      await storage.create("orders", order);
      // Uso do cupom e carrinho da conta: falhar aqui não desfaz o pedido já gravado.
      await countUse(storage, order.cupom).catch(() => console.error("Falha ao contar uso do cupom."));
      await clearCart(storage, user.id).catch(() => {});
      return order;
    } catch (error) {
      // PostgreSQL reverte estoque e pedido juntos, sem compensação manual.
      if (storage.inTransaction) throw error;
      for (const { p, item } of changed) {
        try {
          const current = await storage.get(
            "products",
            p.partitionKey,
            p.rowKey,
          );
          await storage.save("products", adjustStock(current, item, 1), current.etag);
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
