# Roteiro de demonstração do Violet Voltage

Use dados fictícios. Para demonstrações administrativas, prefira o ambiente local
em memória, com os PNGs privados disponíveis conforme o README. Nunca mostre
arquivos de ambiente, painel de credenciais ou senhas em uma gravação.

## Apresentação de 3 a 5 minutos

1. **Contexto:** projeto acadêmico evoluído para portfólio. A interface representa
   uma loja, mas não processa transações financeiras ou entregas reais.
2. **Home:** apresente a identidade musical, as categorias e as imagens completas.
3. **Catálogo:** combine categoria e preço, ordene, remova um filtro e recarregue
   a página para demonstrar a persistência dos parâmetros na URL.
4. **Produto:** abra um item, mostre marca/modelo/categoria e adicione uma unidade.
5. **Carrinho:** altere a quantidade, confira subtotal e prossiga autenticado.
6. **Pedido:** use informações fictícias, escolha retirada e conclua. Mostre o
   identificador, o valor retornado pelo servidor e o acesso ao histórico.
7. **Engenharia:** explique recálculo em centavos, verificação de estoque,
   transação PostgreSQL e identificação de pedidos para evitar duplicação.
8. **Limites:** mostre que o projeto possui testes e documenta o que não oferece.

### Recursos das etapas 17 a 27 (escolha 3 ou 4 conforme o tempo)

- **Ficha e filtros:** catálogo de guitarras filtrado por captação, mão ou
  número de cordas; ficha com trastes e escala.
- **Comparador:** "Comparar" em 2 ou 3 guitarras e a tabela com as diferenças.
- **Kits e compatibilidade:** adicione uma guitarra sozinha e mostre o aviso
  "Falta o cabo da guitarra"; depois adicione um kit e o desconto no resumo.
- **Serviços:** regulagem ou garantia estendida no item do carrinho.
- **Pedido:** comprovante com previsão de entrega e, depois de concluído,
  "Troca ou devolução".
- **Guias:** `/guias.html` e a busca no glossário.
- **Assistente:** sem login, peça "monta um setup de rock clássico até 5 mil"
  e responda "muito caro" (versão mais barata e faixas de orçamento); "onde
  está meu pedido?" pede login. Logado, na página de um produto, "quantos
  trastes tem essa?", "compara com a Jackson JS32" e "adiciona a segunda no
  carrinho" (com botão de confirmação); no carrinho, "o que falta no meu
  carrinho?". Explique que roda com PLN local, sem custo, e que o Gemini é
  opcional.
- **Minha conta:** abra "Olá, Nome" no cabeçalho, vá a "Métodos de
  pagamento", salve "Cartão de crédito, 6x" e mostre o checkout já com essa
  opção; mostre a visão geral com o último pedido e "Preciso de ajuda".
- **Painel:** indicadores por categoria e mais vendidos, aba Perguntas e aba
  Assistente (frases não entendidas, anônimas).

Não conclua pedidos repetidamente no catálogo público só para gravar vídeos:
isso altera estoque e histórico. Use a demonstração local para esse roteiro.

## Painel administrativo: apresentação segura

A opção adotada para esta fase é apresentar capturas ou vídeo de uma sessão
local com dados fictícios. Não haverá conta administrativa compartilhada.

- Prepare localmente o administrador usando configuração privada.
- Entre antes de iniciar a gravação, sem mostrar a senha.
- Mostre listagem de produtos, edição de descrição e atualização de imagem.
- Mostre pedidos e status criados na própria sessão de demonstração.
- Grave apenas a janela da aplicação; confira notificações e abas ao redor.
- Revise as capturas antes de adicioná-las ao README ou ao LinkedIn.
- Encerre a sessão em memória ao terminar. Não publique credenciais temporárias.

As capturas ainda precisam ser produzidas e revisadas; este documento não é
evidência de verificação visual concluída.

## Checklist antes de divulgar uma nova versão

- [ ] Conferir home, produto, carrinho e checkout em desktop e mobile.
- [ ] Percorrer as ações por teclado e conferir foco e mensagens.
- [ ] Conferir filtros e URL, produto indisponível e resultado vazio.
- [ ] Testar falha de rede e nova tentativa sem duplicar submissões.
- [ ] Executar lint e testes; guardar o resultado real.
- [ ] Conferir se a versão revisada foi publicada, sem presumir sincronização.
- [ ] Abrir o link público anonimamente e conferir catálogo e imagens.
- [ ] Revisar documentação e capturas para não expor dados privados.

## Texto-base para apresentar o projeto

“Violet Voltage é um projeto de portfólio full stack com JavaScript, Express e
PostgreSQL. Desenvolvi catálogo com ficha técnica e filtros, comparador, kits,
carrinho que confere compatibilidade, checkout com cálculo e estoque no
servidor, comprovante, trocas, perguntas e respostas e um painel com
indicadores. O assistente de compras usa processamento de linguagem natural
feito no próprio projeto, sem custo, e pode ser reforçado pelo Gemini gratuito.
Tudo com testes automatizados, CI e verificação de acessibilidade.”

Adapte o texto ao que estiver efetivamente publicado: só cite o Gemini se a
chave estiver configurada (T07) e as fotos novas depois do seed (T05/T06).
