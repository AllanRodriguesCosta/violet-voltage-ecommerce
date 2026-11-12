# Fase 3, etapa 22 — 12/11/2026

- Testes novos em `tests/stage22.test.js` (5): IDs estáveis do catálogo e fichas
  completas das 20 guitarras; serviços por categoria, garantia proporcional,
  recusa de serviço inválido, cupom fora dos serviços e total; página de guias
  em dia com as fontes e atalhos do catálogo válidos; API com serviços no
  pedido, aviso de queda de preço (aumento não avisa, avisa uma vez, remoção),
  perguntas (login, tamanho, repetida, pendente oculta, só admin responde,
  notificação, ocultar, limite de 5 pendentes, cópia dos dados); exclusão da
  conta apaga pendentes e anonimiza respondidas.
- No navegador (31 verificações): filtros Mão/Cordas/Captadores, ficha com
  trastes e escala, serviços no produto, carrinho, checkout e comprovante,
  aviso de preço (visitante, cliente, favoritos, conta, notificação), pergunta
  (validação, envio, resposta no painel, publicação e notificação), guias
  (busca sem acento, termo destacado pelo link) e celular sem rolagem lateral.
- Acessibilidade em claro, escuro, 375 e 1440 px com 6 telas novas (guias,
  guias com busca, catálogo com filtros do segmento, perguntas para visitante e
  cliente, carrinho com serviços e aba Perguntas do painel), sem problemas.
- Regressão completa (15 roteiros) sem falhas; contagens atualizadas para 80
  produtos, 20 guitarras e 6 indicadores do painel.

---

# Fase 3, etapa 21 — 12/11/2026

- Testes novos em `tests/stage21.test.js` (5), com a loja de teste em
  `tests/helpers/api-fixture.js`:
  - Kits: itens existem, sem repetição, desconto de 5% a 15%; desconto só com o
    kit completo, em dobro com dois kits, unidade compartilhada conta uma vez,
    cupom sobre o valor já com o kit e total coerente.
  - Compatibilidade: cabo, amplificador, correia e cordas para guitarra;
    fonte isolada para 3 pedais, fonte simples para 1, nada para pedaleira com
    fonte inclusa; patch sozinho; carrinho completo sem avisos.
  - Ficha: alimentação em todos os pedais e comparação marcando diferenças.
  - API: cotação e pedido com kit, comprovante só do dono (404 para outro
    cliente, 401 sem login), rastreio `VV#########BR` ao enviar e notificação
    com o código e o link do comprovante.
- No navegador (39 verificações): comparador (barra, tabela, só diferenças,
  foco, link copiado e aberto em outro navegador, página do produto, limpar,
  vazio), kits (home, página, adicionar, desconto no carrinho), avisos de
  compatibilidade (guitarra, pedais, kit quase completo, adicionar resolve),
  checkout e confirmação com economia, comprovante (impressão sem cabeçalho),
  rastreio na conta e na notificação, pedido inexistente e celular (barra
  acima da navegação, tabela com rolagem própria, sem rolagem lateral).
- Acessibilidade em claro, escuro, 375 e 1440 px, com 7 telas novas (kits,
  comparador vazio, com 3 e só diferenças, barra, carrinho com avisos e
  comprovante), sem problemas. Alvos de toque de listas de links ajustados.
- Regressão completa (14 roteiros) sem falhas; roteiros antigos atualizados
  para 77 produtos e para os kits da home.

---

# Fase 3, etapa 20 — 12/11/2026

- Testes novos em `tests/help-account.test.js` (3):
  - A página `ajuda.html` traz cada seção, âncora, pergunta e resposta da fonte
    única, com valores do checkout.
  - A busca acha a pergunta certa e não responde a pedidos de compra.
  - "Trocar a senha" vai para conta, e "trocar o pedal" vai para troca.
  - Troca de senha: senha atual errada, nova curta ou igual recusadas; cookie
    novo; sessão antiga recusada; login só com a nova.
  - Cópia dos dados: arquivo para download, sem cache, sem senha e sem dados
    de outra pessoa.
  - Exclusão: senha errada recusada; pedido em andamento bloqueia (409);
    depois de cancelar, exclui. O cookie é apagado, a sessão e o login são
    recusados, o cadastro fica anônimo, os avisos são removidos e o pedido é
    mantido. Outra conta não é afetada; o mesmo e-mail cria conta nova sem
    herdar pedidos; administrador não se exclui.
