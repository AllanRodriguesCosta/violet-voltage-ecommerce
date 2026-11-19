// Política de privacidade: dados guardados, uso, cookie, armazenamento no navegador, direitos e
// segurança (página estática, pré-renderizada por inteiro).
export default function Privacy() {
  return (
    <div className="container page-wrap legal-page">
      <nav className="breadcrumb" aria-label="Trilha de navegação">
        <a href="/">
          Início
        </a>
        <span aria-hidden="true">
          /
        </span>
        <span aria-current="page">
          Privacidade
        </span>
      </nav>
      <header className="help-hero legal-hero">
        <span className="eyebrow">
          Privacidade
        </span>
        <h1 className="page-title">
          Seus dados, com transparência.
        </h1>
        <p className="lead">
          Quais informações a Violet Voltage guarda, para que servem e o que fica apenas no seu navegador.
        </p>
        <p className="small muted">
          Atualizado em 12 de novembro de 2026.
        </p>
      </header>
      <div className="legal-layout">
        <nav className="panel legal-toc" aria-label="Nesta página">
          <p className="menu-title">
            Nesta página
          </p>
          <ol>
            <li>
              <a href="#dados">
                Quais dados guardamos
              </a>
            </li>
            <li>
              <a href="#uso">
                Para que usamos
              </a>
            </li>
            <li>
              <a href="#buscas">
                Buscas, carrinho salvo e gosto no assistente
              </a>
            </li>
            <li>
              <a href="#pagamento">
                Pagamentos
              </a>
            </li>
            <li>
              <a href="#cookies">
                Cookie e armazenamento no navegador
              </a>
            </li>
            <li>
              <a href="#direitos">
                Seus direitos
              </a>
            </li>
            <li>
              <a href="#seguranca">
                Segurança
              </a>
            </li>
          </ol>
        </nav>
        <article className="legal-body">
          <section id="dados" aria-labelledby="dados-title">
            <h2 id="dados-title">
              Quais dados guardamos
            </h2>
            <p>
              Ao criar uma conta: nome, e-mail, senha (somente o resumo criptográfico, nunca a senha em texto), telefone e endereço do cadastro, se você informar. Na conta: endereços de entrega, avisos de estoque e de queda de preço, notificações e as perguntas que você fizer sobre produtos. Em cada pedido: itens, valores, forma de entrega, forma de pagamento escolhida, parcelas, cupom e o histórico de status.
            </p>
          </section>
          <section id="uso" aria-labelledby="uso-title">
            <h2 id="uso-title">
              Para que usamos
            </h2>
            <ul>
              <li>
                Identificar você ao entrar e manter a sessão.
              </li>
              <li>
                Registrar e acompanhar pedidos, entregas e retiradas.
              </li>
              <li>
                Avisar quando um item volta ao estoque, quando o preço baixa, quando sua pergunta é respondida e quando o status do pedido muda.
              </li>
              <li>
                Publicar na página do produto as perguntas respondidas, só com o seu primeiro nome e a inicial do sobrenome.
              </li>
              <li>
                Mostrar ao painel da loja os indicadores de vendas e estoque.
              </li>
            </ul>
            <p>
              Não vendemos nem compartilhamos seus dados com terceiros para publicidade.
            </p>
          </section>
          <section id="buscas" aria-labelledby="buscas-title">
            <h2 id="buscas-title">
              Buscas, carrinho salvo e gosto no assistente
            </h2>
            <p>
              Os termos buscados no catálogo são guardados por até 90 dias{" "}
              <strong>
                sem identificar quem buscou
              </strong>
              {" "}(sem conta, endereço de rede ou sessão), com a quantidade de resultados, para a loja saber o que falta no catálogo. Termos com e-mail ou muitos números são descartados.
            </p>
            <p>
              Com login, o carrinho também fica salvo na sua conta para aparecer em outro aparelho; se ficar parado por 24 horas, você recebe um único lembrete nas notificações. O pedido limpa o carrinho salvo, e ele entra na cópia dos seus dados e é apagado com a conta.
            </p>
            <p>
              Também com login, o assistente guarda o gosto do último setup que montou para você (estilo, artista, tipo de som, cor, teto de valor e o que você já tem), nunca a conversa. Para apagar, diga “esquece meu gosto” ao assistente; o registro entra na cópia dos dados e é apagado com a conta.
            </p>
          </section>
          <section id="pagamento" aria-labelledby="pagamento-title">
            <h2 id="pagamento-title">
              Pagamentos
            </h2>
            <p>
              O pedido guarda apenas a forma de pagamento escolhida (Pix, cartão ou boleto) e o número de parcelas. Não pedimos nem armazenamos número de cartão, código de segurança ou dados bancários.
            </p>
          </section>
          <section id="cookies" aria-labelledby="cookies-title">
            <h2 id="cookies-title">
              Cookie e armazenamento no navegador
            </h2>
            <p>
              Usamos um único cookie,{" "}
              <code>
                vv_session
              </code>
              , para manter você conectado por até 8 horas. Ele é{" "}
              <strong>
                HttpOnly
              </strong>
              {" "}(scripts da página não conseguem lê-lo) e não serve para rastreamento. Não usamos cookies de publicidade nem de análise.
            </p>
            <p>
              Algumas preferências ficam só neste navegador (armazenamento local) e não são enviadas à loja até você usá-las:
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Informação
                    </th>
                    <th>
                      Para quê
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Carrinho
                    </td>
                    <td>
                      Guardar os itens até a compra
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Favoritos
                    </td>
                    <td>
                      Sua lista de desejos
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Vistos recentemente
                    </td>
                    <td>
                      Retomar de onde você parou
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Buscas recentes
                    </td>
                    <td>
                      Sugestões ao tocar no campo de busca
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Tema
                    </td>
                    <td>
                      Claro, escuro ou automático
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Preferências do checkout
                    </td>
                    <td>
                      Última forma de entrega e cupom
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Conversa com o assistente
                    </td>
                    <td>
                      Manter o histórico enquanto a aba estiver aberta (some ao fechar o navegador)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Para apagar essas informações, limpe os dados do site nas configurações do navegador. As buscas recentes também podem ser limpas pelo próprio campo de busca.
            </p>
          </section>
          <section id="direitos" aria-labelledby="direitos-title">
            <h2 id="direitos-title">
              Seus direitos
            </h2>
            <p>
              Você pode consultar e corrigir seus dados, endereços e avisos a qualquer momento em{" "}
              <a href="/minha-conta.html">
                Minha conta
              </a>
              . O e-mail de acesso identifica a conta e não pode ser alterado.
            </p>
            <p>
              Na seção{" "}
              <a href="/minha-conta.html#dados">
                Dados e segurança
              </a>
              {" "}você também pode:
            </p>
            <ul>
              <li>
                <strong>
                  Baixar seus dados
                </strong>
                : um arquivo com cadastro, endereços, pedidos, avisos de estoque e de preço, perguntas e notificações.
              </li>
              <li>
                <strong>
                  Excluir sua conta
                </strong>
                : nome, telefone, endereços, avisos e notificações são apagados e o acesso é encerrado. Perguntas ainda sem resposta são apagadas; as respondidas continuam na página do produto como “Cliente”. Os pedidos ficam guardados sem seus dados pessoais, como registro da venda. Com pedido em andamento, a exclusão espera a conclusão ou o cancelamento.
              </li>
            </ul>
            <p>
              Para responder, o assistente recebe a sua mensagem, a página aberta e os códigos dos produtos do carrinho e dos favoritos; nada disso fica guardado com os seus dados. Quando ele não entende uma frase, o texto é guardado sem identificação (sem conta, e-mail, códigos de pedido ou telefones) por até 90 dias, para a loja ensinar novas respostas. Comprar, aplicar cupom ou abrir uma troca sempre depende do seu clique.
            </p>
            <p>
              Quando o reforço do Gemini (Google) está ativo, só as frases que o assistente da loja não entende são enviadas ao Google, sem nome, e-mail, códigos de pedido ou telefones, junto com o catálogo e as regras da loja. No plano gratuito, o Google pode usar esse conteúdo para melhorar os próprios produtos. Respostas assim aparecem marcadas na conversa. O microfone do assistente usa o reconhecimento de voz do próprio navegador (no Chrome e no Edge, um serviço do Google ou da Microsoft) e só funciona depois que você autoriza; a loja recebe apenas o texto.
            </p>
          </section>
          <section id="seguranca" aria-labelledby="seguranca-title">
            <h2 id="seguranca-title">
              Segurança
            </h2>
            <p>
              Senhas são guardadas com bcrypt; a sessão usa um token assinado no servidor; o site é servido por HTTPS e os preços, o estoque e os cupons são sempre conferidos pelo servidor ao fechar o pedido.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
