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
- [x] Contraste, títulos, labels, mensagens e zoom de 200% (etapa 13).
- [ ] Navegação completa por teclado (adiada a pedido do autor).

### 4. Acabamento dos fluxos

- [x] Feedback do carrinho e prevenção de cliques repetidos.
- [x] Recuperação de rede e mensagens nos fluxos principais.
- [x] Confirmação do pedido com foco e acesso ao histórico.
- [x] Padronizar carregamento, falha, vazio e sucesso em todas as telas (etapa 13).

### 5. Apresentação técnica

- [x] CI de lint e testes no GitHub Actions, sem credenciais de produção.
- [x] Primeira execução real do CI aprovada em 10/11/2026.
- [x] Estudo de caso e roteiro de demonstração.
- [ ] README com capturas da versão publicada.
- [x] Medição local de desempenho e acessibilidade registrada (etapa 13); a do
      site publicado segue na etapa 11.

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
- [x] Remover o adaptador Azure legado e suas dependências: `@azure/data-tables`,
      `@azure/storage-blob` e 26 pacotes usados só por eles saíram do
      `package.json` e do `package-lock.json` (etapa 16).

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

- [x] Auditoria automatizada no navegador, nos temas claro e escuro, em 360 e
      1440 px: nomes acessíveis, rótulos, hierarquia de títulos, contraste do
      texto renderizado, contraste dos campos, IDs duplicados, imagens e alvos de
      toque.
- [x] Bordas de campos e controles com contraste de 3:1; zoom de 200% (640 px) e
      reflow em 320 px sem rolagem horizontal.
- [x] Estados padronizados de carregamento, falha, vazio e sucesso em produto,
      carrinho, checkout, conta, painel e acesso, sempre com nova tentativa ou
      caminho de saída.
- [x] Erros de formulário em português ligados aos campos, validação ao sair do
      campo e foco no primeiro erro.
- [x] Medição local de desempenho (LCP, CLS e peso por página) registrada em
      `VALIDACAO.md`; o deslocamento causado pelo cabeçalho e pelo rodapé foi
      eliminado e os módulos passaram a ser baixados em paralelo.
- [x] Corrigido: a central de ajuda exibia um erro de script quando aberta sem
      âncora.

### 14. Conta completa

- [x] Endereços salvos (até 5) com CEP formatado, UF sugerida pelo CEP e
      endereço principal; o checkout oferece os endereços salvos, o do cadastro
      e a opção de digitar outro.
- [x] "Avise-me" em itens esgotados (cards, produto e visualização rápida): aviso
      na conta quando o estoque volta, inclusive por cancelamento, e procura por
      item no painel.
- [x] Central de notificações: mudanças de status feitas pela loja e estoque de
      volta, com contador no cabeçalho (sino) e na navegação inferior, e
      marcação de lidas.
- [x] Tabelas `alerts` e `notifications` na migração idempotente; reposição,
      aviso e notificação na mesma transação no PostgreSQL.

### 15. Descoberta e conversão

- [x] Monte seu setup (`setup.html`): escolha guiada em seis etapas (guitarra,
      amplificador, efeitos, cabos, correia e acessórios), resumo com total,
      parcelas e frete grátis, link compartilhável (`?itens=`), barra fixa no
      celular e tudo no carrinho de uma vez. Setups prontos da home podem ser
      personalizados.
- [x] Compre junto na página do produto: itens complementares de outras
      categorias, selecionáveis, com total combinado.
- [x] Busca tolerante a erros de digitação ("Você quis dizer" nas sugestões e
      correção automática no catálogo, com opção de buscar o termo exato) e
      buscas recentes ao focar o campo vazio.

### 16. Desempenho, instalação e conteúdo

- [x] Compressão Brotli/gzip dos arquivos de texto (comprimidos uma vez por
      versão) e das respostas JSON a partir de 1 KB; cache HTTP por tipo de
      arquivo (HTML, CSS e JS revalidam com ETag; fonte por 30 dias; imagens por
      7 dias). Peso por página caiu de cerca de 200 KB para cerca de 80 KB.
