// Etapa 33: encomendas. O formulário abre para todos (o assistente pode preencher pela URL);
// para enviar é preciso estar logado: o rascunho fica no navegador e volta depois do login.
import { api, send, bindForm, escapeHtml as esc, money, toast } from "../common.js";
import { emptyState } from "../components.js";

const DRAFT = "vv_encomenda_rascunho";
const STATUS_BADGE = { Recebida: "badge-low", "Em análise": "badge-low", "Orçamento enviado": "badge-in", Aprovada: "badge-in", Recusada: "badge-out", Concluída: "badge-in" };
const date = (iso) => new Date(iso).toLocaleDateString("pt-BR");

function fill(form, data) {
  for (const [name, value] of Object.entries(data)) {
    const field = form.elements[name];
    if (!field || value === undefined || value === null) continue;
    if (field instanceof RadioNodeList || field.type === "radio") form.querySelectorAll(`[name="${name}"]`).forEach((r) => (r.checked = r.value === value));
    else field.value = value;
  }
}
// Dados vindos do assistente: ?tipo=personalizado&itens=Base: ...; Captadores: ...&descricao=...
export function fromQuery(search) {
  const q = new URLSearchParams(search);
  if (!q.get("descricao") && !q.get("itens")) return null;
  const itens = (q.get("itens") || "").split(";").map((s) => s.trim()).filter(Boolean);
  const base = itens.find((i) => /^Base:/.test(i))?.replace(/^Base:\s*/, "");
  const descricao = (q.get("descricao") || "").slice(0, 300);
  return {
    tipo: q.get("tipo") === "importacao" ? "importacao" : "personalizado",
    produto: (base || descricao || "").slice(0, 120),
    detalhes: [itens.filter((i) => !/^Base:/.test(i)).join("\n"), descricao && `Pedido ao assistente: “${descricao}”`].filter(Boolean).join("\n\n").slice(0, 1500),
  };
}
export function requestCard(r) {
  return `<article class="request-item"><header><strong>${esc(r.codigo)}</strong><span class="badge ${STATUS_BADGE[r.status] || "badge-low"}">${esc(r.status)}</span></header><p>${esc(r.tipoNome)}: ${esc(r.produto)}</p>${r.resposta ? `<p class="request-answer"><strong>Resposta da loja:</strong> ${esc(r.resposta)}</p>` : ""}${r.valorCents || r.prazoDias ? `<p class="small">${r.valorCents ? `Orçamento: ${money(r.valorCents)}` : ""}${r.valorCents && r.prazoDias ? " · " : ""}${r.prazoDias ? `Prazo: ${r.prazoDias} dias` : ""}</p>` : ""}<small class="muted">Enviada em ${date(r.createdAt)}</small></article>`;
}

export default async function requestPage(session) {
  const user = await session;
  const form = document.querySelector("#request-form");
  const phoneField = document.querySelector("#request-telefone-field");
  const syncPhone = () => {
    const needs = form.elements.contato.value !== "E-mail";
    phoneField.hidden = !needs;
    form.elements.telefone.required = needs;
  };
  form.elements.contato.addEventListener("change", syncPhone);
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT) || "null");
  } catch {
    draft = null;
  }
  const incoming = fromQuery(location.search);
  if (incoming) {
    fill(form, incoming);
    document.querySelector("#request-from-assistant").hidden = false;
  } else if (draft) fill(form, draft);
  syncPhone();
  document.querySelector("#request-login-note").hidden = Boolean(user);

  const list = document.querySelector("#request-list");
  const mine = document.querySelector("#minhas");
  async function loadMine() {
    if (!user) return;
    mine.hidden = false;
    try {
      const items = await api("/encomendas");
      list.innerHTML = items.length ? items.map(requestCard).join("") : emptyState({ symbol: "package", title: "Nenhuma encomenda ainda.", text: "As respostas da loja aparecem aqui e nas Notificações.", level: 3 });
    } catch (e) {
      list.innerHTML = `<p class="field-error">${esc(e.message)}</p>`;
    }
    if (location.hash === "#minhas") mine.scrollIntoView({ block: "start" });
  }
  loadMine();

  bindForm(form, async (data) => {
    const body = {
      tipo: data.tipo,
      produto: data.produto,
      detalhes: data.detalhes,
      prazo: data.prazo,
      contato: data.contato,
      telefone: data.telefone,
      ...(data.orcamento ? { orcamentoCents: Math.round(Number(data.orcamento) * 100) } : {}),
    };
    if (!user) {
      try {
        sessionStorage.setItem(DRAFT, JSON.stringify({ ...data }));
      } catch {
        /* sem armazenamento, a pessoa preenche de novo */
      }
      location.href = `/login.html?next=${encodeURIComponent("/encomenda.html")}`;
      return;
    }
    const saved = await send("/encomendas", body);
    try {
      sessionStorage.removeItem(DRAFT);
    } catch {
      /* nada a limpar */
    }
    form.reset();
    syncPhone();
    history.replaceState(null, "", "/encomenda.html#minhas");
    toast(`Encomenda ${saved.codigo} enviada. A resposta chega nas Notificações.`, { type: "success" });
    await loadMine();
  });
}
