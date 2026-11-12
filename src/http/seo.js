// SEO no servidor: página do produto e do catálogo por categoria saem com título,
// descrição, Open Graph, link canônico e dados estruturados já no HTML, para buscadores e
// prévias de link (WhatsApp, redes sociais), que não executam o JavaScript da página.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { compress, encoding } from "./static.js";
import { publicProduct } from "../controllers/serialization.js";
import { specRows } from "../../public/js/specs.js";

const html = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const brl = (cents) => (cents / 100).toFixed(2);
export const categoryText = {
  Guitarras: "Guitarras elétricas Strat, Tele, Les Paul, SG, semiacústicas e modelos modernos, filtradas por estilo, captação e nível.",
  Pedais: "Pedais de overdrive, distorção, fuzz, delay, reverb, modulação, pedaleiras e pedalboards.",
  Amplificadores: "Amplificadores valvulados, transistorizados e de modelagem digital para estudo, ensaio, estúdio e palco.",
  Cabos: "Cabos de instrumento e patch P10, retos e em L, para ligar guitarra, pedais e amplificador.",
  Correias: "Correias de nylon, couro, tecido e algodão, lisas e estampadas.",
  Acessórios: "Encordoamentos, palhetas, afinadores, capotrastes, suportes, fontes e kits de limpeza.",
};

// Substitui título, descrição e Open Graph do modelo e acrescenta canônico e JSON-LD.
export function withMeta(template, { title, description, url, image, type = "website", jsonld }) {
  const desc = description.replace(/\s+/g, " ").trim().slice(0, 160);
  const extra = [
    `<link rel="canonical" href="${html(url)}" />`,
    `<meta property="og:url" content="${html(url)}" />`,
    image ? `<meta property="og:image" content="${html(image)}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${html(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${html(desc)}" />`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${html(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${html(desc)}" />\n    ${extra}`);
}

export function productMeta(p, base) {
  const name = `${p.marca} ${p.modelo}`;
  const url = `${base}/produto.html?id=${encodeURIComponent(p.id)}`;
  const image = `${base}${p.imageUrl && p.blobName ? p.imageUrl : "/icons/icon-512.png"}`;
  const specs = specRows(p)
    .filter((r) => !["generos"].includes(r.field.key))
    .slice(0, 4)
    .map((r) => `${r.field.label}: ${r.text}`)
    .join(" · ");
  return {
    title: `${name} | Violet Voltage`,
    description: `${name} por R$ ${brl(p.priceCents).replace(".", ",")}. ${p.descricao}${specs ? ` ${specs}.` : ""}`,
    url,
    image,
    type: "product",
    jsonld: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description: p.descricao,
        sku: p.id,
        category: p.categoria,
        brand: { "@type": "Brand", name: p.marca },
        image,
        additionalProperty: specRows(p).map((r) => ({ "@type": "PropertyValue", name: r.field.label, value: r.text })),
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "BRL",
          price: brl(p.priceCents),
          availability: `https://schema.org/${p.estoque > 0 ? "InStock" : "OutOfStock"}`,
          itemCondition: "https://schema.org/NewCondition",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: p.categoria, item: `${base}/catalogo.html?categoria=${encodeURIComponent(p.categoria)}` },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
    ],
  };
}

export function seoPages(storage, publicDir, origin) {
  const templates = new Map();
  const template = async (name) => {
    const file = path.join(publicDir, name);
    const info = await stat(file);
    const cached = templates.get(name);
    if (cached?.mtime === info.mtimeMs) return cached.text;
    const text = await readFile(file, "utf8");
    templates.set(name, { mtime: info.mtimeMs, text });
    return text;
  };
  const send = (req, res, body) => {
    const enc = encoding(req);
    res.set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", Vary: "Accept-Encoding" });
    if (!enc) return res.send(body);
    res.set("Content-Encoding", enc);
    res.end(compress(Buffer.from(body), enc, { dynamic: true }));
  };
  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    try {
      const base = origin(req);
      // Início: endereços absolutos nos dados estruturados da loja.
      if ((req.path === "/" || req.path === "/index.html") && base) {
        const page = (await template("index.html"))
          .replace('"url":"/"', `"url":"${base}/"`)
          .replace('"url":"/"', `"url":"${base}/"`)
          .replace('"logo":"/icons/', `"logo":"${base}/icons/`)
          .replace('"target":"/catalogo.html', `"target":"${base}/catalogo.html`)
          .replace('<meta property="og:type" content="website" />', `<meta property="og:type" content="website" />\n    <link rel="canonical" href="${html(base)}/" />\n    <meta property="og:url" content="${html(base)}/" />\n    <meta property="og:image" content="${html(base)}/icons/icon-512.png" />`);
        return send(req, res, page);
      }
      if (req.path === "/produto.html" && typeof req.query.id === "string") {
        const found = await storage.getByRowKey("products", req.query.id);
        if (!found?.ativo) return next();
        return send(req, res, withMeta(await template("produto.html"), productMeta(publicProduct(found), base)));
      }
      if (req.path === "/catalogo.html" && typeof req.query.categoria === "string" && categoryText[req.query.categoria] && Object.keys(req.query).length === 1) {
        const c = req.query.categoria;
        return send(
          req,
          res,
          withMeta(await template("catalogo.html"), {
            title: `${c} | Violet Voltage`,
            description: `${categoryText[c]} Frete grátis acima de R$ 999 e até 10x sem juros.`,
            url: `${base}/catalogo.html?categoria=${encodeURIComponent(c)}`,
          }),
        );
      }
    } catch {
      // Sem a versão do servidor, a página estática continua funcionando (o script completa os dados).
    }
    next();
  };
}
