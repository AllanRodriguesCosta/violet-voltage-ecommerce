// Etapa 33: setup pelo gosto (artista, tipo de som, cor), encomendas, parcerias e retomada
// da conversa depois do login.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storeFixture } from "./helpers/api-fixture.js";
import { seedProducts } from "../src/services/seed-products.js";
import { genres } from "../src/knowledge/genres.js";
import { artists, sounds, colors, productColors } from "../src/knowledge/taste.js";
import { SPEC_FIELDS } from "../public/js/specs.js";
import { reply } from "../src/assistant/index.js";
import { extractTaste, colorsOf } from "../src/assistant/taste.js";
import { parseCustom } from "../src/assistant/custom-order.js";
import { validCnpj } from "../src/services/requests.js";
import { validCnpj as validCnpjClient, maskCnpj, PRODUCTS } from "../public/js/pages/partners.js";
import { PARTNER_PRODUCTS } from "../src/services/requests.js";
import { fromQuery } from "../public/js/pages/request.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey, ativo: true }));
const byId = (id) => products.find((p) => p.id === id);
const chat = (user = { nome: "Ana" }, loaders = {}) => {
  let contexto;
  return async (mensagem) => {
    const r = await reply({ mensagem, contexto }, { products, user, ...loaders });
    contexto = r.contexto;
    return r;
  };
};
const total = (r) => r.cards.reduce((s, c) => s + c.priceCents, 0);
const guitarOf = (r) => byId(r.cards.find((c) => byId(c.id).categoria === "Guitarras").id);

test("base de gosto usa o vocabulário da ficha, gêneros, marcas e modelos que existem", () => {
  const vocab = (key) => new Set(Object.values(SPEC_FIELDS).flat().filter((f) => f.key === key).flatMap((f) => f.values || []));
  const allowed = { formato: vocab("formato"), captacao: vocab("captacao"), voicing: vocab("voicing"), tecnologia: vocab("tecnologia"), efeito: vocab("efeito"), timbre: vocab("timbre") };
  const brands = new Set(products.map((p) => p.marca));
  const genreNames = new Set(genres.map((g) => g.nome));
  for (const item of [...artists, ...sounds]) {
    for (const [key, values] of Object.entries(item.pref)) {
      if (key === "marcas") values.forEach((b) => assert.ok(brands.has(b), `${item.nome || item.id}: marca ${b}`));
      else values.forEach((v) => assert.ok(allowed[key].has(v), `${item.nome || item.id}: ${key} ${v}`));
    }
    for (const g of item.genero ? [item.genero] : item.generos) assert.ok(genreNames.has(g), `${item.nome || item.id}: gênero ${g}`);
  }
  const models = new Set(products.map((p) => p.modelo));
  const colorNames = new Set(colors.map((c) => c.nome));
  for (const [model, list] of Object.entries(productColors)) {
    assert.ok(models.has(model), `modelo ${model}`);
    list.forEach((c) => assert.ok(colorNames.has(c), `cor ${c}`));
  }
  // Toda guitarra tem cor conhecida (foto ou nome).
  for (const p of products.filter((x) => x.categoria === "Guitarras")) assert.ok(colorsOf(p).length, `cor da ${p.modelo}`);
});

test("extração de gosto: artista, banda, som leigo e cor só no contexto certo", () => {
  assert.equal(extractTaste("quero um setup igual ao do Slash").artista, "Slash");
  assert.equal(extractTaste("curto muito Pink Floyd").artista, "David Gilmour");
  assert.equal(extractTaste("curto muito Pink Floyd").cor, undefined, "pink de Pink Floyd não é cor");
  assert.equal(extractTaste("gosto de green day").artista, "Billie Joe Armstrong");
  assert.equal(extractTaste("quero algo pesado e intenso").som, "pesado");
  assert.equal(extractTaste("um som bem suave, melódico").som, "suave");
  assert.equal(extractTaste("algo espacial, viajante").som, "espacial");
  assert.equal(extractTaste("quero um som limpo").cor, undefined);
  assert.equal(extractTaste("guitarra vermelha", { temProduto: true }).cor, "Vermelho");
  assert.equal(extractTaste("de preferência na cor preta").cor, "Preto");
  assert.equal(extractTaste("Sunburst").cor, "Sunburst");
  assert.equal(extractTaste("gosto de pagode").desconhecido, "pagode");
});

