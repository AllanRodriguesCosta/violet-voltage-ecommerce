# Roadmap de evolução — Violet Voltage

Objetivo: apresentar um portfólio profissional de desenvolvimento full stack, com
uma loja de instrumentos completa e moderna, sem vendas reais. Manter Express,
JavaScript sem frameworks, PostgreSQL e a hospedagem atual. Agentes ficam para
uma fase posterior.

Site publicado: <https://violet-voltage-ecommerce-1.onrender.com/>. CI: workflow
**Qualidade** (lint e testes) em cada push e pull request para `main`.

## Como as entregas acontecem

- Uma branch e um pull request por entrega, com o que mudou e como foi verificado.
- Merge somente com o CI verde. O Render publica a versão de `main`.
- Revisão no navegador em 360, 768 e 1440 px antes do merge; cada entrega marca
  seus itens neste arquivo.

## Princípios

- Valores em centavos inteiros; o servidor recalcula preço, frete, desconto e parcelas.
- Sem notas, estrelas ou avaliações. Informações dos cards vêm do catálogo ou de
  regras implementadas no servidor.
- Interface pública sem avisos de simulação, verificada por teste automatizado.
- Sem frameworks de frontend e sem dependências novas sem necessidade. Animações
  respeitam `prefers-reduced-motion`.
- Heurísticas de usabilidade como critério de revisão: status visível, controle e
  desfazer, prevenção de erros, reconhecimento em vez de memorização,
  consistência e ajuda.

## Fase 1 — Base (etapas 1 a 5)

### 1. Identidade visual e home

- [x] Direção: visual musical editorial, roxo profundo, lilás e superfícies claras.
- [x] Abertura, hierarquia tipográfica, botões e cards do catálogo.
- [x] Apresentação da marca e navegação para ela.
- [x] Revisar home, produto e checkout em 360, 768 e 1440 px (feito em cada
      entrega da Fase 2).

### 2. Catálogo e produto

- [x] Ordenação por preço e nome; busca e categoria preservadas na URL.
- [x] Filtros aplicados visíveis, limpeza rápida e resultado vazio com ação útil.
- [x] Descrição e especificações apenas com dados disponíveis.
- [x] Disponibilidade e validação de quantidade.

### 3. Mobile e acessibilidade

- [x] Menu móvel com Escape, retorno do foco e fechamento ao clicar fora.
- [x] Filtros recolhíveis, áreas de toque de 44 px e formulários mobile.
- [ ] Contraste, títulos, labels, mensagens e zoom de 200% (etapa 13).
- [ ] Navegação completa por teclado (adiada a pedido do autor).

### 4. Acabamento dos fluxos

- [x] Feedback do carrinho e prevenção de cliques repetidos.
- [x] Recuperação de rede e mensagens nos fluxos principais.
- [x] Confirmação do pedido com foco e acesso ao histórico.
- [ ] Padronizar carregamento, falha, vazio e sucesso em todas as telas (etapa 13).

### 5. Apresentação técnica

- [x] CI de lint e testes no GitHub Actions, sem credenciais de produção.
- [x] Primeira execução real do CI aprovada em 10/11/2026.
- [x] Estudo de caso e roteiro de demonstração.
- [ ] README com capturas da versão publicada.
- [ ] Medição de desempenho e acessibilidade registrada.

## Fase 2 — Experiência de loja completa

Amplia o antigo "Roadmap 2" (descoberta separada dos resultados, cards ricos,
lista de desejos, busca fixa e navegação inferior) com sistema visual, regras de
preço no servidor e ciclo de vida dos pedidos.

### 6. Sistema visual e navegação

- [x] Fonte Geist (licença OFL) servida pelo próprio site; tokens de cor, espaço,
      raio, sombra e movimento.
- [x] Cabeçalho fixo com busca, favoritos, conta e carrinho; atalhos de categorias.
- [x] Navegação inferior no celular: início, catálogo, favoritos, carrinho e conta.
- [x] Minicarrinho lateral com quantidades, remoção com "Desfazer" e subtotal.
- [x] Avisos por tipo (sucesso, erro, informação) com ação, como "Desfazer" e
      "Ver favoritos".
- [x] Esqueletos de carregamento e estados de vazio e erro nas vitrines (home,
      catálogo e favoritos).
- [x] Transições entre páginas e animações de entrada, desligadas com redução de
      movimento.
- [x] Sessão consultada por `GET /api/auth/session`: visitante recebe `null`, sem
      erro 401 no console.

### 7. Descoberta e catálogo

- [x] Home de descoberta: categorias com contagem, destaques em carrossel, setups
      prontos e vistos recentemente.
- [x] Página de resultados própria (`catalogo.html`), com busca fixa no topo,
      filtros de categoria, marca, faixa de preço e disponibilidade com contagens,
      ordenação e URL compartilhável. Links antigos `/?categoria=` redirecionam.
- [x] Sugestões de busca instantâneas, sem diferenciar acentos, com teclado.
- [x] Cards ricos: últimas unidades, esgotado, favoritar e adicionar rápido.
- [x] Lista de desejos (`favoritos.html`) no celular e no desktop.

### 8. Página de produto

- [x] Zoom da imagem ao passar o cursor e visualização em tela cheia.
- [x] Seletor de quantidade, "Comprar agora", tabela de parcelas e opções de
      entrega com prazo e preço.
- [x] Produtos relacionados, vistos recentemente e barra de compra fixa no celular.
- [x] Compartilhar link e dados estruturados schema.org `Product`, sem avaliações.

### 9. Carrinho, checkout e regras de preço

- [x] Módulo único de preços no servidor (`src/services/pricing.js`): frete
      padrão grátis a partir de R$ 999, cupons e até 10x sem juros (parcela
      mínima de R$ 50).
