import { icon } from "../icons.js";
import { send, bindForm, safeNext } from "../common.js";
import { maskPhone } from "../components.js";

const allowed = ["/checkout.html", "/minha-conta.html", "/admin.html"];
const messages = {
  nome: "Informe seu nome completo, com pelo menos 2 letras.",
  email: "Informe um e-mail válido, como nome@exemplo.com.",
  senha: "Use de 10 a 72 caracteres.",
};
function passwordToggle(input) {
  const wrap = document.createElement("div");
  wrap.className = "password-field";
  input.before(wrap);
  wrap.append(input);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.setAttribute("aria-label", "Mostrar senha");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = icon("eye", { size: 20 });
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    button.innerHTML = icon(show ? "eyeOff" : "eye", { size: 20 });
    input.focus();
  });
  wrap.append(button);
}
function strengthMeter(input) {
  const meter = document.createElement("div");
  meter.className = "strength";
  meter.innerHTML = '<span class="strength-bar"><span></span></span><small aria-live="polite">Use 10 caracteres ou mais; misture letras, números e símbolos.</small>';
  input.closest(".field").append(meter);
  input.addEventListener("input", () => {
    const v = input.value;
    const score = [v.length >= 10, v.length >= 14, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
    const level = !v ? "" : v.length < 10 ? "weak" : score >= 4 ? "strong" : score >= 2 ? "medium" : "weak";
    meter.dataset.level = level;
    meter.querySelector("small").textContent = !v
      ? "Use 10 caracteres ou mais; misture letras, números e símbolos."
      : v.length < 10
        ? `Faltam ${10 - v.length} ${10 - v.length === 1 ? "caractere" : "caracteres"} para o mínimo.`
        : { strong: "Senha forte.", medium: "Senha razoável: acrescente números, símbolos ou maiúsculas.", weak: "Senha fraca: misture letras, números e símbolos." }[level];
  });
}
export default function authentication() {
  const next = new URLSearchParams(location.search).get("next");
  // Volta para qualquer página interna da loja (sem outro domínio nem login/cadastro de novo).
  const safe = allowed.includes(next) || Boolean(safeNext(next));
  const target = safe ? next : "/minha-conta.html";
  if (safe)
    document.querySelectorAll('.auth-bottom a[href="/cadastro.html"], .auth-bottom a[href="/login.html"]').forEach((a) => a.setAttribute("href", `${a.getAttribute("href")}?next=${encodeURIComponent(next)}`));
  for (const form of document.querySelectorAll("#login-form, #register-form")) {
    form.querySelectorAll('input[type="password"]').forEach(passwordToggle);
  }
  const login = document.querySelector("#login-form");
  if (login)
    bindForm(
      login,
      async (data) => {
        await send("/auth/login", data);
        location.href = target;
      },
      { messages: { email: messages.email } },
    );
  const register = document.querySelector("#register-form");
  if (register) {
    strengthMeter(register.elements.senha);
    maskPhone(register.elements.telefone);
    bindForm(
      register,
      async (data) => {
        await send("/auth/register", data);
        location.href = target;
      },
      { messages },
    );
  }
}
