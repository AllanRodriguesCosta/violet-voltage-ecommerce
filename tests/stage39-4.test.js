// Etapa 39.4: montador de setup, kits, encomenda, parceiros e guias em React.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { seedProducts } from "../src/services/seed-products.js";
import { guides } from "../src/knowledge/guides.js";
import { glossary, glossaryId } from "../src/knowledge/glossary.js";
import { PRODUCTS } from "../shared/partners.js";
import heads from "./helpers/heads.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/guias.html", root));
const PAGES = { setup: "Setup", kits: "Kits", encomenda: "Request", parceiros: "Partners", guias: "Guides" };

test("39.4: cada página tem HTML com #root, entrada, componente registrado e o mesmo SEO da página antiga", async () => {
  const registry = await read("web/src/pages/index.ts");
  for (const [name, component] of Object.entries(PAGES)) {
    const html = await read(`web/${name}.html`);
    assert.match(html, /<div id="root"><\/div>/, name);
    assert.match(html, new RegExp(`<script type="module" src="/src/entries/${name}\\.tsx"></script>`), name);
    assert.match(html, /<script src="\/js\/theme-init\.js"><\/script>/, name);
    assert.doesNotMatch(html, /\/js\/app\.js|rel="stylesheet"|modulepreload/, name);
    const entry = await read(`web/src/entries/${name}.tsx`);
    assert.match(entry, new RegExp(`import ${component} from "\\.\\./pages/${component}";`), name);
    assert.match(entry, new RegExp(`mount\\(${component}\\)`), name);
    assert.match(registry, new RegExp(`\\b${name}: ${component},`), name);
    // Título e descrição iguais aos da página antiga (retrato em tests/helpers/heads.json).
    const legacy = Object.values(heads[name]).filter(Boolean).join("\n");
    for (const re of [/<title>[^<]+<\/title>/, /<meta name="description" content="[^"]+" \/>/]) assert.equal(html.match(re)?.[0], legacy.match(re)?.[0], `${name}: ${re}`);
  }
});

test("39.4: formulários usam o FormKit (mensagens em português, Aguarde… e erro do servidor no campo)", async () => {
  const kit = await read("web/src/components/FormKit.tsx");
  assert.match(kit, /fieldMessage/);
  assert.match(kit, /Aguarde…/);
  assert.match(kit, /aria-describedby/);
  assert.match(kit, /error-\$\{name\}/);
  for (const page of ["Request", "Partners"]) assert.match(await read(`web/src/pages/${page}.tsx`), /useFormKit/, page);
  const request = await read("web/src/pages/Request.tsx");
  assert.match(request, /from "\.\.\/\.\.\/\.\.\/shared\/request\.js"/, "fromQuery compartilhado");
  assert.match(request, /\/login\.html\?next=/);
  const partners = await read("web/src/pages/Partners.tsx");
  assert.match(partners, /validCnpj/);
  assert.match(partners, /maskCnpj/);
});

test("39.4: servidor entrega HTML pré-renderizado de guias, parceiros, kits, encomenda e montador", { skip: !built && "rode npm run build" }, async (t) => {
  const storage = new MemoryStorage();
  const now = new Date().toISOString();
  for (const source of seedProducts.slice(0, 3)) {
    const data = { ...source };
    delete data.file;
    await storage.create("products", { ...data, partitionKey: "p", ativo: true, blobName: "", imageUrl: "", createdAt: now, updatedAt: now });
  }
  const server = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = async (path) => {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<div id="root">(?:<link [^>]+>)?<div id="header">/, `${path}: HTML inicial com o cabeçalho`);
    assert.doesNotMatch(html, /\/js\/app\.js/, `${path}: página do build, não a antiga`);
    return html.replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  };

  // Guias: conteúdo inteiro no HTML (buscadores e Agent_generator), com âncoras e glossário.
  const guias = await page("/guias.html");
  for (const g of guides) {
    assert.ok(guias.includes(`id="${g.id}"`), g.id);
    assert.ok(guias.includes(`<h2 id="guide-${g.id}-title">${g.titulo}</h2>`), g.titulo);
    assert.ok(guias.includes(`<a href="#${g.id}">${g.titulo}</a>`), `índice: ${g.id}`);
    for (const [title] of g.secoes) assert.ok(guias.includes(`<h3>${title}</h3>`), title);
    for (const [label, href] of g.links) assert.ok(guias.includes(`href="${href}">${label}</a>`), href);
  }
  assert.match(guias, new RegExp(`${glossary.length} termos da ficha técnica`));
  for (const term of glossary) {
    assert.ok(guias.includes(`id="${glossaryId(term.termo)}"`), term.termo);
    assert.ok(guias.includes(`<dt>${term.termo}</dt>`), term.termo);
  }
  assert.match(guias, /<input id="glossary-q" type="search"/);

  // Parceiros: ficha completa no HTML, com os campos e os tipos de produto.
  const parceiros = await page("/parceiros.html");
  assert.match(parceiros, /<form id="partner-form">/);
  for (const name of ["razaoSocial", "nomeFantasia", "cnpj", "modalidade", "site", "marcas", "contatoNome", "cargo", "email", "telefone", "mensagem", "website", "aceite"])
    assert.match(parceiros, new RegExp(`name="${name}"`), name);
  assert.match(parceiros, /placeholder="00\.000\.000\/0000-00"/);
  for (const p of PRODUCTS) assert.ok(parceiros.includes(`value="${p}"`), p);
  assert.match(parceiros, /<button type="submit">Enviar ficha<\/button>/);

  // Kits: cabeçalho e área dos kits (o catálogo carrega no navegador).
  const kits = await page("/kits.html");
  assert.match(kits, /Tudo combinando, por menos\./);
  assert.match(kits, /<div class="setup-grid kits-grid" id="kits-grid"><div class="loading" role="status">Carregando kits…<\/div><\/div>/);

  // Encomenda: formulário aberto a todos; o aviso de login e "Minhas encomendas" dependem da sessão.
  const encomenda = await page("/encomenda.html");
  assert.match(encomenda, /<form id="request-form">/);
  assert.match(encomenda, /<input type="radio" name="tipo" checked="" value="personalizado"\/>/);
  assert.match(encomenda, /id="request-login-note" hidden=""/);
  assert.match(encomenda, /<section class="panel" id="minhas" aria-labelledby="mine-title" hidden=""/);

  // Montador: etapas e estilos musicais no HTML; as opções aparecem depois do catálogo.
  const setup = await page("/setup.html");
  assert.match(setup, /Do primeiro acorde ao palco\./);
  for (const step of ["Guitarra", "Amplificador", "Efeitos", "Cabos", "Correia", "Acessórios"]) assert.ok(setup.includes(`<strong>${step}</strong>`), step);
  assert.match(setup, /<option value="" selected="">Todos os estilos<\/option><option>Blues<\/option>/);
  assert.match(setup, /<aside class="setup-bar" id="setup-bar" aria-label="Resumo do setup" hidden="">/);
});
