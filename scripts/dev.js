// Desenvolvimento (etapa 39): recompila o frontend React a cada alteração (vite build --watch)
// e reinicia o servidor quando o código do backend muda. Acesse http://localhost:3000.
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
const vite = run("npx", ["vite", "build", "--watch", "--mode", "development"]);
const server = run("node", ["--watch-path=src", "--watch-path=shared", "src/server.js"]);
const stop = () => {
  vite.kill();
  server.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
