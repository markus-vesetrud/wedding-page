#!/usr/bin/env bash
set -euo pipefail

# deploy.sh -- Deploy wedding-page infrastructure & app
#
# Usage:
#   ./infra/deploy.sh                  # uses defaults
#   ./infra/deploy.sh -g my-rg -l westeurope
#   ./infra/deploy.sh -s                # skip bicep, deploy app only

RESOURCE_GROUP="rg-wedding-page"
LOCATION="westeurope"
SKIP_INFRA=false

while getopts "g:l:s" opt; do
  case $opt in
    g) RESOURCE_GROUP="$OPTARG" ;;
    l) LOCATION="$OPTARG" ;;
    s) SKIP_INFRA=true ;;
    *) echo "Usage: $0 [-g resource-group] [-l location] [-s]" && exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==========================================="
echo "  Wedding Page -- Azure Deployment"
echo "==========================================="
echo ""
echo "  Resource Group : $RESOURCE_GROUP"
echo "  Location       : $LOCATION"
echo ""

# -- 1. Ensure logged in --
echo "> Checking Azure CLI login..."
az account show --output none 2>/dev/null || {
  echo "  Not logged in -- running 'az login'..."
  az login
}

# -- 2. Create resource group --
if [ "$SKIP_INFRA" = true ]; then
  echo "> Skipping infrastructure deployment (-s flag)"
  echo ""

  # Still need resource names -- look them up
  SWA_NAME=$(az staticwebapp list \
    --resource-group "$RESOURCE_GROUP" \
    --query '[0].name' --output tsv)
  SWA_URL="https://$(az staticwebapp show \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'defaultHostname' --output tsv)"

  echo "    Static Web App : $SWA_NAME"
  echo ""
else
  echo "> Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

  # -- 3. Deploy Bicep template --
  echo "> Deploying infra/main.bicep..."
  DEPLOY_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$SCRIPT_DIR/main.bicep" \
    --query 'properties.outputs' \
    --output json)

  SWA_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.staticWebAppName.value')
  SWA_URL=$(echo "$DEPLOY_OUTPUT" | jq -r '.staticWebAppUrl.value')
  STORAGE_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.storageAccountName.value')
  PUBSUB_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.webPubSubName.value')

  echo ""
  echo "  [OK] Infrastructure deployed"
  echo "    Static Web App : $SWA_NAME"
  echo "    Storage Account: $STORAGE_NAME"
  echo "    Web PubSub     : $PUBSUB_NAME"
  echo ""
fi

# -- 4. Build frontend & API --
echo "> Building frontend..."
npm run build --prefix "$PROJECT_ROOT/frontend"

echo "> Building API..."
npm run build --prefix "$PROJECT_ROOT/api"

# -- 5. Get SWA deployment token --
echo "> Retrieving SWA deployment token..."
DEPLOY_TOKEN=$(az staticwebapp secrets list \
  --name "$SWA_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query 'properties.apiKey' \
  --output tsv)

# -- 6. Deploy with SWA CLI --
echo "> Deploying app via SWA CLI..."
npx --yes @azure/static-web-apps-cli deploy \
  "$PROJECT_ROOT/frontend/build" \
  --api-location "$PROJECT_ROOT/api" \
  --api-language "node" \
  --api-version "22" \
  --swa-config-location "$PROJECT_ROOT" \
  --deployment-token "$DEPLOY_TOKEN" \
  --env production

echo ""
echo "==========================================="
echo "  [OK] Deployment complete!"
echo "==========================================="
echo ""
echo "  URL: $SWA_URL"
echo ""
