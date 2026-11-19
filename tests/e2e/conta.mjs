// Etapa 39.3: roteiro de navegador das páginas de compra e conta em React (cadastro e login com
// erros de validação, carrinho, checkout com endereço e pagamento salvos, comprovante, cada seção
// de Minha conta, sair e telas de celular sem rolagem lateral). Falha com erro no console.
// Uso: node scripts/e2e-server.js  e  BASE=http://127.0.0.1:4173 SHOTS=pasta node tests/e2e/conta.mjs
import { mkdirSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const problems = [];
const check = (name, ok, extra = "") => results.push({ name, ok: Boolean(ok), extra });
const watch = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" && !/\b(400|401|404|409|422|429)\b/.test(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
};
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) : null);
const email = `conta${Date.now()}@example.test`;
const senha = "senha-conta-12345";
const browser = await chromium.launch();
try {
  const products = (await (await fetch(BASE + "/api/products")).json()).data;
  const cheap = products.filter((p) => p.estoque > 3 && p.priceCents < 40000);
  const guitar = products.find((p) => p.categoria === "Guitarras" && p.estoque > 3);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page);

  // 1. Cadastro com erros de validação.
  await page.goto(BASE + "/cadastro.html?next=/minha-conta.html%23enderecos", { waitUntil: "networkidle" });
  check("cadastro: link Entrar mantém o next", (await page.getAttribute(".auth-bottom a", "href")) === "/login.html?next=%2Fminha-conta.html%23enderecos");
  await page.click("#register-form button[type=submit]");
  check("cadastro: nome vazio marcado", (await page.getAttribute("#nome", "aria-invalid")) === "true" && /Informe seu nome completo/.test(await page.textContent("#hint-nome")));
  check("cadastro: foco no primeiro campo inválido", await page.evaluate(() => document.activeElement?.id === "nome"));
  check("cadastro: descrição ligada ao erro", (await page.getAttribute("#email", "aria-describedby")) === "hint-email");
  await page.fill("#nome", "Cliente Conta");
  check("cadastro: erro some ao corrigir", (await page.getAttribute("#nome", "aria-invalid")) === null && !(await page.$("#hint-nome")));
  await page.fill("#email", "invalido");
  await page.press("#email", "Tab");
  check("cadastro: e-mail inválido ao sair do campo", /nome@exemplo\.com/.test((await page.textContent("#hint-email")) || ""));
  await page.fill("#email", email);
  await page.fill("#telefone", "11987654321");
  await page.press("#telefone", "Tab");
  check("cadastro: máscara de telefone", (await page.inputValue("#telefone")) === "(11) 98765-4321");
  await page.fill("#senha", "curta");
  check("cadastro: medidor de força", /Faltam 5 caracteres/.test(await page.textContent(".strength small")));
  await page.click(".password-field button");
  check("cadastro: mostrar senha", (await page.getAttribute("#senha", "type")) === "text" && (await page.getAttribute(".password-field button", "aria-label")) === "Ocultar senha");
  await page.fill("#senha", senha);
  await shot(page, "01-cadastro");
  await Promise.all([page.waitForURL(/minha-conta\.html#enderecos/), page.click("#register-form button[type=submit]")]);
  check("cadastro: volta para o next", true);

  // 2. Minha conta: endereços.
  await page.waitForSelector("#enderecos:not([hidden]) #address-add");
  check("conta: seção pelo endereço (#enderecos)", (await page.textContent("#account-crumb")) === "Endereços" && /Endereços/.test(await page.title()));
  await page.click("#address-add");
  await page.click(".address-form button[type=submit]");
  check("endereço: validação em português", /Preencha este campo/.test(await page.textContent("#hint-cep")));
  await page.fill("#addr-cep", "01310100");
  check("endereço: máscara de CEP e UF sugerida", (await page.inputValue("#addr-cep")) === "01310-100" && (await page.inputValue("#addr-uf")) === "SP");
  await page.fill("#addr-cidade", "São Paulo");
  await page.fill("#addr-bairro", "Bela Vista");
  await page.fill("#addr-logradouro", "Av. Paulista");
  await page.fill("#addr-numero", "1000");
  await page.fill("#addr-apelido", "Casa");
  await page.click(".address-form button[type=submit]");
  await page.waitForSelector(".address-card.is-main");
  check("endereço: salvo como principal", /Casa/.test(await page.textContent(".address-card.is-main")));
  await page.click("#address-add");
  await page.fill("#addr-cep", "20040-002");
  await page.fill("#addr-cidade", "Rio de Janeiro");
  await page.fill("#addr-bairro", "Centro");
  await page.fill("#addr-logradouro", "Av. Rio Branco");
  await page.fill("#addr-numero", "1");
  await page.fill("#addr-apelido", "Estúdio");
  await page.click(".address-form button[type=submit]");
  await page.waitForFunction(() => document.querySelectorAll(".address-card").length === 2);
  check("endereço: segundo endereço", true);
  await page.click('.address-card:has-text("Estúdio") [data-edit]');
  await page.fill("#addr-apelido", "Estúdio 2");
  await page.click(".address-form button[type=submit]");
  await page.waitForSelector('.address-card:has-text("Estúdio 2")');
  check("endereço: edição", true);
  await page.click('.address-card:has-text("Estúdio 2") [data-main]');
  await page.waitForSelector('.address-card.is-main:has-text("Estúdio 2")');
  check("endereço: tornar principal", true);
  await page.click('.address-card:has-text("Estúdio 2") [data-delete]');
  await page.click('.confirm-dialog button[value="ok"]');
  await page.waitForFunction(() => document.querySelectorAll(".address-card").length === 1);
  check("endereço: excluir com confirmação", true);
  await shot(page, "02-enderecos");

  // 3. Dados e segurança.
  await page.click('#account-nav a[data-view-link="dados"]');
  await page.waitForSelector("#dados:not([hidden])");
  check("conta: troca de seção move o foco ao título", await page.evaluate(() => document.activeElement?.id === "data-title"));
  await page.fill("#nome", "Cliente Editado");
  await page.click("#profile-form button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#account-greeting")?.textContent === "Olá, Cliente.");
  check("dados: nome salvo", true);
  await page.fill("#senha-atual", senha);
  await page.fill("#senha-nova", "outra-senha-123");
  await page.fill("#senha-confirmacao", "outra-senha-999");
  await page.click("#password-form button[type=submit]");
  await page.waitForSelector("#error-confirmacao");
  check("senha: erro ao lado do campo", /não são iguais/.test(await page.textContent("#error-confirmacao")) && (await page.getAttribute("#senha-confirmacao", "aria-invalid")) === "true");
  await page.click("#delete-open");
  check("excluir conta: formulário abre com foco", await page.evaluate(() => !document.querySelector("#delete-form").hidden && document.activeElement?.id === "delete-senha"));
  await page.click("#delete-cancel");
  check("excluir conta: cancelar fecha", await page.evaluate(() => document.querySelector("#delete-form").hidden && document.activeElement?.id === "delete-open"));
  await shot(page, "03-dados");

  // 4. Pagamento preferido.
  await page.click('#account-nav a[data-view-link="pagamentos"]');
  await page.check('#payment-form input[value="cartao"]');
  check("pagamento: parcelas aparecem no cartão", await page.isVisible("#payment-parcelas"));
  await page.selectOption("#payment-parcelas", "3");
  await page.click("#payment-form button[type=submit]");
  await page.waitForSelector(".payment-card.is-saved input[value=cartao]");
  check("pagamento: preferência salva", true);
  await shot(page, "04-pagamentos");

  // 5. Avisos, notificações e ajuda.
  for (const [id, text] of [
    ["avisos", "Nenhum aviso ativo."],
    ["notificacoes", "Nenhuma notificação."],
    ["ajuda", "Onde está meu pedido?"],
  ]) {
    await page.click(`#account-nav a[data-view-link="${id}"]`);
    await page.waitForSelector(`#${id}:not([hidden])`);
    await page.waitForFunction(([v, t]) => document.getElementById(v)?.textContent.includes(t), [id, text]);
    check(`conta: seção #${id}`, true);
    await shot(page, `05-${id}`);
  }

  // 6. Carrinho: quantidade, remover (e desfazer), cupom e CEP.
  await page.evaluate((items) => localStorage.setItem("vv_cart", JSON.stringify(items)), [
    { id: cheap[0].id, quantidade: 1 },
    { id: guitar.id, quantidade: 1 },
  ]);
  await page.goto(BASE + "/carrinho.html", { waitUntil: "networkidle" });
  await page.waitForSelector(".cart-item");
  check("carrinho: itens", (await page.locator(".cart-item").count()) === 2 && /2 itens/.test(await page.textContent(".cart-count")));
  await page.locator(".cart-item").first().locator('[data-step="1"]').click();
  await page.waitForFunction(() => /3 itens/.test(document.querySelector(".cart-count")?.textContent || ""));
  check("carrinho: aumentar quantidade", (await page.locator(".cart-item output").first().textContent()) === "2");
  await page.locator(".cart-item").first().locator('[data-step="-1"]').click();
  await page.waitForFunction(() => /2 itens/.test(document.querySelector(".cart-count")?.textContent || ""));
  await page.locator(".cart-item").first().locator("[data-remove-item]").click();
  await page.waitForFunction(() => document.querySelectorAll(".cart-item").length === 1);
  check("carrinho: remover", true);
  await page.click(".toast button, .toast-action").catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll(".cart-item").length === 2, null, { timeout: 5000 }).catch(() => {});
  check("carrinho: desfazer remoção", (await page.locator(".cart-item").count()) === 2);
  check("carrinho: cabeçalho acompanha", (await page.textContent(".site-header .cart-link .count")) === "2");
  await page.fill("#cart-coupon", "NAOEXISTE");
  await page.click(".coupon-form button[type=submit]");
  await page.waitForSelector("#coupon-error");
  check("carrinho: cupom inválido", (await page.getAttribute("#cart-coupon", "aria-invalid")) === "true");
  await page.fill("#cart-coupon", "voltage10");
  await page.click(".coupon-form button[type=submit]");
  await page.waitForSelector(".coupon-applied");
  check("carrinho: cupom aplicado", /VOLTAGE10/.test(await page.textContent(".coupon-applied")) && /Desconto \(VOLTAGE10\)/.test(await page.textContent(".totals")));
  await page.fill("#cart-cep", "123");
  await page.click(".cep-form button[type=submit]");
  await page.waitForSelector("#cep-error");
  check("carrinho: CEP inválido", /8 dígitos/.test(await page.textContent("#cep-error")));
  await page.fill("#cart-cep", "01310100");
  await page.click(".cep-form button[type=submit]");
  await page.waitForFunction(() => /Entrega para/.test(document.querySelector(".cep-form")?.textContent || ""));
  check("carrinho: CEP calcula a região", (await page.inputValue("#cart-cep")) === "01310-100");
  await shot(page, "06-carrinho");

  // 7. Checkout com endereço salvo e pagamento preferido.
  await page.click(".summary-panel a.button.full[href='/checkout.html']");
  await page.waitForSelector("#delivery-options .option-card");
  check("checkout: endereço salvo marcado", await page.isChecked('input[name="endereco-escolha"]:not([value="novo"])'));
  check("checkout: campo de endereço oculto", !(await page.isVisible("#endereco")));
  check("checkout: cartão preferido marcado", await page.isChecked('input[name="pagamento"][value="cartao"]'));
  check("checkout: cupom do carrinho", /VOLTAGE10/.test(await page.textContent("#coupon-box")));
  check("checkout: parcelas preferidas", /^3x/.test((await page.locator("#parcelas option:checked").textContent()) || ""));
  await page.check('input[name="endereco-escolha"][value="novo"]');
  check("checkout: outro endereço mostra o campo com foco", await page.evaluate(() => document.activeElement?.id === "endereco"));
  await page.click("#checkout-form button[type=submit]");
  check("checkout: endereço obrigatório", (await page.getAttribute("#endereco", "aria-invalid")) === "true");
  await page.locator('input[name="endereco-escolha"]').first().check();
  await shot(page, "07-checkout");
  await page.waitForFunction(() => !document.querySelector("#checkout-form button[type=submit]")?.disabled);
  await page.click("#checkout-form button[type=submit]");
  await page.waitForSelector(".confirmation", { timeout: 15000 });
  check("checkout: pedido confirmado", /Pedido confirmado/.test(await page.textContent(".confirmation")) && /Cartão de crédito em 3x/.test(await page.textContent(".confirmation")));
  check("checkout: etapa 3 atual", /current/.test((await page.getAttribute(".steps li:last-child", "class")) || ""));
  check("checkout: carrinho esvaziado", (await page.locator(".site-header .cart-link .count").count()) === 0);
  await shot(page, "08-confirmacao");

  // 8. Comprovante.
  await Promise.all([page.waitForURL(/pedido\.html\?id=/), page.click("text=Ver comprovante")]);
  await page.waitForSelector(".receipt-head");
  check("pedido: comprovante", /Pedido #/.test(await page.textContent("#crumb-current")) && /Pedido #/.test(await page.title()));
  check("pedido: endereço salvo", /Av\. Paulista, 1000/.test(await page.textContent(".receipt-grid")));
  await shot(page, "09-pedido");
  await page.goto(BASE + "/pedido.html?id=nao-existe", { waitUntil: "networkidle" });
  await page.waitForSelector(".state-error");
  check("pedido: não encontrado", /Pedido não encontrado/.test(await page.textContent("#order-content")));

  // 9. Meus pedidos: filtro e cancelamento.
  await page.goto(BASE + "/minha-conta.html#pedidos", { waitUntil: "networkidle" });
  await page.waitForSelector("#orders .order-card");
  check("pedidos: lista", (await page.textContent('#order-filters [data-group="andamento"] .chip-count')) === "1");
  await page.click('#order-filters [data-group="cancelados"]');
  check("pedidos: filtro vazio", /Nenhum pedido neste filtro/.test(await page.textContent("#orders")));
  await page.click('#order-filters [data-group="todos"]');
  await page.click("#orders [data-cancel]");
  await page.click('.confirm-dialog button[value="ok"]');
  await page.waitForSelector("#orders .status-canceled");
  check("pedidos: cancelar", true);
  await page.click("#orders [data-reorder]");
  await page.waitForSelector(".cart-drawer[open], dialog[open]", { timeout: 5000 }).catch(() => {});
  check("pedidos: comprar novamente", JSON.parse(await page.evaluate(() => localStorage.getItem("vv_cart"))).length === 2);
  await page.keyboard.press("Escape");
  await shot(page, "10-pedidos");
  await page.click('#account-nav a[data-view-link="visao-geral"]');
  check("visão geral: último pedido", /Pedido #/.test(await page.textContent("#overview-grid")));

  // 10. Notificação de status (o cancelamento gera uma) e marcar como lida.
  await page.goto(BASE + "/minha-conta.html#notificacoes", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (await page.isVisible("#notifications-read")) {
    await page.click("#notifications-read");
    await page.waitForSelector("#notifications-read", { state: "hidden" });
    check("notificações: marcar todas como lidas", (await page.locator(".notification.is-unread").count()) === 0);
  }

  // 11. Sair e login com erros.
  await Promise.all([page.waitForURL(BASE + "/"), page.click("#logout")]);
  check("sair: volta ao início", true);
  await page.goto(BASE + "/minha-conta.html#dados", { waitUntil: "networkidle" });
  await page.waitForURL(/login\.html\?next=/);
  check("sem login: vai ao login com next", decodeURIComponent(new URL(page.url()).searchParams.get("next")) === "/minha-conta.html#dados");
  await page.click("#login-form button[type=submit]");
  check("login: campos obrigatórios", /nome@exemplo\.com/.test(await page.textContent("#hint-email")) && /Preencha este campo/.test(await page.textContent("#hint-senha")));
  await page.fill("#email", email);
  await page.fill("#senha", "senha-errada-123");
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("#login-form [role=alert]");
  check("login: erro do servidor", (await page.textContent("#login-form [role=alert]")).length > 5);
  await shot(page, "11-login-erro");
  await page.fill("#senha", senha);
  await Promise.all([page.waitForURL(/minha-conta\.html#dados/), page.click("#login-form button[type=submit]")]);
  await page.waitForSelector("#dados:not([hidden])");
  check("login: volta para a seção pedida", (await page.inputValue("#nome")) === "Cliente Editado");

  // 12. Celular: nada de rolagem lateral.
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce", storageState: await ctx.storageState() });
  const m = await mobile.newPage();
  watch(m);
  for (const path of ["/carrinho.html", "/checkout.html", "/minha-conta.html", "/minha-conta.html#pedidos", "/minha-conta.html#dados", "/minha-conta.html#enderecos", "/minha-conta.html#pagamentos", "/minha-conta.html#ajuda"]) {
    await m.goto(BASE + path, { waitUntil: "networkidle" });
    await m.waitForTimeout(300);
    const wide = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`sem rolagem lateral em ${path} (375 px)`, wide <= 1, `${wide}px`);
    await shot(m, `m-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`);
  }
  const guest = await (await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" })).newPage();
  watch(guest);
  for (const path of ["/login.html", "/cadastro.html"]) {
    await guest.goto(BASE + path, { waitUntil: "networkidle" });
    const wide = await guest.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`sem rolagem lateral em ${path} (375 px)`, wide <= 1, `${wide}px`);
    await shot(guest, `m-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`);
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
