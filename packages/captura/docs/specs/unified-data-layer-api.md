# Unified Data Layer API — Technical Specification

## Overview

A single API that provides agents and internal tools with read and write access to all organisational data sources (Slack, Email, Notion, Google Drive, Jira, etc.) through one interface. Data remains at source. The API acts as a gateway — routing requests to the appropriate source, enforcing permissions, and logging all access.

This is not a data lake. No data is copied or centralised. The API proxies and translates requests to source system APIs in near real-time.

## Design Principles

- **One API, many sources.** Agents never talk to source systems directly. They talk to this API and it handles the rest.
- **Data stays at source.** The API reads from and writes to source systems on demand. The only thing stored centrally is the index (metadata + embeddings for search) and the permission/audit layer.
- **Permissions are first-class.** Every request is scoped to what the calling agent or user is allowed to access. No exceptions.
- **Source-agnostic resource model.** The API exposes resource types (messages, documents, tasks, etc.), not source names. An agent searching for messages doesn't need to know whether results come from Slack, email, or both.
- **Near real-time.** Live queries hit source APIs directly. The search index is refreshed on a sub-1-minute interval.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Agents / Tools                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                        HTTPS / gRPC
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      API Gateway                            │
│                                                             │
│   ┌─────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│   │  Auth &  │  │  Permission  │  │     Audit Logger      │ │
│   │  AuthZ   │  │   Enforcer   │  │                       │ │
│   └─────────┘  └──────────────┘  └───────────────────────┘ │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Request Router                     │   │
│   └────────────────────────┬────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌─────▼──────┐
     │ Connector: │  │ Connector: │  │ Connector: │   ...
     │   Slack    │  │   Gmail    │  │   Notion   │
     └────────┬───┘  └──────┬─────┘  └─────┬──────┘
              │              │              │
         Slack API      Gmail API     Notion API
