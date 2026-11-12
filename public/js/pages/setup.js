// Monte seu setup: escolha guiada por etapa, total com parcelas e frete grátis,
// link compartilhável (?itens=) e tudo no carrinho de uma vez.
import { icon } from "../icons.js";
import { catalogProducts, getCart, setCart, money, productImage, escapeHtml as esc, toast } from "../common.js";
import { stockState, installmentText, freeShippingHTML, productUrl, errorState, skeletonCards } from "../components.js";
import { openCart } from "../drawer.js";
import { GENEROS, fitsGenre } from "../specs.js";

const steps = [
  { id: "guitarra", categoria: "Guitarras", title: "Guitarra", hint: "O coração do setup. Escolha uma.", multi: false },
  { id: "amplificador", categoria: "Amplificadores", title: "Amplificador", hint: "Onde o timbre ganha corpo. Escolha um.", multi: false },
  { id: "efeitos", categoria: "Pedais", title: "Efeitos", hint: "Pedais, pedaleiras e pedalboards. Escolha quantos quiser.", multi: true },
  { id: "cabos", categoria: "Cabos", title: "Cabos", hint: "Do instrumento ao amplificador e entre os pedais.", multi: true },
  { id: "correia", categoria: "Correias", title: "Correia", hint: "Conforto para tocar em pé. Escolha uma.", multi: false },
  { id: "acessorios", categoria: "Acessórios", title: "Acessórios", hint: "Suportes, palhetas e o que mais o setup pedir.", multi: true },
];

