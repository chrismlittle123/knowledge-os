# Architecta - Existing Features

> Last updated: January 2026

This document describes all currently implemented features in Architecta.

---

## Overview

Architecta is an AI-powered software planning and review system. It helps developers create bulletproof implementation plans and reviews code against those plans.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│                    apps/web @ :3000                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API (Fastify)                           │
│                    apps/api @ :4000                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Core (packages/core)                      │
│  Orchestrator → Planner / Reviewer / Researcher Sessions    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Anthropic Claude API                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Workflow Management

A **Workflow** represents a single planning/review cycle.

**Phases:**
| Phase | Description |
|-------|-------------|
| `idle` | Initial state, no activity |
| `planning` | Generating or refining a plan |
| `reviewing` | Reviewing implementation against plan |
| `complete` | Workflow finished |

**API Endpoints:**
- `POST /workflow` - Create new workflow
- `GET /workflow/:id` - Get workflow by ID
- `DELETE /workflow/:id` - Delete workflow
- `GET /workflow/:id/stream` - SSE stream for real-time updates

---

### 2. Planning System

The planning system generates implementation plans through a multi-phase process.

#### Phase 1: Clarifying Questions

When requirements are ambiguous, the AI asks structured questions.

```typescript
interface ClarifyingQuestion {
  id: string;
  question: string;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  allowMultiple?: boolean;
}
```

**API Endpoint:** `POST /workflow/:id/plan/answer`

#### Phase 2: Playbook Selection

Based on answers, the AI proposes a **Playbook** (workflow template).

**Available Playbook Types:**
| Type | Description |
|------|-------------|
| `greenfield` | New project from scratch |
| `new_feature` | Adding functionality to existing project |
| `redesign` | UI/UX overhaul of existing feature |
| `refactor` | Improve code without changing behavior |
| `pivot` | Major architectural change |
| `hotfix` | Urgent production fix |
| `optimisation` | Performance improvements |
| `migration` | Moving between technologies/platforms |
| `integration` | Connecting external systems |

```typescript
interface Playbook {
  type: PlaybookType;
  name: string;
  description: string;
  reasoning: string; // Why this playbook was chosen
}
```

**API Endpoints:**
- `POST /workflow/:id/playbook/accept` - Accept proposed playbook
- `POST /workflow/:id/playbook/reject` - Reject with feedback

#### Phase 3: Plan Generation

After playbook acceptance, a detailed plan is generated.

```typescript
interface Plan {
  raw: string;        // Full markdown content
  repo: string;       // Repository name
  flow: string[];     // Execution flow (e.g., ['builder', 'tester', 'reviewer'])
  title: string;      // Plan title
  playbook: Playbook; // The playbook used
  tasks: Task[];      // List of tasks
}
```

**API Endpoints:**
- `POST /workflow/:id/plan` - Start planning with requirement
- `POST /workflow/:id/plan/refine` - Refine plan with feedback
- `POST /workflow/:id/plan/approve` - Approve final plan

---

### 3. Task System

Each plan contains structured **Tasks** with rich metadata.

```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  humanRole: HumanRole;
  humanActionType?: HumanActionType;
  humanActionDetail?: string;
  risk: RiskLevel;
  complexity: ComplexityLevel;
  dependsOn: number[];
  requirements: string[];
  acceptanceCriteria: string[];
  status?: "pending" | "in_progress" | "done";
}
```

#### Human Involvement Tracking

**Human Roles:**
| Role | Meaning |
|------|---------|
| `must_do` | Human performs this task themselves - AI cannot do this |
| `must_verify` | AI can do it, human must check/approve the result |

**Human Action Types (27 types):**

| Category | Actions |
|----------|---------|
| **Auth & Credentials** | `external_auth`, `create_oauth_app`, `generate_api_key`, `oauth_consent`, `create_account`, `mfa_setup` |
| **Publishing & Deploy** | `first_publish`, `deploy_approve`, `domain_setup`, `ssl_setup` |
| **Billing & Payments** | `billing_setup`, `plan_upgrade` |
| **Verification** | `email_verify`, `phone_verify`, `identity_verify`, `captcha` |
| **Access & Permissions** | `grant_access`, `accept_invite`, `permission_request` |
| **Review & Approval** | `design_decision`, `review_approve`, `legal_accept` |
| **Physical & Network** | `hardware_setup`, `network_config` |
| **Other** | `manual_test`, `data_entry`, `other` |

When `humanRole` is `must_do`, the task includes:
- `humanActionType`: What the human must do
- `humanActionDetail`: Detailed instructions (e.g., "Log into Spotify Developer Dashboard and create new app")

#### Risk & Complexity Levels

**Risk Levels:**
| Level | Meaning |
|-------|---------|
| `high` | Security/data issues if done wrong |
| `medium` | Functionality issues if done wrong |
| `low` | Cosmetic/minor issues if done wrong |

**Complexity Levels:**
| Level | Meaning |
|-------|---------|
| `high` | Architectural changes or many files |
| `medium` | Moderate changes |
| `low` | Simple/straightforward |

#### Task Dependencies

Tasks can depend on other tasks via the `dependsOn` array containing task IDs.

---

### 4. Review System

Reviews implementation against the plan.

```typescript
interface ReviewResult {
  planId: string;
  confidence: number;       // 0-100
  confidenceLevel: ConfidenceLevel;
  criteriaResults: CriteriaResult[];
  issues: string[];
  summary: string;
  recommendedAction: ReviewAction;
}
```

**Implementation Types:**
- `pr` - Pull request (by URL)
- `branch` - Git branch name
- `local` - Local file changes

