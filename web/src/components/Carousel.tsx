// Carrossel horizontal com botões anterior/próximo (seção com cabeçalho).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../lib/icons";

type Props = { id: string; titleId: string; eyebrow: string; title: string; label: string; prevLabel: string; nextLabel: string; children: ReactNode; hidden?: boolean };

export function Carousel({ id, titleId, eyebrow, title, label, prevLabel, nextLabel, children, hidden }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const sync = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    el.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync);
    sync();
    return () => {
      el.removeEventListener("scroll", sync);
      removeEventListener("resize", sync);
    };
  }, [children]);
  const move = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9 });
  return (
    <section className="section container" id={id} aria-labelledby={titleId} hidden={hidden}>
      <div className="section-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="carousel-controls">
          <button type="button" className="icon-button" aria-label={prevLabel} disabled={edges.start} onClick={() => move(-1)}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="icon-button" aria-label={nextLabel} disabled={edges.end} onClick={() => move(1)}>
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className="carousel" ref={track} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
