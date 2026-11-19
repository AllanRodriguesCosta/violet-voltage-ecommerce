// Galeria do produto: setas sobre a foto, miniaturas, arrastar no celular, setas do teclado,
// lupa com o cursor e tela cheia (lightbox). Trocar a cor troca o conjunto de fotos e volta
// para a primeira. Mesma marcação da página anterior.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../lib/icons";
import type { Photo } from "../lib/catalog";
import type { Product } from "../lib/shop";
import { WishButton } from "./ProductCard";

// Nomes das vistas (as fotos de amplificador vêm de frente, de cima e de trás).
export const VISTAS: Record<string, string> = { frente: "frente", topo: "painel de controles", costas: "traseira" };
export const photoAlt = (name: string, cor: string | null, foto?: Photo) =>
  [name, cor && `cor ${cor.toLowerCase()}`, foto?.vista && foto.vista !== "frente" && `vista: ${VISTAS[foto.vista] || foto.vista}`].filter(Boolean).join(", ");

type Props = { product: Product; name: string; cor: string | null; photos: Photo[] };

export function Gallery({ product, name, cor, photos }: Props) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [zooming, setZooming] = useState(false);
  const frame = useRef<HTMLButtonElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const box = useRef<HTMLDialogElement>(null);
  const boxImage = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);
  const shownCor = useRef(cor);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const many = photos.length > 1;
  const current = Math.min(index, photos.length - 1);
  const foto = photos[current];
  const show = (next: number, announce = true) => {
    const i = (next + photos.length) % photos.length;
    setIndex(i);
    // Leitor de tela: avisa a foto (e a cor) que entrou, sem roubar o foco.
    if (announce) setStatus(`${cor ? `Cor ${cor}. ` : ""}Foto ${i + 1} de ${photos.length}: ${VISTAS[photos[i].vista || ""] || "produto"}.`);
  };
  // Nova cor: volta para a primeira foto e anuncia a troca.
  useEffect(() => {
    if (shownCor.current === cor) return;
    shownCor.current = cor;
    show(0);
  }, [cor]);

  const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && many) {
      swipedAt.current = Date.now();
      show(current + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <div className="detail-gallery">
      <div className="detail-media">
        <button
          ref={frame}
          type="button"
          className={`zoom-frame${zooming ? " is-zooming" : ""}`}
          aria-label={`Ampliar imagem de ${name}`}
          onMouseMove={(event) => {
            if (!fine()) return;
            const el = event.currentTarget;
            const r = el.getBoundingClientRect();
            el.style.setProperty("--zx", `${((event.clientX - r.left) / r.width) * 100}%`);
            el.style.setProperty("--zy", `${((event.clientY - r.top) / r.height) * 100}%`);
            setZooming(true);
          }}
          onMouseLeave={() => setZooming(false)}
          onKeyDown={(event) => {
            if (!many || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            show(current + (event.key === "ArrowRight" ? 1 : -1));
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={() => {
            if (Date.now() - swipedAt.current < 400) return;
            setZooming(false);
            // Abre a foto que está na tela (a galeria pode ter trocado de vista ou de cor).
            const img = image.current;
            if (img && boxImage.current) {
              boxImage.current.src = img.currentSrc || img.src;
              boxImage.current.alt = img.alt;
            }
            box.current?.showModal();
          }}
        >
          <img ref={image} className="detail-image" src={foto.url} alt={photoAlt(name, cor, foto)} width={640} height={640} />
        </button>
        <span className="zoom-hint">
          <Icon name="zoom" size={16} />
          <span className="hint-fine">Passe o cursor para ampliar ou clique para tela cheia</span>
          <span className="hint-touch">Toque para ampliar</span>
        </span>
        <button type="button" className="gallery-nav gallery-prev" data-gallery-step="-1" aria-label="Foto anterior" hidden={!many} onClick={() => show(current - 1)}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <button type="button" className="gallery-nav gallery-next" data-gallery-step="1" aria-label="Próxima foto" hidden={!many} onClick={() => show(current + 1)}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className="gallery-count" aria-hidden="true" hidden={!many}>
          {many ? `${current + 1}/${photos.length}` : ""}
        </span>
        <WishButton product={product} />
      </div>
      <div className="gallery-thumbs" role="group" aria-label={`Fotos de ${name}`} hidden={!many}>
        {many &&
          photos.map((f, i) => (
            <button
              key={`${f.url}-${i}`}
              type="button"
              className="gallery-thumb"
              data-thumb={i}
              aria-label={`Foto ${i + 1} de ${photos.length}: ${VISTAS[f.vista || ""] || "produto"}`}
              aria-current={i === current}
              onClick={() => show(i)}
            >
              <img src={f.url} alt="" width={72} height={72} loading="lazy" />
            </button>
          ))}
      </div>
      <p className="sr-only" aria-live="polite" data-gallery-status="">
        {status}
      </p>
      {mounted &&
        createPortal(
          <dialog
            ref={box}
            className="lightbox"
            aria-label={`Imagem ampliada de ${name}`}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target === event.currentTarget || target.closest("[data-close]")) event.currentTarget.close();
            }}
          >
            <img ref={boxImage} src={undefined} alt={name} />
            <button type="button" className="icon-button" data-close="" aria-label="Fechar imagem">
              <Icon name="close" />
            </button>
          </dialog>,
          document.body,
        )}
    </div>
  );
}

// Seletor de cor (bolinhas): a cor esgotada continua visível, marcada como esgotada.
export function ColorPicker({ colors, current, note, onChange }: { colors: { nome: string; hex: string; estoque?: number }[]; current: string | null; note: string; onChange: (cor: string) => void }) {
  return (
    <fieldset className="color-picker">
      <legend>
        Cor: <strong data-color-name="">{current}</strong>
      </legend>
      <div className="swatches">
        {colors.map((c) => (
          <label key={c.nome} className={`swatch${c.estoque === 0 ? " is-out" : ""}`} title={`${c.nome}${c.estoque === 0 ? " (esgotado)" : ""}`}>
            <input type="radio" name="cor" value={c.nome} checked={c.nome === current} onChange={() => onChange(c.nome)} />
            <span className="swatch-dot" data-hex={c.hex} style={{ "--swatch": c.hex } as CSSProperties} aria-hidden="true" />
            <span className="sr-only">
              {c.nome}
              {c.estoque === 0 ? " (esgotado)" : ""}
            </span>
          </label>
        ))}
      </div>
      <p className="small color-stock" data-color-stock="" aria-live="polite">
        {note}
      </p>
    </fieldset>
  );
}