test("setup pelo gosto: artista → cor → sem limite, com peças do perfil e explicação", async () => {
  const say = chat();
  const opening = await say("Montar setup pelo meu gosto");
  assert.equal(opening.intencao, "setup");
  assert.match(opening.texto, /artista ou banda/);
  assert.ok(opening.sugestoes.includes("Som do Slash"), "opções não são só de orçamento");
  const color = await say("Som do Slash");
  assert.equal(color.contexto.aguardando, "cor");
  assert.equal(color.contexto.filtros.genero, "Hard rock", "gênero vem do artista");
  const budget = await say("Vermelho");
  assert.equal(budget.contexto.aguardando, "orcamento");
  assert.ok(budget.sugestoes.includes("Sem limite"));
  const setup = await say("Sem limite");
  assert.match(setup.texto, /Slash é conhecido por usar/);
  assert.match(setup.texto, /Não vendemos os modelos assinatura/);
  const guitar = guitarOf(setup);
  assert.equal(guitar.ficha.formato, "Single cut");
  assert.ok(colorsOf(guitar).includes("Vermelho"), "guitarra na cor pedida");
  const amp = byId(setup.cards.find((c) => byId(c.id).categoria === "Amplificadores").id);
  assert.equal(amp.ficha.voicing, "Britânico");
  assert.ok(setup.cards.some((c) => /cor vermelho/.test(c.motivo)));
  const black = await say("quero em preto");
  assert.equal(black.intencao, "setup", "trocar a cor remonta o setup");
  assert.ok(colorsOf(guitarOf(black)).includes("Preto"));
});

test("setup por tipo de som em palavras leigas respeita o orçamento", async () => {
  const say = chat();
  await say("quero montar um setup com um som bem pesado");
  await say("Tanto faz");
  const setup = await say("Até R$ 5 mil");
  assert.ok(total(setup) <= 500000, "dentro do orçamento");
  assert.match(setup.texto, /pesado e intenso/);
  assert.equal(guitarOf(setup).ficha.captacao, "Humbucker");
});

test("artista desconhecido: diz que não conhece e pede descrição do som", async () => {
  const r = await chat()("gosto muito de pagode");
  assert.equal(r.intencao, "gosto_desconhecido");
  assert.match(r.texto, /Ainda não conheço o som de “pagode”/);
  assert.ok(r.sugestoes.includes("Pesado e intenso"));
});

test("recomendação por artista e por cor; cor com variação abre a página na cor", async () => {
  const say = chat();
  const hendrix = await say("quero uma guitarra igual a do Hendrix");
  assert.match(hendrix.texto, /Jimi Hendrix/);
  assert.ok(hendrix.cards.every((c) => byId(c.id).ficha.formato === "Strat"));
  const red = await chat()("quero uma guitarra vermelha");
  assert.ok(red.cards.length && red.cards.every((c) => colorsOf(byId(c.id)).includes("Vermelho")));
  const purple = await chat()("quero uma guitarra roxa");
  assert.match(purple.texto, /Não encontrei guitarras em roxo/);
  assert.ok(purple.sugestoes.includes("Encomendar guitarra roxa"), "sem a cor, oferece encomenda");
  const amp = await chat()("amplificador roxo");
  assert.equal(amp.cards[0].modelo, "AC30C2");
  assert.equal(amp.cards[0].cor, "Roxo");
});

test("encomenda personalizada: entende peças (com erro de digitação) e leva ao formulário", async () => {
  const r = await chat(null)("quero uma les paul com captadores saymour duncan, tarraxas gotoh e escala de ébano");
  assert.equal(r.intencao, "encomenda");
  for (const part of ["Base: Les Paul (single cut)", "Captadores: Seymour Duncan", "Tarraxas: Gotoh", "Escala: Ébano"]) assert.match(r.texto, new RegExp(part.replace(/[()]/g, "\\$&")));
  assert.match(r.texto, /você entra na conta/, "visitante sabe que vai precisar entrar");
  const action = r.acoes.find((a) => a.href?.startsWith("/encomenda.html?"));
  assert.ok(action);
  assert.ok(r.cards.every((c) => byId(c.id).ficha.formato === "Single cut"), "pronta entrega parecida");
  const form = fromQuery(action.href.split("?")[1]);
  assert.equal(form.tipo, "personalizado");
  assert.equal(form.produto, "Les Paul (single cut)");
  assert.match(form.detalhes, /Captadores: Seymour Duncan/);
  assert.equal(parseCustom("vocês conseguem importar um pedal Klon Centaur?").tipo, "importacao");
  const imp = await chat()("vocês conseguem importar um pedal Klon Centaur? não tem no catálogo");
  assert.equal(imp.intencao, "encomenda");
  assert.match(imp.texto, /buscar esse produto/);
});

