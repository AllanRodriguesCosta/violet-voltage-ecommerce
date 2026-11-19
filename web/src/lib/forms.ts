// Validação de um campo com as mensagens em português de shared/forms.js (fieldMessage):
// o erro aparece ao sair de um campo preenchido e inválido ou ao enviar, e some assim que o
// valor fica válido. Mesmo comportamento de bindForm nas páginas antigas.
import { useRef, useState, type FocusEvent } from "react";
import { fieldMessage } from "./catalog";
import { formatPhone } from "../../../shared/forms.js";

type Field = HTMLInputElement | HTMLTextAreaElement;
export function useFieldError<T extends Field>(name: string, custom?: string) {
  const ref = useRef<T>(null);
  const [error, setError] = useState("");
  const message = (el: Field) => fieldMessage(el, custom);
  const validate = () => {
    const el = ref.current;
    if (!el || el.checkValidity()) {
      setError("");
      return true;
    }
    setError(message(el));
    el.focus();
    return false;
  };
  const props = {
    ref,
    "aria-invalid": error ? (true as const) : undefined,
    onBlur: (event: FocusEvent<T>) => {
      const el = event.currentTarget;
      if ((event.relatedTarget as HTMLButtonElement | null)?.type === "submit") return;
      if (el.value && !el.checkValidity()) setError(message(el));
    },
    onInput: () => {
      if (error && ref.current?.checkValidity()) setError("");
    },
  };
  return { props, error, hintId: `hint-${name}`, validate, setError };
}

// Formata telefone brasileiro ao sair do campo, sem atrapalhar a digitação.
export function maskPhone(input: HTMLInputElement | null) {
  if (!input) return;
  const format = () => {
    input.value = formatPhone(input.value);
  };
  input.addEventListener("blur", format);
  return () => input.removeEventListener("blur", format);
}
