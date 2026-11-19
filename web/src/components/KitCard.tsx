// Cartão de kit com desconto: preço cheio, economia e adição do kit inteiro ao carrinho.
import { createElement } from "react";
import { Icon } from "../lib/icons";
import { getCart, money, productImage, setCart, toast, type Product } from "../lib/shop";
import { KITS, kitPrice } from "../../../shared/kits.js";
import { installmentText, productUrl } from "./ProductCard";
import { openCart } from "../lib/drawer";

export type Kit = { id: string; nome: string; texto: string; publico: string; descontoPct: number; itens: string[] };
export const ALL_KITS = KITS as Kit[];
type Price = { items: Product[]; totalCents: number; precoCents: number; descontoCents: number; disponivel: boolean };

async function addKit(kit: Kit, products: Product[]) {
  const cart = getCart() as { id: string; quantidade: number }[];
  const blocked: string[] = [];
  for (const id of kit.itens) {
    const p = products.find((x) => x.id === id);
    const line = cart.find((i) => i.id === id);
    if (!p || (line?.quantidade || 0) + 1 > Math.min(99, p.estoque)) blocked.push(p ? `${p.marca} ${p.modelo}` : id);
  }
  if (blocked.length) return toast(`Não há estoque para mais um kit completo: ${blocked.join(", ")}.`, { type: "error" });
  for (const id of kit.itens) {
    const line = cart.find((i) => i.id === id);
    if (line) line.quantidade++;
    else cart.push({ id, quantidade: 1 });
  }
  try {
    setCart(cart);
  } catch {
    return toast("Não foi possível salvar o carrinho neste navegador.", { type: "error" });
  }
  openCart(`${kit.nome}: ${kit.itens.length} itens adicionados. O desconto de ${kit.descontoPct}% aparece no resumo do carrinho.`);
}

export function KitCard({ kit, products, detailed = false, level = 3 }: { kit: Kit; products: Product[]; detailed?: boolean; level?: 2 | 3 }) {
  const price = kitPrice(kit, products) as Price | null;
  if (!price) return null;
  const { items } = price;
  const parcel = installmentText(price.precoCents);
  return (
    <article className="setup-card kit-card" id={`kit-${kit.id}`} data-reveal>
      <span className="kit-badge">
        <Icon name="gift" size={16} />
        {kit.descontoPct}% off no kit
      </span>
      <div className="setup-thumbs">
        {items.slice(0, 6).map((p) => (
          <img key={p.id} src={productImage(p)} alt="" loading="lazy" width={96} height={96} />
        ))}
      </div>
      <span className="eyebrow">{kit.publico}</span>
      {createElement(`h${level}`, null, kit.nome)}
      <p>{kit.texto}</p>
      {detailed && (
        <ul className="setup-items">
          {items.map((p) => (
            <li key={p.id}>
              <a href={productUrl(p)}>
                {p.marca} {p.modelo}
              </a>
              <span>{p.estoque ? money(p.priceCents) : "Esgotado"}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="setup-total kit-total">
        <span>
          {items.length} itens · <s>{money(price.totalCents)}</s>
        </span>
        <strong>{money(price.precoCents)}</strong>
        <small>
          Economia de {money(price.descontoCents)}
          {parcel ? ` · ${parcel}` : ""}
        </small>
      </div>
      {price.disponivel ? (
        <button type="button" className="button full" onClick={() => addKit(kit, products)}>
          <Icon name="bag" size={18} />
          Adicionar kit ao carrinho
        </button>
      ) : (
        <p className="small muted">Um dos itens está esgotado no momento. O desconto volta quando ele for reposto.</p>
      )}
      <a className="setup-customize" href={`/setup.html?itens=${items.map((p) => encodeURIComponent(p.id)).join(",")}`}>
        Personalizar no montador <Icon name="arrowRight" size={16} />
      </a>
    </article>
  );
}