- [x] Manifesto do app, ícones (inclusive maskable), atalhos e service worker de
      rede primeiro: páginas já abertas funcionam sem conexão e as demais
      mostram `offline.html`. A API nunca passa pelo cache.
- [x] Páginas de privacidade (dados guardados, cookie de sessão e armazenamento
      local) e termos de uso, com links no rodapé e no sitemap.

## Fase 3 — Assistente de compras (decisões de 12/11/2026)

Projeto universitário, sem custo: nada pago, nenhuma conta com forma de
pagamento. Decisões:

- **Motor híbrido.** PLN local em JavaScript (normalização, intenção,
  entidades e diálogo com perguntas de afunilamento) sempre ativa, sem chave e
  sem internet. Gemini gratuito (chave do Google AI Studio, sem faturamento) só
  como reforço para frases que a PLN local não entender, sempre ancorado nos
  dados do catálogo; sem chave, sem cota ou com demora, a PLN local responde.
  No plano gratuito o Google pode usar o conteúdo enviado: só vão a pergunta e
  dados do catálogo, nunca dados pessoais.
- **Só usuários logados.**
- **Um agente unificado** com módulos internos: compras e recomendação, dúvidas
  da loja (FAQ), status dos próprios pedidos e sugestão de setup. Nada é
  alterado sem o cliente clicar (ex.: "adicionar ao carrinho").
- **Dados antes do agente.** Conversa-alvo: "quero uma guitarra mais vintage" →
  "e qual gênero vintage?" → "blues rock" → sugere modelos Strat. Isso exige
  ficha técnica estruturada e mais produtos.
- **Divisão de trabalho.** Código e testes unitários aqui (Copilot, via
  repositório); tarefas locais (fotos, chave em `.env`, testes com o Gemini de
  verdade, conferência do site publicado) com o Codex ou manualmente, conforme
  [PENDENCIAS-MANUAIS.txt](PENDENCIAS-MANUAIS.txt) e
  [FERRAMENTAS-E-BIBLIOTECAS.txt](FERRAMENTAS-E-BIBLIOTECAS.txt).

### 17. Ficha técnica e base de conhecimento

- [x] Esquema de ficha técnica por categoria (`public/js/specs.js`), único para
      loja, painel e servidor: estilo (vintage, moderno, atemporal), gêneros
      indicados e campos próprios (formato, captação, ponte e timbre das
      guitarras; tecnologia, potência, falantes e sonoridade dos amplificadores;
      tipo de efeito dos pedais; tipo, conectores e comprimento dos cabos etc.).
- [x] Fichas dos 22 produtos iniciais (`src/services/seed-specs.js`); produtos
      já gravados recebem a ficha na leitura, sem precisar rodar o seed.
- [x] Catálogo: filtros por estilo e gênero em todas as categorias e pelos
      campos da categoria escolhida, com contagem, chips e URL compartilhável;
      a busca também encontra pela ficha ("humbucker", "valvulado britânico").
- [x] Página do produto com a ficha completa; gêneros viram atalhos para o
      catálogo filtrado. Painel do administrador edita a ficha com campos
      gerados pelo esquema, validados no servidor.
- [x] Base de conhecimento musical (`src/knowledge/genres.js`): 16 gêneros com
      sinônimos, época, resumo do timbre e o que combina em guitarra,
      amplificador e pedais, validada contra o esquema.

### 18. Catálogo ampliado

- [x] 75 produtos (22 originais + 53 novos: 14 guitarras, 10 amplificadores,
      15 pedais, 3 cabos, 3 correias e 8 acessórios), misturando marcas reais
      e a marca própria, todos com ficha técnica; novos tipos de efeito
      (compressor, tremolo, afinador e looper). Cada gênero da base de
      conhecimento tem guitarra, amplificador e pedal etiquetados, com
      etiquetas coerentes com a base (verificado por teste).
