// Moldura de todas as páginas: cabeçalho, categorias, menus, rodapé e navegação inferior.
// Mantém a mesma marcação (classes e ids) do layout anterior, então o CSS não muda.
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { categories } from "../lib/shop";
import { SessionProvider, useSession } from "../lib/session";
import { useCartCount, useWishlist } from "../lib/store";
import { useUnread } from "../lib/notifications";
import { openCart } from "../lib/drawer";
import { AccountLinks } from "./AccountLinks";
import { CartWidgets } from "./CartDrawer";
import { CompareTray } from "./CompareTray";
import { ErrorBoundary } from "./ErrorBoundary";
import { useHydrated } from "../lib/store";
import { SearchBox } from "./SearchBox";
import { AccountMenu } from "./AccountMenu";
import { ThemeSwitch, ThemeToggle } from "./Theme";

const categoryLink = (c: string) => `/catalogo.html?categoria=${encodeURIComponent(c)}`;
const Brand = () => (
  <span className="brand-words">
    VIOLET VOLTAGE<small>TURN UP YOUR TONE</small>
  </span>
);
const Count = ({ value, label }: { value: number | string; label?: string }) =>
  value ? (
    <span className="count" aria-label={label}>
      {value}
    </span>
  ) : null;

// Página atual (marcada depois da hidratação: o pré-render não conhece a URL completa).
function useCurrent() {
  const [current, setCurrent] = useState<{ path: string; categoria: string | null }>({ path: "", categoria: null });
  useEffect(() => {
    setCurrent({
      path: location.pathname === "/index.html" ? "/" : location.pathname,
      categoria: new URLSearchParams(location.search).get("categoria"),
    });
  }, []);
  return current;
}
const closeOnBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
  const target = e.target as HTMLElement;
  if (target === e.currentTarget || target.closest("[data-close-dialog]")) e.currentTarget.close();
};

