// Etapa 32: balanceador de carga local, sem Docker e sem instalar nada.
// Sobe N cópias da loja (portas 3001, 3002...) e um balanceador em http://localhost:8080 que
// distribui cada pedido em rodízio (round-robin) entre as instâncias saudáveis.
// Uso: npm run lb:local -- [--instancias 3] [--porta 8080] [--memoria]
// Com o terminal aberto, digite: status | parar 2 | iniciar 2 | sair
import "dotenv/config";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function parseOptions(argv = []) {
  const options = { instances: 3, port: 8080, firstPort: 3001, memory: false, interval: 2000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`Falta o valor de ${arg}.`);
      return next;
    };
    if (arg === "--instancias" || arg === "-n") options.instances = Number(value());
    else if (arg === "--porta" || arg === "-p") options.port = Number(value());
    else if (arg === "--porta-inicial") options.firstPort = Number(value());
    else if (arg === "--memoria") options.memory = true;
    else if (arg === "--intervalo") options.interval = Number(value());
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!Number.isInteger(options.instances) || options.instances < 1 || options.instances > 8)
    throw new Error("--instancias deve ser um número de 1 a 8.");
  for (const key of ["port", "firstPort"])
    if (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > 65535)
      throw new Error("Porta inválida.");
  if (!Number.isInteger(options.interval) || options.interval < 200) throw new Error("--intervalo mínimo: 200 ms.");
  return options;
}

// Próxima instância saudável depois do cursor (rodízio). -1 se nenhuma estiver saudável.
export function nextHealthy(backends, cursor, skip = new Set()) {
  for (let step = 1; step <= backends.length; step++) {
    const index = (cursor + step) % backends.length;
    if (backends[index].healthy && !skip.has(index)) return index;
  }
  return -1;
}

function forwardHeaders(req, backend) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(name)) headers[name] = value;
  const client = req.socket.remoteAddress || "";
  headers["x-forwarded-for"] = req.headers["x-forwarded-for"] ? `${req.headers["x-forwarded-for"]}, ${client}` : client;
  headers["x-forwarded-proto"] = "http";
  headers["x-forwarded-host"] = req.headers.host || "";
  headers.host = `127.0.0.1:${backend.port}`;
  return headers;
}