- [x] Lista de fotos em `docs/FOTOS-PENDENTES.txt` (arquivo, produto e código);
      `npm run fotos:conferir` confere a pasta; `npm run seed -- --parcial`
      carrega só os produtos que já têm foto e lista os que faltam.
- [x] Catálogo em páginas de 24 com "Mostrar mais"; atalhos por estilo musical
      na home; filtro de estilo no montador de setup (`?genero=`); "Compre
      junto" e relacionados escolhidos pela ficha.

### 19. Assistente com PLN local

- [x] Endpoint `POST /api/assistente` (só logados; 40 mensagens a cada 5 min
      por usuário; mensagem até 500 caracteres; contexto revalidado).
- [x] Normalização, radicalização, classificador Naive Bayes de 15 intenções
      com tolerância a erros de digitação, entidades (preço, categoria, tipo,
      marca, gênero, estilo, formato, captação, uso, nível e produto pelo
      nome) e diálogo com perguntas de afunilamento.
- [x] Módulos: recomendação com cards e motivo, produto pelo nome, setup
      dentro do orçamento, status e cancelamento de pedidos, dúvidas da loja
      geradas das regras do checkout. Chat na loja com histórico da aba,
      sugestões clicáveis, adicionar ao carrinho e link para o catálogo
      filtrado.
- [x] Conjunto de avaliação com 88 frases fora do treino e duas conversas;
      `npm run agente:eval` mostra o acerto por intenção (95,5%) e de
      entidades (100%). Detalhes em [ASSISTENTE.md](ASSISTENTE.md).

### 20. Conta, privacidade e Central de Ajuda (antes do Gemini)

- [x] Minha conta, seção Segurança e privacidade: trocar senha (senha atual,
      confirmação; sessões abertas antes da troca deixam de valer), baixar os
      próprios dados (cadastro, endereços, pedidos, avisos e notificações em
      JSON) e excluir a conta com a senha (dados pessoais, avisos e
      notificações apagados; pedidos mantidos sem eles; bloqueada com pedido
      em andamento; o e-mail pode ser cadastrado de novo). Política de
      privacidade atualizada.
- [x] Central de Ajuda com fonte única (`src/knowledge/help.js`): 23 perguntas
      em 6 seções (novas: notificações, endereços, ficha técnica, montador,
      Avise-me, assistente, troca de senha, cópia dos dados e exclusão), valores
      vindos das regras do checkout e link direto para cada pergunta; teste
      garante que a página publicada está em dia.
- [x] Assistente busca na Central de Ajuda (IDF) antes do "não entendi" e nas
      dúvidas de conta; "trocar a senha" deixou de virar troca de produto.
- [x] No celular, o painel do assistente em tela cheia deixa o resto da página
      inerte para teclado e leitor de tela.

### 21. Comparador, kits, compatibilidade e comprovante

Decisões de 12/11/2026: ferramentas musicais (afinador, metrônomo, acordes)
ficam para um futuro site de estudos, ligado à loja depois; avaliação de
instrumento usado na troca fica de fora.

- [x] Comparador de 2 a 4 produtos: botão "Comparar" no cartão e na página do
      produto, barra flutuante, tabela com a ficha lado a lado, linhas
      diferentes destacadas, "mostrar só as diferenças", menor preço sinalizado
      e link compartilhável (`/comparar.html?ids=`).
- [x] Kits com desconto (`public/js/kits.js`, fonte única da vitrine e do
      servidor): 5 kits; com o kit completo no carrinho o desconto entra sozinho
      na cotação e no pedido, cada unidade conta para um kit só e o cupom vale
      sobre o restante. Página `/kits.html` e kits na home.
- [x] Compatibilidade no carrinho (`public/js/compat.js`): guitarra sem cabo ou
      sem amplificador, pedais sem fonte de 9V (fonte simples ou isolada),
      pedais sem cabos patch, pedalboard, patch sozinho, correia e cordas
      reserva, e kit a 1 ou 2 itens de completar, sempre com sugestão do
      catálogo e botão de adicionar.
