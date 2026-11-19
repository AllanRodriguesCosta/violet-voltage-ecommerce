// Monte seu setup: escolha guiada por etapa, total com parcelas e frete grátis, link
// compartilhável (?itens=&genero=) e tudo no carrinho de uma vez.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../lib/icons";
import { FREE_SHIPPING_CENTS, catalogProducts, getCart, money, productImage, setCart, toast, type Product } from "../lib/shop";
import { SkeletonCards, installmentText, productUrl, stockState } from "../components/ProductCard";
import { ErrorState } from "../components/State";
import { GENEROS, fitsGenre } from "../../../shared/specs.js";
import { openCart } from "../lib/drawer";

type Step = { id: string; categoria: string; title: string; hint: string; multi: boolean };
const STEPS: Step[] = [
  { id: "guitarra", categoria: "Guitarras", title: "Guitarra", hint: "O coração do setup. Escolha uma.", multi: false },
  { id: "amplificador", categoria: "Amplificadores", title: "Amplificador", hint: "Onde o timbre ganha corpo. Escolha um.", multi: false },
  { id: "efeitos", categoria: "Pedais", title: "Efeitos", hint: "Pedais, pedaleiras e pedalboards. Escolha quantos quiser.", multi: true },
  { id: "cabos", categoria: "Cabos", title: "Cabos", hint: "Do instrumento ao amplificador e entre os pedais.", multi: true },
  { id: "correia", categoria: "Correias", title: "Correia", hint: "Conforto para tocar em pé. Escolha uma.", multi: false },
  { id: "acessorios", categoria: "Acessórios", title: "Acessórios", hint: "Suportes, palhetas e o que mais o setup pedir.", multi: true },
];
const GENRES = GENEROS as string[];
type Chosen = Record<string, string[]>;
type Load = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; products: Product[] };
type Focus = "stage" | "summary" | "finish" | null;
const emptyChoice = (): Chosen => Object.fromEntries(STEPS.map((s) => [s.id, []]));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