- [x] Cotação `POST /api/checkout/quote` usada pelo carrinho e pelo checkout, com
      testes; um teste garante que as regras exibidas no navegador são as do
      servidor.
- [x] Parcelamento nos cards e no produto; progresso para frete grátis no
      minicarrinho e no carrinho; prazos por forma de entrega.
- [x] Carrinho com seletor de quantidade, desfazer remoção, salvar para depois,
      estimativa de entrega, cupom e sugestões.
- [x] Checkout em seções (entrega, pagamento com parcelas e cupom), resumo fixo
      e confirmação animada.

### 10. Pedidos, conta e administração

- [x] Histórico de status com datas e transições válidas
      (`src/services/orders.js`); cancelamento devolve os itens ao estoque na
      mesma transação.
- [x] Cliente cancela pedido ainda "Recebido" (`POST /api/orders/:id/cancel`) e
      pode comprar novamente.
- [x] Minha conta com indicadores, filtros e linha do tempo de cada pedido.
- [x] Painel com ticket médio, pedidos por status, vendas dos últimos 14 dias,
      estoque baixo, busca e filtros; confirmações em diálogo próprio.

### 11. Qualidade técnica e conteúdo

- [x] Consultas por chave e por cliente no PostgreSQL (chave primária e índices
      únicos) para produto, cliente, histórico, cotação, pedido e cancelamento.
      Catálogo e listagens do painel continuam lendo a tabela inteira.
- [x] Log de inicialização com a causa (mensagem própria ou código do erro), sem
      segredos; ROLLBACK com falha não mascara o erro original.
- [x] Central de ajuda (`ajuda.html`) com busca; login e cadastro com mostrar
      senha, força da senha, validação ao sair do campo, telefone formatado e
      retorno ao destino.
- [x] Meta tags Open Graph, `noindex` nas páginas privadas, `robots.txt` e
      `sitemap.xml` gerados pelo servidor.
- [ ] Medições Lighthouse da versão publicada registradas.
- [x] O app deixa de carregar os SDKs Azure (memória em `memory.js`).
- [ ] Remover o adaptador Azure legado e suas dependências (exige regenerar o
      `package-lock.json` com npm).

### 12. Aparência e microinterações

- [x] Tema escuro com escolha automática (segue o sistema), clara ou escura:
      botão no cabeçalho, seletor no menu e no rodapé, salvo no navegador e
      aplicado antes da primeira pintura.
- [x] Tokens para texto sobre cores de destaque, mídia e superfícies
      translúcidas; teste automatizado de contraste AA nos dois temas.
- [x] Produto "voa" até o carrinho, o contador pulsa e um aviso compacto, não
      modal, mostra o item, o progresso de frete grátis e atalhos para carrinho e
      checkout. O minicarrinho abre só quando pedido.
- [x] Visualização rápida a partir dos cards (folha inferior no celular), com
      quantidade limitada ao estoque, favoritos e link para a página completa.
- [x] Avisos com barra de tempo que pausam com cursor ou foco, botão de voltar
      ao topo e sombra no cabeçalho ao rolar.
- [x] Cabeçalho realmente fixo ao rolar: o bloco que recebe o cabeçalho limitava
      o `position: sticky`.

### 13. Acessibilidade e estados (fecha pendências da Fase 1)

- [ ] Auditoria automatizada no navegador: nomes acessíveis, rótulos, hierarquia
      de títulos, contraste do texto renderizado nos dois temas, IDs duplicados e
      imagens.
- [ ] Bordas de campos e controles com contraste de 3:1; zoom de 200% e reflow em
      320 px sem rolagem horizontal.
- [ ] Estados padronizados de carregamento, falha, vazio e sucesso em produto,
      carrinho, checkout, conta, painel e acesso.
- [ ] Erros de formulário ligados aos campos, com foco no primeiro erro.
- [ ] Medição local de desempenho (LCP, CLS e peso por página) registrada em
      `VALIDACAO.md`.

### 14. Conta completa

- [ ] Endereços salvos (até 5) com CEP formatado, UF e endereço principal; o
      checkout oferece os endereços salvos.
- [ ] "Avise-me" em itens esgotados: aviso na conta quando o estoque volta e
      procura por item no painel.
- [ ] Central de notificações: mudanças de status do pedido e estoque de volta,
      com contador no cabeçalho e marcação de lidas.

### 15. Descoberta e conversão

- [ ] Monte seu setup: escolha guiada por etapa (guitarra, amplificador, pedais,
      cabos e acessórios), total com parcelas, link compartilhável e tudo no
      carrinho de uma vez.
- [ ] Compre junto na página do produto, com itens complementares selecionáveis
      e total combinado.
- [ ] Busca tolerante a erros de digitação ("Você quis dizer") e buscas recentes
      nas sugestões.

### 16. Desempenho, instalação e conteúdo

- [ ] Cache HTTP por tipo de arquivo e compressão das respostas de texto.
- [ ] Manifesto do app, ícones e página offline com service worker de rede
      primeiro.
- [ ] Páginas de privacidade (dados guardados, cookie de sessão e armazenamento
      local) e termos de uso.

## Fase 3 — Agentes (depois da Fase 2)

Escolher um agente com utilidade comprovável. Primeiro candidato: assistente de
descoberta com consulta somente leitura ao catálogo real. Segundo, opcional:
qualidade do catálogo para o administrador, inicialmente só com sugestões;
qualquer escrita futura exige revisão e autorização no backend. Antes de
implementar, definir provedor, custo mensal, limites, dados permitidos, fallback
e avaliações.

Passo a passo de publicação: [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md). Contexto:
[estudo de caso](ESTUDO-DE-CASO.md). Evidências: [validação](../VALIDACAO.md).
