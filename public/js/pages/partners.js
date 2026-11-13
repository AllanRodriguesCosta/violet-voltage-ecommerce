// Etapa 33: ficha de parceria para fornecedores, marcas, distribuidores e luthiers. Pública:
// quem preenche não precisa ser cliente. O CNPJ é conferido aqui e no servidor.
import { send, bindForm, escapeHtml as esc, markField } from "../common.js";

export const PRODUCTS = ["Guitarras", "Amplificadores", "Pedais", "Cabos", "Correias", "Acessórios", "Peças e componentes", "Luthieria e serviços", "Outros"];
export function validCnpj(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digit = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}
export const maskCnpj = (value) =>
  String(value)
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

export default async function partnersPage() {
  const form = document.querySelector("#partner-form");
  const wanted = new URLSearchParams(location.search).get("produto");
  document.querySelector("#partner-products").innerHTML = PRODUCTS.map(
    (p) => `<label class="check"><input type="checkbox" name="produtos" value="${esc(p)}"${p === wanted ? " checked" : ""}><span>${esc(p)}</span></label>`,
  ).join("");
  const cnpj = form.elements.cnpj;
  cnpj.addEventListener("input", () => {
    cnpj.value = maskCnpj(cnpj.value);
    cnpj.setCustomValidity("");
  });
  cnpj.addEventListener("blur", () => {
    if (cnpj.value && !validCnpj(cnpj.value)) {
      cnpj.setCustomValidity("Confira o CNPJ: os dígitos verificadores não batem.");
      markField(cnpj, "Confira o CNPJ: os dígitos verificadores não batem.");
    }
  });
  bindForm(form, async (data, el) => {
    const produtos = [...el.querySelectorAll('[name="produtos"]:checked')].map((i) => i.value);
    const group = el.querySelector("#partner-products");
    if (!produtos.length) {
      group.insertAdjacentHTML("afterend", '<p class="field-error">Marque pelo menos um tipo de produto ou serviço.</p>');
      group.querySelector("input").focus();
      return;
    }
    if (!validCnpj(data.cnpj)) {
      markField(cnpj, "Confira o CNPJ: os dígitos verificadores não batem.");
      cnpj.focus();
      return;
    }
    const r = await send("/parcerias", { ...data, produtos, aceite: Boolean(data.aceite) });
    form.hidden = true;
    const done = document.querySelector("#partner-done");
    done.hidden = false;
    done.innerHTML = `<div class="state-panel"><h2>Ficha recebida!</h2><p>Protocolo <strong>${esc(r.protocolo)}</strong>. A equipe comercial entra em contato com ${esc(data.contatoNome)} pelo e-mail ${esc(data.email)} em até 5 dias úteis.</p><a class="button secondary" href="/">Voltar à loja</a></div>`;
    done.querySelector("h2").setAttribute("tabindex", "-1");
    done.querySelector("h2").focus();
  });
}
