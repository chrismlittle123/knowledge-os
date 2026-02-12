# Fabrica v2 - Bare Bones Implementation Plan

## Overview

Strip Fabrica down to a simple "Claude Code as a Service":
- API receives markdown plan
- Spins up devcontainer with Claude Code SDK
- Claude clones repo, works on task, creates PR
- Messages sent to queue (progress, completion, escalation)

**Scope: Backend Development Only**

Fabrica is designed exclusively for backend development tasks. Frontend development should be done inside a local Claude Code session where the developer can interact directly with the UI and provide visual feedback. Backend work, however, can be safely executed in the cloud without requiring direct human visual inspection during development.

## Architecture

```
┌─────────────┐     ┌─────────────────────────────────┐
│ POST /run   │────▶│  Devcontainer (fresh per req)   │
│             │     │  - Claude Code SDK              │
│ - markdown  │     │  - git, node, basic tools       │
│ - repo_url  │     │  - ANTHROPIC_API_KEY            │
│             │     │  - GITHUB_TOKEN                 │
└─────────────┘     └───────────────┬─────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  PostgreSQL                   │
                    │  - specs (versioned, r/o)     │
                    │  - messages (queue)           │
                    │  - sessions (status)          │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Fabrica UI (future)          │
                    │  - view issues/progress       │
                    │  - respond to escalations     │
                    └───────────────────────────────┘
```

## Decision: Use PostgreSQL as Message Queue

Why not Redis/RabbitMQ:
- One less service to deploy
- PostgreSQL LISTEN/NOTIFY + table is simple enough
- Messages need persistence anyway (audit log)
- UI will query messages directly

---

## Phase 1: Delete Everything

Remove these files/directories:

```bash
# Control plane - delete
rm packages/control-plane/src/pipeline.ts
rm packages/control-plane/src/docker-executor.ts
rm packages/control-plane/src/issue-queue.ts
rm packages/control-plane/src/config.ts
rm packages/control-plane/src/secrets.ts
rm packages/control-plane/src/session-store.ts

# Core - delete
rm packages/core/src/dependency-graph.ts
rm packages/core/src/skill-profiles.ts

# Config - delete all roles
rm -rf config/roles/

# Infra - delete (rebuild later if needed)
rm -rf infra/

# Examples, docs - clean up later
```

Keep:
- `packages/core/src/types.ts` (gut it)
- `packages/core/src/plan-parser.ts` (simplify)
- `packages/control-plane/src/server.ts` (keep)
- `packages/control-plane/src/routes.ts` (rewrite)
- `packages/control-plane/src/claude-executor.ts` (simplify)
- `packages/control-plane/src/main.ts` (keep)

---

## Phase 2: Database Schema

File: `schema.sql`

```sql
-- Specs table (versioned, read-only for Claude)
CREATE TABLE specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_specs_session ON specs(session_id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url TEXT NOT NULL,
  branch_name TEXT,
  pr_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, escalated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Messages table (queue)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL, -- progress, completion, escalation, error
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ -- NULL = unread
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_unread ON messages(session_id, read_at) WHERE read_at IS NULL;

-- Trigger for LISTEN/NOTIFY
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('fabrica_messages', json_build_object(
    'id', NEW.id,
    'session_id', NEW.session_id,
    'type', NEW.type
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
```

---

## Phase 3: Simplified Types

File: `packages/core/src/types.ts` (~50 lines)

```typescript
export interface Plan {
  repoUrl: string;
  title: string;
  description: string;
  rawMarkdown: string;
}

export interface Session {
  id: string;
  repoUrl: string;
  branchName?: string;
  prUrl?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'escalated';
  createdAt: Date;
  completedAt?: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  type: 'progress' | 'completion' | 'escalation' | 'error';
  content: {
    message: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: Date;
  readAt?: Date;
}

export type ParsedPlan = Plan;
```

---

## Phase 4: Simplified Plan Parser

File: `packages/core/src/plan-parser.ts` (~60 lines)

