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
- [ ] Revisar home, produto e checkout em 360, 768 e 1440 px (passa a fazer parte
      de cada entrega da Fase 2).

### 2. Catálogo e produto

- [x] Ordenação por preço e nome; busca e categoria preservadas na URL.
- [x] Filtros aplicados visíveis, limpeza rápida e resultado vazio com ação útil.
- [x] Descrição e especificações apenas com dados disponíveis.
- [x] Disponibilidade e validação de quantidade.

### 3. Mobile e acessibilidade

- [x] Menu móvel com Escape, retorno do foco e fechamento ao clicar fora.
- [x] Filtros recolhíveis, áreas de toque de 44 px e formulários mobile.
- [ ] Contraste, títulos, labels, mensagens e zoom de 200%.
- [ ] Navegação completa por teclado (adiada a pedido do autor).

### 4. Acabamento dos fluxos

- [x] Feedback do carrinho e prevenção de cliques repetidos.
- [x] Recuperação de rede e mensagens nos fluxos principais.
- [x] Confirmação do pedido com foco e acesso ao histórico.
- [ ] Padronizar carregamento, falha, vazio e sucesso em todas as telas (etapa 6).

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

- [ ] Fonte Geist (licença OFL) servida pelo próprio site; tokens de cor, espaço,
      raio, sombra e movimento.
- [ ] Cabeçalho fixo com busca, favoritos, conta e carrinho; atalhos de categorias.
- [ ] Navegação inferior no celular: início, buscar, favoritos, carrinho e conta.
- [ ] Minicarrinho lateral com quantidades, remoção, subtotal e progresso para
      frete grátis.
- [ ] Avisos por tipo (sucesso, erro, informação) com ação, como "Desfazer" e
      "Ver carrinho".
- [ ] Esqueletos de carregamento e estados padronizados de vazio e erro.
- [ ] Transições entre páginas e animações de entrada, desligadas com redução de
      movimento.

### 7. Descoberta e catálogo

- [ ] Home de descoberta: categorias com contagem, destaques em carrossel, setups
      prontos e vistos recentemente.
- [ ] Página de resultados própria, com busca fixa no topo, filtros de categoria,
      marca, faixa de preço e disponibilidade, ordenação e URL compartilhável.
- [ ] Sugestões de busca instantâneas, sem diferenciar acentos.
- [ ] Cards ricos: parcelamento, últimas unidades, esgotado, favoritar e
      adicionar rápido.
- [ ] Lista de desejos no celular e no desktop.

### 8. Página de produto

- [ ] Zoom da imagem e visualização ampliada.
- [ ] Seletor de quantidade, "Comprar agora", parcelas e opções de entrega com prazo.
- [ ] Produtos relacionados, vistos recentemente e barra de compra fixa no celular.
- [ ] Compartilhar link e dados estruturados schema.org `Product`, sem avaliações.

### 9. Carrinho, checkout e regras de preço

- [ ] Módulo único de preços no servidor: frete padrão grátis acima de R$ 999,
      cupons e até 10x sem juros (parcela mínima de R$ 50).
- [ ] Cotação `POST /api/checkout/quote` usada pelo carrinho e pelo checkout, com
      testes.
- [ ] Carrinho com seletor de quantidade, desfazer remoção, salvar para depois e
      sugestões.
- [ ] Checkout em seções (entrega, pagamento e cupom), resumo fixo e confirmação
      animada.

### 10. Pedidos, conta e administração

- [ ] Histórico de status com datas e transições válidas; cancelamento devolve
      os itens ao estoque.
- [ ] Cliente cancela pedido ainda "Recebido" e pode comprar novamente.
- [ ] Minha conta com linha do tempo de cada pedido.
- [ ] Painel com ticket médio, pedidos por status, vendas dos últimos 14 dias,
      estoque baixo, busca e filtros.

### 11. Qualidade técnica e conteúdo

- [ ] Consultas por chave e por cliente no PostgreSQL, sem varrer tabelas inteiras.
- [ ] Log de inicialização com o código do erro, sem segredos.
- [ ] Central de ajuda com perguntas frequentes; login e cadastro renovados.
- [ ] Meta tags por página e medições registradas.
- [ ] Remover o adaptador Azure legado e suas dependências (exige regenerar o
      `package-lock.json` com npm).

## Fase 3 — Agentes (depois da Fase 2)

Escolher um agente com utilidade comprovável. Primeiro candidato: assistente de
descoberta com consulta somente leitura ao catálogo real. Segundo, opcional:
qualidade do catálogo para o administrador, inicialmente só com sugestões;
qualquer escrita futura exige revisão e autorização no backend. Antes de
implementar, definir provedor, custo mensal, limites, dados permitidos, fallback
e avaliações.

Passo a passo de publicação: [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md). Contexto:
[estudo de caso](ESTUDO-DE-CASO.md). Evidências: [validação](../VALIDACAO.md).
