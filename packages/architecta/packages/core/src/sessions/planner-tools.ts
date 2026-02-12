/**
 * Planning Session with Tool-Based Questions
 *
 * Uses the Anthropic SDK directly with a custom tool for asking clarifying questions.
 * This guarantees structured question output instead of relying on markdown parsing.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { PLANNER_SYSTEM_PROMPT } from "../prompts/planner.js";
import type { Plan, Task, SessionEvent, ClarifyingQuestion, Playbook, PlaybookType } from "../types.js";

let client: Anthropic | null = null;

/**
 * Initialize the Anthropic client with an API key
 */
export function initAnthropicClient(apiKey: string): void {
  client = new Anthropic({ apiKey });
}

/**
 * Get the Anthropic client (throws if not initialized)
 */
function getClient(): Anthropic {
  if (!client) {
    // Fallback to environment variable for backward compatibility
    client = new Anthropic();
  }
  return client;
}

export interface PlannerOptions {
  workDir: string;
}

// Tool definition for asking clarifying questions
const ASK_QUESTIONS_TOOL: Tool = {
  name: "ask_clarifying_questions",
  description: "Ask the user clarifying questions before creating a plan. Use this when you need more information about requirements, preferences, or constraints.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        description: "List of questions to ask the user",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique identifier for this question (e.g., 'q1', 'app_type')",
            },
            question: {
              type: "string",
              description: "The question to ask the user",
            },
            options: {
              type: "array",
              description: "Available options for the user to choose from (2-4 options)",
              items: {
                type: "object",
                properties: {
                  value: {
                    type: "string",
                    description: "Machine-readable value (e.g., 'web_app', 'cli')",
                  },
                  label: {
                    type: "string",
                    description: "Human-readable label (e.g., 'Web Application')",
                  },
                  description: {
                    type: "string",
                    description: "Brief description of this option",
                  },
                },
                required: ["value", "label"],
              },
            },
          },
          required: ["id", "question", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

// Tool for proposing a playbook based on gathered information
const PROPOSE_PLAYBOOK_TOOL: Tool = {
  name: "propose_playbook",
  description: "Propose a playbook (workflow template) based on the user's requirements. Use this after gathering enough information to determine the type of work.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["greenfield", "new_feature", "redesign", "refactor", "pivot", "hotfix", "optimisation", "migration", "integration"],
        description: "The playbook type that best fits this work",
      },
      name: {
        type: "string",
        description: "Human-readable name for this playbook (e.g., 'New Feature: User Authentication')",
      },
      description: {
        type: "string",
        description: "Brief description of what this playbook will accomplish",
      },
      reasoning: {
        type: "string",
        description: "Explain why this playbook was chosen based on the user's requirements",
      },
    },
    required: ["type", "name", "description", "reasoning"],
  },
};

// Tool for outputting the final plan
const OUTPUT_PLAN_TOOL: Tool = {
  name: "output_plan",
  description: "Output the final implementation plan after the user has accepted the playbook",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title of the plan",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      flow: {
        type: "array",
        items: { type: "string" },
        description: "Execution flow (e.g., ['builder', 'tester', 'reviewer'])",
      },
      tasks: {
        type: "array",
        description: "List of tasks in the plan. Each task must specify risk, complexity, dependencies, and human role.",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            description: { type: "string" },
            humanRole: {
              type: "string",
              enum: ["must_do", "must_verify"],
              description: "must_do = human performs this task; must_verify = agent can do it but human must check/approve",
            },
            humanActionType: {
              type: "string",
              enum: [
                "external_auth", "create_oauth_app", "generate_api_key", "oauth_consent", "create_account", "mfa_setup",
                "first_publish", "deploy_approve", "domain_setup", "ssl_setup",
                "billing_setup", "plan_upgrade",
                "email_verify", "phone_verify", "identity_verify", "captcha",
                "grant_access", "accept_invite", "permission_request",
                "design_decision", "review_approve", "legal_accept",
                "hardware_setup", "network_config",
                "manual_test", "data_entry", "other"
              ],
              description: "REQUIRED for must_do tasks. Specifies WHAT the human must do. See system prompt for full descriptions.",
            },
            humanActionDetail: {
              type: "string",
              description: "REQUIRED for must_do tasks. Detailed instructions for what the human needs to do (e.g., 'Log into Spotify Developer Dashboard at developer.spotify.com and create new app')",
            },
            risk: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Risk level if this task is done incorrectly. high = security/data issues, medium = functionality issues, low = cosmetic/minor issues",
            },
            complexity: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Implementation complexity. high = architectural changes or many files, medium = moderate changes, low = simple/straightforward",
            },
            dependsOn: {
              type: "array",
              items: { type: "number" },
              description: "Array of task IDs that must be completed before this task can start",
            },
            requirements: {
              type: "array",
              items: { type: "string" },
            },
            acceptanceCriteria: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["id", "title", "description", "humanRole", "risk", "complexity", "dependsOn", "requirements", "acceptanceCriteria"],
        },
      },
    },
    required: ["title", "tasks"],
  },
};

