#!/usr/bin/env bash
# Funções e variáveis comuns aos roteiros do Azure (etapa 31). Não rode este arquivo sozinho:
# os outros roteiros fazem "source ./comum.sh".
# shellcheck disable=SC2034  # variáveis usadas pelos roteiros que incluem este arquivo
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
VARS="$AQUI/variaveis.env"

falha() {
  echo "ERRO: $*" >&2
  exit 1
}
passo() { echo; echo "==> $*"; }

[ -f "$VARS" ] || falha "Copie infra/azure/variaveis.env.example para infra/azure/variaveis.env e preencha."
set -a
# shellcheck disable=SC1090
source "$VARS"
set +a

DATABASE_URL="${DATABASE_URL:-}"
JWT_SECRET="${JWT_SECRET:-}"
APP_NAME="${APP_NAME:-}"
RG="${RG:-violet-voltage-lb}"
LOCATION="${LOCATION:-eastus2}"
INSTANCES="${INSTANCES:-2}"
DATABASE_SSL="${DATABASE_SSL:-true}"
APP_SKU="${APP_SKU:-B1}"
APP_RUNTIME="${APP_RUNTIME:-NODE:24-lts}"
VM_SIZE="${VM_SIZE:-Standard_B1s}"
REPO_URL="${REPO_URL:-https://github.com/AllanRodriguesCosta/violet-voltage-ecommerce.git}"
BRANCH="${BRANCH:-main}"

[[ "$INSTANCES" =~ ^[2-5]$ ]] || falha "INSTANCES deve ser de 2 a 5 (balanceador com uma instância só não demonstra nada)."

exigir() {
  local nome
  for nome in "$@"; do
    [ -n "${!nome:-}" ] || falha "Preencha $nome em infra/azure/variaveis.env."
  done
}

command -v az >/dev/null || falha "Azure CLI não encontrado. Use o Azure Cloud Shell (portal.azure.com, ícone >_), que já vem com ele."
az account show -o none 2>/dev/null || falha "Entre na conta primeiro: az login"

# Confere o banco e garante o segredo de login (só para os roteiros que publicam a loja).
checar_aplicacao() {
  exigir DATABASE_URL
  case "$DATABASE_URL" in postgres://* | postgresql://*) ;; *) falha "DATABASE_URL deve começar com postgres:// ou postgresql://" ;; esac

  # Todas as instâncias precisam do MESMO segredo de login. Se estiver vazio, gera um e guarda no
  # variaveis.env (que fica fora do git) para as próximas execuções usarem o mesmo.
  if [ -z "${JWT_SECRET:-}" ]; then
    JWT_SECRET="$(openssl rand -hex 48 2>/dev/null || od -An -N48 -tx1 /dev/urandom | tr -d " \n")"
    if grep -q '^JWT_SECRET=' "$VARS"; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$VARS"
    else
      echo "JWT_SECRET=$JWT_SECRET" >>"$VARS"
    fi
    echo "JWT_SECRET gerado e guardado em infra/azure/variaveis.env (não é exibido aqui)."
  fi
  [ "${#JWT_SECRET}" -ge 32 ] || falha "JWT_SECRET precisa de pelo menos 32 caracteres."
}

# Variáveis da aplicação no formato CHAVE=valor, uma por linha (vazias ficam de fora).
variaveis_app() {
  local nome
  echo "NODE_ENV=production"
  echo "DATABASE_SSL=$DATABASE_SSL"
  for nome in DATABASE_URL JWT_SECRET ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME GEMINI_API_KEY; do
    [ -n "${!nome:-}" ] && echo "$nome=${!nome}"
  done
  return 0
}

# Espera o endereço responder no /api/health (até ~10 minutos).
esperar_saude() {
  local url="$1" i
  for ((i = 1; i <= 60; i++)); do
    if curl -fsS --max-time 5 "$url/api/health" >/dev/null 2>&1; then
      echo "Respondendo: $url/api/health"
      return 0
    fi
    sleep 10
  done
  echo "Ainda sem resposta em $url/api/health. Veja o diagnóstico em docs/AZURE-LOAD-BALANCER.md." >&2
  return 1
}
