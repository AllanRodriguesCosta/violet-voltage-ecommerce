# Violet Voltage

[![Qualidade](https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce/actions/workflows/quality.yml/badge.svg)](https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce/actions/workflows/quality.yml)

**Site publicado:** <https://violet-voltage-ecommerce-1.onrender.com/>. No plano gratuito do Render, a primeira visita após um período sem acesso pode levar cerca de um minuto.

Consulte a [documentação consolidada](docs/DOCUMENTACAO-COMPLETA.md) para conhecer
funcionalidades, arquitetura, dependências instaladas e desenvolvimento planejado.

**Turn Up Your Tone** — loja acadêmica de instrumentos, preparada para portfólio. Sem cobranças, entregas ou vendas reais.

## Voltar ao ar

Siga [o guia Supabase + Render](docs/COLOCAR-NO-AR.md). O backend agora usa PostgreSQL e não depende do servidor do professor. O seed reconstrói o catálogo de 81 produtos e imagens; sem exportação do banco antigo, clientes e pedidos anteriores não podem ser recuperados pelo código.

## Arquitetura

Node.js 24, Express 5, JavaScript ES modules e frontend HTML/CSS/JavaScript sem frameworks. Um serviço Express atende páginas e API. Autenticação própria com bcrypt e JWT em cookie HttpOnly; não exige Supabase Auth nem chaves Supabase no navegador.

PostgreSQL persiste produtos, clientes, pedidos e imagens no schema privado `violet_voltage`. Registros usam JSONB para preservar o contrato dos repositórios, com chaves e versões em colunas e restrições SQL. Esta migração não remodela todo o domínio em tabelas relacionais. As imagens usam `bytea`: as 22 fontes originais somam aproximadamente 3,28 MB; com as 81 fotos principais e as 29 fotos extras da galeria (até 1 MB cada), o banco continua bem abaixo do limite do plano gratuito do Supabase. A rota `/api/images/:id` serve os arquivos sem expor a conexão.

Checkout recalcula valores em centavos no servidor. Estoque e pedido são gravados em transação serializável com rollback e tentativas limitadas em conflitos de serialização. Atualizações usam versões para detectar concorrência; pedidos possuem unicidade por cliente e `requestId`.

| Caminho | Responsabilidade |
| --- | --- |
| `src/app.js`, `src/server.js` | Express, segurança e inicialização |
| `src/config/index.js` | Ambiente |
| `src/repositories/factory.js` | Seleção de PostgreSQL ou memória |
| `src/repositories/postgres.js` | Consultas parametrizadas por chave e índices, imagens e transações |
| `src/repositories/memory.js` | Armazenamento volátil de desenvolvimento e testes |
| `migrations/001-postgres.sql` | Estrutura idempotente, sem apagar registros |
| `src/routes/api.js` | API ativa |
| `src/services/` | Preços, checkout, pedidos, administrador e seed |
| `public/` | Interface |
| `tests/` | Regras, HTTP e PostgreSQL via PGlite |

A aplicação usa `memory.js` (desenvolvimento e testes) ou `postgres.js` (produção). O antigo adaptador Azure e seus SDKs foram removidos; nenhuma credencial Azure é necessária.

## Execução

Instale com `npm ci`, configure `.env` a partir de `.env.example` conforme o guia e execute:

```powershell
$env:DEV_MEMORY_STORAGE='false'
npm run db:migrate
npm run seed
npm start
```

O seed exige os PNGs locais descritos em `seed-assets/README.md` (lista das fotos novas em `docs/FOTOS-PENDENTES.txt`; `npm run fotos:conferir` mostra o que falta e `npm run seed -- --parcial` carrega só os produtos com foto). Em PostgreSQL ele termina após a carga. Não execute em todo deploy: repetir restaura preços, estoques e dados de `demo-001` a `demo-080`.

Para demonstração temporária sem banco:

```powershell
$env:NODE_ENV='development'
$env:DEV_MEMORY_STORAGE='true'
npm run seed
```

Em memória, o próprio seed abre `http://localhost:3000`; reiniciar apaga todos os dados. Produção proíbe memória e não faz fallback silencioso.

