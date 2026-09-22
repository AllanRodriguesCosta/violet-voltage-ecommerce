const products = [
  [
    "Guitarras",
    "Aurora Works",
    "Orbit VI",
    189900,
    12,
    "Guitarra de seis cordas com corpo sólido, dois captadores e personalidade para explorar novos timbres.",
  ],
  [
    "Pedais",
    "Nebula Audio",
    "Fuzz Reactor",
    45900,
    20,
    "Pedal de fuzz com controles de ganho, volume e tonalidade. Uma nova textura para riffs e solos.",
  ],
  [
    "Amplificadores",
    "Echo Forge",
    "Studio 20",
    129900,
    8,
    "Amplificador compacto de estudo, com controles de equalização e potência demonstrativa de 20 watts.",
  ],
  [
    "Guitarras",
    "Aurora Works",
    "Lunar Offset",
    239900,
    6,
    "Guitarra de desenho offset original, ponte fixa e timbres versáteis para palco e estúdio.",
  ],
  [
    "Cabos",
    "Signal Lab",
    "Stage Link 3m",
    8900,
    35,
    "Cabo de instrumento com três metros, conectores robustos e revestimento flexível.",
  ],
  [
    "Correias",
    "Midnight Gear",
    "Night Rider",
    12900,
    24,
    "Correia ajustável de tecido resistente, confortável para acompanhar longas sessões de música.",
  ],
  [
    "Acessórios",
    "Signal Lab",
    "Power Station 9V",
    22900,
    15,
    "Fonte de alimentação demonstrativa para pedais de guitarra. Confira a compatibilidade antes do uso.",
  ],
  [
    "Pedais",
    "Nebula Audio",
    "Violet Echo",
    69900,
    10,
    "Pedal de delay com controles de repetição e tempo para criar atmosferas e texturas musicais.",
  ],
];
export async function seed(storage) {
  let added = 0;
  for (const [
    index,
    [categoria, marca, modelo, priceCents, estoque, descricao],
  ] of products.entries()) {
    const rowKey = `demo-${String(index + 1).padStart(3, "0")}`;
    const partitionKey = categoria
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (await storage.get("products", partitionKey, rowKey)) continue;
    await storage.create("products", {
      partitionKey,
      rowKey,
      categoria,
      marca,
      modelo,
      priceCents,
      estoque,
      descricao,
      ativo: true,
      blobName: "",
      imageUrl: `/assets/${categoria === "Guitarras" ? "product" : categoria === "Pedais" ? "pedal" : categoria === "Amplificadores" ? "amp" : "accessory"}.svg`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    added++;
  }
  return added;
}
