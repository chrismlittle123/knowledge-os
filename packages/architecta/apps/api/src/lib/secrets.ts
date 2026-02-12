/**
 * Google Secret Manager Integration
 *
 * Fetches secrets from GCP Secret Manager based on environment.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

// Environment determines which project to use
const environment = (process.env.NODE_ENV === "production" ? "prod" :
                    process.env.NODE_ENV === "staging" ? "stag" : "dev") as "dev" | "stag" | "prod";

const gcpProject = `christopher-little-${environment}`;

/**
 * Get the secret name for a given key
 */
function getSecretName(key: string): string {
  return `${gcpProject}-${key}-secret-${environment}`;
}

/**
 * Fetch a secret value from GCP Secret Manager
 */
export async function getSecret(key: string): Promise<string> {
  const secretName = getSecretName(key);
  const name = `projects/${gcpProject}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data;

    if (!payload) {
      throw new Error(`Secret ${key} has no payload`);
    }

    // Handle both string and Uint8Array
    if (typeof payload === "string") {
      return payload;
    }
    return new TextDecoder().decode(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch secret ${key}: ${message}`);
  }
}

/**
 * Initialize all required secrets and return them
 */
export async function initSecrets(): Promise<{ anthropicApiKey: string }> {
  console.log(`Loading secrets from GCP Secret Manager (${environment} environment)...`);

  const anthropicApiKey = await getSecret("anthropic-api-key");

  console.log("Secrets loaded successfully");

  return { anthropicApiKey };
}

/**
 * Check if running locally (for development with .env fallback)
 */
export function isLocal(): boolean {
  return process.env.LOCAL === "true" || process.env.USE_LOCAL_ENV === "true";
}
