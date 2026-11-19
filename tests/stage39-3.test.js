// Etapa 39.3: carrinho, checkout, pedido, minha conta, login e cadastro em React.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import heads from "./helpers/heads.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const built = existsSync(new URL("dist/login.html", root));
const pages = { carrinho: "Cart", checkout: "Checkout", pedido: "Order", "minha-conta": "Account", login: "Login", cadastro: "Register" };
const privatePages = ["checkout", "pedido", "minha-conta"];

test("39.3: cada página tem HTML com #root, entrada, componente e registro no pré-render", async () => {
  const registry = await read("web/src/pages/index.ts");
  for (const [name, component] of Object.entries(pages)) {
    const html = await read(`web/${name}.html`);
    const legacy = Object.values(heads[name]).filter(Boolean).join("\n");
    assert.match(html, /<div id="root"><\/div>/, name);
    assert.match(html, new RegExp(`<script type="module" src="/src/entries/${name}\\.tsx"></script>`), name);
    assert.match(html, /<script src="\/js\/theme-init\.js"><\/script>/, name);
    assert.doesNotMatch(html, /\/js\/app\.js|modulepreload|rel="stylesheet"/, name);
    // Mesmo título, robots e classe do <body> da página anterior.
    assert.equal(html.match(/<title>[^<]*<\/title>/)[0], legacy.match(/<title>[^<]*<\/title>/)[0], name);
    assert.equal(html.match(/<body[^>]*>/)[0], legacy.match(/<body[^>]*>/)[0], name);
    assert.equal(/name="robots" content="noindex"/.test(html), /name="robots" content="noindex"/.test(legacy), name);
    const entry = await read(`web/src/entries/${name}.tsx`);
    assert.match(entry, new RegExp(`import ${component} from "\\.\\./pages/${component}";`), name);
    assert.match(entry, new RegExp(`mount\\(${component}\\)`), name);
    assert.ok(existsSync(new URL(`web/src/pages/${component}.tsx`, root)), component);
    assert.match(registry, new RegExp(`(?:\\b|")${name}"?: ${component},`), name);
  }
  // Etapa 39.5: as páginas antigas saíram de public/; as regras usadas pelos testes estão em shared/.
  for (const name of Object.keys(pages)) assert.ok(!existsSync(new URL(`public/${name}.html`, root)), name);
  const account = await import("../shared/account.js");
  assert.equal(account.routeFromHash("#seguranca").view, "dados");
});

test("39.3: páginas privadas tratam sessão (carregando, login com next seguro, falha ao verificar)", async () => {
  const priv = await read("web/src/components/Private.tsx");
  assert.match(priv, /Não foi possível verificar sua sessão/);
  assert.match(priv, /\/login\.html\?next=/);
  assert.match(priv, /safeNext/);
  for (const name of privatePages) assert.match(await read(`web/src/pages/${pages[name]}.tsx`), /<Private\b/, name);
  const form = await read("web/src/components/Form.tsx");
  for (const text of ["Aguarde…", "aria-invalid", "aria-describedby", "field-error", "fieldMessage"]) assert.ok(form.includes(text), text);
  const auth = await read("web/src/pages/Auth.tsx");
  for (const text of ["Informe seu nome completo, com pelo menos 2 letras.", "Informe um e-mail válido, como nome@exemplo.com.", "Mostrar senha", "safeNext"]) assert.ok(auth.includes(text), text);
});

test("39.3: servidor entrega login e carrinho pré-renderizados; robots continua bloqueando as privadas", { skip: !built && "rode npm run build" }, async (t) => {
  const server = createApp(new MemoryStorage(), { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/login.html`).then((r) => r.text());
  assert.match(login, /<div id="root">(?:<link [^>]+>)?<div id="header">/);
  assert.match(login, /<body class="page-auth">/);
  assert.match(login, /<form id="login-form"/);
  assert.match(login, /Conecte-se ao seu som\./);
  assert.match(login, /href="\/cadastro\.html">Cadastre-se<\/a>/);
  assert.doesNotMatch(login, /\/js\/app\.js/);
  const cadastro = await fetch(`${base}/cadastro.html`).then((r) => r.text());
  assert.match(cadastro, /<form id="register-form"/);
  assert.match(cadastro, /class="strength"/);
  const cart = await fetch(`${base}/carrinho.html`).then((r) => r.text());
  assert.match(cart, /<h1 class="page-title">Seu próximo setup\.<\/h1>/);
  assert.match(cart, /<div id="cart-content" class="loading">Carregando carrinho…<\/div>/);
  assert.doesNotMatch(cart, /\/js\/app\.js/);
  // Páginas privadas: só o estado de carregamento no HTML inicial (nada da conta de ninguém).
  const account = await fetch(`${base}/minha-conta.html`).then((r) => r.text());
  assert.match(account, /Carregando sua conta…/);
  assert.doesNotMatch(account, /id="profile-form"/);
  const order = await fetch(`${base}/pedido.html?id=x`).then((r) => r.text());
  assert.match(order, /<div id="order-content" aria-busy="true">/);
  const checkout = await fetch(`${base}/checkout.html`).then((r) => r.text());
  assert.match(checkout, /Carregando pedido…/);
  const robots = await fetch(`${base}/robots.txt`).then((r) => r.text());
  for (const page of ["checkout", "minha-conta", "pedido", "carrinho"]) assert.match(robots, new RegExp(`Disallow: /${page}\\.html`), page);
});
