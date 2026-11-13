#!/usr/bin/env bash
# Etapa 31 - Caminho B: máquinas virtuais atrás de um Azure Load Balancer (Standard).
#
#   Internet -> IP público -> Load Balancer (porta 80, sonda HTTP /api/health)
#                               |-> vv-vm-1 (Docker: violet-voltage, porta 80 -> 3000)
#                               |-> vv-vm-2 (...)
#                               '-> PostgreSQL (Supabase/Render: o mesmo banco para todas)
#
# As VMs não têm IP público: só o balanceador recebe tráfego, e a saída para a internet
# (baixar pacotes, falar com o banco) passa pela regra de saída do próprio balanceador.
# Uso (no Azure Cloud Shell, dentro do repositório): bash infra/azure/vms-load-balancer.sh
set -euo pipefail
# shellcheck source=comum.sh
source "$(dirname "$0")/comum.sh"
checar_aplicacao

passo "Grupo de recursos $RG em $LOCATION"
az group create -n "$RG" -l "$LOCATION" -o none

passo "Rede virtual, sub-rede e regras de firewall (só HTTP 80 entra)"
az network vnet create -g "$RG" -n vv-rede --address-prefix 10.10.0.0/16 \
  --subnet-name vv-subrede --subnet-prefix 10.10.1.0/24 -o none
az network nsg create -g "$RG" -n vv-firewall -o none
az network nsg rule create -g "$RG" --nsg-name vv-firewall -n permitir-http --priority 100 \
  --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 80 -o none
az network vnet subnet update -g "$RG" --vnet-name vv-rede -n vv-subrede --network-security-group vv-firewall -o none

passo "IP público e Load Balancer Standard"
az network public-ip create -g "$RG" -n vv-ip-publico --sku Standard --allocation-method Static -o none
az network lb create -g "$RG" -n vv-balanceador --sku Standard --public-ip-address vv-ip-publico \
  --frontend-ip-name vv-frente --backend-pool-name vv-servidores -o none
az network lb probe create -g "$RG" --lb-name vv-balanceador -n vv-saude \
  --protocol Http --port 80 --path /api/health --interval 5 -o none
az network lb rule create -g "$RG" --lb-name vv-balanceador -n vv-http --protocol Tcp \
  --frontend-port 80 --backend-port 80 --frontend-ip-name vv-frente --backend-pool-name vv-servidores \
  --probe-name vv-saude --idle-timeout 4 --disable-outbound-snat true -o none
az network lb outbound-rule create -g "$RG" --lb-name vv-balanceador -n vv-saida \
  --frontend-ip-configs vv-frente --address-pool vv-servidores --protocol All --outbound-ports 10000 -o none

passo "Conjunto de disponibilidade (as VMs ficam em hardware diferente)"
az vm availability-set create -g "$RG" -n vv-disponibilidade -o none

# cloud-init: instala Docker, baixa o repositório, constrói a imagem (Dockerfile da raiz) e sobe
# o contêiner. O arquivo de variáveis vai em base64 e fica só na VM (/etc/violet-voltage.env, 0600).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
{
  variaveis_app
  echo "PORT=3000"
  # Load Balancer é camada 4 (não é proxy): o IP do cliente chega direto.
  echo "TRUST_PROXY=0"
} >"$TMP/app.env"
ENV_B64="$(base64 -w0 "$TMP/app.env")"
cat >"$TMP/cloud-init.yaml" <<YAML
#cloud-config
package_update: true
packages: [docker.io, git]
write_files:
  - path: /etc/violet-voltage.env
    permissions: "0600"
    encoding: b64
    content: $ENV_B64
  - path: /usr/local/bin/violet-voltage-atualizar
    permissions: "0755"
    content: |
      #!/bin/bash
      # Baixa a versão nova do repositório, reconstrói e troca o contêiner.
      set -e
      cd /opt/violet-voltage
      git fetch --depth 1 origin "$BRANCH" && git reset --hard FETCH_HEAD
      docker build -t violet-voltage .
      docker rm -f violet-voltage 2>/dev/null || true
      docker run -d --name violet-voltage --restart unless-stopped -p 80:3000 \\
        --env-file /etc/violet-voltage.env -e INSTANCE_NAME="\$(hostname)" violet-voltage
runcmd:
  - [bash, -c, "fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile || true"]
  - [systemctl, enable, --now, docker]
  - [git, clone, --depth, "1", --branch, "$BRANCH", "$REPO_URL", /opt/violet-voltage]
  - [/usr/local/bin/violet-voltage-atualizar]
YAML

for ((i = 1; i <= INSTANCES; i++)); do
  VM="vv-vm-$i"
  passo "Máquina $VM ($VM_SIZE, Ubuntu 24.04, sem IP público)"
  az vm create -g "$RG" -n "$VM" --image Ubuntu2404 --size "$VM_SIZE" \
    --vnet-name vv-rede --subnet vv-subrede --nsg "" --public-ip-address "" \
    --availability-set vv-disponibilidade --admin-username azureuser --generate-ssh-keys \
    --custom-data "$TMP/cloud-init.yaml" -o none
  az network nic ip-config address-pool add -g "$RG" --nic-name "${VM}VMNic" --ip-config-name "ipconfig$VM" \
    --lb-name vv-balanceador --address-pool vv-servidores -o none
done

IP="$(az network public-ip show -g "$RG" -n vv-ip-publico --query ipAddress -o tsv)"
passo "Esperando as VMs instalarem Docker e subirem a loja (5 a 10 minutos)"
esperar_saude "http://$IP" || true
echo
echo "Loja pelo balanceador: http://$IP"
echo "Teste do balanceamento: npm run azure:lb-check -- http://$IP 30"
echo "Atualizar o código nas VMs depois de um merge: bash infra/azure/atualizar-vms.sh"
echo "Ao terminar a atividade: bash infra/azure/apagar-tudo.sh"
