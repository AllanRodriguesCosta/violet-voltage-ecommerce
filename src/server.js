import { configuration } from "./config/index.js";
import { createStorage } from "./repositories/factory.js";
import { bootstrapAdmin } from "./services/bootstrap.js";
import { createApp } from "./app.js";
import { startupError } from "./utils/startup-error.js";
import { syncCatalogPhotos, syncSummary } from "./services/catalog-sync.js";
try {
  const config = configuration();
  const storage = createStorage(config);
  await storage.init();
  await bootstrapAdmin(storage);
  createApp(storage, config).listen(config.port, "0.0.0.0", () =>
    console.log(
      `Violet Voltage disponível na porta ${config.port}. Armazenamento: ${config.memory ? "MEMÓRIA DE DESENVOLVIMENTO (dados voláteis)" : "PostgreSQL"}.`,
    ),
  );
  // Fotos versionadas em seed-assets/catalogo: cadastra produtos novos e atualiza fotos em segundo
  // plano, sem atrasar a subida. CATALOG_SYNC=off desliga.
  if (config.catalogSync)
    syncCatalogPhotos(storage)
      .then((result) => console.log(syncSummary(result)))
      .catch((error) => console.error(`Fotos do catálogo não sincronizadas: ${error.message}`));
} catch (error) {
  console.error(startupError(error));
  process.exitCode = 1;
}
