#!/bin/bash
# Set secret value in GCP Secret Manager
# Usage: ./scripts/set-secret-value.sh <environment>
# Example: ./scripts/set-secret-value.sh dev

set -e

ENV=${1:-dev}

# Validate environment
if [[ ! "$ENV" =~ ^(dev|stag|prod)$ ]]; then
  echo "Error: Environment must be dev, stag, or prod"
  exit 1
fi

PROJECT="christopher-little-${ENV}"
SECRET_NAME="christopher-little-${ENV}-anthropic-api-key-secret-${ENV}"

echo "Setting value for secret: $SECRET_NAME"
echo "Project: $PROJECT"
echo ""
echo "Enter the Anthropic API key (input will be hidden):"
read -s SECRET_VALUE

if [ -z "$SECRET_VALUE" ]; then
  echo "Error: Secret value cannot be empty"
  exit 1
fi

# Add new version to the secret
echo "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
  --project="$PROJECT" \
  --data-file=-

echo ""
echo "Secret value set successfully!"
