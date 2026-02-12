# Fabrica Architecture

Fabrica is a lightweight orchestration system that executes markdown plans using Claude Code. It provides three execution modes: natural flow (default), sequential pipeline, or single specialist. Plans escalate to humans via an issue queue when Claude gets stuck.

## Core Principle

> **The intelligence comes from Claude, the capabilities come from Claude Code's tools.**

Fabrica doesn't reinvent agent tooling. It leverages the Claude Agent SDK which provides Claude Code's native tools (Read, Write, Edit, Bash, Glob, Grep, etc.). Fabrica's job is to:

1. Accept plans and execute them via Claude Code
2. Manage sessions and track progress
3. Escalate to humans when AI gets stuck

## Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **natural** (default) | Single long-running session that works like a programmer | Most tasks - let Claude figure out the flow |
| **pipeline** | Sequential stages with separate sessions | When you need explicit handoffs between specialists |
| **single** | One specialist role | Quick, focused tasks (just review, just test) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FABRICA                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Fastify REST API                                                        │
│       │                                                                  │
│       ▼                                                                  │
│  POST /sessions { plan: "markdown", mode?: "natural" }                   │
│       │                                                                  │
│       ├─── mode: "natural" (default) ────────────────────────────┐      │
│       │                                                           │      │
│       │    ┌─────────────────────────────────────────────────┐   │      │
│       │    │           SINGLE CLAUDE CODE SESSION             │   │      │
│       │    │                                                  │   │      │
│       │    │   Works like a programmer:                       │   │      │
│       │    │   build → test → fix → build → review → commit   │   │      │
│       │    │                                                  │   │      │
│       │    │   Switches between concerns naturally            │   │      │
│       │    │   No artificial stage boundaries                 │   │      │
│       │    │                                                  │   │      │
│       │    └─────────────────────────────────────────────────┘   │      │
│       │                                                           │      │
│       ├─── mode: "pipeline" ─────────────────────────────────┐   │      │
│       │                                                       │   │      │
│       │    ┌──────────────────────────────────────────────┐  │   │      │
│       │    │            PIPELINE EXECUTOR                  │  │   │      │
│       │    │                                               │  │   │      │
│       │    │  Stage 1      Stage 2      Stage 3           │  │   │      │
│       │    │  ┌────────┐  ┌────────┐  ┌──────────┐        │  │   │      │
│       │    │  │builder │─▶│ tester │─▶│ reviewer │        │  │   │      │
│       │    │  └────────┘  └────────┘  └──────────┘        │  │   │      │
│       │    │       context flows forward to each stage     │  │   │      │
│       │    └──────────────────────────────────────────────┘  │   │      │
│       │                                                       │   │      │
│       └───────────────────────────────────────────────────────┘   │      │
│                                                                   │      │
│       ▼ (on failure)                                              │      │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                       ISSUE QUEUE                               │     │
│  │                                                                 │     │
│  │  Human escalation for: errors, stuck sessions, blockers,        │     │
│  │  clarification needs, approval requests                         │     │
│  │                                                                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Natural Flow Mode (Default)

Natural flow is the recommended execution mode. It runs a single long-running Claude Code session that works like a real programmer.

### How It Works

1. **Plan arrives** via `POST /sessions` with markdown content
2. **Single Claude session starts** with a unified system prompt
3. **Claude works naturally** - building, testing, fixing, reviewing as needed
4. **No artificial stage boundaries** - switches between concerns organically
5. **On failure**: issue created for human escalation

### Benefits

- **More natural execution** - Claude decides when to test, when to debug
- **Better context retention** - single session keeps full context
- **Less overhead** - no stage handoffs or context summarization
- **Handles noise** - prompt guides Claude to focus on signal, not verbose logs

### System Prompt Guidance

