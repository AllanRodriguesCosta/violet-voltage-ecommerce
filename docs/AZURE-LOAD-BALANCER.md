# Violet Voltage no Azure com balanceamento de carga (etapa 31)

Roteiro pronto para uma atividade do tipo "publique o site no Azure e aplique um load balancer".
Tudo o que depende do código já está feito e testado. O que falta é rodar os roteiros na sua
assinatura do Azure. Só você (ou o Codex, na sua máquina) pode fazer isso, porque exige o seu login.

## 1. Por que a loja já aguenta várias instâncias

Um balanceador manda cada pedido para um servidor diferente. Isso só funciona se nenhum servidor
guardar algo que os outros não sabem. No Violet Voltage:

| Ponto | Como está | Por que importa |
| --- | --- | --- |
| Login | Token assinado (JWT) em cookie, validado com `JWT_SECRET` | Qualquer instância reconhece o cliente. Basta o **mesmo** `JWT_SECRET` em todas (os roteiros garantem). |
| Carrinho | No navegador (localStorage) | Não depende do servidor. |
| Conversa do assistente | Vai e volta pelo navegador, revalidada a cada mensagem | Qualquer instância continua a conversa. |
| Dados e fotos | PostgreSQL externo (o mesmo do Render/Supabase) | Todas as instâncias leem e gravam no mesmo lugar. |
| Saúde | `GET /api/health` (testa o banco; 503 se o banco cair) | A sonda do balanceador tira do ar a instância com problema. |
| Qual servidor respondeu | Cabeçalho `X-Served-By` e campo `instancia` no `/api/health` | É a prova visual do balanceamento na apresentação. |
| Subida simultânea | Migração e sincronização de fotos usam trava no PostgreSQL | Duas instâncias subindo juntas não duplicam tabelas nem produtos. |
| Desligamento | Ao receber SIGTERM, para de aceitar conexões e termina as em andamento | Atualizar ou escalar não derruba pedidos no meio. |

Limitação conhecida (vale citar na apresentação): o limite de tentativas de login e de mensagens
do assistente é contado **por instância**. Com 2 instâncias, o limite efetivo dobra. Para uma loja
real, o contador iria para um armazenamento compartilhado (Redis ou o próprio PostgreSQL).

Variáveis novas (todas opcionais):

- `INSTANCE_NAME`: nome mostrado em `X-Served-By`. Padrão: no App Service, `app-` + início do `WEBSITE_INSTANCE_ID`; fora dele, o hostname (nas VMs, `vv-vm-1`, `vv-vm-2`...).
- `INSTANCE_HEADER=off`: não envia o cabeçalho.
- `TRUST_PROXY`: quantos proxies ficam na frente do Node. Padrão: 1 em produção (Render, App Service). Nas VMs atrás do Azure Load Balancer use 0, porque ele é camada 4 e não é proxy (o roteiro já faz isso).

## 2. Antes de começar

1. Uma assinatura do Azure. A **Azure for Students** dá crédito sem cartão.
2. Abra o **Azure Cloud Shell** (portal.azure.com, ícone `>_`, escolha Bash). Ele já vem com `az`, `git`, `node` e `curl`, e funciona igual no Windows ou no Mac.
3. No Cloud Shell:
   ```bash
   git clone https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce.git
   cd violet-voltage-ecommerce
   cp infra/azure/variaveis.env.example infra/azure/variaveis.env
   code infra/azure/variaveis.env   # editor do Cloud Shell; preencha e salve
   ```
   Preencha pelo menos `DATABASE_URL`. Use a mesma do Render, assim o catálogo e os clientes já
   aparecem. Use também o mesmo `JWT_SECRET` do Render se quiser que logins valham nos dois. O
   arquivo `variaveis.env` está no `.gitignore`: nunca o envie ao GitHub.

## 3. Caminho A: App Service com várias instâncias (mais simples)

O App Service tem um balanceador embutido. O roteiro cria um plano Linux B1 com `INSTANCES`
instâncias, configura o health check em `/api/health`, desliga a afinidade de sessão (ARR, que
prenderia cada navegador numa instância) e envia o código.

```bash
# preencha APP_NAME (nome único: vira https://APP_NAME.azurewebsites.net)
bash infra/azure/app-service.sh
npm run azure:lb-check -- https://APP_NAME.azurewebsites.net 30
```

Para mostrar escala ao vivo: Portal > Plano do App Service > Expandir (Scale out) > mude de 2 para
3 instâncias e rode o `lb-check` de novo.

## 4. Caminho B: VMs + Azure Load Balancer (o "load balancer de verdade")

```
Internet -> IP público -> Azure Load Balancer Standard (porta 80, sonda HTTP /api/health)
                              |-> vv-vm-1  (Docker: violet-voltage, 80 -> 3000)
                              |-> vv-vm-2  (Docker: violet-voltage, 80 -> 3000)
                              '-> todas usam o mesmo PostgreSQL (Supabase/Render)
```

```bash
bash infra/azure/vms-load-balancer.sh          # 10 a 15 minutos
npm run azure:lb-check -- http://IP-MOSTRADO 30
```

