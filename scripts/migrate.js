import { configuration, ConfigError } from "../src/config/index.js";
import { createStorage } from "../src/repositories/factory.js";
import { startupError } from "../src/utils/startup-error.js";
let storage;
try {
  const config = configuration();
  if (config.memory)
    throw new ConfigError("Use PostgreSQL para executar a migração.");
  storage = createStorage(config);
  await storage.init();
  console.log(
    "Estrutura PostgreSQL criada/verificada, sem apagar registros existentes.",
  );
} catch (error) {
  console.error(
    `Migração não concluída. ${startupError(error).replace("Inicialização falhou", "Causa")} Nenhum segredo foi exibido.`,
  );
  process.exitCode = 1;
} finally {
  await storage?.close?.();
}
