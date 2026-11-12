// Fichas técnicas do catálogo inicial, por modelo. Valores seguem public/js/specs.js
// (validados em tests/catalog-specs.test.js). Revisar contra as fotos: docs/PENDENCIAS-MANUAIS.txt.
export const seedSpecs = {
  // Correias
  "Correia Classic Black": { estilo: "Atemporal", generos: [], material: "Nylon", visual: "Liso" },
  "Correia Casino Cards": { estilo: "Vintage", generos: ["Rockabilly", "Punk", "Rock clássico"], material: "Nylon", visual: "Estampado" },
  "Correia Union Jack": { estilo: "Vintage", generos: ["Rock clássico", "Punk", "Indie"], material: "Nylon", visual: "Estampado" },
  // Amplificadores
  "AC15 Valvulado": {
    estilo: "Vintage",
    generos: ["Rock clássico", "Blues rock", "Indie", "Pop", "Shoegaze"],
    tecnologia: "Valvulado",
    potencia: 15,
    falantes: "1x12",
    voicing: "Britânico",
    uso: ["Ensaio", "Estúdio", "Palco"],
    nivel: "Profissional",
  },
  "212 Combo": {
    estilo: "Vintage",
    generos: ["Blues", "Country", "Funk", "Jazz", "Rock clássico"],
    tecnologia: "Valvulado",
    potencia: 65,
    falantes: "2x12",
    voicing: "Americano",
    uso: ["Ensaio", "Palco", "Estúdio"],
    nivel: "Profissional",
  },
  "Vulcano 100": {
    estilo: "Moderno",
    generos: ["Hard rock", "Heavy metal", "Grunge", "Punk"],
    tecnologia: "Transistor",
    potencia: 100,
    falantes: "1x12",
    voicing: "High gain",
    uso: ["Ensaio", "Palco"],
    nivel: "Intermediário",
  },
  // Pedais
  "IR Box": { estilo: "Moderno", generos: [], efeito: "Gabinete virtual (IR)", tecnologia: "Digital", uso: ["Estudo em casa", "Estúdio"], nivel: "Intermediário" },
  "Ultra Chorus": { estilo: "Atemporal", generos: ["Pop", "Indie", "Funk", "Shoegaze", "Rock clássico"], efeito: "Chorus", tecnologia: "Analógico", uso: ["Estudo em casa", "Ensaio", "Palco"], nivel: "Iniciante" },
  "Kit Pedalboard com Bag": { estilo: "Atemporal", generos: [], efeito: "Pedalboard", tecnologia: "Não se aplica", uso: ["Ensaio", "Palco"] },
  "Pedalboard Wood Stage": { estilo: "Vintage", generos: [], efeito: "Pedalboard", tecnologia: "Não se aplica", uso: ["Ensaio", "Palco"] },
  "TONEX MultiFX": { estilo: "Moderno", generos: [], efeito: "Multiefeitos", tecnologia: "Digital", uso: ["Estudo em casa", "Ensaio", "Palco", "Estúdio"], nivel: "Profissional" },
  GE100: { estilo: "Moderno", generos: [], efeito: "Multiefeitos", tecnologia: "Digital", uso: ["Estudo em casa", "Ensaio"], nivel: "Iniciante" },
  // Guitarras
  "ST Electric Pink": {
    estilo: "Vintage",
    generos: ["Blues", "Blues rock", "Rock clássico", "Funk", "Surf", "Pop"],
    formato: "Strat",
    captacao: "Single-coil",
    ponte: "Tremolo",
    timbre: ["Brilhante"],
    nivel: "Iniciante",
  },
  "Single Cut Gold": {
    estilo: "Vintage",
    generos: ["Blues rock", "Rock clássico", "Hard rock", "Jazz"],
    formato: "Single cut",
    captacao: "Humbucker",
    ponte: "Tune-o-matic",
    timbre: ["Encorpado", "Quente"],
    nivel: "Intermediário",
  },
  "Double Cut Ocean Blue": {
    estilo: "Atemporal",
    generos: ["Rock clássico", "Hard rock", "Punk", "Grunge", "Indie"],
    formato: "Double cut",
    captacao: "Humbucker",
    ponte: "Tune-o-matic",
    timbre: ["Encorpado", "Agressivo"],
    nivel: "Intermediário",
  },
  // Acessórios
  "Wall Hanger": { estilo: "Atemporal", generos: [], tipo: "Suporte de parede", compatibilidade: "Guitarras e baixos" },
  "Stage Stand": { estilo: "Atemporal", generos: [], tipo: "Suporte de chão", compatibilidade: "Guitarras, baixos e violões" },
  "Kit de Palhetas Color Mix": { estilo: "Atemporal", generos: [], tipo: "Palhetas", compatibilidade: "Guitarra, violão e baixo" },
  // Cabos
  "Kit 3 Patch Cables P10": { estilo: "Atemporal", generos: [], tipo: "Patch", conectores: "P10 L / L", comprimento: 0.15 },
  "Cabo Espiral Branco P10": { estilo: "Vintage", generos: ["Rock clássico", "Punk", "Funk"], tipo: "Espiral", conectores: "P10 reto / reto", comprimento: 7.6 },
  "Ninja P10": { estilo: "Atemporal", generos: [], tipo: "Instrumento", conectores: "P10 reto / L", comprimento: 3 },
  "Cabo Instrument Cable P10": { estilo: "Atemporal", generos: [], tipo: "Instrumento", conectores: "P10 reto / reto", comprimento: 3 },
};
