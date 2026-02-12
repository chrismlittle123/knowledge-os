# Fabrica

A self-hosted system that transforms markdown plans into pull requests using Claude Code.

## How It Works

```
Markdown Plan → API → Agent Container → Claude Code → Pull Request
```

1. Submit a markdown plan to the API
2. API creates a session and spawns a Docker container
3. Container runs Claude Code with the plan
4. Claude Code implements the tasks, runs tests, commits changes
5. Container pushes branch and creates a PR

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FABRICA API                              │
│                    (Fastify on port 3000)                        │
│                                                                  │
│  POST /run              - Submit plan, get sessionId             │
│  GET  /sessions         - List all sessions                      │
│  GET  /sessions/:id     - Get session status                     │
│  GET  /sessions/:id/messages - Get session messages              │
│  GET  /messages         - List recent messages                   │
│  GET  /                 - Web dashboard                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT CONTAINER                             │
│              (fabrica-agent Docker image)                        │
│                                                                  │
│  1. Clone repository                                             │
│  2. Create branch: fabrica/{session-id}                          │
│  3. Run Claude Code with plan                                    │
│  4. Claude implements tasks, runs tests                          │
│  5. Push branch, create PR                                       │
│  6. Update session status in database                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL                                │
│                                                                  │
│  sessions: id, repo_url, branch_name, pr_url, status, timestamps │
│  messages: id, session_id, type, content, created_at             │
│  specs: id, session_id, content, version                         │
└─────────────────────────────────────────────────────────────────┘
```

## Plan Format

```markdown
---
repo: owner/repo-name
base_branch: main
---

# Feature: Your feature title

## Task 1: First task
> Role: builder
> Depends on: none

Description of what to implement.

### Acceptance Criteria
- [ ] Criterion one
- [ ] Criterion two

## Task 2: Second task
> Role: builder
> Depends on: Task 1

Description of the second task.

### Acceptance Criteria
- [ ] Criterion one
```

Claude Code reads the plan and executes tasks in dependency order automatically.

## Project Structure

```
fabrica/
├── packages/
│   ├── core/                    # Shared types, plan parser
│   │   └── src/
│   │       ├── types.ts
│   │       ├── plan-parser.ts
│   │       └── index.ts
│   │
│   └── control-plane/           # API server
│       └── src/
│           ├── server.ts        # Fastify setup
│           ├── routes.ts        # API endpoints + dashboard
│           ├── db.ts            # PostgreSQL queries
│           ├── container.ts     # Docker container spawning
│           └── main.ts          # Entry point
│
├── docker/
│   └── agent/
│       ├── Dockerfile           # Agent container image
│       └── entrypoint.sh        # Clone, run Claude, push, PR
│
├── examples/plans/              # Example plans for testing
├── scripts/                     # Integration test scripts
├── docker-compose.yml           # Local development setup
└── schema.sql                   # Database schema
```

## Local Development

### Prerequisites

- Docker
- Node.js 20+
- pnpm
- Anthropic API key
- GitHub token (with repo access)

### Quick Start

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Build agent image
docker build -t fabrica-agent:latest ./docker/agent

# Start PostgreSQL and API
ANTHROPIC_API_KEY=xxx GITHUB_TOKEN=xxx docker-compose up -d

# Open dashboard
open http://localhost:3000

# Submit a plan
curl -X POST http://localhost:3000/run \
  -H "Content-Type: text/plain" \
  -d "$(cat examples/plans/simple-test.md)"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo access |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | API port (default: 3000) |
| `AGENT_IMAGE` | No | Agent Docker image (default: fabrica-agent:latest) |
| `DOCKER_NETWORK` | No | Docker network name (default: fabrica_default) |

## API Reference

### POST /run

Submit a plan for execution.

**Request:**
```
Content-Type: text/plain

---
repo: owner/repo
base_branch: main
---

# Feature title
...
```

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "running",
  "plan": {
    "title": "Feature title",
    "repoUrl": "owner/repo"
  }
}
```

### GET /sessions/:id

Get session status.

**Response:**
```json
{
  "sessionId": "uuid",
  "repoUrl": "owner/repo",
  "branchName": "fabrica/abc123",
  "prUrl": "https://github.com/owner/repo/pull/1",
  "status": "completed",
  "createdAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:01:00Z"
}
```

### GET /sessions/:id/messages

Get session messages.

**Response:**
```json
{
  "sessionId": "uuid",
  "count": 5,
  "messages": [
    {
      "id": "uuid",
      "type": "progress",
      "content": { "message": "Cloning repository..." },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Session Statuses

| Status | Description |
|--------|-------------|
| `pending` | Session created, not started |
| `running` | Agent container executing |
| `completed` | PR created successfully |
| `failed` | Execution failed |
| `escalated` | Agent needs human help (exit code 2) |

## Message Types

| Type | Description |
|------|-------------|
| `progress` | Status update |
| `error` | Error occurred |
| `completion` | Task/session completed |
| `escalation` | Human intervention needed |
