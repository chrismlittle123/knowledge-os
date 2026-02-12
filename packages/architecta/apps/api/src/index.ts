/**
 * Architecta API Server
 *
 * Fastify server using @palindrom/fastify-api.
 * Provides REST API and SSE streaming for the Architecta orchestrator.
 */

import "dotenv/config";
import { createApp } from "@palindrom/fastify-api";
import cors from "@fastify/cors";
import { initAnthropicClient } from "@architecta/core";
import { registerWorkflowRoutes } from "./routes/workflow.js";
import { registerStreamRoute } from "./routes/stream.js";
import { initSecrets, isLocal } from "./lib/secrets.js";

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;

async function main(): Promise<void> {
  // Initialize secrets
  if (isLocal()) {
    // Use .env file for local development
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set in environment. Create a .env file.");
    }
    initAnthropicClient(apiKey);
    console.log("Using local .env for secrets");
  } else {
    // Fetch from Google Secret Manager
    const secrets = await initSecrets();
    initAnthropicClient(secrets.anthropicApiKey);
  }

  const app = await createApp({
    name: "architecta-api",
    server: {
      port: PORT,
      host: HOST,
    },
    logging: {
      level: LOG_LEVEL,
      pretty: process.env.NODE_ENV !== "production",
    },
    docs: {
      title: "Architecta API",
      description: "API for the Architecta intelligent orchestrator",
      version: "0.1.0",
      path: "/docs",
    },
  });

  // Enable CORS for frontend
  await app.register(cors, {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  });

  // Register routes
  registerWorkflowRoutes(app);
  registerStreamRoute(app);

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, shutting down...`);
      await app.shutdown();
      process.exit(0);
    });
  }

  // Start server
  await app.start();

  console.log(`
╔════════════════════════════════════════╗
║         ARCHITECTA API                 ║
║                                        ║
║  Server:  http://${HOST}:${PORT}
║  Docs:    http://${HOST}:${PORT}/docs
║  Health:  http://${HOST}:${PORT}/health
║                                        ║
╚════════════════════════════════════════╝
  `);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