- Avaliação do assistente: 93,8% em 96 frases fora do treino (8 novas de
  ajuda e conta, das quais 3 inéditas de verdade e 2 com erro, mantidas),
  46/46 entidades e 2/2 conversas.
- No navegador (16 verificações):
  - Seção Segurança e privacidade.
  - Confirmação diferente e senha atual errada marcam o campo.
  - Troca confirmada, formulário limpo e sessão mantida.
  - Download dos dados.
  - Exclusão: pede a senha, "Manter conta" devolve o foco, confirmação em
    diálogo, aviso na home, saída da conta e login recusado.
  - Âncora abre a pergunta exata, 6 seções na ajuda, busca por "senha" e
    privacidade atualizada.
  - No assistente (24 verificações), o fundo fica inerte no celular e volta
    ao fechar.
- Acessibilidade em claro, escuro, 375 e 1440 px, incluindo o formulário de
  exclusão aberto, sem problemas. A auditoria passou a tratar painel com
  `aria-modal="true"` como modal.
- Regressão completa (13 roteiros, 264 verificações) sem falhas.

---

# Fase 3, etapa 19 — 12/11/2026

- Testes novos em `tests/assistant.test.js` (13):
  - Texto: normalização, vogal alongada, radicais e atributos.
  - Classificador: frase sem palavra conhecida tem confiança zero; tolera erro
    de digitação; nenhuma frase de avaliação está no treino.
  - Preço: mil, k, faixa, aproximação; 10x, watts, metros e "anos 60" ignorados.
  - Entidades: gênero mais longo primeiro; "single cut" não vira captação;
    "rock clássico" não vira estilo; afinador sem categoria; marcas e apelidos;
    "procuro" não é Pro Co; produtos pelo nome; gênero e ficha técnica não
    viram nome de produto.
  - Conversa-alvo: pergunta o gênero vintage, depois Strats indicadas para
    blues rock em estoque; "e um amplificador?" mantém o gênero.
  - "Mais barato" só mostra itens mais baratos e inéditos; pedido novo não
    herda o gênero.
  - Setup: pergunta estilo e orçamento, respeita o orçamento, cabo de
    instrumento, ações com IDs e links internos.
  - Cards só com produtos reais em estoque e preço do servidor.
  - Pedidos: mais recente, por código, cancelamento e sem pedidos.
  - Dúvidas com valores do checkout.
  - Contexto malicioso revalidado.
  - Avaliação acima de 90%.
  - API: 401 sem login, 400 para mensagem vazia, longa ou contexto grande,
    pedidos de outra pessoa invisíveis, 41ª mensagem em 5 minutos recusada só
    para o usuário que excedeu.
- Avaliação (`npm run agente:eval`): 95,5% de acerto de intenção em 88 frases
  fora do treino, 46/46 entidades e 2/2 conversas. Erros: "eae" e "boa, até
  amanhã" abaixo da confiança mínima; duas perguntas fora do assunto caíram em
  "não entendi".
- No navegador (22 verificações):
  - Visitante não vê o assistente; logado vê.
  - Saudação pelo nome, foco no campo.
  - Conversa-alvo por digitação e por sugestão clicável.
  - Adicionar pelo card; setup com "adicionar tudo" abrindo o minicarrinho;
    link do setup com itens e estilo.
  - Pagamento, pedidos, histórico mantido entre páginas, Esc devolvendo o
    foco, nova conversa.
  - No celular: botão acima da navegação inferior, da barra de compra e sem
    cobrir o "voltar ao topo"; painel em tela cheia; sem rolagem horizontal.
- Acessibilidade com o painel aberto (recomendação e pedido) em claro, escuro,
  375 e 1440 px, sem problemas. A auditoria passou a ignorar alvos recortados
  por áreas com rolagem própria ou encobertos pelo painel.
- Regressão completa: 246 verificações em 12 roteiros, sem falhas.

---

# Fase 3, etapa 18 — 12/11/2026

