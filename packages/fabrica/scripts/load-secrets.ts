#!/usr/bin/env npx ts-node
/**
 * One-time script to load secret VALUES from .env to GCP Secret Manager.
 *
 * Prerequisites:
 *   - Secrets must already exist (created by Pulumi via `pulumi up`)
 *   - You must be authenticated: `gcloud auth application-default login`
 *
 * Usage:
 *   npx ts-node scripts/load-secrets.ts
 *   npx ts-node scripts/load-secrets.ts --env-file .env.production
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Configuration - must match infra/index.ts secretMappings
const SECRET_MAP: Record<string, string> = {
  ANTHROPIC_API_KEY: "fabrica-anthropic-api-key",
  GITHUB_TOKEN: "fabrica-github-token",
};

const PROJECT_ID = process.env.GCP_PROJECT || "christopher-little-dev";

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let envFile = ".env";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env-file" && args[i + 1]) {
      envFile = args[i + 1];
      i++;
    }
  }

  const envPath = resolve(process.cwd(), envFile);

  // Check .env exists
  if (!existsSync(envPath)) {
    console.error(`Error: ${envFile} not found`);
    console.error("");
    console.error("Create a .env file with:");
    console.error("  ANTHROPIC_API_KEY=sk-ant-...");
    console.error("  GITHUB_TOKEN=ghp_...");
    process.exit(1);
  }

  // Parse .env file
  const envContent = readFileSync(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    envVars[key] = value;
  }

  // Initialize Secret Manager client
  const client = new SecretManagerServiceClient();

  console.log(`Loading secrets from ${envFile} to GCP project: ${PROJECT_ID}\n`);

  // Process each secret
  for (const [envVar, secretId] of Object.entries(SECRET_MAP)) {
    const value = envVars[envVar];

    if (!value) {
      console.log(`⏭  Skipping ${envVar} (not found in ${envFile})`);
      continue;
    }

    console.log(`Processing: ${envVar} -> ${secretId}`);

    const secretName = `projects/${PROJECT_ID}/secrets/${secretId}`;

    try {
      // Check if secret exists
      await client.getSecret({ name: secretName });
      console.log("  Secret exists, adding new version...");
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND - secret doesn't exist yet
        console.error(`  ✗ Secret does not exist. Run 'pulumi up' first to create it.`);
        continue;
      }
      throw error;
    }

    // Add new version with the value
    await client.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(value, "utf-8"),
      },
    });

    console.log("  ✓ Done\n");
  }

  console.log("All secrets loaded successfully!");
  console.log("");
  console.log("Verify with:");
  console.log(`  gcloud secrets list --project=${PROJECT_ID} --filter='name:fabrica'`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
