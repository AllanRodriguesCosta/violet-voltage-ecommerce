// Compatibilidade do carrinho: o que falta para o equipamento funcionar (ou funcionar melhor).
// Sem DOM: usado pela página do carrinho e pelo assistente no servidor.
import { needsPower, fitsGenre, affinity } from "./specs.js";

const is = (p, categoria, test = () => true) => p?.categoria === categoria && test(p);
const guitar = (p) => is(p, "Guitarras");
const amp = (p) => is(p, "Amplificadores");
const pedal = (p) => is(p, "Pedais");
const effectPedal = (p) => pedal(p) && !["Pedalboard"].includes(p.ficha?.efeito);
const board = (p) => pedal(p) && p.ficha?.efeito === "Pedalboard";
const multi = (p) => pedal(p) && ["Multiefeitos", "Gabinete virtual (IR)"].includes(p.ficha?.efeito);
const instrumentCable = (p) => is(p, "Cabos", (x) => x.ficha?.tipo !== "Patch");
const patch = (p) => is(p, "Cabos", (x) => x.ficha?.tipo === "Patch");
const accessory = (tipo) => (p) => is(p, "Acessórios", (x) => x.ficha?.tipo === tipo);
const power = accessory("Fonte");
const multiPower = (p) => power(p) && /até \d+ pedais/i.test(p.ficha?.compatibilidade || "");
const strap = (p) => is(p, "Correias");
const strings = accessory("Encordoamento");
const name = (p) => `${p.marca} ${p.modelo}`;
const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);

// Melhor sugestão do catálogo: em estoque, fora do carrinho, que combina com o item principal.
function pick(catalog, inCart, test, main, { cheapest = false } = {}) {
  const pool = catalog.filter((p) => p.estoque > 0 && !inCart.has(p.id) && test(p));
  const genre = main?.ficha?.generos?.[0];
  const fitting = pool.filter((p) => fitsGenre(p, genre));
  const ranked = (fitting.length ? fitting : pool).sort((a, b) =>
    cheapest ? a.priceCents - b.priceCents : affinity(main, b) - affinity(main, a) || a.priceCents - b.priceCents,
  );
  return ranked[0] || null;
}

// lines: [{ product, quantidade }]; devolve avisos ordenados (essenciais primeiro).
export function cartAdvice(lines, catalog = []) {
  const items = lines.map((l) => l.product).filter(Boolean);
  const inCart = new Set(items.map((p) => p.id));
  const has = (test) => items.some(test);
  const advice = [];
  const add = (id, nivel, titulo, texto, sugestao) => advice.push({ id, nivel, titulo, texto, sugestao: sugestao ? sugestao.id : null });
  const guitars = items.filter(guitar);
  const mainGuitar = guitars[0];
  if (guitars.length && !has(instrumentCable))
    add("cabo", "essencial", "Falta o cabo da guitarra", `Para ligar ${name(mainGuitar)} no amplificador ou na pedaleira você precisa de um cabo de instrumento P10.`, pick(catalog, inCart, instrumentCable, mainGuitar));
  if (guitars.length && !has(amp) && !has(multi))
    add("amplificador", "essencial", "Como você vai ouvir a guitarra?", "Guitarra elétrica precisa de um amplificador, ou de uma pedaleira com saída de fone, para soar.", pick(catalog, inCart, amp, mainGuitar, { cheapest: !mainGuitar.ficha?.nivel || mainGuitar.ficha.nivel === "Iniciante" }));
  const powered = items.filter(needsPower);
  if (powered.length && !has(power)) {
    const many = powered.length > 1;
    add(
      "fonte",
      "essencial",
      many ? `${powered.length} pedais precisam de fonte` : "O pedal precisa de fonte",
      `${list(powered.map(name))} ${many ? "usam" : "usa"} fonte de 9V, que não vem na caixa${powered.some((p) => /bateria/.test(p.ficha.alimentacao)) ? " (a bateria acaba rápido no uso diário)" : ""}.${many ? " Uma fonte isolada alimenta todos de uma vez, sem chiado." : ""}`,
      pick(catalog, inCart, many ? multiPower : (p) => power(p) && !multiPower(p), null, { cheapest: true }),
    );
  } else if (powered.length > 1 && has(power) && !has(multiPower))
    add("fonte-multipla", "dica", "Uma fonte para todos os pedais", `A fonte do carrinho alimenta um pedal. Para ${powered.length} pedais, uma fonte isolada evita adaptadores e ruído.`, pick(catalog, inCart, multiPower, null, { cheapest: true }));
  const effects = items.filter(effectPedal);
  if (effects.length > 1 && !has(patch))
    add("patch", "essencial", "Faltam cabos entre os pedais", `Com ${effects.length} pedais você precisa de ${effects.length - 1} ${effects.length - 1 === 1 ? "cabo curto (patch)" : "cabos curtos (patch)"} para ligar um no outro.`, pick(catalog, inCart, patch, null, { cheapest: effects.length <= 4 }));
  if (effects.length > 2 && !has(board))
    add("pedalboard", "dica", "Organize os pedais", "Com três pedais ou mais, um pedalboard deixa tudo firme, ligado e fácil de levar.", pick(catalog, inCart, board, effects[0]));
  if (has(patch) && !effects.length && !has(instrumentCable))
    add("patch-sozinho", "aviso", "Cabo patch não liga a guitarra no amplificador", "Patch é o cabo curto que liga um pedal no outro. Para ir da guitarra até o amplificador, use um cabo de instrumento.", pick(catalog, inCart, instrumentCable, null, { cheapest: true }));
  if (guitars.length && !has(strap))
    add("correia", "dica", "Vai tocar em pé?", "Uma correia deixa a guitarra firme e o ombro confortável.", pick(catalog, inCart, strap, mainGuitar));
  if (guitars.length && !has(strings))
    add("cordas", "dica", "Encordoamento reserva", "Corda arrebenta na hora menos esperada: vale ter um jogo reserva de 0.10.", pick(catalog, inCart, strings, mainGuitar, { cheapest: true }));
  const order = { essencial: 0, aviso: 1, dica: 2 };
  return advice.sort((a, b) => order[a.nivel] - order[b.nivel]);
}
