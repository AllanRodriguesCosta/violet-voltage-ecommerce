// Formulário de endereço de entrega (Minha conta): máscara de CEP e UF sugerida pelo CEP, com a
// mesma marcação do formulário de endereço anterior; regras em shared/address.js.
import { useRef, useState, type InputHTMLAttributes, type RefObject } from "react";
import { UFS, formatCep, ufFromCep } from "../../../shared/address.js";
import { send } from "../lib/shop";
import { FieldError, Form, Input, SubmitButton, useFieldA11y } from "./Form";
import type { Address } from "./Private";

function Text({ label, wide, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; wide?: boolean }) {
  return (
    <div className={wide ? "field field-wide" : "field"}>
      <label htmlFor={props.id}>{label}</label>
      <Input {...props} />
    </div>
  );
}
function UfSelect({ defaultValue, selectRef }: { defaultValue?: string; selectRef: RefObject<HTMLSelectElement | null> }) {
  const a11y = useFieldA11y("uf");
  return (
    <div className="field">
      <label htmlFor="addr-uf">Estado (UF)</label>
      <select id="addr-uf" name="uf" required autoComplete="address-level1" defaultValue={defaultValue || ""} ref={selectRef} {...a11y}>
        <option value="">Selecione</option>
        {(UFS as string[]).map((uf) => (
          <option key={uf}>{uf}</option>
        ))}
      </select>
      <FieldError name="uf" />
    </div>
  );
}

export function AddressForm({
  current,
  first,
  onSaved,
  onCancel,
}: {
  current?: Address;
  first: boolean;
  onSaved: (list: Address[]) => void;
  onCancel: () => void;
}) {
  const a = current || ({} as Partial<Address>);
  const uf = useRef<HTMLSelectElement>(null);
  const [help, setHelp] = useState("");
  return (
    <Form
      className="address-form"
      data-id={a.id || ""}
      onSubmit={async (data, form) => {
        const body = { ...data, principal: (form.elements.namedItem("principal") as HTMLInputElement).checked };
        const list = (current
          ? await send(`/addresses/${encodeURIComponent(current.id)}`, body, "PATCH")
          : await send("/addresses", body)) as Address[];
        onSaved(list);
      }}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="addr-cep">CEP</label>
          <Input
            id="addr-cep"
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            maxLength={9}
            pattern="\d{5}-?\d{3}"
            title="Informe os 8 dígitos do CEP, como 01310-100."
            defaultValue={a.cep || ""}
            autoFocus
            onInput={(e) => {
              const cep = e.currentTarget;
              cep.value = formatCep(cep.value);
              const suggestion = cep.value.length === 9 ? (ufFromCep(cep.value) as string) : "";
              if (suggestion && uf.current && !uf.current.value) {
                uf.current.value = suggestion;
                setHelp(`Estado sugerido pelo CEP: ${suggestion}. Confira antes de salvar.`);
              }
            }}
          />
          <p className="form-help" id="addr-cep-help" aria-live="polite">
            {help}
          </p>
        </div>
        <UfSelect defaultValue={a.uf} selectRef={uf} />
        <Text id="addr-cidade" name="cidade" label="Cidade" required minLength={2} maxLength={60} autoComplete="address-level2" defaultValue={a.cidade || ""} />
        <Text id="addr-bairro" name="bairro" label="Bairro" required minLength={2} maxLength={60} defaultValue={a.bairro || ""} />
        <Text id="addr-logradouro" name="logradouro" label="Rua ou avenida" wide required minLength={2} maxLength={120} autoComplete="address-line1" defaultValue={a.logradouro || ""} />
        <Text id="addr-numero" name="numero" label="Número" required maxLength={10} defaultValue={a.numero || ""} />
        <Text id="addr-complemento" name="complemento" label="Complemento (opcional)" maxLength={60} autoComplete="address-line2" defaultValue={a.complemento || ""} />
        <Text id="addr-apelido" name="apelido" label="Apelido (opcional)" wide maxLength={30} placeholder="Casa, Trabalho, Estúdio…" defaultValue={a.apelido || ""} />
      </div>
      <label className="check">
        <input type="checkbox" name="principal" defaultChecked={a.principal || first} disabled={first} />
        <span>Usar como endereço principal</span>
      </label>
      <div className="row">
        <SubmitButton>{a.id ? "Salvar alterações" : "Salvar endereço"}</SubmitButton>
        <button type="button" className="secondary" data-cancel-address onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </Form>
  );
}
