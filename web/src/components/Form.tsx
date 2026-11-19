// Formulários em React com o mesmo comportamento do bindForm das páginas antigas: validação
// nativa com mensagens em português ligadas ao campo (aria-invalid + aria-describedby), erro ao
// sair de um campo preenchido e inválido, botão "Aguarde…" durante o envio e erro do servidor
// ao lado do campo indicado (ou no topo do formulário).
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type InputHTMLAttributes,
  type Ref,
  type RefObject,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";
import { fieldMessage } from "../../../shared/forms.js";
import { createSubmitGuard } from "../lib/submit";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FieldError = { message: string; server?: boolean };
export type FormData_ = Record<string, string>;
type Handler = (data: FormData_, form: HTMLFormElement) => unknown;
type Ctx = { errors: Record<string, FieldError>; busy: boolean };
const FormContext = createContext<Ctx>({ errors: {}, busy: false });

const isField = (el: EventTarget | null): el is Field =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
const message = (field: Field, messages: Record<string, string>) => fieldMessage(field, messages[field.name]) as string;

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: Handler;
  messages?: Record<string, string>;
  formRef?: RefObject<HTMLFormElement | null>;
  children: ReactNode;
};

export function Form({ onSubmit, messages = {}, formRef, children, ...rest }: Props) {
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [general, setGeneral] = useState("");
  const [busy, setBusy] = useState(false);
  const own = useRef<HTMLFormElement>(null);
  const ref = formRef ?? own;
  const [guard] = useState(() => createSubmitGuard(setBusy));
  const pressingSubmit = useRef(false);
  const focusField = useRef<string | null>(null);

  useEffect(() => {
    const release = () => setTimeout(() => (pressingSubmit.current = false));
    addEventListener("pointerup", release);
    return () => removeEventListener("pointerup", release);
  }, []);
  // Erro do servidor: o foco vai ao campo indicado depois que a mensagem aparece.
  useEffect(() => {
    const name = focusField.current;
    if (!name) return;
    focusField.current = null;
    const field = ref.current?.elements.namedItem(name);
    (field instanceof RadioNodeList ? (field[0] as HTMLElement) : (field as HTMLElement | null))?.focus();
  }, [errors, ref]);

  const mark = (name: string, error: FieldError | null) =>
    setErrors((current) => {
      if (!error && !current[name]) return current;
      const next = { ...current };
      if (error) next[name] = error;
      else delete next[name];
      return next;
    });

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    const field = event.target;
    // A saída pelo clique no botão de envio é validada pelo envio (a mensagem inserida antes
    // deslocaria o botão entre pressionar e soltar).
    if (!isField(field) || pressingSubmit.current || (event.relatedTarget as HTMLButtonElement | null)?.type === "submit") return;
    if (field.willValidate && field.value && !field.checkValidity()) mark(field.name, { message: message(field, messages) });
  };
  const onInput = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target;
    if (isField(field) && errors[field.name] && field.checkValidity()) mark(field.name, null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (guard.busy) return;
    if (!form.checkValidity()) {
      const invalid = ([...form.elements] as Field[]).filter((f) => isField(f) && f.willValidate && !f.checkValidity());
      const next: Record<string, FieldError> = {};
      for (const field of invalid) next[field.name] ??= { message: message(field, messages) };
      setErrors(next);
      setGeneral("");
      invalid[0]?.focus();
      return;
    }
    setErrors({});
    setGeneral("");
    const result = await guard.run(() => onSubmit(Object.fromEntries(new FormData(form)) as FormData_, form));
    if (result.status !== "failed") return;
    const { error } = result;
    if (error.field && form.elements.namedItem(error.field)) {
      focusField.current = error.field;
      setErrors({ [error.field]: { message: error.message, server: true } });
    } else setGeneral(error.message);
  };
  return (
    <FormContext.Provider value={{ errors, busy }}>
      <form
        {...rest}
        ref={ref}
        noValidate
        onSubmit={submit}
        onBlur={onBlur}
        onInput={onInput}
        onPointerDown={(e) => (pressingSubmit.current = !!(e.target as Element).closest?.("[type=submit]"))}
      >
        {general && (
          <div className="error" role="alert">
            {general}
          </div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

const errorId = (name: string, error: FieldError) => (error.server ? `error-${name}` : `hint-${name}`);
// Atributos de acessibilidade do campo: aria-invalid e a mensagem somada à ajuda do campo.
export function useFieldA11y(name: string, describedBy?: string) {
  const error = useContext(FormContext).errors[name];
  const refs = [describedBy, error && errorId(name, error)].filter(Boolean).join(" ");
  return { "aria-invalid": error ? (true as const) : undefined, "aria-describedby": refs || undefined };
}
// Mensagem do campo, logo depois dele (ou do grupo que o envolve).
export function FieldError({ name }: { name: string }) {
  const error = useContext(FormContext).errors[name];
  if (!error) return null;
  return error.server ? (
    <div className="field-error" id={errorId(name, error)} role="alert">
      {error.message}
    </div>
  ) : (
    <p className="field-error" id={errorId(name, error)}>
      {error.message}
    </p>
  );
}
export const useFormBusy = () => useContext(FormContext).busy;

// Botão de envio: desabilitado e com "Aguarde…" enquanto o formulário envia.
export function SubmitButton({ children, className, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const busy = useFormBusy();
  return (
    <button {...rest} type="submit" className={[className, busy && "is-busy"].filter(Boolean).join(" ") || undefined} disabled={busy || disabled}>
      {busy ? "Aguarde…" : children}
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { name: string; describedBy?: string; ref?: Ref<HTMLInputElement> };
// Campo de texto ligado ao formulário (mesma marcação: input + mensagem logo depois).
export function Input({ describedBy, ...props }: InputProps) {
  const a11y = useFieldA11y(props.name, describedBy);
  return (
    <>
      <input {...props} {...a11y} />
      <FieldError name={props.name} />
    </>
  );
}
