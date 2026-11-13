// Confere as fotos do catálogo antes do seed, sem banco e sem alterar nada:
// npm run fotos:conferir
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { seedProducts, ORIGINAL_SEED_COUNT } from "../src/services/seed-products.js";
import { defaultAssetsDirectory } from "../src/services/seed.js";
import { galleryFiles } from "../src/services/seed-gallery.js";
import { repoAssetsDirectory } from "../src/services/catalog-sync.js";

// Procura primeiro na pasta local (fora do Git) e depois nas fotos versionadas (seed-assets/catalogo).
async function read(file) {
  for (const directory of [defaultAssetsDirectory, repoAssetsDirectory]) {
    try {
      return await readFile(join(directory, file));
    } catch {
      /* tenta a próxima pasta */
    }
  }
  throw new Error("ausente");
}

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const LARGE = 1024 * 1024;
const missing = [];
const invalid = [];
const large = [];
for (const [index, product] of seedProducts.entries()) {
  const label = `${product.file}  (${product.marca} ${product.modelo}${index >= ORIGINAL_SEED_COUNT ? ", etapa 18" : ""})`;
  let buffer;
  try {
    buffer = await read(product.file);
  } catch {
    missing.push(label);
    continue;
  }
  if (!buffer.subarray(0, 8).equals(PNG)) invalid.push(label);
  else if (buffer.length > LARGE) large.push(`${label}: ${(buffer.length / LARGE).toFixed(1)} MB`);
}
// Fotos extras da galeria (outras vistas e cores): opcionais, conferidas à parte.
const extras = seedProducts.flatMap((p) => galleryFiles(p).slice(1));
const missingExtras = [];
for (const extra of extras) {
  let buffer;
  try {
    buffer = await read(extra.file);
  } catch {
    missingExtras.push(extra.file);
    continue;
  }
  if (!buffer.subarray(0, 8).equals(PNG)) invalid.push(extra.file);
  else if (buffer.length > LARGE) large.push(`${extra.file}: ${(buffer.length / LARGE).toFixed(1)} MB`);
}
const ok = seedProducts.length - missing.length - invalid.filter((i) => !extras.some((e) => e.file === i)).length;
const section = (title, items) => (items.length ? `\n${title} (${items.length}):\n${items.map((i) => `  - ${i}`).join("\n")}` : "");
console.log(
  `Fotos em seed-assets/produtos-violet-voltage e seed-assets/catalogo: ${ok} de ${seedProducts.length} prontas.` +
    section("Faltando", missing) +
    section("Não são PNG válidos (o seed para)", invalid) +
    section("Acima de 1 MB (funciona, mas deixa a loja mais lenta; comprima antes)", large) +
    `\nFotos extras da galeria (vistas e cores): ${extras.length - missingExtras.length} de ${extras.length}.` +
    section("Fotos extras faltando (opcionais; o produto entra com as que existirem)", missingExtras),
);
if (missing.length || invalid.length) {
  console.log(
    invalid.length
      ? "\nCorrija os arquivos inválidos antes de rodar o seed."
      : '\nO seed completo exige todas as fotos. Para carregar só os produtos com foto: npm run seed -- --parcial',
  );
  process.exitCode = 1;
}
