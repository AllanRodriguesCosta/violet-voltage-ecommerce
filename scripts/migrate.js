import { configuration } from "../src/config/index.js";
import { createStorage } from "../src/repositories/factory.js";
let storage;
try {
  const config = configuration();
  if (config.memory)
    throw new Error("Use PostgreSQL para executar a migração.");
  storage = createStorage(config);
  await storage.init();
  console.log(
    "Estrutura PostgreSQL criada/verificada, sem apagar registros existentes.",
  );
} catch {
  console.error(
    "Migração não concluída. Verifique DATABASE_URL, JWT_SECRET, TLS e permissões; nenhum segredo foi exibido.",
  );
  process.exitCode = 1;
} finally {
  await storage?.close?.();
}
