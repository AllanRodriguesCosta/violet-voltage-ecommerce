import { seedSpecsById } from "../services/seed-products.js";

// Projeções públicas: metadados de concorrência não fazem parte da API.
export const publicProduct = (product) => ({
  ...product,
  id: product.rowKey,
  ficha:
    ("ficha" in product ? product.ficha : seedSpecsById.get(product.rowKey)) || null,
  // Galeria: só endereço, cor e vista de cada foto (o nome interno do arquivo fica no servidor).
  fotos: Array.isArray(product.fotos) ? product.fotos.map(({ url, cor, vista }) => ({ url, cor: cor || null, vista: vista || null })) : null,
  cores: Array.isArray(product.cores) ? product.cores : null,
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