// Balanceador HTTP: escolhe a instância por pedido; se a conexão com ela falhar antes de qualquer
// resposta, marca como fora do ar e tenta outra (só para GET/HEAD, que podem ser repetidos).
export function createBalancer(backends, { interval = 2000, failuresToDown = 2, log = () => {} } = {}) {
  let cursor = -1;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
  for (const b of backends) Object.assign(b, { healthy: b.healthy ?? false, failures: 0, served: b.served || 0 });

  const setHealth = (backend, healthy, reason) => {
    if (backend.healthy !== healthy) log(`${backend.name}: ${healthy ? "SAUDÁVEL, entra no rodízio" : `FORA DO AR (${reason}), sai do rodízio`}`);
    backend.healthy = healthy;
    backend.failures = healthy ? 0 : backend.failures;
  };

  function probe(backend) {
    return new Promise((resolve) => {
      const req = http.get(
        { host: "127.0.0.1", port: backend.port, path: "/api/health", timeout: 1500, agent: false },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode === 200 ? null : `health ${res.statusCode}`));
        },
      );
      req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
      req.on("error", (error) => resolve(error.code || error.message));
    }).then((problem) => {
      if (!problem) return setHealth(backend, true);
      backend.failures += 1;
      if (backend.failures >= failuresToDown || !backend.healthy) setHealth(backend, false, problem);
    });
  }
  const checkAll = () => Promise.all(backends.map(probe));

  function unavailable(res) {
    if (res.headersSent) return res.destroy();
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "retry-after": "5", "x-balanceador": "vv-lb-local" });
    res.end("Nenhuma instância da loja está saudável no momento. Tente de novo em alguns segundos.\n");
  }

  function handle(req, res, tried = new Set()) {
    const index = nextHealthy(backends, cursor, tried);
    if (index === -1) return unavailable(res);
    cursor = index;
    const backend = backends[index];
    const upstream = http.request(
      { host: "127.0.0.1", port: backend.port, method: req.method, path: req.url, headers: forwardHeaders(req, backend), agent },
      (answer) => {
        backend.served += 1;
        const headers = {};
        for (const [name, value] of Object.entries(answer.headers)) if (!HOP_BY_HOP.has(name)) headers[name] = value;
        headers["x-balanceador"] = "vv-lb-local";
        res.writeHead(answer.statusCode, headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      if (res.headersSent) return res.destroy();
      setHealth(backend, false, error.code || "erro de conexão");
      tried.add(index);
      if (req.method === "GET" || req.method === "HEAD") return handle(req, res, tried);
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "x-balanceador": "vv-lb-local" });
      res.end("A instância caiu durante o pedido. Tente de novo.\n");
    });
    if (req.method === "GET" || req.method === "HEAD") upstream.end();
    else req.pipe(upstream);
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/__balanceador") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      return res.end(JSON.stringify({ instancias: status() }));
    }
    handle(req, res);
  });
  let timer;
  const status = () => backends.map(({ name, port, healthy, served }) => ({ name, port, healthy, served }));
  return {
    server,
    checkAll,
    status,
    start(port, host = "0.0.0.0") {
      timer = setInterval(checkAll, interval);
      timer.unref();
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));
    },
    stop() {
      clearInterval(timer);
      agent.destroy();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

// Variáveis de cada cópia da loja. O JWT_SECRET é o mesmo em todas: login feito numa vale nas outras.
export function instanceEnv(base, { index, port, memory, secret }) {
  const env = { ...base, PORT: String(port), INSTANCE_NAME: `local-${index + 1}`, TRUST_PROXY: "1", JWT_SECRET: secret };
  if (memory) {
    env.DEV_MEMORY_STORAGE = "true";
    if (env.NODE_ENV === "production") env.NODE_ENV = "development";
  }
  return env;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const memory = options.memory || process.env.DEV_MEMORY_STORAGE === "true" || !process.env.DATABASE_URL;
  const secret = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : randomBytes(48).toString("hex");
  const log = (message) => console.log(`[balanceador] ${message}`);
  const backends = Array.from({ length: options.instances }, (_, index) => ({
    index,
    name: `local-${index + 1}`,
    port: options.firstPort + index,
    child: null,
  }));

  const startInstance = (backend) => {
    if (backend.child) return log(`${backend.name} já está rodando.`);
    const env = instanceEnv(process.env, { index: backend.index, port: backend.port, memory, secret });
    const child = spawn(process.execPath, ["src/server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    backend.child = child;
    const prefix = (stream) =>
      createInterface({ input: stream }).on("line", (line) => console.log(`[${backend.name}] ${line}`));
    prefix(child.stdout);
    prefix(child.stderr);
    child.on("exit", (code, signal) => {
      backend.child = null;
      log(`${backend.name} encerrada (${signal || `código ${code}`}).`);
    });
  };
  const stopInstance = (backend) => {
    if (!backend.child) return log(`${backend.name} já está parada.`);
    log(`parando ${backend.name} (simula a queda de um servidor)...`);
    backend.child.kill("SIGTERM");
  };

  console.log(
    memory
      ? "Modo MEMÓRIA: cada instância tem os próprios dados (cadastros e pedidos não aparecem nas outras).\n" +
          "  Isso é ótimo para mostrar POR QUE um balanceador precisa de banco compartilhado.\n" +
          "  Para todas usarem o mesmo banco, preencha DATABASE_URL no .env (ou use infra/local com Docker)."
      : "Modo BANCO COMPARTILHADO: todas as instâncias usam a DATABASE_URL do .env.",
  );
  backends.forEach(startInstance);
  const balancer = createBalancer(backends, { interval: options.interval, log });
  const port = await balancer.start(options.port);
  log(`ouvindo em http://localhost:${port}  (instâncias nas portas ${backends.map((b) => b.port).join(", ")})`);
  log(`teste: npm run azure:lb-check -- http://localhost:${port} 30`);
  log("comandos: status | parar N | iniciar N | sair");

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    log("encerrando tudo...");
    for (const b of backends) b.child?.kill("SIGTERM");
    await balancer.stop();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (process.stdin.isTTY || process.env.LB_LOCAL_COMANDOS === "on")
    createInterface({ input: process.stdin }).on("line", (line) => {
      const [command, number] = line.trim().toLowerCase().split(/\s+/);
      const backend = backends[Number(number) - 1];
      if (command === "status")
        for (const s of balancer.status())
          console.log(`  ${s.name.padEnd(10)} porta ${s.port}  ${s.healthy ? "saudável " : "fora do ar"}  ${s.served} pedidos`);
      else if ((command === "parar" || command === "iniciar") && !backend) log(`use um número de 1 a ${backends.length}.`);
      else if (command === "parar") stopInstance(backend);
      else if (command === "iniciar") startInstance(backend);
      else if (command === "sair") shutdown();
      else if (command) log("comandos: status | parar N | iniciar N | sair");
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    await main();
  } catch (error) {
    console.error(`[balanceador] ${error.message}`);
    process.exitCode = 1;
  }
}
