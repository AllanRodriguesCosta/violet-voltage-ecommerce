import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { MemoryStorage } from "../src/repositories/memory.js";
import { PostgresStorage } from "../src/repositories/postgres.js";
import { createApp } from "../src/app.js";
import { configuration, instanceName, trustProxy } from "../src/config/index.js";
import { runCatalogSync } from "../src/services/catalog-sync.js";
import { healthUrl, tally, report, instanceOf } from "../scripts/lb-check.js";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const memoryEnv = { DEV_MEMORY_STORAGE: "true" };

async function serve(t, config) {
  const server = createApp(new MemoryStorage(), { memory: true, production: false, secret: "x".repeat(48), ...config }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("nome da instância: INSTANCE_NAME, App Service ou hostname, sempre limpo", () => {
  assert.equal(instanceName({ INSTANCE_NAME: "vv-vm-2" }), "vv-vm-2");
  assert.equal(instanceName({ WEBSITE_INSTANCE_ID: "a1b2c3d4e5f6a7b8c9" }), "app-a1b2c3d4");
  assert.equal(instanceName({ INSTANCE_NAME: "vv vm<1>\"" }), "vvvm1");
  assert.equal(instanceName({ INSTANCE_NAME: "x".repeat(80) }).length, 40);
  assert.equal(instanceName({}), hostname().replace(/[^a-z0-9.-]/gi, "").slice(0, 40) || "instancia");
  assert.equal(configuration({ ...memoryEnv, INSTANCE_NAME: "a1" }).instanceName, "a1");
  assert.equal(configuration(memoryEnv).instanceHeader, true);
  assert.equal(configuration({ ...memoryEnv, INSTANCE_HEADER: "off" }).instanceHeader, false);
});

test("TRUST_PROXY: padrão 1 em produção e 0 fora; aceita 0 a 5", () => {
  assert.equal(trustProxy(undefined, true), 1);
  assert.equal(trustProxy("", false), 0);
  assert.equal(trustProxy("0", true), 0);
  assert.equal(trustProxy("2", false), 2);
  for (const bad of ["-1", "6", "1.5", "sim"]) assert.throws(() => trustProxy(bad, true), /TRUST_PROXY/);
  assert.equal(configuration({ ...memoryEnv, TRUST_PROXY: "0" }).trustProxy, 0);
});

test("/api/health informa a instância, sem cache, e o cabeçalho X-Served-By vai em todas as respostas", async (t) => {
  const base = await serve(t, { instanceName: "vv-vm-1", instanceHeader: true });
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-served-by"), "vv-vm-1");
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal((await health.json()).data.instancia, "vv-vm-1");
  const page = await fetch(`${base}/`);
  assert.equal(page.headers.get("x-served-by"), "vv-vm-1");
  const missing = await fetch(`${base}/api/nao-existe`);
  assert.equal(missing.headers.get("x-served-by"), "vv-vm-1");
});

test("INSTANCE_HEADER=off tira o cabeçalho, mas o health continua dizendo a instância", async (t) => {
  const base = await serve(t, { instanceName: "app-1", instanceHeader: false });
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.headers.get("x-served-by"), null);
  assert.equal((await health.json()).data.instancia, "app-1");
});

test("trust proxy: com 0 o IP do X-Forwarded-For é ignorado; padrão de produção continua 1", () => {
  const app0 = createApp(new MemoryStorage(), { memory: true, production: true, secret: "x".repeat(48), trustProxy: 0 });
  assert.ok(!app0.get("trust proxy"));
  const app1 = createApp(new MemoryStorage(), { memory: true, production: true, secret: "x".repeat(48) });
  assert.equal(app1.get("trust proxy"), 1);
  const dev = createApp(new MemoryStorage(), { memory: true, production: false, secret: "x".repeat(48) });
  assert.ok(!dev.get("trust proxy"));
});

// Pool falso: registra as consultas e responde à trava conforme "livre".
function fakePool(livre) {
  const log = [];
  const client = {
    query: async (sql, params) => {
      log.push(params ? `${sql} ${JSON.stringify(params)}` : sql);
      if (/pg_try_advisory_xact_lock/.test(sql)) return { rows: [{ ok: livre }] };
      return { rows: [] };
    },
    release: (broken) => log.push(`release:${broken ? "descartada" : "ok"}`),
  };
  return { log, pool: { connect: async () => client, on() {} } };
}

test("trava entre instâncias (PostgreSQL): livre roda e confirma; ocupada pula sem esperar", async () => {
  const free = fakePool(true);
  const storage = new PostgresStorage({}, free.pool);
  let ran = 0;
  assert.deepEqual(await storage.withLock("catalog-sync", async () => ++ran), { acquired: true, result: 1 });
  assert.match(free.log[1], /pg_try_advisory_xact_lock\(hashtext\(\$1\)\).*"violet_voltage:catalog-sync"/);
  assert.deepEqual([free.log[0], free.log.at(-2), free.log.at(-1)], ["BEGIN", "COMMIT", "release:ok"]);

  const busy = fakePool(false);
  const other = new PostgresStorage({}, busy.pool);
  assert.deepEqual(await other.withLock("catalog-sync", async () => ++ran), { acquired: false });
  assert.equal(ran, 1);
  assert.deepEqual(busy.log.slice(-2), ["ROLLBACK", "release:ok"]);

  const failing = fakePool(true);
  await assert.rejects(new PostgresStorage({}, failing.pool).withLock("x", async () => {
    throw new Error("falhou");
  }), /falhou/);
  assert.deepEqual(failing.log.slice(-2), ["ROLLBACK", "release:ok"]);
});

test("sincronização de fotos: memória sempre sincroniza; outra instância com a trava faz esta pular", async () => {
  const message = await runCatalogSync(new MemoryStorage(), { directory: "/caminho/que/nao/existe" });
  assert.match(message, /^Fotos do catálogo: 0 produtos cadastrados/);
  const storage = new MemoryStorage();
  storage.withLock = async () => ({ acquired: false });
  assert.match(await runCatalogSync(storage), /outra instância já está sincronizando/);
});

test("migração: instâncias subindo juntas esperam a trava dentro da transação", async () => {
  const sql = await text("migrations/001-postgres.sql");
  const lines = sql.split("\n").filter((l) => l.trim() && !l.startsWith("--"));
  assert.equal(lines[0], "BEGIN;");
  assert.match(lines[1], /^SELECT pg_advisory_xact_lock\(hashtext\('violet_voltage:migracao'\)\);$/);
});

test("lb-check: endereço, contagem por instância e veredito", () => {
  assert.equal(healthUrl("http://20.1.2.3"), "http://20.1.2.3/api/health");
  assert.equal(healthUrl("https://vv.azurewebsites.net/loja"), "https://vv.azurewebsites.net/api/health");
  assert.throws(() => healthUrl("ftp://x"), /http/);
  assert.equal(instanceOf({ status: 200, header: "vv-vm-1", raw: "" }), "vv-vm-1");
  assert.equal(instanceOf({ status: 200, header: undefined, raw: '{"data":{"instancia":"app-1"}}' }), "app-1");
  assert.equal(instanceOf({ status: 503, header: "vv-vm-1", raw: "" }), "falha-503");
  const entries = tally(["a", "b", "a", "falha-503"]);
  assert.deepEqual(entries, [["a", 2], ["b", 1], ["falha-503", 1]]);
  assert.match(report(entries, 4), /Balanceamento OK: 2 instâncias/);
  assert.match(report(tally(["a", "a"]), 2), /Só uma instância respondeu/);
  assert.match(report(tally(["falha-ECONNREFUSED"]), 1), /Nenhuma instância respondeu/);
});

test("Dockerfile: Node 24, só dependências de produção, usuário sem privilégio, health check", async () => {
  const docker = await text("Dockerfile");
  assert.match(docker, /^FROM node:24-alpine$/m);
  assert.match(docker, /npm ci --omit=dev/);
  assert.match(docker, /^USER node$/m);
  assert.match(docker, /HEALTHCHECK[\s\S]*\/api\/health/);
  assert.match(docker, /CMD \["node", "src\/server.js"\]/);
  const ignore = (await text(".dockerignore")).split("\n");
  for (const entry of [".env", "node_modules", ".git", "seed-assets/produtos-violet-voltage", "infra"]) assert.ok(ignore.includes(entry), entry);
  assert.ok(!ignore.includes("seed-assets"), "as fotos versionadas entram na imagem (sincronização do catálogo)");
});

test("roteiros do Azure: sintaxe bash válida, variáveis fora do git e nenhum segredo no repositório", async () => {
  const dir = new URL("infra/azure/", root);
  const scripts = (await readdir(dir)).filter((f) => f.endsWith(".sh"));
  assert.deepEqual(scripts.sort(), ["apagar-tudo.sh", "app-service.sh", "atualizar-vms.sh", "comum.sh", "vms-load-balancer.sh"]);
  for (const file of scripts) {
    const result = spawnSync("bash", ["-n", new URL(file, dir).pathname]);
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    const body = await text(`infra/azure/${file}`);
    assert.match(body, /set -euo pipefail/, file);
    assert.doesNotMatch(body, /postgres(ql)?:\/\/[^\s"'*]+:[^\s"'*]+@/, `${file} não pode ter senha de banco`);
  }
  assert.match(await text(".gitignore"), /^infra\/azure\/variaveis\.env$/m);
  const example = await text("infra/azure/variaveis.env.example");
  for (const key of ["DATABASE_URL", "JWT_SECRET", "APP_NAME", "INSTANCES", "VM_SIZE", "LOCATION"]) assert.match(example, new RegExp(`^${key}=`, "m"));
  assert.match(example, /^DATABASE_URL=$/m);
  assert.match(example, /^JWT_SECRET=$/m);
});

test("roteiros do Azure: mesmo segredo em todas as instâncias, sonda no /api/health e limpeza com confirmação", async () => {
  const common = await text("infra/azure/comum.sh");
  assert.match(common, /JWT_SECRET/);
  assert.match(common, /\[2-5\]/, "balanceador exige 2 a 5 instâncias");
  const vms = await text("infra/azure/vms-load-balancer.sh");
  assert.match(vms, /lb probe create[\s\S]*--protocol Http --port 80 --path \/api\/health/);
  assert.match(vms, /--sku Standard/);
  assert.match(vms, /outbound-rule create/);
  assert.match(vms, /--public-ip-address ""/, "VMs sem IP público");
  assert.match(vms, /TRUST_PROXY=0/);
  assert.match(vms, /INSTANCE_NAME="\\\$\(hostname\)"/, "hostname resolvido na VM, não no Cloud Shell");
  const app = await text("infra/azure/app-service.sh");
  assert.match(app, /--number-of-workers "\$INSTANCES"/);
  assert.match(app, /healthCheckPath": "\/api\/health/);
  assert.match(app, /--client-affinity-enabled false/);
  const teardown = await text("infra/azure/apagar-tudo.sh");
  assert.match(teardown, /read -r -p/);
  assert.match(teardown, /az group delete -n "\$RG"/);
  assert.match(await text("package.json"), /"azure:lb-check": "node scripts\/lb-check.js"/);
});
