import { ConfigError } from "../config/index.js";
import { AppError } from "./validation.js";

// Mensagem de falha na inicialização com a causa provável, sem expor segredos:
// mensagens próprias são seguras; de bibliotecas, só código e nome do erro.
export function startupError(error) {
  const own = error instanceof ConfigError || error instanceof AppError;
  const detail = own ? error.message : [error?.code, error?.name].filter(Boolean).join(" ");
  return `Inicialização falhou${detail ? ` (${detail})` : ""}. Verifique variáveis obrigatórias, permissões, TLS e conectividade com PostgreSQL.`;
}
