#!/bin/bash
# Setup secrets for Architecta across all environments
# Usage: ./scripts/setup-secrets.sh

set -e

cd "$(dirname "$0")/.."

echo "=== Architecta Secrets Setup ==="
echo ""

# Install dependencies
echo "1. Installing dependencies..."
pnpm install

# Initialize stacks if they don't exist
echo ""
echo "2. Initializing Pulumi stacks..."

for env in dev stag prod; do
  PULUMI_CONFIG_PASSPHRASE="" pulumi config set gcp:project "christopher-little-$env" --stack $env 2>/dev/null || true
  if ! PULUMI_CONFIG_PASSPHRASE="" pulumi stack ls 2>/dev/null | grep -q "^$env"; then
    echo "   Creating stack: $env"
    PULUMI_CONFIG_PASSPHRASE="" pulumi stack init $env --non-interactive || true
  else
    echo "   Stack already exists: $env"
  fi
done

# Deploy to all environments
echo ""
echo "3. Deploying secrets to all environments..."

for env in dev stag prod; do
  echo ""
  echo "   Deploying to $env..."
  PULUMI_CONFIG_PASSPHRASE="" ENVIRONMENT=$env pulumi up --stack $env --yes
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Created secrets:"
echo "  - christopher-little-dev-anthropic-api-key-secret-dev"
echo "  - christopher-little-stag-anthropic-api-key-secret-stag"
echo "  - christopher-little-prod-anthropic-api-key-secret-prod"
echo ""
echo "Next steps:"
echo "1. Set the secret values using the set-secret-value.sh script:"
echo "   ./scripts/set-secret-value.sh dev"
echo "   ./scripts/set-secret-value.sh stag"
echo "   ./scripts/set-secret-value.sh prod"
