// Service worker da Violet Voltage: rede primeiro, para cada publicação aparecer na hora.
// Sem conexão, usa a última cópia guardada da página ou do arquivo; páginas nunca
// abertas mostram /offline.html. A API não passa por aqui.
// O CSS vem do build (dist/app/*.css, nome com hash): na instalação, os arquivos citados por
// /offline.html também são guardados, para a página sem conexão aparecer com o visual da loja.
const CACHE = "vv-v2";
const CORE = ["/offline.html", "/js/theme-init.js", "/fonts/geist-latin.woff2", "/assets/favicon.svg", "/icons/icon-192.png"];
async function install() {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  const page = await (await cache.match("/offline.html")).text();
  const assets = [...page.matchAll(/(?:href|src)="(\/app\/[^"]+\.(?:css|js))"/g)].map((m) => m[1]);
  await cache.addAll([...new Set(assets)]);
}
self.addEventListener("install", (event) => {
  event.waitUntil(install().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
const keep = /\.(?:css|js|woff2|svg|png|webmanifest)$/;
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const page = request.mode === "navigate";
  if (!page && !keep.test(url.pathname)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          // Páginas são guardadas sem a query: uma cópia por página, não por produto ou busca.
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(page ? url.origin + url.pathname : request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request, { ignoreSearch: page })) || (page ? caches.match("/offline.html") : Response.error())),
  );
});
