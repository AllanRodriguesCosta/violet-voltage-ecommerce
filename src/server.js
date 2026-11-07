import { configuration } from "./config/index.js";
import { createStorage } from "./repositories/factory.js";
import { bootstrapAdmin } from "./services/bootstrap.js";
import { createApp } from "./app.js";
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
} catch {
  console.error(
    "Inicialização falhou. Verifique variáveis obrigatórias, permissões, TLS e conectividade com PostgreSQL.",
  );
  process.exitCode = 1;
}
