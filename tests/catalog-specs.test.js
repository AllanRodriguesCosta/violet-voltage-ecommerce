import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { SPEC_FIELDS, GENEROS, ESTILOS, checkSpecs, specRows, specText, specList, specField, fitsGenre, affinity } from "../public/js/specs.js";
import { bundlePicks } from "../public/js/pages/product.js";
import { seedProducts, expansionProducts } from "../src/services/seed-products.js";
import { readFile } from "node:fs/promises";
import { seedSpecs } from "../src/services/seed-specs.js";
import { genres } from "../src/knowledge/genres.js";
import { categories } from "../src/utils/validation.js";
import { searchProducts } from "../public/js/common.js";
import { publicProduct } from "../src/controllers/serialization.js";
import { MemoryStorage } from "../src/repositories/memory.js";
import { createApp } from "../src/app.js";
import { bootstrapAdmin } from "../src/services/bootstrap.js";

const products = seedProducts.map((p) => ({ ...p, id: p.rowKey }));

test("ficha: todas as categorias têm esquema e nenhum campo repete chave", () => {
  assert.deepEqual(Object.keys(SPEC_FIELDS).sort(), [...categories].sort());
  for (const [categoria, fields] of Object.entries(SPEC_FIELDS)) {
    const keys = fields.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, categoria);
    for (const f of fields) if (f.type === "enum" || f.type === "multi") assert.ok(f.values.length, `${categoria}.${f.key}`);
  }
});

test("ficha: todos os produtos do manifesto têm ficha válida e coerente com a categoria", () => {
  assert.equal(Object.keys(seedSpecs).length, seedProducts.length, "uma ficha por modelo, sem sobras");
  for (const p of seedProducts) {
    assert.ok(p.ficha, `${p.modelo} sem ficha`);
    const { erro } = checkSpecs(p.categoria, p.ficha);
    assert.equal(erro, undefined, `${p.modelo}: ${erro}`);
    assert.ok(ESTILOS.includes(p.ficha.estilo), `${p.modelo}: estilo`);
    assert.ok(Array.isArray(p.ficha.generos), `${p.modelo}: gêneros como lista`);
  }
  const guitars = seedProducts.filter((p) => p.categoria === "Guitarras");
  for (const g of guitars) for (const key of ["formato", "captacao", "nivel"]) assert.ok(g.ficha[key], `${g.modelo}.${key}`);
});

test("ficha: validação recusa campo de outra categoria, valor fora da lista e número fora da faixa", () => {
  assert.match(checkSpecs("Cabos", { formato: "Strat" }).erro, /não pertence/);
  assert.match(checkSpecs("Guitarras", { formato: "Banjo" }).erro, /Formato/);
  assert.match(checkSpecs("Guitarras", { generos: ["Forró"] }).erro, /Indicado para/);
  assert.match(checkSpecs("Amplificadores", { potencia: 9999 }).erro, /Potência/);
  assert.match(checkSpecs("Guitarras", []).erro, /inválida/);
  assert.match(checkSpecs("Guitarras", { timbre: ["Brilhante", "Encorpado", "Quente", "Agressivo"] }).erro, /no máximo 3/);
  assert.deepEqual(checkSpecs("Amplificadores", { potencia: "15", voicing: "", uso: [] }).ficha, { potencia: 15 });
  assert.equal(checkSpecs("Guitarras", {}).ficha, null, "ficha vazia vira null");
  assert.deepEqual(checkSpecs("Guitarras", { generos: ["Blues", "Blues"] }).ficha, { generos: ["Blues"] });
});

test("ficha: linhas exibidas, texto de busca e lista para filtros", () => {
  const strat = products.find((p) => p.modelo === "ST Electric Pink");
  const rows = specRows(strat).map((r) => [r.field.key, r.text]);
  assert.deepEqual(rows[0], ["estilo", "Vintage"]);
  assert.ok(rows.some(([k, t]) => k === "captacao" && t === "Single-coil"));
  const amp = products.find((p) => p.modelo === "AC15 Valvulado");
  assert.ok(specRows(amp).some((r) => r.text === "15 W"));
  const cable = products.find((p) => p.modelo === "Ninja P10");
  assert.ok(specRows(cable).some((r) => r.text === "3 m"));
  assert.ok(specRows(cable).some((r) => r.field.key === "generos" && /Versátil/.test(r.text)), "sem gêneros = versátil");
  assert.deepEqual(specRows({ categoria: "Guitarras" }), [], "sem ficha, sem linhas");
  assert.match(specText(strat), /Vintage.*Blues/);
  assert.deepEqual(specList(strat, "formato"), ["Strat"]);
  assert.deepEqual(specList(cable, "generos"), []);
  assert.deepEqual(specList({}, "formato"), []);
});

test("busca do catálogo encontra pela ficha: vintage, blues, humbucker", () => {
  const names = (q) => searchProducts(products, q).map((p) => p.modelo);
  assert.ok(names("guitarra vintage blues").includes("ST Electric Pink"));
  assert.ok(names("humbucker").includes("Single Cut Gold"));
  assert.ok(!names("humbucker").includes("ST Electric Pink"));
  assert.ok(names("valvulado britanico").includes("AC15 Valvulado"));
  assert.deepEqual(names("chorus"), ["Ultra Chorus"]);
});

