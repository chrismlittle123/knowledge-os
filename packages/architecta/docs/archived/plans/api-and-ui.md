# Implementation Plan: API Mode + Frontend UI

## Overview

Add an API mode to Architecta and a minimal frontend UI for testing the orchestrator workflow locally.

**Decisions:**
- Monorepo structure: Frontend in `apps/web`
- Packages: Install directly from GitHub repos
- Persistence: In-memory only
- Real-time: Server-Sent Events (SSE)
- Theme: Business theme with dark mode

---

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│      Frontend (UI)      │   SSE   │      Architecta API     │
│      Next.js            │ ◄────── │      Fastify            │
│      :3000              │         │      :4000              │
│                         │  REST   │                         │
│  @chrislittle/          │ ──────► │  @palindrom/            │
│  theme-business         │         │  fastify-api            │
└─────────────────────────┘         └─────────────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────────────┐
                                    │     Orchestrator        │
                                    │     (existing)          │
                                    │                         │
                                    │  Planning Session       │
                                    │  Review Session         │
                                    └─────────────────────────┘
```

---

## Project Structure

```
architecta/
├── apps/
│   ├── api/                    # NEW: Fastify API server
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── workflow.ts # Workflow CRUD
│   │   │   │   ├── plan.ts     # Planning endpoints
│   │   │   │   └── review.ts   # Review endpoints
│   │   │   └── sse/
│   │   │       └── stream.ts   # SSE streaming
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # NEW: Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx    # Main workflow UI
│       │   │   └── globals.css
│       │   ├── components/
│       │   │   ├── workflow-input.tsx
│       │   │   ├── plan-display.tsx
│       │   │   ├── review-display.tsx
│       │   │   └── stream-output.tsx
│       │   └── lib/
│       │       └── api.ts      # API client
│       ├── package.json
│       ├── next.config.js
│       └── tailwind.config.ts
│
├── packages/
│   ├── core/                   # MOVE: Existing orchestrator code
│   │   ├── src/
│   │   │   ├── orchestrator/
│   │   │   ├── sessions/
│   │   │   ├── prompts/
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                     # COPY: From chrismlittle123/ui
│       ├── src/
│       │   ├── primitives/     # From @chrislittle/ui-primitives
│       │   └── components/     # From @chrislittle/theme-business
│       ├── styles/
│       │   └── globals.css
│       ├── package.json
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── src/                        # KEEP: CLI entry point (uses packages/core)
│   └── index.ts
│
├── pnpm-workspace.yaml         # NEW: Workspace config
├── turbo.json                  # NEW: Turbo build config
└── package.json                # UPDATE: Root workspace package
```

---

## API Endpoints

### Workflow Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workflow` | Create new workflow |
| GET | `/workflow/:id` | Get workflow state |
| DELETE | `/workflow/:id` | Delete workflow |

### Planning

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workflow/:id/plan` | Start planning with requirement |
| POST | `/workflow/:id/plan/refine` | Refine current plan |
| POST | `/workflow/:id/plan/approve` | Approve plan |

### Review

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workflow/:id/review` | Review implementation |
| POST | `/workflow/:id/iterate` | Iterate based on review |

### Streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflow/:id/stream` | SSE stream for real-time updates |

---

## API Response Schemas

### Workflow

```typescript
interface Workflow {
  id: string;
  phase: "idle" | "planning" | "reviewing" | "complete";
  requirement?: string;
  plan?: {
    raw: string;
    title: string;
    tasks: Task[];
  };
  lastReview?: {
    confidence: number;
    confidenceLevel: "high" | "medium" | "low";
    issues: string[];
    summary: string;
  };
  iterations: number;
  createdAt: string;
  updatedAt: string;
}
```

### SSE Events

```typescript
// Event types sent via SSE
type SSEEvent =
  | { type: "thinking"; message: string }
  | { type: "output"; text: string }
  | { type: "plan_ready"; plan: Plan }
  | { type: "review_ready"; result: ReviewResult }
  | { type: "phase_change"; phase: Phase }
  | { type: "error"; error: string }
  | { type: "done" }
```

---

## Frontend Pages

### Main Page (`/`)

Single-page application with:

1. **Requirement Input**
   - Text area for entering requirements
   - "Plan" button to start planning

