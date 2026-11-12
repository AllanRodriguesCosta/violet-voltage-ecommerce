import { seedSpecsById } from "../services/seed-products.js";

// Projeções públicas: metadados de concorrência não fazem parte da API.
export const publicProduct = (product) => ({
  ...product,
  id: product.rowKey,
  ficha:
    ("ficha" in product ? product.ficha : seedSpecsById.get(product.rowKey)) || null,
  etag: undefined,
  timestamp: undefined,
});

export const publicOrder = (order) => ({
  ...order,
  id: order.rowKey,
  itens: JSON.parse(order.itens),
  etag: undefined,
  timestamp: undefined,
});
