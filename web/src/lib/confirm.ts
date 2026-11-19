// Confirmação acessível com <dialog>; o foco inicial fica na opção segura. Aberta de qualquer
// lugar (conta, painel, assistente) e removida ao fechar.
type Options = { title: string; text: string; confirm?: string; cancel?: string; danger?: boolean };
export function confirmDialog({ title, text, confirm = "Confirmar", cancel = "Voltar", danger = false }: Options): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    const form = document.createElement("form");
    form.method = "dialog";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = text;
    const row = document.createElement("div");
    row.className = "row";
    const no = document.createElement("button");
    no.value = "cancel";
    no.className = "secondary";
    no.textContent = cancel;
    const yes = document.createElement("button");
    yes.value = "ok";
    if (danger) yes.className = "danger-solid";
    yes.textContent = confirm;
    row.append(no, yes);
    form.append(heading, body, row);
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "ok");
      dialog.remove();
    });
    dialog.showModal();
    no.focus();
  });
}
