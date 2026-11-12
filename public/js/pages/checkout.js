import { icon } from "../icons.js";
import { send, money, productImage, escapeHtml as esc, getCart, setCart, bindForm, requireUser, toast } from "../common.js";
import { emptyState, errorState } from "../components.js";
import { cartData, prefs, fetchQuote, totalsHTML } from "./cart.js";
import { installmentValue } from "../pricing.js";
import { formatAddress } from "../address.js";

const payments = [
  ["pix", "pix", "Pix", "Aprovação imediata após o pagamento"],
  ["cartao", "card", "Cartão de crédito", "Em até 10x sem juros"],
  ["boleto", "barcode", "Boleto", "Compensação em até 2 dias úteis"],
];
const paymentLabel = { pix: "Pix", cartao: "Cartão de crédito", boleto: "Boleto" };

export default async function checkout(session) {
  const user = await session;
  if (!requireUser(user)) return;
  const content = document.querySelector("#checkout-content");
  const form = document.querySelector("#checkout-form");
  const submit = form.querySelector("[type=submit]");
  const state = { entrega: prefs.delivery, pagamento: "pix", parcelas: 1, cupom: prefs.coupon, quote: null };
  let items;
  try {
    items = await cartData();
  } catch (error) {
    errorState(content, error, () => location.reload(), { back: { href: "/carrinho.html", label: "Voltar ao carrinho" } });
    return;
  }
  if (!items.length) {
    content.innerHTML = emptyState({ symbol: "bag", title: "Seu carrinho está vazio.", actions: '<a class="button" href="/catalogo.html">Explorar catálogo</a>' });
    return;
  }
  if (items.some((i) => !i.product || i.quantidade > i.product.estoque)) {
    content.innerHTML = emptyState({ symbol: "alert", title: "Existem itens indisponíveis no carrinho.", text: "Revise as quantidades antes de finalizar.", actions: '<a class="button" href="/carrinho.html">Revisar carrinho</a>' });
    return;
  }
  const address = form.elements.endereco;
  const $ = (s) => form.querySelector(s);
  // Endereços salvos (principal primeiro), o do cadastro e a opção de digitar outro.
  const saved = user.enderecos || [];
  const legacy = (user.endereco || "").trim();
  const choices = [
    ...saved.map((a) => ({ id: a.id, title: a.apelido || "Endereço", text: formatAddress(a), main: a.principal })),
    ...(legacy && !saved.some((a) => formatAddress(a) === legacy) ? [{ id: "cadastro", title: "Endereço do cadastro", text: legacy }] : []),
  ];
  state.endereco = choices[0]?.id || "novo";
  function renderAddress() {
    const pickup = state.entrega === "retirada";
    const box = $("#address-choices");
    box.hidden = pickup || !choices.length;
    if (choices.length && !box.firstChild)
      box.innerHTML = `<fieldset class="address-choices"><legend>Entregar em</legend><div class="option-cards">${[...choices, { id: "novo", title: "Outro endereço", text: "Digite o endereço completo só para este pedido." }]
        .map((c) => `<label class="option-card"><input type="radio" name="endereco-escolha" value="${esc(c.id)}"${state.endereco === c.id ? " checked" : ""}><span class="option-icon">${icon(c.id === "novo" ? "plus" : "pin", { size: 22 })}</span><span class="option-text"><strong>${esc(c.title)}${c.main ? ' <span class="badge badge-main">Principal</span>' : ""}</strong><small>${esc(c.text)}</small></span></label>`)
        .join("")}</div></fieldset><a class="text-link small" href="/minha-conta.html#enderecos">Gerenciar endereços ${icon("arrowRight", { size: 16 })}</a>`;
    const typing = state.endereco === "novo";
    $("#address-field").hidden = pickup || !typing;
    address.required = !pickup && typing;
  }

  function renderOptions() {
    const q = state.quote;
    $("#delivery-options").innerHTML = q.entregas
      .map((o) => `<label class="option-card"><input type="radio" name="entrega" value="${o.id}"${o.id === state.entrega ? " checked" : ""}><span class="option-icon">${icon(o.id === "retirada" ? "store" : "truck", { size: 22 })}</span><span class="option-text"><strong>${esc(o.label)}</strong><small>${esc(o.prazo)}</small></span><span class="option-price">${o.priceCents ? money(o.priceCents) : "Grátis"}</span></label>`)
      .join("");
    $("#payment-options").innerHTML = payments
      .map(([id, symbol, label, text]) => `<label class="option-card"><input type="radio" name="pagamento" value="${id}"${id === state.pagamento ? " checked" : ""}><span class="option-icon">${icon(symbol, { size: 22 })}</span><span class="option-text"><strong>${label}</strong><small>${text}</small></span></label>`)
      .join("");
    const max = q.parcelasMax;
    if (state.parcelas > max) state.parcelas = max;
    $("#parcelas").innerHTML = Array.from({ length: max }, (_, i) => i + 1)
      .map((n) => `<option value="${n}"${n === state.parcelas ? " selected" : ""}>${n}x de ${money(installmentValue(q.totalCents, n))} sem juros${n === 1 ? " (à vista)" : ""}</option>`)
      .join("");
    $("#installments-field").hidden = state.pagamento !== "cartao";
    const pickup = state.entrega === "retirada";
    $("#pickup-note").hidden = !pickup;
    renderAddress();
  }
  function renderCoupon(error = "") {
    const q = state.quote;
    $("#coupon-box").innerHTML = q.cupom
      ? `<div class="coupon-applied">${icon("tag", { size: 18 })}<span><strong>${esc(q.cupom.codigo)}</strong><small>${esc(q.cupom.descricao)}</small></span><button type="button" class="text-button" data-remove-coupon>Remover</button></div>`
      : `<div class="coupon-row"><label class="sr-only" for="cupom">Cupom de desconto</label><input id="cupom" maxlength="30" autocomplete="off" placeholder="Digite seu cupom"${error ? ' aria-invalid="true" aria-describedby="coupon-error"' : ""}><button type="button" class="secondary" data-apply-coupon>Aplicar</button></div>${error ? `<p class="field-error" id="coupon-error" role="alert">${esc(error)}</p>` : ""}`;
  }
  function renderSummary() {
    const q = state.quote;
    const byId = new Map(items.map((i) => [i.id, i.product]));
    $("#summary-items").innerHTML = q.items
      .map((i) => `<li><img src="${esc(productImage(byId.get(i.id)))}" alt="" width="56" height="56"><span class="summary-item-name">${esc(i.nome)}<small>${i.quantidade} × ${money(i.priceCents)}</small>${(i.servicos || []).map((sv) => `<small class="summary-service">+ ${esc(sv.nome)}: ${money(sv.priceCents * i.quantidade)}</small>`).join("")}</span><strong>${money(i.totalCents)}</strong></li>`)
      .join("");
    $("#summary-totals").innerHTML = totalsHTML(q);
    const parcel = state.pagamento === "cartao" && state.parcelas > 1 ? ` · ${state.parcelas}x de ${money(installmentValue(q.totalCents, state.parcelas))}` : "";
    $("#payment-summary").textContent = `${paymentLabel[state.pagamento]}${parcel}`;
    submit.innerHTML = `${icon("shield", { size: 18 })}Confirmar pedido · ${money(q.totalCents)}`;
  }
  async function refresh({ coupon } = {}) {
    submit.disabled = true;
    const tryCoupon = coupon === undefined ? state.cupom : coupon;
    try {
      state.quote = await fetchQuote(state.entrega, tryCoupon);
      state.cupom = state.quote.cupom?.codigo || "";
      prefs.coupon = state.cupom;
      renderOptions();
      renderCoupon();
      renderSummary();
      if (coupon) toast(`Cupom ${state.cupom} aplicado.`, { type: "success" });
    } catch (error) {
      if (error.field === "cupom") {
        if (!coupon) prefs.coupon = state.cupom = "";
        state.quote = await fetchQuote(state.entrega, state.cupom);
        renderOptions();
        renderCoupon(error.message);
        renderSummary();
      } else {
        errorState(content, error, () => location.reload(), { back: { href: "/carrinho.html", label: "Voltar ao carrinho" } });
        return;
      }
    }
    submit.disabled = false;
  }
  form.addEventListener("change", (event) => {
    const t = event.target;
    if (t.name === "entrega") {
      state.entrega = prefs.delivery = t.value;
      refresh();
    } else if (t.name === "pagamento") {
      state.pagamento = t.value;
      if (t.value !== "cartao") state.parcelas = 1;
      renderOptions();
      renderSummary();
    } else if (t.id === "parcelas") {
      state.parcelas = Number(t.value);
      renderSummary();
    } else if (t.name === "endereco-escolha") {
      state.endereco = t.value;
      renderAddress();
      if (t.value === "novo") address.focus();
    }
  });
  form.addEventListener("click", (event) => {
    if (event.target.closest("[data-apply-coupon]")) {
      const value = $("#cupom").value.trim();
      if (value) refresh({ coupon: value.toUpperCase() });
    } else if (event.target.closest("[data-remove-coupon]")) {
      state.cupom = prefs.coupon = "";
      refresh({ coupon: "" });
    }
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "cupom") {
      event.preventDefault();
      form.querySelector("[data-apply-coupon]").click();
    }
  });
  await refresh();
  const requestId = crypto.randomUUID();
  bindForm(form, async () => {
    const pickup = state.entrega === "retirada";
    const order = await send("/orders", {
      endereco: pickup ? "Retirada na loja" : state.endereco === "novo" ? address.value : choices.find((c) => c.id === state.endereco).text,
      entrega: state.entrega,
      pagamento: state.pagamento,
      ...(state.pagamento === "cartao" ? { parcelas: state.parcelas } : {}),
      ...(state.cupom ? { cupom: state.cupom } : {}),
      requestId,
      items: getCart(),
    });
    let cartCleared = true;
    try {
      setCart([]);
      prefs.coupon = "";
    } catch {
      cartCleared = false;
    }
    const option = state.quote.entregas.find((o) => o.id === order.entrega);
    const parcel = order.pagamento === "cartao" && order.parcelas > 1 ? ` em ${order.parcelas}x de ${money(installmentValue(order.totalCents, order.parcelas))}` : "";
    document.querySelector(".steps li.current")?.classList.replace("current", "done");
    document.querySelector(".steps li:last-child")?.classList.add("current");
    content.innerHTML = `<div class="panel confirmation" role="status" tabindex="-1"><svg class="check-anim" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="m15 27 7 7 15-15"/></svg><span class="eyebrow">Pedido confirmado</span><h2>Obrigado, ${esc(user.nome.split(" ")[0])}! Seu pedido foi registrado.</h2><p class="lead">Acompanhe cada etapa em Minha conta.</p><dl class="confirmation-facts"><div><dt>Pedido</dt><dd>#${esc(order.id.slice(0, 8).toUpperCase())}</dd></div><div><dt>Total</dt><dd>${money(order.totalCents)}</dd></div>${order.descontoKitsCents || order.descontoCents ? `<div><dt>Você economizou</dt><dd>${money((order.descontoKitsCents || 0) + (order.descontoCents || 0))}</dd></div>` : ""}<div><dt>Pagamento</dt><dd>${paymentLabel[order.pagamento]}${parcel}</dd></div><div><dt>Entrega</dt><dd>${esc(option?.label || order.entrega)} · ${esc(option?.prazo || "")}</dd></div></dl><p class="small muted">Número completo: ${esc(order.id)}</p>${cartCleared ? "" : '<p class="error">O pedido foi registrado, mas o navegador não conseguiu limpar o carrinho. Não repita a compra; confira seu histórico.</p>'}<div class="row center"><a href="/pedido.html?id=${encodeURIComponent(order.id)}" class="button">Ver comprovante</a><a href="/minha-conta.html#pedidos" class="button secondary">Acompanhar pedido</a><a href="/catalogo.html" class="button secondary">Continuar comprando</a></div></div>`;
    content.querySelector(".confirmation").focus();
    scrollTo({ top: 0 });
  });
}