2. **Stream Output**
   - Real-time display of Claude's output
   - Auto-scrolling terminal-like view

3. **Plan Display**
   - Rendered markdown plan
   - "Approve" / "Refine" buttons
   - Refine opens a text input for feedback

4. **Review Panel** (when reviewing)
   - Confidence score with visual indicator
   - Issues list
   - Routing recommendation
   - "Accept" / "Iterate" buttons

5. **Status Bar**
   - Current phase
   - Iteration count
   - Workflow ID

---

## Implementation Tasks

### Task 1: Convert to Monorepo

**Description:** Restructure project as pnpm workspace with turbo.

**Requirements:**
- Add `pnpm-workspace.yaml` defining packages and apps
- Add `turbo.json` for build orchestration
- Move existing orchestrator code to `packages/core`
- Update imports and build scripts
- Root `package.json` becomes workspace root

**Acceptance Criteria:**
- [ ] `pnpm install` works from root
- [ ] `pnpm build` builds all packages
- [ ] CLI still works: `pnpm --filter architecta dev`

---

### Task 2: Create API Package

**Description:** Add Fastify API server using @palindrom/fastify-api.

**Requirements:**
- Install @palindrom/fastify-api from GitHub
- Create `apps/api` with routes for workflow, plan, review
- Implement in-memory workflow storage
- Add SSE endpoint for streaming

**Acceptance Criteria:**
- [ ] `pnpm --filter @architecta/api dev` starts server on :4000
- [ ] POST `/workflow` creates a workflow
- [ ] GET `/workflow/:id` returns workflow state
- [ ] POST `/workflow/:id/plan` starts planning (streams via SSE)
- [ ] GET `/workflow/:id/stream` returns SSE stream

---

### Task 3: Create Frontend Package

**Description:** Add Next.js frontend using @chrislittle/theme-business.

**Requirements:**
- Create `apps/web` with Next.js
- Copy @chrislittle/theme-business + @chrislittle/ui-primitives to `packages/ui`
- Implement main page with workflow UI
- Connect to API with SSE for streaming
- Dark mode by default

> **Note:** UI source copied for now. Will replace with proper npm import later.

**Acceptance Criteria:**
- [ ] `pnpm --filter @architecta/web dev` starts on :3000
- [ ] Can enter requirement and start planning
- [ ] Streams Claude output in real-time
- [ ] Shows plan with approve/refine buttons
- [ ] Shows review results with confidence score

---

### Task 4: Docker Compose Setup

**Description:** Add docker-compose for local development.

**Requirements:**
- API container
- Web container
- Shared network
- Volume mounts for target repo

**Acceptance Criteria:**
- [ ] `docker-compose up` starts both services
- [ ] Frontend accessible at localhost:3000
- [ ] API accessible at localhost:4000
- [ ] Can run full workflow through UI

---

## Dependencies

### apps/api

```json
{
  "dependencies": {
    "@palindrom/fastify-api": "github:chrismlittle123/fastify-api",
    "@architecta/core": "workspace:*"
  }
}
```

### apps/web

```json
{
  "dependencies": {
    "@architecta/ui": "workspace:*",
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### packages/ui (copied from chrismlittle123/ui)

```json
{
  "name": "@architecta/ui",
  "dependencies": {
    // Copied from @chrislittle/theme-business + @chrislittle/ui-primitives
    // To be replaced with proper npm import later
  }
}
```

### packages/core

Existing orchestrator dependencies, exported as `@architecta/core`.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GitHub package installation issues | Fall back to git submodule or copy source |
| SSE browser compatibility | All modern browsers support SSE |
| Claude SDK streaming in API context | Use async generators, pipe to SSE |
| Monorepo complexity | Keep structure minimal, use turbo for builds |

---

## Out of Scope

- Authentication (no auth for local testing)
- Persistence (in-memory only)
- Production deployment
- Multiple concurrent workflows
- Fabrica integration

---

## Success Criteria

1. Run `docker-compose up` (or `pnpm dev`)
2. Open `localhost:3000`
3. Enter "Add a logout button to the navbar"
4. See Claude's output streaming in real-time
5. See rendered plan with approve/refine buttons
6. Click "Approve" and see confirmation

Total time from requirement to approved plan should be visible in the UI.
