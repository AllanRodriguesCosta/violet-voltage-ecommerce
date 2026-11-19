// Guias de compra e glossário. O conteúdo vem de src/knowledge (a mesma fonte do assistente) e
// sai inteiro no HTML pré-renderizado; no navegador, a busca no glossário e o destaque do termo
// aberto por link (#humbucker).
import { useEffect, useState } from "react";
import { Icon } from "../lib/icons";
import { normalize } from "../../../shared/catalog.js";
import { guides } from "../../../src/knowledge/guides.js";
import { glossary, glossaryId } from "../../../src/knowledge/glossary.js";

type Guide = { id: string; titulo: string; resumo: string; secoes: [string, string][]; links: [string, string][] };
type Term = { termo: string; sinonimos: string; definicao: string; guia?: string };

const sortKey = (text: string) => (normalize(text) as string).toLowerCase();
const TERMS = (glossary as Term[])
  .map((t) => ({ ...t, id: glossaryId(t.termo) as string, terms: `${t.termo.toLowerCase()} ${t.sinonimos}` }))
  .sort((a, b) => (sortKey(a.termo) < sortKey(b.termo) ? -1 : sortKey(a.termo) > sortKey(b.termo) ? 1 : 0));
const GUIDES = guides as unknown as Guide[];

function GuideArticle({ guide: g }: { guide: Guide }) {
  return (
    <article className="panel guide" id={g.id} aria-labelledby={`guide-${g.id}-title`}>
      <span className="eyebrow">Guia</span>
      <h2 id={`guide-${g.id}-title`}>{g.titulo}</h2>
      <p className="lead">{g.resumo}</p>
      {g.secoes.map(([title, text]) => [<h3 key={`${title}-h`}>{title}</h3>, <p key={`${title}-p`}>{text}</p>])}
      <nav className="chip-row guide-links" aria-label={`Ver no catálogo: ${g.titulo}`}>
        {g.links.map(([label, href]) => (
          <a key={href} className="chip" href={href}>
            {label}
          </a>
        ))}
      </nav>
    </article>
  );
}

function Glossary() {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    const highlight = () => {
      const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : "";
      const isTerm = TERMS.some((t) => t.id === id);
      // Link para um termo limpa a busca para o termo aparecer no contexto do glossário.
      if (isTerm) setQuery("");
      setTarget(isTerm ? id : "");
    };
    addEventListener("hashchange", highlight);
    highlight();
    return () => removeEventListener("hashchange", highlight);
  }, []);
  const q = normalize(query.trim()) as string;
  const visible = (t: (typeof TERMS)[number]) => !q || (normalize(`${t.terms} ${t.termo}${t.definicao}${t.guia ? " Ler o guia" : ""}`) as string).includes(q);
  const shown = TERMS.filter(visible).length;
  const status = q ? (shown ? `${shown} ${shown === 1 ? "termo encontrado" : "termos encontrados"}.` : "Nenhum termo encontrado. Tente outra palavra.") : "";
  return (
    <section className="panel glossary" id="glossario" aria-labelledby="glossary-title">
      <h2 id="glossary-title">Glossário</h2>
      <p className="lead">{TERMS.length} termos da ficha técnica e do dia a dia do guitarrista.</p>
      <form className="help-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="sr-only" htmlFor="glossary-q">
          Buscar no glossário
        </label>
        <Icon name="search" size={18} />
        <input id="glossary-q" type="search" placeholder="Busque por humbucker, fuzz, escala…" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>
      <p className="catalog-meta" id="glossary-status" aria-live="polite">
        {status}
      </p>
      <dl className="glossary-list">
        {TERMS.map((t) => (
          <div key={t.id} className={t.id === target ? "term is-target" : "term"} id={t.id} data-terms={t.terms} hidden={!visible(t)}>
            <dt>{t.termo}</dt>
            <dd>
              {t.definicao}
              {t.guia && (
                <>
                  {" "}
                  <a href={`#${t.guia}`}>Ler o guia</a>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Guides() {
  return (
    <div className="container page-wrap guides-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Guias</span>
      </nav>
      <header className="help-hero">
        <span className="eyebrow">Guias de compra</span>
        <h1 className="page-title">Escolha com quem entende de som.</h1>
        <p className="lead">Captação, amplificador, ordem dos pedais, alimentação e cordas explicados sem complicação, com atalhos para o catálogo.</p>
        <nav className="help-topics" aria-label="Guias">
          <ol className="guide-toc">
            {GUIDES.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`}>{g.titulo}</a>
              </li>
            ))}
            <li>
              <a href="#glossario">Glossário</a>
            </li>
          </ol>
        </nav>
      </header>
      <div className="guide-list">
        {GUIDES.map((g) => (
          <GuideArticle key={g.id} guide={g} />
        ))}
      </div>
      <Glossary />
    </div>
  );
}
