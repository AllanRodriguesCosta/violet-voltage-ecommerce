# Violet Voltage — documentação consolidada

Atualização: 10/11/2026. Este documento descreve o código atual e o planejamento;
funcionalidade implementada não significa revisão visual ou publicação concluída.

## Objetivo e limites

Portfólio full stack de uma loja de instrumentos musicais. O fluxo registra
pedidos demonstrativos, sem cobrar, entregar produtos ou integrar serviços fiscais.
Não há avaliações, estrelas, gateway, recuperação de senha ou agentes ativos.
Dados do banco antigo do professor não foram recuperados: o catálogo foi
reconstruído com 22 produtos e imagens locais.

## Arquitetura e arquivos

Express serve API e arquivos estáticos no mesmo serviço Render. HTML, CSS e
JavaScript ES modules compõem o frontend, sem framework ou build obrigatório.
O backend conecta ao PostgreSQL Supabase por TLS; o navegador nunca recebe a
conexão do banco. A autenticação continua própria, sem Supabase Auth.

| Local | Responsabilidade |
| --- | --- |
| `src/server.js`, `src/app.js` | Inicialização, Express, middleware e tratamento de erros |
| `src/config/index.js` | Validação de ambiente, TLS e modo de armazenamento |
| `src/routes/api.js` | Rotas ativas de catálogo, sessão, pedidos e administração |
| `src/middleware/auth.js` | Autenticação e autorização |
| `src/controllers/serialization.js` | Projeções públicas das entidades |
| `src/services/checkout.js` | Itens, estoque e idempotência do pedido |
| `src/services/pricing.js` | Frete, frete grátis, cupons, parcelas e opções de entrega |
| `src/services/orders.js` | Transições de status, cancelamento com devolução de estoque e resumo do painel |
| `src/services/addresses.js` | Validação e regras dos endereços de entrega (até 5, um principal) |
| `src/services/notifications.js` | Notificações da conta e avisos "Avise-me" disparados na reposição |
| `src/services/bootstrap.js` | Criação/atualização privada do administrador |
| `src/services/seed*.js` | Manifesto e carga dos 22 produtos/imagens |
| `src/repositories/factory.js`, `postgres.js` | Seleção de backend e persistência PostgreSQL |
| `src/repositories/memory.js` | Armazenamento volátil de desenvolvimento e testes |
| `src/http/static.js` | Compressão Brotli/gzip de arquivos e JSON e cache HTTP por tipo de arquivo |
| `src/utils/startup-error.js` | Mensagem de falha na inicialização sem segredos |
| `migrations/001-postgres.sql` | Estrutura idempotente do schema privado, incluindo `alerts` e `notifications` |
| `public/js/common.js` | API cliente, sessão, formulários, carrinho, favoritos, avisos e layout comum |
| `public/js/app.js` | Entrada: tema, cabeçalho, minicarrinho, busca e carregamento da página |
| `public/js/theme-init.js`, `theme.js` | Tema aplicado antes da primeira pintura; seletores claro, escuro e automático |
| `public/js/motion.js`, `quickview.js` | Voo até o carrinho, voltar ao topo, sombra do cabeçalho e visualização rápida |
| `public/js/pages/` | Home, catálogo, montador de setup, favoritos, produto, carrinho, checkout, conta e acesso |
| `public/js/components.js`, `drawer.js`, `search.js`, `icons.js` | Cards, minicarrinho e aviso de item adicionado, sugestões de busca e ícones SVG |
| `public/js/admin.js` | Painel administrativo |
| `public/fonts/` | Fonte Geist (licença OFL) servida pelo próprio site |
| `public/sw.js`, `manifest.webmanifest`, `offline.html`, `icons/` | Service worker de rede primeiro, manifesto, página sem conexão e ícones do app |
| `public/css/` | Base visual, componentes e regras responsivas |
| `tests/` | Testes de domínio, HTTP, PostgreSQL e cliente simulado |
| `.github/workflows/quality.yml` | CI de lint e testes em cada push e pull request |

Os pontos de entrada ativos são `src/server.js` (servidor), `scripts/seed.js` e
`scripts/migrate.js`.

## Capacidades existentes

### Aparência e interação