O que o roteiro cria, tudo no grupo `RG`:

- **Rede:** rede virtual `vv-rede`, sub-rede `vv-subrede` e firewall `vv-firewall`, que só libera a porta 80.
- **Balanceador:** IP público Standard `vv-ip-publico` e Load Balancer `vv-balanceador`, com:
  - pool `vv-servidores`;
  - sonda `vv-saude` (HTTP 80 `/api/health` a cada 5 s);
  - regra `vv-http` (80 -> 80);
  - regra de saída `vv-saida`, porque as VMs não têm IP público e saem para a internet pelo balanceador.
- **Máquinas:** conjunto de disponibilidade `vv-disponibilidade` e as VMs `vv-vm-1..N` (Ubuntu 24.04, `VM_SIZE`). Na primeira inicialização, cada VM:
  1. instala o Docker;
  2. clona o repositório;
  3. constrói a imagem com o `Dockerfile` da raiz;
  4. sobe o contêiner com `INSTANCE_NAME` igual ao hostname.

Depois de um merge, para levar a versão nova às VMs (uma por vez, sem tirar a loja do ar):

```bash
bash infra/azure/atualizar-vms.sh
```

## 5. Roteiro de demonstração (5 minutos)

1. Abra `http://IP/api/health` e recarregue algumas vezes. O campo `instancia` alterna. No navegador o keep-alive pode prender a conexão numa instância; o `lb-check` abre uma conexão nova a cada pedido.
2. Rode `npm run azure:lb-check -- http://IP 30`. Ele mostra a contagem por instância e "Balanceamento OK".
3. **Tolerância a falha:** derrube a loja numa VM:
   ```bash
   az vm run-command invoke -g violet-voltage-lb -n vv-vm-1 --command-id RunShellScript --scripts "docker stop violet-voltage"
   npm run azure:lb-check -- http://IP 30   # agora só vv-vm-2 responde, sem erro para o cliente
   az vm run-command invoke -g violet-voltage-lb -n vv-vm-1 --command-id RunShellScript --scripts "docker start violet-voltage"
   ```
4. Faça login na loja, recarregue várias vezes e mostre que continua logado, mesmo trocando de instância (JWT compartilhado).
5. No portal: Load Balancer > Insights / Métricas > "Health Probe Status" e "Data Path Availability".

## 6. Custos e limpeza

Tudo consome crédito **por hora** enquanto existir: B1 do App Service por instância, VMs, IP
público Standard e regras do Load Balancer. Confira os valores na calculadora de preços do Azure
para a sua região. Ao terminar:

```bash
bash infra/azure/apagar-tudo.sh   # pede o nome do grupo para confirmar; apaga o grupo inteiro
```

O banco (Supabase/Render) fica fora do Azure e não é tocado.

## 7. Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `RequestDisallowedByPolicy` ou "SKU not available" | Região ou tamanho bloqueado na assinatura de estudante | Troque `LOCATION` (ex.: `eastus`, `westus2`, `brazilsouth`) ou `VM_SIZE` (ex.: `Standard_B2ats_v2`) |
| `az webapp create` recusa `NODE:24-lts` | Versão ainda não oferecida na região | `az webapp list-runtimes --os linux` e ajuste `APP_RUNTIME` (ex.: `NODE:22-lts`) |
| `lb-check` mostra só uma instância (App Service) | Afinidade ARR ligada ou só 1 instância | Portal > Configuração > Afinidade ARR = Desligado; Scale out = 2+ |
| `lb-check` mostra só uma instância (VMs) | A outra VM ainda instalando ou com erro | `az vm run-command invoke ... --scripts "docker ps; tail -n 30 /var/log/cloud-init-output.log"` |
| `falha-503` | `/api/health` não alcança o banco | Confira `DATABASE_URL` e se o Supabase aceita conexões externas (porta 5432 ou o pooler 6543) |
| Login cai ao trocar de instância | `JWT_SECRET` diferente entre instâncias | Use o mesmo valor (os roteiros já usam um só) |

## 8. Arquivos da etapa

- `Dockerfile` e `.dockerignore`: imagem única (Node 24 Alpine, como no Render e no CI, usuário sem privilégio, HEALTHCHECK). O CI constrói a imagem e testa `/api/health` no contêiner a cada PR.
- `infra/azure/`:
  - `comum.sh`;
  - `app-service.sh` (caminho A);
  - `vms-load-balancer.sh` (caminho B);
  - `atualizar-vms.sh`;
  - `apagar-tudo.sh`;
  - `variaveis.env.example`.
- `scripts/lb-check.js` (`npm run azure:lb-check`).
- `src/config/index.js` (`instanceName`, `trustProxy`), `src/app.js` (cabeçalho), `src/routes/api.js` (`instancia` no health, sem cache), `src/repositories/*` (`withLock`), `migrations/001-postgres.sql` (trava da migração), `src/services/catalog-sync.js` (`runCatalogSync`), `src/server.js` (desligamento gracioso).
- `tests/stage31.test.js`.
