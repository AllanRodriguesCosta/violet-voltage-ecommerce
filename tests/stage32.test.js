import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { createBalancer, nextHealthy, parseOptions, instanceEnv } from "../scripts/lb-local.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";
import { MemoryStorage } from "../src/repositories/memory.js";

// Servidor falso que responde com o próprio nome, como a loja faz no X-Served-By.
function fakeInstance(name) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json", "x-served-by": name });
      res.end(JSON.stringify({ name, method: req.method, body, xff: req.headers["x-forwarded-for"] || "" }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

function request(port, { method = "GET", path = "/api/health", body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, agent: false }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, raw }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("opções do balanceador local têm padrão e validação", () => {
  assert.deepEqual(parseOptions([]), { instances: 3, port: 8080, firstPort: 3001, memory: false, interval: 2000 });
  assert.equal(parseOptions(["--instancias", "2", "--memoria"]).instances, 2);
  assert.equal(parseOptions(["-p", "9000"]).port, 9000);
  assert.throws(() => parseOptions(["--instancias", "0"]), /1 a 8/);
  assert.throws(() => parseOptions(["--porta"]), /Falta o valor/);
  assert.throws(() => parseOptions(["--xyz"]), /desconhecida/);
});

test("rodízio pula instâncias fora do ar", () => {
  const b = [{ healthy: true }, { healthy: false }, { healthy: true }];
  assert.equal(nextHealthy(b, -1), 0);
  assert.equal(nextHealthy(b, 0), 2);
  assert.equal(nextHealthy(b, 2), 0);
  assert.equal(nextHealthy(b, 0, new Set([2])), 0);
  assert.equal(nextHealthy([{ healthy: false }], 0), -1);
});

test("cada instância recebe o mesmo JWT_SECRET e nome próprio", () => {
  const a = instanceEnv({ NODE_ENV: "production" }, { index: 0, port: 3001, memory: true, secret: "s".repeat(40) });
  const b = instanceEnv({}, { index: 1, port: 3002, memory: false, secret: "s".repeat(40) });
  assert.equal(a.JWT_SECRET, b.JWT_SECRET);
  assert.equal(a.INSTANCE_NAME, "local-1");
  assert.equal(b.PORT, "3002");
  assert.equal(a.DEV_MEMORY_STORAGE, "true");
  assert.equal(a.NODE_ENV, "development");
  assert.equal(b.DEV_MEMORY_STORAGE, undefined);
  assert.equal(a.TRUST_PROXY, "1");
});

test("balanceador distribui, repassa POST e contorna instância que caiu", async () => {
  const one = await fakeInstance("vv-a");
  const two = await fakeInstance("vv-b");
  const backends = [
    { name: "vv-a", port: one.port },
    { name: "vv-b", port: two.port },
  ];
  const logs = [];
  const lb = createBalancer(backends, { interval: 60_000, log: (m) => logs.push(m) });
  const port = await lb.start(0, "127.0.0.1");
  try {
    let answer = await request(port);
    assert.equal(answer.status, 503, "antes da primeira checagem ninguém está no rodízio");
    await lb.checkAll();
    const names = [];
    for (let i = 0; i < 4; i++) names.push((await request(port)).headers["x-served-by"]);
    assert.deepEqual(names, ["vv-a", "vv-b", "vv-a", "vv-b"]);

    answer = await request(port, { method: "POST", path: "/api/login", body: '{"x":1}' });
    const posted = JSON.parse(answer.raw);
    assert.equal(posted.method, "POST");
    assert.equal(posted.body, '{"x":1}');
    assert.match(posted.xff, /127\.0\.0\.1/);
    assert.equal(answer.headers["x-balanceador"], "vv-lb-local");

    // Derruba vv-b sem avisar: o próximo GET que cairia nela é refeito em vv-a.
    two.server.closeAllConnections();
    await new Promise((r) => two.server.close(r));
    for (let i = 0; i < 3; i++) assert.equal((await request(port)).headers["x-served-by"], "vv-a");
    assert.ok(logs.some((m) => /vv-b: FORA DO AR/.test(m)));
    const status = JSON.parse((await request(port, { path: "/__balanceador" })).raw).instancias;
    assert.equal(status.find((s) => s.name === "vv-b").healthy, false);
  } finally {
    await lb.stop();
    one.server.closeAllConnections();
    await new Promise((r) => one.server.close(r));
  }
});

test("admin é criado uma vez, dentro da trava, mesmo com instâncias simultâneas", async () => {
  const storage = new MemoryStorage();
  await storage.init?.();
  const locks = [];
  const original = storage.withLock.bind(storage);
  storage.withLock = (name, work) => (locks.push(name), original(name, work));
  const env = { ADMIN_EMAIL: "admin@exemplo.com", ADMIN_PASSWORD: "SenhaForte#2026", ADMIN_NAME: "Admin" };
  await bootstrapAdmin(storage, env);
  await bootstrapAdmin(storage, env);
  assert.deepEqual(locks, ["admin-bootstrap", "admin-bootstrap"]);
  const admins = (await storage.list("customers")).filter((c) => c.role === "admin");
  assert.equal(admins.length, 1);
});

test("docker compose local: 3 cópias, banco compartilhado e Nginx com nova tentativa", () => {
  const compose = readFileSync(new URL("../infra/local/docker-compose.yml", import.meta.url), "utf8");
  const nginx = readFileSync(new URL("../infra/local/nginx.conf", import.meta.url), "utf8");
  assert.match(compose, /replicas: 3/);
  assert.match(compose, /DATABASE_URL: postgres:\/\/vv:[^@]+@db:5432/);
  assert.match(compose, /"8080:80"/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(nginx, /server app:3000 resolve/);
  assert.match(nginx, /proxy_next_upstream error timeout http_502 http_503/);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["lb:local"], "node scripts/lb-local.js");
});