- Testes novos ou ampliados: manifesto com IDs sequenciais `demo-001` a
  `demo-075`, arquivos e modelos únicos, nomes de foto sem espaço nem acento,
  estoques e contagem por categoria do lote original e da expansão; cada um dos
  16 gêneros com guitarra, amplificador e pedal etiquetados; etiquetas coerentes
  com a base de conhecimento (formato ou captação, tecnologia ou sonoridade,
  tipo de efeito) e pedais utilitários versáteis; conversa-alvo com pelo menos
  três Strats vintage para blues rock em estoque, de três marcas, e uma
  alternativa; `docs/FOTOS-PENDENTES.txt` com uma linha por foto nova; afinidade
  e "versátil"; "Compre junto" (cabo de instrumento para guitarra, patch e
  pedalboard ou afinador para pedal, efeito para pedalboard, gênero em comum
  para amplificador, no máximo dois itens sem repetição em todo o catálogo);
  seed no modo parcial (carrega quem tem foto, lista quem falta, completa depois
  sem duplicar, recusa pasta sem nenhuma foto) e mensagem do modo normal com
  todos os arquivos ausentes. Testes de aplicação, cache HTTP e PostgreSQL
  passaram a usar o tamanho do manifesto.
- No navegador (23 verificações novas): 75 produtos, primeira página com 24,
  "Mostrar mais" até exibir todos, foco no primeiro item novo, volta à primeira
  página ao trocar filtro; 16 atalhos de gênero na home abrindo o catálogo
  filtrado; montador com estilo Blues (8 de 17 guitarras, selo "Indicado para",
  estilo na URL, amplificadores indicados antes dos versáteis, escolha anterior
  preservada ao trocar de estilo, "Ver todas", link com estilo e item);
  "Compre junto" de pedal com cabo patch e pedalboard.
- Regressão completa (224 verificações em 11 roteiros, com as contagens
  atualizadas para 75 produtos), acessibilidade em claro, escuro, 375 e 1440 px
  (incluindo montador com estilo e catálogo após "Mostrar mais") e reflow em 320
  px, sem problemas.
- Só 6 itens de alto valor ficam com estoque baixo, para o selo "Últimas
  unidades" não perder o sentido.

---

# Fase 3, etapa 17 — 12/11/2026

- Testes novos em `tests/catalog-specs.test.js` (9): esquema cobre as seis
  categorias sem chaves repetidas; os 22 produtos têm ficha válida e coerente
  com a categoria; validação recusa campo de outra categoria, valor fora da
  lista, número fora da faixa e excesso de opções, e normaliza vazios e
  repetições; linhas exibidas ("15 W", "3 m", "Versátil"); busca pela ficha
  ("humbucker", "valvulado britânico", "guitarra vintage blues"); base de
  gêneros usa só valores do esquema, com um perfil por gênero e sinônimos sem
  ambiguidade; produto antigo recebe a ficha inicial na leitura e `null`
  explícito é respeitado; API lista e detalha com ficha, busca por atributo, e
  o painel recusa ficha inválida (400 com `field: "ficha"`), grava, preserva
  num PATCH sem ficha e limpa com ficha vazia.
- No navegador (19 verificações): filtros de estilo e gênero sem categoria;
  campos da categoria ao escolher Guitarras, mantendo o gênero; Blues rock +
  Humbucker = 1 item; trocar para Cabos descarta Captação; "Limpar tudo"; URL
  direta com `tecnologia=Valvulado` marca o filtro; ficha na página do produto
  com gêneros como links que abrem o catálogo filtrado; edição da ficha no
  painel gravada e lida de volta pela API.
- Auditoria de acessibilidade (claro, escuro, 375 e 1440 px), incluindo o
  catálogo com filtros da ficha, sem problemas; reflow em 320 px; regressão das
  etapas 13 a 16 (descoberta, interface, formulários, conta e qualidade) sem
  falhas.
- As fichas dos 22 produtos são atributos editoriais e precisam ser conferidas
  contra as fotos: `docs/PENDENCIAS-MANUAIS.txt`.

---

# Fase 2, etapa 16 — 10/11/2026

- Testes novos em `tests/http-cache.test.js`: negociação de codificação (com
  `q=0`), cache por tipo de arquivo, CSS em Brotli e página em gzip idênticos ao
  arquivo depois de descomprimidos, 304 com ETag, HEAD, fonte sem recompressão
  e com cache longo, caminhos com `..` recusados e JSON da API comprimido só a
  partir de 1 KB.
- Removidos o adaptador Azure (`src/repositories/storage.js`), os nomes de
  tabelas e contêiner Azure da configuração e o teste de contrato Azure; os
  testes importam `MemoryStorage` de `memory.js`. O `package-lock.json` foi
  ajustado como faria `npm uninstall`: os dois SDKs e 26 pacotes alcançáveis só
  por eles. O `npm ci` do CI confere a consistência.
