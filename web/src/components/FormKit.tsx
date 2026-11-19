// Formulários em React com as mesmas regras do bindForm/validateForm/markField anteriores:
// mensagens em português ligadas ao campo (aria-invalid + aria-describedby) no lugar dos balões
// nativos, erro ao sair de um campo preenchido e inválido (some quando o valor fica válido),
// botão "Aguarde…" durante o envio e erro do servidor junto ao campo indicado.
import { useCallback, useEffect, useRef, useState, type FocusEvent, type FormEvent, type FormHTMLAttributes, type ReactNode } from "react";
import { fieldMessage } from "../../../shared/forms.js";
import { createSubmitGuard } from "../lib/submit";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FieldError = { message: string; server?: boolean };
export type FormValues = Record<string, string>;
type Options = {
  onSubmit: (data: FormValues, form: HTMLFormElement) => unknown;
  // Mensagem própria quando a validação nativa falha (como o "messages" de bindForm).
  messages?: Record<string, string>;
  // Regras extras por campo (ex.: dígitos do CNPJ); devolvem a mensagem ou nada.
  validate?: Record<string, (value: string) => string | null | undefined>;
};
export type FormKit = ReturnType<typeof useFormKit>;

const isField = (el: Element | null): el is Field =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
const hintId = (name: string, error?: FieldError) => (error?.server ? `error-${name}` : `hint-${name}`);

export function useFormKit({ onSubmit, messages = {}, validate = {} }: Options) {
  const ref = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guard] = useState(() => createSubmitGuard(setBusy));
  const pressingSubmit = useRef(false);
  const latest = useRef({ onSubmit, messages, validate });
  useEffect(() => {
    latest.current = { onSubmit, messages, validate };
  });

  // Sem JavaScript o navegador valida sozinho; depois da hidratação, as mensagens são as nossas.
  useEffect(() => {
    if (ref.current) ref.current.noValidate = true;
    const release = () => setTimeout(() => (pressingSubmit.current = false));
    addEventListener("pointerup", release);
    return () => removeEventListener("pointerup", release);
  }, []);

  const check = useCallback((field: Field) => {
    if (!field.name || !field.willValidate) return null;
    const { messages: custom, validate: rules } = latest.current;
    if (!field.checkValidity()) return fieldMessage(field, custom[field.name]) as string;
    return rules[field.name]?.(field.value) || null;
  }, []);

  const setFieldError = useCallback((name: string, message: string | null, server = false) => {
    setErrors((current) => {
      if (!message) {
        if (!current[name]) return current;
        const next = { ...current };
        delete next[name];
        return next;
      }
      return { ...current, [name]: { message, server } };
    });
  }, []);

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    const field = event.target;
    // Se a saída é o clique no botão de envio, o envio valida (a mensagem deslocaria o botão).
    if (!isField(field) || pressingSubmit.current || (event.relatedTarget as HTMLButtonElement | null)?.type === "submit") return;
    if (!field.value) return;
    const message = check(field);
    if (message) setFieldError(field.name, message);
  };
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as Element;
    if (isField(field) && errors[field.name] && !check(field)) setFieldError(field.name, null);
  };

  const onSubmitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (guard.busy) return;
    const invalid: [Field, string][] = [];
    for (const el of Array.from(form.elements)) {
      if (!isField(el) || invalid.some(([f]) => f.name === el.name)) continue;
      const message = check(el);
      if (message) invalid.push([el, message]);
    }
    if (invalid.length) {
      setErrors(Object.fromEntries(invalid.map(([f, message]) => [f.name, { message }])));
      invalid[0][0].focus();
      return;
    }
    setErrors({});
    setFormError("");
    const result = await guard.run(() => latest.current.onSubmit(Object.fromEntries(new FormData(form)) as FormValues, form));
    if (result.status === "failed") {
      const { error } = result;
      const target = error.field ? form.elements.namedItem(error.field) : null;
      const field = target instanceof RadioNodeList ? (target[0] as Element) : target;
      if (error.field && isField(field)) {
        setFieldError(error.field, error.message, true);
        field.focus();
      } else setFormError(error.message);
    }
  };

  // Atributos de acessibilidade do campo (junta com descrições que ele já tenha).
  const a11y = (name: string, describedBy?: string) => {
    const error = errors[name];
    const refs = [describedBy, error && hintId(name, error)].filter(Boolean).join(" ");
    return { "aria-invalid": error ? (true as const) : undefined, "aria-describedby": refs || undefined };
  };
  const formProps = {
    ref,
    onSubmit: onSubmitEvent,
    onBlur,
    onChange,
    onPointerDown: (event: { target: EventTarget }) => (pressingSubmit.current = Boolean((event.target as Element).closest?.("[type=submit]"))),
  };
  return { ref, errors, formError, busy, a11y, setFieldError, setFormError, formProps };
}

// <form> ligado ao kit, com o erro geral (sem campo) no topo, como showError.
export function KitForm({ kit, children, ...rest }: { kit: FormKit; children: ReactNode } & Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "onBlur" | "onChange">) {
  return (
    <form {...rest} {...kit.formProps}>
      {kit.formError && (
        <div className="error" role="alert">
          {kit.formError}
        </div>
      )}
      {children}
    </form>
  );
}

// Mensagem do campo (vai logo depois dele, como markField e showError).
export function FieldHint({ kit, name }: { kit: FormKit; name: string }) {
  const error = kit.errors[name];
  if (!error) return null;
  return error.server ? (
    <div className="field-error" role="alert" id={hintId(name, error)}>
      {error.message}
    </div>
  ) : (
    <p className="field-error" id={hintId(name, error)}>
      {error.message}
    </p>
  );
}

export function SubmitButton({ kit, children, className }: { kit: FormKit; children: ReactNode; className?: string }) {
  const classes = [className, kit.busy && "is-busy"].filter(Boolean).join(" ");
  return (
    <button type="submit" disabled={kit.busy || undefined} className={classes || undefined}>
      {kit.busy ? "Aguarde…" : children}
    </button>
  );
}
