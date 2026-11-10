import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

// Cache por tipo de arquivo: HTML, CSS, JS, manifesto e service worker revalidam a
// cada visita (uma nova publicação aparece na hora; sem mudança, a resposta é 304);
// fonte e imagens ficam guardadas por mais tempo.
export function cacheControl(file) {
  if (/\.(?:html|css|js|webmanifest)$/i.test(file)) return "no-cache";
  if (/\.woff2$/i.test(file)) return "public, max-age=2592000";
  if (/\.(?:svg|png|jpe?g|webp|ico)$/i.test(file)) return "public, max-age=604800";
  return "public, max-age=3600";
}
// Brotli quando aceito, senão gzip; ignora codificações com q=0.
export function encoding(req) {
  const accepted = new Map(
    String(req.get("accept-encoding") || "")
      .split(",")
      .map((part) => part.trim().split(/\s*;\s*q=/i))
      .filter(([name]) => name)
      .map(([name, q]) => [name.toLowerCase(), q === undefined ? 1 : Number(q)]),
  );
  for (const name of ["br", "gzip"]) if (accepted.get(name) > 0) return name;
  return null;
}
export function compress(buffer, enc, { dynamic = false } = {}) {
  return enc === "br"
    ? brotliCompressSync(buffer, {
        params: { [constants.BROTLI_PARAM_QUALITY]: dynamic ? 4 : 11, [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length },
      })
    : gzipSync(buffer, { level: dynamic ? 6 : 9 });
}

const TEXT = /\.(?:html|css|js|svg|json|webmanifest|txt|xml)$/i;
// Arquivos de texto de public/ comprimidos uma vez por versão (tamanho e data).
export function compressedStatic(root) {
  const cache = new Map();
  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const enc = encoding(req);
    let pathname;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    if (!enc || !TEXT.test(pathname) || pathname.split("/").some((segment) => segment.startsWith("."))) return next();
    const file = path.join(root, pathname);
    if (!file.startsWith(root + path.sep)) return next();
    let info;
    try {
      info = await stat(file);
    } catch {
      return next();
    }
    if (!info.isFile()) return next();
    const version = `${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}`;
    const key = `${file}|${version}|${enc}`;
    let body = cache.get(key);
    if (!body) {
      body = compress(await readFile(file), enc);
      cache.set(key, body);
    }
    res.type(path.extname(file));
    res.set({
      "Content-Encoding": enc,
      Vary: "Accept-Encoding",
      "Cache-Control": cacheControl(file),
      ETag: `W/"${version}-${enc}"`,
      "Last-Modified": info.mtime.toUTCString(),
    });
    if (req.fresh) return res.status(304).end();
    res.set("Content-Length", String(body.length));
    if (req.method === "HEAD") return res.end();
    res.end(body);
  };
}
// Respostas JSON da API a partir de 1 KB saem comprimidas quando o navegador aceita.
export function compressJson(req, res, next) {
  const enc = encoding(req);
  if (!enc) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    const text = Buffer.from(JSON.stringify(body));
    if (text.length < 1024) return json(body);
    res.set({ "Content-Type": "application/json; charset=utf-8", "Content-Encoding": enc, Vary: "Accept-Encoding" });
    return res.send(compress(text, enc, { dynamic: true }));
  };
  next();
}
