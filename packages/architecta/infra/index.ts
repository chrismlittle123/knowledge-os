/**
 * Architecta Infrastructure
 *
 * Creates secrets in Google Secret Manager for the Anthropic API key.
 * Uses @palindrom-ai/infra for cloud-agnostic secret management.
 */

import { defineConfig, createSecret } from "@palindrom-ai/infra";

// Get environment from env var (set by npm scripts)
const environment = (process.env.ENVIRONMENT || "dev") as "dev" | "stag" | "prod";

// Map environment to GCP project
const gcpProject = `christopher-little-${environment}`;

// Configure for GCP
defineConfig({
  cloud: "gcp",
  region: "eu-west-2",
  project: gcpProject,
  environment,
});

// Create the Anthropic API key secret
// The actual value should be set via GCP Console or gcloud CLI after creation
export const anthropicApiKey = createSecret("anthropic-api-key");

// Export outputs for reference
export const outputs = {
  secretName: anthropicApiKey.secretName,
  secretArn: anthropicApiKey.secretArn,
  environment,
};
