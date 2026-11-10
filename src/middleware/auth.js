import jwt from "jsonwebtoken";
import { AppError } from "../utils/validation.js";
export const safeCustomer = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.rowKey,
  telefone: u.telefone,
  endereco: u.endereco,
  enderecos: u.enderecos || [],
  role: u.role,
  ativo: u.ativo,
});
// Usuário ativo do cookie de sessão; token ausente ou inválido resulta em null.
export async function sessionUser(storage, config, token) {
  let payload;
  try {
    payload = jwt.verify(token || "", config.secret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
  const u = await storage.get("customers", "cliente", payload.email);
  return u?.ativo && u.id === payload.sub ? u : null;
}
export function auth(storage, config) {
  return async (req, _res, next) => {
    try {
      const u = await sessionUser(storage, config, req.cookies.vv_session);
      if (!u) throw new Error("Sessão ausente.");
      req.user = u;
      next();
    } catch {
      next(new AppError(401, "Faça login para continuar."));
    }
  };
}
export function admin(req, _res, next) {
  if (req.user.role !== "admin")
    return next(new AppError(403, "Acesso restrito ao administrador."));
  next();
}