test("“encomenda” do pedido e “não importa” não viram encomenda personalizada", async () => {
  assert.equal((await chat()("minha encomenda ainda não chegou")).intencao, "pedido_status");
  assert.notEqual((await chat()("tanto faz, não importa")).intencao, "encomenda");
});

test("status das encomendas: visitante recebe botão de login; cliente vê a resposta da loja", async () => {
  const guest = await chat(null)("como está minha encomenda?");
  assert.equal(guest.intencao, "encomenda_status");
  assert.equal(guest.acoes[0].tipo, "login");
  assert.match(guest.texto, /Assim que você entrar, eu continuo daqui/);
  const requests = async () => [{ codigo: "E-ABC123", produto: "Les Paul custom", status: "Orçamento enviado", resposta: "Fica em R$ 9.800 em 45 dias.", createdAt: "2026-11-10T10:00:00Z" }];
  const logged = await chat({ nome: "Ana" }, { requests })("como está minha encomenda?");
  assert.match(logged.texto, /E-ABC123 · Les Paul custom: Orçamento enviado\. Resposta da loja: Fica em R\$ 9\.800/);
});

test("fornecedor: o assistente leva à ficha de parceria, sem pedir login", async () => {
  const r = await chat(null)("sou fornecedor de pedais e quero vender meus produtos na loja");
  assert.equal(r.intencao, "parceria");
  assert.match(r.texto, /CNPJ/);
  assert.deepEqual(r.acoes.map((a) => a.href), ["/parceiros.html?produto=Pedais"]);
  assert.ok(!r.acoes.some((a) => a.tipo === "login"));
});

test("CNPJ: mesmo validador no navegador e no servidor; máscara", () => {
  for (const [cnpj, ok] of [["11.222.333/0001-81", true], ["11222333000181", true], ["11.222.333/0001-82", false], ["11111111111111", false], ["123", false]]) {
    assert.equal(validCnpj(cnpj), ok, cnpj);
    assert.equal(validCnpjClient(cnpj), ok, cnpj);
  }
  assert.equal(maskCnpj("11222333000181"), "11.222.333/0001-81");
  assert.deepEqual(PRODUCTS, PARTNER_PRODUCTS);
});

test("API: encomenda exige conta, avisa o cliente na resposta e entra na cópia de dados", async (t) => {
  const { call, register, admin, storage } = await storeFixture(t);
  assert.equal((await call("/encomendas", { body: { tipo: "personalizado", produto: "Les Paul" } })).status, 401);
  const ana = await register("ana@s33.test");
  const bad = await call("/encomendas", { cookie: ana, body: { tipo: "personalizado", produto: "Les Paul custom", contato: "WhatsApp" } });
  assert.equal(bad.status, 400, "WhatsApp sem telefone");
  const created = await call("/encomendas", { cookie: ana, body: { tipo: "personalizado", produto: "Les Paul custom", detalhes: "Captadores: Seymour Duncan", orcamentoCents: 1200000, contato: "E-mail" } });
  assert.equal(created.status, 201);
  assert.match(created.body.data.codigo, /^E-[0-9A-F]{6}$/);
  assert.equal((await call("/encomendas", { cookie: ana, body: { tipo: "personalizado", produto: "les paul CUSTOM" } })).status, 409, "duplicada");
  const boss = await admin();
  const list = await call("/admin/encomendas", { method: "GET", cookie: boss });
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].email, "ana@s33.test");
  assert.equal((await call(`/admin/encomendas/${created.body.data.id}`, { method: "PATCH", cookie: boss, body: { status: "Orçamento enviado", resposta: "" } })).status, 400, "orçamento sem texto");
  const answered = await call(`/admin/encomendas/${created.body.data.id}`, { method: "PATCH", cookie: boss, body: { status: "Orçamento enviado", resposta: "Fica em R$ 9.800 em 45 dias.", valorCents: 980000, prazoDias: 45 } });
  assert.equal(answered.status, 200);
  const mine = await call("/encomendas", { method: "GET", cookie: ana });
  assert.equal(mine.body.data[0].status, "Orçamento enviado");
  assert.equal(mine.body.data[0].valorCents, 980000);
  const notes = await call("/notifications", { method: "GET", cookie: ana });
  assert.ok(notes.body.data.itens.some((n) => n.tipo === "encomenda" && /9\.800/.test(n.texto)));
  const exported = await call("/account/export", { method: "GET", cookie: ana });
  assert.equal(exported.body.data?.encomendas?.length ?? exported.body.encomendas?.length, 1);
  const summary = await call("/admin/summary", { method: "GET", cookie: boss });
  assert.equal(typeof summary.body.data.encomendasAbertas, "number");
  assert.ok((await storage.list("requests")).length === 1);
});

