# Fabrica

A lightweight orchestration system that executes markdown plans using Claude Code.

## Overview

Fabrica takes a markdown plan and executes it using the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk). It provides a simple REST API to submit plans, track progress, and retrieve results.

```
Markdown Plan → API → Claude Agent SDK → Git Branch with Changes
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/chrismlittle123/fabrica.git
cd fabrica

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the API Server

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the server
pnpm start

# Or with Docker
docker-compose up -d api
```

### Submit a Plan

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "# My Plan\n\n## Task 1: Create file\nCreate hello.txt with Hello World",
    "workDir": "/path/to/repo",
    "model": "haiku"
  }'
```

### Check Status

```bash
curl http://localhost:3000/sessions/{sessionId}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/config` | Get server configuration |
| POST | `/sessions` | Create session from plan |
| GET | `/sessions` | List all sessions |
| GET | `/sessions/:id` | Get session status |
| POST | `/sessions/:id/abort` | Abort a running session |

### Create Session Request

```json
{
  "plan": "# Plan Title\n\n## Task 1: Do something\nDescription...",
  "workDir": "/path/to/git/repo",
  "model": "sonnet",
  "useMCP": ["context7", "linear"],
  "awsProfile": "production",
  "gcpProfile": "my-project"
}
```

### Session Response

```json
{
  "sessionId": "abc123",
  "status": "completed",
  "progress": {
    "total": 2,
    "completed": true
  },
  "duration": 25000,
  "plan": {
    "title": "Plan Title",
    "tasks": [
      { "id": "task-1", "title": "Do something", "role": "builder" }
    ]
  }
}
```

## Plan Format

Plans are markdown files with optional YAML frontmatter:

```markdown
---
repo: my-project
baseBranch: main
---

# Feature: Add User Authentication

## Task 1: Create auth module [builder]

Create a new authentication module with login/logout functions.

## Task 2: Add tests [tester]

Write unit tests for the auth module.
```

### Task Syntax

- Task titles can include a role hint: `## Task 1: Title [role]`
- Supported roles: `builder`, `tester`, `reviewer`, `debugger`, `architect`
- Dependencies parsed from content mentioning other tasks

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Fabrica API                              │
├─────────────────────────────────────────────────────────────────┤
│  POST /sessions { plan: "..." }                                  │
│       │                                                          │
│       ▼                                                          │
│  Claude Agent SDK (query)                                        │
│       │                                                          │
│       ▼                                                          │
│  Claude executes plan using:                                     │
│  - Read/Write/Edit/Bash tools                                    │
│  - Git operations (branch, commit)                               │
│  - MCP servers (optional)                                        │
│       │                                                          │
│       ▼                                                          │
│  Output: Git branch with changes                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@fabrica/core` | Plan parser, dependency graph, types |
| `@fabrica/control-plane` | REST API server (Fastify) |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `GITHUB_TOKEN` | GitHub PAT (for git operations) | No |
| `PORT` | API server port (default: 3000) | No |

### MCP Servers

Configure MCP servers in `fabrica.config.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/context7-mcp"]
    },
    "linear": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/linear-mcp"]
    }
  }
}
```

### Cloud Profiles

For AWS/GCP access, set credentials as environment variables:

```bash
# AWS Profile "production"
export FABRICA_SECRET_AWS_PRODUCTION_ACCESS_KEY_ID=...
export FABRICA_SECRET_AWS_PRODUCTION_SECRET_ACCESS_KEY=...
export FABRICA_SECRET_AWS_PRODUCTION_REGION=us-east-1

# GCP Profile "my-project"
export FABRICA_SECRET_GCP_MY_PROJECT_CREDENTIALS=...
```

Then reference in API requests:
```json
{
  "plan": "...",
  "awsProfile": "production",
  "gcpProfile": "my-project"
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Format code
pnpm format
```

## Project Structure

```
fabrica/
├── packages/
│   ├── core/           # Plan parser, types
│   └── control-plane/  # API server
├── infra/              # Pulumi infrastructure (GCP)
├── .github/workflows/  # CI/CD
├── docker-compose.yml  # Local Docker deployment
└── fabrica.config.example.json
```

## GCP Deployment

Fabrica deploys to Google Cloud Run using Pulumi and GitHub Actions.

### Prerequisites

1. GCP project with billing enabled
2. Workload Identity Federation configured for GitHub Actions
3. Pulumi state bucket in GCS

### One-Time Setup

1. **Deploy infrastructure first** (creates empty secrets):

```bash
cd infra
pnpm install
pulumi up
```

2. **Load secret values from your .env file:**

```bash
# Authenticate to GCP
gcloud auth application-default login

# Load secrets (reads from .env, sets values in GCP Secret Manager)
pnpm load-secrets
```

2. **Configure GitHub repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|----------|-------|
| `GCP_PROJECT` | Your GCP project ID |
| `GCP_REGION` | e.g., `europe-west2` |
| `WORKLOAD_IDENTITY_PROVIDER` | Your WIF provider |
| `GCP_SERVICE_ACCOUNT` | Service account email |
| `PULUMI_STATE_BUCKET` | e.g., `gs://pulumi-state-myproject` |

### Deploying

Push to `main` to trigger automatic deployment, or manually trigger via GitHub Actions:

```bash
# Manual deploy to dev
gh workflow run deploy.yml -f environment=dev

# Check deployment status
gh run list --workflow=deploy.yml
```

### Infrastructure

The Pulumi stack creates:
- **Artifact Registry** - Docker image storage
- **Service Account** - With secret access permissions
- **Cloud Run Service** - Serverless container hosting
- **Secret** - `ANTHROPIC_API_KEY` injected at runtime

## How It Works

1. **Submit Plan**: POST a markdown plan to `/sessions`
2. **Parse**: Plan is parsed into tasks with dependencies
3. **Execute**: Claude Agent SDK executes the plan
4. **Track**: Query `/sessions/:id` for status updates
5. **Result**: Git branch created with all changes committed

The Claude Agent SDK handles:
- Tool execution (Read, Write, Edit, Bash, etc.)
- Permission management
- MCP server integration
- Streaming output

## License

MIT