Tema claro, escuro ou automático (segue o sistema), escolhido no cabeçalho, no
menu ou no rodapé e salvo no navegador. `theme-init.js` aplica a escolha antes
das folhas de estilo para a página não piscar; a troca usa uma revelação
circular quando o navegador suporta View Transitions. Cores vêm de tokens, e um
teste confere o contraste AA dos pares usados nos dois temas. Ao adicionar um
produto, a imagem segue até o ícone do carrinho e um aviso compacto, que pausa
com cursor ou foco, mostra o item, o frete grátis e atalhos; o minicarrinho abre
só quando pedido. Os cards têm visualização rápida em diálogo (folha inferior no
celular). Animações respeitam `prefers-reduced-motion`.

### Conta, avisos e notificações

O cliente guarda até cinco endereços de entrega no próprio cadastro
(`enderecos`), com CEP formatado, UF sugerida pelo CEP no navegador e um
endereço principal; o checkout oferece os salvos, o endereço do cadastro e a
opção de digitar outro. Em itens esgotados, "Avise-me" cria um aviso por cliente
e produto (tabela `alerts`). Quando o estoque volta, pelo painel ou pelo
cancelamento de um pedido, cada aviso pendente vira uma notificação (tabela
`notifications`) uma única vez, na mesma transação da reposição. Mudanças de
status feitas pela loja também notificam o cliente. A sessão traz a contagem de
não lidas para o sino do cabeçalho e para a navegação inferior, e o painel mostra
quantos clientes esperam cada item esgotado.

### Desempenho e instalação

`src/http/static.js` comprime com Brotli (ou gzip) os arquivos de texto de
`public/` uma vez por versão do arquivo e as respostas JSON da API a partir de
1 KB, sempre com `Vary: Accept-Encoding`. HTML, CSS, JS e o manifesto revalidam a
cada visita com ETag (304 quando nada mudou), a fonte fica 30 dias em cache e as
imagens, 7 dias. O manifesto e os ícones tornam o site instalável; `public/sw.js`
busca primeiro na rede e guarda uma cópia de cada página e arquivo estático
(páginas sem a query), para que o que já foi aberto funcione sem conexão. Páginas
nunca abertas mostram `offline.html`. A API não passa pelo service worker.

### Acessibilidade e estados

`components.js` concentra os estados de vazio, falha, sucesso e informação
(`stateHTML`, `emptyState`, `errorState`): o título usa o nível certo da página e
só falhas recebem `role="alert"`; toda falha oferece nova tentativa ou um caminho
de saída. `bindForm` troca os balões nativos por mensagens em português ligadas
ao campo (`aria-invalid` e `aria-describedby`), valida ao sair de um campo
preenchido e leva o foco ao primeiro erro. O cabeçalho tem a altura reservada
antes do JavaScript e o rodapé começa abaixo da dobra, o que zera o deslocamento
de layout medido.

### Descoberta e conversão

`setup.html` guia a montagem de um setup em seis etapas por categoria (seleção
única para guitarra, amplificador e correia; múltipla para efeitos, cabos e
acessórios). O resumo mostra total, parcelas e progresso de frete grátis com as
mesmas regras do servidor, e a URL (`?itens=`) recria o setup em outro
aparelho, ignorando itens esgotados ou inexistentes. Na página do produto,
"Compre junto" sugere o item mais acessível de categorias complementares. A busca
corrige termos sem resultado pela palavra mais próxima do catálogo (distância de
edição com transposição) e guarda as cinco últimas buscas neste navegador.

### Catálogo e produto

A home funciona como vitrine de descoberta: categorias com contagem, destaques,
setups prontos que entram no carrinho de uma vez e vistos recentemente. A página
`catalogo.html` concentra os resultados: busca instantânea sem diferenciar
acentos, filtros por categoria, marca, faixa de preço e disponibilidade (com
contagens), ordenação, parâmetros preservados na URL, filtros removíveis,
limpeza completa e nova tentativa em falha. O cabeçalho sugere produtos e
categorias enquanto se digita. Favoritos e vistos recentemente ficam no
navegador. Produto mostra imagem inteira com zoom e
tela cheia, descrição, marca, modelo, categoria, preço, parcelas, disponibilidade,
prazos de entrega, relacionados, vistos recentemente, compartilhamento,
"Comprar agora", barra de compra fixa no celular e dados estruturados
schema.org `Product` (sem avaliações). Produto inválido tem retorno
ao catálogo. Não há dados técnicos inventados para preencher especificações.

### Carrinho e checkout

