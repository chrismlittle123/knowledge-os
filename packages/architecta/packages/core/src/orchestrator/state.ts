/**
 * Workflow State Machine
 *
 * Manages the state of a planning/review workflow.
 * Transitions: idle -> planning -> reviewing -> complete
 *              (with iteration loops back to planning)
 */

import type {
  WorkflowState,
  Phase,
  Plan,
  Implementation,
  ReviewResult,
} from "../types.js";

/**
 * Create a new workflow state
 */
export function createWorkflow(id: string): WorkflowState {
  return {
    id,
    phase: "idle",
    reviews: [],
    iterations: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Start planning phase
 */
export function startPlanning(
  state: WorkflowState,
  requirement: string
): WorkflowState {
  return {
    ...state,
    phase: "planning",
    requirement,
    updatedAt: new Date(),
  };
}

/**
 * Complete planning phase with a plan
 */
export function completePlanning(
  state: WorkflowState,
  plan: Plan
): WorkflowState {
  return {
    ...state,
    plan,
    updatedAt: new Date(),
  };
}

/**
 * Start review phase
 */
export function startReview(
  state: WorkflowState,
  implementation: Implementation
): WorkflowState {
  return {
    ...state,
    phase: "reviewing",
    implementation,
    updatedAt: new Date(),
  };
}

/**
 * Complete review phase with result
 */
export function completeReview(
  state: WorkflowState,
  result: ReviewResult
): WorkflowState {
  return {
    ...state,
    reviews: [...state.reviews, result],
    updatedAt: new Date(),
  };
}

/**
 * Mark workflow as complete
 */
export function completeWorkflow(state: WorkflowState): WorkflowState {
  return {
    ...state,
    phase: "complete",
    updatedAt: new Date(),
  };
}

/**
 * Start iteration (back to planning with feedback)
 */
export function startIteration(state: WorkflowState): WorkflowState {
  return {
    ...state,
    phase: "planning",
    iterations: state.iterations + 1,
    updatedAt: new Date(),
  };
}

/**
 * Check if workflow can transition to a phase
 */
export function canTransitionTo(state: WorkflowState, phase: Phase): boolean {
  switch (phase) {
    case "idle":
      return false; // Can't go back to idle
    case "planning":
      return state.phase === "idle" || state.phase === "reviewing";
    case "reviewing":
      return state.phase === "planning" && state.plan !== undefined;
    case "complete":
      return state.phase === "reviewing";
    default:
      return false;
  }
}

/**
 * Get a summary of the current state
 */
export function getStateSummary(state: WorkflowState): string {
  const lines: string[] = [
    `Workflow: ${state.id}`,
    `Phase: ${state.phase}`,
    `Iterations: ${state.iterations}`,
  ];

  if (state.requirement) {
    lines.push(`Requirement: ${state.requirement.slice(0, 50)}...`);
  }

  if (state.plan) {
    lines.push(`Plan: ${state.plan.title}`);
    lines.push(`Tasks: ${state.plan.tasks.length}`);
  }

  if (state.reviews.length > 0) {
    const lastReview = state.reviews[state.reviews.length - 1];
    lines.push(`Last Review: ${lastReview.confidence}% confidence`);
    lines.push(`Recommendation: ${lastReview.recommendedAction.type}`);
  }

  return lines.join("\n");
}
