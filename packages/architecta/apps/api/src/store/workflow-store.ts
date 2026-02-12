/**
 * In-memory Workflow Store
 *
 * Simple storage for workflows. No persistence.
 * Uses prefixed IDs: wfl_xxx
 */

import { randomBytes } from "crypto";
import { createOrchestrator, type Orchestrator } from "@architecta/core";
import type { Workflow, Phase, Plan, ReviewResult, SSEEvent, ClarifyingQuestion, Playbook } from "../schemas.js";

type EventCallback = (event: SSEEvent) => void;

interface WorkflowEntry {
  workflow: Workflow;
  orchestrator: Orchestrator;
  subscribers: Set<EventCallback>;
  pendingQuestions?: ClarifyingQuestion[];
  pendingPlaybook?: Playbook;
}

const store = new Map<string, WorkflowEntry>();

/**
 * Generate a prefixed workflow ID
 */
function generateId(): string {
  return `wfl_${randomBytes(12).toString("hex")}`;
}

/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Create a new workflow
 */
export function createWorkflow(workDir: string): Workflow {
  const id = generateId();
  const timestamp = now();

  const orchestrator = createOrchestrator({ workDir });

  const workflow: Workflow = {
    id,
    phase: "idle",
    iterations: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Set up event forwarding from orchestrator to subscribers
  orchestrator.onEvent((event) => {
    const entry = store.get(id);
    if (!entry) return;

    // Convert core event to API SSEEvent
    let sseEvent: SSEEvent;
    switch (event.type) {
      case "thinking":
        sseEvent = { type: "thinking", message: event.message };
        break;
      case "output":
        sseEvent = { type: "output", text: event.text };
        break;
      case "plan_ready":
        sseEvent = { type: "planReady", plan: event.plan };
        // Update workflow state
        entry.workflow.plan = event.plan;
        entry.workflow.updatedAt = now();
        break;
      case "review_ready":
        sseEvent = {
          type: "reviewReady",
          result: {
            confidence: event.result.confidence,
            confidenceLevel: event.result.confidenceLevel,
            issues: event.result.issues,
            summary: event.result.summary,
          },
        };
        // Update workflow state
        entry.workflow.lastReview = {
          confidence: event.result.confidence,
          confidenceLevel: event.result.confidenceLevel,
          issues: event.result.issues,
          summary: event.result.summary,
        };
        entry.workflow.updatedAt = now();
        break;
      case "questions":
        sseEvent = { type: "questions", questions: event.questions };
        // Store pending questions
        entry.pendingQuestions = event.questions;
        break;
      case "playbook_proposed":
        sseEvent = { type: "playbookProposed", playbook: event.playbook };
        // Store pending playbook
        entry.pendingPlaybook = event.playbook;
        break;
      case "research_ready":
        sseEvent = { type: "researchReady", result: event.result };
        break;
      case "error":
        sseEvent = { type: "error", error: event.error };
        break;
      default:
        return;
    }

    // Broadcast to all subscribers
    for (const callback of entry.subscribers) {
      callback(sseEvent);
    }
  });

  store.set(id, {
    workflow,
    orchestrator,
    subscribers: new Set(),
  });

  return workflow;
}

/**
 * Get a workflow by ID
 */
export function getWorkflow(id: string): Workflow | undefined {
  return store.get(id)?.workflow;
}

/**
 * Get orchestrator for a workflow
 */
export function getOrchestrator(id: string): Orchestrator | undefined {
  return store.get(id)?.orchestrator;
}

/**
 * Update workflow phase
 */
export function updatePhase(id: string, phase: Phase): void {
  const entry = store.get(id);
  if (!entry) return;

  entry.workflow.phase = phase;
  entry.workflow.updatedAt = now();

  // Notify subscribers of phase change
  for (const callback of entry.subscribers) {
    callback({ type: "phaseChange", phase });
  }
}

/**
 * Update workflow after planning
 */
export function updatePlan(id: string, plan: Plan): void {
  const entry = store.get(id);
  if (!entry) return;

  entry.workflow.plan = plan;
  entry.workflow.updatedAt = now();
}

/**
 * Update workflow after review
 */
export function updateReview(id: string, result: ReviewResult): void {
  const entry = store.get(id);
  if (!entry) return;

  entry.workflow.lastReview = result;
  entry.workflow.updatedAt = now();
}

/**
 * Increment iteration count
 */
export function incrementIterations(id: string): void {
  const entry = store.get(id);
  if (!entry) return;

  entry.workflow.iterations++;
  entry.workflow.updatedAt = now();
}

/**
 * Delete a workflow
 */
export function deleteWorkflow(id: string): boolean {
  return store.delete(id);
}

/**
 * Subscribe to workflow events (for SSE)
 */
export function subscribe(id: string, callback: EventCallback): () => void {
  const entry = store.get(id);
  if (!entry) {
    throw new Error(`Workflow ${id} not found`);
  }

  entry.subscribers.add(callback);

  // Return unsubscribe function
  return () => {
    entry.subscribers.delete(callback);
  };
}

/**
 * Notify subscribers that an operation is done
 */
export function notifyDone(id: string): void {
  const entry = store.get(id);
  if (!entry) return;

  for (const callback of entry.subscribers) {
    callback({ type: "done" });
  }
}

/**
 * Emit an error to all subscribers
 */
export function emitError(id: string, error: string): void {
  const entry = store.get(id);
  if (!entry) return;

  for (const callback of entry.subscribers) {
    callback({ type: "error", error });
  }
}

/**
 * List all workflow IDs (for debugging)
 */
export function listWorkflows(): string[] {
  return Array.from(store.keys());
}

/**
 * Get pending questions for a workflow
 */
export function getPendingQuestions(id: string): ClarifyingQuestion[] | undefined {
  return store.get(id)?.pendingQuestions;
}

/**
 * Clear pending questions after they've been answered
 */
export function clearPendingQuestions(id: string): void {
  const entry = store.get(id);
  if (entry) {
    entry.pendingQuestions = undefined;
  }
}

/**
 * Get pending playbook for a workflow
 */
export function getPendingPlaybook(id: string): Playbook | undefined {
  return store.get(id)?.pendingPlaybook;
}

/**
 * Clear pending playbook after it's been accepted/rejected
 */
export function clearPendingPlaybook(id: string): void {
  const entry = store.get(id);
  if (entry) {
    entry.pendingPlaybook = undefined;
  }
}
