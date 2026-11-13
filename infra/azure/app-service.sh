#!/usr/bin/env bash
# Etapa 31 - Caminho A: App Service com várias instâncias.
# O App Service já tem balanceador embutido na frente das instâncias: basta escalar o plano para
# 2+ instâncias, desligar a afinidade de sessão (ARR) e configurar o health check.
# Uso (no Azure Cloud Shell, dentro do repositório): bash infra/azure/app-service.sh
set -euo pipefail
# shellcheck source=comum.sh
source "$(dirname "$0")/comum.sh"
checar_aplicacao
exigir APP_NAME
PLANO="vv-plano"

passo "Grupo de recursos $RG em $LOCATION"
az group create -n "$RG" -l "$LOCATION" -o none

passo "Plano Linux $APP_SKU com $INSTANCES instâncias"
az appservice plan create -g "$RG" -n "$PLANO" --is-linux --sku "$APP_SKU" --number-of-workers "$INSTANCES" -o none

passo "Aplicativo web $APP_NAME ($APP_RUNTIME)"
az webapp show -g "$RG" -n "$APP_NAME" -o none 2>/dev/null ||
  az webapp create -g "$RG" -p "$PLANO" -n "$APP_NAME" --runtime "$APP_RUNTIME" -o none

passo "Variáveis da aplicação (valores não são exibidos)"
mapfile -t AJUSTES < <(variaveis_app)
az webapp config appsettings set -g "$RG" -n "$APP_NAME" -o none --settings \
  "${AJUSTES[@]}" SCM_DO_BUILD_DURING_DEPLOYMENT=true WEBSITES_CONTAINER_START_TIME_LIMIT=600

passo "Health check em /api/health, sem afinidade de sessão, só HTTPS"
az webapp config set -g "$RG" -n "$APP_NAME" -o none --startup-file "npm start" \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
az webapp update -g "$RG" -n "$APP_NAME" -o none --client-affinity-enabled false --https-only true

passo "Enviando o código (branch atual do repositório) - leva alguns minutos"
PACOTE="$(mktemp -d)/violet-voltage.zip"
git -C "$RAIZ" archive --format=zip -o "$PACOTE" HEAD
az webapp deploy -g "$RG" -n "$APP_NAME" --src-path "$PACOTE" --type zip -o none

URL="https://$APP_NAME.azurewebsites.net"
passo "Esperando a loja responder"
esperar_saude "$URL" || true
echo
echo "Loja: $URL"
echo "Teste do balanceamento: npm run azure:lb-check -- $URL 30"
echo "Ao terminar a atividade: bash infra/azure/apagar-tudo.sh"
