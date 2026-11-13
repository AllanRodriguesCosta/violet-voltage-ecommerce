// Etapa 34: cupons gerenciados no painel. Os três cupons padrão (src/services/pricing.js) valem
// sem cadastro; o painel pode desativá-los, mudar validade ou limite de usos (grava um registro
// com o mesmo código) e criar cupons novos. O checkout recalcula tudo no servidor.
import { AppError, text } from "../utils/validation.js";
import { coupons as DEFAULTS } from "./pricing.js";

export const COUPON_TYPES = { percent: "Porcentagem", fixed: "Valor fixo", shipping: "Frete grátis" };
const PK = "cupom";
const base = (codigo, r) => ({ codigo, type: r.type, value: r.value ?? null, minCents: r.minCents ?? null, maxCents: r.maxCents ?? null, description: r.description, ativo: true, validoAte: null, limiteUsos: null, usos: 0, umPorCliente: false });
const FIELDS = ["type", "value", "minCents", "maxCents", "description", "ativo", "validoAte", "limiteUsos", "usos", "umPorCliente"];

export async function allCoupons(storage) {
  const map = new Map(Object.entries(DEFAULTS).map(([code, r]) => [code, { ...base(code, r), padrao: true }]));
  for (const s of await storage.list("coupons")) {
    const fields = Object.fromEntries(FIELDS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
    map.set(s.rowKey, { ...(map.get(s.rowKey) || {}), ...fields, codigo: s.rowKey, padrao: Object.hasOwn(DEFAULTS, s.rowKey), createdAt: s.createdAt, updatedAt: s.updatedAt });
  }
  return [...map.values()].sort((a, b) => Number(b.padrao) - Number(a.padrao) || a.codigo.localeCompare(b.codigo));
}
// Validade até o fim do dia informado (horário de Brasília).
const expired = (c, at) => Boolean(c.validoAte) && at > new Date(`${c.validoAte}T23:59:59-03:00`);
export const usable = (c, at = new Date()) => c.ativo !== false && !expired(c, at) && (c.limiteUsos == null || (c.usos || 0) < c.limiteUsos);
export const couponState = (c, at = new Date()) =>
  c.ativo === false ? "Desativado" : expired(c, at) ? "Expirado" : c.limiteUsos != null && (c.usos || 0) >= c.limiteUsos ? "Esgotado" : "Ativo";
export async function activeRules(storage, at = new Date()) {
  return Object.fromEntries((await allCoupons(storage)).filter((c) => usable(c, at)).map((c) => [c.codigo, c]));
}
// Lista curta para o assistente e a ajuda: só cupons que funcionam agora.
export const activeList = async (storage) => Object.values(await activeRules(storage)).map((c) => ({ codigo: c.codigo, descricao: c.description, validoAte: c.validoAte }));

// Cupom de uso único por cliente: pedidos não cancelados com o mesmo código bloqueiam.
export async function checkCustomerUse(storage, user, code, rules) {
  const rule = code && rules[code];
  if (!rule?.umPorCliente || !user) return;
  const orders = await storage.listByPartition("orders", user.id);
  if (orders.some((o) => o.cupom === code && o.status !== "Cancelado")) throw new AppError(400, "Você já usou este cupom em outro pedido.", "cupom");
}
export async function countUse(storage, code) {
  if (!code) return;
  const current = await storage.get("coupons", PK, code);
  const now = new Date().toISOString();
  if (current) await storage.save("coupons", { ...current, usos: (current.usos || 0) + 1, updatedAt: now }, current.etag);
  else if (Object.hasOwn(DEFAULTS, code)) await storage.create("coupons", { partitionKey: PK, rowKey: code, ...base(code, DEFAULTS[code]), usos: 1, createdAt: now, updatedAt: now });
}

const cents = (v, field, min = 1, max = 10_000_000) => {
  if (v === undefined || v === null || v === "") return null;
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new AppError(400, `Valor inválido em ${field}.`, field);
  return v;
};
function readCoupon(body, current) {
  const out = {};
  if (body.type !== undefined || !current) {
    if (!Object.hasOwn(COUPON_TYPES, body.type)) throw new AppError(400, "Escolha o tipo do cupom.", "type");
    out.type = body.type;
  }
  const type = out.type || current.type;
  if (body.value !== undefined || !current) {
    if (type === "percent") out.value = cents(body.value, "value", 1, 90);
    else if (type === "fixed") out.value = cents(body.value, "value", 100);
    else out.value = null;
    if (type !== "shipping" && out.value == null) throw new AppError(400, type === "percent" ? "Informe a porcentagem (1 a 90)." : "Informe o valor do desconto.", "value");
  }
  if (body.minCents !== undefined) out.minCents = cents(body.minCents, "minCents");
  if (body.maxCents !== undefined) out.maxCents = cents(body.maxCents, "maxCents");
  if (body.description !== undefined || !current) out.description = text(body.description, "descrição", 3, 120);
  if (body.ativo !== undefined) out.ativo = Boolean(body.ativo);
  if (body.umPorCliente !== undefined) out.umPorCliente = Boolean(body.umPorCliente);
  if (body.validoAte !== undefined) {
    if (body.validoAte !== null && body.validoAte !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.validoAte))) throw new AppError(400, "Data de validade inválida.", "validoAte");
    out.validoAte = body.validoAte || null;
  }
  if (body.limiteUsos !== undefined) {
    const n = body.limiteUsos;
    if (n !== null && n !== "" && (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000)) throw new AppError(400, "Limite de usos inválido.", "limiteUsos");
    out.limiteUsos = n === "" ? null : n;
  }
  return out;
}
export function couponCodeOf(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,30}$/.test(code)) throw new AppError(400, "Use de 3 a 30 letras ou números, sem espaços.", "codigo");
  return code;
}
export async function createCoupon(storage, body) {
  const code = couponCodeOf(body.codigo);
  if ((await allCoupons(storage)).some((c) => c.codigo === code)) throw new AppError(409, "Já existe um cupom com este código.", "codigo");
  const now = new Date().toISOString();
  await storage.create("coupons", { partitionKey: PK, rowKey: code, ativo: true, usos: 0, umPorCliente: false, validoAte: null, limiteUsos: null, minCents: null, maxCents: null, ...readCoupon(body, null), createdAt: now, updatedAt: now });
  return (await allCoupons(storage)).find((c) => c.codigo === code);
}
export async function updateCoupon(storage, code, body) {
  const key = couponCodeOf(code);
  const current = (await allCoupons(storage)).find((c) => c.codigo === key);
  if (!current) throw new AppError(404, "Cupom não encontrado.");
  const stored = await storage.get("coupons", PK, key);
  const now = new Date().toISOString();
  const plain = { ...current };
  delete plain.codigo;
  delete plain.padrao;
  const next = { ...plain, ...(stored || {}), ...readCoupon(body, current), partitionKey: PK, rowKey: key, updatedAt: now, createdAt: stored?.createdAt || now };
  if (stored) await storage.save("coupons", next, stored.etag);
  else await storage.create("coupons", next);
  return (await allCoupons(storage)).find((c) => c.codigo === key);
}
export const publicCoupon = (c) => ({ ...c, situacao: couponState(c) });