Carrinho local guarda IDs e quantidades. Adição verifica quantidade inteira,
limite de 99 e estoque acumulado; falha de armazenamento não anuncia sucesso.
Remoção e alteração de quantidade possuem mensagens de erro. Checkout exige
sessão e espera carregar os dados antes de liberar confirmação.

O servidor relê produtos e recalcula valores em centavos com um único módulo de
preços (`src/services/pricing.js`), usado pela cotação `POST /api/checkout/quote`
e pelo pedido: frete padrão 2500 (grátis a partir de R$ 999 de subtotal),
expresso 4500 e retirada zero; cupons `VOLTAGE10`, `PRIMEIROACORDE` e
`FRETEVOLT`; cartão em até 10x sem juros com parcela mínima de R$ 50. O carrinho
mostra progresso para frete grátis, estimativa de entrega e cupom; o checkout
tem seções de entrega, pagamento e cupom com resumo fixo. Pix/cartão/boleto são opções demonstrativas;
nenhum dado de cartão é coletado. Pedido e estoque compartilham transação
serializável no PostgreSQL. Repetir requestId do mesmo cliente devolve o pedido
já registrado. Falhar ao limpar o carrinho depois do sucesso não oculta o pedido.

### Conta e administração

Cadastro, login/logout, perfil e histórico privado. Cadastro público não cria
administrador. O backend relê o usuário para considerar papel e desativação.
Minha conta mostra indicadores, filtros e a linha do tempo de cada pedido, com
"Comprar novamente" e cancelamento enquanto o pedido está "Recebido". O painel
mostra volume, pedidos, ticket médio, pedidos por status, vendas dos últimos 14
dias e estoque baixo, com busca e filtros. Status só avançam no fluxo; o
cancelamento, permitido até a preparação, devolve os itens ao estoque na mesma
transação do pedido. Exclusões são lógicas para preservar histórico. Não há modo público de edição nem conta admin compartilhada.

### Ajuda e acesso

`ajuda.html` reúne perguntas frequentes sobre pedidos, entregas, pagamentos,
cupons, trocas e conta, com busca. Login e cadastro oferecem mostrar senha,
indicador de força, validação ao sair do campo e retorno ao destino (por exemplo,
o checkout). O servidor gera `robots.txt` e `sitemap.xml`.

### Interface e recuperação

Home com identidade roxa, hero musical e seção de marca. Menu mobile, filtros
recolhíveis, layouts de uma/duas colunas conforme largura, inputs de 16 px,
controles maiores e tratamento de textos longos. Feedback de carregamento,
vazio e erro existe nos principais fluxos. Falha de sessão por rede é distinta
de visitante não autenticado. Formulários bloqueiam submissões simultâneas.

## Persistência e segurança

Schema `violet_voltage`: `products`, `customers`, `orders` e `images`. Registros
usam JSONB e colunas para chave/partição/versão. Índices únicos abrangem ID público
de cliente e requestId por cliente. Imagens ficam em bytea, com limite de 5 MB
por arquivo, servidas por `/api/images/:id`. Essa escolha atende ao pequeno seed;
não representa uma solução proposta para mídia de grande escala.

Queries parametrizadas e lista fixa de tabelas; versões contra atualização
concorrente; transação com rollback e tentativas limitadas em serialização.
Bcrypt para senhas; JWT em cookie HttpOnly, SameSite=Lax e Secure em produção;
Helmet, verificação de origem, limite de payload e rate limiting. Não existe
garantia de exatamente uma execução sob toda falha distribuída. Exclusão de
perfil não equivale a um processo completo de apagamento de dados pessoais.

## Bibliotecas já declaradas

Faixas abaixo são as do package.json; package-lock.json fixa a resolução usada.
Para instalar todas de forma reproduzível, usar `npm ci`.

| Pacote | Faixa | Uso |
| --- | --- | --- |
| express | ^5.1.0 | Servidor HTTP e rotas |
| pg | ^8.23.1 | Cliente PostgreSQL e pool |
| bcryptjs | ^3.0.2 | Hash de senhas |
| jsonwebtoken | ^9.0.2 | Tokens de sessão |
| cookie-parser | ^1.4.7 | Cookies |
| dotenv | ^17.2.0 | Ambiente local |
| helmet | ^8.1.0 | Cabeçalhos de proteção |
| express-rate-limit | ^8.1.0 | Limitação de requisições |
| multer | ^2.0.2 | Recepção de imagens |
| @electric-sql/pglite | ^0.5.15 | PostgreSQL WASM para testes isolados |
| eslint | ^10.11.0 | Análise estática |
| globals | ^16.4.0 | Globais do ESLint |
| prettier | ^3.9.8 | Formatação |

