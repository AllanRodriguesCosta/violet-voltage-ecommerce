// Página 404 (o servidor a envia para endereços desconhecidos): busca no catálogo e atalhos.
export default function NotFound() {
  return (
    <section className="container page-wrap">
      <div className="panel narrow confirmation">
        <span className="eyebrow">Erro 404 · Fora do setlist</span>
        <h1 className="page-title">Essa nota não existe.</h1>
        <p className="lead">A página que você procura não foi encontrada. Que tal buscar um equipamento ou voltar para o som?</p>
        <form className="search-inline" action="/catalogo.html" role="search">
          <label className="sr-only" htmlFor="notfound-q">
            Buscar no catálogo
          </label>
          <input id="notfound-q" name="q" type="search" placeholder="Buscar no catálogo" maxLength={80} />
          <button type="submit">Buscar</button>
        </form>
        <div className="row center">
          <a href="/" className="button secondary">
            Voltar ao início
          </a>
          <a href="/catalogo.html" className="button">
            Ver catálogo
          </a>
        </div>
      </div>
    </section>
  );
}