interface ConversationState {
  messages: MessageParam[];
  pendingQuestions: ClarifyingQuestion[] | null;
  pendingPlaybook: Playbook | null;
  acceptedPlaybook: Playbook | null;
  lastToolUseId: string | null;
}

// Store conversation state per workflow
const conversationStates = new Map<string, ConversationState>();

/**
 * Run a planning session with tool-based question asking
 */
export async function runToolBasedPlanningSession(
  workflowId: string,
  requirement: string,
  options: PlannerOptions,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan | null> {
  const emit = onEvent ?? (() => {});

  emit({ type: "thinking", message: "Starting planning session..." });

  // Initialize conversation state
  const state: ConversationState = {
    messages: [
      {
        role: "user",
        content: `Working directory: ${options.workDir}\n\nRequirement: ${requirement}`,
      },
    ],
    pendingQuestions: null,
    pendingPlaybook: null,
    acceptedPlaybook: null,
    lastToolUseId: null,
  };
  conversationStates.set(workflowId, state);

  return await runConversationLoop(workflowId, emit);
}

/**
 * Continue planning with answers to questions
 */
export async function continueWithAnswers(
  workflowId: string,
  answers: Record<string, string>,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan | null> {
  const emit = onEvent ?? (() => {});
  const state = conversationStates.get(workflowId);

  if (!state || !state.pendingQuestions) {
    throw new Error("No pending questions to answer");
  }

  emit({ type: "thinking", message: "Processing your answers..." });

  // Format answers as tool result
  const formattedAnswers = state.pendingQuestions.map((q) => {
    const answer = answers[q.id];
    const option = q.options.find((o) => o.value === answer);
    return `${q.question}: ${option?.label || answer}`;
  }).join("\n");

  // Add tool result to conversation using the actual tool_use_id from Claude's response
  const toolUseId = state.lastToolUseId || "questions_answered";
  state.messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `User's answers:\n${formattedAnswers}\n\nPlease proceed with creating the plan based on these choices.`,
      },
    ],
  });

  state.pendingQuestions = null;

  return await runConversationLoop(workflowId, emit);
}

/**
 * Accept the proposed playbook and continue to plan generation
 */
export async function acceptPlaybook(
  workflowId: string,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan | null> {
  const emit = onEvent ?? (() => {});
  const state = conversationStates.get(workflowId);

  if (!state || !state.pendingPlaybook) {
    throw new Error("No pending playbook to accept");
  }

  emit({ type: "thinking", message: "Generating detailed plan..." });

  // Mark the playbook as accepted
  state.acceptedPlaybook = state.pendingPlaybook;

  // Add tool result to conversation
  const toolUseId = state.lastToolUseId || "playbook_accepted";
  state.messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `User has accepted the "${state.pendingPlaybook.name}" playbook. Now create the detailed implementation plan using the output_plan tool.`,
      },
    ],
  });

  state.pendingPlaybook = null;

  return await runConversationLoop(workflowId, emit);
}

/**
 * Reject the playbook and suggest a different one
 */
export async function rejectPlaybook(
  workflowId: string,
  feedback: string,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan | null> {
  const emit = onEvent ?? (() => {});
  const state = conversationStates.get(workflowId);

  if (!state || !state.pendingPlaybook) {
    throw new Error("No pending playbook to reject");
  }

  emit({ type: "thinking", message: "Reconsidering playbook..." });

  // Add tool result with rejection
  const toolUseId = state.lastToolUseId || "playbook_rejected";
  state.messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `User rejected the playbook. Feedback: ${feedback}\n\nPlease propose a different playbook or ask clarifying questions.`,
      },
    ],
  });

  state.pendingPlaybook = null;

  return await runConversationLoop(workflowId, emit);
}

/**
 * Refine the plan with feedback
 */
