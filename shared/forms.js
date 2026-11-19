// Mensagens de validação em português ligadas ao campo (no lugar dos balões nativos, que variam
// conforme o idioma do navegador) e máscaras simples de telefone.

/**
 * @param {{ validity: Partial<ValidityState>, type: string, minLength?: number, maxLength?: number, min?: string,
 *   max?: string, title?: string, validationMessage: string }} input
 * @param {string} [custom]
 */
export function fieldMessage(input, custom) {
  const v = input.validity;
  if (custom) return custom;
  if (v.valueMissing) return input.type === "checkbox" ? "Marque esta opção para continuar." : "Preencha este campo.";
  if (v.typeMismatch && input.type === "email") return "Informe um e-mail válido, como nome@exemplo.com.";
  if (v.tooShort) return `Use pelo menos ${input.minLength} caracteres.`;
  if (v.tooLong) return `Use no máximo ${input.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `Informe um valor a partir de ${input.min}.`;
  if (v.rangeOverflow) return `Informe um valor até ${input.max}.`;
  if (v.badInput || v.stepMismatch) return "Informe um número inteiro válido.";
  if (v.patternMismatch) return input.title || "Confira o formato informado.";
  return input.validationMessage;
}
// Telefone brasileiro formatado ao sair do campo: (11) 2345-6789 ou (11) 98765-4321.
/** @param {string} value */
export function formatPhone(value) {
  const d = String(value).replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return value;
}