export default async function setup() {
  const $ = (s) => document.querySelector(s);
  const nav = $("#setup-steps");
  const stage = $("#setup-stage");
  const summary = $("#setup-summary");
  const bar = $("#setup-bar");
  const chosen = new Map(steps.map((s) => [s.id, []]));
  let current = 0;
  let products = [];
  // Estilo musical (?genero=): mostra o que combina com ele e os itens versáteis.
  const genreSelect = $("#setup-genre");
  const requested = new URLSearchParams(location.search).get("genero");
  let genero = GENEROS.includes(requested) ? requested : "";
  genreSelect.insertAdjacentHTML("beforeend", GENEROS.map((g) => `<option${g === genero ? " selected" : ""}>${esc(g)}</option>`).join(""));

  const byId = (id) => products.find((p) => p.id === id);
  const selection = () => steps.flatMap((s) => chosen.get(s.id)).map(byId).filter(Boolean);
  function syncUrl() {
    const params = new URLSearchParams();
    const ids = selection().map((p) => p.id);
    if (ids.length) params.set("itens", ids.join(","));
    if (genero) params.set("genero", genero);
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}`.replace(/%2C/g, ",") : ""}`);
  }
  function renderNav() {
    nav.innerHTML = steps
      .map((s, i) => {
        const count = chosen.get(s.id).length;
        return `<li><button type="button" data-step="${i}"${i === current ? ' aria-current="step"' : ""} class="${count ? "is-done" : ""}"><span class="setup-step-num">${count ? icon("check", { size: 14 }) : i + 1}</span><span class="setup-step-text"><strong>${s.title}</strong><small>${count ? `${count} ${count === 1 ? "escolhido" : "escolhidos"}` : "Opcional"}</small></span></button></li>`;
      })
      .join("");
  }
  function renderStage() {
    const step = steps[current];
    const picked = chosen.get(step.id);
    const all = products.filter((p) => p.categoria === step.categoria);
    // Com estilo: primeiro os indicados para ele, depois os versáteis; escolhas feitas nunca somem.
    const tagged = (p) => (p.ficha?.generos || []).includes(genero);
    const items = (genero ? all.filter((p) => fitsGenre(p, genero) || picked.includes(p.id)) : all).sort(
      (a, b) => (genero ? tagged(b) - tagged(a) : 0) || a.priceCents - b.priceCents,
    );
    const note = genero
      ? `<p class="setup-filter-note small" role="status">${items.length} de ${all.length} ${all.length === 1 ? "opção combina" : "opções combinam"} com <strong>${esc(genero)}</strong>. <button type="button" class="text-button" data-all-genres>Ver todas</button></p>`
      : "";
    const type = step.multi ? "checkbox" : "radio";
    stage.innerHTML = `<div class="setup-stage-head"><span class="eyebrow">Etapa ${current + 1} de ${steps.length}</span><h2 id="stage-title" tabindex="-1">${step.title}</h2><p class="muted">${step.hint}</p>${note}</div>
<fieldset class="setup-options"><legend class="sr-only">${step.title}: ${step.multi ? "escolha quantos quiser" : "escolha um"}</legend>${items
      .map((p) => {
        const stock = stockState(p);
        const fit = genero && tagged(p) ? `<span class="setup-option-tag">Indicado para ${esc(genero)}</span>` : "";
        return `<label class="setup-option${stock.key === "out" ? " is-out" : ""}"><input type="${type}" name="setup-${step.id}" value="${esc(p.id)}"${picked.includes(p.id) ? " checked" : ""}${stock.key === "out" ? " disabled" : ""}><span class="setup-option-media"><img src="${esc(productImage(p))}" alt="" width="120" height="120" loading="lazy"></span><span class="setup-option-text"><small>${esc(p.marca)}</small><strong>${esc(p.modelo)}</strong>${fit}<span class="setup-option-price">${money(p.priceCents)}</span><span class="small muted">${stock.key === "in" ? (installmentText(p.priceCents) || "À vista") : stock.label}</span></span><span class="setup-option-check" aria-hidden="true">${icon("check", { size: 16 })}</span></label>`;
      })
      .join("")}</fieldset>
<div class="setup-stage-actions">${actionsHTML()}</div>`;
  }
  function actionsHTML() {
    const picked = chosen.get(steps[current].id).length;
    const back = current ? `<button type="button" class="secondary" data-go="${current - 1}">${icon("arrowLeft", { size: 18 })}Voltar</button>` : "<span></span>";
    const next =
      current < steps.length - 1
        ? `<button type="button" data-go="${current + 1}">${picked ? "Próxima etapa" : "Pular etapa"}${icon("arrowRight", { size: 18 })}</button>`
        : `<button type="button" data-finish>Revisar setup${icon("arrowRight", { size: 18 })}</button>`;
    return `${back}<div class="row">${picked ? '<button type="button" class="text-button" data-clear-step>Limpar escolha</button>' : ""}${next}</div>`;
  }
  function renderSummary() {
    const items = selection();
    const total = items.reduce((s, p) => s + p.priceCents, 0);
    const parcel = installmentText(total);
    summary.innerHTML = `<h2 id="summary-title" tabindex="-1">Seu setup</h2>${
      items.length
        ? `<ul class="setup-summary-items">${steps
            .flatMap((s) => chosen.get(s.id).map((id) => [s, byId(id)]))
            .filter(([, p]) => p)
            .map(([s, p]) => `<li><img src="${esc(productImage(p))}" alt="" width="48" height="48"><span><small>${s.title}</small><a href="${productUrl(p)}">${esc(p.marca)} ${esc(p.modelo)}</a></span><strong>${money(p.priceCents)}</strong><button type="button" class="icon-button" data-remove="${esc(p.id)}" aria-label="Remover ${esc(p.marca)} ${esc(p.modelo)} do setup">${icon("close", { size: 16 })}</button></li>`)
            .join("")}</ul><div class="summary-line summary-total"><span>Total (${items.length} ${items.length === 1 ? "item" : "itens"})</span><span>${money(total)}</span></div>${parcel ? `<p class="small muted">${parcel} no cartão</p>` : ""}${freeShippingHTML(total)}<button type="button" class="full" data-add-setup>${icon("bag", { size: 18 })}Adicionar ${items.length} ${items.length === 1 ? "item" : "itens"} ao carrinho</button><div class="row setup-summary-links"><button type="button" class="text-button" data-share>${icon("share", { size: 16 })}Compartilhar setup</button><button type="button" class="text-button" data-reset>Recomeçar</button></div>`
        : `<p class="muted">Escolha as peças em cada etapa. O total, as parcelas e o frete grátis aparecem aqui.</p>`
    }`;
    bar.hidden = !items.length;
    bar.innerHTML = items.length
      ? `<span><strong>${money(total)}</strong><small>${items.length} ${items.length === 1 ? "item" : "itens"} no setup</small></span><button type="button" data-add-setup>${icon("bag", { size: 18 })}Adicionar</button>`
      : "";
  }
  const render = () => {
    renderNav();
    renderStage();
    renderSummary();
    syncUrl();
  };
  function go(index, focus = true) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    render();
    if (focus) {
      $("#stage-title").focus({ preventScroll: true });
      stage.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }
  function addAll() {
    const cart = getCart();
    let added = 0;
    let skipped = 0;
    for (const p of selection()) {
      const item = cart.find((i) => i.id === p.id);
      if ((item?.quantidade || 0) + 1 > Math.min(99, p.estoque)) {
        skipped++;
        continue;
      }
      if (item) item.quantidade++;
      else cart.push({ id: p.id, quantidade: 1 });
      added++;
    }
    if (!added) return toast("Os itens escolhidos já estão no carrinho no limite do estoque.", { type: "info" });
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`Seu setup: ${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho.`);
    if (skipped) toast(`${skipped} ${skipped === 1 ? "item já estava" : "itens já estavam"} no limite do estoque.`, { type: "info" });
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Meu setup | Violet Voltage", url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        toast("Link do setup copiado.", { type: "success" });
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast("Não foi possível compartilhar. Copie o endereço da página.", { type: "error" });
    }
  }

  stage.addEventListener("change", (event) => {
    const input = event.target.closest("input[name^=setup-]");
    if (!input) return;
    const step = steps[current];
    chosen.set(step.id, [...stage.querySelectorAll(`input[name="setup-${step.id}"]:checked`)].map((i) => i.value));
    renderNav();
    renderSummary();
    syncUrl();
    stage.querySelector(".setup-stage-actions").innerHTML = actionsHTML();
  });
  document.querySelector(".setup-page").addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-step]")) go(Number(t.closest("[data-step]").dataset.step));
    else if (t.closest("[data-go]")) go(Number(t.closest("[data-go]").dataset.go));
    else if (t.closest("[data-finish]")) {
      summary.scrollIntoView({ block: "start" });
      (summary.querySelector("[data-add-setup]") || summary.querySelector("h2")).focus();
    }
    else if (t.closest("[data-clear-step]")) {
      chosen.set(steps[current].id, []);
      render();
    } else if (t.closest("[data-remove]")) {
      const id = t.closest("[data-remove]").dataset.remove;
      for (const s of steps) chosen.set(s.id, chosen.get(s.id).filter((x) => x !== id));
      render();
      summary.querySelector("h2").focus();
    } else if (t.closest("[data-add-setup]")) addAll();
    else if (t.closest("[data-share]")) share();
    else if (t.closest("[data-all-genres]")) {
      genero = genreSelect.value = "";
      render();
      $("#stage-title").focus({ preventScroll: true });
    }
    else if (t.closest("[data-reset]")) {
      steps.forEach((s) => chosen.set(s.id, []));
      go(0);
    }
  });

  genreSelect.addEventListener("change", () => {
    genero = genreSelect.value;
    render();
  });

  stage.innerHTML = `<div class="product-grid">${skeletonCards(3)}</div>`;
  async function load() {
    try {
      products = await catalogProducts();
    } catch (error) {
      errorState(stage, error, load, { title: "Não foi possível carregar os equipamentos." });
      return;
    }
    // Link compartilhado: cada item volta para a etapa da sua categoria.
    const ids = (new URLSearchParams(location.search).get("itens") || "").split(",").filter(Boolean).slice(0, 30);
    for (const id of ids) {
      const p = byId(id);
      const step = p && steps.find((s) => s.categoria === p.categoria);
      if (!step || p.estoque < 1) continue;
      chosen.set(step.id, step.multi ? [...new Set([...chosen.get(step.id), id])] : [id]);
    }
    go(ids.length ? Math.max(0, steps.findIndex((s) => !chosen.get(s.id).length)) : 0, false);
  }
  await load();
}