## Ambiente

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development` local, `production` no Render |
| `PORT` | 3000 por padrão; Render fornece sua porta |
| `DEV_MEMORY_STORAGE` | `false` para PostgreSQL |
| `DATABASE_URL` | URI privada do Session pooler |
| `DATABASE_SSL` | `true`; produção exige TLS e validação do certificado |
| `DATABASE_CA_CERT` | CA PEM opcional; aceita quebras reais ou `\n` |
| `JWT_SECRET` | Segredo aleatório privado, pelo menos 32 caracteres |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Configure os três para criar/atualizar o administrador |
| `GEMINI_API_KEY` | Opcional: chave gratuita do Google AI Studio para o reforço do assistente; sem ela, só PLN local |
| `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `GEMINI_PER_MINUTE` | Opcionais: modelo (`gemini-flash-latest`), tempo limite (6000 ms) e chamadas por minuto (8) |

Senha administrativa: 12 a 72 caracteres e até 72 bytes UTF-8. Bootstrap reaplica o administrador em cada inicialização. Login em `/login.html`, painel em `/admin.html`. Sem senha padrão; cadastro público sempre cria cliente. Nunca publique `.env` ou conexões privadas.

## Funcionalidades e API

Home de descoberta, catálogo com busca instantânea e filtros com contagens (inclusive por estilo, gênero e ficha técnica de cada categoria) e resultados em páginas de 24, atalhos por estilo musical na home, página do produto com ficha técnica, sugestões de busca tolerantes a erros de digitação e buscas recentes, montador de setup com filtro por estilo musical e link compartilhável, "Compre junto" escolhido pela ficha (cabo certo, estilo parecido, orçamento), comparador de 2 a 4 produtos com link compartilhável, kits com desconto automático, avisos de compatibilidade no carrinho (cabo, amplificador, fonte de 9V, cabos patch, kit quase completo), comprovante do pedido com impressão, previsão de entrega e código de rastreio, serviços no carrinho (regulagem, troca de cordas e garantia estendida), guias de compra e glossário, filtros de mão, cordas e captadores, aviso de queda de preço, perguntas e respostas nos produtos (respondidas pelo painel), assistente de compras aberto a visitantes, com login só para pedidos, histórico e trocas (PLN local, sem custo: recomenda pelo estilo musical, monta setups, responde sobre a ficha do produto aberto, compara, confere o carrinho, adiciona e aplica cupom com confirmação, explica termos, sugere pelo histórico, encaminha trocas, conta o status dos pedidos e tira dúvidas da loja; entrada por voz e reforço opcional com o Gemini gratuito via `GEMINI_API_KEY`; ver [docs/ASSISTENTE.md](docs/ASSISTENTE.md)), troca ou devolução pelo comprovante, visualização rápida, favoritos, minicarrinho com aviso de item adicionado, tema claro/escuro/automático, cadastro/login/perfil, menu da conta no cabeçalho ("Olá, Nome": pedidos, dados e segurança, endereços, métodos de pagamento, avisos, favoritos, ajuda e sair) e Minha conta em seções com cartões, forma de pagamento preferida já marcada no checkout (sem guardar dados de cartão), troca de senha (encerra as outras sessões), cópia dos dados e exclusão da conta pelo próprio cliente, endereços de entrega, "Avise-me" para itens esgotados, notificações da conta, histórico próprio, checkout demonstrativo e painel com produtos, imagens, clientes, pedidos, perguntas e indicadores (vendas por categoria, mais vendidos, serviços, kits e interesse em preço). Upload PNG/JPEG/WebP até 5 MB. Fretes em centavos: padrão 2500 (grátis a partir de 99900 de subtotal), expresso 4500, retirada zero. Cartão em até 10x sem juros, com parcela mínima de 5000. Cupons de teste: `VOLTAGE10` (10% nos produtos, até R$ 500), `PRIMEIROACORDE` (R$ 30 a partir de R$ 200) e `FRETEVOLT` (frete padrão ou expresso grátis). Regras em `src/services/pricing.js`.

