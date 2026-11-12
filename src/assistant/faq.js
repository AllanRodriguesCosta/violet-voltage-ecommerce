// Respostas sobre a loja, geradas das mesmas regras usadas no checkout (src/services/pricing.js),
// para nunca divergirem do que o carrinho cobra.
import { shipping, delivery, FREE_SHIPPING_CENTS, MAX_INSTALLMENTS, MIN_INSTALLMENT_CENTS, coupons } from "../services/pricing.js";

export const brl = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const link = (rotulo, href) => ({ tipo: "link", rotulo, href });

export function faqAnswer(intent, text) {
  if (intent === "entrega") {
    if (/retir/.test(text))
      return { texto: `A retirada na loja não tem custo e fica disponível em 1 dia útil. Leve um documento com foto e o número do pedido, que aparece na confirmação e em Minha conta.`, acoes: [link("Entregas e retirada", "/ajuda.html#entregas")] };
    if (/grat|gratuit|free/.test(text))
      return { texto: `A entrega padrão fica grátis quando os produtos somam ${brl(FREE_SHIPPING_CENTS)} ou mais. O carrinho mostra quanto falta. Com o cupom FRETEVOLT, a entrega padrão ou a expressa também sai grátis.`, acoes: [link("Ver o carrinho", "/carrinho.html")] };
    return {
      texto: `Entregamos de três jeitos: ${delivery.padrao.label.toLowerCase()} em ${delivery.padrao.prazo} (${brl(shipping.padrao)}), ${delivery.expressa.label.toLowerCase()} em ${delivery.expressa.prazo} (${brl(shipping.expressa)}) e retirada na loja sem custo, disponível em 1 dia útil. A entrega padrão é grátis a partir de ${brl(FREE_SHIPPING_CENTS)} em produtos.`,
      acoes: [link("Entregas e prazos", "/ajuda.html#entregas")],
    };
  }
  if (intent === "pagamento")
    return {
      texto: `Aceitamos Pix, cartão de crédito e boleto. No cartão, o pedido pode ser parcelado em até ${MAX_INSTALLMENTS}x sem juros, com parcela mínima de ${brl(MIN_INSTALLMENT_CENTS)}; as opções aparecem no checkout conforme o total.`,
      acoes: [link("Pagamentos", "/ajuda.html#pagamentos")],
    };
  if (intent === "cupom")
    return {
      texto: `Cupons ativos: ${Object.entries(coupons).map(([code, c]) => `${code} (${c.description.charAt(0).toLowerCase()}${c.description.slice(1)})`).join("; ")}. Digite o código no carrinho ou no checkout; vale um cupom por pedido.`,
      acoes: [link("Ir para o carrinho", "/carrinho.html")],
    };
  if (intent === "troca")
    return {
      texto: "Você pode trocar em até 7 dias após o recebimento, com o produto sem sinais de uso, acompanhado dos acessórios e da embalagem original.",
      acoes: [link("Trocas", "/ajuda.html#trocas")],
    };
  if (intent === "conta") {
    const conta = link("Minha conta", "/minha-conta.html");
    if (/senha/.test(text)) return { texto: "A recuperação de senha ainda não está disponível. Se perdeu o acesso, crie uma conta com outro e-mail.", acoes: [link("Criar conta", "/cadastro.html")] };
    if (/e-?mail/.test(text)) return { texto: "O e-mail de acesso não pode ser alterado. Nome e telefone mudam em Minha conta, na seção Meus dados.", acoes: [conta] };
    if (/endereco/.test(text)) return { texto: "Em Minha conta você salva até 5 endereços de entrega, edita e escolhe o principal, que já vem marcado no checkout.", acoes: [conta] };
    if (/favorit/.test(text)) return { texto: "Os favoritos ficam salvos neste navegador. Em outro aparelho ou navegador, a lista começa vazia.", acoes: [link("Meus favoritos", "/favoritos.html")] };
    return { texto: "Seus dados ficam em Minha conta, na seção Meus dados. O e-mail de acesso não pode ser alterado.", acoes: [conta] };
  }
  return null;
}