- No navegador (10 verificações): CSS e JS em Brotli, manifesto sem erros,
  service worker controlando a página, instalável segundo o Chromium
  (`Page.getInstallabilityErrors` vazio), arquivos essenciais em cache, página
  visitada aberta sem servidor, página nunca aberta mostrando `offline.html`,
  volta ao site com o servidor de novo no ar e API fora do cache.
- Auditoria de acessibilidade com privacidade e termos (claro e escuro, 360 e
  1440 px), sem problemas; regressão completa das etapas 6 a 15 e falhas
  simuladas da API sem regressões.

## Medição local depois da compressão

Mesmas condições da etapa 13 (RTT 150 ms, 1,6 Mbps, CPU 4x, mediana de 3 cargas):

| Página | FCP | LCP | CLS | Transferido |
| --- | --- | --- | --- | --- |
| `/` | 0,9 s | 1,4 s | 0,000 | 79 KB |
| `/catalogo.html` | 0,9 s | 0,9 s | 0,000 | 79 KB |
| `/produto.html?id=demo-004` | 0,8 s | 1,9 s | 0,001 | 80 KB |
| `/carrinho.html` | 0,8 s | 0,8 s | 0,000 | 79 KB |
| `/ajuda.html` | 0,8 s | 0,8 s | 0,000 | 75 KB |

Antes da etapa, cada página transferia cerca de 200 KB e o FCP ficava entre 1,4 e
1,6 s.

---

# Fase 2, etapa 15 — 10/11/2026

- Testes novos em `tests/search-client.test.js`: distância de edição, correção
  só quando o termo não acha nada e a correção acha, prefixos curtos preservados
  e buscas recentes sem repetição, até cinco e com limpeza. Sitemap passa a
  incluir `setup.html`.
- No navegador (29 verificações): montador a partir da home, escolha única e
  múltipla, total, parcelas e frete grátis no resumo, salto entre etapas, item
  esgotado bloqueado, remoção pelo resumo, setup inteiro no carrinho, link
  compartilhado que ignora esgotados e inexistentes, setup pronto personalizável;
  "Compre junto" com total recalculado e só os itens marcados no carrinho;
  correção no catálogo e opção de buscar o termo exato; "Você quis dizer" nas
  sugestões; buscas recentes e limpeza; barra do setup no celular sem rolagem
  horizontal.
- Corrigido: sair e voltar rápido ao campo de busca fechava as sugestões recém
  abertas.
- Auditoria de acessibilidade com o montador, o "Compre junto" e as sugestões com
  correção (claro e escuro, 360 e 1440 px), sem problemas; regressão completa das
  etapas 6 a 14 sem falhas.

---

# Fase 2, etapa 14 — 10/11/2026

- Testes novos em `tests/account.test.js`: validação do endereço (CEP, UF e
  mensagens por campo), regras de principal e limite de cinco, paridade entre
  navegador e servidor, títulos das notificações de pedido e integração HTTP de
  endereços, "Avise-me" (item disponível recusado, repetição sem duplicar,
  procura no painel, disparo único na reposição e no cancelamento pela loja) e
  notificações (status pela loja, cancelamento do próprio cliente sem aviso,
  marcar uma e todas como lidas, contagem na sessão).
- Teste PostgreSQL novo (PGlite, no CI): tabelas novas na migração, aviso único
  por cliente e produto, reposição com falha desfeita por completo e reposição
  confirmada notificando uma única vez.
- No navegador (28 verificações): "Avise-me" de visitante com retorno ao produto
  após o cadastro, botão ativo no produto e no card, endereços (CEP formatado, UF
  sugerida, campos obrigatórios, principal, editar), checkout com endereço salvo
  e outro endereço, procura no painel, reposição e mudança de status gerando
  notificações, sino com contagem, marcar como lidas, adicionar ao carrinho a
  partir do aviso e contador na navegação inferior no celular.
- Auditoria de acessibilidade repetida com conta, formulário de endereço e
  produto esgotado com aviso (claro e escuro, 360 e 1440 px), sem problemas;
  regressão das etapas 6 a 13 sem falhas.

---

# Fase 2, etapa 13 — 10/11/2026

- Testes novos em `tests/states-client.test.js` (estados com título e alerta
  corretos, mensagem escapada, nova tentativa e saída; mensagens de validação) e
  pares de borda de campo (3:1) em `tests/theme.test.js`.
