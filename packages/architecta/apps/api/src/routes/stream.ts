/**
 * SSE Streaming Route
 *
 * Server-Sent Events endpoint for real-time workflow updates.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AppError, z } from "@palindrom/fastify-api";
import * as store from "../store/workflow-store.js";
import type { SSEEvent } from "../schemas.js";

/**
 * Format an event for SSE
 */
function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE stream handler
 */
async function streamHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;

  const workflow = store.getWorkflow(id);
  if (!workflow) {
    throw AppError.notFound("Workflow", id);
  }

  // Set SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial connection event
  reply.raw.write(formatSSE({ type: "phaseChange", phase: workflow.phase }));

  // Subscribe to workflow events
  const unsubscribe = store.subscribe(id, (event) => {
    reply.raw.write(formatSSE(event));
  });

  // Handle client disconnect
  request.raw.on("close", () => {
    unsubscribe();
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    reply.raw.write(": heartbeat\n\n");
  }, 30000);

  request.raw.on("close", () => {
    clearInterval(heartbeat);
  });
}

/**
 * Register SSE route
 */
export function registerStreamRoute(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>(
    "/workflow/:id/stream",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
      },
    },
    streamHandler
  );
}