function Header() {
  const { user } = useSession();
  const cart = useCartCount();
  const wishes = useWishlist().length;
  const current = useCurrent();
  const menu = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const unread = useUnread();
  useEffect(() => {
    let ticking = false;
    const sync = () => {
      ticking = false;
      header.current?.classList.toggle("is-scrolled", scrollY > 8);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(sync);
      }
    };
    addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => removeEventListener("scroll", onScroll);
  }, []);
  const navLink = (href: string, categoria: string | null) =>
    current.path === new URL(href, "http://x").pathname && current.categoria === categoria ? "page" : undefined;
  const isAdmin = user?.role === "admin";
  return (
    <div id="header">
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>
            <Icon name="truck" size={15} /> Frete grátis acima de R$ 999
          </span>
          <span className="hide-sm">
            <Icon name="card" size={15} /> Até 10x sem juros no cartão
          </span>
          <span className="hide-md">
            <Icon name="store" size={15} /> Retirada na loja sem custo
          </span>
        </div>
      </div>
      <header className="site-header" ref={header}>
        <div className="container header-bar">
          <button type="button" className="icon-button menu-toggle" aria-haspopup="dialog" aria-label="Abrir menu" onClick={() => menu.current?.showModal()}>
            <Icon name="menu" />
          </button>
          <a className="brand" href="/" aria-label="Violet Voltage, início">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="bolt" size={20} />
            </span>
            <Brand />
          </a>
          <SearchBox id="header" placeholder="Buscar guitarras, pedais, marcas…" className="header-search search-box" />
          <nav className="header-actions" aria-label="Atalhos da loja">
            <button
              type="button"
              className="icon-button search-trigger"
              data-open-search
              aria-haspopup="dialog"
              aria-label="Buscar"
              onClick={() => {
                search.current?.showModal();
                search.current?.querySelector("input")?.focus();
              }}
            >
              <Icon name="search" />
            </button>
            <ThemeToggle />
            <a className="icon-button wish-link" href="/favoritos.html" aria-label="Favoritos">
              <Icon name="heart" />
              <Count value={wishes} />
            </a>
            {user && (
              <a
                className="icon-button notif-link"
                href="/minha-conta.html#notificacoes"
                aria-label={unread ? `Notificações: ${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Notificações"}
              >
                <Icon name="bell" />
                <Count value={unread > 99 ? "99+" : unread} />
              </a>
            )}
            <AccountMenu user={user} />
            <a
              className="icon-button cart-link"
              href="/carrinho.html"
              data-open-cart
              aria-label="Carrinho"
              onClick={(event) => {
                if (location.pathname === "/carrinho.html" || event.metaKey || event.ctrlKey) return;
                event.preventDefault();
                openCart();
              }}
            >
              <Icon name="bag" />
              <Count value={cart} />
            </a>
          </nav>
        </div>
      </header>
      <nav className="category-nav" aria-label="Categorias">
        <div className="container category-nav-inner">
          <a href="/catalogo.html" aria-current={navLink("/catalogo.html", null)}>
            Todo o catálogo
          </a>
          {categories.map((c: string) => (
            <a key={c} href={categoryLink(c)} aria-current={navLink(categoryLink(c), c)}>
              {c}
            </a>
          ))}
          <a href="/setup.html" className="nav-setup" aria-current={navLink("/setup.html", null)}>
            <Icon name="sparkle" size={16} />
            Monte seu setup
          </a>
          <a href="/kits.html" className="nav-kits" aria-current={navLink("/kits.html", null)}>
            <Icon name="gift" size={16} />
            Kits
          </a>
          <a href="/guias.html" aria-current={navLink("/guias.html", null)}>
            Guias
          </a>
          <a href="/ajuda.html" className="nav-help" aria-current={navLink("/ajuda.html", null)}>
            Ajuda
          </a>
          {isAdmin && (
            <a href="/admin.html" className="admin-link">
              Painel
            </a>
          )}
        </div>
      </nav>
      <dialog className="menu-dialog" id="menu-dialog" aria-label="Menu" ref={menu} onClick={closeOnBackdrop}>
        <div className="menu-panel">
          <div className="menu-head">
            <Brand />
            <button type="button" className="icon-button" data-close-dialog aria-label="Fechar menu">
              <Icon name="close" />
            </button>
          </div>
          <nav aria-label="Menu principal">
            <p className="menu-title">Categorias</p>
            <a href="/catalogo.html">
              <Icon name="grid" />
              Todo o catálogo
            </a>
            {categories.map((c: string) => (
              <a key={c} href={categoryLink(c)}>
                <Icon name="chevronRight" size={16} />
                {c}
              </a>
            ))}
            <a href="/setup.html">
              <Icon name="sparkle" />
              Monte seu setup
            </a>
            <a href="/kits.html">
              <Icon name="gift" />
              Kits com desconto
            </a>
            <a href="/comparar.html">
              <Icon name="compare" />
              Comparar produtos
            </a>
            <a href="/guias.html">
              <Icon name="book" />
              Guias de compra
            </a>
            <p className="menu-title">Sua conta</p>
            <MobileAccount />
            <a href="/favoritos.html">
              <Icon name="heart" />
              Favoritos
            </a>
            <a href="/carrinho.html">
              <Icon name="bag" />
              Carrinho
            </a>
            <p className="menu-title">Atendimento</p>
            <a href="/ajuda.html">
              <Icon name="info" />
              Central de ajuda
            </a>
            {isAdmin && (
              <a href="/admin.html" className="admin-link">
                <Icon name="grid" />
                Painel administrativo
              </a>
            )}
          </nav>
          <ThemeSwitch name="theme-menu" />
        </div>
      </dialog>
      <dialog className="search-dialog" id="search-dialog" aria-label="Buscar" ref={search} onClick={closeOnBackdrop}>
        <SearchBox id="dialog" placeholder="O que você procura?">
          <button type="button" className="icon-button" data-close-dialog aria-label="Fechar busca">
            <Icon name="close" />
          </button>
        </SearchBox>
        <div className="search-shortcuts">
          <p className="menu-title">Categorias</p>
          <div className="chip-row">
            {categories.map((c: string) => (
              <a key={c} className="chip" href={categoryLink(c)}>
                {c}
              </a>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}

// Entradas da conta no menu lateral (celular), conforme a sessão.
function MobileAccount() {
  const { user } = useSession();
  if (!user)
    return (
      <a href={user === null ? "/login.html" : "/minha-conta.html"} className="menu-account">
        <Icon name="user" />
        {user === null ? "Entrar ou criar conta" : "Minha conta"}
      </a>
    );
  return <AccountLinks />;
}

function Footer() {
  const [year, setYear] = useState(2026);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return (
    <div id="footer">
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <a className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                <Icon name="bolt" size={20} />
              </span>
              <Brand />
            </a>
            <p>Seu próximo som começa aqui. Guitarras, efeitos, amplificadores e acessórios para cada etapa da sua jornada.</p>
          </div>
          <nav aria-label="Loja">
            <h2>Loja</h2>
            <a href="/catalogo.html">Todo o catálogo</a>
            {categories.slice(0, 3).map((c: string) => (
              <a key={c} href={categoryLink(c)}>
                {c}
              </a>
            ))}
            <a href="/kits.html">Kits com desconto</a>
            <a href="/comparar.html">Comparar produtos</a>
          </nav>
          <nav aria-label="Sua conta">
            <h2>Sua conta</h2>
            <a href="/minha-conta.html">Minha conta</a>
            <a href="/minha-conta.html#pedidos">Meus pedidos</a>
            <a href="/encomenda.html">Encomendas</a>
            <a href="/favoritos.html">Favoritos</a>
            <a href="/carrinho.html">Carrinho</a>
          </nav>
          <nav aria-label="Atendimento">
            <h2>Atendimento</h2>
            <a href="/ajuda.html">Central de ajuda</a>
            <a href="/guias.html">Guias e glossário</a>
            <a href="/ajuda.html#entregas">Entregas e prazos</a>
            <a href="/ajuda.html#pagamentos">Pagamentos e cupons</a>
            <a href="/ajuda.html#trocas">Trocas e devoluções</a>
            <a href="/parceiros.html">Seja um parceiro</a>
            <a href="/privacidade.html">Privacidade</a>
            <a href="/termos.html">Termos de uso</a>
          </nav>
          <div>
            <h2>Formas de pagamento</h2>
            <ul className="payment-list">
              <li>
                <Icon name="pix" size={18} />
                Pix
              </li>
              <li>
                <Icon name="card" size={18} />
                Cartão de crédito
              </li>
              <li>
                <Icon name="barcode" size={18} />
                Boleto
              </li>
            </ul>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>Projeto acadêmico · © {year} Violet Voltage</p>
          <ThemeSwitch name="theme-footer" compact />
          <p>Feito com React, Node.js, Express e PostgreSQL.</p>
        </div>
      </footer>
    </div>
  );
}

function BottomNav() {
  const cart = useCartCount();
  const wishes = useWishlist().length;
  const { path } = useCurrent();
  const unread = useUnread();
  const items: [string, "home" | "grid" | "heart" | "bag" | "user", string, number | string][] = [
    ["/", "home", "Início", 0],
    ["/catalogo.html", "grid", "Catálogo", 0],
    ["/favoritos.html", "heart", "Favoritos", wishes],
    ["/carrinho.html", "bag", "Carrinho", cart],
    ["/minha-conta.html", "user", "Conta", unread > 99 ? "99+" : unread],
  ];
  return (
    <nav className="bottom-nav" aria-label="Navegação rápida">
      {items.map(([href, name, label, count]) => (
        <a key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <Icon name={name} size={22} />
          <span>{label}</span>
          <Count value={count} />
        </a>
      ))}
    </nav>
  );
}

function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sync = () => setShow(scrollY >= innerHeight * 1.5);
    addEventListener("scroll", sync, { passive: true });
    sync();
    return () => removeEventListener("scroll", sync);
  }, []);
  return (
    <button
      type="button"
      className="to-top"
      aria-label="Voltar ao topo"
      hidden={!show}
      onClick={() => {
        scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        document.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
      }}
    >
      <Icon name="arrowUp" />
    </button>
  );
}

// Recursos globais em todas as páginas: minicarrinho e aviso de item adicionado, barra de
// comparação, visualização rápida e assistente; e o service worker (instalação e modo sem conexão).
// O assistente e a visualização rápida ficam em arquivos à parte (import dinâmico): o navegador
// os baixa depois que a página já respondeu, sem pesar no primeiro carregamento.
const Assistant = lazy(() => import("./Assistant").then((m) => ({ default: m.Assistant })));
const QuickView = lazy(() => import("./QuickView").then((m) => ({ default: m.QuickView })));

// Cada recurso global tem o próprio isolamento de erro: se um quebrar, some sozinho.
function Widget({ area, children }: { area: string; children: ReactNode }) {
  return (
    <ErrorBoundary area={area} fallback={null}>
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function GlobalWidgets() {
  const { user, loading } = useSession();
  const hydrated = useHydrated();
  useEffect(() => {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname)))
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <>
      <Widget area="minicarrinho">
        <CartWidgets />
      </Widget>
      <Widget area="comparação">
        <CompareTray />
      </Widget>
      {hydrated && (
        <>
          <Widget area="visualização rápida">
            <QuickView />
          </Widget>
          <Widget area="assistente">
            <Assistant user={user} loading={loading} />
          </Widget>
        </>
      )}
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Header />
      <main id="main" tabIndex={-1}>
        <ErrorBoundary area="página">{children}</ErrorBoundary>
      </main>
      <Footer />
      <BottomNav />
      <ToTop />
      <GlobalWidgets />
    </SessionProvider>
  );
}
