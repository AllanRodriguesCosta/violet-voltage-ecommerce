// Página sem conexão (service worker): sem cabeçalho nem JavaScript; só HTML e CSS, guardados
// na instalação do service worker (public/sw.js).
export default function Offline() {
  return (
    <main id="main" className="container page-wrap">
      <section className="panel narrow confirmation">
        <span className="brand-mark offline-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2.5 5 13.5h6.2L10.5 21.5 19 10.5h-6.3Z" />
          </svg>
        </span>
        <span className="eyebrow">Sem conexão</span>
        <h1 className="page-title">O sinal caiu por aqui.</h1>
        <p className="lead">Confira a sua internet e tente de novo. Seu carrinho e seus favoritos continuam salvos neste navegador.</p>
        <div className="row center">
          <a className="button" href="/">
            Tentar novamente
          </a>
        </div>
      </section>
    </main>
  );
}