**Confidence Levels:**
| Level | Threshold | Action |
|-------|-----------|--------|
| `high` | 90%+ | Auto-approve (if enabled) or quick review |
| `medium` | 70-89% | Human review recommended |
| `low` | <70% | Iterate or escalate |

**API Endpoint:** `POST /workflow/:id/review`

---

### 5. Research System

Ask questions about the codebase without modifying the plan.

```typescript
interface ResearchResult {
  answer: string;
  sources: string[];
}
```

**API Endpoint:** `POST /workflow/:id/ask`

---

### 6. Routing System

The orchestrator routes based on review confidence:

| Confidence | Action | Description |
|------------|--------|-------------|
| High (90%+) | `approve` / `human_review` | Auto-approve if enabled, otherwise quick review |
| Medium (70-89%) | `human_review` | Human review recommended |
| Low (<70%) | `iterate` | Revise plan and try again |
| Max iterations | `escalate` | Human intervention required |

---

## Frontend Features

### Build Page (`/build`)

A step-by-step wizard for creating plans:

1. **Intent Phase** - Enter what you want to build
2. **Exploring Phase** - AI analyzes codebase (loading state)
3. **Questions Phase** - Answer clarifying questions
4. **Playbook Phase** - Accept/reject proposed workflow
5. **Planning Phase** - AI generates detailed plan (loading state)
6. **Plan Phase** - Review tasks, refine if needed, approve
7. **Complete Phase** - Plan approved, ready to implement

**Task Card Display:**
- Human role badge (MUST DO / MUST VERIFY)
- Risk level badge (High/Medium/Low)
- Complexity level badge (High/Medium/Low)
- Dependencies indicator
- Human action callout (for MUST DO tasks)
- Requirements list
- Acceptance criteria list

---

## Real-Time Updates (SSE)

Server-Sent Events for streaming updates:

| Event Type | Payload | Description |
|------------|---------|-------------|
| `thinking` | `{ message: string }` | AI is processing |
| `output` | `{ text: string }` | Raw output text |
| `questions` | `{ questions: ClarifyingQuestion[] }` | Questions to answer |
| `playbookProposed` | `{ playbook: Playbook }` | Playbook suggestion |
| `planReady` | `{ plan: Plan }` | Plan generated |
| `reviewReady` | `{ result: ReviewResult }` | Review complete |
| `researchReady` | `{ result: ResearchResult }` | Research answer ready |
| `phaseChange` | `{ phase: Phase }` | Workflow phase changed |
| `error` | `{ error: string }` | Error occurred |
| `done` | `{}` | Operation complete |

---

## Orchestrator Class

The main coordination class for workflows.

```typescript
class Orchestrator {
  // Core methods
  plan(requirement: string): Promise<Plan | null>
  answerQuestions(answers: Record<string, string>): Promise<Plan | null>
  acceptPlaybook(): Promise<Plan | null>
  rejectPlaybook(feedback: string): Promise<Plan | null>
  refinePlan(feedback: string): Promise<Plan | null>
  ask(question: string): Promise<ResearchResult>
  review(implementation: Implementation): Promise<ReviewResult>
  route(result: ReviewResult): { action: string; reason: string }
  iterate(reviewFeedback: string): Promise<Plan | null>
  complete(): void
  reset(): void

  // State access
  getState(): WorkflowState
  getSummary(): string
  onEvent(handler: (event: SessionEvent) => void): void
}
```

**Configuration:**
```typescript
interface OrchestratorConfig {
  workDir: string;              // Working directory for codebase
  maxIterations: number;        // Max plan iterations (default: 3)
  confidenceThresholds: {
    high: number;               // e.g., 90
    medium: number;             // e.g., 70
  };
  autoApproveHighConfidence: boolean; // Auto-approve high confidence (default: false)
}
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React, Tailwind CSS, shadcn/ui |
| **API** | Fastify, @palindrom/fastify-api (type-safe routes) |
| **Core** | TypeScript, Anthropic SDK |
| **AI** | Claude (via Anthropic API) |
| **Package Manager** | pnpm (monorepo with workspaces) |
| **Build** | Turbo (turborepo) |
| **Validation** | Zod schemas |
| **Module System** | ESM with NodeNext resolution |

---

## Project Structure

```
architecta/
├── apps/
│   ├── api/              # Fastify API server
│   │   └── src/
│   │       ├── routes/   # API route handlers
│   │       ├── store/    # In-memory workflow storage
│   │       └── schemas.ts # Zod schemas
│   └── web/              # Next.js frontend
│       └── src/
│           ├── app/      # App router pages
│           └── lib/      # API client
├── packages/
│   ├── core/             # Core orchestration logic
│   │   └── src/
│   │       ├── orchestrator/  # Workflow orchestration
│   │       ├── sessions/      # AI session runners
│   │       ├── prompts/       # System prompts
│   │       └── types.ts       # Core types
│   ├── ui/               # Shared UI components (shadcn/ui)
│   └── fastify-api/      # Vendored fastify-api package
└── docs/                 # Documentation
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `ARCHITECTA_WORK_DIR` | Default working directory | Current directory |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:4000` |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Start development servers (API + Web)
pnpm dev:all

# Or separately:
pnpm --filter @architecta/api dev   # API on :4000
pnpm --filter @architecta/web dev   # Web on :3000
```

---

## What's NOT Implemented Yet

- Persistent storage (currently in-memory only)
- User authentication
- GitHub/GitLab integration
- Database inspection
- Environment/permissions awareness (assumed fresh environment)
- Fabrica (AI builder) integration
- Multi-repo support
- Team collaboration features
