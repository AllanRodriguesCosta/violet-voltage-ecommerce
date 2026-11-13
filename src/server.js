import { configuration } from "./config/index.js";
import { createStorage } from "./repositories/factory.js";
import { bootstrapAdmin } from "./services/bootstrap.js";
import { createApp } from "./app.js";
import { startupError } from "./utils/startup-error.js";
import { runCatalogSync } from "./services/catalog-sync.js";
try {
  const config = configuration();
  const storage = createStorage(config);
  await storage.init();
  await bootstrapAdmin(storage);
  const server = createApp(storage, config).listen(config.port, "0.0.0.0", () =>
    console.log(
      `Violet Voltage disponível na porta ${config.port} (instância ${config.instanceName}). Armazenamento: ${config.memory ? "MEMÓRIA DE DESENVOLVIMENTO (dados voláteis)" : "PostgreSQL"}.`,
    ),
  );
  // Fotos versionadas em seed-assets/catalogo: cadastra produtos novos e atualiza fotos em segundo
  // plano, sem atrasar a subida. CATALOG_SYNC=off desliga. Com várias instâncias, só uma sincroniza.
  if (config.catalogSync)
    runCatalogSync(storage)
      .then((message) => console.log(message))
      .catch((error) => console.error(`Fotos do catálogo não sincronizadas: ${error.message}`));
  // Etapa 31: ao ser retirada do balanceador (deploy, escala, reinício), a instância para de aceitar
  // conexões novas, termina as que estão em andamento e fecha o banco.
  const stop = (signal) => {
    console.log(`${signal} recebido: encerrando a instância ${config.instanceName}.`);
    setTimeout(() => process.exit(0), 10_000).unref();
    server.close(() =>
      Promise.resolve(storage.close?.())
        .catch(() => {})
        .finally(() => process.exit(0)),
    );
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
} catch (error) {
  console.error(startupError(error));
  process.exitCode = 1;
}
