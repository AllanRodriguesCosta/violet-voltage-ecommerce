import { icon } from "../icons.js";
import { compareRows } from "../specs.js";
import { catalogProducts, money, productImage, escapeHtml as esc, addCart, toast } from "../common.js";
import { emptyState, errorState, installmentText, productUrl, stockState } from "../components.js";
import { getCompare, setCompare, MAX_COMPARE } from "../compare.js";
import { alertButtonHTML } from "../alerts.js";

// Lista vinda do link (?ids=) tem prioridade: permite compartilhar a comparação.
function chosenIds() {
  const shared = new URLSearchParams(location.search).get("ids");
  if (shared) {
    const ids = [...new Set(shared.split(","))].filter((id) => /^[a-zA-Z0-9-]{1,100}$/.test(id)).slice(0, MAX_COMPARE);
    if (ids.length) {
      setCompare(ids);
      history.replaceState(null, "", "/comparar.html");
      return ids;
    }
  }
  return getCompare();
}

export default async function comparePage() {
  const container = document.querySelector("#compare-content");
  const lead = document.querySelector("#compare-lead");
  let onlyDiff = false;
  let products = [];
  async function render() {
    try {
      products = await catalogProducts();
    } catch (error) {
      errorState(container, error, render, { back: { href: "/catalogo.html", label: "Voltar ao catálogo" } });
      return;
    }
    const ids = getCompare();
    const list = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    if (list.length !== ids.length) setCompare(list.map((p) => p.id));
    if (list.length < 2) {
      lead.textContent = "Escolha de 2 a 4 equipamentos para ver as fichas lado a lado.";
      container.innerHTML = emptyState({
        symbol: "compare",
        title: list.length ? "Falta pelo menos mais um produto." : "Nenhum produto para comparar ainda.",
        text: 'No catálogo ou na página do produto, toque em <strong>Comparar</strong> nos itens que você quer ver lado a lado.',
        actions: `<a class="button" href="/catalogo.html${list[0] ? `?categoria=${encodeURIComponent(list[0].categoria)}` : ""}">Escolher no catálogo</a>`,
      });
      return;
    }
    const categories = new Set(list.map((p) => p.categoria));
    lead.textContent = `${list.length} equipamentos lado a lado. As linhas destacadas mostram onde eles se diferenciam.`;
    const rows = compareRows(list);
    const cheapest = Math.min(...list.map((p) => p.priceCents));
    const visible = onlyDiff ? rows.filter((r) => r.differs) : rows;
    const head = list
      .map((p) => {
        const name = `${p.marca} ${p.modelo}`;
        const stock = stockState(p);
        return `<th scope="col" class="compare-product"><button type="button" class="icon-button compare-remove" data-remove="${esc(p.id)}" aria-label="Remover ${esc(name)} da comparação">${icon("close", { size: 18 })}</button><a href="${productUrl(p)}"><img src="${esc(productImage(p))}" alt="" width="120" height="120" loading="lazy"><span class="product-brand">${esc(p.marca)}</span><strong>${esc(p.modelo)}</strong></a><span class="compare-price">${money(p.priceCents)}${p.priceCents === cheapest ? '<span class="badge badge-in">Menor preço</span>' : ""}</span><small>${installmentText(p.priceCents) || "&nbsp;"}</small><span class="small stock-${stock.key}">${stock.label}</span>${p.estoque ? `<button type="button" class="button small-button" data-add="${esc(p.id)}">${icon("bag", { size: 16 })}Adicionar</button>` : alertButtonHTML(p, { short: true, className: "button secondary small-button" })}</th>`;
      })
      .join("");
    const body = visible
      .map((r) => `<tr class="${r.differs ? "is-diff" : ""}"><th scope="row">${esc(r.label)}${r.differs ? '<span class="sr-only"> (diferente)</span>' : ""}</th>${r.values.map((v) => `<td>${esc(v || "—")}</td>`).join("")}</tr>`)
      .join("");
    container.innerHTML = `${categories.size > 1 ? `<p class="notice">${icon("info", { size: 18 })}<span>Você está comparando categorias diferentes (${esc([...categories].join(", "))}). A comparação faz mais sentido entre itens da mesma categoria.</span></p>` : ""}<div class="compare-tools"><label class="check"><input type="checkbox" id="only-diff"${onlyDiff ? " checked" : ""}><span>Mostrar só as diferenças</span></label><button type="button" class="text-button" data-share-compare>${icon("share", { size: 16 })}Copiar link da comparação</button><button type="button" class="text-button" data-clear>${icon("trash", { size: 16 })}Limpar comparação</button>${list.length < MAX_COMPARE ? `<a class="text-link" href="/catalogo.html?categoria=${encodeURIComponent(list[0].categoria)}">${icon("plus", { size: 16 })}Adicionar outro</a>` : ""}</div><div class="table-wrap compare-wrap" role="region" aria-label="Tabela de comparação" tabindex="0"><table class="compare-table"><caption class="sr-only">Comparação de ${list.length} produtos</caption><thead><tr><td></td>${head}</tr></thead><tbody>${body || `<tr><td colspan="${list.length + 1}">Nenhuma diferença na ficha técnica: compare preço e disponibilidade acima.</td></tr>`}</tbody></table></div>`;
  }
  container.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-remove]");
    const add = event.target.closest("[data-add]");
    if (remove) {
      setCompare(getCompare().filter((id) => id !== remove.dataset.remove));
      await render();
      container.querySelector(".compare-remove, a.button")?.focus();
    } else if (add) {
      const p = products.find((x) => x.id === add.dataset.add);
      if (p) addCart(p, 1, { source: add.closest("th")?.querySelector("img") });
    } else if (event.target.closest("[data-clear]")) {
      setCompare([]);
      await render();
      container.querySelector("a.button")?.focus();
    } else if (event.target.closest("[data-share-compare]")) {
      const url = `${location.origin}/comparar.html?ids=${getCompare().map(encodeURIComponent).join(",")}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("Link da comparação copiado.", { type: "success" });
      } catch {
        toast(`Copie o endereço: ${url}`, { type: "info" });
      }
    }
  });
  container.addEventListener("change", (event) => {
    if (event.target.id !== "only-diff") return;
    onlyDiff = event.target.checked;
    render().then(() => container.querySelector("#only-diff")?.focus());
  });
  document.addEventListener("vv:compare", () => {
    if (!container.contains(document.activeElement)) render();
  });
  chosenIds();
  await render();
}
