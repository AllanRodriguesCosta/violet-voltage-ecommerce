// Barra flutuante da comparação: miniaturas dos produtos escolhidos (até 4), limpar e ir para a
// tabela. Some quando a lista está vazia, na própria página de comparação, no checkout e no painel.
import { useEffect, useState } from "react";
import { Icon } from "../lib/icons";
import { MAX_COMPARE, setCompare, useCompare } from "../lib/compare";
import { catalogProducts, toast, type Product } from "../lib/shop";
import { productImage } from "../../../shared/catalog.js";
import { BodyPortal } from "./Portal";

function Tray() {
  const ids = useCompare();
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    catalogProducts()
      .then((list) => alive && setProducts(list))
      .catch(() => {
        /* miniaturas são opcionais */
      });
    return () => {
      alive = false;
    };
  }, [ids]);
  useEffect(() => {
    document.body.classList.toggle("has-compare-tray", ids.length > 0);
    return () => document.body.classList.remove("has-compare-tray");
  }, [ids.length]);
  const chosen = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return (
    <aside className="compare-tray" aria-label="Comparação de produtos" hidden={!ids.length}>
      {ids.length > 0 && (
        <div className="container compare-tray-inner">
          <span className="compare-tray-title">
            <Icon name="compare" size={18} />
            <strong>
              {ids.length} de {MAX_COMPARE}
            </strong>
            <span className="hide-sm"> para comparar</span>
          </span>
          <ul className="compare-thumbs">
            {chosen.map((p) => (
              <li key={p.id}>
                <img src={productImage(p)} alt={`${p.marca} ${p.modelo}`} width={40} height={40} />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-button"
            data-compare-clear
            onClick={() => {
              setCompare([]);
              toast("Comparação limpa.", { type: "info" });
            }}
          >
            Limpar
          </button>
          <a
            className="button"
            href="/comparar.html"
            aria-disabled={ids.length < 2 || undefined}
            data-compare-few={ids.length < 2 || undefined}
            onClick={(event) => {
              if (ids.length >= 2) return;
              event.preventDefault();
              toast("Escolha pelo menos 2 produtos para comparar.", { type: "info" });
            }}
          >
            Comparar
          </a>
        </div>
      )}
    </aside>
  );
}

export function CompareTray() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!["/comparar.html", "/checkout.html", "/admin.html"].includes(location.pathname)), []);
  return show ? (
    <BodyPortal>
      <Tray />
    </BodyPortal>
  ) : null;
}