- Auditoria local no Chromium (árvore de acessibilidade via CDP e verificações no
  DOM), temas claro e escuro, 360 e 1440 px, em 25 telas e diálogos (home,
  catálogo, catálogo vazio, produto, esgotado, inexistente, favoritos, carrinho,
  ajuda, login, cadastro, 404, menu, visualização rápida, aviso do carrinho,
  minicarrinho, checkout, confirmação, conta e as três abas do painel): nenhum
  controle sem nome, nenhum texto abaixo de 4,5:1 (3:1 para texto grande, com
  cada parada dos gradientes), campos com borda de pelo menos 3:1, um `h1` por
  página sem saltos de nível, sem IDs duplicados, imagens com `alt` e alvos de
  toque de 24 px ou com espaçamento equivalente.
- Reflow sem rolagem horizontal em 320, 360 e 640 px (200% de zoom em 1280 px).
- Falha simulada da API (500) em home, catálogo, produto, favoritos, carrinho,
  checkout, conta e painel: nenhuma tela presa carregando; mensagem, nova
  tentativa e caminho de saída.
- Formulários (14 verificações): mensagens em português, foco no primeiro erro,
  validação ao sair do campo sem perder o clique em "Enviar", erro do servidor no
  formulário, quantidade fora do estoque e endereço obrigatório só na entrega.
- Corrigido: `ajuda.html` sem âncora exibia "Cannot read properties of undefined"
  no topo da página (erro desde a etapa 11).

## Medição local de desempenho

Chromium com limitação semelhante à do Lighthouse móvel (RTT 150 ms, 1,6 Mbps,
CPU 4x), 412 × 823 px, cache desligado, mediana de 3 cargas, app em memória sem
compressão HTTP. Não substitui o Lighthouse do site publicado.

Antes (início da etapa):

| Página | FCP | LCP | CLS | TBT aprox. | Transferido |
| --- | --- | --- | --- | --- | --- |
| `/` | 1,5 s | 1,5 s | 0,000 | 1001 ms | 203 KB |
| `/catalogo.html` | 1,6 s | 2,5 s | 0,226 | 770 ms | 204 KB |
| `/produto.html?id=demo-004` | 1,3 s | 2,8 s | 0,001 | 442 ms | 202 KB |
| `/carrinho.html` | 1,5 s | 2,2 s | 0,226 | 326 ms | 200 KB |
| `/ajuda.html` | 1,4 s | 1,4 s | 0,075 | 207 ms | 183 KB |

Depois (espaço do cabeçalho reservado, rodapé abaixo da dobra, `modulepreload`,
catálogo pedido no `<head>` e `content-visibility` abaixo da dobra na home):

| Página | FCP | LCP | CLS | TBT aprox. | Transferido |
| --- | --- | --- | --- | --- | --- |
| `/` | 1,6 s | 1,6 s | 0,000 | 497 ms | 204 KB |
| `/catalogo.html` | 1,4 s | 2,5 s | 0,000 | 280 ms | 205 KB |
| `/produto.html?id=demo-004` | 1,4 s | 2,3 s | 0,000 | 213 ms | 203 KB |
| `/carrinho.html` | 1,4 s | 1,4 s | 0,000 | 144 ms | 201 KB |
| `/ajuda.html` | 1,5 s | 1,5 s | 0,000 | 215 ms | 184 KB |

O peso transferido é sem compressão; compressão e cache HTTP ficam para a
etapa 16.

---

# Fase 2, etapa 12 — 10/11/2026

- Testes novos em `tests/theme.test.js`: contraste AA (4,5:1 para texto, 3:1 para
  o anel de foco) dos pares de tokens nos temas claro e escuro e presença de
  `theme-init.js` antes do CSS em todas as páginas.
- No navegador (Chromium, 360, 390, 768 e 1440 px, temas claro e escuro): tema
  automático segue o sistema, botão do cabeçalho alterna e persiste entre
  páginas, rodapé volta ao automático, menu móvel aplica o tema e o tema salvo
  já vale antes do `app.js` carregar; visualização rápida com estoque baixo e
  quantidade limitada; voo até o carrinho, aviso com o item, contagem e anúncio
  para leitores de tela, pausa com o cursor e retomada; "Ver carrinho" abre o
  minicarrinho; aviso acima da navegação inferior no celular; voltar ao topo;
  sombra do cabeçalho; avisos com barra de tempo. Regressão completa das etapas
  6 a 11 atualizada para o aviso e sem erros novos de console ou CSP.