The natural flow prompt tells Claude to:
- Work like a programmer (build → test → fix → continue)
- Switch between specialist modes naturally
- Keep output focused (summarize, don't narrate)
- Extract signal from noise when debugging
- Make atomic git commits with clear messages

## Pipeline Execution

Pipeline mode runs separate Claude sessions for each stage. Use this when you need explicit handoffs between specialists.

### How It Works

1. **Plan arrives** via `POST /sessions` with `mode: "pipeline"`
2. **Flow is resolved** from request, plan metadata, or default
3. **Stages execute sequentially**, each with:
   - Role-specific system prompt (builder, tester, reviewer, etc.)
   - Context from previous stages' outputs
   - Claude Agent SDK `query()` execution
4. **On success**: next stage runs with accumulated context
5. **On failure**: issue created, pipeline stops (configurable)

### Specialist Roles

| Role | Focus | Access |
|------|-------|--------|
| **foundation** | Project setup, tooling, scaffolding | Full write |
| **builder** | Implementation, clean code, patterns | Full write |
| **tester** | Unit/integration tests, coverage | Test files only |
| **reviewer** | Quality, security, feedback | Read-only |
| **debugger** | Find and fix issues | Full write |
| **deployer** | CI/CD, infrastructure | Deploy configs |
| **architect** | Design, documentation | Read + docs |

Each role has a specialized system prompt that shapes how Claude approaches the work.

### Flow Presets

| Preset | Stages |
|--------|--------|
| `default` | builder → tester → reviewer |
| `full` | builder → tester → reviewer → deployer |
| `new-project` | foundation → builder → tester → reviewer |
| `review-only` | reviewer |
| `test-only` | tester |

### Custom Flows

Plans can declare custom flows:

```yaml
---
repo: my-project
flow: [architect, builder, tester, reviewer]
---
```

Or via API:

```json
{ "plan": "...", "flow": ["builder", "reviewer"] }
```

## Issue Queue

When Claude can't proceed, issues are created for human attention.

### Issue Types

| Type | When Created |
|------|--------------|
| `error` | Execution fails with exception |
| `stuck` | Session running too long without progress |
| `impasse` | Agent explicitly cannot proceed |
| `needs_human_action` | Requires manual step (npm publish, API key) |
| `clarification_needed` | Ambiguous requirement |
| `approval_required` | Destructive action needs sign-off |

### Issue Lifecycle

```
open → acknowledged → in_progress → resolved
                                  → dismissed
```

## REST API

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create session (pipeline or single) |
| `GET` | `/sessions` | List all sessions |
| `GET` | `/sessions/:id` | Get session status |
| `GET` | `/sessions/:id/output` | Get execution output |
| `GET` | `/sessions/:id/logs` | Get execution logs |
| `POST` | `/sessions/:id/abort` | Abort running session |
| `GET` | `/sessions/:id/issues` | Get issues for session |

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/issues` | Create issue manually |
| `GET` | `/issues` | List issues (with filters) |
| `GET` | `/issues/:id` | Get issue details |
| `PATCH` | `/issues/:id` | Update status/resolution |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check + open issue count |
| `GET` | `/config` | MCP servers, cloud profiles |
| `GET` | `/specialists` | Available roles + prompts |
| `GET` | `/pipelines` | Available presets + flows |

## Usage Examples

### 1. Natural Flow (Default - Recommended)

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"plan": "# Add login feature\n\n## Task 1\nImplement auth..."}'
```

Response:
```json
{
  "sessionId": "abc123",
  "status": "running",
  "mode": "natural"
}
```

### 2. Pipeline Mode

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"plan": "...", "mode": "pipeline"}'
```

Response:
```json
{
  "sessionId": "abc123",
  "status": "running",
  "mode": "pipeline",
  "flow": ["builder", "tester", "reviewer"]
}
```

### 3. Pipeline with Custom Flow

```bash
curl -X POST http://localhost:3000/sessions \
  -d '{"plan": "...", "mode": "pipeline", "flow": ["architect", "builder", "reviewer"]}'
```

### 4. Single Specialist Mode

```bash
curl -X POST http://localhost:3000/sessions \
  -d '{"plan": "...", "mode": "single", "role": "reviewer"}'
```

### 5. Check Issues

```bash
curl http://localhost:3000/issues?status=open
```

### 6. Resolve Issue

```bash
curl -X PATCH http://localhost:3000/issues/xyz \
  -d '{"status": "resolved", "resolution": "Fixed manually"}'
```

## Integration with ARCHITECTA

ARCHITECTA is the planning layer that decides **what** to build. Fabrica is the execution layer that decides **how** to build it well.

```
┌─────────────────────────┐     ┌─────────────────────────┐
│       ARCHITECTA        │     │        FABRICA          │
├─────────────────────────┤     ├─────────────────────────┤
│ • Analyzes requirements │     │ • Routes to specialists │
│ • Creates markdown plan │ ──▶ │ • Sequences pipeline    │
│ • Tags tasks with hints │     │ • Handles failures      │
│ • Strategic decisions   │     │ • Escalates to humans   │
└─────────────────────────┘     └─────────────────────────┘
```

ARCHITECTA sends a plan to Fabrica's `/sessions` endpoint. Fabrica executes it through the appropriate pipeline and reports results.

## Project Structure

```
fabrica/
├── packages/
│   ├── core/                    # Shared types and utilities
│   │   ├── plan-parser.ts       # Markdown plan parsing
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── dependency-graph.ts  # Task dependencies
│   │
│   └── control-plane/           # REST API service
│       ├── server.ts            # Fastify setup
│       ├── routes.ts            # API endpoints
│       ├── claude-executor.ts   # Claude SDK integration
│       ├── pipeline.ts          # Sequential execution
│       ├── session-store.ts     # Session tracking
│       └── issue-queue.ts       # Human escalation
│
├── config/
│   └── roles/                   # Role YAML definitions
│       ├── builder.yaml
│       ├── tester.yaml
│       ├── reviewer.yaml
│       └── ...
│
└── infra/                       # Pulumi GCP deployment
    └── index.ts
```

## Deployment

Fabrica runs as a single Cloud Run service:

```
https://fabrica-dev-xxxxx.a.run.app
```

Secrets (ANTHROPIC_API_KEY, GITHUB_TOKEN) are stored in GCP Secret Manager and injected at runtime.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Sequential not parallel** | Simpler, context flows naturally, easier to debug |
| **Claude Agent SDK** | Leverages Claude Code's tools, no custom agent code |
| **In-memory stores** | Simple for MVP; swap to Redis/DB for production |
| **Issue queue not auto-retry** | Humans decide how to handle failures |
| **No DevContainers** | Add later if hard security isolation needed |
| **Specialist prompts in code** | Simpler than YAML loading, easy to iterate |

## What Fabrica Is NOT

- **Not a workflow engine** - No DAGs, conditions, or complex orchestration
- **Not a container orchestrator** - Single Claude session per stage
- **Not a CI/CD system** - Executes plans, doesn't manage pipelines
- **Not autonomous** - Escalates to humans when stuck

Fabrica is a thin orchestration layer that makes Claude effective at multi-stage software development tasks.
