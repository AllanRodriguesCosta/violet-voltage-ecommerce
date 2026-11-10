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