```typescript
import { parse as parseYaml } from 'yaml';
import type { Plan } from './types.js';

interface Frontmatter {
  repo: string;
  title?: string;
}

export function parsePlan(markdown: string): Plan {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Plan must have YAML frontmatter with repo URL');
  }

  const frontmatter = parseYaml(frontmatterMatch[1]) as Frontmatter;
  const body = frontmatterMatch[2].trim();

  if (!frontmatter.repo) {
    throw new Error('Frontmatter must include "repo" field');
  }

  // Extract title from first heading or use frontmatter
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = frontmatter.title || titleMatch?.[1] || 'Untitled';

  return {
    repoUrl: frontmatter.repo,
    title,
    description: body,
    rawMarkdown: markdown,
  };
}
```

---

## Phase 5: Database Client

File: `packages/control-plane/src/db.ts` (~80 lines)

```typescript
import pg from 'pg';
import type { Session, Message } from '@fabrica/core';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function createSession(repoUrl: string): Promise<Session> {
  const result = await pool.query(
    'INSERT INTO sessions (repo_url) VALUES ($1) RETURNING *',
    [repoUrl]
  );
  return mapSession(result.rows[0]);
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'status' | 'branchName' | 'prUrl' | 'completedAt'>>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${toSnakeCase(key)} = $${i++}`);
    values.push(value);
  }
  values.push(id);

  await pool.query(
    `UPDATE sessions SET ${fields.join(', ')} WHERE id = $${i}`,
    values
  );
}

export async function getSession(id: string): Promise<Session | null> {
  const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
  return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function saveSpec(sessionId: string, content: string): Promise<void> {
  await pool.query(
    'INSERT INTO specs (session_id, content) VALUES ($1, $2)',
    [sessionId, content]
  );
}

export async function sendMessage(
  sessionId: string,
  type: Message['type'],
  content: Message['content']
): Promise<void> {
  await pool.query(
    'INSERT INTO messages (session_id, type, content) VALUES ($1, $2, $3)',
    [sessionId, type, content]
  );
  // LISTEN/NOTIFY trigger fires automatically
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const result = await pool.query(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at',
    [sessionId]
  );
  return result.rows.map(mapMessage);
}

function mapSession(row: any): Session {
  return {
    id: row.id,
    repoUrl: row.repo_url,
    branchName: row.branch_name,
    prUrl: row.pr_url,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
```

---

## Phase 6: Simplified Routes

File: `packages/control-plane/src/routes.ts` (~80 lines)

```typescript
import type { FastifyInstance } from 'fastify';
import { parsePlan } from '@fabrica/core';
import { createSession, getSession, getMessages, saveSpec, updateSession } from './db.js';
import { spawnContainer } from './container.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Trigger a new run
  app.post('/run', async (request, reply) => {
    const markdown = request.body as string;

    // Parse plan
    const plan = parsePlan(markdown);

    // Create session
    const session = await createSession(plan.repoUrl);

    // Save spec
    await saveSpec(session.id, plan.rawMarkdown);

    // Spawn container (fire and forget)
    spawnContainer(session.id, plan).catch(async (error) => {
      await updateSession(session.id, { status: 'failed' });
      // Error logged in container spawn
    });

    // Return session ID immediately
    return reply.status(202).send({
      sessionId: session.id,
      message: 'Session started',
    });
  });

  // Get session status
  app.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getSession(id);

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return session;
  });

  // Get messages for session
  app.get('/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const messages = await getMessages(id);
    return messages;
  });
}
```

---

## Phase 7: Container Spawner

File: `packages/control-plane/src/container.ts` (~100 lines)

```typescript
import { execa } from 'execa';
import type { Plan } from '@fabrica/core';
import { updateSession, sendMessage } from './db.js';

const CONTAINER_IMAGE = process.env.FABRICA_CONTAINER_IMAGE || 'fabrica-runner:latest';