Galeria e cores (etapa 29): amplificadores com várias fotos (frente, painel de controles e traseira) num carrossel com setas, miniaturas, setas do teclado e arrastar no celular; nos modelos com mais de uma cor, bolinhas ao lado da foto trocam o carrossel para a cor escolhida, e a cor segue para o carrinho (onde pode ser trocada), o checkout, o pedido e o comprovante. O endereço `?cor=` mantém a escolha ao compartilhar. Cores e vistas por modelo ficam em `src/services/seed-gallery.js`.

Desempenho e instalação: arquivos de texto e respostas JSON comprimidos (Brotli ou gzip), cache HTTP por tipo de arquivo, manifesto com ícones e service worker de rede primeiro, que mantém as páginas já abertas disponíveis sem conexão. Páginas de privacidade e termos de uso no rodapé.

Acessibilidade: contraste AA verificado por teste nos dois temas, bordas de campos com 3:1, mensagens de erro em português ligadas aos campos, estados de carregamento, vazio e falha com nova tentativa e reflow até 320 px.

Sucesso: `{ "data": ... }`. Erro: `{ "error": { "message": "...", "field": "..." } }`, campo `field` opcional.

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/health` | Público; consulta o banco, 503 se indisponível |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Público |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/auth/session` | Público; usuário da sessão ou `null` |
| GET | `/api/products`, `/api/products/:id`, `/api/images/:id`, `/api/images/:id/:n` (foto `n` da galeria) | Público |
| GET / POST | `/api/products/:id/questions` | Público (só respondidas) / autenticado: `pergunta` de 10 a 500 caracteres, até 5 pendentes |
| PATCH | `/api/profile` | Autenticado |
| POST | `/api/checkout/quote` | Público; cotação sem gravar pedido |
| GET / POST | `/api/orders` | Histórico próprio / checkout |
| GET | `/api/orders/:id` | Autenticado; só o dono (comprovante, com `prazoTroca`), 404 para outro cliente |
| POST | `/api/orders/:id/troca` | Autenticado; `itens`, `tipo` ("troca" ou "devolucao") e `motivo` (10 a 500); pedido concluído há até 7 dias, uma solicitação aberta por vez |
| GET / POST | `/api/addresses` | Autenticado; endereços de entrega (até 5) |
| PATCH / DELETE | `/api/addresses/:id` | Autenticado; editar, tornar principal ou excluir |
| GET / POST | `/api/alerts` | Autenticado; `tipo` "estoque" (padrão, só itens esgotados) ou "preco" (avisa uma vez quando o preço cair) |
| DELETE | `/api/alerts/:productId` | Autenticado; `?tipo=preco` para o aviso de preço |
| POST | `/api/account/password` | Autenticado; `atual` e `nova` (10 a 72 caracteres); renova o cookie e invalida sessões anteriores |
| GET | `/api/account/export` | Autenticado; arquivo JSON com cadastro, endereços, pedidos, avisos e notificações |
| PATCH | `/api/account/payment` | Autenticado; `metodo` (`pix`, `cartao` ou `boleto`) e `parcelas` (1 a 10, só no cartão); guarda só a preferência, nunca dados de cartão |
| POST | `/api/account/delete` | Autenticado; `senha`; recusa com pedido em andamento (409); apaga dados pessoais e mantém pedidos sem eles |
| POST | `/api/assistente` | Público (sessão opcional; pedidos, histórico e trocas respondem pedindo login); `mensagem` (1 a 500 caracteres), `contexto` opcional devolvido pela resposta anterior e, opcionais, `pagina` (`tipo` e `id`), `carrinho` (IDs e quantidades) e `favoritos` (IDs), revalidados no servidor; 40 mensagens a cada 5 min por usuário ou, sem login, por endereço de rede |
| GET | `/api/notifications` | Autenticado; últimas 30 e contagem de não lidas |
| POST | `/api/notifications/read` | Autenticado; `ids` opcionais, sem eles marca todas |
| POST | `/api/orders/:id/cancel` | Autenticado; só o dono e só com status `Recebido` |
| GET | `/api/admin/summary` | Admin |
| POST | `/api/admin/products` | Admin |
| PATCH / DELETE | `/api/admin/products/:id` | Admin |
| POST | `/api/admin/products/:id/image` | Admin, multipart campo `image` |
| GET / POST | `/api/admin/customers` | Admin |
| PATCH / DELETE | `/api/admin/customers/:id` | Admin |
| GET | `/api/admin/orders` | Admin |
| PATCH | `/api/admin/orders/:id` | Admin, campo `status`; só transições válidas |
| PATCH | `/api/admin/orders/:id/troca` | Admin; `status` "Aprovada" ou "Recusada" e `resposta` opcional; notifica o cliente |
| GET / DELETE | `/api/admin/assistente` | Admin; frases não entendidas (anônimas, 90 dias), agrupadas / limpar |
| GET | `/api/admin/questions` | Admin; pendentes primeiro |
| PATCH | `/api/admin/questions/:id` | Admin; `resposta` (publica e notifica) ou `ocultar: true` |

