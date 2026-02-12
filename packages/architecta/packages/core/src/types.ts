/**
 * Core types for Architecta
 */

// Workflow phases
export type Phase = "idle" | "planning" | "reviewing" | "complete";

// Confidence levels for routing decisions
export type ConfidenceLevel = "high" | "medium" | "low";

// Risk levels for tasks
export type RiskLevel = "high" | "medium" | "low";

// Complexity levels for tasks
export type ComplexityLevel = "high" | "medium" | "low";

// Playbook types - predefined flows for what you're building
export type PlaybookType =
  | "greenfield"      // New project from scratch
  | "new_feature"     // Adding functionality to existing project
  | "redesign"        // UI/UX overhaul of existing feature
  | "refactor"        // Improve code without changing behavior
  | "pivot"           // Major architectural change
  | "hotfix"          // Urgent production fix
  | "optimisation"    // Performance improvements
  | "migration"       // Moving between technologies/platforms
  | "integration";    // Connecting external systems

// Playbook definition
export interface Playbook {
  type: PlaybookType;
  name: string;
  description: string;
  reasoning: string; // Why this playbook was chosen
}

// Actions the orchestrator can take after review
export type ReviewAction =
  | { type: "approve" }
  | { type: "request_changes"; issues: string[] }
  | { type: "iterate"; reason: string }
  | { type: "escalate"; reason: string };

// A plan produced by the planning session
export interface Plan {
  raw: string; // Full markdown content
  repo: string;
  flow: string[];
  title: string;
  playbook: Playbook; // The playbook used for this plan
  tasks: Task[];
}

// Human involvement level for a task
export type HumanRole = "must_do" | "must_verify";

// Specific action types that require human intervention
export type HumanActionType =
  // Authentication & Credentials
  | "external_auth"        // Login to third-party service (Spotify, GitHub, AWS Console, etc.)
  | "create_oauth_app"     // Create OAuth application in external dashboard
  | "generate_api_key"     // Generate API key/token in external service
  | "oauth_consent"        // Click "Authorize" in OAuth consent flow
  | "create_account"       // Create new account on external service
  | "mfa_setup"            // Set up multi-factor authentication
  // Publishing & Deployment
  | "first_publish"        // First-time publish to npm, PyPI, Docker Hub, etc.
  | "deploy_approve"       // Approve production deployment
  | "domain_setup"         // Configure DNS, domain settings
  | "ssl_setup"            // Configure SSL certificates
  // Billing & Payments
  | "billing_setup"        // Enter payment info, set up billing
  | "plan_upgrade"         // Upgrade service tier/plan
  // Verification
  | "email_verify"         // Click email verification link
  | "phone_verify"         // Enter SMS code
  | "identity_verify"      // Submit identity documents
  | "captcha"              // Complete CAPTCHA challenge
  // Access & Permissions
  | "grant_access"         // Add collaborators, grant permissions
  | "accept_invite"        // Accept invitation to org/repo/service
  | "permission_request"   // Request elevated permissions
  // Review & Approval
  | "design_decision"      // Make subjective design choice
  | "review_approve"       // Review and approve work
  | "legal_accept"         // Accept terms of service, legal agreements
  // Physical & Network
  | "hardware_setup"       // Physical device configuration
  | "network_config"       // Network/firewall configuration
  // Other
  | "manual_test"          // Manual testing that can't be automated
  | "data_entry"           // Enter sensitive data manually
  | "other";               // Other human action (describe in humanActionDetail)

// A task within a plan
export interface Task {
  id: number;
  title: string;
  description: string;
  humanRole: HumanRole; // Whether human must do or just verify
  humanActionType?: HumanActionType; // What specifically the human must do (required if humanRole is "must_do")
  humanActionDetail?: string; // Additional detail about what the human must do
  risk: RiskLevel; // How risky is this task if done wrong
  complexity: ComplexityLevel; // How complex is this task to implement
  dependsOn: number[]; // Task IDs that must be completed first
  requirements: string[];
  acceptanceCriteria: string[];
  status?: "pending" | "in_progress" | "done"; // For tracking progress
}

// Result of a review session
export interface ReviewResult {
  planId: string;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  criteriaResults: CriteriaResult[];
  issues: string[];
  summary: string;
  recommendedAction: ReviewAction;
}

// Result of checking a single acceptance criterion
export interface CriteriaResult {
  taskId: number;
  criterion: string;
  passed: boolean;
  evidence: string;
}

// Implementation to review (could be PR, branch, or local changes)
export interface Implementation {
  type: "pr" | "branch" | "local";
  identifier: string; // PR URL, branch name, or path
  diff?: string; // Git diff if available
  files?: string[]; // Changed files
}

// Workflow state
export interface WorkflowState {
  id: string;
  phase: Phase;
  requirement?: string;
  plan?: Plan;
  implementation?: Implementation;
  reviews: ReviewResult[];
  iterations: number;
  createdAt: Date;
  updatedAt: Date;
}

// Configuration for the orchestrator
export interface OrchestratorConfig {
  workDir: string;
  maxIterations: number;
  confidenceThresholds: {
    high: number; // e.g., 90
    medium: number; // e.g., 70
  };
  autoApproveHighConfidence: boolean;
}

// A clarifying question from the planner
export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  allowMultiple?: boolean;
}

// Result of a research query
export interface ResearchResult {
  answer: string;
  sources: string[];
}

// Events emitted by sessions for streaming output
export type SessionEvent =
  | { type: "thinking"; message: string }
  | { type: "exploring"; file: string }
  | { type: "output"; text: string }
  | { type: "questions"; questions: ClarifyingQuestion[] }
  | { type: "playbook_proposed"; playbook: Playbook }
  | { type: "plan_ready"; plan: Plan }
  | { type: "review_ready"; result: ReviewResult }
  | { type: "research_ready"; result: ResearchResult }
  | { type: "error"; error: string };
