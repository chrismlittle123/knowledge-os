/**
 * API Client for Architecta
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface Workflow {
  id: string;
  phase: "idle" | "planning" | "reviewing" | "complete";
  requirement?: string;
  plan?: Plan;
  lastReview?: ReviewResult;
  iterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  raw: string;
  repo: string;
  flow: string[];
  title: string;
  playbook: Playbook;
  tasks: Task[];
}

export type RiskLevel = "high" | "medium" | "low";
export type ComplexityLevel = "high" | "medium" | "low";
export type HumanRole = "must_do" | "must_verify";

// Human action types - what specifically the human must do
export type HumanActionType =
  // Authentication & Credentials
  | "external_auth"        // Login to third-party service
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
  | "other";               // Other human action

export type PlaybookType =
  | "greenfield"
  | "new_feature"
  | "redesign"
  | "refactor"
  | "pivot"
  | "hotfix"
  | "optimisation"
  | "migration"
  | "integration";

export interface Playbook {
  type: PlaybookType;
  name: string;
  description: string;
  reasoning: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  humanRole: HumanRole;
  humanActionType?: HumanActionType; // Required for must_do tasks
  humanActionDetail?: string; // Detailed instructions for what human must do
  risk: RiskLevel;
  complexity: ComplexityLevel;
  dependsOn: number[];
  requirements: string[];
  acceptanceCriteria: string[];
}

export interface ReviewResult {
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  issues: string[];
  summary: string;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
  allowMultiple?: boolean;
}

export interface ResearchResult {
  answer: string;
  sources: string[];
}

export type SSEEvent =
  | { type: "thinking"; message: string }
  | { type: "output"; text: string }
  | { type: "questions"; questions: ClarifyingQuestion[] }
  | { type: "playbookProposed"; playbook: Playbook }
  | { type: "planReady"; plan: Plan }
  | { type: "reviewReady"; result: ReviewResult }
  | { type: "researchReady"; result: ResearchResult }
  | { type: "phaseChange"; phase: Workflow["phase"] }
  | { type: "error"; error: string }
  | { type: "done" };

/**
 * Create a new workflow
 */
export async function createWorkflow(workDir?: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workDir }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create workflow: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(id: string): Promise<Workflow> {
  const response = await fetch(`${API_BASE}/workflow/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Start planning with a requirement
 */
export async function startPlan(
  id: string,
  requirement: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start planning: ${response.statusText}`);
  }
}

/**
 * Refine the current plan with feedback
 */
export async function refinePlan(id: string, feedback: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/plan/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refine plan: ${response.statusText}`);
  }
}

/**
 * Answer clarifying questions
 */
export async function answerQuestions(
  id: string,
  answers: Record<string, string | string[]>
): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/plan/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    throw new Error(`Failed to answer questions: ${response.statusText}`);
  }
}

/**
 * Accept the proposed playbook
 */
export async function acceptPlaybook(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/playbook/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to accept playbook: ${response.statusText}`);
  }
}

/**
 * Reject the proposed playbook with feedback
 */
export async function rejectPlaybook(id: string, feedback: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/playbook/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reject playbook: ${response.statusText}`);
  }
}

/**
 * Approve the current plan
 */
export async function approvePlan(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/plan/approve`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to approve plan: ${response.statusText}`);
  }
}

/**
 * Ask a research question
 */
export async function askQuestion(id: string, question: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`Failed to ask question: ${response.statusText}`);
  }
}

/**
 * Start review of an implementation
 */
export async function startReview(
  id: string,
  type: "pr" | "branch" | "local",
  identifier: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, identifier }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start review: ${response.statusText}`);
  }
}

/**
 * Subscribe to workflow SSE events
 */
export function subscribeToWorkflow(
  id: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/workflow/${id}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SSEEvent;
      onEvent(data);
    } catch (err) {
      console.error("Failed to parse SSE event:", err);
    }
  };

  eventSource.onerror = () => {
    onError?.(new Error("SSE connection error"));
    eventSource.close();
  };

  // Return unsubscribe function
  return () => {
    eventSource.close();
  };
}
