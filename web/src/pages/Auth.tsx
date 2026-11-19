// Entrar e criar conta: mesmo formulário, validação em português, senha com "mostrar" e
// medidor de força, e volta à página de origem (?next=) só para endereços internos da loja.
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { send } from "../lib/shop";
import { safeNext } from "../../../shared/account.js";
import { maskPhone } from "../lib/forms";
import { FieldError, Form, Input, SubmitButton, useFieldA11y } from "../components/Form";

const allowed = ["/checkout.html", "/minha-conta.html", "/admin.html"];
export const authMessages = {
  nome: "Informe seu nome completo, com pelo menos 2 letras.",
  email: "Informe um e-mail válido, como nome@exemplo.com.",
  senha: "Use de 10 a 72 caracteres.",
};

// Destino depois de entrar e o ?next= repassado ao link "Cadastre-se"/"Entrar".
function useNext() {
  const [next, setNext] = useState<{ target: string; query: string }>({ target: "/minha-conta.html", query: "" });
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("next");
    const safe = (value && allowed.includes(value)) || Boolean(safeNext(value));
    if (safe && value) setNext({ target: value, query: `?next=${encodeURIComponent(value)}` });
  }, []);
  return next;
}

type PasswordProps = InputHTMLAttributes<HTMLInputElement> & { name: string; describedBy?: string; after?: ReactNode };
// Senha com botão "Mostrar senha" (a mensagem de erro fica depois do grupo).
export function PasswordInput({ describedBy, after, ...props }: PasswordProps) {
  const [show, setShow] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const a11y = useFieldA11y(props.name, describedBy);
  return (
    <>
      <div className="password-field">
        <input {...props} {...a11y} ref={input} type={show ? "text" : "password"} />
        <button
          type="button"
          className="icon-button"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={show}
          onClick={() => {
            setShow(!show);
            input.current?.focus();
          }}
        >
          <Icon name={show ? "eyeOff" : "eye"} size={20} />
        </button>
      </div>
      <FieldError name={props.name} />
      {after}
    </>
  );
}

const HINT = "Use 10 caracteres ou mais; misture letras, números e símbolos.";
function strength(v: string) {
  const score = [v.length >= 10, v.length >= 14, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  const level = !v ? "" : v.length < 10 ? "weak" : score >= 4 ? "strong" : score >= 2 ? "medium" : "weak";
  const text = !v
    ? HINT
    : v.length < 10
      ? `Faltam ${10 - v.length} ${10 - v.length === 1 ? "caractere" : "caracteres"} para o mínimo.`
      : { strong: "Senha forte.", medium: "Senha razoável: acrescente números, símbolos ou maiúsculas.", weak: "Senha fraca: misture letras, números e símbolos." }[level as "strong"];
  return { level, text };
}
function StrengthMeter({ value }: { value: string }) {
  const { level, text } = strength(value);
  return (
    <div className="strength" data-level={level || undefined}>
      <span className="strength-bar">
        <span />
      </span>
      <small aria-live="polite">{text}</small>
    </div>
  );
}

const Aside = () => (
  <aside className="auth-aside" aria-hidden="true">
    <span className="eyebrow">Violet Voltage</span>
    <p className="auth-quote">“Cada setup conta uma história. Qual é a sua?”</p>
    <img src="/assets/hero.svg" alt="" width={320} height={290} />
  </aside>
);
function AuthPanel({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="container auth-wrap">
      <section className="panel auth-panel">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-intro">{intro}</p>
        {children}
      </section>
      <Aside />
    </div>
  );
}

export function LoginForm() {
  const next = useNext();
  return (
    <AuthPanel eyebrow="Bem-vindo de volta" title="Conecte-se ao seu som." intro="Entre para acompanhar suas compras e montar seu próximo setup.">
      <Form
        id="login-form"
        messages={{ email: authMessages.email }}
        onSubmit={async (data) => {
          await send("/auth/login", data);
          location.href = next.target;
        }}
      >
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <Input id="email" name="email" type="email" required autoComplete="email" maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <PasswordInput id="senha" name="senha" required autoComplete="current-password" maxLength={72} />
        </div>
        <SubmitButton className="full">Entrar na minha conta</SubmitButton>
      </Form>
      <p className="auth-bottom">
        Ainda não tem conta? <a href={`/cadastro.html${next.query}`}>Cadastre-se</a>
      </p>
    </AuthPanel>
  );
}

export function RegisterForm() {
  const next = useNext();
  const [password, setPassword] = useState("");
  const phone = useRef<HTMLInputElement>(null);
  useEffect(() => maskPhone(phone.current), []);
  return (
    <AuthPanel eyebrow="Seu próximo capítulo" title="Faça parte do som." intro="Crie sua conta para explorar todas as possibilidades.">
      <Form
        id="register-form"
        messages={authMessages}
        onSubmit={async (data) => {
          await send("/auth/register", data);
          location.href = next.target;
        }}
      >
        <div className="field">
          <label htmlFor="nome">Nome completo</label>
          <Input id="nome" name="nome" type="text" required minLength={2} maxLength={200} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <Input id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="telefone">Telefone (opcional)</label>
          <Input id="telefone" name="telefone" type="tel" maxLength={30} autoComplete="tel" ref={phone} />
        </div>
        <div className="field">
          <label htmlFor="endereco">Endereço (opcional)</label>
          <Input id="endereco" name="endereco" type="text" maxLength={500} autoComplete="street-address" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha (10 a 72 caracteres)</label>
          <PasswordInput
            id="senha"
            name="senha"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            after={<StrengthMeter value={password} />}
          />
        </div>
        <SubmitButton className="full">Criar minha conta</SubmitButton>
      </Form>
      <p className="auth-bottom">
        Já tem conta? <a href={`/login.html${next.query}`}>Entrar</a>
      </p>
    </AuthPanel>
  );
}
