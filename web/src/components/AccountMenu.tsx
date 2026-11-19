// Menu "Olá, ..." do cabeçalho: abre com clique, Enter ou seta para baixo; fecha com Esc,
// clique fora ou quando o foco sai. As setas, Home e End percorrem os itens.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "../lib/icons";
import { accountSections, initials, logout, type User } from "../lib/shop";

type Section = { id: string; icon: IconName; label: string; href: string; menu: boolean };

export function AccountMenu({ user }: { user: User | null | undefined }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<"first" | "last" | null>(null);
  const items = () => [...(holder.current?.querySelectorAll<HTMLElement>(".account-dropdown a, .account-dropdown button") ?? [])];

  useEffect(() => {
    if (!open) return;
    if (focusTarget.current) {
      const list = items();
      list[focusTarget.current === "last" ? list.length - 1 : 0]?.focus();
      focusTarget.current = null;
    }
    const onClick = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  if (!user)
    return (
      <div className="account-menu" id="account-menu">
        <a className="account-link" href="/login.html" id="account-link">
          <Icon name="user" />
          <span className="account-label">Entrar</span>
        </a>
      </div>
    );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === button.current && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      focusTarget.current = e.key === "ArrowUp" ? "last" : "first";
      if (open) {
        const list = items();
        list[e.key === "ArrowUp" ? list.length - 1 : 0]?.focus();
      } else setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (e.target === button.current) return;
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (index + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    list[next].focus();
  };
  const first = user.nome.split(" ")[0];
  const sections = (accountSections as Section[]).filter((s) => s.menu);
  return (
    <div
      className="account-menu"
      id="account-menu"
      ref={holder}
      onKeyDown={onKeyDown}
      onBlur={(e) => open && !holder.current?.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button
        type="button"
        className="account-link account-toggle"
        id="account-link"
        ref={button}
        aria-expanded={open}
        aria-controls="account-dropdown"
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">{initials(user.nome)}</span>
        <span className="account-label">Olá, {first}</span>
        <Icon name="chevronDown" size={16} className="account-chevron" />
        <span className="sr-only">: abrir o menu da conta</span>
      </button>
      <div className="account-dropdown" id="account-dropdown" hidden={!open}>
        <div className="account-dropdown-head">
          <span className="account-avatar account-avatar-md" aria-hidden="true">{initials(user.nome)}</span>
          <span>
            <strong>{user.nome}</strong>
            <small>{user.email}</small>
          </span>
        </div>
        <nav aria-label="Menu da conta">
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={s.href} data-section={s.id} onClick={() => setOpen(false)}>
                  <Icon name={s.icon} size={18} />
                  {s.label}
                </a>
              </li>
            ))}
            {user.role === "admin" && (
              <li>
                <a href="/admin.html">
                  <Icon name="chart" size={18} />
                  Painel administrativo
                </a>
              </li>
            )}
          </ul>
        </nav>
        <button type="button" className="account-logout" onClick={() => logout()}>
          <Icon name="logout" size={18} />
          Sair
        </button>
      </div>
    </div>
  );
}