- Corrigido: o cabeçalho não ficava fixo ao rolar porque o `position: sticky`
  estava limitado ao bloco `#header`.

---

# Fase 2, etapa 11 — 10/11/2026

- Teste PostgreSQL novo (PGlite, no CI): consultas por chave e índices únicos,
  pedido por `requestId`, histórico por cliente e cancelamento que devolve
  estoque na transação. Testes novos de `robots.txt`, `sitemap.xml` e do log de
  inicialização sem segredos.
- No navegador: busca e âncoras da central de ajuda, mostrar senha, validação
  ao sair do campo, indicador de força, telefone formatado e cadastro que volta
  ao checkout; regressão completa dos fluxos das etapas 6 a 10 sem erros novos.

---

# Fase 2, etapa 10 — 10/11/2026

- Testes novos em `tests/orders.test.js`: transições permitidas (com paridade
  do navegador), resumo do painel (ticket médio, status, estoque baixo, 14 dias)
  e integração HTTP de cancelamento pelo dono, idempotência sem devolver estoque
  duas vezes, bloqueios de transição e cancelamento pelo administrador.
- No navegador: conta com linha do tempo e indicadores, diálogo de confirmação
  com foco na opção segura, cancelamento, filtro, "Comprar novamente", painel
  com indicadores, gráfico, estoque baixo, busca, avanço de status e filtros;
  painel sem rolagem horizontal em 360 px.

---

# Fase 2, etapa 8 — 10/11/2026

- Produto no navegador (1440 e 360 px): relacionados, vistos recentemente,
  JSON-LD `Product` sem avaliações e sem violação de CSP, zoom ao passar o
  cursor, tela cheia com Escape, seletor de quantidade, tabela de parcelas,
  compartilhar (cópia do link), "Comprar agora" com a quantidade escolhida,
  produto inexistente com retorno ao catálogo e barra fixa que adiciona ao
  carrinho no celular; sem rolagem horizontal.

---

# Fase 2, etapa 9 — 10/11/2026

- Testes novos em `tests/pricing.test.js`: paridade das regras do navegador com
  o servidor, frete grátis, cupons (teto, mínimo, frete, inválidos), parcelas e
  integração HTTP de cotação e pedido com cupom e parcelas.
- No navegador (360 e 1440 px): progresso de frete grátis, cupom inválido com
  erro no campo, cupom aplicado, estimativa de entrega, salvar para depois com
  desfazer, checkout que reaplica cupom e entrega, pedido no cartão em 3x,
  confirmação e histórico com desconto e parcelas; sem rolagem horizontal.

---

# Fase 2, etapas 6 e 7 — 10/11/2026

- Revisão em Chromium nas larguras 360, 768 e 1440 px: home, catálogo,
  catálogo filtrado, produto, favoritos, carrinho, login, cadastro e 404, sem
  erros de console, sem violações de CSP e sem rolagem horizontal.
- Fluxos exercitados no navegador: sugestões da busca com teclado, minicarrinho
  (abrir, alterar quantidade, fechar com Escape), filtros por faceta e busca
  instantânea, estado vazio com limpeza, URL compartilhável com filtros e
  ordenação, favoritos com "Desfazer", setup da home, cadastro, checkout e
  histórico; no celular, painel de filtros, menu, busca e minicarrinho.
- A revisão usou o app em memória com o catálogo seed e as ilustrações SVG no
  lugar das fotos privadas. Lint e testes oficiais: CI do pull request.

---

# CI remoto — 10/11/2026

- Workflow **Qualidade**, execução #1 no commit `a136a39` de `main`: job
  `lint-and-test` aprovado (instalação com `npm ci`, lint e suíte completa,
  incluindo PostgreSQL via PGlite).
- A partir desta data, cada entrega segue por pull request e só entra em `main`
  com o CI verde. Os registros abaixo permanecem como histórico.

---

# Evolução de portfólio — 08/11/2026

## Evidência visual recebida do usuário

Dez capturas desktop mostram home, catálogo, essência/rodapé, produto, carrinho,
perfil, checkout, confirmação e histórico. Nos trechos apresentados, imagens
carregadas e layout sem sobreposições evidentes. O pedido da confirmação aparece
no histórico com o mesmo total; subtotal e frete exibidos são consistentes.
Isso documenta o caminho de sucesso mostrado, sem comprovar teclado, mobile,
filtros em ação, recuperação de falhas ou persistência após reiniciar o serviço.
As capturas contêm dados pessoais e não foram copiadas para o repositório.

