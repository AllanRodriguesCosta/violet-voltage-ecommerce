import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { seedProducts } from "../../src/services/seed-products.js";

// PNG 1x1 gerado para testes; o CI não precisa das imagens privadas do catálogo.
export const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==",
  "base64",
);
export async function seedFixture(t) {
  const assetsDirectory = await mkdtemp(join(tmpdir(), "violet-voltage-seed-"));
  t.after(async () => {
    if (dirname(resolve(assetsDirectory)) !== resolve(tmpdir()))
      throw new Error("Pasta temporária fora do destino esperado.");
    await rm(assetsDirectory, { recursive: true, force: true });
  });
  for (const product of seedProducts) {
    const file = join(assetsDirectory, product.file);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, fixturePng);
  }
  return { assetsDirectory };
}
