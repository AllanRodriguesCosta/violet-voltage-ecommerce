import { Icon, type IconName } from "../lib/icons";
import { accountSections, logout } from "../lib/shop";

type Section = { id: string; icon: IconName; label: string; href: string; menu: boolean };
const close = () => document.querySelector<HTMLDialogElement>("#menu-dialog")?.close();

// Menu lateral (celular) com login: atalhos da conta e "Sair".
export function AccountLinks() {
  return (
    <>
      <a href="/minha-conta.html" className="menu-account">
        <Icon name="user" />
        Minha conta
      </a>
      {(accountSections as Section[])
        .filter((s) => s.menu && !["visao-geral", "favoritos"].includes(s.id))
        .map((s) => (
          <a key={s.id} href={s.href} className="menu-sub" onClick={close}>
            <Icon name={s.icon} size={18} />
            {s.label}
          </a>
        ))}
      <button type="button" className="menu-logout" onClick={() => logout()}>
        <Icon name="logout" size={18} />
        Sair
      </button>
    </>
  );
}
