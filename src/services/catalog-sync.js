// Etapa 30: fotos do catálogo versionadas no repositório (seed-assets/catalogo/, mesmas subpastas e
// nomes do manifesto). Ao iniciar, o servidor cadastra os produtos do manifesto que ainda não estão
// no banco e têm foto ali, e atualiza só as fotos (principal e galeria) dos que já existem quando os
// arquivos mudam. Nunca altera preço, estoque, descrição ou status, não mexe em foto enviada pelo
// painel e não apaga nada: rodar de novo sem mudança nas fotos não grava nada.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { seedProducts } from "./seed-products.js";
import { galleryFiles, galleryColors } from "./seed-gallery.js";

export const repoAssetsDirectory = fileURLToPath(new URL("../../seed-assets/catalogo/", import.meta.url));
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);
const partition = (categoria) =>
  categoria
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function readPng(path) {
  try {
    const buffer = await readFile(path);
    return buffer.subarray(0, 8).equals(PNG) ? buffer : null;
  } catch {
    return null;
  }
}

// Fotos de um produto nesta pasta: a principal (obrigatória) e as extras que existirem.
// Nomes dos arquivos no banco seguem o seed (seed/violet-voltage/demo-043.png e .../demo-043/1.png),
// e a versão no endereço muda quando o arquivo muda (o navegador não fica com a foto antiga).
export async function photoSet(product, directory) {
  const files = galleryFiles(product);
  const main = await readPng(join(directory, files[0].file));
  if (!main) return null;
  const blobName = `seed/violet-voltage/${product.rowKey}.png`;
  const imageUrl = `/api/images/${product.rowKey}?v=${hash(main)}`;
  const uploads = [{ blobName, buffer: main }];
  const fotos = [{ blobName, url: imageUrl, cor: files[0].cor, vista: files[0].vista }];
  for (const extra of files.slice(1)) {
    const buffer = await readPng(join(directory, extra.file));
    if (!buffer) continue;
    const name = `seed/violet-voltage/${product.rowKey}/${fotos.length}.png`;
    uploads.push({ blobName: name, buffer });
    fotos.push({ blobName: name, url: `/api/images/${product.rowKey}/${fotos.length}?v=${hash(buffer)}`, cor: extra.cor, vista: extra.vista });
  }
  const cores = galleryColors(product.modelo).filter((c) => fotos.some((f) => f.cor === c.nome));
  return { uploads, blobName, imageUrl, fotos: fotos.length > 1 ? fotos : null, cores: cores.length > 1 ? cores : null };
}

const sameUrls = (a, b) => JSON.stringify((a || []).map((f) => f.url)) === JSON.stringify((b || []).map((f) => f.url));

export async function syncCatalogPhotos(storage, { directory = repoAssetsDirectory, now = () => new Date() } = {}) {
  const result = { created: 0, photosUpdated: 0, unchanged: 0, withoutPhoto: 0, manualPhoto: 0, errors: [] };
  const existing = new Map((await storage.list("products")).map((p) => [p.rowKey, p]));
  for (const source of seedProducts) {
    try {
      const photos = await photoSet(source, directory);
      if (!photos) {
        result.withoutPhoto++;
        continue;
      }
      const previous = existing.get(source.rowKey);
      // Foto trocada pelo painel do administrador vale mais que a do repositório.
      if (previous?.blobName && !previous.blobName.startsWith("seed/")) {
        result.manualPhoto++;
        continue;
      }
      if (previous && previous.imageUrl === photos.imageUrl && sameUrls(previous.fotos, photos.fotos)) {
        result.unchanged++;
        continue;
      }
      for (const u of photos.uploads) await storage.upload(u.blobName, u.buffer, "image/png");
      const timestamp = now().toISOString();
      const images = { blobName: photos.blobName, imageUrl: photos.imageUrl, fotos: photos.fotos, cores: photos.cores, updatedAt: timestamp };
      if (previous) {
        await storage.save("products", { ...previous, ...images }, previous.etag);
        result.photosUpdated++;
      } else {
        const data = { ...source };
        delete data.file;
        await storage.create("products", { ...data, partitionKey: partition(data.categoria), ativo: true, createdAt: timestamp, ...images });
        result.created++;
      }
    } catch (error) {
      // Um produto com problema (ex.: criado ao mesmo tempo por outra instância) não impede os demais.
      result.errors.push(`${source.rowKey}: ${error.message}`.slice(0, 160));
    }
  }
  return result;
}

export const syncSummary = (r) =>
  `Fotos do catálogo: ${r.created} produtos cadastrados, ${r.photosUpdated} com fotos atualizadas, ${r.unchanged} sem mudança, ${r.withoutPhoto} sem foto no repositório${r.manualPhoto ? `, ${r.manualPhoto} com foto do painel (mantida)` : ""}${r.errors.length ? `. Falhas: ${r.errors.join("; ")}` : "."}`;

// Etapa 31: com várias instâncias (balanceador), só uma sincroniza por vez; as outras pulam.
export async function runCatalogSync(storage, options) {
  const run = () => syncCatalogPhotos(storage, options);
  const outcome = storage.withLock ? await storage.withLock("catalog-sync", run) : { acquired: true, result: await run() };
  return outcome.acquired
    ? syncSummary(outcome.result)
    : "Fotos do catálogo: outra instância já está sincronizando; esta pulou a etapa.";
}
