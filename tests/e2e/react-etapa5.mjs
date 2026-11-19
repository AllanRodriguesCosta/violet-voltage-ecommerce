// Etapa 39.5: roteiro de navegador dos recursos globais em React (minicarrinho e aviso com o
// produto voando até o carrinho, sugestões da busca, barra de comparação, visualização rápida,
// aviso de preço, assistente, contador de notificações) e das páginas ajuda, termos, privacidade,
// 404, offline e painel. Falha se algum passo falhar ou houver erro no console (inclusive
// divergência de hidratação); confere também telas de 375 px sem rolagem lateral.
// Uso: node scripts/e2e-server.js  e  BASE=http://127.0.0.1:4173 [SHOTS=pasta] node tests/e2e/react-etapa5.mjs
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ADMIN = { email: "admin@e2e.test", senha: "e2e-admin-senha-2026" };
const results = [];
const problems = [];
const check = (name, ok, extra = "") => results.push({ name, ok: Boolean(ok), extra });
const watch = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" && !/\b(400|401|404|409|422|429)\b/.test(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
};
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }) : null);
const cartCount = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("vv_cart") || "[]").reduce((s, i) => s + i.quantidade, 0));
const visible = (page, selector) => page.locator(selector).first().isVisible();

// Cliente com um pedido (pela API), para o painel mudar o status e gerar uma notificação.
async function customerWithOrder(productId) {
  const email = `etapa5${Date.now()}@example.test`;
  const senha = "senha-etapa5-12345";
  const json = { "Content-Type": "application/json" };
  const reg = await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: json, body: JSON.stringify({ nome: "Cliente Etapa Cinco", email, senha }) });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
  const order = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { ...json, cookie },
    body: JSON.stringify({ requestId: randomUUID(), items: [{ id: productId, quantidade: 1 }], entrega: "retirada", pagamento: "pix", endereco: "Retirada na loja" }),
  });
  return { email, senha, order: (await order.json()).data };
}
async function login(page, { email, senha }, next) {
  await page.goto(`${BASE}/login.html?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await Promise.all([page.waitForURL((url) => url.pathname === next.split(/[?#]/)[0]), page.click("#login-form button[type=submit]")]);
}

const browser = await chromium.launch();
try {
  const products = (await (await fetch(BASE + "/api/products")).json()).data;
  const inStock = products.filter((p) => p.estoque > 3);
  const guitar = inStock.find((p) => p.categoria === "Guitarras");

  // 1. Minicarrinho: aviso depois da animação até o carrinho (com movimento), quantidade e remoção.
  const moving = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await moving.newPage();
  watch(page);
  await page.goto(BASE + "/catalogo.html", { waitUntil: "networkidle" });
  await page.waitForSelector(".product-card .add-button");
  const firstCard = page.locator(".product-card:not(.is-out)").first();
  const flew = page.waitForSelector(".fly-ghost", { state: "attached", timeout: 3000 }).then(() => true, () => false);
  await firstCard.locator(".add-button").click();
  check("carrinho: produto voa até o ícone do carrinho", await flew);
  await page.waitForSelector(".cart-notice:not([hidden])", { timeout: 5000 });
  check("carrinho: animação termina (cópia removida)", (await page.locator(".fly-ghost").count()) === 0);
  check("aviso: adicionado ao carrinho", /Adicionado ao carrinho/.test(await page.textContent(".cart-notice")) && /Ver carrinho \(1\)/.test(await page.textContent(".cart-notice [data-notice-cart]")));
  check("aviso: leitor de tela anuncia", /adicionado ao carrinho\. 1 item no carrinho/.test(await page.textContent("p.sr-only[role=status]")));
  check("cabeçalho: contador do carrinho", (await page.textContent(".site-header .cart-link .count")) === "1");
  await shot(page, "01-aviso-carrinho");
  await page.click(".cart-notice [data-notice-cart]");
  await page.waitForSelector("#cart-drawer[open] .drawer-item");
  check("minicarrinho: abre pelo aviso", (await page.locator("#cart-drawer .drawer-item").count()) === 1 && /\(1 item\)/.test(await page.textContent("#cart-drawer-title")));
  check("minicarrinho: frete grátis e subtotal", (await page.locator("#cart-drawer .ship-progress").count()) === 1 && /Subtotal/.test(await page.textContent("#cart-drawer .drawer-footer")));
  await page.click('#cart-drawer [data-step="1"]');
  await page.waitForFunction(() => document.querySelector("#cart-drawer .drawer-item output")?.textContent === "2");
  check("minicarrinho: aumentar quantidade", (await cartCount(page)) === 2 && /\(2 itens\)/.test(await page.textContent("#cart-drawer-title")));
  await page.click('#cart-drawer [data-step="-1"]');
  await page.waitForFunction(() => document.querySelector("#cart-drawer .drawer-item output")?.textContent === "1");
  check("minicarrinho: diminuir quantidade", (await cartCount(page)) === 1);
  await shot(page, "02-minicarrinho");
  await page.click("#cart-drawer [data-remove]");
  await page.waitForSelector("#cart-drawer .drawer-empty");
  check("minicarrinho: remover deixa vazio", (await cartCount(page)) === 0 && /Seu carrinho está vazio/.test(await page.textContent("#cart-drawer")));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#cart-drawer")?.open);
  check("minicarrinho: Esc fecha", true);
  // O aviso fica fora do diálogo modal: o "Desfazer" é usado depois de fechar o minicarrinho.
  await page.click("#toast .toast-action");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("vv_cart") || "[]").length === 1);
  check("minicarrinho: desfazer remoção", (await cartCount(page)) === 1 && (await page.textContent(".site-header .cart-link .count")) === "1");
  await page.click(".site-header .cart-link");
  await page.waitForSelector("#cart-drawer[open]");
  check("minicarrinho: ícone do carrinho abre", true);
  await page.click("#cart-drawer [data-drawer-close]");
  await page.waitForFunction(() => !document.querySelector("#cart-drawer")?.open);

  // 2. Busca: sugestões com teclado e buscas recentes.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  watch(p);
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.fill("#header-q", "strato");
  await p.waitForSelector("#header-suggestions:not([hidden]) [role=option]");
  check("busca: sugestões aparecem", (await p.locator("#header-suggestions [role=option]").count()) >= 2 && (await p.getAttribute("#header-q", "aria-expanded")) === "true");
  await p.keyboard.press("ArrowDown");
  const active = await p.getAttribute("#header-q", "aria-activedescendant");
  check("busca: seta para baixo marca a opção", active === "header-suggestions-p0" && (await p.getAttribute(`#${active}`, "aria-selected")) === "true", active);
  await p.keyboard.press("ArrowUp");
  check("busca: seta para cima volta ao fim da lista", (await p.getAttribute("#header-q", "aria-activedescendant")) === "header-suggestions-all");
  await shot(p, "03-sugestoes");
  await p.keyboard.press("Escape");
  check("busca: Esc fecha as sugestões", await p.locator("#header-suggestions").isHidden());
  await p.keyboard.press("ArrowDown");
  await p.fill("#header-q", "stratoc");
  await p.waitForSelector("#header-suggestions:not([hidden]) #header-suggestions-p0");
  await p.keyboard.press("ArrowDown");
  await Promise.all([p.waitForURL(/produto\.html\?id=/), p.keyboard.press("Enter")]);
  check("busca: Enter abre a opção escolhida", true);
  await p.waitForLoadState("networkidle");
  await p.click("#header-q");
  await p.waitForSelector("#header-suggestions:not([hidden]) .suggestion-heading");
  check("busca: buscas recentes com o campo vazio", /Buscas recentes/.test(await p.textContent("#header-suggestions")) && /stratoc/.test(await p.textContent("#header-suggestions")));
  await p.click("#header-suggestions [data-clear-searches]");
  check("busca: limpar buscas recentes", (await p.evaluate(() => localStorage.getItem("vv_searches"))) === null && (await p.locator("#header-suggestions").isHidden()));
  await p.fill("#header-q", "amplificaor");
  await p.waitForSelector("#header-suggestions:not([hidden]) .suggestion-fix");
  check("busca: você quis dizer", /amplificador/.test(await p.textContent("#header-suggestions .suggestion-fix")));
  await p.keyboard.press("Escape");

  // 3. Barra de comparação.
  await p.goto(BASE + "/catalogo.html", { waitUntil: "networkidle" });
  await p.waitForSelector(".product-card .compare-toggle");
  await p.locator(".product-card .compare-toggle").nth(0).click();
  await p.waitForSelector(".compare-tray:not([hidden])");
  check("comparar: barra com 1 produto pede mais um", /1 de 4/.test(await p.textContent(".compare-tray")) && (await p.getAttribute(".compare-tray a.button", "aria-disabled")) === "true");
  await p.click(".compare-tray a.button", { force: true }); // aria-disabled: o Playwright não clica sem force
  check("comparar: aviso de mínimo de 2", /pelo menos 2 produtos/.test(await p.textContent("#toast")) && p.url().endsWith("/catalogo.html"));
  await p.locator(".product-card .compare-toggle").nth(1).click();
  await p.waitForFunction(() => /2 de 4/.test(document.querySelector(".compare-tray")?.textContent || ""));
  await p.waitForFunction(() => document.querySelectorAll(".compare-tray .compare-thumbs img").length === 2);
  check("comparar: barra com 2 miniaturas e corpo marcado", (await p.evaluate(() => document.body.classList.contains("has-compare-tray"))) && (await p.getAttribute(".compare-tray a.button", "aria-disabled")) === null);
  await shot(p, "04-comparar");
  await p.click(".compare-tray [data-compare-clear]");
  await p.waitForSelector(".compare-tray", { state: "hidden" });
  check("comparar: limpar esconde a barra", !(await p.evaluate(() => document.body.classList.contains("has-compare-tray"))));

  // 4. Visualização rápida: quantidade e adicionar ao carrinho.
  await p.evaluate(() => localStorage.removeItem("vv_cart"));
  await p.reload({ waitUntil: "networkidle" });
  const quick = p.locator(".product-card:not(.is-out) .quick-button").first();
  await quick.click();
  await p.waitForSelector("dialog.quick-view[open] #qv-title");
  check("visualização rápida: abre com o produto", (await p.textContent("#qv-title")).length > 1 && /Em estoque|Últimas unidades/.test(await p.textContent(".quick-view .stock-pill")));
  await p.click('.quick-view [data-qty="1"]');
  check("visualização rápida: quantidade", (await p.inputValue('.quick-view input[name="quantidade"]')) === "2");
  await shot(p, "05-visualizacao-rapida");
  await p.click(".quick-view form.qv-buy button[type=submit]");
  await p.waitForFunction(() => !document.querySelector("dialog.quick-view")?.open);
  check("visualização rápida: adiciona e fecha", (await cartCount(p)) === 2);
  await p.waitForSelector(".cart-notice:not([hidden])");
  check("visualização rápida: aviso de item adicionado", /2 ×/.test(await p.textContent(".cart-notice")));
  check("visualização rápida: foco volta ao botão", await p.evaluate(() => document.activeElement?.classList.contains("quick-button")));

  // 5. Aviso de preço sem login: pede para entrar.
  await p.goto(`${BASE}/produto.html?id=${guitar.id}`, { waitUntil: "networkidle" });
  await p.click(".price-alert-button");
  await p.waitForFunction(() => /Entre na sua conta/.test(document.querySelector("#toast")?.textContent || ""));
  check("aviso de preço: sem login pede para entrar", /Entrar/.test(await p.textContent("#toast .toast-action")));

  // 6. Assistente: conversa, cartões, sugestões, carrinho, login pedido, persistência e Esc.
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => {
    localStorage.removeItem("vv_cart");
    sessionStorage.removeItem("vv_assistente");
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.click(".assistant-launcher");
  await p.waitForSelector("#assistant-panel:not([hidden]) .msg-bot");
  check("assistente: abre com saudação e sugestões", (await p.getAttribute(".assistant-launcher", "aria-expanded")) === "true" && (await p.locator("#assistant-panel .assistant-chips .chip").count()) >= 3);
  check("assistente: foco no campo", await p.evaluate(() => document.activeElement?.id === "assistant-input"));
  await p.fill("#assistant-input", "quero uma guitarra para rock até 3000");
  await p.press("#assistant-input", "Enter");
  await p.waitForFunction(() => document.querySelectorAll("#assistant-panel .msg-bot .assistant-card").length > 0, null, { timeout: 15000 });
  check("assistente: cartões de produto", (await p.locator("#assistant-panel .msg-user").count()) === 1 && (await p.locator("#assistant-panel .assistant-card").count()) >= 1);
  check("assistente: sugestões da resposta", (await p.locator("#assistant-panel .assistant-chips .chip").count()) >= 1);
  await shot(p, "06-assistente");
  await p.locator("#assistant-panel [data-assistant-add]:not([disabled])").first().click();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem("vv_cart") || "[]").length === 1);
  check("assistente: adiciona ao carrinho", (await cartCount(p)) === 1);
  const messages = await p.locator("#assistant-panel .msg").count();
  await p.fill("#assistant-input", "onde está meu pedido?");
  await p.press("#assistant-input", "Enter");
  await p.waitForSelector("#assistant-panel [data-assistant-login]", { timeout: 15000 });
  check("assistente: pedido pede login (Entrar e Criar conta)", (await p.locator("#assistant-panel [data-assistant-login]").count()) === 2 && /next=%2F/.test(await p.getAttribute("#assistant-panel a[data-assistant-login]", "href")));
  await p.reload({ waitUntil: "networkidle" });
  await p.click(".assistant-launcher");
  await p.waitForSelector("#assistant-panel:not([hidden]) .msg");
  check("assistente: conversa continua depois de recarregar", (await p.locator("#assistant-panel .msg").count()) === messages + 2);
  await p.press("#assistant-input", "Escape");
  await p.waitForSelector("#assistant-panel", { state: "hidden" });
  check("assistente: Esc fecha e devolve o foco", await p.evaluate(() => document.activeElement?.classList.contains("assistant-launcher")));

  // 7. Central de ajuda: busca, vazio e âncoras.
  await p.goto(BASE + "/ajuda.html", { waitUntil: "networkidle" });
  const total = await p.locator(".faq-item").count();
  await p.fill("#faq-q", "senha");
  await p.waitForFunction(() => /encontrad/.test(document.querySelector("#faq-status")?.textContent || ""));
  const shown = await p.locator(".faq-item:not([hidden])").count();
  check("ajuda: busca filtra e abre as respostas", shown > 0 && shown < total && (await p.locator(".faq-item[open]:not([hidden])").count()) === shown, `${shown}/${total}`);
  await p.fill("#faq-q", "xyzxyz");
  await p.waitForSelector("#faq-empty:not([hidden]) .empty");
  check("ajuda: estado vazio", /Nenhuma resposta com esses termos/.test(await p.textContent("#faq-empty")) && (await p.locator(".faq-group:not([hidden])").count()) === 0);
  await p.fill("#faq-q", "");
  check("ajuda: limpar mostra tudo", (await p.locator(".faq-item:not([hidden])").count()) === total && (await p.locator(".faq-item[open]").count()) === 0);
  await p.goto(BASE + "/ajuda.html#conta-5", { waitUntil: "networkidle" });
  check("ajuda: âncora de pergunta abre a própria", await p.evaluate(() => document.querySelector("#conta-5").open && document.activeElement?.tagName === "SUMMARY"));
  await p.goto(BASE + "/ajuda.html#entregas", { waitUntil: "networkidle" });
  check("ajuda: âncora de grupo abre a primeira", await p.evaluate(() => document.querySelector("#entregas-1").open));
  await shot(p, "07-ajuda");

  // 8. Termos, privacidade, 404 e offline.
  for (const [path, text] of [["/termos.html", "Regras claras para tocar junto."], ["/privacidade.html", "Seus dados, com transparência."]]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path}: conteúdo e índice`, (await p.textContent("h1")) === text && (await p.locator(".legal-toc a").count()) >= 7);
  }
  const missing = await p.goto(BASE + "/nao-existe", { waitUntil: "networkidle" });
  check("404: status e página da loja", missing.status() === 404 && /Essa nota não existe/.test(await p.textContent("h1")) && (await p.locator(".site-header").count()) === 1);
  await shot(p, "08-404");
  const offline = await p.goto(BASE + "/offline.html", { waitUntil: "networkidle" });
  check("offline: servida do build, sem cabeçalho e com o CSS", offline.status() === 200 && /O sinal caiu por aqui/.test(await p.textContent("h1")) && (await p.locator(".site-header").count()) === 0 && (await p.locator('link[rel="stylesheet"]').count()) >= 1);
  const sw = await (await fetch(BASE + "/sw.js")).text();
  const core = JSON.parse(sw.match(/const CORE = (\[[^\]]+\]);/)[1].replace(/'/g, '"'));
  const statuses = await Promise.all(core.map(async (path) => (await fetch(BASE + path)).status));
  check("service worker: arquivos guardados na instalação existem", statuses.every((s) => s === 200), core.join(", "));

  // 9. Painel: indicadores, edição de produto e status de pedido (gera notificação ao cliente).
  const customer = await customerWithOrder(inStock[0].id);
  const adm = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const a = await adm.newPage();
  watch(a);
  await login(a, ADMIN, "/admin.html");
  await a.waitForSelector("#stats .kpis");
  check("painel: indicadores e demanda", (await a.locator("#stats .stat").count()) === 8 && /O que mais procuram/.test(await a.textContent("#stats")) && (await a.locator("#stats svg.sales-chart").count()) === 1);
  await a.waitForSelector("#admin-panel tbody tr");
  const row = a.locator("#admin-panel tbody tr").first();
  await row.locator("[data-edit]").click();
  await a.waitForSelector("#record-form");
  check("painel: edição abre com os dados", (await a.inputValue("#edit-modelo")).length > 0 && (await a.locator("#edit-specs fieldset.admin-specs").count()) === 1);
  await a.fill("#edit-preco", "1234.50");
  await a.fill("#edit-descricao", "");
  await a.click("#record-form button[type=submit]");
  check("painel: validação em português", /Preencha este campo/.test(await a.textContent("#record-form")));
  await a.fill("#edit-descricao", "Descrição atualizada pelo roteiro da etapa 39.5.");
  await a.click("#record-form button[type=submit]");
  await a.waitForSelector("#record-form", { state: "detached" });
  check("painel: produto salvo", /Registro salvo/.test(await a.textContent("#toast")) && /1\.234,50/.test(await a.textContent("#admin-panel tbody")));
  await a.fill("#admin-search", "zzzz-nada");
  check("painel: busca sem resultado", await a.locator("#no-results").isVisible());
  await a.fill("#admin-search", "");
  await shot(a, "09-painel");
  await a.click("#tab-orders");
  await a.waitForSelector(`#order-list [data-order-id="${customer.order.id}"]`);
  check("painel: pedidos com filtros", (await a.locator("#order-chips .chip").count()) === 6 && (await a.getAttribute("#tab-orders", "aria-selected")) === "true");
  await a.selectOption(`#order-list [data-order-id="${customer.order.id}"] [data-status-select]`, "Em preparação");
  await a.waitForFunction((id) => /Em preparação/.test(document.querySelector(`[data-order-id="${id}"] .status`)?.textContent || ""), customer.order.id);
  check("painel: status do pedido alterado", /Status alterado para Em preparação/.test(await a.textContent("#toast")));
  await a.focus("#tab-orders");
  await a.keyboard.press("ArrowRight");
  check("painel: setas trocam de aba", (await a.getAttribute("#tab-questions", "aria-selected")) === "true");
  for (const tab of ["requests", "partners", "coupons", "assistant", "customers"]) {
    await a.click(`#tab-${tab}`);
    await a.waitForSelector("#admin-panel .admin-toolbar");
  }
  check("painel: todas as abas carregam", true);
  check("painel: sem assistente no painel", (await a.locator(".assistant-launcher").count()) === 0);

  // 10. Contador de notificações ao vivo (lida em Minha conta, o sino zera sem recarregar).
  const cli = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const c = await cli.newPage();
  watch(c);
  await login(c, customer, "/minha-conta.html#notificacoes");
  await c.waitForSelector(".notif-link .count");
  check("notificações: sino mostra a não lida", (await c.textContent(".notif-link .count")) === "1" && /1 não lida/.test(await c.getAttribute(".notif-link", "aria-label")));
  await c.waitForSelector("#notifications-read");
  await c.click("#notifications-read");
  await c.waitForSelector(".notif-link .count", { state: "detached" });
  check("notificações: sino e navegação zeram ao marcar como lidas", (await c.getAttribute(".notif-link", "aria-label")) === "Notificações" && (await c.locator('.bottom-nav a[href="/minha-conta.html"] .count').count()) === 0);
  // Aviso de preço com login.
  await c.goto(`${BASE}/produto.html?id=${guitar.id}`, { waitUntil: "networkidle" });
  await c.click(".price-alert-button");
  await c.waitForFunction(() => document.querySelector(".price-alert-button")?.getAttribute("aria-pressed") === "true");
  check("aviso de preço: ativado com login", /Aviso de preço ativado/.test(await c.textContent(".price-alert-button")));
  await c.click(".price-alert-button");
  await c.waitForFunction(() => document.querySelector(".price-alert-button")?.getAttribute("aria-pressed") === "false");
  check("aviso de preço: cancelado", true);

  // 11. Celular: nada de rolagem lateral em nenhuma página.
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce", storageState: await adm.storageState() });
  const m = await mobile.newPage();
  watch(m);
  const pages = ["/", "/catalogo.html", `/produto.html?id=${guitar.id}`, "/comparar.html", "/favoritos.html", "/carrinho.html", "/checkout.html", "/minha-conta.html", "/setup.html", "/kits.html", "/encomenda.html", "/parceiros.html", "/guias.html", "/ajuda.html", "/termos.html", "/privacidade.html", "/nao-existe", "/offline.html", "/admin.html", "/login.html", "/cadastro.html"];
  for (const path of pages) {
    await m.goto(BASE + path, { waitUntil: "networkidle" });
    await m.waitForTimeout(200);
    const wide = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`sem rolagem lateral em ${path} (375 px)`, wide <= 1, `${wide}px`);
  }
  await m.goto(BASE + "/admin.html", { waitUntil: "networkidle" });
  await m.waitForSelector("#stats .kpis");
  await shot(m, "10-painel-celular");
  await m.goto(BASE + "/", { waitUntil: "networkidle" });
  await m.click(".assistant-launcher");
  await m.waitForSelector("#assistant-panel:not([hidden])");
  check("celular: assistente deixa o resto da página inerte", await m.evaluate(() => document.querySelector("#root").inert && document.querySelector("#assistant-panel").getAttribute("aria-modal") === "true"));
  await shot(m, "11-assistente-celular");
  await m.keyboard.press("Escape");
  check("celular: fechar devolve a página", await m.evaluate(() => !document.querySelector("#root").inert));
  check("celular: busca móvel abre", await (async () => {
    await m.click(".search-trigger");
    await m.waitForSelector("#search-dialog[open]");
    return m.evaluate(() => document.activeElement?.id === "dialog-q");
  })());
  await m.keyboard.press("Escape");
  check("celular: Esc fecha a busca móvel", await m.evaluate(() => !document.querySelector("#search-dialog").open));
} catch (error) {
  check("roteiro completo", false, error.message.split("\n").slice(0, 6).join(" | "));
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.extra ? ` — ${r.extra}` : ""}`);
if (problems.length) console.log(`Erros no console:\n${[...new Set(problems)].join("\n")}`);
const failed = results.filter((r) => !r.ok).length + (problems.length ? 1 : 0);
console.log(failed ? `${failed} falha(s).` : `Tudo certo: ${results.length} verificações.`);
process.exit(failed ? 1 : 0);
