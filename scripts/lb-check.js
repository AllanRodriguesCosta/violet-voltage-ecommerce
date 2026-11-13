// Etapa 31: mostra o balanceamento funcionando. Faz N pedidos ao /api/health do endereço informado
// e conta qual instância respondeu (cabeçalho X-Served-By ou campo "instancia").
// Uso: npm run azure:lb-check -- http://IP-DO-BALANCEADOR [quantidade]
import { pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";

// Conexão nova a cada pedido (agent: false), para o balanceador escolher a instância de novo.
function getOnce(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { agent: false, timeout: 8000, headers: { "cache-control": "no-store" } }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (raw.length < 65536) raw += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, header: res.headers["x-served-by"], raw }));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" })));
    req.on("error", reject);
  });
}

export function instanceOf({ status, header, raw }) {
  if (status < 200 || status >= 300) return `falha-${status}`;
  if (header) return String(header);
  try {
    return JSON.parse(raw)?.data?.instancia || "sem-nome";
  } catch {
    return "sem-nome";
  }
}

export function healthUrl(base) {
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use um endereço http:// ou https://.");
  return new URL("/api/health", url).href;
}

export function tally(responses) {
  const counts = new Map();
  for (const r of responses) counts.set(r, (counts.get(r) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function report(entries, total) {
  const lines = entries.map(([name, n]) => `  ${String(name).padEnd(24)} ${String(n).padStart(4)}  (${Math.round((n / total) * 100)}%)`);
  const servers = entries.filter(([name]) => !String(name).startsWith("falha")).length;
  lines.push(
    servers > 1
      ? `Balanceamento OK: ${servers} instâncias responderam.`
      : servers === 1
        ? "Só uma instância respondeu. Confira se as outras estão saudáveis no portal (health probe) e se o App Service tem afinidade de sessão (ARR) desligada."
        : "Nenhuma instância respondeu. Confira o endereço e se a loja já terminou de subir.",
  );
  return lines.join("\n");
}

async function main() {
  const [base, amount = "20"] = process.argv.slice(2);
  if (!base) {
    console.error("Uso: npm run azure:lb-check -- http://IP-DO-BALANCEADOR [quantidade]");
    process.exitCode = 1;
    return;
  }
  const url = healthUrl(base);
  const total = Math.min(Math.max(Number(amount) || 20, 1), 500);
  const answers = [];
  for (let i = 0; i < total; i++) {
    try {
      answers.push(instanceOf(await getOnce(url)));
    } catch (error) {
      answers.push(`falha-${error.code || "rede"}`);
    }
  }
  console.log(`${total} pedidos a ${url}:`);
  console.log(report(tally(answers), total));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
