// Central de ajuda: perguntas e respostas geradas de src/knowledge/help.js (a mesma fonte que o
// assistente consulta), pré-renderizadas por inteiro. Busca sem acentos, assuntos por âncora
// (#entregas abre a primeira pergunta; #conta-5 abre a própria) e estado vazio.
import { useEffect, useRef, useState } from "react";
import { helpGroups } from "../../../src/knowledge/help.js";
import { normalize } from "../../../shared/catalog.js";
import { Icon } from "../lib/icons";
import { State } from "../components/State";

type Item = { pergunta: string; resposta: string; link?: { rotulo: string; href: string } };
type Group = { id: string; titulo: string; chip: string; itens: Item[] };
const groups = helpGroups as Group[];
const textOf = (item: Item) => normalize(`${item.pergunta} ${item.resposta} ${item.link?.rotulo || ""}`);

export default function Help() {
  const [query, setQuery] = useState("");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = (item: Item) => terms.every((t) => textOf(item).includes(t));
  const shown = groups.reduce((n, g) => n + g.itens.filter(matches).length, 0);
  // A busca abre as respostas encontradas e fecha as demais (como antes); só depois de digitar.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current) return;
    for (const g of groups)
      g.itens.forEach((item, i) => {
        const el = document.getElementById(`${g.id}-${i + 1}`) as HTMLDetailsElement | null;
        if (el) el.open = terms.length > 0 && matches(item);
      });
  });
  useEffect(() => {
    const openFromHash = () => {
      // getElementById aceita qualquer âncora; sem âncora não há grupo para abrir.
      const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      // Âncora de grupo abre a primeira pergunta; âncora de pergunta (ex.: #conta-5) abre a própria.
      if (target?.classList.contains("faq-group")) target.querySelector(".faq-item")?.setAttribute("open", "");
      else if (target?.classList.contains("faq-item")) {
        target.setAttribute("open", "");
        target.scrollIntoView({ block: "start" });
        target.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
      }
    };
    addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => removeEventListener("hashchange", openFromHash);
  }, []);
  return (
    <div className="container page-wrap help-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Ajuda</span>
      </nav>
      <header className="help-hero">
        <span className="eyebrow">Central de ajuda</span>
        <h1 className="page-title">Como podemos ajudar?</h1>
        <p className="lead">Pedidos, entregas, pagamentos, produtos, trocas e conta em respostas diretas.</p>
        <form className="help-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="sr-only" htmlFor="faq-q">
            Buscar na ajuda
          </label>
          <Icon name="search" size={18} />
          <input id="faq-q" type="search" placeholder="Busque por frete, parcelas, senha…" autoComplete="off" value={query} onChange={(e) => {
              typed.current = true;
              setQuery(e.target.value);
            }} />
        </form>
        <nav className="help-topics chip-row" aria-label="Assuntos">
          {groups.map((g) => (
            <a key={g.id} className="chip" href={`#${g.id}`}>
              {g.chip}
            </a>
          ))}
        </nav>
      </header>
      <p className="catalog-meta" id="faq-status" aria-live="polite">
        {terms.length ? `${shown} ${shown === 1 ? "resposta encontrada" : "respostas encontradas"}.` : ""}
      </p>
      {groups.map((g) => (
        <section className="faq-group" id={g.id} aria-labelledby={`faq-${g.id}`} key={g.id} hidden={!g.itens.some(matches)}>
          <h2 id={`faq-${g.id}`}>{g.titulo}</h2>
          {g.itens.map((item, i) => (
            <details className="faq-item" id={`${g.id}-${i + 1}`} key={item.pergunta} hidden={!matches(item)}>
              <summary>{item.pergunta}</summary>
              <p>
                {item.resposta}
                {item.link && (
                  <>
                    {" "}
                    <a href={item.link.href}>{item.link.rotulo}</a>
                  </>
                )}
              </p>
            </details>
          ))}
        </section>
      ))}
      <div id="faq-empty" hidden={shown > 0}>
        {shown === 0 && <State title="Nenhuma resposta com esses termos." text="Tente palavras como frete, parcelas, cupom ou troca." />}
      </div>
    </div>
  );
}