Filtros: `q` (também busca na ficha técnica), `marca`, `modelo`, `categoria`, `min`, `max` (centavos). Produtos trazem `ficha` (objeto ou `null`), validada pelo esquema de `public/js/specs.js` quando enviada pelo painel. Checkout: `items: [{id, quantidade, servicos?}]` (`servicos`: "regulagem", "cordas", "garantia", conforme a categoria; regras em `public/js/services.js`), `pagamento`, `entrega`, `endereco`, `requestId` e, opcionalmente, `cupom` e `parcelas` (cartão). A cotação recebe `items`, `entrega` e `cupom` e devolve subtotal, desconto de kits (`descontoKitsCents`, `kits`; regras em `public/js/kits.js`), frete, desconto do cupom (sobre o valor já com os kits), total, parcelas máximas e opções de entrega. Valores enviados pelo navegador são ignorados; repetir um pedido persistido com o mesmo identificador devolve esse pedido.

## Limites

- JWT de 8 horas, HttpOnly, SameSite=Lax e Secure em produção, com papel e cliente relidos no servidor. Logout expira o cookie, sem lista de revogação.
- Helmet, proteção de origem e limites de payload/autenticação. Não exponha `violet_voltage` pela Data API do Supabase.
- Exclusões lógicas preservam histórico; não equivalem a um fluxo completo de apagamento de dados pessoais.
- Status seguem Recebido → Em preparação → Enviado → Concluído (pode pular etapas, não volta). Cancelamento só até a preparação, devolve os itens ao estoque e é definitivo. Consultas ainda listam registros e filtram em memória, adequadas ao pequeno catálogo.
- Upload valida MIME e assinatura básica. Substituição administrativa de imagem não é uma transação global; falhas de limpeza podem deixar arquivos órfãos.
- Sem gateway, frete real, recuperação de senha, e-mail ou integração fiscal. Uma instância é suficiente para a demonstração.
- `robots.txt` e `sitemap.xml` são gerados pelo servidor com o endereço da requisição; páginas privadas usam `noindex`. Produto, catálogo por categoria e início saem do servidor com título, descrição, Open Graph, canônico e dados estruturados (`src/http/seo.js`).
- Falhas de inicialização registram a causa (mensagem de configuração ou código do erro) sem valores secretos.

## Validação e evolução

O workflow `.github/workflows/quality.yml` executa lint e testes em Node 24
para pushes e pull requests destinados a `main`, sem segredos de produção.
A primeira execução remota foi aprovada em 10/11/2026; cada pull request passa
pelo mesmo workflow antes do merge.
Referências das actions: [checkout](https://github.com/actions/checkout) e
[setup-node](https://github.com/actions/setup-node).

Veja o [roteiro de demonstração](docs/DEMONSTRACAO.md) para apresentar os fluxos
e o painel administrativo com dados fictícios.
O [estudo de caso](docs/ESTUDO-DE-CASO.md) descreve arquitetura, decisões da
migração, evidências e limitações da implementação.

```powershell
npm run lint
npm test
```

Testes usam dados descartáveis e PostgreSQL local em WASM (PGlite), sem credenciais cloud ou PNGs privados. Cobrem seed, versões, rollback e integração HTTP; não substituem a conexão TCP/TLS com Supabase. Resultados em `VALIDACAO.md`.

Próximas entregas e critérios estão no [roadmap](docs/ROADMAP.md): primeiro a experiência de loja completa (Fase 2), depois os agentes.
