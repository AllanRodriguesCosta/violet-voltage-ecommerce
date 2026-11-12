// Kits prontos: combinações curadas com desconto quando todos os itens estão no carrinho.
// Sem DOM: o servidor calcula o desconto com estas mesmas regras (src/services/pricing.js).
export const KITS = Object.freeze([
  {
    id: "primeira-guitarra",
    nome: "Kit primeira guitarra",
    texto: "Guitarra, amplificador, cabo, correia, palhetas e afinador: tudo para plugar e começar hoje.",
    publico: "Para quem está começando",
    descontoPct: 10,
    itens: ["demo-035", "demo-045", "demo-021", "demo-067", "demo-074", "demo-072"],
  },
  {
    id: "blues-classico",
    nome: "Kit blues clássico",
    texto: "Strat de captação simples, valvulado americano e o overdrive mais querido do blues.",
    publico: "Blues e blues rock",
    descontoPct: 7,
    itens: ["demo-024", "demo-037", "demo-048", "demo-076", "demo-063", "demo-065"],
  },
  {
    id: "metal-moderno",
    nome: "Kit metal moderno",
    texto: "Superstrat com humbuckers, amplificador high gain e distorção para riffs pesados.",
    publico: "Heavy metal e hard rock",
    descontoPct: 8,
    itens: ["demo-034", "demo-006", "demo-059", "demo-076", "demo-022", "demo-001"],
  },
  {
    id: "pedalboard-essencial",
    nome: "Kit pedalboard essencial",
    texto: "Base com bag, fonte isolada, cabos patch, afinador, overdrive e delay analógico.",
    publico: "Para montar a primeira pedaleira",
    descontoPct: 8,
    itens: ["demo-009", "demo-077", "demo-064", "demo-055", "demo-047", "demo-052"],
  },
  {
    id: "manutencao",
    nome: "Kit cuidado e manutenção",
    texto: "Cordas novas, limpeza, afinador e palhetas para manter a guitarra sempre pronta.",
    publico: "Para qualquer guitarrista",
    descontoPct: 10,
    itens: ["demo-068", "demo-073", "demo-072", "demo-074"],
  },
]);
export const kitById = (id) => KITS.find((k) => k.id === id) || null;

// Preço do kit a partir dos produtos atuais; null se algum item estiver fora do catálogo ou sem estoque.
export function kitPrice(kit, products) {
  const items = kit.itens.map((id) => products.find((p) => p.id === id || p.rowKey === id));
  if (items.some((p) => !p || p.ativo === false)) return null;
  const totalCents = items.reduce((s, p) => s + p.priceCents, 0);
  const descontoCents = Math.round((totalCents * kit.descontoPct) / 100);
  return { items, totalCents, descontoCents, precoCents: totalCents - descontoCents, disponivel: items.every((p) => p.estoque > 0) };
}

// Descontos de kit de um carrinho já calculado ({ id, quantidade, priceCents }).
// Cada unidade entra em um kit só; kits de maior desconto são aplicados primeiro.
export function kitDiscounts(items) {
  const left = new Map(items.map((i) => [i.id, i.quantidade]));
  const price = new Map(items.map((i) => [i.id, i.priceCents]));
  const unit = (kit) => Math.round((kit.itens.reduce((s, id) => s + (price.get(id) || 0), 0) * kit.descontoPct) / 100);
  const applied = [];
  for (const kit of [...KITS].sort((a, b) => unit(b) - unit(a))) {
    if (!kit.itens.every((id) => left.has(id))) continue;
    const quantidade = Math.min(...kit.itens.map((id) => left.get(id)));
    if (quantidade < 1) continue;
    for (const id of kit.itens) left.set(id, left.get(id) - quantidade);
    applied.push({ id: kit.id, nome: kit.nome, quantidade, descontoCents: unit(kit) * quantidade });
  }
  return { kits: applied, descontoKitsCents: applied.reduce((s, k) => s + k.descontoCents, 0) };
}

// Itens do kit que faltam no carrinho (para o aviso "complete o kit").
export function kitProgress(cartIds) {
  const ids = new Set(cartIds);
  return KITS.map((kit) => ({ kit, faltam: kit.itens.filter((id) => !ids.has(id)) }))
    .filter(({ kit, faltam }) => faltam.length && faltam.length < kit.itens.length && faltam.length <= 2);
}
