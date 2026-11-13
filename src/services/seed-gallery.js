// Etapa 29: fotos extras (vistas) e opções de cor, por modelo, como a ficha técnica.
// A primeira cor é a padrão, e a vista "frente" dela é a foto principal do manifesto
// (seed-products.js). As demais ficam numa pasta com o nome da foto principal:
//   com cores:  amplificadores/vox-ac30c2/roxo-frente.png, .../preto-costas.png
//   sem cores:  amplificadores/boss-katana-50-mkii/topo.png
// Foto extra que faltar não impede o seed: o produto entra com as fotos que existirem.
export const VISTAS = { frente: "Frente", topo: "Painel de controles", costas: "Traseira" };

const PRETO = { nome: "Preto", hex: "#1f1f22" };
const TRES = ["frente", "topo", "costas"];
export const seedGallery = {
  "Blues Junior IV": { vistas: ["frente", "costas"], cores: [PRETO, { nome: "Laranja", hex: "#c98a4b" }] },
  "Hot Rod Deluxe IV": { vistas: TRES, cores: [PRETO, { nome: "Amarelo", hex: "#d4a73c", vistas: ["frente", "topo"] }] },
  "'65 Twin Reverb": { vistas: ["frente", "costas"] },
  DSL20CR: { vistas: ["frente", "costas"] },
  "Origin 20C": { vistas: TRES },
  AC30C2: { vistas: TRES, cores: [PRETO, { nome: "Roxo", hex: "#4a4483" }] },
  "Crush 20RT": { vistas: TRES, cores: [{ nome: "Laranja", hex: "#ee7a1f" }, PRETO, { nome: "Branco", hex: "#f2f2ef" }] },
  "Katana-50 MkII": { vistas: TRES },
  "Champion 20": { vistas: ["frente", "costas"] },
  "5150 Iconic 15W 1x10": { vistas: TRES },
};

export const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Lista de fotos do produto na ordem da galeria: [{ file, cor, vista }]. A primeira é a principal.
export function galleryFiles(product) {
  const g = seedGallery[product.modelo];
  if (!g) return [{ file: product.file, cor: null, vista: "frente" }];
  const dir = product.file.replace(/\.png$/, "");
  const cores = g.cores || [null];
  return cores.flatMap((cor, i) =>
    (cor?.vistas || g.vistas).map((vista) => ({
      file: i === 0 && vista === "frente" ? product.file : `${dir}/${cor ? `${slug(cor.nome)}-` : ""}${vista}.png`,
      cor: cor?.nome || null,
      vista,
    })),
  );
}
export const galleryColors = (modelo) => (seedGallery[modelo]?.cores || []).map(({ nome, hex }) => ({ nome, hex }));
