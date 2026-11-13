import { configuration } from "../src/config/index.js";
import { createStorage } from "../src/repositories/factory.js";
import { seed, SeedInputError, missingGalleryFiles } from "../src/services/seed.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
let storage;
let serving = false;
try {
  const config = configuration();
  storage = createStorage(config);
  await storage.init();
  // "npm run seed -- --parcial" carrega só os produtos que já têm foto.
  const partial = process.argv.includes("--parcial");
  const result = await seed(storage, { partial });
  console.log(
    `Seed concluído: ${result.created} produtos criados, ${result.updated} atualizados e ${result.uploaded} imagens enviadas. Total do catálogo seed: ${result.total}. Produtos manuais preservados.`,
  );
  if (result.ignored.length)
    console.log(
      `Modo parcial: ${result.ignored.length} produtos ficaram de fora por falta de foto (lista em docs/FOTOS-PENDENTES.txt):\n${result.ignored.map((file) => `  - ${file}`).join("\n")}`,
    );
  const extras = await missingGalleryFiles();
  if (extras.length)
    console.log(
      `Fotos extras (outras vistas e cores) não encontradas: ${extras.length}. Os produtos entraram com as fotos que existem:\n${extras.map((file) => `  - ${file}`).join("\n")}`,
    );
  if (config.memory) {
    serving = true;
    await bootstrapAdmin(storage);
    createApp(storage, config).listen(config.port, "0.0.0.0", () =>
      console.log(
        `Demonstração em memória disponível na porta ${config.port}; dados são perdidos ao reiniciar.`,
      ),
    );
  }
} catch (error) {
  console.error(
    error instanceof SeedInputError
      ? error.message
      : "Não foi possível concluir o seed. Verifique a configuração e a conexão. Uma falha remota pode interromper a carga; corrija a causa e execute novamente para completar os mesmos IDs.",
  );
  process.exitCode = 1;
} finally {
  if (!serving) await storage?.close?.();
}
