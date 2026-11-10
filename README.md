# Violet Voltage

[![Qualidade](https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce/actions/workflows/quality.yml/badge.svg)](https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce/actions/workflows/quality.yml)

**Site publicado:** <https://violet-voltage-ecommerce-1.onrender.com/>. No plano gratuito do Render, a primeira visita após um período sem acesso pode levar cerca de um minuto.

Consulte a [documentação consolidada](docs/DOCUMENTACAO-COMPLETA.md) para conhecer
funcionalidades, arquitetura, dependências instaladas e desenvolvimento planejado.

**Turn Up Your Tone** — loja acadêmica de instrumentos, preparada para portfólio. Sem cobranças, entregas ou vendas reais.

## Voltar ao ar

Siga [o guia Supabase + Render](docs/COLOCAR-NO-AR.md). O backend agora usa PostgreSQL e não depende do servidor do professor. O seed reconstrói os 22 produtos e imagens; sem exportação do banco antigo, clientes e pedidos anteriores não podem ser recuperados pelo código.

## Arquitetura

Node.js 24, Express 5, JavaScript ES modules e frontend HTML/CSS/JavaScript sem frameworks. Um serviço Express atende páginas e API. Autenticação própria com bcrypt e JWT em cookie HttpOnly; não exige Supabase Auth nem chaves Supabase no navegador.

PostgreSQL persiste produtos, clientes, pedidos e imagens no schema privado `violet_voltage`. Registros usam JSONB para preservar o contrato dos repositórios, com chaves e versões em colunas e restrições SQL. Esta migração não remodela todo o domínio em tabelas relacionais. As imagens usam `bytea`: as 22 fontes atuais somam aproximadamente 3,28 MB. A rota `/api/images/:id` serve os arquivos sem expor a conexão.

Checkout recalcula valores em centavos no servidor. Estoque e pedido são gravados em transação serializável com rollback e tentativas limitadas em conflitos de serialização. Atualizações usam versões para detectar concorrência; pedidos possuem unicidade por cliente e `requestId`.

| Caminho | Responsabilidade |
| --- | --- |
| `src/app.js`, `src/server.js` | Express, segurança e inicialização |
| `src/config/index.js` | Ambiente |
| `src/repositories/factory.js` | Seleção de PostgreSQL ou memória |
| `src/repositories/postgres.js` | Consultas parametrizadas, imagens e transações |
| `migrations/001-postgres.sql` | Estrutura idempotente, sem apagar registros |
| `src/routes/api.js` | API ativa |
| `src/services/` | Checkout, administrador e seed |
| `public/` | Interface |
| `tests/` | Regras, HTTP e PostgreSQL via PGlite |

O adaptador Azure e seus testes permanecem como legado; a fábrica ativa não o seleciona. Nenhuma credencial Azure é necessária.

## Execução

Instale com `npm ci`, configure `.env` a partir de `.env.example` conforme o guia e execute:

```powershell
$env:DEV_MEMORY_STORAGE='false'
npm run db:migrate
npm run seed
npm start
```

O seed exige os 22 PNGs locais descritos em `seed-assets/README.md`. Em PostgreSQL ele termina após a carga. Não execute em todo deploy: repetir restaura preços, estoques e dados de `demo-001` a `demo-022`.

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

Senha administrativa: 12 a 72 caracteres e até 72 bytes UTF-8. Bootstrap reaplica o administrador em cada inicialização. Login em `/login.html`, painel em `/admin.html`. Sem senha padrão; cadastro público sempre cria cliente. Nunca publique `.env` ou conexões privadas.

## Funcionalidades e API

Catálogo com filtros, carrinho, cadastro/login/perfil, histórico próprio, checkout demonstrativo e painel com produtos, imagens, clientes, pedidos e indicadores. Upload PNG/JPEG/WebP até 5 MB. Fretes em centavos: padrão 2500, expresso 4500, retirada zero.

Sucesso: `{ "data": ... }`. Erro: `{ "error": { "message": "...", "field": "..." } }`, campo `field` opcional.

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/health` | Público; consulta o banco, 503 se indisponível |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Público |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/products`, `/api/products/:id`, `/api/images/:id` | Público |
| PATCH | `/api/profile` | Autenticado |
| GET / POST | `/api/orders` | Histórico próprio / checkout |
| GET | `/api/admin/summary` | Admin |
| POST | `/api/admin/products` | Admin |
| PATCH / DELETE | `/api/admin/products/:id` | Admin |
| POST | `/api/admin/products/:id/image` | Admin, multipart campo `image` |
| GET / POST | `/api/admin/customers` | Admin |
| PATCH / DELETE | `/api/admin/customers/:id` | Admin |
| GET | `/api/admin/orders` | Admin |
| PATCH | `/api/admin/orders/:id` | Admin, campo `status` |

Filtros: `q`, `marca`, `modelo`, `categoria`, `min`, `max` (centavos). Checkout: `items: [{id, quantidade}]`, `pagamento`, `entrega`, `endereco`, `requestId`. Valores enviados pelo navegador são ignorados; repetir um pedido persistido com o mesmo identificador devolve esse pedido.

## Limites

- JWT de 8 horas, HttpOnly, SameSite=Lax e Secure em produção, com papel e cliente relidos no servidor. Logout expira o cookie, sem lista de revogação.
- Helmet, proteção de origem e limites de payload/autenticação. Não exponha `violet_voltage` pela Data API do Supabase.
- Exclusões lógicas preservam histórico; não equivalem a um fluxo completo de apagamento de dados pessoais.
- Cancelar pedido não repõe estoque automaticamente. Consultas ainda listam registros e filtram em memória, adequadas ao pequeno catálogo.
- Upload valida MIME e assinatura básica. Substituição administrativa de imagem não é uma transação global; falhas de limpeza podem deixar arquivos órfãos.
- Sem gateway, frete real, recuperação de senha, e-mail ou integração fiscal. Uma instância é suficiente para a demonstração.

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
