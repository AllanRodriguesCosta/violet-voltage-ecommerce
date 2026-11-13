import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { seedProducts } from "./seed-products.js";
import { galleryFiles, galleryColors } from "./seed-gallery.js";

export const defaultAssetsDirectory = fileURLToPath(
  new URL("../../seed-assets/produtos-violet-voltage/", import.meta.url),
);
export class SeedInputError extends Error {}

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);
const isPng = (buffer) =>
  buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const folder = "seed-assets/produtos-violet-voltage";
const listed = (files) =>
  files.slice(0, 10).join(", ") +
  (files.length > 10 ? ` e mais ${files.length - 10}` : "");

// Pré-validação completa: nenhum registro ou blob é alterado se faltar uma imagem.
// No modo parcial, produtos sem foto ficam de fora (e são listados); PNG inválido sempre interrompe.
async function readImages(assetsDirectory, partial) {
  try {
    if (!(await stat(assetsDirectory)).isDirectory()) throw new Error();
  } catch {
    throw new SeedInputError(
      `Seed interrompido: a pasta ${folder} não foi encontrada. Coloque nela as ${seedProducts.length} imagens do manifesto, mantendo as subpastas e nomes. Nenhum produto ou imagem foi alterado.`,
    );
  }
  const images = new Map();
  const missing = [];
  for (const product of seedProducts) {
    let buffer;
    try {
      buffer = await readFile(join(assetsDirectory, product.file));
    } catch {
      missing.push(product.file);
      continue;
    }
    if (!isPng(buffer)) {
      throw new SeedInputError(
        `Seed interrompido: ${product.file} não é um PNG válido. Nenhum produto ou imagem foi alterado.`,
      );
    }
    // Fotos extras (outras vistas e cores): opcionais; PNG inválido também interrompe.
    const extras = [];
    for (const extra of galleryFiles(product).slice(1)) {
      let data;
      try {
        data = await readFile(join(assetsDirectory, extra.file));
      } catch {
        continue;
      }
      if (!isPng(data)) {
        throw new SeedInputError(
          `Seed interrompido: ${extra.file} não é um PNG válido. Nenhum produto ou imagem foi alterado.`,
        );
      }
      extras.push({ ...extra, buffer: data, version: hash(data) });
    }
    images.set(product.rowKey, { buffer, version: hash(buffer), extras });
  }
  if (missing.length && (!partial || !images.size)) {
    throw new SeedInputError(
      `Seed interrompido: faltam ${missing.length} de ${seedProducts.length} imagens em ${folder} (mantenha subpastas e nomes): ${listed(missing)}. Lista das fotos novas: docs/FOTOS-PENDENTES.txt. Para carregar só os produtos que já têm foto, use "npm run seed -- --parcial". Nenhum produto ou imagem foi alterado.`,
    );
  }
  return { images, missing };
}

// Fotos extras (outras vistas e cores) que não estão na pasta. São opcionais: o seed segue e o
// produto entra com as fotos que existirem. Usado nos avisos do "npm run seed".
export async function missingGalleryFiles(assetsDirectory = defaultAssetsDirectory) {
  const missing = [];
  for (const product of seedProducts)
    for (const extra of galleryFiles(product).slice(1)) {
      try {
        await stat(join(assetsDirectory, extra.file));
      } catch {
        missing.push(extra.file);
      }
    }
  return missing;
}

export async function seed(
  storage,
  {
    assetsDirectory = defaultAssetsDirectory,
    now = () => new Date(),
    partial = false,
  } = {},
) {
  const { images, missing } = await readImages(assetsDirectory, partial);
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
    ignored: missing,
  };
  for (const source of seedProducts) {
    if (!images.has(source.rowKey)) continue;
    const data = { ...source };
    delete data.file;
    const previous = byId.get(data.rowKey);
    const { buffer, version, extras } = images.get(source.rowKey);
    const blobName = `seed/violet-voltage/${data.rowKey}.png`;
    await storage.upload(blobName, buffer, "image/png");
    result.uploaded++;
    const imageUrl = `/api/images/${data.rowKey}?v=${version}`;
    // Galeria: a foto principal e as extras, cada uma com a cor e a vista.
    const main = galleryFiles(source)[0];
    const fotos = [{ blobName, url: imageUrl, cor: main.cor, vista: main.vista }];
    for (const extra of extras) {
      const name = `seed/violet-voltage/${data.rowKey}/${fotos.length}.png`;
      await storage.upload(name, extra.buffer, "image/png");
      result.uploaded++;
      fotos.push({ blobName: name, url: `/api/images/${data.rowKey}/${fotos.length}?v=${extra.version}`, cor: extra.cor, vista: extra.vista });
    }
    const cores = galleryColors(source.modelo).filter((c) => fotos.some((f) => f.cor === c.nome));
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
      imageUrl,
      fotos: fotos.length > 1 ? fotos : null,
      cores: cores.length > 1 ? cores : null,
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
