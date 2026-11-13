# Load balancer no Violet Voltage: precisa? Como usar?

Resumo para o Allan (etapa 32). Para o passo a passo do Azure, veja
[AZURE-LOAD-BALANCER.md](AZURE-LOAD-BALANCER.md). Para o Codex, veja
[CODEX-LOAD-BALANCER.txt](CODEX-LOAD-BALANCER.txt).

## 1. Precisa?

**Não, para o site funcionar.** O Render roda uma instância e dá conta de um projeto acadêmico.
Nada no dia a dia muda: `npm start`, `npm run dev` e o deploy no Render continuam iguais.

**Sim, só se a atividade pedir** ("publique no Azure com load balancer", "mostre alta
disponibilidade", "escale horizontalmente"). Para esse caso, tudo já está pronto em três níveis:

| Nível | Onde | Precisa de | Tempo | Para quê |
| --- | --- | --- | --- | --- |
| 1. Balanceador local em Node | Seu computador | Só Node (já tem) | 1 min | Entender, ensaiar e mostrar ao vivo sem internet |
| 2. Docker Compose + Nginx | Seu computador | Docker Desktop | 5 min | O mesmo desenho "de verdade": 3 contêineres, Nginx e PostgreSQL |
| 3. Azure for Students | Nuvem | Conta Azure for Students | 15 a 30 min | Entregar a atividade com URL pública |

## 2. O que é, em uma frase

Um balanceador recebe todos os acessos e reparte entre várias cópias iguais da loja. Se uma
cópia cai, ele para de mandar acessos para ela e o cliente nem percebe.

```
navegador -> balanceador -> local-1 / local-2 / local-3 -> o mesmo banco
```

O Violet Voltage já foi preparado para isso (etapa 31): login por token (qualquer cópia
reconhece), carrinho no navegador, `/api/health` para o balanceador saber quem está bem, cabeçalho
`X-Served-By` mostrando qual cópia respondeu e travas para várias cópias subirem juntas.

## 3. Nível 1: balanceador local (sem instalar nada)

Na raiz do projeto:

```bash
npm run lb:local
```

Ele sobe 3 cópias da loja (portas 3001, 3002 e 3003) e o balanceador em
**http://localhost:8080**. Abra esse endereço no navegador: é a loja normal.

Em outro terminal, prove o rodízio:

```bash
npm run azure:lb-check -- http://localhost:8080 30
# local-1 10 (33%) / local-2 10 (33%) / local-3 10 (33%) -> Balanceamento OK
```

No terminal do balanceador, digite:

| Comando | O que faz |
| --- | --- |
| `status` | Mostra cada cópia, se está saudável e quantos pedidos atendeu |
| `parar 2` | Derruba a cópia 2 (simula um servidor caindo). Em até 4 s ela sai do rodízio |
| `iniciar 2` | Sobe a cópia 2 de novo. Ela volta sozinha ao rodízio |
| `sair` (ou Ctrl+C) | Encerra tudo |

Opções: `npm run lb:local -- --instancias 2 --porta 9000 --memoria`.

**Com banco ou em memória?**

- Se o `.env` tem `DATABASE_URL`, as 3 cópias usam esse banco. É o comportamento certo.
  Cuidado: se for o banco do Supabase/Render, tudo que você criar aparece no site publicado.
- Sem `DATABASE_URL` (ou com `--memoria`), cada cópia guarda os próprios dados. Uma conta criada
  numa cópia não existe nas outras. Isso **é útil na apresentação**: mostra por que o banco
  precisa ser compartilhado. Depois mostre o nível 2 ou 3, em que o banco é único.

`http://localhost:8080/__balanceador` mostra o estado das cópias em JSON.

## 4. Nível 2: Docker Compose + Nginx (opcional)

Precisa do Docker Desktop aberto. Na raiz:

```bash
npm run lb:docker                                   # constrói e sobe tudo em segundo plano
npm run azure:lb-check -- http://localhost:8080 30  # 3 contêineres respondendo
docker compose -f infra/local/docker-compose.yml ps # lista as cópias
docker stop <nome-de-uma-copia>                     # derruba uma; as outras seguem
npm run lb:docker:parar                             # desliga tudo (mantém o banco local)
docker compose -f infra/local/docker-compose.yml down -v   # desliga e apaga o banco local
```

O que sobe (`infra/local/docker-compose.yml`):

- `db`: PostgreSQL 17 local, só para teste (não toca no Supabase);
- `app` × 3: a mesma imagem do `Dockerfile`, todas no mesmo banco e com o mesmo `JWT_SECRET`;
- `balanceador`: Nginx em `localhost:8080` (`infra/local/nginx.conf`), em rodízio, que tenta a
  próxima cópia se uma falhar.

Na primeira subida o catálogo é criado a partir das fotos em `seed-assets/catalogo/`. Para ter
uma conta de administrador local, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ caracteres) e
`ADMIN_NAME` no terminal antes do `npm run lb:docker`; sem isso, a loja sobe sem administrador.
O CI do GitHub roda esse mesmo Compose a cada PR e confere que as 3 cópias respondem e que, com
uma parada, as outras 2 continuam sem erro.

## 5. Nível 3: Azure for Students (a entrega)

Siga [AZURE-LOAD-BALANCER.md](AZURE-LOAD-BALANCER.md). Resumo:

1. Ative a conta em https://azure.microsoft.com/free/students (e-mail da faculdade, sem cartão).
2. Portal do Azure > Cloud Shell (Bash) > `git clone` do repositório.
3. Preencha `infra/azure/variaveis.env` (nunca envie ao GitHub).
4. Escolha o caminho que o professor pediu:
   - **A, App Service com várias instâncias:** `bash infra/azure/app-service.sh`. Mais simples; o balanceador é embutido.
   - **B, VMs + Azure Load Balancer:** `bash infra/azure/vms-load-balancer.sh`. É o "load balancer" explícito, que aparece como recurso no portal.
   - Na dúvida, use o B: é o que costuma ser pedido quando a atividade fala em "aplicar load balancer".
5. `npm run azure:lb-check -- URL 30` e tire os prints (seção 6).
6. **Apague tudo ao terminar:** `bash infra/azure/apagar-tudo.sh`. Os recursos gastam crédito por hora.

## 6. O que mostrar ao professor

1. O desenho da seção 2.
2. A saída do `lb-check` com 2 ou 3 instâncias respondendo.
3. Uma instância derrubada e o site no ar (`parar 2` no nível 1; `docker stop` na VM no nível 3).
4. Login feito, páginas recarregadas e o cliente continua logado, mesmo trocando de instância.
5. No Azure: Load Balancer > pool de back-end (VMs), sonda de integridade `/api/health` e as métricas "Health Probe Status".
6. Limitação honesta: o limite de tentativas (login e assistente) é contado por instância.

## 7. Arquivos

- `scripts/lb-local.js`: nível 1, comandos `npm run lb:local`.
- `infra/local/docker-compose.yml` e `infra/local/nginx.conf`: nível 2, comandos `npm run lb:docker` e `npm run lb:docker:parar`.
- `infra/azure/*.sh` e `docs/AZURE-LOAD-BALANCER.md`: nível 3.
- `scripts/lb-check.js`: comando `npm run azure:lb-check -- URL N`, que vale para os três níveis.
- `tests/stage32.test.js`.
