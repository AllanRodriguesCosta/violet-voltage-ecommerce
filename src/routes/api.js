import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { auth, admin, safeCustomer, sessionUser } from "../middleware/auth.js";
import {
  AppError,
  email,
  text,
  productInput,
  profileInput,
} from "../utils/validation.js";
import { placeOrder, exclusive, calculate, itemIds } from "../services/checkout.js";
import { quote, deliveryOptions } from "../services/pricing.js";
import { updateOrderStatus, summary, requestExchange, answerExchange, exchangeWindow } from "../services/orders.js";
import { addressInput, saveAddress, removeAddress } from "../services/addresses.js";
import {
  listNotifications,
  markRead,
  unreadCount,
  alertKey,
  restockAlerts,
  demandByProduct,
  priceDropAlerts,
  priceWatchers,
} from "../services/notifications.js";
import { publicProduct, publicOrder } from "../controllers/serialization.js";
import { specText } from "../../public/js/specs.js";
import { reply } from "../assistant/index.js";
import { askGemini, limiter } from "../assistant/gemini.js";
import { card as assistantCard } from "../assistant/actions.js";
import { changePassword, exportData, deleteAccount } from "../services/account.js";
import { logMiss, missSummary, clearMisses } from "../services/assistant-log.js";
import { answeredQuestions, askQuestion, moderateQuestion, publicQuestion, adminQuestion } from "../services/questions.js";
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
    const p = await storage.getByRowKey("products", String(id));
    if (!p?.ativo) throw new AppError(404, "Produto não encontrado.");
    return p;
  };
  const customer = async (id) => {
    const u = await storage.findCustomerById(String(id));
    if (!u?.ativo) throw new AppError(404, "Cliente não encontrado.");
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
      // E-mail de conta excluída pelo próprio cliente pode ser cadastrado de novo, do zero.
      const old = await storage.get("customers", "cliente", normalized);
      if (old?.excluidaEm && !old.ativo) await storage.save("customers", u, old.etag);
      else await storage.create("customers", u);
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
        assistente: config.gemini ? "pln-local+gemini" : "pln-local",
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
    res
      .set("Cache-Control", "no-store")
      .json({ data: u ? { ...safeCustomer(u), naoLidas: await unreadCount(storage, u.id) } : null });
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
  // Segurança e privacidade da conta.
  r.post("/account/password", authenticated, limited, async (req, res) => {
    const u = await changePassword(storage, req.user, req.body);
    sign(res, u);
    res.json({ data: { ok: true } });
  });
  r.get("/account/export", authenticated, async (req, res) => {
    res
      .set({ "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="violet-voltage-meus-dados.json"' })
      .type("application/json")
      .send(JSON.stringify(await exportData(storage, req.user), null, 2));
  });
  r.post("/account/delete", authenticated, limited, async (req, res) => {
    await deleteAccount(storage, req.user, req.body);
    res.clearCookie("vv_session", { ...cookie, maxAge: undefined });
    res.json({ data: { ok: true } });
  });
  // Endereços de entrega (até 5, um principal), guardados no cadastro do cliente.
  const storeAddresses = async (req, enderecos) => {
    await storage.save("customers", { ...req.user, enderecos, updatedAt: new Date().toISOString() }, req.user.etag);
    return enderecos;
  };
  r.get("/addresses", authenticated, (req, res) => res.json({ data: req.user.enderecos || [] }));
  r.post("/addresses", authenticated, async (req, res) =>
    res.status(201).json({ data: await storeAddresses(req, saveAddress(req.user.enderecos, addressInput(req.body))) }),
  );
  r.patch("/addresses/:id", authenticated, async (req, res) =>
    res.json({ data: await storeAddresses(req, saveAddress(req.user.enderecos, addressInput(req.body), req.params.id)) }),
  );
  r.delete("/addresses/:id", authenticated, async (req, res) =>
    res.json({ data: await storeAddresses(req, removeAddress(req.user.enderecos, req.params.id)) }),
  );
  // "Avise-me": aviso de volta ao estoque para itens esgotados.
  const publicAlert = (a, p) => ({
    productId: a.productId,
    tipo: a.tipo === "preco" ? "preco" : "estoque",
    ...(a.tipo === "preco" ? { priceCents: a.priceCents } : {}),
    createdAt: a.createdAt,
    notifiedAt: a.notifiedAt,
    produto: p?.ativo ? publicProduct(p) : null,
  });
  r.get("/alerts", authenticated, async (req, res) => {
    const alerts = (await storage.listByPartition("alerts", req.user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const products = await storage.getManyByRowKeys("products", alerts.map((a) => a.productId));
    res.json({ data: alerts.map((a) => publicAlert(a, products.find((p) => p.rowKey === a.productId))) });
  });
  // tipo "estoque" (padrão): só itens esgotados. tipo "preco": avisa quando ficar abaixo do preço de hoje.
  r.post("/alerts", authenticated, async (req, res) => {
    const p = await product(req.body.productId ?? "");
    const tipo = req.body.tipo === undefined ? "estoque" : req.body.tipo;
    if (!["estoque", "preco"].includes(tipo)) throw new AppError(400, "Tipo de aviso inválido.", "tipo");
    if (tipo === "estoque" && p.estoque > 0) throw new AppError(409, "Este produto já está disponível. Aproveite para adicioná-lo ao carrinho.");
    const key = alertKey(req.user.id, p.rowKey, tipo);
    const existing = await storage.get("alerts", req.user.id, key);
    if (existing && !existing.notifiedAt) return res.json({ data: publicAlert(existing, p) });
    const alert = {
      partitionKey: req.user.id,
      rowKey: key,
      productId: p.rowKey,
      customerId: req.user.id,
      ...(tipo === "preco" ? { tipo, priceCents: p.priceCents } : {}),
      createdAt: new Date().toISOString(),
      notifiedAt: null,
    };
    if (existing) await storage.save("alerts", alert, existing.etag);
    else await storage.create("alerts", alert);
    res.status(201).json({ data: publicAlert(alert, p) });
  });
  r.delete("/alerts/:productId", authenticated, async (req, res) => {
    await storage.remove("alerts", req.user.id, alertKey(req.user.id, String(req.params.productId), req.query.tipo === "preco" ? "preco" : "estoque"));
    res.json({ data: { ok: true } });
  });
  // Assistente de compras (PLN local): só para quem está logado, com limite por usuário.
  const assistantLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 40,
    // Cliente logado conta pelo ID; visitante, pelo endereço de rede.
    keyGenerator: (req) => (req.user ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip || "")}`),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: { message: "Muitas mensagens seguidas. Aguarde alguns minutos e tente de novo." } }),
  });
  // Assistente aberto a visitantes: a sessão é opcional; pedidos, histórico e trocas pedem login.
  const optionalUser = async (req, _res, next) => {
    try {
      req.user = (await sessionUser(storage, config, req.cookies.vv_session)) || null;
    } catch {
      req.user = null;
    }
    next();
  };
  const geminiSlot = config.gemini ? limiter(config.gemini.perMinute) : () => false;
  r.post("/assistente", optionalUser, assistantLimit, async (req, res) => {
    const mensagem = text(req.body?.mensagem, "mensagem", 1, 500);
    const contexto = req.body?.contexto;
    if (contexto !== undefined && JSON.stringify(contexto).length > 4000)
      throw new AppError(400, "Contexto da conversa muito grande.", "contexto");
    // Página atual, carrinho e favoritos vêm do navegador (só IDs); o assistente revalida tudo.
    const { pagina, carrinho, favoritos } = req.body || {};
    if (JSON.stringify({ pagina, carrinho, favoritos }).length > 8000) throw new AppError(400, "Dados da página muito grandes.");
    const products = (await storage.list("products")).filter((p) => p.ativo).map(publicProduct);
    const orders = async () => (req.user ? (await storage.listByPartition("orders", req.user.id)).map(publicOrder) : []);
    const alerts = async () => (req.user ? storage.listByPartition("alerts", req.user.id) : []);
    let answer = await reply({ mensagem, contexto, pagina, carrinho, favoritos }, { products, orders, alerts, user: req.user });
    if (!answer.entendeu) {
      await logMiss(storage, mensagem).catch(() => {});
      // Só o que a PLN local não entendeu vai ao Gemini (sem nome, e-mail ou pedido).
      const extra = config.gemini && geminiSlot() ? await askGemini(mensagem, products, config.gemini, { fetchImpl: config.geminiFetch }) : null;
      if (extra)
        answer = {
          ...answer,
          texto: extra.texto,
          cards: extra.produtos.map((id) => assistantCard(products.find((p) => p.id === id))),
          intencao: "gemini",
          entendeu: true,
          fonte: "gemini",
        };
    }
    res.json({ data: answer });
  });
  // Notificações da conta: últimas 30 e contagem de não lidas.
  r.get("/notifications", authenticated, async (req, res) =>
    res.set("Cache-Control", "no-store").json({ data: await listNotifications(storage, req.user.id) }),
  );
  r.post("/notifications/read", authenticated, async (req, res) =>
    res.json({ data: { naoLidas: await markRead(storage, req.user.id, req.body?.ids) } }),
  );
  r.get("/products", async (req, res) => {
    let products = (await storage.list("products"))
      .filter((p) => p.ativo)
      .map(publicProduct);
    for (const key of ["marca", "modelo", "categoria"])
      if (req.query[key])
        products = products.filter((p) =>
          p[key].toLowerCase().includes(String(req.query[key]).toLowerCase()),
        );
    if (req.query.q)
      products = products.filter((p) =>
        `${p.marca} ${p.modelo} ${p.descricao} ${specText(p)}`
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
    res.json({ data: products });
  });
  r.get("/products/:id", async (req, res) =>
    res.json({ data: publicProduct(await product(req.params.id)) }),
  );
  // Perguntas e respostas do produto: públicas só as respondidas; perguntar exige conta.
  const questionLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { message: "Muitas perguntas seguidas. Tente de novo mais tarde." } }),
  });
  r.get("/products/:id/questions", async (req, res) => {
    const p = await product(req.params.id);
    res.set("Cache-Control", "no-store").json({ data: await answeredQuestions(storage, p.rowKey) });
  });
  r.post("/products/:id/questions", authenticated, questionLimit, async (req, res) => {
    const p = await product(req.params.id);
    res.status(201).json({ data: publicQuestion(await askQuestion(storage, req.user, p, req.body)) });
  });
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
  // Cotação pública: mesmo cálculo do pedido, sem gravar nada.
  r.post("/checkout/quote", async (req, res) => {
    const items = calculate(
      req.body.items,
      await storage.getManyByRowKeys("products", itemIds(req.body.items)),
    );
    const totals = quote(items, { entrega: req.body.entrega || "padrao", cupom: req.body.cupom });
    res.json({
      data: {
        ...totals,
        items: items.map((i) => ({ ...i, totalCents: i.priceCents * i.quantidade })),
        entregas: deliveryOptions(totals.subtotalCents),
      },
    });
  });
  r.get("/orders", authenticated, async (req, res) =>
    res.json({
      data: (await storage.listByPartition("orders", req.user.id)).map(publicOrder),
    }),
  );
  // Um pedido do próprio cliente (comprovante); de outro cliente responde 404.
  r.get("/orders/:id", authenticated, async (req, res) => {
    const order = await storage.getByRowKey("orders", String(req.params.id));
    if (!order || order.partitionKey !== req.user.id) throw new AppError(404, "Pedido não encontrado.");
    res.set("Cache-Control", "no-store").json({ data: { ...publicOrder(order), prazoTroca: exchangeWindow(order) } });
  });
  // Troca ou devolução pedida pelo cliente no comprovante.
  r.post("/orders/:id/troca", authenticated, limited, async (req, res) =>
    res.status(201).json({ data: publicOrder(await requestExchange(storage, req.user, req.params.id, req.body)) }),
  );
  r.post("/orders", authenticated, async (req, res) =>
    res.status(201).json({
      data: publicOrder(await placeOrder(storage, req.user, req.body)),
    }),
  );
  // Cliente cancela o próprio pedido enquanto ainda está "Recebido".
  r.post("/orders/:id/cancel", authenticated, async (req, res) =>
    res.json({
      data: publicOrder(
        await updateOrderStatus(storage, req.params.id, "Cancelado", {
          customerId: req.user.id,
          onlyFrom: ["Recebido"],
        }),
      ),
    }),
  );
  r.use("/admin", authenticated, admin);
  r.get("/admin/summary", async (_req, res) => {
    const [p, c, o] = await Promise.all(
      ["products", "customers", "orders"].map((t) => storage.list(t)),
    );
    // Procura por itens esgotados: avisos "Avise-me" ainda pendentes, por produto.
    const procura = [...(await demandByProduct(storage))]
      .map(([id, avisos]) => {
        const item = p.find((x) => x.rowKey === id && x.ativo);
        return item && { id, nome: `${item.marca} ${item.modelo}`, estoque: item.estoque, avisos };
      })
      .filter(Boolean)
      .sort((a, b) => b.avisos - a.avisos);
    // Interesse em preço: avisos de queda de preço ativos, por produto.
    const precoAvisos = [...(await priceWatchers(storage))]
      .map(([id, avisos]) => {
        const item = p.find((x) => x.rowKey === id && x.ativo);
        return item && { id, nome: `${item.marca} ${item.modelo}`, priceCents: item.priceCents, avisos };
      })
      .filter(Boolean)
      .sort((a, b) => b.avisos - a.avisos);
    const perguntasPendentes = (await storage.list("questions")).filter((q) => q.status === "pendente").length;
    res.json({ data: { ...summary(p, c, o), procura, precoAvisos, perguntasPendentes } });
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
        const apply = async (scoped) => {
          await scoped.save("products", next, p.etag);
          // Reposição de item esgotado notifica quem pediu "Avise-me", na mesma transação.
          if (p.estoque === 0 && next.estoque > 0) await restockAlerts(scoped, next);
          // Preço menor que o registrado no aviso de queda de preço também notifica.
          if (next.priceCents < p.priceCents) await priceDropAlerts(scoped, next);
        };
        await (storage.transaction ? storage.transaction(apply) : apply(storage));
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
  r.get("/admin/questions", async (_req, res) => {
    const [questions, products] = await Promise.all([storage.list("questions"), storage.list("products")]);
    const order = { pendente: 0, respondida: 1, oculta: 2 };
    res.json({
      data: questions
        .sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt))
        .map((q) => adminQuestion(q, products.find((p) => p.rowKey === q.productId))),
    });
  });
  r.patch("/admin/questions/:id", async (req, res) => {
    const found = await storage.getByRowKey("questions", String(req.params.id));
    const p = found && (await storage.getByRowKey("products", found.productId));
    res.json({ data: adminQuestion(await moderateQuestion(storage, req.params.id, req.body, p), p) });
  });
  r.get("/admin/assistente", async (_req, res) => res.json({ data: await missSummary(storage) }));
  r.delete("/admin/assistente", async (_req, res) => {
    await clearMisses(storage);
    res.json({ data: { ok: true } });
  });
  r.get("/admin/orders", async (_req, res) =>
    res.json({ data: (await storage.list("orders")).map(publicOrder) }),
  );
  r.patch("/admin/orders/:id/troca", async (req, res) =>
    res.json({ data: publicOrder(await answerExchange(storage, req.params.id, req.body)) }),
  );
  r.patch("/admin/orders/:id", async (req, res) =>
    res.json({
      data: publicOrder(await updateOrderStatus(storage, req.params.id, req.body.status, { notify: true })),
    }),
  );
  return r;
}
