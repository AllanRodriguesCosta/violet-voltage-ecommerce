import { configuration } from "../src/config/index.js";
import { AzureStorage, MemoryStorage } from "../src/repositories/storage.js";
import { seed } from "../src/services/seed.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
try {
  const config = configuration();
  const storage = config.memory
    ? new MemoryStorage()
    : new AzureStorage(config.connection);
  await storage.init();
  const count = await seed(storage);
  console.log(
    `Seed concluído: ${count} produtos adicionados, sem sobrescrever registros.`,
  );
  if (config.memory) {
    await bootstrapAdmin(storage);
    createApp(storage, config).listen(config.port, "0.0.0.0", () =>
      console.log(
        `Demonstração em memória disponível na porta ${config.port}; dados são perdidos ao reiniciar.`,
      ),
    );
  }
} catch {
  console.error(
    "Não foi possível executar o seed. Verifique a configuração e a conexão.",
  );
  process.exitCode = 1;
}
