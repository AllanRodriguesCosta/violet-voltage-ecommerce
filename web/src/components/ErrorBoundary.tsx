// Se um componente quebrar no navegador, o React desmonta tudo e a página fica em branco.
// <ErrorBoundary> isola o problema: a página mostra um aviso com "Recarregar" e os recursos
// globais (assistente, minicarrinho...) somem sozinhos sem levar a página junto.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { State } from "./State";

type Props = { children: ReactNode; area: string; fallback?: ReactNode };

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Violet Voltage] Falha em ${this.props.area}:`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback === undefined ? <PageError /> : this.props.fallback;
  }
}

export function PageError() {
  return (
    <section className="section">
      <div className="container">
        <State
          tone="error"
          level={1}
          title="Algo não saiu como esperado"
          text="Esta parte da página não carregou. Recarregue para tentar de novo; seu carrinho e seus dados continuam salvos."
          actions={
            <>
              <button type="button" onClick={() => location.reload()}>
                Recarregar a página
              </button>
              <a className="button secondary" href="/">
                Ir para o início
              </a>
            </>
          }
        />
      </div>
    </section>
  );
}
