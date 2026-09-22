# Violet Voltage

**Turn Up Your Tone** — e-commerce acadêmico de guitarras e equipamentos, com interface em português brasileiro. “Histórico de locações” foi interpretado como **histórico de compras**, conforme a orientação do professor. Nenhuma compra cobra dinheiro real.

## Tecnologias e arquitetura

Node.js 24, Express 5, JavaScript ES modules, HTML/CSS e JavaScript puro no navegador. Azure Table Storage (`@azure/data-tables`) persiste produtos, clientes e pedidos; Azure Blob Storage (`@azure/storage-blob`) recebe imagens. Autenticação própria com bcrypt, JWT em cookie HttpOnly, cookie-parser, Helmet e express-rate-limit. Upload com Multer em memória. Testes com `node:test`, lint com ESLint.

Um único processo Express serve API e arquivos de `public`. Controllers não distinguem memória de Azure: ambos implementam `list`, `get`, `create`, `save`, `upload`, `blob` e `removeBlob`. A criação do pedido fica em um serviço separado; validação e autorização são compartilhadas.

```text
src/
  app.js                 Express, segurança e erros
  server.js              Inicialização e porta
  config/                Ambiente e nomes Azure
  controllers/           Projeções de respostas públicas
  middleware/auth.js     Autenticação, administrador e projeção pública
  repositories/storage.js Adaptadores Azure e memória
  routes/api.js          Rotas REST e handlers
  services/              Checkout, bootstrap de administrador e seed
  utils/validation.js    Regras de entrada
public/
  index.html             Home e catálogo
  produto.html           Detalhes
  carrinho.html          Carrinho
  checkout.html          Checkout e confirmação
  login.html             Login
  cadastro.html          Cadastro
  minha-conta.html       Perfil e compras
  admin.html             Painel administrativo
  404.html               Página não encontrada
  css/                   Identidade visual e responsividade
  js/                    Módulos de interface
  assets/                SVGs originais locais
scripts/                 Execução do seed opcional
seed-assets/README.md    Orientações para imagens próprias/licenciadas
tests/                   Testes de regras e integração HTTP
.env.example             Somente exemplos públicos e campos vazios
.gitignore               Proteção de ambiente, dependências e arquivos locais
AGENTS.md                Convenções técnicas
render.yaml              Serviço único no Render
```

## Funcionalidades

- Catálogo pesquisável por texto, marca, modelo, categoria e intervalo de preço.
- CRUD administrativo de produtos e clientes, resumo de indicadores, histórico de cada cliente, consulta de pedidos e edição de status.
- Cadastro, login, logout, edição de nome/telefone/endereço e histórico de compras. E-mail é a chave de acesso e permanece imutável; não há recuperação de senha por e-mail nesta demonstração.
- Carrinho em localStorage contendo somente IDs e quantidades. Tokens nunca são armazenados no localStorage.
- Checkout autenticado, snapshots de itens, preço atual e estoque validados no backend; subtotal, frete e total em centavos inteiros.
- Pix, cartão e boleto **simulados**, sem coletar dados de cartão. Entrega padrão: R$ 25; expressa: R$ 45; retirada: grátis. Na retirada, use a indicação de retirada no campo de endereço.
- Upload/substituição de JPEG, PNG e WebP até 5 MB; MIME e assinatura básica conferidos no servidor, nomes aleatórios vinculados ao produto. Os SVGs locais não passam pela rota de upload.
- Interface responsiva, labels, foco visível, navegação por teclado, mensagens próximas aos campos, carregamento, listas vazias e confirmação de exclusão.

## Execução local sem Azure

Requisitos: Node.js 24 e npm. Instale as dependências:

```powershell
npm ci
```

Sem criar `.env`, habilite explicitamente o modo volátil no terminal PowerShell:

```powershell
$env:DEV_MEMORY_STORAGE='true'
npm run seed
```

Abra `http://localhost:3000`. Em memória, `npm run seed` adiciona oito produtos e mantém o servidor rodando no mesmo processo. Reiniciar apaga produtos, clientes, imagens e pedidos desse modo. O comando `npm start` inicia uma loja vazia em memória; `npm run dev` reinicia ao alterar o backend, também perdendo os dados voláteis. Não rode dois servidores na mesma porta.

O segredo de sessão local é aleatório, temporário, gerado somente em memória e nunca impresso. Sem `ADMIN_*`, não há administrador padrão nem senha fixa; cadastro público sempre cria `customer`. Para testar o painel, configure as três variáveis administrativas abaixo e reinicie. Testes automatizados criam seus próprios usuários e segredos descartáveis em memória, sem gravar ou exibir senhas.

## Configuração de ambiente

