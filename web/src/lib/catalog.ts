// Catálogo, busca, ficha técnica e galeria: regras de shared/ (as mesmas do servidor) com tipos
// para as páginas em React.
import {
  searchProducts as searchJs,
  correctQuery as correctJs,
  photosOf as photosJs,
  itemColor as itemColorJs,
  categoryInfo as categoryInfoJs,
  bundlePicks as bundlePicksJs,
} from "../../../shared/catalog.js";
import { fieldMessage as fieldMessageJs } from "../../../shared/forms.js";
import { specFields as specFieldsJs, specList as specListJs, specRows as specRowsJs, compareRows as compareRowsJs, SPEC_FIELDS, affinity as affinityJs } from "../../../shared/specs.js";
import { servicesFor as servicesForJs } from "../../../shared/services.js";
import { delivery as deliveryJs, shipping as shippingJs } from "../../../shared/pricing.js";
import type { Product } from "./types";

export { rememberSearch, pushRecent, setWishlist } from "./cart";
export { getCompare, setCompare, MAX_COMPARE } from "./compare";
export { openCart } from "./drawer";

export type Color = { nome: string; hex: string; estoque?: number };
export type Photo = { url: string; cor: string | null; vista?: string };
export type Detail = Omit<Product, "cores"> & { cores?: Color[]; fotos?: Photo[] };
export type SpecField = { key: string; label: string; values?: string[]; filter?: boolean };

export const searchProducts: <T extends Product>(products: T[], query: string) => T[] = searchJs as never;
export const correctQuery: (products: Product[], query: string) => string | null = correctJs as never;
export const photosOf: (product: Detail, cor: string | null) => Photo[] = photosJs as never;
export const itemColor: (product: Detail, cor: string | null) => string | null = itemColorJs as never;
export const fieldMessage: (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, custom?: string) => string = fieldMessageJs as never;

export const specFields: (categoria: string) => SpecField[] = specFieldsJs as never;
export const specList: (product: Product, key: string) => string[] = specListJs as never;
export const specRows: (product: Product) => { field: SpecField; text: string }[] = specRowsJs as never;
export const compareRows: (products: Product[]) => { key: string; label: string; values: string[]; differs: boolean }[] = compareRowsJs as never;
export const affinity: (a: Product, b: Product) => number = affinityJs as never;
export const guitarFields = (SPEC_FIELDS as Record<string, SpecField[]>).Guitarras;
export const categoryInfo = categoryInfoJs as Record<string, string>;

export const bundlePicks: (product: Product, others: Product[]) => Product[] = bundlePicksJs as never;
export const servicesFor: (product: Product) => { id: string; nome: string; priceCents: number; texto?: string }[] = servicesForJs as never;
export const delivery = deliveryJs as Record<string, { label: string; prazo: string }>;
export const shipping = shippingJs as Record<string, number>;
