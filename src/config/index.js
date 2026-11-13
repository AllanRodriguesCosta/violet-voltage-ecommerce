import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { geminiConfig } from "../assistant/gemini.js";
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
    // Etapa 30: ao iniciar, carrega as fotos versionadas do catálogo (CATALOG_SYNC=off desliga).
    catalogSync: env.CATALOG_SYNC !== "off",
    // Etapa 31 (várias instâncias atrás de um balanceador): nome desta instância, enviado no
    // cabeçalho X-Served-By e no /api/health para mostrar qual servidor respondeu.
    instanceName: instanceName(env),
    instanceHeader: env.INSTANCE_HEADER !== "off",
    trustProxy: trustProxy(env.TRUST_PROXY, production),
    // Reforço opcional do assistente; sem GEMINI_API_KEY fica desligado.
    gemini: geminiConfig(env),
  };
}

// INSTANCE_NAME tem prioridade; no App Service vale WEBSITE_INSTANCE_ID (encurtado); senão o hostname
// (nas VMs é vv-vm-1, vv-vm-2...). Só letras, números, ponto e hífen, até 40 caracteres.
export function instanceName(env = process.env) {
  const raw = env.INSTANCE_NAME || (env.WEBSITE_INSTANCE_ID ? `app-${env.WEBSITE_INSTANCE_ID.slice(0, 8)}` : hostname());
  return String(raw).replace(/[^a-z0-9.-]/gi, "").slice(0, 40) || "instancia";
}
// Quantos proxies confiáveis ficam na frente do Node. Padrão: 1 em produção (Render, App Service);
// Azure Load Balancer não é proxy (camada 4), então nas VMs use TRUST_PROXY=0.
export function trustProxy(value, production) {
  if (value === undefined || value === "") return production ? 1 : 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 5) throw new ConfigError("TRUST_PROXY deve ser um número de 0 a 5.");
  return n;
}