Observações para revisão: linhas escuras em algumas imagens de correias e pouco
espaçamento entre campos dos filtros. Conferir a origem das linhas antes de
atribuir o problema ao CSS. Mobile/tablet e acessibilidade permanecem pendentes.

## Testes e limites

Atualização mobile: lint e suíte completa com 35 testes aprovados. Os dois
novos testes exercitam bloqueio de submissão repetida e recuperação após falha
com DOM/eventos simulados; não são testes em um navegador real. Ajustes CSS
mobile implementados, mas conferência visual em 360/390/768 px ainda pendente.
Navegação por teclado adiada pelo usuário nesta fase.

- Última execução completa: lint aprovado e 33 testes aprovados, zero falhas.
- Novos testes de cliente: quantidade inválida, excesso acumulado, armazenamento
  bloqueado, falha de rede, resposta não JSON e erros de formulário.
- Supabase: conexão TLS validada, estrutura criada e seed confirmado com 22
  produtos e 22 imagens legíveis em uma nova conexão.
- Render: autor confirmou funcionamento da versão migrada. As melhorias
  posteriores de interface permanecem locais, sem nova publicação confirmada.
- CI preparado em `.github/workflows/quality.yml`; execução remota pendente.
- Revisão visual desktop parcial realizada nas capturas acima. Responsividade,
  acessibilidade e medições de desempenho continuam pendentes. Não inferir
  aprovação visual dos testes automatizados.
- Os registros abaixo representam o estado histórico de cada execução.

---

# Migração PostgreSQL — 07/11/2026

- `npm run lint`: aprovado, saída 0.
- `npm test`: 28 testes aprovados, zero falhas. Execução com permissão de rede local para os testes HTTP.
- PostgreSQL via PGlite: migração repetível, 22 produtos/imagens, atualização por versão, conflitos e rollback de estoque/pedido e imagem.
- Integração HTTP com esse adaptador: autenticação, cookie HttpOnly, autorização, imagem binária, checkout e histórico.
- TLS configurado com validação de certificado; credenciais nunca registradas.
- Dependências atualizadas sem troca de versões principais. Auditoria após atualização: três alertas moderados na cadeia de desenvolvimento ESLint/minimatch; não aplicado `audit fix --force`.
- Supabase/Render reais ainda não verificados: dependem da criação do projeto e configuração privada de conexão. PGlite não verifica transporte TCP/TLS, persistência cloud ou concorrência entre várias instâncias.
- Nenhuma operação Git, publicação externa, alteração visual ou integração de agente nesta etapa. As observações visuais abaixo são históricas.

---
# Validação do catálogo com imagens

Atualização: 21/09/2026. Ambiente local: Windows, Node.js 24.11.1, armazenamento em memória. Nenhuma operação Git, conexão com Azure real ou publicação no Render foi realizada nesta atualização.

## Resultados

| Verificação | Resultado observado |
| --- | --- |
| `npm run lint` | Aprovado, saída 0 |
| `npm test` | 24 testes aprovados; 0 falhas |
| `npm run seed` em memória | 22 produtos criados; 22 imagens enviadas ao adaptador |
| Imagens de origem | 22 arquivos PNG válidos pelo cabeçalho; 3.281.878 bytes no total |
| `/api/health` | HTTP 200; `{ "status": "ok", "storage": "memory-development" }`; campo `payment` removido |
| Catálogo | 22 produtos; IDs `demo-001` a `demo-022` |
| Proxy de imagens | 22 respostas HTTP 200, `image/png`, conteúdo idêntico ao arquivo original em disco |
| Busca final em `public/` | Nenhuma ocorrência de `demonstr`, `simulad` ou `nenhuma cobrança` |
| Console do navegador | Nenhum erro/aviso capturado nas telas percorridas |
| Segredos | Nenhuma connection string ou credencial real utilizada, incluída em arquivo ou impressa |
| Arquivos privados | `seed-assets/produtos-violet-voltage/` incluído em `.gitignore`; originais preservados |

## Seed e testes automatizados

