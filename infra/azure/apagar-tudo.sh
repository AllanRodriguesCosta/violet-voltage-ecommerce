#!/usr/bin/env bash
# Etapa 31: apaga o grupo de recursos inteiro (VMs, balanceador, IP, App Service...) para parar de
# consumir crédito. O banco PostgreSQL (Supabase/Render) fica fora do Azure e não é tocado.
set -euo pipefail
# shellcheck source=comum.sh
source "$(dirname "$0")/comum.sh"
echo "Recursos no grupo $RG:"
az resource list -g "$RG" --query "[].{nome:name, tipo:type}" -o table || true
read -r -p "Apagar TUDO do grupo $RG? Digite o nome do grupo para confirmar: " RESPOSTA
[ "$RESPOSTA" = "$RG" ] || falha "Nada foi apagado."
az group delete -n "$RG" --yes --no-wait
echo "Exclusão iniciada (leva alguns minutos). Confira no portal: Grupos de recursos."
