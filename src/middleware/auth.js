import jwt from "jsonwebtoken";
import { AppError } from "../utils/validation.js";
export const safeCustomer = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.rowKey,
  telefone: u.telefone,
  endereco: u.endereco,
  role: u.role,
  ativo: u.ativo,
});
export function auth(storage, config) {
  return async (req, _res, next) => {
    try {
      const payload = jwt.verify(req.cookies.vv_session || "", config.secret, {
        algorithms: ["HS256"],
      });
      const u = await storage.get("customers", "cliente", payload.email);
      if (!u?.ativo || u.id !== payload.sub) throw new Error();
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
