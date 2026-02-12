/**
 * Orchestrator
 *
 * The brain of Architecta. Manages the workflow:
 * 1. Planning (plan gen + stress test)
 * 2. Review (verify implementation against spec)
 * 3. Routing (auto-approve / human glance / iterate / escalate)
 *
 * The orchestrator is NOT an LLM - it's deterministic TypeScript code
 * that spawns Claude sessions for planning and review.
 */

import { randomUUID } from "crypto";
import type {
  OrchestratorConfig,
  WorkflowState,
  Plan,
  Implementation,
  ReviewResult,
  SessionEvent,
} from "../types.js";
import {
  createWorkflow,
  startPlanning,
  completePlanning,
  startReview,
  completeReview,
  completeWorkflow,
  startIteration,
  getStateSummary,
} from "./state.js";
import { runReviewSession } from "../sessions/reviewer.js";
import { runResearchSession } from "../sessions/researcher.js";
import {
  runToolBasedPlanningSession,
  continueWithAnswers,
  acceptPlaybook as acceptPlaybookSession,
  rejectPlaybook as rejectPlaybookSession,
  refineToolBasedPlan,
  clearConversationState,
} from "../sessions/planner-tools.js";
import type { ResearchResult } from "../types.js";

const DEFAULT_CONFIG: OrchestratorConfig = {
  workDir: process.cwd(),
  maxIterations: 3,
  confidenceThresholds: {
    high: 90,
    medium: 70,
  },
  autoApproveHighConfidence: false, // Conservative default
};