function FreeShipping({ subtotalCents }: { subtotalCents: number }) {
  const missing = Math.max(0, FREE_SHIPPING_CENTS - subtotalCents);
  const percent = Math.min(100, Math.round((subtotalCents / FREE_SHIPPING_CENTS) * 100));
  return (
    <div className={missing ? "ship-progress" : "ship-progress is-done"}>
      <p>
        {missing ? (
          <>
            <Icon name="truck" size={18} />
            <span>
              Faltam <strong>{money(missing)}</strong> para frete grátis na entrega padrão.
            </span>
          </>
        ) : (
          <>
            <Icon name="check" size={18} />
            <span>
              Você ganhou <strong>frete grátis</strong> na entrega padrão.
            </span>
          </>
        )}
      </p>
      <div className="ship-bar" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// Adiciona uma unidade de cada peça escolhida, respeitando o estoque.
async function addAll(items: Product[]) {
  const cart = getCart() as { id: string; quantidade: number }[];
  let added = 0;
  let skipped = 0;
  for (const p of items) {
    const line = cart.find((i) => i.id === p.id);
    if ((line?.quantidade || 0) + 1 > Math.min(99, p.estoque)) {
      skipped++;
      continue;
    }
    if (line) line.quantidade++;
    else cart.push({ id: p.id, quantidade: 1 });
    added++;
  }
  if (!added) return toast("Os itens escolhidos já estão no carrinho no limite do estoque.", { type: "info" });
  try {
    setCart(cart);
  } catch {
    return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
  }
  openCart(`Seu setup: ${plural(added, "item adicionado", "itens adicionados")} ao carrinho.`);
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
    if ((error as Error)?.name !== "AbortError") toast("Não foi possível compartilhar. Copie o endereço da página.", { type: "error" });
  }
}

export default function Setup() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [chosen, setChosen] = useState<Chosen>(emptyChoice);
  const [current, setCurrent] = useState(0);
  const [genero, setGenero] = useState("");
  const [focus, setFocus] = useState<{ target: Focus; scroll: boolean }>({ target: null, scroll: false });
  const stageRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  const fetchProducts = useCallback(() => {
    setLoad({ status: "loading" });
    (catalogProducts() as Promise<Product[]>).then(
      (products) => {
        // Link compartilhado: cada item volta para a etapa da sua categoria.
        const ids = (new URLSearchParams(location.search).get("itens") || "").split(",").filter(Boolean).slice(0, 30);
        const next = emptyChoice();
        for (const id of ids) {
          const p = products.find((x) => x.id === id);
          const step = p && STEPS.find((s) => s.categoria === p.categoria);
          if (!p || !step || p.estoque < 1) continue;
          next[step.id] = step.multi ? [...new Set([...next[step.id], id])] : [id];
        }
        setChosen(next);
        setCurrent(ids.length ? Math.max(0, STEPS.findIndex((s) => !next[s.id].length)) : 0);
        setLoad({ status: "ready", products });
      },
      (error: Error) => setLoad({ status: "error", error }),
    );
  }, []);
  useEffect(() => {
    // Estilo musical (?genero=): mostra o que combina com ele e os itens versáteis.
    const requested = new URLSearchParams(location.search).get("genero") || "";
    if (GENRES.includes(requested)) setGenero(requested);
    fetchProducts();
  }, [fetchProducts]);

  const products = load.status === "ready" ? load.products : [];
  const byId = (id: string) => products.find((p) => p.id === id);
  const lines = STEPS.flatMap((s) => chosen[s.id].map((id) => [s, byId(id)] as const)).filter((l): l is readonly [Step, Product] => Boolean(l[1]));
  const selection = lines.map(([, p]) => p);
  const total = selection.reduce((sum, p) => sum + p.priceCents, 0);
  const selectionKey = selection.map((p) => p.id).join(",");

  // Endereço compartilhável sempre em dia com as escolhas e o estilo.
  useEffect(() => {
    if (load.status !== "ready") return;
    const params = new URLSearchParams();
    if (selectionKey) params.set("itens", selectionKey);
    if (genero) params.set("genero", genero);
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}`.replace(/%2C/g, ",") : ""}`);
  }, [load.status, selectionKey, genero]);

  // Foco depois de trocar de etapa, remover um item ou revisar o setup.
  useEffect(() => {
    if (!focus.target) return;
    if (focus.target === "stage") {
      document.querySelector<HTMLElement>("#stage-title")?.focus({ preventScroll: true });
      if (focus.scroll) stageRef.current?.scrollIntoView({ block: "start", behavior: smooth() });
    } else if (focus.target === "summary") summaryRef.current?.querySelector<HTMLElement>("h2")?.focus();
    else {
      summaryRef.current?.scrollIntoView({ block: "start" });
      (summaryRef.current?.querySelector<HTMLElement>("[data-add-setup]") || summaryRef.current?.querySelector<HTMLElement>("h2"))?.focus();
    }
    setFocus({ target: null, scroll: false });
  }, [focus]);

  const go = (index: number) => {
    setCurrent(Math.max(0, Math.min(STEPS.length - 1, index)));
    setFocus({ target: "stage", scroll: true });
  };
  const setStep = (id: string, ids: string[]) => setChosen((c) => ({ ...c, [id]: ids }));
  const remove = (id: string) => {
    setChosen((c) => Object.fromEntries(Object.entries(c).map(([k, list]) => [k, list.filter((x) => x !== id)])));
    setFocus({ target: "summary", scroll: false });
  };
  const reset = () => {
    setChosen(emptyChoice());
    go(0);
  };

  const step = STEPS[current];
  const picked = chosen[step.id];

  function Stage() {
    if (load.status === "loading")
      return (
        <div className="product-grid">
          <SkeletonCards count={3} />
        </div>
      );
    if (load.status === "error") return <ErrorState error={load.error} retry={fetchProducts} title="Não foi possível carregar os equipamentos." />;
    const all = products.filter((p) => p.categoria === step.categoria);
    // Com estilo: primeiro os indicados para ele, depois os versáteis; escolhas feitas nunca somem.
    const tagged = (p: Product) => (p.ficha?.generos || []).includes(genero);
    const items = (genero ? all.filter((p) => fitsGenre(p, genero) || picked.includes(p.id)) : all).sort(
      (a, b) => (genero ? Number(tagged(b)) - Number(tagged(a)) : 0) || a.priceCents - b.priceCents,
    );
    const type = step.multi ? "checkbox" : "radio";
    const toggle = (id: string, checked: boolean) => {
      if (!step.multi) return setStep(step.id, [id]);
      const set = new Set(picked);
      if (checked) set.add(id);
      else set.delete(id);
      setStep(
        step.id,
        items.map((p) => p.id).filter((x) => set.has(x)),
      );
    };
    return (
      <>
        <div className="setup-stage-head">
          <span className="eyebrow">
            Etapa {current + 1} de {STEPS.length}
          </span>
          <h2 id="stage-title" tabIndex={-1}>
            {step.title}
          </h2>
          <p className="muted">{step.hint}</p>
          {genero && (
            <p className="setup-filter-note small" role="status">
              {items.length} de {all.length} {all.length === 1 ? "opção combina" : "opções combinam"} com <strong>{genero}</strong>.{" "}
              <button
                type="button"
                className="text-button"
                data-all-genres
                onClick={() => {
                  setGenero("");
                  setFocus({ target: "stage", scroll: false });
                }}
              >
                Ver todas
              </button>
            </p>
          )}
        </div>
        <fieldset className="setup-options">
          <legend className="sr-only">
            {step.title}: {step.multi ? "escolha quantos quiser" : "escolha um"}
          </legend>
          {items.map((p) => {
            const stock = stockState(p);
            return (
              <label key={p.id} className={stock.key === "out" ? "setup-option is-out" : "setup-option"}>
                <input
                  type={type}
                  name={`setup-${step.id}`}
                  value={p.id}
                  checked={picked.includes(p.id)}
                  disabled={stock.key === "out"}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                />
                <span className="setup-option-media">
                  <img src={productImage(p)} alt="" width={120} height={120} loading="lazy" />
                </span>
                <span className="setup-option-text">
                  <small>{p.marca}</small>
                  <strong>{p.modelo}</strong>
                  {genero && tagged(p) && <span className="setup-option-tag">Indicado para {genero}</span>}
                  <span className="setup-option-price">{money(p.priceCents)}</span>
                  <span className="small muted">{stock.key === "in" ? installmentText(p.priceCents) || "À vista" : stock.label}</span>
                </span>
                <span className="setup-option-check" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className="setup-stage-actions">
          {current ? (
            <button type="button" className="secondary" data-go={current - 1} onClick={() => go(current - 1)}>
              <Icon name="arrowLeft" size={18} />
              Voltar
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            {picked.length > 0 && (
              <button type="button" className="text-button" data-clear-step onClick={() => setStep(step.id, [])}>
                Limpar escolha
              </button>
            )}
            {current < STEPS.length - 1 ? (
              <button type="button" data-go={current + 1} onClick={() => go(current + 1)}>
                {picked.length ? "Próxima etapa" : "Pular etapa"}
                <Icon name="arrowRight" size={18} />
              </button>
            ) : (
              <button type="button" data-finish onClick={() => setFocus({ target: "finish", scroll: false })}>
                Revisar setup
                <Icon name="arrowRight" size={18} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  const count = plural(selection.length, "item", "itens");
  const parcel = installmentText(total);
  return (
    <>
      <div className="container page-wrap setup-page">
        <nav className="breadcrumb" aria-label="Trilha de navegação">
          <a href="/">Início</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Monte seu setup</span>
        </nav>
        <header className="page-head">
          <div>
            <span className="eyebrow">Monte seu setup</span>
            <h1 className="page-title">Do primeiro acorde ao palco.</h1>
            <p className="lead">
              Escolha cada peça por etapa. O total, as parcelas e o frete grátis aparecem na hora, e você pode pular etapas e voltar quando quiser.
            </p>
          </div>
          <div className="field setup-genre">
            <label htmlFor="setup-genre">Estilo musical</label>
            <select id="setup-genre" aria-describedby="setup-genre-help" value={genero} onChange={(e) => setGenero(e.target.value)}>
              <option value="">Todos os estilos</option>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <p className="form-help" id="setup-genre-help">
              Mostra o que combina com o estilo e os itens versáteis.
            </p>
          </div>
        </header>
        <ol className="setup-steps" id="setup-steps" aria-label="Etapas do setup">
          {STEPS.map((s, i) => {
            const n = chosen[s.id].length;
            return (
              <li key={s.id}>
                <button type="button" data-step={i} aria-current={i === current ? "step" : undefined} className={n ? "is-done" : ""} onClick={() => go(i)}>
                  <span className="setup-step-num">{n ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="setup-step-text">
                    <strong>{s.title}</strong>
                    <small>{n ? plural(n, "escolhido", "escolhidos") : "Opcional"}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="setup-layout">
          <section className="setup-stage" id="setup-stage" aria-labelledby="stage-title" ref={stageRef}>
            {Stage()}
          </section>
          <aside className="panel setup-summary" id="setup-summary" aria-labelledby="summary-title" ref={summaryRef}>
            <h2 id="summary-title" tabIndex={-1}>
              Seu setup
            </h2>
            {selection.length ? (
              <>
                <ul className="setup-summary-items">
                  {lines.map(([s, p]) => (
                    <li key={p.id}>
                      <img src={productImage(p)} alt="" width={48} height={48} />
                      <span>
                        <small>{s.title}</small>
                        <a href={productUrl(p)}>
                          {p.marca} {p.modelo}
                        </a>
                      </span>
                      <strong>{money(p.priceCents)}</strong>
                      <button type="button" className="icon-button" data-remove={p.id} aria-label={`Remover ${p.marca} ${p.modelo} do setup`} onClick={() => remove(p.id)}>
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="summary-line summary-total">
                  <span>Total ({count})</span>
                  <span>{money(total)}</span>
                </div>
                {parcel && <p className="small muted">{parcel} no cartão</p>}
                <FreeShipping subtotalCents={total} />
                <button type="button" className="full" data-add-setup onClick={() => addAll(selection)}>
                  <Icon name="bag" size={18} />
                  Adicionar {count} ao carrinho
                </button>
                <div className="row setup-summary-links">
                  <button type="button" className="text-button" data-share onClick={share}>
                    <Icon name="share" size={16} />
                    Compartilhar setup
                  </button>
                  <button type="button" className="text-button" data-reset onClick={reset}>
                    Recomeçar
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Escolha as peças em cada etapa. O total, as parcelas e o frete grátis aparecem aqui.</p>
            )}
          </aside>
        </div>
      </div>
      <aside className="setup-bar" id="setup-bar" aria-label="Resumo do setup" hidden={!selection.length}>
        {selection.length > 0 && (
          <>
            <span>
              <strong>{money(total)}</strong>
              <small>{count} no setup</small>
            </span>
            <button type="button" data-add-setup onClick={() => addAll(selection)}>
              <Icon name="bag" size={18} />
              Adicionar
            </button>
          </>
        )}
      </aside>
    </>
  );
}
