// Etapa 39.4: roteiro de navegador das páginas em React (montador, kits, encomenda, parceiros e
// guias). Sobe com `node scripts/e2e-server.js`; falha se algum passo falhar ou houver erro no console
// (inclusive divergência de hidratação).
// Uso: BASE=http://127.0.0.1:4173 [SHOTS=pasta] node tests/e2e/react-etapa4.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS;
const results = [];
const problems = [];
const check = (name, ok, extra = "") => results.push({ name, ok: Boolean(ok), extra });
const watch = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" && !/\b(400|401|404|409|429)\b/.test(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
};
const shot = (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
// CNPJ válido e novo a cada execução (o servidor recusa ficha repetida do mesmo CNPJ).
function newCnpj() {
  const d = String(Date.now()).slice(-8).padStart(8, "0").split("").map(Number).concat([0, 0, 0, 1]);
  for (const len of [12, 13]) {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = w.reduce((s, x, i) => s + d[i] * x, 0) % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join("");
}
const CNPJ = newCnpj();
const cartCount = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("vv_cart") || "[]").reduce((s, i) => s + i.quantidade, 0));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page);

  // 1. Montador: estilo, escolha, troca, total e tudo no carrinho.
  await page.goto(BASE + "/setup.html", { waitUntil: "networkidle" });
  await page.waitForSelector(".setup-option");
  check("montador lista guitarras", (await page.locator(".setup-option").count()) > 1);
  await page.selectOption("#setup-genre", "Blues");
  await page.waitForSelector(".setup-filter-note");
  check("estilo filtra as opções", /combina|combinam/.test(await page.textContent(".setup-filter-note")), await page.textContent(".setup-filter-note"));
  check("estilo no endereço", /genero=Blues/.test(page.url()), page.url());
  const options = page.locator(".setup-option:not(.is-out)");
  await options.nth(0).click();
  const first = await options.nth(0).locator("input").getAttribute("value");
  await options.nth(1).click();
  const second = await options.nth(1).locator("input").getAttribute("value");
  check("troca de guitarra mantém uma só", (await page.locator(".setup-summary-items li").count()) === 1 && page.url().includes(`itens=${second}`) && !page.url().includes(first), page.url());
  await page.click("#setup-steps li:nth-child(2) button");
  await page.waitForFunction(() => document.activeElement?.id === "stage-title" && /Amplificador/.test(document.activeElement.textContent));
  await page.locator(".setup-option:not(.is-out)").first().click();
  await page.click(".setup-stage-actions [data-go='2']");
  await page.waitForFunction(() => /Efeitos/.test(document.querySelector("#stage-title")?.textContent || ""));
  const fx = page.locator(".setup-option:not(.is-out)");
  if ((await fx.count()) >= 2) {
    await fx.nth(0).click();
    await fx.nth(1).click();
  }
  const picked = await page.locator(".setup-summary-items li").count();
  check("resumo soma as escolhas", picked >= 3 && /Total \(\d+ itens\)/.test(await page.textContent(".summary-total")), `${picked} itens`);
  check("barra do setup liberada (aparece no celular)", (await page.getAttribute("#setup-bar", "hidden")) === null);
  check("passos marcam o que foi escolhido", (await page.locator("#setup-steps .is-done").count()) >= 2);
  await shot(page, "setup-desktop");
  const before = await cartCount(page);
  await page.click("#setup-summary [data-add-setup]");
  await page.waitForFunction((n) => JSON.parse(localStorage.getItem("vv_cart") || "[]").reduce((s, i) => s + i.quantidade, 0) > n, before);
  check("setup inteiro vai para o carrinho", (await cartCount(page)) - before === picked, `${(await cartCount(page)) - before} de ${picked}`);
  await page.keyboard.press("Escape");
  await page.click("#setup-summary [data-reset]");
  await page.waitForFunction(() => !document.querySelector(".setup-summary-items"));
  check("recomeçar limpa o setup", !page.url().includes("itens="), page.url());

  // 2. Kits: adicionar kit e personalizar no montador (?itens=).
  await page.goto(BASE + "/kits.html", { waitUntil: "networkidle" });
  await page.waitForSelector(".kit-card");
  check("kits carregam", (await page.locator(".kit-card").count()) > 1);
  const kitCard = page.locator(".kit-card", { has: page.locator("button.button") }).first();
  const kitItems = await kitCard.locator(".setup-items li").count();
  const kitBefore = await cartCount(page);
  await kitCard.locator("button.button").click();
  await page.waitForFunction((n) => JSON.parse(localStorage.getItem("vv_cart") || "[]").reduce((s, i) => s + i.quantidade, 0) > n, kitBefore);
  check("kit inteiro vai para o carrinho", (await cartCount(page)) - kitBefore === kitItems, `${kitItems} itens`);
  await shot(page, "kits");
  await page.keyboard.press("Escape");
  const custom = await kitCard.locator(".setup-customize").getAttribute("href");
  await page.goto(BASE + custom, { waitUntil: "networkidle" });
  await page.waitForSelector(".setup-summary-items li");
  const ids = new URL(custom, BASE).searchParams.get("itens").split(",");
  const summaryIds = await page.locator(".setup-summary-items [data-remove]").evaluateAll((b) => b.map((x) => x.dataset.remove));
  check("montador abre com os itens do kit", summaryIds.length > 0 && summaryIds.every((id) => ids.includes(id)), `${summaryIds.length} de ${ids.length}`);
  await shot(page, "setup-from-kit");

  // 3. Encomenda sem login: dados do assistente, validação e pedido de login (rascunho guardado).
  const ask = "?tipo=importacao&itens=Base%3A%20Telecaster&descricao=Telecaster%20azul%20com%20escala%20de%20maple";
  await page.goto(BASE + "/encomenda.html" + ask, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#request-produto")?.value === "Telecaster");
  check("assistente preenche a encomenda", (await page.isChecked("input[name=tipo][value=importacao]")) && (await page.isVisible("#request-from-assistant")));
  await page.waitForSelector("#request-login-note:not([hidden])");
  check("sem login: aviso para entrar", await page.isVisible("#request-login-note"));
  check("sem login: sem Minhas encomendas", !(await page.isVisible("#minhas")));
  await page.selectOption("#request-contato", "WhatsApp");
  check("WhatsApp pede telefone", (await page.isVisible("#request-telefone")) && (await page.getAttribute("#request-telefone", "required")) !== null);
  await page.click("#request-form button[type=submit]");
  await page.waitForSelector("#hint-telefone");
  check(
    "campo obrigatório com mensagem em português",
    (await page.textContent("#hint-telefone")) === "Preencha este campo." && (await page.getAttribute("#request-telefone", "aria-invalid")) === "true" && (await page.getAttribute("#request-telefone", "aria-describedby")) === "hint-telefone",
  );
  await page.fill("#request-telefone", "11 99999-0000");
  check("mensagem some com valor válido", !(await page.isVisible("#hint-telefone")));
  await shot(page, "encomenda-logged-out");
  await Promise.all([page.waitForURL(/\/login\.html\?next=%2Fencomenda\.html/), page.click("#request-form button[type=submit]")]);
  check("enviar sem login leva ao login", true);
  // Cadastro e volta: o rascunho reaparece e a encomenda é enviada.
  await page.goto(BASE + "/cadastro.html?next=/encomenda.html", { waitUntil: "networkidle" });
  await page.fill("#nome", "Cliente Encomenda");
  await page.fill("#email", `enc${Date.now()}@example.test`);
  await page.fill("#senha", "senha-e2e-12345");
  await Promise.all([page.waitForURL(/encomenda\.html/), page.click("#register-form button[type=submit]")]);
  await page.waitForFunction(() => document.querySelector("#request-produto")?.value === "Telecaster");
  await page.waitForSelector("#minhas:not([hidden])");
  check("rascunho volta depois do login", (await page.inputValue("#request-telefone")) === "11 99999-0000" && (await page.isHidden("#request-login-note")));
  await page.waitForSelector("#request-list .empty");
  await page.click("#request-form button[type=submit]");
  await page.waitForSelector("#request-list .request-item");
  check("encomenda aparece em Minhas encomendas", /Telecaster/.test(await page.textContent("#request-list")) && /#minhas$/.test(page.url()), page.url());
  check("formulário limpo depois do envio", (await page.inputValue("#request-produto")) === "" && !(await page.isVisible("#request-telefone")));
  await shot(page, "encomenda-logged-in");

  // 4. Parceiros: ?produto=, máscara e dígitos do CNPJ, envio.
  await page.goto(BASE + "/parceiros.html?produto=Pedais", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('input[name=produtos][value="Pedais"]')?.checked);
  check("?produto= marca o tipo", true);
  await page.fill("#p-cnpj", "");
  await page.locator("#p-cnpj").pressSequentially("11222333000100");
  check("máscara do CNPJ", (await page.inputValue("#p-cnpj")) === "11.222.333/0001-00", await page.inputValue("#p-cnpj"));
  await page.click("#p-razao");
  await page.waitForSelector("#hint-cnpj");
  check("CNPJ inválido avisa", (await page.textContent("#hint-cnpj")) === "Confira o CNPJ: os dígitos verificadores não batem." && (await page.getAttribute("#p-cnpj", "aria-invalid")) === "true");
  await page.click('input[name=produtos][value="Pedais"]');
  await page.click("#partner-form button[type=submit]");
  const firstError = await page.evaluate(() => document.activeElement?.name || document.activeElement?.id);
  check("envio inválido marca os campos e foca o primeiro", firstError === "razaoSocial" && (await page.locator("#partner-form [aria-invalid=true]").count()) >= 4, firstError);
  await shot(page, "parceiros-erros");
  const fillPartner = async () => {
    await page.fill("#p-razao", "Fuzz Factory Ltda");
    await page.fill("#p-cnpj", CNPJ);
    await page.fill("#p-contato", "Marina Souza");
    await page.fill("#p-email", "marina@fuzzfactory.test");
    await page.fill("#p-telefone", "11 98888-7777");
    await page.check("input[name=aceite]");
  };
  await fillPartner();
  await page.click("#partner-form button[type=submit]");
  await page.waitForSelector("#partner-form .field-error");
  check("sem tipo de produto avisa", /Marque pelo menos um tipo/.test(await page.textContent("#partner-form")));
  await page.check('input[name=produtos][value="Pedais"]');
  await page.click("#partner-form button[type=submit]");
  await page.waitForSelector("#partner-done h2");
  check(
    "ficha enviada com protocolo",
    /Protocolo \S+\. A equipe comercial entra em contato com Marina Souza/.test(await page.textContent("#partner-done")) && (await page.isHidden("#partner-form")) && (await page.evaluate(() => document.activeElement?.textContent)) === "Ficha recebida!",
  );
  await shot(page, "parceiros-enviado");
  // Erro do servidor (CNPJ repetido) aparece junto ao campo.
  await page.goto(BASE + "/parceiros.html?produto=Cabos", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('input[name=produtos][value="Cabos"]')?.checked);
  await fillPartner();
  await page.click("#partner-form button[type=submit]");
  await page.waitForSelector("#error-cnpj");
  check(
    "erro do servidor junto ao campo",
    /Já recebemos uma ficha com este CNPJ/.test(await page.textContent("#error-cnpj")) && (await page.getAttribute("#p-cnpj", "aria-describedby")) === "error-cnpj" && (await page.evaluate(() => document.activeElement?.id)) === "p-cnpj" && (await page.textContent("#partner-form button[type=submit]")) === "Enviar ficha",
  );

  // 5. Guias: âncoras, termo destacado e busca no glossário.
  await page.goto(BASE + "/guias.html#humbucker", { waitUntil: "networkidle" });
  await page.waitForSelector("#humbucker.is-target");
  check("link para termo destaca o termo", true);
  await page.fill("#glossary-q", "fuzz");
  await page.waitForFunction(() => /encontrado/.test(document.querySelector("#glossary-status")?.textContent || ""));
  check("busca no glossário", (await page.isVisible("#fuzz")) && !(await page.isVisible("#action")), await page.textContent("#glossary-status"));
  await page.fill("#glossary-q", "xyzxyz");
  check("busca sem resultado", /Nenhum termo encontrado/.test(await page.textContent("#glossary-status")));
  await page.click('.guide-toc a[href="#captacao"]');
  check("índice leva ao guia", page.url().endsWith("#captacao"));
  await page.goto(BASE + "/guias.html#p90", { waitUntil: "networkidle" });
  await page.waitForSelector("#p90.is-target");
  await page.evaluate(() => (location.hash = "#fuzz"));
  await page.waitForSelector("#fuzz.is-target");
  check("troca de âncora move o destaque", !(await page.locator("#p90.is-target").count()));
  await shot(page, "guias");

  // 6. Celular: sem rolagem lateral.
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const p3 = await phone.newPage();
  watch(p3);
  for (const path of ["/setup.html?itens=" + ids.join(","), "/kits.html", "/encomenda.html", "/parceiros.html", "/guias.html"]) {
    await p3.goto(BASE + path, { waitUntil: "networkidle" });
    await p3.waitForTimeout(300);
    const overflow = await p3.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`sem rolagem lateral em ${path.split("?")[0]} (375 px)`, overflow <= 0, `${overflow}px`);
    if (path.startsWith("/setup.html")) {
      await p3.waitForSelector("#setup-bar:not([hidden])");
      check("barra do setup no celular", (await p3.isVisible("#setup-bar")) && /no setup/.test(await p3.textContent("#setup-bar")));
    }
    await shot(p3, `mobile-${path.split("?")[0].replace(/\W/g, "")}`);
  }
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.extra ? ` — ${r.extra}` : ""}`);
for (const p of problems) console.log(`FAIL ${p}`);
const failed = results.filter((r) => !r.ok).length + problems.length;
if (failed) {
  console.log(`${failed} problema(s).`);
  process.exit(1);
}
console.log(`Tudo certo: ${results.length} verificações.`);