export class Orchestrator {
  private config: OrchestratorConfig;
  private state: WorkflowState;
  private eventHandler?: (event: SessionEvent) => void;
  private planningContext: string = "";

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createWorkflow(randomUUID());
  }

  /**
   * Set event handler for streaming output
   */
  onEvent(handler: (event: SessionEvent) => void): void {
    this.eventHandler = handler;
  }

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return this.state;
  }

  /**
   * Get state summary
   */
  getSummary(): string {
    return getStateSummary(this.state);
  }

  /**
   * Start a new planning session
   * Returns the plan, or null if waiting for answers to clarifying questions
   */
  async plan(requirement: string): Promise<Plan | null> {
    this.state = startPlanning(this.state, requirement);
    this.planningContext = requirement;

    const plan = await runToolBasedPlanningSession(
      this.state.id,
      requirement,
      { workDir: this.config.workDir },
      this.eventHandler
    );

    if (plan) {
      this.state = completePlanning(this.state, plan);
    }
    // If null, we're waiting for answers to questions

    return plan;
  }

  /**
   * Answer clarifying questions and continue planning
   */
  async answerQuestions(answers: Record<string, string>): Promise<Plan | null> {
    const plan = await continueWithAnswers(
      this.state.id,
      answers,
      this.eventHandler
    );

    if (plan) {
      this.state = completePlanning(this.state, plan);
    }

    return plan;
  }

  /**
   * Accept the proposed playbook and continue to plan generation
   */
  async acceptPlaybook(): Promise<Plan | null> {
    const plan = await acceptPlaybookSession(
      this.state.id,
      this.eventHandler
    );

    if (plan) {
      this.state = completePlanning(this.state, plan);
    }

    return plan;
  }

  /**
   * Reject the proposed playbook with feedback
   */
  async rejectPlaybook(feedback: string): Promise<Plan | null> {
    const plan = await rejectPlaybookSession(
      this.state.id,
      feedback,
      this.eventHandler
    );

    if (plan) {
      this.state = completePlanning(this.state, plan);
    }

    return plan;
  }

  /**
   * Refine the current plan with feedback
   */
  async refinePlan(feedback: string): Promise<Plan | null> {
    if (!this.state.plan) {
      throw new Error("No plan to refine. Call plan() first.");
    }

    const plan = await refineToolBasedPlan(
      this.state.id,
      feedback,
      this.eventHandler
    );

    this.planningContext += `\n\nFeedback: ${feedback}`;
    if (plan) {
      this.state = completePlanning(this.state, plan);
    }

    return plan;
  }

  /**
   * Ask a research question (doesn't modify the plan)
   */
  async ask(question: string): Promise<ResearchResult> {
    const result = await runResearchSession(
      question,
      { workDir: this.config.workDir },
      this.eventHandler
    );

    // Emit research ready event
    if (this.eventHandler) {
      this.eventHandler({ type: "research_ready", result });
    }

    return result;
  }

  /**
   * Review an implementation against the current plan
   */
  async review(implementation: Implementation): Promise<ReviewResult> {
    if (!this.state.plan) {
      throw new Error("No plan to review against. Call plan() first.");
    }

    const plan = this.state.plan; // Capture before state transition
    this.state = startReview(this.state, implementation);

    const result = await runReviewSession(
      plan,
      implementation,
      { workDir: this.config.workDir },
      this.eventHandler
    );

    this.state = completeReview(this.state, result);

    return result;
  }

  /**
   * Route based on review result
   * Returns the action to take
   */
  route(result: ReviewResult): {
    action: "approve" | "human_review" | "iterate" | "escalate";
    reason: string;
  } {
    const { confidence, confidenceLevel, recommendedAction } = result;

    // High confidence: auto-approve if enabled
    if (confidenceLevel === "high") {
      if (this.config.autoApproveHighConfidence) {
        return { action: "approve", reason: `Confidence ${confidence}% - auto-approved` };
      }
      return { action: "human_review", reason: `Confidence ${confidence}% - quick approval needed` };
    }

    // Medium confidence: human quick review
    if (confidenceLevel === "medium") {
      return { action: "human_review", reason: `Confidence ${confidence}% - review recommended` };
    }

    // Low confidence: iterate or escalate
    if (this.state.iterations >= this.config.maxIterations) {
      return {
        action: "escalate",
        reason: `Max iterations (${this.config.maxIterations}) reached with low confidence`,
      };
    }

    if (recommendedAction.type === "escalate") {
      return {
        action: "escalate",
        reason: recommendedAction.reason,
      };
    }

    return {
      action: "iterate",
      reason: recommendedAction.type === "iterate"
        ? recommendedAction.reason
        : "Low confidence - iteration recommended",
    };
  }

  /**
   * Start an iteration cycle (revise plan based on review)
   */
  async iterate(reviewFeedback: string): Promise<Plan | null> {
    if (this.state.iterations >= this.config.maxIterations) {
      throw new Error(`Max iterations (${this.config.maxIterations}) reached`);
    }

    this.state = startIteration(this.state);

    const lastReview = this.state.reviews[this.state.reviews.length - 1];
    const iterationPrompt = buildIterationPrompt(lastReview, reviewFeedback);

    const plan = await refineToolBasedPlan(
      this.state.id,
      iterationPrompt,
      this.eventHandler
    );

    this.planningContext += `\n\nIteration ${this.state.iterations}: ${iterationPrompt}`;
    if (plan) {
      this.state = completePlanning(this.state, plan);
    }

    return plan;
  }

  /**
   * Mark workflow as complete
   */
  complete(): void {
    this.state = completeWorkflow(this.state);
  }

  /**
   * Reset to start a new workflow
   */
  reset(): void {
    clearConversationState(this.state.id);
    this.state = createWorkflow(randomUUID());
    this.planningContext = "";
  }
}

/**
 * Build prompt for iteration based on review feedback
 */
function buildIterationPrompt(
  review: ReviewResult,
  additionalFeedback: string
): string {
  let prompt = `The previous implementation was reviewed with ${review.confidence}% confidence.\n\n`;

  if (review.issues.length > 0) {
    prompt += `Issues found:\n`;
    for (const issue of review.issues) {
      prompt += `- ${issue}\n`;
    }
    prompt += "\n";
  }

  if (review.summary) {
    prompt += `Review summary: ${review.summary}\n\n`;
  }

  if (additionalFeedback) {
    prompt += `Additional feedback: ${additionalFeedback}\n\n`;
  }

  prompt += `Please revise the plan to address these issues.`;

  return prompt;
}

/**
 * Create an orchestrator with config
 */
export function createOrchestrator(
  config: Partial<OrchestratorConfig> = {}
): Orchestrator {
  return new Orchestrator(config);
}
