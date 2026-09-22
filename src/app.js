import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./routes/api.js";
import { AppError } from "./utils/validation.js";
const publicDir = fileURLToPath(new URL("../public", import.meta.url));
export function createApp(storage, config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.production) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "upgrade-insecure-requests": config.production ? [] : null,
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        ["POST", "PUT", "PATCH"].includes(req.method) &&
        req.path !== "/api/auth/logout" &&
        !req.is("multipart/form-data") &&
        (!req.body || Array.isArray(req.body) || typeof req.body !== "object")
      ) {
        return next(new AppError(400, "Envie um objeto JSON válido."));
      }
      const origin = req.get("origin");
      if (
        req.get("sec-fetch-site") === "cross-site" ||
        (origin && origin !== `${req.protocol}://${req.get("host")}`)
      )
        return next(new AppError(403, "Origem da requisição não permitida."));
    }
    next();
  });
  app.use("/api", apiRouter(storage, config));
  app.use("/api", (_req, _res, next) =>
    next(new AppError(404, "Rota não encontrada.")),
  );
  app.use(express.static(publicDir));
  app.use((_req, res) => res.status(404).sendFile(`${publicDir}/404.html`));
  app.use((err, _req, res, _next) => {
    const status =
      err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large"
        ? 413
        : err instanceof AppError
          ? err.status
          : err.statusCode === 412
            ? 409
            : err.type === "entity.parse.failed" || err.name === "MulterError"
              ? 400
              : 500;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "A imagem deve ter no máximo 5 MB."
        : err.type === "entity.too.large"
          ? "A requisição excede o tamanho permitido."
          : err.name === "MulterError"
            ? "Envie apenas uma imagem no campo image."
            : status === 409 && !(err instanceof AppError)
              ? "Registro alterado. Atualize a página."
              : status === 400 && !(err instanceof AppError)
                ? "JSON inválido."
                : status === 500
                  ? "Não foi possível concluir a operação. Tente novamente."
                  : err.message;
    if (status === 500) console.error("Falha interna na operação.", err.name);
    res.status(status).json({ error: { message, field: err.field } });
  });
  return app;
}