export async function refineToolBasedPlan(
  workflowId: string,
  feedback: string,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan | null> {
  const emit = onEvent ?? (() => {});
  const state = conversationStates.get(workflowId);

  if (!state) {
    throw new Error("No conversation state found");
  }

  emit({ type: "thinking", message: "Refining plan..." });

  // Add feedback to conversation
  state.messages.push({
    role: "user",
    content: `Please refine the plan based on this feedback:\n\n${feedback}`,
  });

  return await runConversationLoop(workflowId, emit);
}

/**
 * Main conversation loop
 */
async function runConversationLoop(
  workflowId: string,
  emit: (event: SessionEvent) => void
): Promise<Plan | null> {
  const state = conversationStates.get(workflowId);
  if (!state) throw new Error("No conversation state");

  let response;
  try {
    response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: PLANNER_SYSTEM_PROMPT + `

IMPORTANT: You have access to three tools. Use them in this order:
1. ask_clarifying_questions - Ask questions to understand requirements
2. propose_playbook - After gathering info, propose a playbook (workflow template)
3. output_plan - After playbook is accepted, output the detailed plan

Flow: Questions → Playbook → Plan

Playbook types:
- greenfield: New project from scratch
- new_feature: Adding functionality to existing project
- redesign: UI/UX overhaul of existing feature
- refactor: Improve code without changing behavior
- pivot: Major architectural change
- hotfix: Urgent production fix
- optimisation: Performance improvements
- migration: Moving between technologies/platforms
- integration: Connecting external systems`,
    tools: [ASK_QUESTIONS_TOOL, PROPOSE_PLAYBOOK_TOOL, OUTPUT_PLAN_TOOL],
    messages: state.messages,
  });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    emit({ type: "error", error: `Planning failed: ${errorMessage}` });
    throw error;
  }

  // Process the response
  let plan: Plan | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      emit({ type: "output", text: block.text });
    } else if (block.type === "tool_use") {
      if (block.name === "ask_clarifying_questions") {
        // Extract questions from tool call
        const input = block.input as { questions: ClarifyingQuestion[] };
        state.pendingQuestions = input.questions;
        state.lastToolUseId = block.id; // Save for tool result response

        // Add assistant message to conversation for continuity
        state.messages.push({
          role: "assistant",
          content: response.content,
        });

        emit({ type: "questions", questions: input.questions });
        return null; // Waiting for answers
      } else if (block.name === "propose_playbook") {
        // Extract playbook from tool call
        const input = block.input as {
          type: PlaybookType;
          name: string;
          description: string;
          reasoning: string;
        };

        const playbook: Playbook = {
          type: input.type,
          name: input.name,
          description: input.description,
          reasoning: input.reasoning,
        };

        state.pendingPlaybook = playbook;
        state.lastToolUseId = block.id;

        // Add assistant message to conversation for continuity
        state.messages.push({
          role: "assistant",
          content: response.content,
        });

        emit({ type: "playbook_proposed", playbook });
        return null; // Waiting for playbook acceptance
      } else if (block.name === "output_plan") {
        // Extract plan from tool call
        const input = block.input as {
          title: string;
          repo?: string;
          flow?: string[];
          tasks: Array<Omit<Task, "status"> & {
            humanRole?: string;
            risk?: string;
            complexity?: string;
            dependsOn?: number[];
          }>;
        };

        // Add default status to all tasks and ensure all fields have defaults
        const tasksWithStatus: Task[] = input.tasks.map((task) => ({
          ...task,
          humanRole: (task.humanRole as Task["humanRole"]) || "must_verify",
          risk: (task.risk as Task["risk"]) || "medium",
          complexity: (task.complexity as Task["complexity"]) || "medium",
          dependsOn: task.dependsOn || [],
          status: "pending" as const,
        }));

        // Use accepted playbook or create a default one
        const playbook: Playbook = state.acceptedPlaybook || {
          type: "new_feature",
          name: "New Feature",
          description: "Adding new functionality",
          reasoning: "Default playbook",
        };

        plan = {
          raw: JSON.stringify(input, null, 2),
          repo: input.repo || "",
          flow: input.flow || ["builder", "tester", "reviewer"],
          title: input.title,
          playbook,
          tasks: tasksWithStatus,
        };

        emit({ type: "plan_ready", plan });
      }
    }
  }

  // If we got here without a tool call, the model responded with text only
  // Add to conversation and check if it's asking questions naturally
  if (response.stop_reason === "end_turn" && !plan) {
    state.messages.push({
      role: "assistant",
      content: response.content,
    });

    // Prompt it to use the tools
    state.messages.push({
      role: "user",
      content: "Please use ask_clarifying_questions if you need more information, propose_playbook to suggest a workflow template, or output_plan to provide the structured plan.",
    });

    return await runConversationLoop(workflowId, emit);
  }

  return plan;
}

/**
 * Clean up conversation state
 */
export function clearConversationState(workflowId: string): void {
  conversationStates.delete(workflowId);
}

/**
 * Check if there are pending questions
 */
export function hasPendingQuestions(workflowId: string): boolean {
  return conversationStates.get(workflowId)?.pendingQuestions !== null;
}

/**
 * Get pending questions
 */
export function getPendingQuestions(workflowId: string): ClarifyingQuestion[] | null {
  return conversationStates.get(workflowId)?.pendingQuestions || null;
}

/**
 * Check if there is a pending playbook
 */
export function hasPendingPlaybook(workflowId: string): boolean {
  return conversationStates.get(workflowId)?.pendingPlaybook !== null;
}

/**
 * Get pending playbook
 */
export function getPendingPlaybook(workflowId: string): Playbook | null {
  return conversationStates.get(workflowId)?.pendingPlaybook || null;
}