O projeto contém `.env.example`, não contém `.env`. Se desejar, copie o exemplo para `.env` e preencha localmente, em um editor privado. `.gitignore` foi criado antes do exemplo e ignora `.env`, `.env.*`, liberando apenas `.env.example`. Não inclua arquivos de ambiente, connection strings, chaves, SAS ou senhas em commits, screenshots, chats ou logs.

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development` local; `production` no Render |
| `PORT` | 3000 por padrão; o servidor respeita a porta do Render |
| `DEV_MEMORY_STORAGE` | `true` somente no desenvolvimento; `false` para Azure |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string real da conta Storage com acesso a Table e Blob |
| `JWT_SECRET` | Segredo privado aleatório com pelo menos 32 caracteres para Azure/produção |
| `ADMIN_EMAIL` | E-mail escolhido para o administrador |
| `ADMIN_PASSWORD` | Senha privada de 12 a 72 caracteres, até 72 bytes UTF-8 |
| `ADMIN_NAME` | Nome do administrador |

Preencha as três variáveis `ADMIN_*` em conjunto. O bootstrap cria ou atualiza esse usuário em cada inicialização, incluindo senha e papel. Para acessar: `/login.html`, depois `/admin.html`. Não há credencial embutida. O cadastro de clientes exige senha de 10 a 72 caracteres, limitada também a 72 bytes pelo bcrypt.

## Azure: recursos e conexão

Use uma conta Storage com endpoints de Blob e Table, normalmente StorageV2. Obtenha a connection string pelo portal Azure e configure-a apenas no ambiente privado. A conta precisa permitir criação das tabelas/contêiner e operações de leitura/escrita. Se houver firewall de rede, permita o acesso do ambiente de execução conforme as regras da sua conta.

Recursos fixos, sem nomes genéricos:

- `AllanRibeiroProdutos`: PartitionKey inicialmente categoria normalizada; RowKey UUID. A categoria pode mudar e a partição original permanece estável, evitando migração não atômica. Seed usa IDs determinísticos `demo-*`.
- `AllanRibeiroClientes`: PartitionKey `cliente`; RowKey e-mail normalizado. UUID público, perfil, hash de senha, papel, ativo e datas.
- `AllanRibeiroPedidos`: PartitionKey UUID do cliente; RowKey UUID do pedido; itens JSON com snapshots, preços em centavos, entrega, endereço, status e data.
- Contêiner `allan-ribeiro-produtos`: imagens de produtos. Nenhum outro contêiner é criado.

Ao iniciar, as tabelas e o contêiner são criados se não existirem, sem limpar os dados. Produtos só são incluídos pelo painel ou pelo seed opcional. Confirme `/api/health`: `storage` deve ser `azure`. **Produção recusa `DEV_MEMORY_STORAGE=true` e não faz fallback silencioso.**

### Imagens privadas

O contêiner permanece privado. Cada produto armazena `blobName` e `imageUrl`. A URL é `/api/images/:id`, um proxy de leitura que resolve apenas o blob do produto ativo; não aceita um caminho de blob fornecido pelo visitante, nem expõe connection string ou SAS. Assim a interface funciona mesmo com acesso público de blobs desabilitado. O proxy usa cache de 5 minutos e envia o tipo da imagem.

No painel, cadastre um produto e clique em **Imagem**. Ao substituir, o novo blob é gravado, a referência é atualizada com ETag e só depois o antigo é removido. Na exclusão do produto, o registro fica inativo para preservar histórico, e seu blob é removido. Não são feitas exclusões por prefixo ou de arquivos de outros produtos.

### Seed opcional

Com Azure configurado, execute `npm run seed` uma vez para adicionar os produtos genéricos. O comando encerra após o seed, preserva IDs existentes e não sobrescreve alterações. Para iniciar, execute `npm start`. O seed não é executado automaticamente em produção; execute-o conscientemente na conta desejada. Marcas fictícias, sem parcerias comerciais reais.

## API

Sucesso: `{ "data": ... }`. Erro: `{ "error": { "message": "...", "field": "..." } }`. `field` é opcional.

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/health` | Público |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Público; login/cadastro limitados |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/products`, `/api/products/:id`, `/api/images/:id` | Público |
| PATCH | `/api/profile` | Autenticado |
| GET / POST | `/api/orders` | Histórico próprio / checkout autenticado |
| GET | `/api/admin/summary` | Admin |
| POST | `/api/admin/products` | Admin |
| PATCH / DELETE | `/api/admin/products/:id` | Admin |
| POST | `/api/admin/products/:id/image` | Admin, multipart campo `image` |
| GET / POST | `/api/admin/customers` | Admin |
| PATCH / DELETE | `/api/admin/customers/:id` | Admin |
| GET | `/api/admin/orders` | Admin |
| PATCH | `/api/admin/orders/:id` | Admin, campo `status` |

Filtros de produtos: `q`, `marca`, `modelo`, `categoria`, `min`, `max` (intervalo em centavos). Checkout recebe `items: [{id, quantidade}]`, `pagamento`, `entrega`, `endereco` e `requestId` exclusivo. Valores monetários enviados pelo navegador são ignorados. Repetir `requestId` do mesmo cliente devolve o pedido já registrado.

## Segurança e limites reais

- JWT HS256 de 8 horas em cookie HttpOnly, SameSite=Lax e Secure em produção; o backend relê o cliente para aplicar desativação e papel atuais. Logout expira o cookie; não existe lista de revogação de tokens anteriormente copiados.
- Proteção de origem em mutações, Helmet/CSP com recursos locais, limite de payload, rate limit de 30 tentativas por 15 minutos compartilhado entre login e cadastro por IP. O proxy do Render é confiado em um salto; adapte se houver outra topologia.
- Exclusão de cliente é lógica: inativa o acesso, limpa perfil e hash, mas preserva e-mail como chave/tombstone e histórico dos pedidos, incluindo o endereço snapshot. Não equivale a um fluxo completo de apagamento de dados pessoais.
- Azure Table não oferece transação única envolvendo produtos de partições diferentes e pedidos de outra tabela. O serviço serializa checkout/edição de estoque no processo, usa ETags contra concorrência externa e tenta compensar estoque em falhas. Queda do processo, falha de rede ambígua ou falha na compensação pode exigir conciliação manual. **Use uma única instância** nesta demonstração; não é garantia financeira/distribuída de exatamente uma execução.
- Idempotência cobre pedidos já persistidos no mesmo processo/fluxo de serviço. Uma arquitetura distribuída de alta disponibilidade exigiria reservas duráveis e reconciliação.
- Cancelar pedido altera apenas o status; não devolve estoque automaticamente. O administrador confere e ajusta o estoque manualmente para evitar dupla reposição.
- Consulta de tabelas é simples, em memória após listagem; sem paginação ou índices adicionais. Indicadores não representam faturamento real. Adequado ao volume acadêmico, não a um catálogo massivo.
- Upload verifica MIME, tamanho e assinatura inicial, sem decodificação completa/antivírus. Falhas de rede na limpeza de blobs podem exigir revisão de arquivos órfãos.
- `/api/health` confirma processo iniciado e modo de armazenamento; não faz uma nova leitura Azure a cada chamada.
- Memória, rate limit e sessão com segredo temporário não persistem ao reiniciar. Produção usa somente Azure, sem arquivos locais persistentes.
- Nenhum gateway, frete real, envio de e-mail, recuperação de senha ou integração fiscal foi incluído.

## Testes e qualidade

```powershell
npm run lint
npm test
```

Os testes não usam Azure real. Cobrem validação, configuração de produção, seed idempotente, autenticação, autorização, cookie, CRUD, filtros, checkout, concorrência, imagens e páginas via HTTP. Consulte `VALIDACAO.md` para resultados observados e limites da verificação manual.

## Publicação no Render — um Web Service

1. O usuário prepara manualmente o repositório remoto e envia os arquivos do projeto. Nenhuma operação Git é necessária durante a execução da aplicação.
2. No Render, crie **New → Web Service**, conecte seu repositório e selecione a branch desejada. Alternativamente use um Blueprint com `render.yaml`.
3. Runtime: Node; Node 24; Root Directory: raiz do projeto; Build Command: `npm ci`; Start Command: `npm start`.
4. Configure `NODE_ENV=production` e `DEV_MEMORY_STORAGE=false`.
5. Configure `AZURE_STORAGE_CONNECTION_STRING`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` exclusivamente em Environment no painel. O Blueprint pode gerar `JWT_SECRET`. Não coloque valores secretos no YAML.
6. Health Check Path: `/api/health`. Mantenha uma única instância. Não crie Static Site separado, banco SQL ou disco persistente. Express escuta `0.0.0.0` e `process.env.PORT`.
7. Publique e abra `/api/health` pela URL HTTPS. Confira `storage: "azure"`. A inicialização deve criar somente os recursos listados acima.
8. Faça login como administrador e cadastre um produto com imagem; crie um cliente de teste, simule uma compra e confira estoque/pedido no Azure. Essa validação externa depende das suas credenciais e não foi executada automaticamente.
9. Se quiser o catálogo de demonstração, rode o seed opcional com as mesmas variáveis Azure em um ambiente privado autorizado. Não adicione seed ao build/start.

Referências oficiais: [Express no Render](https://render.com/docs/deploy-node-express-app), [health checks](https://render.com/docs/health-checks), [cliente Azure Table](https://learn.microsoft.com/en-us/javascript/api/%40azure/data-tables/tableclient?view=azure-node-latest).
