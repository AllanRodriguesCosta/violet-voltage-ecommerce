# Voltar ao ar: Supabase + Render

O código está preparado para PostgreSQL. Use seu serviço Render existente e um novo projeto Supabase. O seed reconstrói o catálogo; não recupera clientes e pedidos do banco inacessível do professor.

## 1. Criar o banco

1. Entre em https://supabase.com/dashboard.
2. Crie uma organização no plano **Free**, se ainda não tiver uma.
3. Em **New project**, selecione a organização e use o nome `violet-voltage`.
4. Gere uma senha forte para o banco e guarde-a privadamente. Ela é diferente da senha do administrador da loja.
5. Escolha uma região próxima do seu serviço Render e aguarde a criação.
6. Abra **Connect** e selecione **Session pooler**. Copie a URI PostgreSQL exibida, preservando host, usuário e porta. Esse modo suporta IPv4 e é apropriado para o servidor Express persistente.
7. Substitua `[YOUR-PASSWORD]` pela senha, em um editor privado. Caracteres reservados precisam de codificação de URL; não use um conversor online com sua senha.

Não crie tabelas manualmente, buckets ou usuários no Supabase Auth. Não precisamos de chaves `anon`/`service_role`. O código cria o schema `violet_voltage`; não o adicione aos schemas expostos pela Data API.

Referência: [conexões PostgreSQL no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Configurar e carregar localmente

Copie `.env.example` para `.env` pelo editor. Se o arquivo já existir, atualize apenas os campos necessários.

| Variável | Preencher com |
| --- | --- |
| `DATABASE_URL` | URI privada do passo anterior |
| `DATABASE_SSL` | `true` |
| `DEV_MEMORY_STORAGE` | `false` |
| `NODE_ENV` | `development` |
| `JWT_SECRET` | Segredo aleatório privado de pelo menos 32 caracteres |
| `ADMIN_EMAIL` | E-mail administrativo escolhido |
| `ADMIN_PASSWORD` | Senha privada de 12 a 72 caracteres, até 72 bytes UTF-8 |
| `ADMIN_NAME` | Nome do administrador |

`DATABASE_CA_CERT` pode ficar vazio se a cadeia do certificado já for confiável. Se a conexão apresentar erro de certificado, obtenha a CA oficial no painel de configurações do banco e configure o PEM completo nessa variável, entre aspas no `.env`. Ela aceita `\n` entre linhas. Não desative a validação TLS. [Documentação de SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).

Não envie `.env`, URL ou senha pelo chat. Confira as 22 imagens em `seed-assets/produtos-violet-voltage/` e execute na raiz do projeto:

```powershell
npm ci
$env:NODE_ENV='development'
$env:DEV_MEMORY_STORAGE='false'
npm run db:migrate
npm run seed
npm start
```

Pare se algum comando falhar. Variáveis já definidas no terminal têm prioridade sobre `.env`. A migração confirma a estrutura; o seed deve informar 22 produtos e 22 imagens. Repetir o seed restaura os estoques e preços do manifesto.

Abra `http://localhost:3000/api/health`: deve conter `data.storage: "postgresql"`. Confira home, imagens e login. Ctrl+C para parar; os dados permanecem no banco.

## 3. Atualizar o Render

1. Envie as alterações e `package-lock.json` ao seu GitHub pelo fluxo que você gerencia. Não envie `.env` ou imagens privadas.
2. Abra o **Web Service** existente no Render.
3. Configure **Build Command** `npm ci`, **Start Command** `npm start`, Node 24 e **Health Check Path** `/api/health`.
4. Em **Environment**, defina `NODE_ENV=production`, `DEV_MEMORY_STORAGE=false`, `DATABASE_SSL=true` e `NODE_VERSION=24`.
5. Configure privadamente `DATABASE_URL`, `JWT_SECRET` e as três `ADMIN_*`. Use o mesmo banco que recebeu o seed. Se necessário, inclua o PEM completo em `DATABASE_CA_CERT`.
6. Remova `AZURE_STORAGE_CONNECTION_STRING`, agora sem uso. Deixe o Render fornecer `PORT`.
7. Salve e publique a versão nova. `render.yaml` foi atualizado, mas serviços configurados manualmente precisam das mudanças no painel.
8. Na URL HTTPS publicada, abra `/api/health` e confirme `status: "ok"` e `storage: "postgresql"` dentro de `data`.
9. Confira catálogo, imagens, login, checkout demonstrativo e histórico. Reinicie o serviço e confirme a persistência.

As imagens estão no PostgreSQL e não dependem do disco do Render. Não coloque o seed em Build Command ou Start Command.

O Render gratuito adormece por inatividade e pode demorar no primeiro acesso. Confira o estado do projeto Supabase e os limites dos planos antes de apresentar o portfólio. Referências: [Render gratuito](https://render.com/docs/free), [Express no Render](https://render.com/docs/deploy-node-express-app).

## Diagnóstico

- Não conecta: confira projeto ativo, URI do **Session pooler**, senha/codificação e restrições de rede.
- Erro TLS: confira host e CA oficial. Não use `rejectUnauthorized: false` ou `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Catálogo vazio: seed não executado nesse banco ou modo memória ainda ativo.
- Seed não encontra imagem: confira subpastas, nomes e acentos do manifesto.
- Login administrativo falha: configure as três `ADMIN_*` e reinicie; bootstrap reaplica os dados.

Compartilhe apenas mensagens sanitizadas ao pedir ajuda, sem capturas de variáveis ou URI de conexão.