Ferramentas: Node.js 24 recomendado, npm, testes nativos node:test, navegador,
editor, Git/GitHub para versionamento, GitHub Actions para CI, Render para
aplicação e Supabase para banco. Os serviços cloud são contas/configurações,
não programas que precisam ser instalados localmente. PostgreSQL local e Docker
não são necessários para a suíte atual. Git é operado somente com autorização.

## O que ainda precisa ser instalado ou escolhido

- Roadmap 1, experiência atual: nenhuma nova biblioteca obrigatória identificada.
  As pendências mobile/interação podem ser resolvidas com a stack existente.
- Medições futuras: ferramentas do navegador; automação de browser ou auditoria
  adicional só será selecionada quando necessária, sem pacote prometido agora.
- Agentes: provedor/modelo, SDK opcional e eventuais ferramentas de avaliação
  ainda não escolhidos. Consultar limites e custos na etapa de especificação.
  Não instalar LangChain, SDK de IA, banco vetorial ou serviço extra por antecipação.
- Roadmap 2: busca fixa, navegação inferior e lista de desejos não exigem por si
  só novo framework; decidir dependências após aprovar o desenho e persistência.

## Execução, configuração e testes

`npm ci` instala; `npm run dev` inicia com observação; `npm start` inicia servidor;
`npm run db:migrate` cria/verifica estrutura; `npm run seed` carrega catálogo;
`npm run lint` e `npm test` validam o código.

Ambiente privado: NODE_ENV, PORT, DEV_MEMORY_STORAGE, DATABASE_URL, DATABASE_SSL,
DATABASE_CA_CERT, JWT_SECRET e ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME. Consulte
`.env.example` sem valores reais. Nunca versionar `.env` ou fontes privadas.
Modo memória é descartável e deve servir às demonstrações sem alterar produção.
Reexecutar seed cloud restaura preços/estoques dos IDs reservados.

Passo a passo: [publicação](COLOCAR-NO-AR.md). Contexto: [estudo de caso](ESTUDO-DE-CASO.md).
Apresentação: [demonstração](DEMONSTRACAO.md). Evidências: [validação](../VALIDACAO.md).

## Estado e trabalho planejado

| Etapa | Implementado/preparado | Ainda pendente |
| --- | --- | --- |
| 1 — Visual | Home, marca, componentes; capturas desktop e mobile parciais revisadas | Conferir todas as telas/larguras e corrigir problemas observados |
| 2 — Catálogo | Busca, ordenação, URL, filtros, produto, disponibilidade | Exercitar combinações, recarga, falhas e produto indisponível no browser |
| 3 — Mobile | Layouts, filtros recolhíveis, toque e quebra de conteúdo | Checkout/conta mobile e redimensionamento; teclado adiado pelo usuário |
| 4 — Fluxos | Feedback, recuperação de rede, confirmação e testes simulados | Validar fluxos completos de erro em navegador e produzir apresentação admin |
| 5 — Técnica | CI aprovado no GitHub, README, estudo de caso e roteiro | Capturas fictícias e medições |

Agentes posteriores: primeiro, assistente de descoberta com consulta ao catálogo
real e ferramentas somente de leitura. Definir contratos, limites, custo, dados
permitidos, fallback e avaliações antes de implementar. Segundo agente opcional:
qualidade do catálogo para administrador, inicialmente só sugestões; qualquer
escrita futura exige revisão e autorização backend. Nenhum agente está instalado.

Fase 2 do [roadmap](ROADMAP.md), em andamento: amplia o antigo Roadmap 2
(descoberta separada dos resultados, cards ricos, lista de desejos, busca fixa e
navegação inferior) com sistema visual, regras de preço no servidor e ciclo de
vida dos pedidos. Não inclui notas, estrelas ou avaliações.

## Limites das evidências

Capturas mostram sucesso até histórico em desktop e home/catálogo em mobile,
mas não comprovam todas as interações, falhas, larguras ou desempenho. Testes
de cliente usam simulação de DOM/rede; PGlite não valida infraestrutura cloud.
O CI remoto está aprovado desde 10/11/2026. O roadmap público registra
implementação separadamente de revisão; o arquivo local detalhado é ignorado.
