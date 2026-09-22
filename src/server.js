import { configuration } from "./config/index.js";
import { MemoryStorage, AzureStorage } from "./repositories/storage.js";
import { bootstrapAdmin } from "./services/bootstrap.js";
import { createApp } from "./app.js";
try {
  const config = configuration();
  const storage = config.memory
    ? new MemoryStorage()
    : new AzureStorage(config.connection);
  await storage.init();
  await bootstrapAdmin(storage);
  createApp(storage, config).listen(config.port, "0.0.0.0", () =>
    console.log(
      `Violet Voltage disponível na porta ${config.port}. Armazenamento: ${config.memory ? "MEMÓRIA DE DESENVOLVIMENTO (dados voláteis)" : "Azure"}.`,
    ),
  );
} catch {
  console.error(
    "Inicialização falhou. Verifique variáveis obrigatórias, permissões e conectividade com o Azure.",
  );
  process.exitCode = 1;
}