- Manifesto de 22 itens, seis categorias, IDs e caminhos únicos; estoques entre 5 e 30 e preços em centavos inteiros.
- Atualização dos oito IDs antigos em partições diferentes, sem criar duplicatas; preservação de `createdAt` e PartitionKey, atualização de `updatedAt`.
- Criação dos demais 14 registros, com nomes de blob determinísticos, MIME PNG e versão de URL derivada do conteúdo.
- Segunda execução mantém 22 produtos e 22 nomes de blob, atualizando os mesmos IDs.
- Produtos manuais e blobs manuais permanecem intactos, inclusive imagens antigas associadas a um produto seed.
- Pasta ausente, arquivo final ausente e PNG inválido são rejeitados antes de qualquer upload/cadastro.
- Duplicações antigas de uma RowKey entre partições são detectadas antes das gravações.
- Os 22 produtos e as 22 imagens continuam acessíveis por HTTP após repetir o seed.
- O contrato do adaptador Azure foi exercitado com clientes substitutos em memória. Isso não é validação de conectividade com Azure real.
- Os testes usam fixtures PNG temporárias e não dependem das imagens privadas ignoradas pelo Git.
- Mantidos os testes de autenticação, autorização, cookies, rate limit, CRUD, uploads administrativos, checkout, estoque, concorrência, compensação, idempotência de pedidos e páginas.

## Navegador

| Tela | Larguras verificadas | Resultado |
| --- | --- | --- |
| Catálogo | 360, 768, 1280 px | 22 cartões; sem transbordamento; imagens com `contain` e centralizadas |
| Produto | 360, 768, 1280 px | Guitarra inteira, carregada e centralizada; sem transbordamento |
| Carrinho | 360, 768, 1280 px | Miniaturas carregadas com `contain`; sem transbordamento |
| Checkout autenticado | 360, 768, 1280 px | Campos, resumo e opções Pix/Cartão/Boleto sem avisos removidos; sem transbordamento |

Foram exercitados filtro por categoria, detalhes da guitarra, adição ao carrinho, exigência de login, cadastro temporário, seleção de retirada/Pix, confirmação do pedido, carrinho limpo após confirmação, histórico com detalhes e logout. A confirmação mostrou **Pedido realizado com sucesso.** O histórico mostrou **Pagamento: pix**. A conta de teste foi criada somente na memória local, com senha aleatória não impressa. Não houve cobrança ou gateway financeiro.

As imagens do painel administrativo receberam miniatura na listagem e prévia no formulário de substituição, com tamanhos reservados, fundo claro, `contain` e centralização. O acesso administrativo e upload continuam cobertos pela suíte HTTP; não foi realizada sessão visual com administrador nesta atualização.

## Arquivos alterados/criados nesta atualização

- `.gitignore`.
- `src/services/seed.js` e novo `src/services/seed-products.js`.
- `scripts/seed.js` e `src/routes/api.js`.
- As nove páginas `public/*.html`: metadados; home e checkout também tiveram textos revisados.
- `public/js/app.js`, `public/js/common.js`, `public/js/admin.js`.
- `public/css/style.css`, `public/css/ui.css`.
- `tests/application.test.js`, novo `tests/seed.test.js` e novo `tests/helpers/seed-fixture.js`.
- `README.md`, `seed-assets/README.md`, `VALIDACAO.md`.

Os PNGs originais não foram editados nem copiados para `public`. Nenhuma dependência nova foi necessária. Não houve pesquisa externa de preços.

## Pendências externas

Para realizar o upload real, mantenha a pasta de imagens no computador, configure `AZURE_STORAGE_CONNECTION_STRING` e `JWT_SECRET` privadamente, defina `DEV_MEMORY_STORAGE=false` e execute `npm run seed`. A aplicação publicada deve usar a mesma conta Storage. Veja `seed-assets/README.md` para os comandos completos.

Ainda dependem das credenciais externas: criação/consulta dos recursos reais, permissões, persistência e upload/proxy no Azure e conferência do catálogo no Render. Os recursos permanecem `AllanRibeiroProdutos`, `AllanRibeiroClientes`, `AllanRibeiroPedidos` e `allan-ribeiro-produtos`.

O seed não roda automaticamente. Atualizações de Table e Blob não têm transação global: falhas remotas durante a carga exigem corrigir a causa e repetir o comando, que reutiliza os mesmos IDs. Reexecutar o seed restaura preços, estoque, imagens e dados dos IDs reservados; não altera produtos manuais com outros IDs.