- [x] Ficha dos pedais com alimentação; 2 fontes novas no catálogo (77
      produtos; fotos em [FOTOS-PENDENTES.txt](FOTOS-PENDENTES.txt)).
- [x] Pedido: previsão de entrega em dias úteis, código de rastreio gerado ao
      enviar (também na notificação), comprovante em `/pedido.html` com
      impressão/PDF e economia na confirmação.

### 22. Serviços, guias, filtros do segmento, alerta de preço e perguntas

- [x] Serviços no carrinho (`public/js/services.js`, fonte única): regulagem por
      luthier e troca de cordas para guitarras, garantia estendida de 12 meses
      (8% do item, mínimo R$ 29,90) para guitarras, amplificadores e pedais.
      Validados e cobrados pelo servidor por unidade; o cupom não incide sobre
      serviços; aparecem no checkout, no pedido e no comprovante.
- [x] Guias de compra (6) e glossário (48 termos) em `src/knowledge/`, página
      `/guias.html` gerada a partir deles, com busca no glossário e atalhos para
      o catálogo filtrado.
- [x] Filtros do segmento nas guitarras: mão, cordas e captadores (com 3
      guitarras novas: canhota, 7 cordas e EMG ativos), mais trastes e escala na
      ficha. Catálogo com 80 produtos (81 a partir da etapa 29).
- [x] Aviso de queda de preço no produto e para todos os favoritos; notifica
      uma vez com o preço antigo e o novo; avisos de estoque e de preço juntos em
      Minha conta.
- [x] Perguntas e respostas no produto: cliente logado pergunta (10 a 500
      caracteres, até 5 pendentes), a loja responde ou oculta pela nova aba do
      painel, só as respondidas são publicadas (nome e inicial) e quem perguntou
      é notificado. Exclusão da conta apaga as pendentes e anonimiza as
      respondidas; a cópia dos dados inclui as perguntas.

### 23. Painel e SEO

- [x] Painel: vendas por categoria, 5 mais vendidos, serviços e kits vendidos,
      taxa de cancelamento, interesse em preço (avisos ativos) e atalho para as
      perguntas aguardando resposta (indicador novo).
- [x] SEO no servidor (`src/http/seo.js`): página do produto sai com título,
      descrição com preço e ficha, Open Graph (imagem, tipo produto), link
      canônico e dados estruturados de produto (com a ficha) e trilha de
      navegação; catálogo por categoria com título e descrição próprios; início
      com dados da loja e da busca interna; `robots.txt` bloqueia comprovante e
      carrinho.

### 24. Assistente que age

- [x] Página atual, carrinho e favoritos enviados pelo navegador (só IDs) e
      revalidados: "essa" é o produto aberto; sugestões iniciais conforme a
      página.
- [x] Perguntas sobre a ficha (trastes, escala, ponte, captação, fonte,
      potência, comprimento, estoque, "serve para metal?").
- [x] Comparação de produtos citados, do produto aberto e da lista anterior.
- [x] Adicionar ao carrinho e aplicar cupom com botão de confirmação.
- [x] "O que falta no meu carrinho?" com as regras de compatibilidade e dica no
      botão do assistente quando o carrinho tem algo essencial faltando.
- [x] Setup no orçamento com o kit que cabe nele; filtros de mão, cordas,
      captadores ativos e trastes.
- [x] Sugestões pelo histórico de compras e preço dos favoritos.
- [x] Glossário no chat ("o que é...", "diferença entre...").
- [x] Troca ou devolução: solicitação no comprovante (até 7 dias depois da
      conclusão, uma por vez), resposta da loja no painel e notificações; o
      assistente leva até ela.
- [x] Registro anônimo das frases não entendidas (90 dias) na aba Assistente
      do painel. Privacidade atualizada.

### 25. Reforço com Gemini gratuito e voz

