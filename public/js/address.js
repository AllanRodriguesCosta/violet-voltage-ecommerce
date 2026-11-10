// Endereços de entrega: formulário, máscara de CEP e sugestão de UF pelo CEP.
import { escapeHtml as esc } from "./common.js";

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
// Faixas de CEP por estado, usadas apenas para sugerir a UF; a pessoa pode trocar.
const RANGES = [
  ["SP", 1000, 19999], ["RJ", 20000, 28999], ["ES", 29000, 29999], ["MG", 30000, 39999], ["BA", 40000, 48999],
  ["SE", 49000, 49999], ["PE", 50000, 56999], ["AL", 57000, 57999], ["PB", 58000, 58999], ["RN", 59000, 59999],
  ["CE", 60000, 63999], ["PI", 64000, 64999], ["MA", 65000, 65999], ["PA", 66000, 68899], ["AP", 68900, 68999],
  ["AM", 69000, 69299], ["RR", 69300, 69399], ["AM", 69400, 69899], ["AC", 69900, 69999], ["DF", 70000, 72799],
  ["GO", 72800, 72999], ["DF", 73000, 73699], ["GO", 73700, 76799], ["RO", 76800, 76999], ["TO", 77000, 77999],
  ["MT", 78000, 78899], ["MS", 79000, 79999], ["PR", 80000, 87999], ["SC", 88000, 89999], ["RS", 90000, 99999],
];
export function ufFromCep(cep) {
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length < 5) return "";
  const prefix = Number(digits.slice(0, 5));
  return RANGES.find(([, from, to]) => prefix >= from && prefix <= to)?.[0] || "";
}
export function formatCep(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
// Mesmo formato do servidor (src/services/addresses.js), conferido por teste.
export const formatAddress = (a) =>
  `${a.logradouro}, ${a.numero}${a.complemento ? ` - ${a.complemento}` : ""}, ${a.bairro}, ${a.cidade} - ${a.uf}, CEP ${a.cep}`;

export function addressFormHTML(a = {}, { first = false } = {}) {
  const v = (key) => esc(a[key] || "");
  return `<form class="address-form" novalidate data-id="${v("id")}"><div class="form-grid">
<div class="field"><label for="addr-cep">CEP</label><input id="addr-cep" name="cep" inputmode="numeric" autocomplete="postal-code" required maxlength="9" pattern="\\d{5}-?\\d{3}" title="Informe os 8 dígitos do CEP, como 01310-100." value="${v("cep")}"><p class="form-help" id="addr-cep-help" aria-live="polite"></p></div>
<div class="field"><label for="addr-uf">Estado (UF)</label><select id="addr-uf" name="uf" required autocomplete="address-level1"><option value="">Selecione</option>${UFS.map((uf) => `<option${uf === a.uf ? " selected" : ""}>${uf}</option>`).join("")}</select></div>
<div class="field"><label for="addr-cidade">Cidade</label><input id="addr-cidade" name="cidade" required minlength="2" maxlength="60" autocomplete="address-level2" value="${v("cidade")}"></div>
<div class="field"><label for="addr-bairro">Bairro</label><input id="addr-bairro" name="bairro" required minlength="2" maxlength="60" value="${v("bairro")}"></div>
<div class="field field-wide"><label for="addr-logradouro">Rua ou avenida</label><input id="addr-logradouro" name="logradouro" required minlength="2" maxlength="120" autocomplete="address-line1" value="${v("logradouro")}"></div>
<div class="field"><label for="addr-numero">Número</label><input id="addr-numero" name="numero" required maxlength="10" value="${v("numero")}"></div>
<div class="field"><label for="addr-complemento">Complemento (opcional)</label><input id="addr-complemento" name="complemento" maxlength="60" autocomplete="address-line2" value="${v("complemento")}"></div>
<div class="field field-wide"><label for="addr-apelido">Apelido (opcional)</label><input id="addr-apelido" name="apelido" maxlength="30" placeholder="Casa, Trabalho, Estúdio…" value="${v("apelido")}"></div>
</div><label class="check"><input type="checkbox" name="principal"${a.principal || first ? " checked" : ""}${first ? " disabled" : ""}><span>Usar como endereço principal</span></label>
<div class="row"><button type="submit">${a.id ? "Salvar alterações" : "Salvar endereço"}</button><button type="button" class="secondary" data-cancel-address>Cancelar</button></div></form>`;
}
// Máscara do CEP e sugestão de UF quando o estado ainda não foi escolhido.
export function wireAddressForm(form) {
  const cep = form.elements.cep;
  const uf = form.elements.uf;
  const help = form.querySelector("#addr-cep-help");
  cep.addEventListener("input", () => {
    cep.value = formatCep(cep.value);
    const suggestion = cep.value.length === 9 ? ufFromCep(cep.value) : "";
    if (suggestion && !uf.value) {
      uf.value = suggestion;
      help.textContent = `Estado sugerido pelo CEP: ${suggestion}. Confira antes de salvar.`;
    }
  });
}
export const addressBody = (form) => {
  const data = Object.fromEntries(new FormData(form));
  return { ...data, principal: form.elements.principal.checked };
};