export async function spawnContainer(sessionId: string, plan: Plan): Promise<void> {
  const branchName = `fabrica/${sessionId.slice(0, 8)}`;

  await updateSession(sessionId, { status: 'running', branchName });
  await sendMessage(sessionId, 'progress', { message: 'Starting container...' });

  try {
    // Run devcontainer with Claude Code
    await execa('docker', [
      'run',
      '--rm',
      '--name', `fabrica-${sessionId.slice(0, 8)}`,
      // Environment
      '-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,
      '-e', `GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`,
      '-e', `SESSION_ID=${sessionId}`,
      '-e', `REPO_URL=${plan.repoUrl}`,
      '-e', `BRANCH_NAME=${branchName}`,
      '-e', `DATABASE_URL=${process.env.DATABASE_URL}`,
      // Pass plan via stdin or mount
      '-e', `PLAN_MARKDOWN=${Buffer.from(plan.rawMarkdown).toString('base64')}`,
      CONTAINER_IMAGE,
    ], {
      timeout: 60 * 60 * 1000, // 1 hour max
    });

    // Container completed successfully - it will have sent completion message
    await updateSession(sessionId, {
      status: 'completed',
      completedAt: new Date(),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    await sendMessage(sessionId, 'error', {
      message: `Container failed: ${message}`,
    });

    await updateSession(sessionId, {
      status: 'failed',
      completedAt: new Date(),
    });

    throw error;
  }
}
```

---

## Phase 8: Devcontainer Image

File: `Dockerfile`

```dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install basic tools
RUN apt-get update && apt-get install -y \
    git \
    gh \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create workspace
WORKDIR /workspace

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

File: `entrypoint.sh`

```bash
#!/bin/bash
set -e

# Decode plan
PLAN=$(echo "$PLAN_MARKDOWN" | base64 -d)

# Configure git
git config --global user.name "Fabrica"
git config --global user.email "fabrica@example.com"

# Clone repo
echo "Cloning $REPO_URL..."
git clone "$REPO_URL" /workspace/repo
cd /workspace/repo

# Create branch
git checkout -b "$BRANCH_NAME"

# Write plan to file for Claude to read
echo "$PLAN" > /workspace/plan.md

# Send progress message
psql "$DATABASE_URL" -c "INSERT INTO messages (session_id, type, content) VALUES ('$SESSION_ID', 'progress', '{\"message\": \"Starting Claude Code...\"}');"

# Run Claude Code with natural flow prompt
claude --print \
  --dangerously-skip-permissions \
  --system-prompt "You are working on a software development task. Read /workspace/plan.md for the full specification. Work naturally: understand the codebase, implement the changes, write tests, and commit your work. When done, push your branch and create a PR. If you get stuck or need human input, clearly state what you need." \
  "Read /workspace/plan.md and execute the plan. Create a PR when complete."

# Push and create PR
git push -u origin "$BRANCH_NAME"
PR_URL=$(gh pr create --title "Fabrica: $(head -1 /workspace/plan.md | sed 's/^#\s*//')" --body "$(cat /workspace/plan.md)" --head "$BRANCH_NAME")

# Send completion message
psql "$DATABASE_URL" -c "INSERT INTO messages (session_id, type, content) VALUES ('$SESSION_ID', 'completion', '{\"message\": \"PR created\", \"metadata\": {\"pr_url\": \"$PR_URL\"}}');"

# Update session with PR URL
psql "$DATABASE_URL" -c "UPDATE sessions SET pr_url = '$PR_URL' WHERE id = '$SESSION_ID';"

echo "Done! PR: $PR_URL"
```

---

## Phase 9: Docker Compose

File: `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fabrica
      POSTGRES_PASSWORD: fabrica
      POSTGRES_DB: fabrica
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fabrica"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    environment:
      DATABASE_URL: postgres://fabrica:fabrica@postgres:5432/fabrica
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      FABRICA_CONTAINER_IMAGE: fabrica-runner:latest
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # To spawn sibling containers

volumes:
  postgres_data:
```

---

## Summary

### Final File Structure

```
fabrica/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── types.ts        (~50 lines)
│   │       ├── plan-parser.ts  (~60 lines)
│   │       └── index.ts        (exports)
│   └── control-plane/
│       └── src/
│           ├── main.ts         (~20 lines)
│           ├── server.ts       (~30 lines)
│           ├── routes.ts       (~80 lines)
│           ├── db.ts           (~80 lines)
│           └── container.ts    (~100 lines)
├── Dockerfile                   (~20 lines)
├── entrypoint.sh               (~50 lines)
├── schema.sql                  (~50 lines)
├── docker-compose.yml          (~40 lines)
└── package.json
```

### Total: ~580 lines (down from ~4,600)

### What's Deleted
- Pipeline mode
- 7 specialist roles
- Issue queue (replaced by messages table)
- Session store abstraction
- Docker executor (merged into container.ts)
- Config management
- Secrets management
- Dependency graph
- Skill profiles
- Cloud profile management
- Cost tracking types
- Escalation system types

### What's New
- PostgreSQL for persistence + message queue
- Simple container spawner
- Devcontainer with Claude Code pre-installed