test("API: ficha de parceria pública, com CNPJ válido, sem duplicar e com campo anti-robô", async (t) => {
  const { call, admin } = await storeFixture(t);
  const body = { razaoSocial: "Pedais Brasil Ltda", cnpj: "11.222.333/0001-81", produtos: ["Pedais"], contatoNome: "Carla Souza", email: "carla@pedais.test", telefone: "(11) 98888-7777", aceite: true };
  assert.equal((await call("/parcerias", { body: { ...body, cnpj: "11.222.333/0001-82" } })).status, 400);
  assert.equal((await call("/parcerias", { body: { ...body, produtos: [] } })).status, 400);
  assert.equal((await call("/parcerias", { body: { ...body, aceite: false } })).status, 400);
  const ok = await call("/parcerias", { body });
  assert.equal(ok.status, 201);
  assert.match(ok.body.data.protocolo, /^P-[0-9A-F]{6}$/);
  assert.equal((await call("/parcerias", { body })).status, 409);
  assert.equal((await call("/parcerias", { body: { ...body, cnpj: "11.444.777/0001-61", website: "spam" } })).status, 201, "robô recebe 201");
  const boss = await admin();
  const list = await call("/admin/parcerias", { method: "GET", cookie: boss });
  assert.equal(list.body.data.length, 1, "ficha do robô é descartada");
  assert.equal(list.body.data[0].cnpj, "11.222.333/0001-81");
  const updated = await call(`/admin/parcerias/${list.body.data[0].id}`, { method: "PATCH", cookie: boss, body: { status: "Em contato", notas: "Ligar na segunda" } });
  assert.equal(updated.body.data.status, "Em contato");
  assert.equal((await call("/admin/parcerias", { method: "GET" })).status, 401);
});

test("páginas novas, menu da conta, rodapé e botão de login com retomada da conversa", async () => {
  const [enc, par, assistant, common, app] = await Promise.all(["public/encomenda.html", "public/parceiros.html", "public/js/assistant.js", "public/js/common.js", "public/js/app.js"].map((f) => readFile(new URL(`../${f}`, import.meta.url), "utf8")));
  assert.match(enc, /id="request-form"/);
  assert.match(enc, /\/js\/pages\/request\.js/);
  assert.match(par, /name="cnpj"/);
  assert.match(par, /name="website"[^>]*tabindex="-1"/);
  assert.match(app, /"\/encomenda\.html": "request"/);
  assert.match(app, /"\/parceiros\.html": "partners"/);
  assert.match(common, /href="\/parceiros\.html">Seja um parceiro/);
  assert.match(common, /id: "encomendas"/);
  assert.match(assistant, /data-assistant-login href="\/login\.html\?next=/);
  assert.match(assistant, /data-assistant-login href="\/cadastro\.html\?next=/);
  assert.match(assistant, /takePending\(\)/);
  for (const html of [enc, par]) assert.doesNotMatch(html, /demonstr|simulad|nenhuma cobrança|sem cobrança/i);
});
