// Tipos da loja usados pelas páginas e componentes.
export type Product = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  descricao: string;
  priceCents: number;
  estoque: number;
  imageUrl?: string;
  blobName?: string;
  cores?: { nome: string; hex: string; estoque?: number }[];
  fotos?: { url: string; cor: string | null; vista?: string }[];
  ficha?: { generos?: string[] } & Record<string, unknown>;
};
export type User = { id: string; nome: string; email: string; role: string; naoLidas?: number };
export type CartItem = { id: string; quantidade: number; cor?: string; servicos?: string[] };
