#!/usr/bin/env bash
# Etapa 31 - Caminho B: atualiza o código em cada VM, uma de cada vez. Enquanto uma reinicia, a
# sonda /api/health a tira do balanceador e a outra continua atendendo (sem tirar a loja do ar).
set -euo pipefail
# shellcheck source=comum.sh
source "$(dirname "$0")/comum.sh"
for ((i = 1; i <= INSTANCES; i++)); do
  passo "Atualizando vv-vm-$i"
  az vm run-command invoke -g "$RG" -n "vv-vm-$i" --command-id RunShellScript \
    --scripts "/usr/local/bin/violet-voltage-atualizar" --query "value[0].message" -o tsv | tail -n 5
  sleep 20
done
IP="$(az network public-ip show -g "$RG" -n vv-ip-publico --query ipAddress -o tsv)"
esperar_saude "http://$IP"
