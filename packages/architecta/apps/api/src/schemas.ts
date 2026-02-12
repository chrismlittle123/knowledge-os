/**
 * API Schemas (Zod)
 *
 * Single source of truth for API types.
 * Follows data conventions: camelCase, prefixed IDs, ISO dates.
 */

import { z } from "@palindrom/fastify-api";

// Workflow phases
export const PhaseSchema = z.enum(["idle", "planning", "reviewing", "complete"]);
export type Phase = z.infer<typeof PhaseSchema>;

// Confidence levels
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// Risk levels
export const RiskLevelSchema = z.enum(["high", "medium", "low"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// Complexity levels
export const ComplexityLevelSchema = z.enum(["high", "medium", "low"]);
export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;

// Human role for tasks
export const HumanRoleSchema = z.enum(["must_do", "must_verify"]);
export type HumanRole = z.infer<typeof HumanRoleSchema>;

// Human action types - what specifically the human must do
export const HumanActionTypeSchema = z.enum([
  // Authentication & Credentials
  "external_auth",        // Login to third-party service
  "create_oauth_app",     // Create OAuth application in external dashboard
  "generate_api_key",     // Generate API key/token in external service
  "oauth_consent",        // Click "Authorize" in OAuth consent flow
  "create_account",       // Create new account on external service
  "mfa_setup",            // Set up multi-factor authentication
  // Publishing & Deployment
  "first_publish",        // First-time publish to npm, PyPI, Docker Hub, etc.
  "deploy_approve",       // Approve production deployment
  "domain_setup",         // Configure DNS, domain settings
  "ssl_setup",            // Configure SSL certificates
  // Billing & Payments
  "billing_setup",        // Enter payment info, set up billing
  "plan_upgrade",         // Upgrade service tier/plan
  // Verification
  "email_verify",         // Click email verification link
  "phone_verify",         // Enter SMS code
  "identity_verify",      // Submit identity documents
  "captcha",              // Complete CAPTCHA challenge
  // Access & Permissions
  "grant_access",         // Add collaborators, grant permissions
  "accept_invite",        // Accept invitation to org/repo/service
  "permission_request",   // Request elevated permissions
  // Review & Approval
  "design_decision",      // Make subjective design choice
  "review_approve",       // Review and approve work
  "legal_accept",         // Accept terms of service, legal agreements
  // Physical & Network
  "hardware_setup",       // Physical device configuration
  "network_config",       // Network/firewall configuration
  // Other
  "manual_test",          // Manual testing that can't be automated
  "data_entry",           // Enter sensitive data manually
  "other",                // Other human action
]);
export type HumanActionType = z.infer<typeof HumanActionTypeSchema>;

// Playbook types
export const PlaybookTypeSchema = z.enum([
  "greenfield",
  "new_feature",
  "redesign",
  "refactor",
  "pivot",
  "hotfix",
  "optimisation",
  "migration",
  "integration",
]);
export type PlaybookType = z.infer<typeof PlaybookTypeSchema>;

// Playbook
export const PlaybookSchema = z.object({
  type: PlaybookTypeSchema,
  name: z.string(),
  description: z.string(),
  reasoning: z.string(),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

// Task within a plan
export const TaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  humanRole: HumanRoleSchema,
  humanActionType: HumanActionTypeSchema.optional(), // Required for must_do tasks
  humanActionDetail: z.string().optional(), // Detailed instructions for what human must do
  risk: RiskLevelSchema,
  complexity: ComplexityLevelSchema,
  dependsOn: z.array(z.number()),
  requirements: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
});
export type Task = z.infer<typeof TaskSchema>;

// Plan
export const PlanSchema = z.object({
  raw: z.string(),
  repo: z.string(),
  flow: z.array(z.string()),
  title: z.string(),
  playbook: PlaybookSchema,
  tasks: z.array(TaskSchema),
});
export type Plan = z.infer<typeof PlanSchema>;

// Review result
export const ReviewResultSchema = z.object({
  confidence: z.number().min(0).max(100),
  confidenceLevel: ConfidenceLevelSchema,
  issues: z.array(z.string()),
  summary: z.string(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// Workflow (API response shape)
export const WorkflowSchema = z.object({
  id: z.string(), // wfl_xxx
  phase: PhaseSchema,
  requirement: z.string().optional(),
  plan: PlanSchema.optional(),
  lastReview: ReviewResultSchema.optional(),
  iterations: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// Request schemas
export const CreateWorkflowRequestSchema = z.object({
  workDir: z.string().optional(),
});

export const StartPlanRequestSchema = z.object({
  requirement: z.string().min(1),
});

export const RefinePlanRequestSchema = z.object({
  feedback: z.string().min(1),
});

export const StartReviewRequestSchema = z.object({
  type: z.enum(["pr", "branch", "local"]),
  identifier: z.string(),
});

// Clarifying question option
export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

// Clarifying question
export const ClarifyingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(QuestionOptionSchema),
  allowMultiple: z.boolean().optional(),
});
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

// Answer questions request
export const AnswerQuestionsRequestSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});
export type AnswerQuestionsRequest = z.infer<typeof AnswerQuestionsRequestSchema>;

// Ask question request
export const AskQuestionRequestSchema = z.object({
  question: z.string().min(1),
});
export type AskQuestionRequest = z.infer<typeof AskQuestionRequestSchema>;

// Research result
export const ResearchResultSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

// SSE event types
export const SSEEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("thinking"), message: z.string() }),
  z.object({ type: z.literal("output"), text: z.string() }),
  z.object({ type: z.literal("questions"), questions: z.array(ClarifyingQuestionSchema) }),
  z.object({ type: z.literal("playbookProposed"), playbook: PlaybookSchema }),
  z.object({ type: z.literal("planReady"), plan: PlanSchema }),
  z.object({ type: z.literal("reviewReady"), result: ReviewResultSchema }),
  z.object({ type: z.literal("researchReady"), result: ResearchResultSchema }),
  z.object({ type: z.literal("phaseChange"), phase: PhaseSchema }),
  z.object({ type: z.literal("error"), error: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type SSEEvent = z.infer<typeof SSEEventSchema>;

// Playbook accept/reject request
export const AcceptPlaybookRequestSchema = z.object({});
export type AcceptPlaybookRequest = z.infer<typeof AcceptPlaybookRequestSchema>;

export const RejectPlaybookRequestSchema = z.object({
  feedback: z.string().min(1),
});
export type RejectPlaybookRequest = z.infer<typeof RejectPlaybookRequestSchema>;
