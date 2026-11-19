// Ficha de parceria para fabricantes, marcas, distribuidores e luthiers. Pública: quem preenche
// não precisa ser cliente. O CNPJ ganha máscara ao digitar e é conferido aqui e no servidor.
import { useEffect, useRef, useState } from "react";
import { send } from "../lib/shop";
import { FieldHint, KitForm, SubmitButton, useFormKit, type FormValues } from "../components/FormKit";
import { PRODUCTS, maskCnpj, validCnpj } from "../../../shared/partners.js";

const CNPJ_ERROR = "Confira o CNPJ: os dígitos verificadores não batem.";
type Done = { protocolo: string; contatoNome: string; email: string };

export default function Partners() {
  const [cnpj, setCnpj] = useState("");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [groupError, setGroupError] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const products = useRef<HTMLDivElement>(null);
  const doneTitle = useRef<HTMLHeadingElement>(null);

  // ?produto=Pedais já marca o tipo de produto.
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get("produto");
    if (wanted && (PRODUCTS as string[]).includes(wanted)) setProdutos([wanted]);
  }, []);
  useEffect(() => {
    if (done) doneTitle.current?.focus();
  }, [done]);

  const kit = useFormKit({
    validate: { cnpj: (value) => (value && !validCnpj(value) ? CNPJ_ERROR : null) },
    onSubmit: async (data: FormValues) => {
      setGroupError(false);
      if (!produtos.length) {
        setGroupError(true);
        products.current?.querySelector("input")?.focus();
        return;
      }
      const r = (await send("/parcerias", { ...data, produtos, aceite: Boolean(data.aceite) })) as { protocolo: string };
      setDone({ protocolo: r.protocolo, contatoNome: data.contatoNome, email: data.email });
    },
  });
  const toggle = (p: string, checked: boolean) => {
    setProdutos((list) => (PRODUCTS as string[]).filter((x) => (x === p ? checked : list.includes(x))));
    if (checked) setGroupError(false);
  };

  return (
    <div className="container page-wrap">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">Início</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Parceiros e fornecedores</span>
      </nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Para empresas</span>
          <h1 className="page-title">Seja um parceiro da Violet Voltage.</h1>
          <p className="lead">
            Fabricantes, marcas, distribuidores e luthiers: preencha a ficha e a equipe comercial entra em contato em até 5 dias úteis. Não é preciso ter conta na loja.
          </p>
        </div>
      </header>
      <div className="request-layout">
        <section className="panel" aria-labelledby="partner-title">
          <h2 id="partner-title">Ficha de solicitação de parceria</h2>
          <KitForm kit={kit} id="partner-form" hidden={Boolean(done)}>
            <fieldset>
              <legend>Empresa</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p-razao">Razão social</label>
                  <input id="p-razao" name="razaoSocial" type="text" required minLength={2} maxLength={120} autoComplete="organization" {...kit.a11y("razaoSocial")} />
                  <FieldHint kit={kit} name="razaoSocial" />
                </div>
                <div className="field">
                  <label htmlFor="p-fantasia">Nome fantasia (opcional)</label>
                  <input id="p-fantasia" name="nomeFantasia" type="text" maxLength={120} {...kit.a11y("nomeFantasia")} />
                  <FieldHint kit={kit} name="nomeFantasia" />
                </div>
                <div className="field">
                  <label htmlFor="p-cnpj">CNPJ</label>
                  <input
                    id="p-cnpj"
                    name="cnpj"
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    pattern="\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}"
                    title="Informe os 14 dígitos do CNPJ."
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                    {...kit.a11y("cnpj")}
                  />
                  <FieldHint kit={kit} name="cnpj" />
                </div>
                <div className="field">
                  <label htmlFor="p-modalidade">Tipo de parceria</label>
                  <select id="p-modalidade" name="modalidade">
                    <option>Fabricante ou marca</option>
                    <option>Distribuidor ou importador</option>
                    <option>Luthier ou oficina</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="p-site">Site ou rede social (opcional)</label>
                  <input id="p-site" name="site" type="url" maxLength={200} placeholder="https://" {...kit.a11y("site")} />
                  <FieldHint kit={kit} name="site" />
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Tipo de produto ou serviço oferecido</legend>
              <div className="check-grid" id="partner-products" ref={products}>
                {(PRODUCTS as string[]).map((p) => (
                  <label key={p} className="check">
                    <input type="checkbox" name="produtos" value={p} checked={produtos.includes(p)} onChange={(e) => toggle(p, e.target.checked)} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
              {groupError && <p className="field-error">Marque pelo menos um tipo de produto ou serviço.</p>}
            </fieldset>
            <div className="field">
              <label htmlFor="p-marcas">Marcas que fabrica ou representa (opcional)</label>
              <input id="p-marcas" name="marcas" type="text" maxLength={300} {...kit.a11y("marcas")} />
              <FieldHint kit={kit} name="marcas" />
            </div>
            <fieldset>
              <legend>Quem a equipe da Violet Voltage deve procurar</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p-contato">Nome do contato</label>
                  <input id="p-contato" name="contatoNome" type="text" required minLength={3} maxLength={100} autoComplete="name" {...kit.a11y("contatoNome")} />
                  <FieldHint kit={kit} name="contatoNome" />
                </div>
                <div className="field">
                  <label htmlFor="p-cargo">Cargo (opcional)</label>
                  <input id="p-cargo" name="cargo" type="text" maxLength={80} autoComplete="organization-title" {...kit.a11y("cargo")} />
                  <FieldHint kit={kit} name="cargo" />
                </div>
                <div className="field">
                  <label htmlFor="p-email">E-mail comercial</label>
                  <input id="p-email" name="email" type="email" required maxLength={200} autoComplete="email" {...kit.a11y("email")} />
                  <FieldHint kit={kit} name="email" />
                </div>
                <div className="field">
                  <label htmlFor="p-telefone">Telefone ou WhatsApp com DDD</label>
                  <input id="p-telefone" name="telefone" type="tel" required maxLength={20} autoComplete="tel" {...kit.a11y("telefone")} />
                  <FieldHint kit={kit} name="telefone" />
                </div>
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="p-mensagem">Conte um pouco sobre a proposta (opcional)</label>
              <textarea id="p-mensagem" name="mensagem" rows={4} maxLength={1500} {...kit.a11y("mensagem")} />
              <FieldHint kit={kit} name="mensagem" />
            </div>
            <div className="field hp-field" aria-hidden="true">
              <label htmlFor="p-website">Deixe este campo vazio</label>
              <input id="p-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field">
              <label className="check">
                <input type="checkbox" name="aceite" required {...kit.a11y("aceite")} />
                <span>Concordo que estes dados sejam usados só para avaliar a parceria e entrar em contato.</span>
              </label>
              <FieldHint kit={kit} name="aceite" />
              <p className="form-help">
                Saiba como tratamos os dados na <a href="/privacidade.html">política de privacidade</a>.
              </p>
            </div>
            <SubmitButton kit={kit}>Enviar ficha</SubmitButton>
          </KitForm>
          <div id="partner-done" hidden={!done}>
            {done && (
              <div className="state-panel">
                <h2 tabIndex={-1} ref={doneTitle}>
                  Ficha recebida!
                </h2>
                <p>
                  Protocolo <strong>{done.protocolo}</strong>. A equipe comercial entra em contato com {done.contatoNome} pelo e-mail {done.email} em até 5 dias úteis.
                </p>
                <a className="button secondary" href="/">
                  Voltar à loja
                </a>
              </div>
            )}
          </div>
        </section>
        <aside className="request-aside">
          <section className="panel">
            <h2>O que avaliamos</h2>
            <ul className="steps-list">
              <li>Produtos para guitarristas: instrumentos, amplificação, efeitos, cabos, acessórios e peças.</li>
              <li>Garantia e assistência no Brasil.</li>
              <li>Prazo de reposição e condições para lojista.</li>
            </ul>
            <p className="small muted">
              Para dúvidas de compra, use a <a href="/ajuda.html">Central de ajuda</a>.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
