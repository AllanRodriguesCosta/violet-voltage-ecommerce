// Central de ajuda: fonte única das perguntas e respostas. A página ajuda.html é gerada a
// partir daqui e o assistente busca nela; valores de frete, parcelas e cupons vêm das
// mesmas regras do checkout. tests/help.test.js confere que a página está em dia.
import { shipping, delivery, FREE_SHIPPING_CENTS, MAX_INSTALLMENTS, MIN_INSTALLMENT_CENTS, coupons } from "../services/pricing.js";

const brl = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\s/g, " ");
const conta = { rotulo: "Ir para Minha conta", href: "/minha-conta.html" };

export const helpGroups = [
  {
    id: "pedidos",
    titulo: "Pedidos",
    chip: "Pedidos",
    itens: [
      { pergunta: "Como acompanho meu pedido?", resposta: "Em Minha conta, cada pedido mostra a linha do tempo com as etapas Recebido, Em preparação, Enviado e Concluído, a data de cada uma e a previsão de entrega em dias úteis. Quando o pedido sai para entrega, aparece também o código de rastreio. O assistente conta em que etapa está o seu pedido mais recente.", link: { rotulo: "Ver meus pedidos", href: "/minha-conta.html#pedidos" }, termos: "rastrear rastreio código status situação andamento previsão quando chega" },
      { pergunta: "Como fico sabendo quando o pedido muda de etapa?", resposta: "Cada mudança feita pela loja vira uma notificação no sino do topo da página, com o número do pedido. As não lidas aparecem em destaque até você abri-las.", termos: "aviso notificação sino alerta mudança atualização" },
      { pergunta: "Posso cancelar um pedido?", resposta: "Sim, enquanto o status for “Recebido”: use “Cancelar pedido” em Minha conta. Os itens voltam para o estoque e o pedido não pode ser reaberto. Depois que a preparação começa, o cancelamento passa a ser feito pela loja.", termos: "cancelamento desistir" },
      { pergunta: "Como compro os mesmos itens de novo?", resposta: "Em Minha conta, “Comprar novamente” coloca no carrinho os itens do pedido que ainda estão disponíveis.", termos: "repetir recomprar novamente" },
      { pergunta: "Onde encontro o comprovante do pedido?", resposta: "Em Minha conta, use “Comprovante” no pedido. A página mostra itens, valores, pagamento, entrega e a linha do tempo, e o botão “Imprimir ou salvar PDF” usa a impressão do navegador. O comprovante não substitui a nota fiscal.", link: { rotulo: "Ver meus pedidos", href: "/minha-conta.html#pedidos" }, termos: "comprovante recibo imprimir pdf segunda via nota" },
    ],
  },
  {
    id: "entregas",
    titulo: "Entregas e retirada",
    chip: "Entregas",
    itens: [
      { pergunta: "Quais são as formas de entrega e os prazos?", resposta: `${delivery.padrao.label} em ${delivery.padrao.prazo} (${brl(shipping.padrao)}), ${delivery.expressa.label.toLowerCase()} em ${delivery.expressa.prazo} (${brl(shipping.expressa)}) e retirada na loja sem custo, disponível em 1 dia útil.`, termos: "frete prazo envio expressa demora chega" },
      { pergunta: "Como funciona o frete grátis?", resposta: `A entrega padrão fica grátis quando os produtos somam ${brl(FREE_SHIPPING_CENTS)} ou mais. O minicarrinho e o carrinho mostram quanto falta.`, termos: "gratis gratuito frete" },
      { pergunta: "O que levo para retirar na loja?", resposta: "Um documento com foto e o número do pedido, que aparece na confirmação e em Minha conta.", termos: "retirada retirar documento buscar pessoalmente" },
      { pergunta: "Posso salvar mais de um endereço?", resposta: "Sim, até 5 endereços de entrega em Minha conta. O endereço principal já vem escolhido no checkout, e o CEP preenche o estado sozinho.", link: conta, termos: "endereço endereços cadastrar cadastrado cep entrega casa trabalho" },
    ],
  },
  {
    id: "pagamentos",
    titulo: "Pagamentos e cupons",
    chip: "Pagamentos e cupons",
    itens: [
      { pergunta: "Quais formas de pagamento são aceitas?", resposta: "Pix, cartão de crédito e boleto. A escolha é feita no checkout.", termos: "pix boleto cartão pagar" },
      { pergunta: "Como funciona o parcelamento?", resposta: `No cartão de crédito, em até ${MAX_INSTALLMENTS}x sem juros, com parcela mínima de ${brl(MIN_INSTALLMENT_CENTS)}. As opções aparecem no checkout de acordo com o total do pedido.`, termos: "parcelas parcelar juros vezes" },
      { pergunta: "Como uso um cupom de desconto?", resposta: `Digite o código no carrinho ou no checkout. Cupons ativos: ${Object.entries(coupons).map(([code, c]) => `${code} (${c.description.charAt(0).toLowerCase()}${c.description.slice(1)})`).join(", ")}. Vale um cupom por pedido.`, termos: "cupom desconto código promoção" },
      { pergunta: "O preço muda depois que eu coloco no carrinho?", resposta: "Preço e estoque são conferidos novamente ao confirmar o pedido. Se algo mudar, o checkout avisa antes de concluir.", termos: "preço muda mudar carrinho alteração valor fechar finalizar compra" },
    ],
  },
  {
    id: "produtos",
    titulo: "Produtos e escolha",
    chip: "Produtos",
    itens: [
      { pergunta: "Como sei se um equipamento combina com o meu estilo?", resposta: "Cada produto tem ficha técnica com estilo (vintage, moderno ou atemporal), gêneros indicados e as características da categoria, como formato e captação das guitarras ou tecnologia e sonoridade dos amplificadores. No catálogo, filtre por estilo e gênero; na página do produto, os gêneros levam a outros itens indicados.", link: { rotulo: "Abrir o catálogo", href: "/catalogo.html" }, termos: "ficha técnica gênero estilo combina filtro escolher indicado" },
      { pergunta: "O que é o Monte seu setup?", resposta: "Um montador em seis etapas (guitarra, amplificador, efeitos, cabos, correia e acessórios) que mostra o total, as parcelas e o frete grátis na hora. Dá para filtrar pelo estilo musical, compartilhar o link e colocar tudo no carrinho de uma vez.", link: { rotulo: "Montar um setup", href: "/setup.html" }, termos: "setup montar kit montador combinação" },
      { pergunta: "Um produto esgotou. Como sei quando volta?", resposta: "Na página do produto esgotado, ative “Avise-me quando chegar”. Quando a loja repuser o estoque, você recebe uma notificação no sino. Os avisos ativos ficam em Minha conta.", termos: "esgotado avise-me estoque volta reposição falta" },
      { pergunta: "Como funciona o assistente?", resposta: "Disponível para quem está logado, no botão Assistente no canto da tela. Ele indica equipamentos pelo seu estilo e orçamento, monta setups, conta em que etapa está seu pedido e responde dúvidas desta central. Também compara produtos, responde sobre a ficha do produto aberto (“quantos trastes tem essa?”), confere o que falta no carrinho, explica termos, sugere pelo que você já comprou e encaminha trocas. As respostas são automáticas e usam só o catálogo e as regras da loja; nada é comprado sem você clicar, e a conversa fica apenas nesta aba do navegador. Frases que ele não entende são guardadas sem identificação por até 90 dias para melhorar as respostas e, se a loja ativar o reforço do Gemini (Google), são respondidas por ele com os dados da loja, com aviso na conversa. Dá para falar a pergunta pelo microfone, no navegador que tiver reconhecimento de voz.", termos: "assistente chat robô conversa inteligência artificial gemini voz microfone falar" },
      { pergunta: "Como comparo dois ou mais produtos?", resposta: "Toque em “Comparar” no cartão do produto ou na página dele. Com 2 a 4 itens escolhidos, a barra no rodapé leva à tabela lado a lado, com ficha técnica, preço e disponibilidade, e destaca onde eles se diferenciam. O link da comparação pode ser compartilhado.", link: { rotulo: "Abrir o comparador", href: "/comparar.html" }, termos: "comparar comparação comparador diferença lado a lado versus melhor" },
      { pergunta: "Como funcionam os kits com desconto?", resposta: "Os kits reúnem itens que combinam, como a primeira guitarra com amplificador e acessórios ou um pedalboard completo. Com todos os itens do kit no carrinho, o desconto do kit entra sozinho no resumo, e ainda dá para usar um cupom sobre o restante. Se um item esgotar, o kit volta quando ele for reposto.", link: { rotulo: "Ver os kits", href: "/kits.html" }, termos: "kit kits combo pacote desconto conjunto" },
      { pergunta: "O carrinho avisa se falta alguma coisa?", resposta: "Sim. O carrinho confere a compatibilidade: avisa quando uma guitarra está sem cabo ou sem amplificador, quando os pedais precisam de fonte de 9V ou de cabos patch e quando falta pouco para completar um kit, sempre com uma sugestão do catálogo.", link: { rotulo: "Abrir o carrinho", href: "/carrinho.html" }, termos: "compatível compatibilidade fonte 9v cabo patch falta precisa funciona" },
      { pergunta: "Posso tirar uma dúvida sobre um produto específico?", resposta: "Sim. Na página do produto, em “Perguntas e respostas”, quem está logado envia a pergunta e a equipe responde ali mesmo; você recebe um aviso nas notificações. As perguntas só aparecem depois de respondidas, com o primeiro nome e a inicial do sobrenome.", termos: "pergunta perguntar dúvida produto específico resposta loja equipe" },
      { pergunta: "Como funciona o aviso de queda de preço?", resposta: "Na página do produto, toque em “Avisar se baixar o preço”, ou em Favoritos use o botão para todos os itens salvos. Se o preço ficar abaixo do valor do dia em que você pediu o aviso, chega uma notificação com o preço antigo e o novo. Os avisos ativos ficam em Minha conta.", link: { rotulo: "Ver meus avisos", href: "/minha-conta.html#avisos" }, termos: "preço baixar baixou queda promoção aviso desconto favorito" },
      { pergunta: "Onde encontro guias para escolher o equipamento?", resposta: "Em Guias há explicações sobre primeira guitarra, captação, amplificadores, ordem dos pedais, fonte de 9V e calibre de cordas, com atalhos para o catálogo, além de um glossário com os termos da ficha técnica.", link: { rotulo: "Abrir os guias", href: "/guias.html" }, termos: "guia guias glossário termo significa explicação aprender escolher" },
    ],
  },
  {
    id: "trocas",
    titulo: "Trocas, garantia e serviços",
    chip: "Trocas e serviços",
    itens: [
      { pergunta: "Qual é o prazo para troca?", resposta: "Até 7 dias após o recebimento, com o produto sem sinais de uso, acompanhado de acessórios e embalagem original. Para pedir, abra o comprovante do pedido em Minha conta e use “Troca ou devolução”: escolha os itens, se prefere trocar ou receber o valor e conte o motivo. A loja responde nas notificações.", link: { rotulo: "Ver meus pedidos", href: "/minha-conta.html#pedidos" }, termos: "troca trocar devolver devolução defeito garantia solicitar pedir" },
      { pergunta: "Vocês oferecem regulagem, troca de cordas ou garantia estendida?", resposta: "Sim, como serviços opcionais no carrinho: regulagem por luthier e troca de cordas (com encordoamento 0.10 incluso) para guitarras, e garantia estendida de 12 meses para guitarras, amplificadores e pedais, com preço proporcional ao item. Os serviços são feitos antes do envio e aparecem no resumo e no comprovante do pedido.", link: { rotulo: "Abrir o carrinho", href: "/carrinho.html" }, termos: "regulagem luthier setup ajuste troca de cordas garantia estendida serviço" },
    ],
  },
  {
    id: "conta",
    titulo: "Conta e privacidade",
    chip: "Conta",
    itens: [
      { pergunta: "Como altero meus dados?", resposta: "Em Minha conta, na seção Meus dados, você muda nome e telefone. O e-mail de acesso não pode ser alterado.", link: conta, termos: "alterar dados nome telefone cadastro email" },
      { pergunta: "Como troco minha senha?", resposta: "Em Minha conta, na seção Segurança e privacidade, informe a senha atual e a nova (de 10 a 72 caracteres). Por segurança, as sessões abertas em outros aparelhos são encerradas.", link: conta, termos: "trocar mudar alterar senha nova" },
      { pergunta: "Esqueci minha senha. E agora?", resposta: "A loja ainda não envia e-mail de recuperação de senha. Se perdeu o acesso, crie uma conta com outro e-mail.", termos: "esqueci recuperar senha perdi acesso" },
      { pergunta: "Como baixo uma cópia dos meus dados?", resposta: "Em Minha conta, na seção Segurança e privacidade, use “Baixar meus dados”: você recebe um arquivo com seu cadastro, endereços, pedidos, avisos de estoque e de preço, perguntas sobre produtos e notificações.", link: conta, termos: "baixar cópia exportar dados lgpd portabilidade" },
      { pergunta: "Como excluo minha conta?", resposta: "Em Minha conta, na seção Segurança e privacidade, confirme com sua senha. Nome, telefone, endereços, avisos e notificações são apagados e o acesso é encerrado; os pedidos ficam guardados sem seus dados pessoais, como registro da venda. Com pedido em andamento, a exclusão espera a conclusão ou o cancelamento.", link: conta, termos: "excluir apagar deletar encerrar desativar cancelar conta cadastro lgpd" },
      { pergunta: "Onde ficam meus favoritos?", resposta: "Neste navegador. Em outro aparelho ou navegador, a lista começa vazia.", link: { rotulo: "Ver favoritos", href: "/favoritos.html" }, termos: "favoritos lista desejos coração salvos" },
    ],
  },
];

export const helpEntries = helpGroups.flatMap((g) => g.itens.map((item, i) => ({ ...item, grupo: g.id, ancora: `${g.id}-${i + 1}` })));
