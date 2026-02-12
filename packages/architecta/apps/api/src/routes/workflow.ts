/**
 * Workflow Routes
 *
 * CRUD operations for workflows.
 * Uses @palindrom/fastify-api for type-safe route definitions.
 */

import { defineRoute, registerRoute, z, AppError } from "@palindrom/fastify-api";
import type { FastifyInstance } from "fastify";
import {
  WorkflowSchema,
  CreateWorkflowRequestSchema,
  StartPlanRequestSchema,
  RefinePlanRequestSchema,
  StartReviewRequestSchema,
  AnswerQuestionsRequestSchema,
  AskQuestionRequestSchema,
  AcceptPlaybookRequestSchema,
  RejectPlaybookRequestSchema,
} from "../schemas.js";
import * as store from "../store/workflow-store.js";

// Default working directory for workflows
const DEFAULT_WORK_DIR = process.env.ARCHITECTA_WORK_DIR
  || "/Users/christopherlittle/Documents/GitHub/testing/architecta-testing";

/**
 * POST /workflow - Create a new workflow
 */
const createWorkflowRoute = defineRoute({
  method: "POST",
  url: "/workflow",
  auth: "public",
  tags: ["Workflow"],
  summary: "Create a new workflow",
  schema: {
    body: CreateWorkflowRequestSchema,
    response: {
      201: WorkflowSchema,
    },
  },
  handler: async (request, reply) => {
    const { workDir } = request.body;
    const workflow = store.createWorkflow(workDir || DEFAULT_WORK_DIR);
    reply.status(201);
    return workflow;
  },
});

/**
 * GET /workflow/:id - Get workflow by ID
 */
const getWorkflowRoute = defineRoute({
  method: "GET",
  url: "/workflow/:id",
  auth: "public",
  tags: ["Workflow"],
  summary: "Get workflow by ID",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    response: {
      200: WorkflowSchema,
    },
  },
  handler: async (request) => {
    const { id } = request.params;
    const workflow = store.getWorkflow(id);

    if (!workflow) {
      throw AppError.notFound("Workflow", id);
    }

    return workflow;
  },
});

/**
 * DELETE /workflow/:id - Delete workflow
 */
const deleteWorkflowRoute = defineRoute({
  method: "DELETE",
  url: "/workflow/:id",
  auth: "public",
  tags: ["Workflow"],
  summary: "Delete workflow",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    response: {
      204: z.null(),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const deleted = store.deleteWorkflow(id);

    if (!deleted) {
      throw AppError.notFound("Workflow", id);
    }

    reply.status(204);
    return null;
  },
});

/**
 * POST /workflow/:id/plan - Start planning
 */
const startPlanRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/plan",
  auth: "public",
  tags: ["Planning"],
  summary: "Start planning with a requirement",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: StartPlanRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { requirement } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    // Update phase
    store.updatePhase(id, "planning");

    // Start planning asynchronously
    orchestrator.plan(requirement).then((plan) => {
      if (plan) {
        store.updatePlan(id, plan);
      }
      // If plan is null, we're waiting for answers to questions (event already emitted)
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Planning error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Planning started",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/plan/refine - Refine current plan
 */
const refinePlanRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/plan/refine",
  auth: "public",
  tags: ["Planning"],
  summary: "Refine the current plan with feedback",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: RefinePlanRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { feedback } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    const workflow = store.getWorkflow(id);
    if (!workflow?.plan) {
      throw AppError.badRequest("No plan to refine. Start planning first.");
    }

    // Update phase
    store.updatePhase(id, "planning");

    // Refine asynchronously
    orchestrator.refinePlan(feedback).then((plan) => {
      if (plan) {
        store.updatePlan(id, plan);
      }
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Refine error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Refinement started",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/plan/answer - Answer clarifying questions
 */
const answerQuestionsRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/plan/answer",
  auth: "public",
  tags: ["Planning"],
  summary: "Answer clarifying questions from the planner",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: AnswerQuestionsRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { answers } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    const pendingQuestions = store.getPendingQuestions(id);
    if (!pendingQuestions || pendingQuestions.length === 0) {
      throw AppError.badRequest("No pending questions to answer.");
    }

    // Clear pending questions
    store.clearPendingQuestions(id);

    // Update phase
    store.updatePhase(id, "planning");

    // Convert answers to simple string values
    const simpleAnswers: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      simpleAnswers[key] = Array.isArray(value) ? value[0] : value;
    }

    // Continue planning with the answers using the orchestrator's answerQuestions method
    orchestrator.answerQuestions(simpleAnswers).then((plan) => {
      if (plan) {
        store.updatePlan(id, plan);
      }
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Answer questions error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Answers submitted, continuing planning",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/playbook/accept - Accept proposed playbook
 */
const acceptPlaybookRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/playbook/accept",
  auth: "public",
  tags: ["Planning"],
  summary: "Accept the proposed playbook and continue to plan generation",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: AcceptPlaybookRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    const pendingPlaybook = store.getPendingPlaybook(id);
    if (!pendingPlaybook) {
      throw AppError.badRequest("No pending playbook to accept.");
    }

    // Clear pending playbook
    store.clearPendingPlaybook(id);

    // Update phase
    store.updatePhase(id, "planning");

    // Accept playbook and continue to plan generation
    orchestrator.acceptPlaybook().then((plan) => {
      if (plan) {
        store.updatePlan(id, plan);
      }
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Accept playbook error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Playbook accepted, generating plan",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/playbook/reject - Reject proposed playbook
 */
const rejectPlaybookRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/playbook/reject",
  auth: "public",
  tags: ["Planning"],
  summary: "Reject the proposed playbook with feedback",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: RejectPlaybookRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { feedback } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    const pendingPlaybook = store.getPendingPlaybook(id);
    if (!pendingPlaybook) {
      throw AppError.badRequest("No pending playbook to reject.");
    }

    // Clear pending playbook
    store.clearPendingPlaybook(id);

    // Update phase
    store.updatePhase(id, "planning");

    // Reject playbook and continue
    orchestrator.rejectPlaybook(feedback).then((plan) => {
      if (plan) {
        store.updatePlan(id, plan);
      }
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Reject playbook error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Playbook rejected, reconsidering",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/plan/approve - Approve current plan
 */
const approvePlanRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/plan/approve",
  auth: "public",
  tags: ["Planning"],
  summary: "Approve the current plan",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    response: {
      200: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request) => {
    const { id } = request.params;

    const workflow = store.getWorkflow(id);
    if (!workflow) {
      throw AppError.notFound("Workflow", id);
    }

    if (!workflow.plan) {
      throw AppError.badRequest("No plan to approve. Start planning first.");
    }

    // Plan approved - could trigger Fabrica here in the future
    return {
      message: "Plan approved",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/review - Start review
 */
const startReviewRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/review",
  auth: "public",
  tags: ["Review"],
  summary: "Review an implementation against the plan",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: StartReviewRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { type, identifier } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    const workflow = store.getWorkflow(id);
    if (!workflow?.plan) {
      throw AppError.badRequest("No plan to review against. Create a plan first.");
    }

    // Update phase
    store.updatePhase(id, "reviewing");

    // Start review asynchronously
    orchestrator.review({ type, identifier }).then((result) => {
      store.updateReview(id, {
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
        issues: result.issues,
        summary: result.summary,
      });
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Review error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Review started",
      workflowId: id,
    };
  },
});

/**
 * POST /workflow/:id/ask - Ask a research question
 */
const askQuestionRoute = defineRoute({
  method: "POST",
  url: "/workflow/:id/ask",
  auth: "public",
  tags: ["Research"],
  summary: "Ask a research question (does not modify the plan)",
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: AskQuestionRequestSchema,
    response: {
      202: z.object({
        message: z.string(),
        workflowId: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { question } = request.body;

    const orchestrator = store.getOrchestrator(id);
    if (!orchestrator) {
      throw AppError.notFound("Workflow", id);
    }

    // Start research asynchronously (doesn't change phase or plan)
    orchestrator.ask(question).then(() => {
      store.notifyDone(id);
    }).catch((error) => {
      console.error("Research error:", error);
      store.emitError(id, error instanceof Error ? error.message : String(error));
      store.notifyDone(id);
    });

    reply.status(202);
    return {
      message: "Research started",
      workflowId: id,
    };
  },
});

/**
 * Register all workflow routes
 */
export function registerWorkflowRoutes(app: FastifyInstance): void {
  registerRoute(app, createWorkflowRoute);
  registerRoute(app, getWorkflowRoute);
  registerRoute(app, deleteWorkflowRoute);
  registerRoute(app, startPlanRoute);
  registerRoute(app, refinePlanRoute);
  registerRoute(app, answerQuestionsRoute);
  registerRoute(app, acceptPlaybookRoute);
  registerRoute(app, rejectPlaybookRoute);
  registerRoute(app, approvePlanRoute);
  registerRoute(app, startReviewRoute);
  registerRoute(app, askQuestionRoute);
}
