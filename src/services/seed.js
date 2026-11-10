import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { seedProducts } from "./seed-products.js";

export const defaultAssetsDirectory = fileURLToPath(
  new URL("../../seed-assets/produtos-violet-voltage/", import.meta.url),
);
export class SeedInputError extends Error {}

// Pré-validação completa: nenhum registro ou blob é alterado se faltar uma imagem.
async function readImages(assetsDirectory) {
  const images = [];
  for (const product of seedProducts) {
    let buffer;
    try {
      buffer = await readFile(join(assetsDirectory, product.file));
    } catch {
      throw new SeedInputError(
        `Seed interrompido: não foi possível ler ${product.file}. Coloque as 22 imagens em seed-assets/produtos-violet-voltage, mantendo as subpastas e nomes originais. Nenhum produto ou imagem foi alterado.`,
      );
    }
    if (
      !buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw new SeedInputError(
        `Seed interrompido: ${product.file} não é um PNG válido. Nenhum produto ou imagem foi alterado.`,
      );
    }
    images.push({
      buffer,
      version: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
    });
  }
  return images;
}

export async function seed(
  storage,
  { assetsDirectory = defaultAssetsDirectory, now = () => new Date() } = {},
) {
  const images = await readImages(assetsDirectory);
  const existing = await storage.list("products");
  const byId = new Map();
  const seedIds = new Set(seedProducts.map((product) => product.rowKey));
  for (const product of existing) {
    if (!seedIds.has(product.rowKey)) continue;
    if (byId.has(product.rowKey)) {
      throw new SeedInputError(
        `Seed interrompido: ${product.rowKey} já existe em mais de uma partição. Revise esses registros antes de executar novamente. Nenhum produto ou imagem foi alterado.`,
      );
    }
    byId.set(product.rowKey, product);
  }
  const result = {
    created: 0,
    updated: 0,
    uploaded: 0,
    total: seedProducts.length,
  };
  for (const [index, source] of seedProducts.entries()) {
    const data = { ...source };
    delete data.file;
    const previous = byId.get(data.rowKey);
    const { buffer, version } = images[index];
    const blobName = `seed/violet-voltage/${data.rowKey}.png`;
    await storage.upload(blobName, buffer, "image/png");
    result.uploaded++;
    const timestamp = now().toISOString();
    const product = {
      ...data,
      // Mantém a chave existente: trocar categoria não cria outro registro.
      partitionKey:
        previous?.partitionKey ||
        data.categoria
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ativo: true,
      blobName,
      imageUrl: `/api/images/${data.rowKey}?v=${version}`,
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    if (previous) {
      await storage.save("products", product, previous.etag);
      result.updated++;
    } else {
      await storage.create("products", product);
      result.created++;
    }
  }
  // Não remove registros ou blobs: imagens manuais antigas também são preservadas.
  return result;
}