test("base de gêneros usa só valores existentes na ficha técnica", () => {
  assert.deepEqual(genres.map((g) => g.nome).sort(), [...GENEROS].sort(), "um perfil por gênero da ficha");
  const groups = { guitarras: "Guitarras", amplificadores: "Amplificadores", pedais: "Pedais" };
  for (const g of genres) {
    assert.ok(ESTILOS.includes(g.estilo), g.nome);
    assert.ok(g.sinonimos.length && g.resumo, g.nome);
    for (const [group, categoria] of Object.entries(groups))
      for (const [key, values] of Object.entries(g[group])) {
        const field = specField(categoria, key);
        assert.ok(field, `${g.nome}: ${categoria}.${key}`);
        for (const v of values) assert.ok(field.values.includes(v), `${g.nome}: ${categoria}.${key} = ${v}`);
      }
  }
  const synonyms = genres.flatMap((g) => g.sinonimos);
  assert.equal(new Set(synonyms).size, synonyms.length, "sinônimo não pode apontar para dois gêneros");
});

test("todo gênero vintage tem ao menos uma guitarra do catálogo que combina com ele", () => {
  const guitars = products.filter((p) => p.categoria === "Guitarras");
  for (const g of genres.filter((x) => x.estilo === "Vintage" && ["Blues", "Blues rock", "Rock clássico"].includes(x.nome)))
    assert.ok(
      guitars.some((p) => g.guitarras.formato.includes(p.ficha.formato) && g.guitarras.captacao.includes(p.ficha.captacao)),
      g.nome,
    );
});

// Etapa 18: o catálogo precisa sustentar a recomendação por gênero do assistente.
const byCategory = (categoria) => products.filter((p) => p.categoria === categoria);
const UTILITY = ["Afinador", "Looper", "Multiefeitos", "Gabinete virtual (IR)", "Pedalboard"];

test("cada gênero tem guitarra, amplificador e pedal etiquetados no catálogo", () => {
  for (const g of genres)
    for (const categoria of ["Guitarras", "Amplificadores", "Pedais"])
      assert.ok(byCategory(categoria).some((p) => p.ficha.generos.includes(g.nome)), `${g.nome} sem ${categoria}`);
});

test("etiquetas de gênero coerentes com a base de conhecimento", () => {
  const profile = Object.fromEntries(genres.map((g) => [g.nome, g]));
  for (const p of byCategory("Guitarras"))
    for (const nome of p.ficha.generos) {
      const want = profile[nome].guitarras;
      assert.ok(want.formato.includes(p.ficha.formato) || want.captacao.includes(p.ficha.captacao), `${p.modelo} × ${nome}`);
    }
  for (const p of byCategory("Amplificadores"))
    for (const nome of p.ficha.generos) {
      const want = profile[nome].amplificadores;
      assert.ok(want.tecnologia.includes(p.ficha.tecnologia) || want.voicing.includes(p.ficha.voicing), `${p.modelo} × ${nome}`);
    }
  for (const p of byCategory("Pedais")) {
    if (UTILITY.includes(p.ficha.efeito)) assert.deepEqual(p.ficha.generos, [], `${p.modelo}: utilitário é versátil`);
    for (const nome of p.ficha.generos) assert.ok(profile[nome].pedais.efeito.includes(p.ficha.efeito), `${p.modelo} × ${nome}`);
  }
});

test("conversa-alvo: guitarra vintage para blues rock tem várias Strats em estoque", () => {
  const picks = byCategory("Guitarras").filter((p) => p.ficha.estilo === "Vintage" && p.ficha.generos.includes("Blues rock") && p.estoque > 0);
  assert.ok(picks.filter((p) => p.ficha.formato === "Strat").length >= 3, picks.map((p) => p.modelo).join(", "));
  assert.ok(picks.some((p) => p.ficha.formato !== "Strat"), "alternativa a Strat para comparar");
  assert.ok(new Set(picks.map((p) => p.marca)).size >= 3);
});

test("lista de fotos pendentes cobre todos os produtos da expansão", async () => {
  const doc = await readFile(new URL("../docs/FOTOS-PENDENTES.txt", import.meta.url), "utf8");
  for (const p of expansionProducts) {
    assert.ok(doc.includes(p.file), `${p.file} fora da lista`);
    assert.ok(doc.includes(`${p.marca} ${p.modelo}`), `${p.modelo} sem nome na lista`);
  }
  const listed = doc.match(/^\s*\[[ xX]\] \S+\.png/gm) || [];
  assert.equal(listed.length, expansionProducts.length, "uma linha por foto nova");
});

test("afinidade e gênero: versátil serve para tudo; gêneros e estilo em comum somam", () => {
  const strat = products.find((p) => p.modelo === "ST Electric Pink");
  const couro = products.find((p) => p.modelo === "Correia Couro Vintage Marrom");
  const algodao = products.find((p) => p.modelo === "Correia Algodão Cru");
  assert.ok(fitsGenre(algodao, "Heavy metal") && fitsGenre({}, "Jazz") && fitsGenre(strat, ""));
  assert.ok(fitsGenre(strat, "Surf") && !fitsGenre(strat, "Heavy metal"));
  assert.equal(affinity(strat, couro), 3, "Blues + Rock clássico + Vintage");
  assert.equal(affinity(strat, algodao), 0.5);
});

