import { configuration } from "../src/config/index.js";
import { AzureStorage, MemoryStorage } from "../src/repositories/storage.js";
import { seed, SeedInputError } from "../src/services/seed.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
try {
  const config = configuration();
  const storage = config.memory
    ? new MemoryStorage()
    : new AzureStorage(config.connection);
  await storage.init();
  const result = await seed(storage);
  console.log(
    `Seed concluído: ${result.created} produtos criados, ${result.updated} atualizados e ${result.uploaded} imagens enviadas. Total do catálogo seed: ${result.total}. Produtos manuais preservados.`,
  );
  if (config.memory) {
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
}
