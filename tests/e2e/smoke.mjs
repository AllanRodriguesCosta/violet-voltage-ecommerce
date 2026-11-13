// Etapa 35: roteiro de navegador do CI (Playwright). Sobe com `node scripts/e2e-server.js` e
// percorre o caminho principal: busca, produto, carrinho com CEP, cadastro, pedido, assistente,
// painel e telas de celular sem rolagem lateral. Falha (código 1) se algum passo falhar ou se a
// página registrar erro no console.
// Uso: BASE=http://127.0.0.1:4173 node tests/e2e/smoke.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const ADMIN = { email: "admin@e2e.test", senha: "e2e-admin-senha-2026" };
const results = [];
const problems = [];
const check = (name, ok, extra = "") => results.push({ name, ok: Boolean(ok), extra });
const watch = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" && !/\b(400|401|404|409|429)\b/.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
};
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page);
  // 1. Início e busca.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  check("início carrega com o catálogo", (await page.locator(".product-card, [data-product]").count()) > 0);
  await page.goto(BASE + "/catalogo.html?q=stratocaster", { waitUntil: "networkidle" });
  await page.waitForFunction(() => /encontrad/.test(document.querySelector("#catalog-count")?.textContent || ""));
  check("busca acha produtos", !/^0 /.test(await page.textContent("#catalog-count")), await page.textContent("#catalog-count"));
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/catalogo.html?q=theremin", { waitUntil: "networkidle" });
  await page.waitForFunction(() => /encontrad/.test(document.querySelector("#catalog-count")?.textContent || ""));
  await page.waitForTimeout(1600); // registro da busca (espera a digitação parar)
  // 2. Produto e carrinho com CEP.
  const products = (await (await fetch(BASE + "/api/products")).json()).data;
  const item = products.find((p) => p.estoque > 2 && p.priceCents < 60000);
  await page.goto(`${BASE}/produto.html?id=${item.id}`, { waitUntil: "networkidle" });
  await page.click("#add-product button[type=submit]");
  await page.waitForFunction(() => document.querySelector("[data-cart-count]")?.textContent === "1");
  check("produto entra no carrinho", true);
  await page.goto(BASE + "/carrinho.html", { waitUntil: "networkidle" });
  await page.fill("#cart-cep", "69000-000");
  await page.click(".cep-form button[type=submit]");
  await page.waitForFunction(() => /Norte/.test(document.querySelector(".cep-form")?.textContent || ""));
  check("frete pela região do CEP", /R\$\s*40,00/.test(await page.textContent(".ship-estimate")));
  // 3. Cadastro e pedido.
  await page.goto(BASE + "/cadastro.html?next=/checkout.html", { waitUntil: "networkidle" });
  await page.fill("#nome", "Cliente E2E");
  await page.fill("#email", `e2e${Date.now()}@example.test`);
  await page.fill("#senha", "senha-e2e-12345");
  await Promise.all([page.waitForURL(/checkout\.html/), page.click("#register-form button[type=submit]")]);
  await page.waitForSelector("#delivery-options .option-card");
  if (await page.isVisible("#endereco")) {
    await page.fill("#endereco", "Av. Paulista, 1000, Bela Vista, São Paulo - SP, CEP 01310-100");
    await page.waitForFunction(() => /R\$\s*25,00/.test(document.querySelector("#delivery-options")?.textContent || ""), null, { timeout: 8000 });
  }
  await page.click("#checkout-form button[type=submit]");
  await page.waitForSelector(".confirmation", { timeout: 15000 }).catch(async (e) => { if (process.env.E2E_SHOT) await page.screenshot({ path: process.env.E2E_SHOT, fullPage: true }); throw e; });
  check("pedido confirmado", /Pedido confirmado/.test(await page.textContent(".confirmation")));
  // 4. Assistente.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click(".assistant-launcher");
  await page.fill("#assistant-input", "quero uma guitarra para rock até 3 mil");
  await page.press("#assistant-input", "Enter");
  await page.waitForFunction(() => document.querySelectorAll(".msg-bot .assistant-card").length > 0, null, { timeout: 15000 });
  check("assistente recomenda produtos", true);
  // 5. Painel.
  const adm = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const p2 = await adm.newPage();
  watch(p2);
  await p2.goto(BASE + "/login.html?next=/admin.html", { waitUntil: "networkidle" });
  await p2.fill("#email", ADMIN.email);
  await p2.fill("#senha", ADMIN.senha);
  await Promise.all([p2.waitForURL(/admin\.html/), p2.click("#login-form button[type=submit]")]);
  await p2.waitForSelector("#stats .kpis");
  const stats = await p2.textContent("#stats");
  check("painel mostra pedido e buscas sem resultado", /O que mais procuram/.test(stats) && /theremin/.test(stats), stats.includes("theremin") ? "" : "theremin ausente");
  // 6. Celular: nada de rolagem lateral.
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const p3 = await mobile.newPage();
  watch(p3);
  for (const path of ["/", "/catalogo.html", `/produto.html?id=${item.id}`, "/carrinho.html", "/ajuda.html"]) {
    await p3.goto(BASE + path, { waitUntil: "networkidle" });
    const wide = await p3.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`sem rolagem lateral em ${path} (375 px)`, wide <= 1, `${wide}px`);
  }
} catch (error) {
  check("roteiro completo", false, error.message.split("\n")[0]);
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.extra ? ` — ${r.extra}` : ""}`);
if (problems.length) console.log(`Erros no console:\n${[...new Set(problems)].join("\n")}`);
const failed = results.filter((r) => !r.ok).length + (problems.length ? 1 : 0);
console.log(failed ? `${failed} falha(s).` : `Tudo certo: ${results.length} verificações.`);
process.exit(failed ? 1 : 0);
