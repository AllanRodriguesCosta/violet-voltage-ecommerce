import { randomUUID } from "node:crypto";
import { AppError } from "../utils/validation.js";

// Endereços de entrega guardados no cadastro do cliente (até 5, um principal).
export const MAX_ADDRESSES = 5;
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function field(value, name, label, min, max) {
  const v = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (v.length < min || v.length > max)
    throw new AppError(400, min ? `Informe ${label} com ${min} a ${max} caracteres.` : `Use no máximo ${max} caracteres em ${label}.`, name);
  return v;
}
export function addressInput(body = {}) {
  const digits = String(body.cep ?? "").replace(/\D/g, "");
  if (digits.length !== 8 || /^0+$/.test(digits)) throw new AppError(400, "Informe um CEP com 8 dígitos.", "cep");
  const uf = String(body.uf ?? "").trim().toUpperCase();
  if (!UFS.includes(uf)) throw new AppError(400, "Escolha o estado (UF).", "uf");
  return {
    apelido: field(body.apelido ?? "", "apelido", "o apelido", 0, 30),
    cep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    logradouro: field(body.logradouro, "logradouro", "a rua ou avenida", 2, 120),
    numero: field(body.numero, "numero", "o número", 1, 10),
    complemento: field(body.complemento ?? "", "complemento", "o complemento", 0, 60),
    bairro: field(body.bairro, "bairro", "o bairro", 2, 60),
    cidade: field(body.cidade, "cidade", "a cidade", 2, 60),
    uf,
    principal: body.principal === true || body.principal === "on" || body.principal === "true",
  };
}
export const formatAddress = (a) =>
  `${a.logradouro}, ${a.numero}${a.complemento ? ` - ${a.complemento}` : ""}, ${a.bairro}, ${a.cidade} - ${a.uf}, CEP ${a.cep}`;

// Garante exatamente um principal quando houver endereços; o principal vem primeiro.
function normalized(list, preferred) {
  const main = list.find((a) => a.id === preferred) || list[0];
  return list
    .map((a) => ({ ...a, principal: a === main }))
    .sort((a, b) => Number(b.principal) - Number(a.principal));
}
export function saveAddress(list = [], input, id) {
  let preferred = list.find((a) => a.principal)?.id;
  if (id) {
    if (!list.some((a) => a.id === id)) throw new AppError(404, "Endereço não encontrado.");
    const next = list.map((a) => (a.id === id ? { ...input, id } : a));
    if (input.principal) preferred = id;
    else if (preferred === id) preferred = next.find((a) => a.id !== id)?.id ?? id;
    return normalized(next, preferred);
  }
  if (list.length >= MAX_ADDRESSES)
    throw new AppError(409, `Você pode guardar até ${MAX_ADDRESSES} endereços. Exclua um para adicionar outro.`);
  const created = { ...input, id: randomUUID() };
  return normalized([...list, created], input.principal || !list.length ? created.id : preferred);
}
export function removeAddress(list = [], id) {
  if (!list.some((a) => a.id === id)) throw new AppError(404, "Endereço não encontrado.");
  return normalized(list.filter((a) => a.id !== id), list.find((a) => a.principal && a.id !== id)?.id);
}