- [x] Camada opcional (`src/assistant/gemini.js`) com `fetch` nativo,
      `GEMINI_API_KEY` só no ambiente (no cabeçalho, nunca na URL), tempo
      limite, limite próprio por minuto e retorno à resposta local em qualquer
      falha. Só recebe frases que a PLN local não entendeu, anonimizadas, com o
      catálogo e as regras da Central de Ajuda; produtos sugeridos são
      conferidos no catálogo e a resposta aparece marcada na conversa.
- [x] Scripts `npm run agente:smoke` e `npm run agente:eval -- --gemini` para o
      Codex rodar com a chave real (tarefa T07).
- [x] Entrada por voz no chat (Web Speech API do navegador), com aviso de
      privacidade no primeiro uso; a fala preenche o campo e o envio continua
      sendo do cliente. Privacidade e ajuda atualizadas.

## Fase 4 — Ajustes pedidos pelo Allan (13/11/2026)

### 26. Assistente para visitantes e respostas mais naturais

- [x] Assistente aberto a quem não está logado; pedidos, histórico, preço dos
      favoritos e trocas respondem com "Entrar ou criar conta", que volta para
      a mesma página depois do login ou do cadastro (o retorno vale para
      qualquer página interna).
- [x] Reações à resposta anterior: "muito caro" no setup monta uma versão mais
      barata, mostra quanto economiza e pergunta o orçamento; um valor solto
      ("2500") ou "Até R$ 3.000" refaz o setup; na recomendação mostra opções
      mais em conta ou explica que já são as mais acessíveis; sem contexto,
      orienta e oferece kits, parcelas e cupom. "Não gostei" mostra outras
      opções; "gostei" oferece adicionar ao carrinho. "Muito caro" deixou de
      ser entendido como agradecimento.

### 27. Menu da conta no cabeçalho e Minha conta em seções

- [x] "Olá, Nome" no cabeçalho virou um menu com as iniciais: Visão geral, Meus
      pedidos, Dados e segurança, Endereços, Métodos de pagamento, Avisos de
      estoque e preço, Favoritos, Preciso de ajuda e Sair (mais o painel para o
      administrador). Abre com clique ou setas, fecha com Esc, clique fora ou
      quando o foco sai; no celular os mesmos atalhos ficam no menu lateral.
- [x] Minha conta reorganizada em seções (`#visao-geral`, `#pedidos`, `#dados`,
      `#enderecos`, `#pagamentos`, `#avisos`, `#notificacoes`, `#ajuda`), com
      navegação lateral no computador e abas roláveis no celular. O conteúdo
      ocupa a largura em cartões: visão geral com indicadores e cartões (último
      pedido com etapas e rastreio, notificações, dados, endereço principal,
      pagamento preferido, avisos e ajuda); "Dados e segurança" com perfil,
      senha, cópia dos dados e exclusão lado a lado. Links antigos
      (`#seguranca`) continuam valendo, e o botão voltar do navegador troca de
      seção.
- [x] Métodos de pagamento: forma preferida (Pix, cartão com parcelas ou
      boleto) salva na conta e já marcada no checkout. A loja guarda só o
      método e o número de parcelas, nunca dados de cartão
      (`PATCH /api/account/payment`; entra na cópia dos dados e é apagada com a
      conta).
- [x] Preciso de ajuda: assuntos frequentes (onde está o pedido, troca,
      cancelamento, senha e dados, Central de ajuda) e botão que abre o
      assistente.
- [x] "Sair" encerra a sessão e apaga a conversa do assistente guardada na aba.

### 28. Assistente: pedido de ajuda e setup que respeita o orçamento

- [x] "Ajuda", "socorro", "help", "tive um problema", "quero falar com o
      atendimento": em vez de explicar o que o assistente faz, pergunta o que
      aconteceu e oferece os assuntos mais comuns em botões (onde está o
      pedido, troca, problema com o pagamento, não consigo entrar na conta,
      indicação de equipamento), com link para a Central de Ajuda. Logado, já
      cita o pedido em andamento. "O que você faz?" continua com a apresentação.
