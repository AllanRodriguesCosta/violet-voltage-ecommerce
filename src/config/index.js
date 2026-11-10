import "dotenv/config";
import { randomBytes } from "node:crypto";
// Mensagens de configuração nunca incluem valores das variáveis.
export class ConfigError extends Error {}
export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const memory = env.DEV_MEMORY_STORAGE === "true";
  if (production && memory)
    throw new ConfigError("Armazenamento em memória proibido em produção.");
  if (!memory && !env.DATABASE_URL)
    throw new ConfigError(
      "Configure DATABASE_URL ou habilite DEV_MEMORY_STORAGE=true no desenvolvimento.",
    );
  if (!memory && (!env.JWT_SECRET || env.JWT_SECRET.length < 32))
    throw new ConfigError("Configure JWT_SECRET com pelo menos 32 caracteres.");
  if (production && env.DATABASE_SSL === "false")
    throw new ConfigError("Produção exige TLS para PostgreSQL.");
  if (!memory) {
    let url;
    try {
      url = new URL(env.DATABASE_URL);
    } catch {
      throw new ConfigError("DATABASE_URL inválida.");
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new ConfigError("DATABASE_URL deve usar PostgreSQL.");
  }
  return {
    production,
    memory,
    port: Number(env.PORT || 3000),
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL !== "false",
    databaseCa: env.DATABASE_CA_CERT,
    secret: env.JWT_SECRET || randomBytes(48).toString("hex"),
  };
}