```

### Components

**API Gateway:** Single entry point. Handles authentication, permission checks, audit logging, and routes requests to the appropriate connector(s). Stateless — can be horizontally scaled.

**Connectors:** One per data source. Each connector translates the unified resource model into source-specific API calls. Connectors are plugins — adding a new source means writing a new connector, nothing else changes.

**Permission Enforcer:** Evaluates every request against the permission rules before it reaches a connector. Denies or filters results based on the caller's access scope.

**Audit Logger:** Logs every request — who asked, what they asked for, which sources were hit, what was returned, and any write operations performed. Append-only. Non-negotiable.

**Search Index:** A lightweight store of metadata and embeddings pointing back to source records. Powers cross-source search. Refreshed by connectors on a short polling interval (target: under 60 seconds). This is the only data stored centrally, and it contains references, not content — or if content is indexed, it is encrypted at rest and subject to the same permission enforcement.

---

## Resource Model

The API exposes a **source-agnostic resource model**. Agents interact with resource types, not source systems.

### Core Resource Types

| Resource Type | Description | Example Sources |
|---|---|---|
| `message` | A communication between people | Slack messages, emails, Notion comments |
| `document` | A long-form piece of content | Notion pages, Google Docs, Confluence pages |
| `file` | A binary or stored file | Google Drive files, Slack file uploads, email attachments |
| `task` | A work item with status | Jira issues, Notion database items, Asana tasks |
| `event` | A calendar event | Google Calendar, Outlook |
| `thread` | An ordered collection of messages | Slack threads, email threads |
| `contact` | A person or entity | Google Contacts, CRM records |

### Unified Resource Schema

Every resource returned by the API conforms to a base schema:

```json
{
  "id": "udl:slack:C04ABCDEF:1234567890.123456",
  "resource_type": "message",
  "source": "slack",
  "source_id": "1234567890.123456",
  "source_location": {
    "workspace": "mycompany",
    "channel": "engineering",
    "channel_id": "C04ABCDEF"
  },
  "content": {
    "text": "Has anyone looked at the latency issue on the payments service?",
    "html": null,
    "attachments": []
  },
  "author": {
    "name": "Alice Chen",
    "email": "alice@company.com",
    "source_user_id": "U01ABCDEF"
  },
  "timestamps": {
    "created_at": "2025-02-13T10:30:00Z",
    "updated_at": "2025-02-13T10:30:00Z",
    "indexed_at": "2025-02-13T10:30:45Z"
  },
  "permissions": {
    "readable_by": ["agent:support-bot", "role:engineering"],
    "writable_by": ["role:engineering"]
  },
  "metadata": {}
}
```

The `id` is a composite: `udl:{source}:{location}:{source_id}`. This makes every resource globally unique and traceable back to its source.

---

## API Endpoints

### Search (Cross-Source)

```
POST /v1/search
```

Search across all sources the caller has access to. Hits the search index, then hydrates results from source APIs.

```json
{
  "query": "payments service latency",
  "resource_types": ["message", "document"],
  "sources": ["slack", "notion"],
  "time_range": {
    "after": "2025-02-01T00:00:00Z",
    "before": "2025-02-14T00:00:00Z"
  },
  "limit": 20,
  "offset": 0
}
```

All filter fields are optional. Omitting `sources` searches all sources the caller has access to. Omitting `resource_types` searches all types.

Response:

```json
{
  "results": [
    {
      "resource": { ... },
      "relevance_score": 0.94,
      "snippet": "...looked at the **latency** issue on the **payments service**..."
    }
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

### Read

```
GET /v1/resources/{id}
```

Fetch a single resource by its unified ID. The API resolves the source from the ID and fetches live from the source API.

```
GET /v1/resources/{id}/thread
```

For messages: returns the full thread/conversation the resource belongs to.

### List

```
GET /v1/{resource_type}
```

List resources of a given type with filters.

```
GET /v1/messages?source=slack&channel=engineering&after=2025-02-12T00:00:00Z&limit=50
GET /v1/documents?source=notion&workspace=product&limit=20
GET /v1/tasks?status=open&assigned_to=alice@company.com
```

### Write

```
POST /v1/{resource_type}
```

Create a new resource in a specific source.

```json
{
  "source": "slack",
  "target": {
    "channel_id": "C04ABCDEF"
  },
  "content": {
    "text": "Deployment to staging completed successfully."
  }
}
```

```
PATCH /v1/resources/{id}
```

Update an existing resource.

```json
{
  "content": {
    "status": "done"
  }
}
```

```
DELETE /v1/resources/{id}
```

Delete a resource at source (if the source and permissions allow it).

### Write operations return the updated resource and are subject to stricter permission checks than reads.

### Sources Management

```
GET    /v1/sources                    # List connected sources
GET    /v1/sources/{source}           # Source status, health, last sync
POST   /v1/sources                    # Register a new source connection
DELETE /v1/sources/{source}           # Disconnect a source
GET    /v1/sources/{source}/schema    # What resource types this source provides
```

---

## Permissions and Access Control

### Model

Permissions are defined as **rules** that map callers to what they can access. A caller is either an **agent** (identified by an API key) or a **user** (identified by a token).

```json
{
  "rules": [
    {
      "id": "rule-001",
      "name": "Support bot — read customer channels only",
      "caller": { "agent": "support-bot" },
      "effect": "allow",
      "actions": ["read", "search"],
      "scope": {
        "sources": ["slack"],
        "resource_types": ["message", "thread"],
        "conditions": {
          "channel_prefix": "customer-"
        }
      }
    },
    {
      "id": "rule-002",
      "name": "Engineering agents — full access to eng tools",
      "caller": { "role": "engineering" },
      "effect": "allow",
      "actions": ["read", "search", "write", "delete"],
      "scope": {
        "sources": ["slack", "notion", "jira", "github"],
        "conditions": {
          "slack_channels": ["engineering", "deployments", "incidents"],
          "notion_workspaces": ["Engineering"],
          "jira_projects": ["ENG", "INFRA"]
        }
      }
    },
    {
      "id": "rule-003",
      "name": "Deny all agents access to HR",
      "caller": { "any": true },
      "effect": "deny",
      "actions": ["read", "search", "write", "delete"],
      "scope": {
        "conditions": {
          "slack_channels": ["hr-*", "compensation-*", "legal-*"],
          "notion_workspaces": ["HR", "Legal"],
          "labels": ["confidential", "pii"]
        }
      }
    }
  ]
}
```

### Evaluation Logic

1. Collect all rules that match the caller.
2. Deny rules win over allow rules (deny-overrides).
3. If no rule explicitly allows the action, it is denied (default-deny).
4. Results from search and list endpoints are **filtered post-query** — the search index returns candidates, and the permission enforcer strips out anything the caller can't see before returning results.

### Permission Management Endpoints

```
GET    /v1/permissions/rules              # List all rules
POST   /v1/permissions/rules              # Create a rule
PATCH  /v1/permissions/rules/{id}         # Update a rule
DELETE /v1/permissions/rules/{id}         # Delete a rule
POST   /v1/permissions/evaluate           # Test: "can agent X do Y on resource Z?"
GET    /v1/permissions/audit/{caller_id}  # What can this caller access?
```

---

## Connectors

### Connector Interface

Every connector implements the same interface:

```
read(source_id) → Resource
list(filters) → Resource[]
write(target, content) → Resource
delete(source_id) → void
sync() → IndexUpdate[]
health() → HealthStatus
```

### Connector Lifecycle

1. **Register:** Admin connects a source via `/v1/sources`, providing OAuth credentials or API keys.
2. **Initial sync:** Connector performs a backfill to populate the search index with historical data (bounded — e.g. last 90 days).
3. **Ongoing sync:** Connector polls or receives webhooks from the source and pushes index updates. Target: sub-60-second freshness.
4. **Live reads:** When the API needs a specific resource, the connector fetches it live from the source API, bypassing the index.

### Sync Strategy Per Source

| Source | Sync Method | Expected Freshness |
|---|---|---|
| Slack | WebSocket (Events API) + periodic backfill | ~5 seconds |
| Gmail | Push notifications (Pub/Sub) + polling fallback | ~10-30 seconds |
| Google Drive | Push notifications (Changes API) + polling | ~30 seconds |
| Notion | Polling (no webhook support for all changes) | ~30-60 seconds |
| Jira | Webhooks + polling fallback | ~10 seconds |
| GitHub | Webhooks | ~5 seconds |

### Adding a New Connector

1. Implement the connector interface.
2. Define the resource type mappings (e.g., "Jira issue" → `task`).
3. Register the source via the API.
4. Define permission rules for the new source.
5. No changes to the gateway, router, or existing connectors.

---

## Search Index

### What Gets Indexed

The index stores **metadata and embeddings**, not full content (unless required for search quality, in which case content is encrypted at rest).

Per record:
- Unified resource ID
- Resource type
- Source and source location
- Author
- Timestamps
- Text embedding (for semantic search)
- Keywords (for keyword search)
- Permission labels (for filtering)

### Index Technology

Options depending on scale:
- **Small scale (current — 8 people):** PostgreSQL with `pgvector` for embeddings and full-text search. Simple, no new infrastructure.
- **Medium scale:** Dedicated search engine (Typesense, Meilisearch) + vector store (Qdrant, Weaviate).
- **Large scale:** Elasticsearch/OpenSearch + dedicated vector DB.

Start with PostgreSQL. Move to dedicated tooling when query latency or index size demands it.

### Index Refresh

Connectors push updates to the index as they sync. The index is append/update only — deletions are soft-deletes with a flag, hard-deleted on a schedule.

---

## Authentication

### Agents

Each agent gets an API key. The key identifies the agent and maps to its permission rules.

```
Authorization: Bearer udl_agent_abc123def456
```

API keys are:
- Scoped to a single agent identity
- Rotatable without downtime (support multiple active keys per agent)
- Revocable instantly
- Logged on every use

### Users (If Applicable)

For human-facing tools that call the API on behalf of a user:

```
Authorization: Bearer udl_user_{oauth_token}
```

User tokens inherit the user's permission rules. The API can optionally defer to the source system's own permissions (e.g. only show Slack channels the user is actually a member of).

### Key Management Endpoints

```
POST   /v1/auth/keys              # Issue a new agent API key
GET    /v1/auth/keys              # List active keys
DELETE /v1/auth/keys/{key_id}     # Revoke a key
POST   /v1/auth/keys/{key_id}/rotate  # Rotate a key
```

---

## Audit Logging

Every API call is logged. Every one.

### Log Schema

```json
{
  "timestamp": "2025-02-13T10:31:02Z",
  "caller": {
    "type": "agent",
    "id": "support-bot",
    "key_id": "key_abc123"
  },
  "action": "search",
  "request": {
    "endpoint": "POST /v1/search",
    "query": "payments service latency",
    "resource_types": ["message"],
    "sources": ["slack"]
  },
  "response": {
    "status": 200,
    "results_returned": 12,
    "results_filtered_by_permissions": 3,
    "resource_ids": ["udl:slack:C04ABCDEF:123...", "..."]
  },
  "permission_rules_applied": ["rule-001", "rule-003"],
  "duration_ms": 340
}
```

### Key Fields

- `results_filtered_by_permissions` — how many results were found but hidden from the caller. Important for detecting agents that are repeatedly bumping into permission boundaries.
- `permission_rules_applied` — which rules were evaluated. Useful for debugging access issues.

### Retention

Audit logs are retained for a minimum of 12 months. Stored separately from the application database. Append-only, immutable.

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Agent 'support-bot' does not have read access to source 'notion' workspace 'HR'.",
    "request_id": "req_abc123",
    "timestamp": "2025-02-13T10:31:02Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `PERMISSION_DENIED` | 403 | Caller doesn't have access to the requested resource or action |
| `SOURCE_UNAVAILABLE` | 502 | Source API is down or unreachable |
| `SOURCE_RATE_LIMITED` | 429 | Source API rate limit hit — retry after backoff |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist or has been deleted at source |
| `INVALID_REQUEST` | 400 | Malformed request |
| `INDEX_STALE` | 200 (header) | Results returned but index freshness exceeds target — flagged in response headers |

### Partial Failures

Cross-source searches may partially fail (e.g. Slack is up but Notion is down). The API returns results from available sources and includes a `warnings` array:

```json
{
  "results": [...],
  "warnings": [
    {
      "source": "notion",
      "code": "SOURCE_UNAVAILABLE",
      "message": "Notion API returned 503. Results from Notion are excluded."
    }
  ]
}
```

---

## Deployment and Infrastructure

This system follows the environment strategy defined in the separate Environment Strategy document.

- **Sandbox:** Used to prototype new connectors and test permission rules. Ephemeral — 7-day TTL.
- **Dev:** Persistent deployment with test data sources (sandbox Slack workspace, test Notion, etc.).
- **Staging:** Connected to staging instances of source tools where possible. Permission rules mirror prod.
- **Prod:** Connected to real source systems. Full audit logging. Monitored.

### Infrastructure Components

| Component | Technology (Starting Point) |
|---|---|
| API Gateway | Go or Python (FastAPI), stateless, behind a load balancer |
| Permission Enforcer | In-process library, rules cached in memory, refreshed on change |
| Audit Logger | Async write to append-only store (PostgreSQL or S3 + Athena) |
| Search Index | PostgreSQL with pgvector |
| Connectors | Separate processes/containers per source |
| Secrets (OAuth tokens, API keys) | Vault or AWS Secrets Manager |
| Queue (for async sync jobs) | Redis or SQS |

### Scaling Path

Start simple. PostgreSQL handles everything at 8 people. When the index grows past what Postgres handles comfortably, split out the search index. When connector load grows, scale connector containers independently. The gateway is stateless and scales horizontally from day one.

---

## Implementation Priority

### Phase 1 — Foundation
- API gateway with auth and permission enforcement
- Audit logging
- Two connectors: Slack and Notion (highest signal sources for most teams)
- Search index in PostgreSQL with pgvector
- Basic permission rules (per-agent, per-source)

### Phase 2 — Expand Sources
- Gmail / Google Workspace connector
- Google Drive connector
- Jira connector
- Granular permission conditions (channel-level, workspace-level, project-level)

### Phase 3 — Harden
- Write-back support across all connectors
- Permission rule testing and simulation tooling
- Audit log dashboards and alerting
- Index freshness monitoring and SLA tracking

### Phase 4 — Scale
- Migrate search index to dedicated engine if needed
- Connector health monitoring and auto-recovery
- Rate limiting and quota management per agent
- Multi-team / multi-org support if the organisation grows
