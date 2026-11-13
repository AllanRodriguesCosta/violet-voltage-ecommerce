import { icon } from "./icons.js";
import { api, send, money, productImage, escapeHtml as esc, bindForm, toast, requireUser, normalize, categories } from "./common.js";
import { orderCardHTML, statuses, statusClass } from "./orders.js";
import { confirmDialog, emptyState, errorState, loadingHTML } from "./components.js";
import { specFields } from "./specs.js";

const field = (key, label, value = "", type = "text", attributes = "") =>
  `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${esc(value)}" ${attributes}></div>`;
// Ficha técnica no painel: campos gerados pelo esquema da categoria escolhida.
function specsEditor(categoria, ficha = {}) {
  const fields = specFields(categoria);
  return `<fieldset class="admin-specs"><legend>Ficha técnica (opcional)</legend><p class="form-help">Usada nos filtros do catálogo e na página do produto.</p><div class="form-grid">${fields
    .map((f) => {
      const id = `spec-${f.key}`;
      const value = ficha?.[f.key];
      if (f.type === "multi")
        return `<fieldset class="field span-two"><legend>${esc(f.label)}</legend><div class="facet-list">${f.values.map((v) => `<label class="facet"><input type="checkbox" name="ficha.${f.key}" value="${esc(v)}"${value?.includes(v) ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div></fieldset>`;
      if (f.type === "enum")
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="ficha.${f.key}"><option value="">Não informado</option>${f.values.map((v) => `<option${v === value ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></div>`;
      if (f.type === "number")
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="ficha.${f.key}" type="number" min="${f.min}" max="${f.max}" step="any" value="${esc(value ?? "")}"></div>`;
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="ficha.${f.key}" type="text" maxlength="${f.maxLength}" value="${esc(value ?? "")}"></div>`;
    })
    .join("")}</div></fieldset>`;
}
function readSpecs(form, categoria) {
  const ficha = {};
  for (const f of specFields(categoria)) {
    const inputs = [...form.querySelectorAll(`[name="ficha.${f.key}"]`)];
    if (f.type === "multi") ficha[f.key] = inputs.filter((i) => i.checked).map((i) => i.value);
    else if (inputs[0]?.value !== "") ficha[f.key] = f.type === "number" ? Number(inputs[0].value) : inputs[0].value;
  }
  return ficha;
}
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
function chart(days) {
  const width = 560;
  const height = 190;
  const gap = 6;
  const bar = (width - gap * (days.length - 1)) / days.length;
  const max = Math.max(...days.map((d) => d.totalCents), 1);
  const total = days.reduce((s, d) => s + d.totalCents, 0);
  const count = days.reduce((s, d) => s + d.pedidos, 0);
  const bars = days
    .map((d, i) => {
      const h = d.totalCents ? Math.max(6, Math.round((d.totalCents / max) * (height - 34))) : 3;
      const x = i * (bar + gap);
      const label = shortDate.format(new Date(`${d.dia}T00:00:00Z`));
      return `<g><rect x="${x.toFixed(1)}" y="${height - 22 - h}" width="${bar.toFixed(1)}" height="${h}" rx="5" class="${d.totalCents ? "bar" : "bar empty"}"><title>${label}: ${money(d.totalCents)} em ${d.pedidos} ${d.pedidos === 1 ? "pedido" : "pedidos"}</title></rect>${i % 2 === 1 ? `<text x="${(x + bar / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${label}</text>` : ""}</g>`;
    })
    .join("");
  return `<svg class="sales-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Vendas dos últimos 14 dias: ${money(total)} em ${count} pedidos">${bars}</svg><p class="small muted">No período: <strong>${money(total)}</strong> em ${count} ${count === 1 ? "pedido" : "pedidos"}, sem cancelados.</p>`;
}
// Indicadores de vendas por categoria, mais vendidos, serviços, kits e interesse dos clientes.
function insightsHTML(s) {
  const cats = s.porCategoria || [];
  const top = Math.max(1, ...cats.map((c) => c.totalCents));
  const list = (items, render, empty) => (items.length ? `<ol class="rank-list">${items.map(render).join("")}</ol>` : `<p class="muted">${empty}</p>`);
  return `<div class="dash-grid dash-insights"><section class="panel"><h2>${icon("chart", { size: 18 })}Vendas por categoria</h2>${
    cats.length
      ? `<ul class="status-bars category-bars">${cats.map((c) => `<li><span>${esc(c.categoria)}</span><span class="status-track"><span style="width:${Math.round((c.totalCents / top) * 100)}%"></span></span><strong>${money(c.totalCents)}</strong></li>`).join("")}</ul>`
      : '<p class="muted">Sem vendas registradas ainda.</p>'
  }<p class="small muted">Cancelamentos: ${s.cancelamentoPct || 0}% dos pedidos.</p></section><section class="panel"><h2>Mais vendidos</h2>${list(s.maisVendidos || [], (v) => `<li><a href="/produto.html?id=${encodeURIComponent(v.id)}">${esc(v.nome)}</a><span>${v.unidades} un. · ${money(v.totalCents)}</span></li>`, "Sem vendas registradas ainda.")}</section><section class="panel"><h2>Serviços e kits</h2>${list([...(s.servicos || []).map((x) => ({ ...x, tipo: "servico" })), ...(s.kits || []).map((x) => ({ ...x, tipo: "kit" }))], (x) => `<li><span>${esc(x.nome)}</span><span>${x.quantidade}x · ${x.tipo === "kit" ? `− ${money(x.descontoCents)} em desconto` : money(x.totalCents)}</span></li>`, "Nenhum serviço ou kit vendido ainda.")}</section><section class="panel"><h2>Interesse dos clientes</h2>${list((s.precoAvisos || []).slice(0, 5), (x) => `<li><a href="/produto.html?id=${encodeURIComponent(x.id)}">${esc(x.nome)}</a><span class="badge badge-demand">${icon("tag", { size: 14 })}${x.avisos} ${x.avisos === 1 ? "aviso" : "avisos"} de preço</span></li>`, "Nenhum aviso de queda de preço ativo.")}${s.perguntasPendentes ? `<button type="button" class="text-button" data-open-questions>${icon("question", { size: 16 })}${s.perguntasPendentes} ${s.perguntasPendentes === 1 ? "pergunta aguardando" : "perguntas aguardando"} resposta</button>` : ""}</section></div>`;
}
export async function adminPage(user) {
  if (!requireUser(user)) return;
  if (user.role !== "admin") {
    document.querySelector("#admin-content").innerHTML = emptyState({ symbol: "shield", title: "Acesso restrito", text: "Esta área está disponível apenas para administradores.", actions: '<a class="button" href="/">Voltar à loja</a>' });
    return;
  }
  let tab = "products";
  let items = [];
  let customers = [];
  let orderFilter = "todos";
  let query = "";
  const panel = document.querySelector("#admin-panel");
  async function stats() {
    const s = await api("/admin/summary");
    const totalStatus = Math.max(1, s.pedidos);
    document.querySelector("#stats").innerHTML = `<div class="kpis">${[
      ["card", "Volume de vendas", money(s.totalCents)],
      ["package", "Pedidos", s.pedidos],
      ["tag", "Ticket médio", money(s.ticketMedioCents)],
      ["user", "Clientes ativos", s.clientes],
      ["grid", "Produtos ativos", s.produtos],
      ["question", "Perguntas aguardando", s.perguntasPendentes || 0],
      ["wrench", "Encomendas em aberto", s.encomendasAbertas || 0],
      ["store", "Parcerias novas", s.parceriasNovas || 0],
    ]
      .map(([symbol, label, value]) => `<div class="stat">${icon(symbol, { size: 20 })}<span>${label}</span><strong>${value}</strong></div>`)
      .join("")}</div><div class="dash-grid"><section class="panel chart-panel"><h2>Vendas nos últimos 14 dias</h2>${chart(s.vendasPorDia)}</section><section class="panel"><h2>Pedidos por status</h2><ul class="status-bars">${statuses
      .map((st) => `<li><span class="status status-${statusClass(st)}">${st}</span><span class="status-track"><span style="width:${Math.round((s.porStatus[st] / totalStatus) * 100)}%"></span></span><strong>${s.porStatus[st]}</strong></li>`)
      .join("")}</ul></section><section class="panel"><h2>Estoque baixo</h2>${s.estoqueBaixo.length ? `<ul class="low-stock">${s.estoqueBaixo.map((p) => { const wanted = (s.procura || []).find((x) => x.id === p.id)?.avisos || 0; return `<li><a href="/produto.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a>${wanted ? `<span class="badge badge-demand">${icon("bell", { size: 14 })}${wanted} ${wanted === 1 ? "aviso" : "avisos"}</span>` : ""}<span class="badge ${p.estoque ? "badge-low" : "badge-out"}">${p.estoque ? `${p.estoque} un.` : "Esgotado"}</span></li>`; }).join("")}</ul>${s.procura?.length ? `<p class="small muted">Avisos: clientes esperando a reposição. Repor o estoque notifica todos de uma vez.</p>` : ""}` : '<p class="muted">Nenhum produto com 5 unidades ou menos.</p>'}</section></div>${insightsHTML(s)}`;
    document.querySelector("[data-open-questions]")?.addEventListener("click", () => document.querySelector("#tab-questions").click());
  }
  function toolbar(title, button) {
    return `<div class="admin-toolbar"><h2>${title}</h2><div class="row"><div class="admin-search">${icon("search", { size: 18 })}<label class="sr-only" for="admin-search">Buscar</label><input id="admin-search" type="search" placeholder="Buscar" value="${esc(query)}" autocomplete="off"></div>${button}</div></div>`;
  }
  function wireSearch(apply) {
    const input = panel.querySelector("#admin-search");
    input.addEventListener("input", () => {
      query = input.value;
      apply();
    });
    apply();
  }
  function filterRows() {
    const q = normalize(query);
    let shown = 0;
    panel.querySelectorAll("tbody tr").forEach((row) => {
      const match = !q || row.dataset.search.includes(q);
      row.hidden = !match;
      if (match) shown++;
    });
    const empty = panel.querySelector("#no-results");
    if (empty) empty.hidden = shown > 0;
  }
  function renderOrders() {
    const names = new Map(customers.map((c) => [c.id, c.nome]));
    const q = normalize(query);
    const list = items
      .filter((o) => orderFilter === "todos" || o.status === orderFilter)
      .filter((o) => !q || normalize(`${o.id} ${names.get(o.partitionKey) || ""}`).includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    panel.querySelector("#order-chips").innerHTML = ["todos", ...statuses]
      .map((st) => `<button type="button" class="chip" data-filter="${st}" aria-pressed="${orderFilter === st}">${st === "todos" ? "Todos" : st} <span class="chip-count">${st === "todos" ? items.length : items.filter((o) => o.status === st).length}</span></button>`)
      .join("");
    panel.querySelector("#order-list").innerHTML = list.length
      ? list.map((o) => orderCardHTML(o, { admin: true, customer: names.get(o.partitionKey) || "Cliente" })).join("")
      : emptyState({ symbol: "package", title: "Nenhum pedido encontrado.", level: 3 });
  }
  // Perguntas dos clientes: pendentes primeiro; responder notifica quem perguntou.
  function renderQuestions() {
    const q = normalize(query);
    const list = items.filter((x) => !q || normalize(`${x.produto} ${x.pergunta} ${x.autor}`).includes(q));
    const label = { pendente: "Aguardando resposta", respondida: "Respondida", oculta: "Oculta" };
    panel.querySelector("#question-list").innerHTML = list.length
      ? list
          .map(
            (x) => `<article class="panel question-admin" data-question="${esc(x.id)}"><header><span class="badge ${x.status === "pendente" ? "badge-low" : x.status === "oculta" ? "badge-out" : "badge-in"}">${label[x.status]}</span><a href="/produto.html?id=${encodeURIComponent(x.productId)}#perguntas">${esc(x.produto)}</a><small class="muted">${esc(x.autor)} · ${new Date(x.createdAt).toLocaleDateString("pt-BR")}</small></header><p class="question-text">${esc(x.pergunta)}</p>${
              x.status === "oculta"
                ? ""
                : `<form class="question-form" data-answer="${esc(x.id)}"><label for="answer-${esc(x.id)}">${x.resposta ? "Editar resposta" : "Resposta da loja"}</label><textarea id="answer-${esc(x.id)}" name="resposta" rows="3" minlength="2" maxlength="1000" required>${esc(x.resposta || "")}</textarea><div class="row"><button type="submit">${x.resposta ? "Salvar resposta" : "Responder"}</button>${x.status === "pendente" ? `<button type="button" class="text-button danger-text" data-hide="${esc(x.id)}">Ocultar pergunta</button>` : ""}</div></form>`
            }</article>`,
          )
          .join("")
      : emptyState({ symbol: "question", title: query ? "Nenhuma pergunta encontrada." : "Nenhuma pergunta ainda.", level: 3 });
  }
  async function load() {
    panel.innerHTML = loadingHTML();
    if (tab === "assistant") {
      items = await api("/admin/assistente");
      panel.innerHTML = `${toolbar("Frases que o assistente não entendeu", items.length ? `<button type="button" class="secondary" id="clear-misses">${icon("trash", { size: 18 })}Limpar lista</button>` : "")}<p class="form-help">Guardadas sem identificar o cliente (sem conta, e-mail, códigos de pedido ou telefones), por até 90 dias. Use para ensinar novas frases ao assistente em <code>src/assistant/intents.js</code> ou na Central de Ajuda.</p>${
        items.length
          ? `<div class="table-wrap"><table><thead><tr><th>Frase</th><th>Vezes</th><th>Última</th></tr></thead><tbody>${items.map((x) => `<tr data-search="${esc(normalize(x.texto))}"><td>${esc(x.texto)}</td><td>${x.vezes}</td><td>${new Date(x.ultima).toLocaleDateString("pt-BR")}</td></tr>`).join("")}</tbody></table></div><p id="no-results" class="muted" hidden>Nenhuma frase encontrada.</p>`
          : emptyState({ symbol: "chat", title: "Nenhuma frase pendente.", text: "Quando o assistente não entender uma mensagem, ela aparece aqui.", level: 3 })
      }`;
      panel.querySelector("#clear-misses")?.addEventListener("click", async () => {
        if (!(await confirmDialog({ title: "Limpar a lista?", text: "As frases guardadas serão apagadas.", confirm: "Limpar", cancel: "Voltar", danger: true }))) return;
        await send("/admin/assistente", {}, "DELETE");
        toast("Lista limpa.", { type: "success" });
        await load();
      });
      wireSearch(filterRows);
      return;
    }
    // Etapa 34: cupons. Os padrão podem ser desativados ou limitados; novos têm validade e limite.
    if (tab === "coupons") {
      items = await api("/admin/cupons");
      const typeLabel = { percent: "Porcentagem", fixed: "Valor fixo", shipping: "Frete grátis" };
      const valueText = (c) => (c.type === "percent" ? `${c.value}%${c.maxCents ? ` (até ${money(c.maxCents)})` : ""}` : c.type === "fixed" ? money(c.value) : "Frete");
      const badge = { Ativo: "badge-in", Desativado: "badge-out", Expirado: "badge-out", Esgotado: "badge-low" };
      const render = () => {
        const q = normalize(panel.querySelector("#admin-search")?.value || "");
        panel.querySelector("#coupon-rows").innerHTML = items
          .filter((c) => !q || normalize(`${c.codigo} ${c.description}`).includes(q))
          .map((c) => `<tr><th scope="row">${esc(c.codigo)}${c.padrao ? ' <span class="badge">padrão</span>' : ""}</th><td>${esc(c.description)}</td><td>${typeLabel[c.type]} · ${valueText(c)}${c.minCents ? `<br><small class="muted">mínimo ${money(c.minCents)}</small>` : ""}</td><td>${c.usos || 0}${c.limiteUsos ? ` / ${c.limiteUsos}` : ""}${c.umPorCliente ? '<br><small class="muted">1 por cliente</small>' : ""}</td><td>${c.validoAte ? new Date(`${c.validoAte}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem validade"}</td><td><span class="badge ${badge[c.situacao]}">${c.situacao}</span></td><td><button type="button" class="text-button" data-coupon-toggle="${esc(c.codigo)}" data-on="${c.ativo !== false}">${c.ativo !== false ? "Desativar" : "Ativar"}</button></td></tr>`)
          .join("");
      };
      panel.innerHTML = `${toolbar("Cupons", "")}<p class="form-help">O cupom é conferido de novo no checkout. Desativar, vencer ou atingir o limite tira o cupom do carrinho, da ajuda e do assistente na hora.</p><div class="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Desconto</th><th>Usos</th><th>Validade</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody id="coupon-rows"></tbody></table></div>
<form class="admin-form panel" id="coupon-form" novalidate><h3>Novo cupom</h3><div class="form-grid"><div class="field"><label for="cp-codigo">Código</label><input id="cp-codigo" name="codigo" required maxlength="30" pattern="[A-Za-z0-9]{3,30}" autocomplete="off"></div><div class="field"><label for="cp-type">Tipo</label><select id="cp-type" name="type"><option value="percent">Porcentagem</option><option value="fixed">Valor fixo</option><option value="shipping">Frete grátis</option></select></div><div class="field"><label for="cp-value">Valor (% ou R$)</label><input id="cp-value" name="valor" type="number" min="1" step="1"></div><div class="field"><label for="cp-min">Compra mínima (R$)</label><input id="cp-min" name="minimo" type="number" min="1" step="1"></div><div class="field"><label for="cp-max">Desconto máximo (R$)</label><input id="cp-max" name="maximo" type="number" min="1" step="1"></div><div class="field"><label for="cp-validade">Válido até</label><input id="cp-validade" name="validoAte" type="date"></div><div class="field"><label for="cp-limite">Limite de usos</label><input id="cp-limite" name="limiteUsos" type="number" min="1" step="1"></div><div class="field field-wide"><label for="cp-desc">Descrição para o cliente</label><input id="cp-desc" name="description" required minlength="3" maxlength="120"></div><label class="check"><input type="checkbox" name="umPorCliente"><span>Um uso por cliente</span></label></div><div class="row"><button type="submit">Criar cupom</button></div></form>`;
      const form = panel.querySelector("#coupon-form");
      bindForm(form, async (data) => {
        const reais = (v) => (v === "" || v === undefined ? null : Math.round(Number(v) * 100));
        const created = await send("/admin/cupons", {
          codigo: data.codigo,
          type: data.type,
          value: data.type === "percent" ? Number(data.valor) : data.type === "fixed" ? reais(data.valor) : null,
          minCents: reais(data.minimo),
          maxCents: data.type === "percent" ? reais(data.maximo) : null,
          validoAte: data.validoAte || null,
          limiteUsos: data.limiteUsos ? Number(data.limiteUsos) : null,
          description: data.description,
          umPorCliente: form.elements.umPorCliente.checked,
        });
        items = [...items, created];
        form.reset();
        toast(`Cupom ${created.codigo} criado.`, { type: "success" });
        render();
      });
      panel.querySelector("#coupon-rows").addEventListener("click", async (event) => {
        const b = event.target.closest("[data-coupon-toggle]");
        if (!b) return;
        try {
          const updated = await send(`/admin/cupons/${encodeURIComponent(b.dataset.couponToggle)}`, { ativo: b.dataset.on !== "true" }, "PATCH");
          items = items.map((c) => (c.codigo === updated.codigo ? updated : c));
          toast(`Cupom ${updated.codigo} ${updated.ativo ? "ativado" : "desativado"}.`, { type: "success" });
          render();
        } catch (e) {
          toast(e.message, { type: "error" });
        }
      });
      render();
      wireSearch(render);
      return;
    }
    // Etapa 33: encomendas (resposta avisa o cliente) e fichas de parceria.
    if (tab === "requests") {
      items = await api("/admin/encomendas");
      const statusList = ["Recebida", "Em análise", "Orçamento enviado", "Aprovada", "Recusada", "Concluída"];
      const render = () => {
        const q = normalize(panel.querySelector("#admin-search")?.value || "");
        const list = items.filter((x) => !q || normalize(`${x.codigo} ${x.produto} ${x.cliente} ${x.detalhes}`).includes(q));
        panel.querySelector("#request-admin-list").innerHTML = list.length
          ? list
              .map(
                (x) => `<article class="panel question-admin"><header><span class="badge ${["Recebida", "Em análise"].includes(x.status) ? "badge-low" : x.status === "Recusada" ? "badge-out" : "badge-in"}">${esc(x.status)}</span><strong>${esc(x.codigo)} · ${esc(x.tipoNome)}</strong><small class="muted">${esc(x.cliente)} · ${esc(x.email)}${x.telefone ? ` · ${esc(x.telefone)} (${esc(x.contato)})` : ""} · ${new Date(x.createdAt).toLocaleDateString("pt-BR")}</small></header><p class="question-text"><strong>${esc(x.produto)}</strong></p>${x.detalhes ? `<p class="small pre-line">${esc(x.detalhes)}</p>` : ""}<p class="small muted">Orçamento do cliente: ${x.orcamentoCents ? money(x.orcamentoCents) : "não informado"} · Prazo: ${esc(x.prazo)}</p><form class="question-form" data-request="${esc(x.id)}"><div class="form-grid"><div class="field"><label for="rs-${esc(x.id)}">Status</label><select id="rs-${esc(x.id)}" name="status">${statusList.map((s) => `<option${s === x.status ? " selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="rv-${esc(x.id)}">Valor orçado (R$)</label><input id="rv-${esc(x.id)}" name="valor" type="number" min="100" step="1" value="${x.valorCents ? x.valorCents / 100 : ""}"></div><div class="field"><label for="rp-${esc(x.id)}">Prazo (dias)</label><input id="rp-${esc(x.id)}" name="prazoDias" type="number" min="1" max="365" value="${x.prazoDias || ""}"></div></div><label for="rr-${esc(x.id)}">Resposta para o cliente</label><textarea id="rr-${esc(x.id)}" name="resposta" rows="3" maxlength="1500">${esc(x.resposta)}</textarea><div class="row"><button type="submit">Salvar e avisar o cliente</button></div></form></article>`,
              )
              .join("")
          : emptyState({ symbol: "wrench", title: "Nenhuma encomenda ainda.", level: 3 });
      };
      panel.innerHTML = `${toolbar("Encomendas", "")}<p class="form-help">Guitarras personalizadas e produtos fora do catálogo pedidos pelos clientes (pelo site ou pelo assistente). Mudar o status ou a resposta avisa o cliente nas notificações.</p><div class="question-list" id="request-admin-list"></div>`;
      panel.querySelector("#request-admin-list").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target.closest("[data-request]");
        const el = form.elements;
        form.querySelector("[type=submit]").disabled = true;
        try {
          const updated = await send(`/admin/encomendas/${form.dataset.request}`, { status: el.status.value, resposta: el.resposta.value.trim(), valorCents: el.valor.value ? Math.round(Number(el.valor.value) * 100) : null, prazoDias: el.prazoDias.value ? Number(el.prazoDias.value) : null }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          toast("Encomenda atualizada; o cliente foi avisado.", { type: "success" });
          render();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
          form.querySelector("[type=submit]").disabled = false;
        }
      });
      render();
      wireSearch(render);
      return;
    }
    if (tab === "partners") {
      items = await api("/admin/parcerias");
      const statusList = ["Nova", "Em contato", "Aprovada", "Recusada"];
      const render = () => {
        const q = normalize(panel.querySelector("#admin-search")?.value || "");
        const list = items.filter((x) => !q || normalize(`${x.razaoSocial} ${x.nomeFantasia} ${x.cnpj} ${x.contatoNome} ${x.produtos.join(" ")} ${x.marcas}`).includes(q));
        panel.querySelector("#partner-admin-list").innerHTML = list.length
          ? list
              .map(
                (x) => `<article class="panel question-admin"><header><span class="badge ${x.status === "Nova" ? "badge-low" : x.status === "Recusada" ? "badge-out" : "badge-in"}">${esc(x.status)}</span><strong>${esc(x.nomeFantasia || x.razaoSocial)}</strong><small class="muted">CNPJ ${esc(x.cnpj)} · ${esc(x.modalidade)} · ${new Date(x.createdAt).toLocaleDateString("pt-BR")}</small></header><p class="small"><strong>Produtos:</strong> ${esc(x.produtos.join(", "))}${x.marcas ? ` · <strong>Marcas:</strong> ${esc(x.marcas)}` : ""}</p><p class="small"><strong>Contato:</strong> ${esc(x.contatoNome)}${x.cargo ? ` (${esc(x.cargo)})` : ""} · <a href="mailto:${esc(x.email)}">${esc(x.email)}</a> · ${esc(x.telefone)}${x.site ? ` · <a href="${esc(x.site)}" rel="noopener noreferrer" target="_blank">site</a>` : ""}</p>${x.mensagem ? `<p class="small pre-line">${esc(x.mensagem)}</p>` : ""}<form class="question-form" data-partner="${esc(x.id)}"><div class="form-grid"><div class="field"><label for="ps-${esc(x.id)}">Status</label><select id="ps-${esc(x.id)}" name="status">${statusList.map((s) => `<option${s === x.status ? " selected" : ""}>${s}</option>`).join("")}</select></div></div><label for="pn-${esc(x.id)}">Notas internas</label><textarea id="pn-${esc(x.id)}" name="notas" rows="2" maxlength="1000">${esc(x.notas)}</textarea><div class="row"><button type="submit">Salvar</button></div></form></article>`,
              )
              .join("")
          : emptyState({ symbol: "store", title: "Nenhuma ficha de parceria ainda.", level: 3 });
      };
      panel.innerHTML = `${toolbar("Parcerias e fornecedores", "")}<p class="form-help">Fichas enviadas pela página Seja um parceiro. As notas são internas.</p><div class="question-list" id="partner-admin-list"></div>`;
      panel.querySelector("#partner-admin-list").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target.closest("[data-partner]");
        try {
          const updated = await send(`/admin/parcerias/${form.dataset.partner}`, { status: form.elements.status.value, notas: form.elements.notas.value.trim() }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          toast("Ficha atualizada.", { type: "success" });
          render();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
        }
      });
      render();
      wireSearch(render);
      return;
    }
    if (tab === "questions") {
      items = await api("/admin/questions");
      const pending = items.filter((x) => x.status === "pendente").length;
      panel.innerHTML = `${toolbar(`Perguntas ${pending ? `<span class="chip-count">${pending} aguardando</span>` : ""}`, "")}<p class="form-help">Só as perguntas respondidas aparecem na página do produto. Quem perguntou recebe a resposta nas notificações.</p><div class="question-list" id="question-list"></div>`;
      const list = panel.querySelector("#question-list");
      list.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target.closest("[data-answer]");
        const resposta = form.elements.resposta.value.trim();
        if (resposta.length < 2) return toast("Escreva a resposta antes de enviar.", { type: "error" });
        form.querySelector("[type=submit]").disabled = true;
        try {
          const updated = await send(`/admin/questions/${form.dataset.answer}`, { resposta }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          toast("Resposta publicada na página do produto.", { type: "success" });
          renderQuestions();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
          form.querySelector("[type=submit]").disabled = false;
        }
      });
      list.addEventListener("click", async (event) => {
        const hide = event.target.closest("[data-hide]");
        if (!hide || !(await confirmDialog({ title: "Ocultar esta pergunta?", text: "Ela não será publicada nem respondida.", confirm: "Ocultar", cancel: "Voltar", danger: true }))) return;
        try {
          const updated = await send(`/admin/questions/${hide.dataset.hide}`, { ocultar: true }, "PATCH");
          items = items.map((x) => (x.id === updated.id ? updated : x));
          renderQuestions();
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
        }
      });
      wireSearch(renderQuestions);
      return;
    }
    if (tab === "orders") {
      [items, customers] = await Promise.all([api("/admin/orders"), api("/admin/customers")]);
      panel.innerHTML = `${toolbar("Pedidos", "")}<p class="form-help">Status avançam no fluxo; o cancelamento, permitido até a preparação, devolve os itens ao estoque.</p><div class="chip-row" id="order-chips"></div><div class="order-list" id="order-list"></div>`;
      panel.querySelector("#order-chips").addEventListener("click", (event) => {
        const chip = event.target.closest("[data-filter]");
        if (!chip) return;
        orderFilter = chip.dataset.filter;
        renderOrders();
      });
      panel.querySelector("#order-list").addEventListener("change", async (event) => {
        const select = event.target.closest("[data-status-select]");
        if (!select?.value) return;
        const id = select.closest("[data-order-id]").dataset.orderId;
        const status = select.value;
        if (status === "Cancelado" && !(await confirmDialog({ title: "Cancelar este pedido?", text: "Os itens voltam para o estoque e o pedido não poderá ser reaberto.", confirm: "Cancelar pedido", cancel: "Manter", danger: true }))) {
          select.value = "";
          return;
        }
        select.disabled = true;
        try {
          const updated = await send(`/admin/orders/${id}`, { status }, "PATCH");
          items = items.map((o) => (o.id === updated.id ? updated : o));
          renderOrders();
          toast(status === "Cancelado" ? "Pedido cancelado; itens devolvidos ao estoque." : `Status alterado para ${status}.`, { type: "success" });
          await stats();
        } catch (e) {
          toast(e.message, { type: "error" });
          await load();
        }
      });
      panel.querySelector("#order-list").addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-exchange]");
        if (!form) return;
        event.preventDefault();
        const status = event.submitter?.value;
        try {
          const updated = await send(`/admin/orders/${form.dataset.exchange}/troca`, { status, resposta: form.elements.resposta.value }, "PATCH");
          items = items.map((o) => (o.id === updated.id ? updated : o));
          renderOrders();
          toast(`Solicitação ${status === "Aprovada" ? "aprovada" : "recusada"}; o cliente foi avisado.`, { type: "success" });
        } catch (e) {
          toast(e.message, { type: "error" });
        }
      });
      wireSearch(renderOrders);
      return;
    }
    items = await api(tab === "products" ? "/products" : `/admin/${tab}`);
    const product = tab === "products";
    panel.innerHTML = `${toolbar(product ? "Equipamentos" : "Clientes", `<button id="new-record">${icon("plus", { size: 18 })}${product ? "Cadastrar produto" : "Cadastrar cliente"}</button>`)}<div id="editor"></div>${
      items.length
        ? `<div class="table-wrap"><table><thead><tr><th>${product ? "Produto" : "Cliente"}</th><th>${product ? "Preço" : "Contato"}</th><th>${product ? "Estoque" : "Papel"}</th><th>Ações</th></tr></thead><tbody>${items
            .map(
              (i) =>
                `<tr data-search="${esc(normalize(product ? `${i.marca} ${i.modelo} ${i.categoria}` : `${i.nome} ${i.email}`))}"><td>${product ? `<div class="admin-product"><img src="${esc(productImage(i))}" alt="" loading="lazy"><div><strong>${esc(i.modelo)}</strong><small>${esc(i.marca)} · ${esc(i.categoria)}</small></div></div>` : `<strong>${esc(i.nome)}</strong><small>${esc(i.email)}</small>`}</td><td>${product ? money(i.priceCents) : esc(i.telefone || "—")}</td><td>${product ? `<span class="badge ${i.estoque === 0 ? "badge-out" : i.estoque <= 5 ? "badge-low" : ""}">${i.estoque} un.</span>` : esc(i.role === "admin" ? "Administrador" : "Cliente")}</td><td class="actions"><button class="secondary" data-edit="${i.id}">Editar</button>${product ? `<button class="secondary" data-image="${i.id}">Imagem</button>` : `<button class="secondary" data-history="${i.id}">Compras</button>`}${i.role === "admin" ? "" : `<button class="danger" data-delete="${i.id}">Excluir</button>`}</td></tr>`,
            )
            .join("")}</tbody></table><div id="no-results" hidden>${emptyState({ symbol: "search", title: "Nada encontrado com essa busca.", level: 3 })}</div></div>`
        : emptyState({ symbol: "grid", title: "Nenhum registro cadastrado.", level: 3 })
    }`;
    panel.querySelector("#new-record").onclick = () => edit();
    panel.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit(items.find((i) => i.id === b.dataset.edit))));
    panel.querySelectorAll("[data-image]").forEach((b) => (b.onclick = () => imageEditor(items.find((i) => i.id === b.dataset.image))));
    panel.querySelectorAll("[data-history]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            const orders = (await api("/admin/orders")).filter((o) => o.partitionKey === b.dataset.history);
            const editor = document.querySelector("#editor");
            editor.innerHTML = `<section class="admin-form"><h3>Compras de ${esc(items.find((i) => i.id === b.dataset.history).nome)}</h3>${orders.length ? orders.map((o) => orderCardHTML(o, { readonly: true })).join("") : '<p class="muted">Nenhuma compra registrada.</p>'}</section>`;
            editor.scrollIntoView({ block: "start" });
          } catch (e) {
            toast(e.message, { type: "error" });
          }
        }),
    );
    panel.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!(await confirmDialog({ title: "Excluir este registro?", text: "A exclusão é lógica: o histórico de pedidos é preservado.", confirm: "Excluir", danger: true }))) return;
          b.disabled = true;
          try {
            await api(`/admin/${tab}/${b.dataset.delete}`, { method: "DELETE" });
            toast("Registro excluído.", { type: "success" });
            await load();
            await stats();
          } catch (e) {
            toast(e.message, { type: "error" });
            b.disabled = false;
          }
        }),
    );
    wireSearch(filterRows);
  }
  function edit(item = {}) {
    const editor = document.querySelector("#editor");
    const product = tab === "products";
    editor.innerHTML = `<form class="admin-form" id="record-form"><h3>${item.id ? "Editar" : "Cadastrar"} ${product ? "produto" : "cliente"}</h3><div class="form-grid">${product ? `${field("marca", "Marca", item.marca, "text", 'required maxlength="200"')}${field("modelo", "Modelo", item.modelo, "text", 'required maxlength="200"')}<div class="field"><label for="edit-categoria">Categoria</label><select id="edit-categoria" name="categoria">${categories.map((c) => `<option${c === item.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></div>${field("preco", "Preço (R$)", item.priceCents ? (item.priceCents / 100).toFixed(2) : "", "number", 'required min="0.01" max="1000000" step="0.01"')}${field("estoque", "Estoque", item.estoque ?? 0, "number", 'required min="0" max="100000" step="1"')}${Array.isArray(item.cores) && item.cores.length ? `<fieldset class="field field-wide color-stock-editor"><legend>Estoque por cor (opcional)</legend><p class="form-help">Deixe em branco para não controlar por cor. A soma não pode passar do estoque total.</p><div class="form-grid">${item.cores.map((c, i) => `<div class="field"><label for="cor-estoque-${i}">${esc(c.nome)}</label><input id="cor-estoque-${i}" type="number" min="0" max="100000" step="1" data-color-stock="${esc(c.nome)}" value="${Number.isInteger(c.estoque) ? c.estoque : ""}"></div>`).join("")}</div></fieldset>` : ""}${""}<div class="field span-two"><label for="edit-descricao">Descrição</label><textarea id="edit-descricao" name="descricao" required minlength="10" maxlength="4000">${esc(item.descricao || "")}</textarea></div><div class="span-two" id="edit-specs">${specsEditor(item.categoria || categories[0], item.ficha)}</div>` : `${field("nome", "Nome completo", item.nome, "text", 'required minlength="2" maxlength="200"')}${field("email", "E-mail", item.email, "email", item.id ? "readonly" : 'required maxlength="200"')}${field("telefone", "Telefone", item.telefone, "tel", 'maxlength="30"')}${field("endereco", "Endereço", item.endereco, "text", 'maxlength="500"')}${item.id ? "" : field("senha", "Senha inicial (10 a 72 caracteres)", "", "password", 'required minlength="10" maxlength="72" autocomplete="new-password"')}`}</div><div class="row"><button type="submit">Salvar ${product ? "produto" : "cliente"}</button><button type="button" id="cancel-edit" class="secondary">Cancelar</button></div></form>`;
    document.querySelector("#cancel-edit").onclick = () => (editor.innerHTML = "");
    const form = document.querySelector("#record-form");
    form.querySelector("input").focus();
    // Trocar a categoria troca os campos da ficha (os valores anteriores não se aplicam).
    form.elements.categoria?.addEventListener("change", (event) => {
      form.querySelector("#edit-specs").innerHTML = specsEditor(event.target.value, event.target.value === item.categoria ? item.ficha : {});
    });
    bindForm(form, async (data) => {
      if (product) {
        data.priceCents = Math.round(Number(data.preco) * 100);
        data.estoque = Number(data.estoque);
        for (const key of Object.keys(data)) if (key.startsWith("ficha.")) delete data[key];
        data.ficha = readSpecs(form, data.categoria);
        const colorInputs = [...form.querySelectorAll("[data-color-stock]")];
        if (colorInputs.length) data.estoqueCores = Object.fromEntries(colorInputs.map((el) => [el.dataset.colorStock, el.value === "" ? null : Number(el.value)]));
      }
      await send(`/admin/${tab}${item.id ? `/${item.id}` : ""}`, data, item.id ? "PATCH" : "POST");
      toast("Registro salvo.", { type: "success" });
      await load();
      await stats();
    });
  }
  function imageEditor(item) {
    const editor = document.querySelector("#editor");
    editor.innerHTML = `<form id="image-form" class="admin-form"><h3>Imagem de ${esc(item.modelo)}</h3><img class="image-preview" src="${esc(productImage(item))}" alt="Imagem atual de ${esc(item.modelo)}"><p class="form-help">JPEG, PNG ou WebP, até 5 MB. Use apenas imagens próprias ou licenciadas. A imagem anterior será substituída.</p><div class="field"><label for="image">Escolher imagem</label><input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp" required></div><button type="submit">Enviar imagem</button></form>`;
    bindForm(document.querySelector("#image-form"), async (_data, form) => {
      const file = form.elements.image.files[0];
      if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
      await api(`/admin/products/${item.id}/image`, { method: "POST", body: new FormData(form) });
      toast("Imagem atualizada.", { type: "success" });
      await load();
    });
  }
  document.querySelectorAll("[data-tab]").forEach((b, index, buttons) => {
    b.onclick = async () => {
      tab = b.dataset.tab;
      query = "";
      buttons.forEach((x) => {
        x.setAttribute("aria-selected", x === b);
        x.classList.toggle("secondary", x !== b);
      });
      panel.setAttribute("aria-labelledby", b.id);
      try {
        await load();
      } catch (e) {
        errorState(panel, e, () => b.click(), { title: "Não foi possível carregar esta aba." });
      }
    };
    b.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        buttons[next].click();
      }
    };
  });
  // Indicadores e lista falham de forma independente, cada um com nova tentativa.
  const retryStats = async () => {
    try {
      await stats();
    } catch (e) {
      errorState(document.querySelector("#stats"), e, retryStats, { title: "Não foi possível carregar os indicadores." });
    }
  };
  const retryLoad = async () => {
    try {
      await load();
    } catch (e) {
      errorState(panel, e, retryLoad, { title: "Não foi possível carregar esta aba." });
    }
  };
  await Promise.all([retryStats(), retryLoad()]);
}
