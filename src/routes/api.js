import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { auth, admin, safeCustomer, sessionUser } from "../middleware/auth.js";
import {
  AppError,
  email,
  text,
  productInput,
  profileInput,
} from "../utils/validation.js";
import { placeOrder, exclusive } from "../services/checkout.js";
import { publicProduct, publicOrder } from "../controllers/serialization.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    cb(
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
        ? null
        : new AppError(400, "Use JPEG, PNG ou WebP."),
      true,
    );
  },
});
function validateImage(file) {
  const b = file.buffer;
  const valid =
    file.mimetype === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.mimetype === "image/png"
        ? b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    throw new AppError(
      400,
      "O conteúdo da imagem não corresponde ao formato informado.",
    );
}
export function apiRouter(storage, config) {
  const r = Router();
  const authenticated = auth(storage, config);
  const limited = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({ error: { message: "Muitas tentativas. Aguarde 15 minutos." } }),
  });
  const cookie = {
    httpOnly: true,
    sameSite: "lax",
    secure: config.production,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
  const sign = (res, u) =>
    res.cookie(
      "vv_session",
      jwt.sign({ email: u.rowKey }, config.secret, {
        subject: u.id,
        expiresIn: "8h",
        algorithm: "HS256",
      }),
      cookie,
    );
  const product = async (id) => {
    const p = (await storage.list("products")).find(
      (p) => p.rowKey === id && p.ativo,
    );
    if (!p) throw new AppError(404, "Produto não encontrado.");
    return p;
  };
  const customer = async (id) => {
    const u = (await storage.list("customers")).find(
      (u) => u.id === id && u.ativo,
    );
    if (!u) throw new AppError(404, "Cliente não encontrado.");
    return u;
  };
  async function createCustomer(body, role = "customer") {
    const normalized = email(body.email);
    const senha = text(body.senha, "senha", 10, 72);
    if (Buffer.byteLength(senha) > 72)
      throw new AppError(400, "Senha excede 72 bytes.", "senha");
    const u = {
      partitionKey: "cliente",
      rowKey: normalized,
      id: randomUUID(),
      ...profileInput(body),
      passwordHash: await bcrypt.hash(senha, 12),
      role,
      ativo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await storage.create("customers", u);
    } catch (e) {
      if (e.statusCode === 409)
        throw new AppError(
          409,
          "Não foi possível cadastrar esse e-mail.",
          "email",
        );
      throw e;
    }
    return u;
  }
  r.get("/health", async (_req, res) => {
    try {
      await storage.ping?.();
    } catch {
      return res
        .status(503)
        .json({ error: { message: "Armazenamento indisponível." } });
    }
    return res.json({
      data: {
        status: "ok",
        storage: config.memory ? "memory-development" : "postgresql",
      },
    });
  });
  r.post("/auth/register", limited, async (req, res) => {
    const u = await createCustomer(req.body);
    sign(res, u);
    res.status(201).json({ data: safeCustomer(u) });
  });
  r.post("/auth/login", limited, async (req, res) => {
    const address = email(req.body.email);
    const password = text(req.body.senha, "senha", 1, 72);
    const u = await storage.get("customers", "cliente", address);
    const valid = await bcrypt.compare(
      password,
      u?.passwordHash ||
        "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    );
    if (!u?.ativo || !valid)
      throw new AppError(401, "E-mail ou senha inválidos.");
    sign(res, u);
    res.json({ data: safeCustomer(u) });
  });
  r.post("/auth/logout", (_req, res) => {
    res.clearCookie("vv_session", { ...cookie, maxAge: undefined });
    res.json({ data: { ok: true } });
  });
  r.get("/auth/me", authenticated, (req, res) =>
    res.json({ data: safeCustomer(req.user) }),
  );
  // Visitante sem sessão recebe 200 com null, sem erro no console do navegador.
  r.get("/auth/session", async (req, res) => {
    const u = await sessionUser(storage, config, req.cookies.vv_session);
    res.set("Cache-Control", "no-store").json({ data: u ? safeCustomer(u) : null });
  });
  r.patch("/profile", authenticated, async (req, res) => {
    const u = {
      ...req.user,
      ...profileInput(req.body),
      updatedAt: new Date().toISOString(),
    };
    await storage.save("customers", u, req.user.etag);
    res.json({ data: safeCustomer(u) });
  });
  r.get("/products", async (req, res) => {
    let products = (await storage.list("products")).filter((p) => p.ativo);
    for (const key of ["marca", "modelo", "categoria"])
      if (req.query[key])
        products = products.filter((p) =>
          p[key].toLowerCase().includes(String(req.query[key]).toLowerCase()),
        );
    if (req.query.q)
      products = products.filter((p) =>
        `${p.marca} ${p.modelo} ${p.descricao}`
          .toLowerCase()
          .includes(String(req.query.q).toLowerCase()),
      );
    for (const key of ["min", "max"])
      if (
        req.query[key] !== undefined &&
        (!/^\d+$/.test(req.query[key]) ||
          !Number.isSafeInteger(Number(req.query[key])))
      )
        throw new AppError(400, "Faixa de preço inválida.");
    if (req.query.min)
      products = products.filter((p) => p.priceCents >= Number(req.query.min));
    if (req.query.max)
      products = products.filter((p) => p.priceCents <= Number(req.query.max));
    res.json({ data: products.map(publicProduct) });
  });
  r.get("/products/:id", async (req, res) =>
    res.json({ data: publicProduct(await product(req.params.id)) }),
  );
  r.get("/images/:id", async (req, res) => {
    const p = await product(req.params.id);
    if (!p.blobName) throw new AppError(404, "Imagem não encontrada.");
    const image = await storage.blob(p.blobName);
    if (!image) throw new AppError(404, "Imagem não encontrada.");
    res
      .set({
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      })
      .send(image.buffer);
  });
  r.get("/orders", authenticated, async (req, res) =>
    res.json({
      data: (await storage.list("orders"))
        .filter((o) => o.partitionKey === req.user.id)
        .map(publicOrder),
    }),
  );
  r.post("/orders", authenticated, async (req, res) =>
    res.status(201).json({
      data: publicOrder(await placeOrder(storage, req.user, req.body)),
    }),
  );
  r.use("/admin", authenticated, admin);
  r.get("/admin/summary", async (_req, res) => {
    const [p, c, o] = await Promise.all(
      ["products", "customers", "orders"].map((t) => storage.list(t)),
    );
    res.json({
      data: {
        produtos: p.filter((p) => p.ativo).length,
        clientes: c.filter((c) => c.ativo && c.role === "customer").length,
        pedidos: o.length,
        totalCents: o
          .filter((o) => o.status !== "Cancelado")
          .reduce((s, o) => s + o.totalCents, 0),
      },
    });
  });
  r.post("/admin/products", async (req, res) => {
    const input = productInput(req.body);
    const p = {
      ...input,
      partitionKey: input.categoria
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
      rowKey: randomUUID(),
      ativo: true,
      blobName: "",
      imageUrl: "/assets/product.svg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.create("products", p);
    res.status(201).json({ data: publicProduct(p) });
  });
  r.patch("/admin/products/:id", async (req, res) =>
    res.json({
      data: await exclusive(async () => {
        const p = await product(req.params.id);
        const input = productInput(req.body);
        /* PartitionKey permanece estável para preservar identidade em edições de categoria. */ const next =
          { ...p, ...input, updatedAt: new Date().toISOString() };
        await storage.save("products", next, p.etag);
        return publicProduct(next);
      }),
    }),
  );
  r.delete("/admin/products/:id", async (req, res) => {
    await exclusive(async () => {
      const p = await product(req.params.id);
      await storage.save(
        "products",
        { ...p, ativo: false, blobName: "", imageUrl: "" },
        p.etag,
      );
      if (p.blobName) await storage.removeBlob(p.blobName);
    });
    res.json({ data: { ok: true } });
  });
  r.post(
    "/admin/products/:id/image",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) throw new AppError(400, "Selecione uma imagem.");
      validateImage(req.file);
      const p = await product(req.params.id);
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[req.file.mimetype];
      const name = `${p.rowKey}/${randomUUID()}.${ext}`;
      await storage.upload(name, req.file.buffer, req.file.mimetype);
      const next = {
        ...p,
        blobName: name,
        imageUrl: `/api/images/${p.rowKey}?v=${randomUUID()}`,
        updatedAt: new Date().toISOString(),
      };
      try {
        await storage.save("products", next, p.etag);
      } catch (e) {
        await storage.removeBlob(name);
        throw e;
      }
      if (p.blobName) await storage.removeBlob(p.blobName);
      res.json({ data: publicProduct(next) });
    },
  );
  r.get("/admin/customers", async (_req, res) =>
    res.json({
      data: (await storage.list("customers"))
        .filter((u) => u.ativo)
        .map(safeCustomer),
    }),
  );
  r.post("/admin/customers", async (req, res) =>
    res
      .status(201)
      .json({ data: safeCustomer(await createCustomer(req.body)) }),
  );
  r.patch("/admin/customers/:id", async (req, res) => {
    const u = await customer(req.params.id);
    const next = {
      ...u,
      ...profileInput(req.body),
      updatedAt: new Date().toISOString(),
    };
    await storage.save("customers", next, u.etag);
    res.json({ data: safeCustomer(next) });
  });
  r.delete("/admin/customers/:id", async (req, res) => {
    const u = await customer(req.params.id);
    if (u.role === "admin")
      throw new AppError(
        400,
        "Administradores não podem ser excluídos por esta rota.",
      );
    await storage.save(
      "customers",
      {
        ...u,
        ativo: false,
        nome: "Cliente excluído",
        telefone: "",
        endereco: "",
        passwordHash: "",
      },
      u.etag,
    );
    res.json({ data: { ok: true } });
  });
  r.get("/admin/orders", async (_req, res) =>
    res.json({ data: (await storage.list("orders")).map(publicOrder) }),
  );
  r.patch("/admin/orders/:id", async (req, res) => {
    const status = req.body.status;
    if (
      ![
        "Recebido",
        "Em preparação",
        "Enviado",
        "Concluído",
        "Cancelado",
      ].includes(status)
    )
      throw new AppError(400, "Status inválido.");
    const o = (await storage.list("orders")).find(
      (o) => o.rowKey === req.params.id,
    );
    if (!o) throw new AppError(404, "Pedido não encontrado.");
    const next = { ...o, status };
    await storage.save("orders", next, o.etag);
    res.json({ data: publicOrder(next) });
  });
  return r;
}