- [x] Respostas novas: problema no pagamento (passo a passo: tela de
      confirmação, carrinho guardado, conferir em Meus pedidos) e problema para
      entrar na conta (e-mail, Caps Lock, bloqueio de 15 minutos, recuperação
      ainda indisponível).
- [x] Monte seu setup com orçamento primeiro: quando nenhuma peça do gênero
      cabe, o assistente escolhe uma peça de outro perfil que caiba, explica a
      troca ("não é dos mais típicos de rock clássico, mas atende bem") e
      mostra a opção do gênero que ficou de fora, com o preço. Só depois tira
      pedal e correia, que voltam se sobrar dinheiro.
- [x] "Mais barato" e "muito caro" sempre entregam um setup mais barato de
      verdade (tenta uns 20% a menos e, se o estoque não permitir, qualquer
      economia) ou avisam que aquele já é o mínimo, com montador e kits como
      saída; quando pedal ou correia saem para economizar, o assistente avisa.
      O aviso de orçamento estourado usa o valor que o cliente disse, não um
      teto interno.
- [x] "Quero falar com o suporte/atendente" abre a triagem mesmo com a palavra
      "suporte" (que também é um produto); "tem suporte de chão?" continua
      sendo busca de produto.

### 29. Fotos novas, galeria do produto e opção de cor

- [x] Fotos enviadas pelo Allan conferidas e padronizadas (fundo branco, recorte
      centralizado, quadradas, PNG abaixo de 600 KB, sem ampliar além do
      original), com os nomes e subpastas do seed (na etapa 30 elas foram para
      o repositório, com a autorização do Allan).
- [x] Galeria na página do produto: carrossel com setas, miniaturas, contador,
      setas do teclado na foto, arrastar no celular e ampliação da foto que está
      na tela. Amplificadores com frente, traseira e, quando os controles ficam
      em cima, o painel visto de cima.
- [x] Opção de cor: nos modelos com fotos em mais de uma cor (Blues Junior IV,
      Hot Rod Deluxe IV, AC30C2 e Crush 20RT), bolinhas ao lado da foto trocam o
      carrossel para a cor escolhida; `?cor=` no endereço guarda a escolha. Os
      cartões do catálogo mostram as bolinhas e "N cores".
- [x] A cor segue a compra: aviso e minicarrinho com a foto da cor, troca de cor
      no carrinho, resumo do checkout, pedido, histórico e comprovante. O
      servidor só aceita as cores do produto (sem escolha, vale a padrão).
- [x] Seed: fotos extras opcionais (o produto entra com as que existirem),
      `npm run fotos:conferir` e `npm run seed` informam as extras que faltam,
      rota `GET /api/images/:id/:n` para cada foto da galeria. Sem migração: os
      campos ficam no JSON do produto.
- [x] Produto novo demo-081 (cabo Santo Angelo Standard 2 m), que chegou com as
      fotos.

### 30. Fotos no repositório e carga automática ao iniciar

- [x] Com a autorização do Allan, as fotos novas (51 principais e 29 extras da
      galeria) passaram a ficar no repositório, em `seed-assets/catalogo/`. As
      22 fotos originais continuam fora do Git.
- [x] Ao iniciar, o servidor cadastra os produtos do manifesto que têm foto ali
      e ainda não estão no banco, e atualiza só as fotos dos que já existem
      quando os arquivos mudam. Nunca altera preço, estoque, descrição ou
      status, mantém a foto enviada pelo painel, não apaga nada e roda em
      segundo plano, sem atrasar a subida. `CATALOG_SYNC=off` desliga.
- [x] `npm run seed` e `npm run fotos:conferir` procuram cada foto na pasta
      local e depois nas fotos do repositório. Com isso, a carga das fotos novas
      no site publicado não depende mais de rodar o seed com a senha do banco:
      basta o deploy (T01).

Passo a passo de publicação: [COLOCAR-NO-AR.md](COLOCAR-NO-AR.md). Contexto:
[estudo de caso](ESTUDO-DE-CASO.md). Evidências: [validação](../VALIDACAO.md).