test("Compre junto usa a ficha: cabo certo, estilo parecido e orçamento", () => {
  const find = (modelo) => products.find((p) => p.modelo === modelo);
  const picks = (modelo) => {
    const p = find(modelo);
    return bundlePicks(p, products.filter((x) => x.id !== p.id && x.estoque > 0));
  };
  const strat = picks("ST Electric Pink");
  assert.deepEqual(strat.map((x) => x.categoria), ["Cabos", "Correias"]);
  assert.notEqual(strat[0].ficha.tipo, "Patch", "guitarra leva cabo de instrumento");
  assert.equal(strat[1].ficha.estilo, "Vintage", "guitarra vintage leva correia vintage");
  const drive = picks("Tube Screamer TS9");
  assert.equal(drive[0].ficha.tipo, "Patch", "pedal leva cabo patch");
  assert.ok(["Pedalboard", "Afinador"].includes(drive[1].ficha.efeito), "pedal de efeito leva base ou afinador");
  const board = picks("Kit Pedalboard com Bag");
  assert.ok(!["Pedalboard", "Afinador", "Looper", "Multiefeitos", "Gabinete virtual (IR)"].includes(board[1].ficha.efeito), "pedalboard leva efeito");
  const amp = picks("AC15 Valvulado");
  assert.ok(amp[1].ficha.generos.some((g) => find("AC15 Valvulado").ficha.generos.includes(g)), "efeito com gênero em comum");
  for (const p of products.filter((x) => x.estoque > 0)) {
    const chosen = bundlePicks(p, products.filter((x) => x.id !== p.id && x.estoque > 0));
    assert.ok(chosen.length <= 2 && new Set(chosen.map((x) => x.id)).size === chosen.length, p.modelo);
  }
});

test("produto gravado antes da ficha recebe a ficha inicial na leitura; null explícito é respeitado", () => {
  const old = { ...seedProducts[12] };
  delete old.ficha;
  assert.equal(publicProduct(old).ficha.formato, "Strat");
  assert.equal(publicProduct({ ...old, ficha: null }).ficha, null);
  assert.equal(publicProduct({ rowKey: "novo", categoria: "Cabos" }).ficha, null);
});

test("API: lista e detalhe trazem a ficha; busca por atributo; painel valida e grava", async (t) => {
  const storage = new MemoryStorage();
  for (const source of seedProducts.slice(12, 15)) {
    const data = { ...source };
    delete data.file;
    if (source.modelo === "ST Electric Pink") delete data.ficha; // registro antigo, anterior à ficha
    await storage.create("products", { ...data, partitionKey: "guitarras", ativo: true, blobName: "", imageUrl: "" });
  }
  const adminPassword = randomBytes(16).toString("hex");
  await bootstrapAdmin(storage, { ADMIN_EMAIL: "admin@ficha.test", ADMIN_PASSWORD: adminPassword, ADMIN_NAME: "Admin Ficha" });
  const http = createApp(storage, { memory: true, production: false, secret: randomBytes(48).toString("hex") }).listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}/api`;
  const call = async (path, { method = "GET", body, cookie } = {}) => {
    const r = await fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const list = (await call("/products")).body.data;
  assert.equal(list.find((p) => p.modelo === "ST Electric Pink").ficha.captacao, "Single-coil");
  assert.deepEqual((await call("/products?q=humbucker")).body.data.map((p) => p.modelo).sort(), ["Double Cut Ocean Blue", "Single Cut Gold"]);
  const admin = (await call("/auth/login", { method: "POST", body: { email: "admin@ficha.test", senha: adminPassword } })).cookie;
  const base = { marca: "Violet Voltage", modelo: "TL Butter", categoria: "Guitarras", descricao: "Guitarra de teste da ficha técnica.", priceCents: 150000, estoque: 3 };
  const bad = await call("/admin/products", { method: "POST", cookie: admin, body: { ...base, ficha: { formato: "Banjo" } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.field, "ficha");
  const created = await call("/admin/products", { method: "POST", cookie: admin, body: { ...base, ficha: { estilo: "Vintage", formato: "Tele", generos: ["Country", "Funk"] } } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data.ficha, { estilo: "Vintage", formato: "Tele", generos: ["Country", "Funk"] });
  const id = created.body.data.id;
  const kept = await call(`/admin/products/${id}`, { method: "PATCH", cookie: admin, body: { ...base, estoque: 4 } });
  assert.equal(kept.body.data.ficha.formato, "Tele", "PATCH sem ficha preserva a atual");
  const cleared = await call(`/admin/products/${id}`, { method: "PATCH", cookie: admin, body: { ...base, ficha: {} } });
  assert.equal(cleared.body.data.ficha, null);
  assert.equal((await call(`/products/${id}`)).body.data.ficha, null);
});
