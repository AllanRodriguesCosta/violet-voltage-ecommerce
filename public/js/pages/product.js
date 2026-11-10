import { icon } from "../icons.js";
import {
  api,
  catalogProducts,
  money,
  productImage,
  escapeHtml as esc,
  addCart,
  bindForm,
  validateForm,
  pushRecent,
  getRecent,
  isWished,
  toast,
  getCart,
  setCart,
} from "../common.js";
import { stockState, wishLabel, handleWish, installmentText, productCard, bindCards, carousel, errorState } from "../components.js";
import { delivery, shipping, FREE_SHIPPING_CENTS, maxInstallments, installmentValue } from "../pricing.js";
import { alertButtonHTML } from "../alerts.js";
import { openCart } from "../drawer.js";

function structuredData(p, name) {
  document.querySelector('script[type="application/ld+json"]')?.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: p.descricao,
    sku: p.id,
    category: p.categoria,
    brand: { "@type": "Brand", name: p.marca },
    image: new URL(productImage(p), location.origin).href,
    offers: {
      "@type": "Offer",
      url: location.href,
      priceCurrency: "BRL",
      price: (p.priceCents / 100).toFixed(2),
      availability: `https://schema.org/${p.estoque > 0 ? "InStock" : "OutOfStock"}`,
    },
  });
  document.head.append(script);
}
function installmentsTable(total) {
  const max = maxInstallments(total);
  if (max < 2) return "";
  return `<details class="installments-table"><summary>Ver todas as parcelas</summary><table><caption class="sr-only">Parcelamento no cartão de crédito</caption><tbody>${Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<tr><th scope="row">${n}x</th><td>${money(installmentValue(total, n))}</td><td>sem juros</td></tr>`)
    .join("")}</tbody></table></details>`;
}
function zoom(frame, image, name) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  frame.addEventListener("mousemove", (event) => {
    if (!fine.matches) return;
    const r = frame.getBoundingClientRect();
    frame.style.setProperty("--zx", `${((event.clientX - r.left) / r.width) * 100}%`);
    frame.style.setProperty("--zy", `${((event.clientY - r.top) / r.height) * 100}%`);
    frame.classList.add("is-zooming");
  });
  frame.addEventListener("mouseleave", () => frame.classList.remove("is-zooming"));
  const box = document.createElement("dialog");
  box.className = "lightbox";
  box.setAttribute("aria-label", `Imagem ampliada de ${name}`);
  box.innerHTML = `<img src="${esc(image)}" alt="${esc(name)}"><button type="button" class="icon-button" data-close aria-label="Fechar imagem">${icon("close")}</button>`;
  document.body.append(box);
  box.addEventListener("click", (event) => {
    if (event.target === box || event.target.closest("[data-close]")) box.close();
  });
  frame.addEventListener("click", () => {
    frame.classList.remove("is-zooming");
    box.showModal();
  });
}
async function share(name) {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${name} | Violet Voltage`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Link copiado para a área de transferência.", { type: "success" });
  } catch (error) {
    if (error?.name !== "AbortError") toast("Não foi possível compartilhar. Copie o endereço da página.", { type: "error" });
  }
}
// Compre junto: o item mais acessível, em estoque, de categorias que completam este produto.
const complements = {
  Guitarras: ["Cabos", "Correias", "Amplificadores"],
  Amplificadores: ["Cabos", "Pedais"],
  Pedais: ["Cabos", "Pedais"],
  Cabos: ["Pedais", "Acessórios"],
  Correias: ["Acessórios", "Cabos"],
  Acessórios: ["Cabos", "Correias"],
};
function bundle(p, others) {
  const section = document.querySelector("#bundle");
  const picks = [];
  for (const category of complements[p.categoria] || []) {
    const item = others.filter((x) => x.categoria === category && !picks.includes(x)).sort((a, b) => a.priceCents - b.priceCents)[0];
    if (item) picks.push(item);
    if (picks.length === 2) break;
  }
  if (!p.estoque || !picks.length) return;
  const all = [p, ...picks];
  const item = (x, main) =>
    `<li class="bundle-item${main ? " is-main" : ""}"><label><input type="checkbox" value="${esc(x.id)}" checked${main ? " disabled" : ""}><span class="bundle-media"><img src="${esc(productImage(x))}" alt="" width="96" height="96" loading="lazy"></span><span class="bundle-text"><small>${main ? "Este item" : esc(x.categoria)}</small><span>${esc(x.marca)} ${esc(x.modelo)}</span><strong>${money(x.priceCents)}</strong></span></label>${main ? "" : `<a class="text-link small" href="/produto.html?id=${encodeURIComponent(x.id)}">Ver detalhes</a>`}</li>`;
  section.innerHTML = `<div class="section-head"><div><span class="eyebrow">Compre junto</span><h2 id="bundle-title">Complete o seu setup</h2></div></div><div class="bundle panel"><ul class="bundle-items">${all.map((x, i) => item(x, i === 0)).join(`<li class="bundle-plus" aria-hidden="true">${icon("plus", { size: 20 })}</li>`)}</ul><div class="bundle-total" aria-live="polite"></div></div>`;
  const total = section.querySelector(".bundle-total");
  const sync = () => {
    const chosen = all.filter((x, i) => i === 0 || section.querySelector(`input[value="${CSS.escape(x.id)}"]`).checked);
    const sum = chosen.reduce((s, x) => s + x.priceCents, 0);
    const parcel = installmentText(sum);
    total.innerHTML = `<span>Total de ${chosen.length} ${chosen.length === 1 ? "item" : "itens"}</span><strong>${money(sum)}</strong>${parcel ? `<small>${parcel}</small>` : ""}<button type="button" data-bundle-add>${icon("bag", { size: 18 })}Adicionar ${chosen.length} ${chosen.length === 1 ? "item" : "itens"} ao carrinho</button>`;
    return chosen;
  };
  section.addEventListener("change", sync);
  section.addEventListener("click", (event) => {
    if (!event.target.closest("[data-bundle-add]")) return;
    const chosen = sync();
    const cart = getCart();
    let added = 0;
    for (const x of chosen) {
      const line = cart.find((i) => i.id === x.id);
      if ((line?.quantidade || 0) + 1 > Math.min(99, x.estoque)) continue;
      if (line) line.quantidade++;
      else cart.push({ id: x.id, quantidade: 1 });
      added++;
    }
    if (!added) return toast("Esses itens já estão no carrinho no limite do estoque.", { type: "info" });
    try {
      setCart(cart);
    } catch {
      return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
    }
    openCart(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao carrinho.`);
  });
  sync();
  section.hidden = false;
}
async function extras(p) {
  let products;
  try {
    products = await catalogProducts();
  } catch {
    return;
  }
  const others = products.filter((x) => x.id !== p.id && x.estoque > 0);
  bundle(p, others);
  const related = [
    ...others.filter((x) => x.categoria === p.categoria).sort((a, b) => Math.abs(a.priceCents - p.priceCents) - Math.abs(b.priceCents - p.priceCents)),
    ...others.filter((x) => x.categoria !== p.categoria).sort((a, b) => a.priceCents - b.priceCents),
  ].slice(0, 4);
  const relatedSection = document.querySelector("#related");
  relatedSection.querySelector(".product-grid").innerHTML = related.map((x, i) => productCard(x, i)).join("");
  relatedSection.hidden = !related.length;
  bindCards(relatedSection.querySelector(".product-grid"), () => products);
  const recent = getRecent()
    .filter((id) => id !== p.id)
    .map((id) => products.find((x) => x.id === id))
    .filter(Boolean)
    .slice(0, 8);
  const recentSection = document.querySelector("#recentes");
  recentSection.querySelector(".carousel").innerHTML = recent.map((x, i) => productCard(x, i)).join("");
  recentSection.hidden = !recent.length;
  bindCards(recentSection.querySelector(".carousel"), () => products);
  carousel(recentSection);
}

export default async function detail() {
  const container = document.querySelector("#product-detail");
  const id = new URLSearchParams(location.search).get("id") || "";
  try {
    const p = await api(`/products/${encodeURIComponent(id)}`);
    const name = `${p.marca} ${p.modelo}`;
    const stock = stockState(p);
    const wished = isWished(p.id);
    const image = productImage(p);
    const max = Math.min(99, p.estoque);
    document.title = `${name} | Violet Voltage`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", `${name}: ${p.descricao}`.slice(0, 160));
    document.querySelector("#crumb-category").innerHTML = `<a href="/catalogo.html?categoria=${encodeURIComponent(p.categoria)}">${esc(p.categoria)}</a>`;
    document.querySelector("#crumb-current").textContent = p.modelo;
    container.className = "detail-grid";
    container.removeAttribute("aria-busy");
    container.innerHTML = `<div class="detail-media"><button type="button" class="zoom-frame" aria-label="Ampliar imagem de ${esc(name)}"><img class="detail-image" src="${esc(image)}" alt="${esc(name)}" width="640" height="640"></button><span class="zoom-hint">${icon("zoom", { size: 16 })}<span class="hint-fine">Passe o cursor para ampliar ou clique para tela cheia</span><span class="hint-touch">Toque para ampliar</span></span><button type="button" class="wish-button" data-wish="${esc(p.id)}" data-name="${esc(name)}" aria-pressed="${wished}" aria-label="${esc(wishLabel(name, wished))}">${icon("heart")}</button></div>
<section class="detail-info" data-name="${esc(name)}"><span class="eyebrow">${esc(p.categoria)} · ${esc(p.marca)}</span><h1>${esc(p.modelo)}</h1><p class="detail-price">${money(p.priceCents)}</p>${installmentText(p.priceCents) ? `<p class="detail-installments">${installmentText(p.priceCents)}</p>` : ""}${installmentsTable(p.priceCents)}<p class="stock-pill stock-${stock.key}">${icon(stock.key === "out" ? "clock" : "check", { size: 16 })}${stock.key === "out" ? "Produto esgotado" : stock.key === "low" ? `Últimas unidades: ${p.estoque} em estoque` : `${p.estoque} unidades em estoque`}</p><p class="lead">${esc(p.descricao)}</p>
${p.estoque ? `<form id="add-product" class="buy-box"><div class="quantity-field"><label for="quantidade">Quantidade</label><div class="stepper stepper-lg" role="group" aria-label="Quantidade"><button type="button" data-qty="-1" aria-label="Diminuir quantidade"${p.estoque ? "" : " disabled"}>${icon("minus", { size: 18 })}</button><input id="quantidade" name="quantidade" type="number" value="1" min="1" max="${max}" inputmode="numeric" required${p.estoque ? "" : " disabled"}><button type="button" data-qty="1" aria-label="Aumentar quantidade"${p.estoque > 1 ? "" : " disabled"}>${icon("plus", { size: 18 })}</button></div></div><div class="buy-actions"><button type="submit"${p.estoque ? "" : " disabled"}>${icon("bag", { size: 18 })}Adicionar ao carrinho</button><button type="button" class="secondary" data-buy-now${p.estoque ? "" : " disabled"}>Comprar agora</button></div></form>` : `<div class="buy-box buy-box-out">${alertButtonHTML(p)}<p class="small muted">Sem estoque agora. Ative o aviso e acompanhe em Minha conta.</p></div>`}
<p class="cart-feedback" role="status"></p>
<ul class="perk-list delivery-list">${Object.entries(delivery).map(([key, d]) => `<li>${icon(key === "retirada" ? "store" : "truck", { size: 18 })}<span><strong>${d.label}</strong><small>${d.prazo}</small></span><span class="option-price">${(key === "padrao" && p.priceCents >= FREE_SHIPPING_CENTS) || !shipping[key] ? "Grátis" : money(shipping[key])}</span></li>`).join("")}<li>${icon("refresh", { size: 18 })}<span><strong>Troca em até 7 dias</strong><small>Após o recebimento</small></span></li></ul><p class="small muted">Frete grátis na entrega padrão para compras a partir de ${money(FREE_SHIPPING_CENTS)}.</p>
<div class="detail-actions"><button type="button" class="text-button" data-share>${icon("share", { size: 18 })}Compartilhar</button><a class="text-link" href="/catalogo.html?categoria=${encodeURIComponent(p.categoria)}">Mais ${esc(p.categoria.toLowerCase())} ${icon("arrowRight", { size: 16 })}</a></div>
<section class="product-specs"><h2>Sobre este equipamento</h2><dl><div><dt>Marca</dt><dd>${esc(p.marca)}</dd></div><div><dt>Modelo</dt><dd>${esc(p.modelo)}</dd></div><div><dt>Categoria</dt><dd>${esc(p.categoria)}</dd></div><div><dt>Código</dt><dd>${esc(p.id)}</dd></div></dl></section></section>`;
    pushRecent(p.id);
    structuredData(p, name);
    zoom(container.querySelector(".zoom-frame"), image, name);
    container.querySelector("[data-wish]").addEventListener("click", (event) => handleWish(event.currentTarget.dataset.wish));
    container.querySelector("[data-share]").addEventListener("click", () => share(name));
    const form = container.querySelector("#add-product");
    const buyBox = container.querySelector(".buy-box");
    const qty = form?.elements.quantidade;
    const syncSteps = () => {
      const value = Number(qty.value);
      form.querySelector('[data-qty="-1"]').disabled = !p.estoque || value <= 1;
      form.querySelector('[data-qty="1"]').disabled = !p.estoque || value >= max;
    };
    form?.querySelectorAll("[data-qty]").forEach((b) =>
      b.addEventListener("click", () => {
        qty.value = Math.min(max, Math.max(1, (Number(qty.value) || 1) + Number(b.dataset.qty)));
        syncSteps();
      }),
    );
    qty?.addEventListener("input", syncSteps);
    if (form) syncSteps();
    const feedback = container.querySelector(".cart-feedback");
    if (form) bindForm(form, (data) => {
      if (addCart(p, Number(data.quantidade), { source: container.querySelector(".detail-image") })) feedback.innerHTML = 'Equipamento adicionado. <a href="/carrinho.html">Ver meu carrinho</a>';
      else feedback.textContent = "Não foi possível adicionar. Confira a quantidade e a mensagem exibida.";
    });
    container.querySelector("[data-buy-now]")?.addEventListener("click", () => {
      if (!validateForm(form)) return;
      if (addCart(p, Number(qty.value), { notify: false })) location.href = "/checkout.html";
    });
    // Barra de compra fixa no celular quando o botão principal sai da tela.
    const bar = document.querySelector("#sticky-buy");
    bar.innerHTML = `<img src="${esc(image)}" alt="" width="44" height="44"><span><strong>${esc(p.modelo)}</strong><small>${p.estoque ? money(p.priceCents) : "Esgotado"}</small></span>${p.estoque ? `<button type="button" data-bar-add>${icon("bag", { size: 18 })}Adicionar</button>` : alertButtonHTML(p, { short: true, className: "" })}`;
    bar.querySelector("[data-bar-add]")?.addEventListener("click", () => addCart(p, 1, { source: bar.querySelector("img") }));
    let ticking = false;
    const syncBar = () => {
      ticking = false;
      bar.classList.toggle("is-visible", buyBox.getBoundingClientRect().bottom < 0);
    };
    addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(syncBar);
        }
      },
      { passive: true },
    );
    syncBar();
    await extras(p);
  } catch (e) {
    container.className = "state-wrap";
    container.removeAttribute("aria-busy");
    const missing = e.status === 404;
    document.querySelector("#crumb-current").textContent = missing ? "Produto não encontrado" : "Produto";
    errorState(container, e, missing ? null : detail, {
      level: 1,
      title: missing ? "Produto não encontrado." : "Não foi possível carregar este produto.",
      text: missing ? "O endereço pode estar incompleto ou o item saiu do catálogo. Que tal explorar os equipamentos disponíveis?" : undefined,
      back: { href: "/catalogo.html", label: "Voltar ao catálogo" },
    });
  }
}
