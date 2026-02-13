# GitHub as a Knowledge Layer — Data Layer Extension Spec

## Context

This document extends the [Unified Data Layer API specification](./unified-data-layer-api.md) to cover GitHub as a first-class knowledge source. GitHub is not just another connector — it serves a dual role as both a structured data source (issues, PRs, discussions) and a knowledge base (technical docs, READMEs, architecture decision records, inline code comments). This spec defines how both roles are handled.

---

## Why GitHub Is Different

Most data sources in the unified data layer are flat: a Slack message is a message, a Notion page is a document. GitHub is a tree. A repository contains interconnected files where context flows between them — a README references an API module, which imports a config file, which was changed in a PR that has a discussion thread explaining why.

Agents need to navigate that structure, not just keyword-match against individual files. This means the GitHub connector needs to be smarter than the others, and the indexing strategy needs to account for relationships between files, not just file contents.

---

## Resource Type Mappings

GitHub content maps to the unified resource model as follows:

| GitHub Concept | Resource Type | Notes |
|---|---|---|
| Issue | `task` | Including labels, assignees, milestones |
| Pull request | `pull_request` | Including review comments, status, linked issues |
| Discussion | `thread` | GitHub Discussions (Q&A, announcements, etc.) |
| README / markdown file | `document` | Primary knowledge base content |
| Docs folder contents | `document` | Technical documentation, guides, runbooks |
| Architecture Decision Record (ADR) | `document` | Subtyped as `adr` in metadata |
| Wiki page | `document` | If GitHub Wiki is used |
| Source code file | `code` | Selectively indexed — see tiered approach below |
| Commit | `event` | Indexed for change tracking, not full-text search |
| GitHub Action run | `event` | CI/CD status and logs |
| Release | `event` | Changelogs and release notes |
| Code comment (inline) | `message` | Review comments on specific lines |
| Issue/PR comment | `message` | Discussion within issues and PRs |

---

## Indexing Strategy: Tiered Approach

Not all GitHub content is equally valuable as a knowledge source. Indexing everything creates noise and burns resources. Instead, content is split into three tiers with different indexing and retrieval strategies.

### Tier 1 — Always Indexed (Knowledge Base)

This is the core of GitHub-as-knowledge-layer. These files are indexed into the search index on every change to `main` (or the repo's default branch), with full-text and embeddings.

**What gets indexed:**
- `README.md` and `README.*` at any level of the repo tree
- Everything under `docs/`, `documentation/`, `wiki/`, `guides/`, `runbooks/`
- Architecture Decision Records (`adr/`, `decisions/`, or files matching `*-adr-*`, `*-decision-*`)
- `CONTRIBUTING.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `SECURITY.md`
- Any `.md` or `.txt` file at the repo root
- Release notes and tag descriptions
- GitHub Wiki pages (if enabled)

**How it's indexed:**
- Full content is embedded and keyword-indexed
- File path is preserved as metadata (so an agent knows this doc lives in `payments-service/docs/api-reference.md`)
- Parent repo, branch, and last commit SHA are tracked
- Cross-references between files are extracted and stored as relationships (e.g. "this README links to `./docs/setup.md`")

**Refresh trigger:** Webhook on push to default branch. Only re-indexes files that changed in the commit (diff-based, not full re-index).

### Tier 2 — Indexed on Demand (Source Code)

Source code files are not in the default search index. They are fetched live from the GitHub API when an agent specifically requests code-level context.

**What this covers:**
- All source code files (`.py`, `.ts`, `.go`, `.java`, `.rs`, etc.)
- Configuration files (`.yaml`, `.toml`, `.json`, `.env.example`)
- Infrastructure as code (`.tf`, `Dockerfile`, `docker-compose.yml`, `k8s/` manifests)
- CI/CD definitions (`.github/workflows/`, `Jenkinsfile`, etc.)

**How it works:**
- Agent queries the API with a code-specific request (e.g. "show me the authentication middleware in the payments service")
- The API routes to the GitHub connector, which uses the GitHub Search API or Contents API to find matching files
- Results are returned live, not from the index
- Optionally, frequently-accessed code files can be promoted to Tier 1 indexing based on access patterns

**Why not index all code by default:**
- Repos change constantly — every commit would trigger re-indexing across potentially thousands of files
- Most code files are low-value for agent knowledge queries (utility functions, generated code, tests)
- The GitHub Search API is fast enough for on-demand retrieval
- Keeps the search index focused on high-signal content

### Tier 3 — Structured Data (Issues, PRs, Discussions)

These map directly to existing resource types and follow the standard connector sync pattern.

**What this covers:**
- Issues (open and closed, with comments)
- Pull requests (with review comments, status checks, linked issues)
- Discussions
- Commits (metadata only — author, message, changed files, not diffs)
- GitHub Action workflow runs (status, duration, failure logs)
- Releases

**How it's indexed:**
- Standard search index — metadata, embeddings, keyword search
- Synced via GitHub webhooks with polling fallback
- Expected freshness: ~5 seconds for webhook-driven events

---

## Cross-Referencing: What Makes This Powerful

The real value of GitHub in the knowledge layer isn't individual files — it's the connections between them and between GitHub and other sources.

### Within GitHub

The connector should extract and index cross-references:

- A PR that closes an issue → link between the `pull_request` and `task` resources
- A docs file that references another docs file → relationship stored in the index
- A commit that changes files across multiple directories → change set tracked as related resources
- An ADR that references the PR where it was implemented → bidirectional link

### Across Sources

This is where the unified data layer shines. An agent asking about "the payments service" should be able to find:

- The `payments-service` repo README and docs (GitHub, Tier 1)
- Slack threads in `#payments-engineering` discussing recent changes (Slack)
- The Notion product spec for the payments feature (Notion)
- Jira tickets related to payments bugs (Jira)
- The PR that introduced the latest payments API change (GitHub, Tier 3)
- The deployment runbook (GitHub, Tier 1 — `docs/runbooks/deploy.md`)

All from a single search query. The cross-source search index handles this — the GitHub connector just needs to ensure its indexed content has enough metadata to surface alongside results from other sources.

---

## Permissions

### Dual Enforcement

GitHub permissions are enforced at two levels:

**Level 1 — Data Layer Permission Rules:**
The standard permission enforcer applies. Rules can scope GitHub access by:

```json
{
  "id": "rule-010",
  "name": "Onboarding agent — public repos and docs only",
  "caller": { "agent": "onboarding-bot" },
  "effect": "allow",
  "actions": ["read", "search"],
  "scope": {
    "sources": ["github"],
    "resource_types": ["document"],
    "conditions": {
      "github_visibility": "public",
      "github_tier": ["tier_1"]
    }
  }
}
```

```json
{
  "id": "rule-011",
  "name": "Engineering agents — full access to eng repos",
  "caller": { "role": "engineering" },
  "effect": "allow",
  "actions": ["read", "search", "write"],
  "scope": {
    "sources": ["github"],
    "conditions": {
      "github_orgs": ["mycompany"],
      "github_teams": ["engineering", "infrastructure", "platform"],
      "github_repos": ["*"]
    }
  }
}
```

```json
{
  "id": "rule-012",
  "name": "Deny all agents access to security-sensitive repos",
  "caller": { "any": true },
  "effect": "deny",
  "actions": ["read", "search", "write", "delete"],
  "scope": {
    "sources": ["github"],
    "conditions": {
      "github_repos": ["secrets-manager", "security-audit", "pen-test-*"],
      "github_topics": ["security", "credentials"]
    }
  }
}
```

**Level 2 — GitHub API Token Scoping:**
The GitHub connector authenticates with a token (GitHub App installation token or fine-grained PAT). This token is scoped to specific repos, orgs, and permissions at the GitHub level. Even if a data layer rule is misconfigured, the GitHub API itself rejects requests the token doesn't have access to.

This is defense in depth. The data layer rules are the primary enforcement. The GitHub token scope is the safety net.

### Token Strategy

| Approach | Pros | Cons |
|---|---|---|
| Single GitHub App (org-wide) | One token, simple management | Broad access — relies more on data layer rules |
| Per-team GitHub App installations | Token scope matches team boundaries | More tokens to manage |
| Fine-grained PATs per agent | Tightest scope possible | PATs expire, manual rotation |

**Recommendation:** Use a GitHub App installed at the org level with repository-level permissions. The App can generate installation tokens scoped to specific repos on the fly, matching the data layer permission rules. This gives you org-wide coverage with per-request scoping.

---

## Write-Back Operations

Agents can write back to GitHub through the data layer. The same permission rules apply — an agent needs explicit write access to the target repo and resource type.

### Supported Write Operations

| Operation | Resource Type | GitHub Action |
|---|---|---|
| Create issue | `task` | `POST /repos/{owner}/{repo}/issues` |
| Comment on issue/PR | `message` | `POST /repos/{owner}/{repo}/issues/{number}/comments` |
| Update issue status | `task` | `PATCH /repos/{owner}/{repo}/issues/{number}` |
| Create/update file | `document` or `code` | `PUT /repos/{owner}/{repo}/contents/{path}` (creates a commit) |
| Create PR | `pull_request` | `POST /repos/{owner}/{repo}/pulls` |
| Trigger workflow | `event` | `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` |

### Write Safeguards

Writes to GitHub are higher-risk than reads — an agent creating a commit or PR is modifying the source of truth. Safeguards:

- **Branch protection:** Agents cannot push directly to `main` or any protected branch. Write operations that create or modify files always go through a branch + PR flow.
- **Commit attribution:** All commits made by agents are attributed to the agent's identity (e.g. `onboarding-bot <onboarding-bot@company.com>`), never impersonating a human.
- **Write audit:** All write operations are logged with full before/after state in the audit log.
- **Rate limiting:** Write operations to GitHub are rate-limited per agent to prevent runaway automation (e.g. an agent in a loop creating thousands of issues).

---

## GitHub Connector Configuration

When registering the GitHub connector via `POST /v1/sources`, the configuration includes:

```json
{
  "source_type": "github",
  "config": {
    "auth": {
      "type": "github_app",
      "app_id": "12345",
      "installation_id": "67890",
      "private_key_secret": "vault://github-app-private-key"
    },
    "orgs": ["mycompany"],
    "indexing": {
      "tier_1": {
        "branches": ["main"],
        "paths": [
          "README.md",
          "docs/**",
          "adr/**",
          "decisions/**",
          "*.md",
          "CONTRIBUTING.md",
          "CHANGELOG.md",
          "ARCHITECTURE.md"
        ],
        "exclude_paths": [
          "node_modules/**",
          "vendor/**",
          ".git/**",
          "dist/**",
          "build/**"
        ],
        "include_wikis": true,
        "include_releases": true
      },
      "tier_2": {
        "enabled": true,
        "auto_promote_threshold": 10,
        "file_extensions": [
          ".py", ".ts", ".js", ".go", ".rs", ".java",
          ".tf", ".yaml", ".yml", ".toml", ".json",
          "Dockerfile", "docker-compose.yml"
        ],
        "exclude_paths": [
          "node_modules/**",
          "vendor/**",
          "*.min.js",
          "*.generated.*",
          "package-lock.json",
          "yarn.lock"
        ]
      },
      "tier_3": {
        "issues": true,
        "pull_requests": true,
        "discussions": true,
        "commits": true,
        "actions": true,
        "releases": true,
        "lookback_days": 90
      }
    },
    "repo_filter": {
      "include": ["*"],
      "exclude": ["*-archive", "deprecated-*"],
      "exclude_archived": true,
      "exclude_forks": true
    }
  }
}
```

### Auto-Promotion (Tier 2 → Tier 1)

The `auto_promote_threshold` setting controls automatic promotion of frequently-accessed code files into the persistent index. If a Tier 2 file is fetched live more than N times in a rolling 7-day window, it gets added to the Tier 1 index automatically. This means the index learns what's valuable based on actual agent usage patterns.

Promoted files can be demoted back to Tier 2 if access drops below the threshold, keeping the index lean.

---

## Example Queries

### Agent asks about a service

```
POST /v1/search
{
  "query": "payments service architecture",
  "resource_types": ["document"],
  "sources": ["github", "notion"]
}
```

Returns: the payments-service README, its `docs/architecture.md`, the relevant Notion product spec, and any ADRs tagged with "payments".

### Agent needs to understand a recent change

```
POST /v1/search
{
  "query": "authentication flow refactor",
  "resource_types": ["pull_request", "document", "message"],
  "time_range": { "after": "2025-02-01T00:00:00Z" }
}
```

Returns: the PR that refactored auth, its review comments, the updated auth docs, and any Slack discussion about the refactor.

### Agent needs specific code

```
GET /v1/code?source=github&repo=payments-service&path=src/middleware/auth.ts
```

Fetches the file live from GitHub (Tier 2). Not from the index.

### Agent needs a deployment runbook

```
POST /v1/search
{
  "query": "deploy payments service to production",
  "resource_types": ["document"],
  "sources": ["github"]
}
```

Returns: `payments-service/docs/runbooks/deploy.md`, the relevant CHANGELOG entries, and the latest release notes.

### Agent creates an issue from a Slack conversation

```
POST /v1/tasks
{
  "source": "github",
  "target": {
    "repo": "payments-service",
    "labels": ["bug", "p1"]
  },
  "content": {
    "title": "Latency spike on /v1/charge endpoint",
    "body": "Reported in Slack (#payments-engineering, Feb 13). Multiple users seeing 2s+ response times on the charge endpoint since the last deploy. See thread: udl:slack:C04ABCDEF:1234567890.123456"
  }
}
```

The agent creates a GitHub issue and cross-references the Slack thread using the unified resource ID — keeping the audit trail intact across sources.

---

## Sync Strategy

| Content Type | Sync Method | Freshness Target |
|---|---|---|
| Tier 1 (docs, READMEs) | Webhook on push to default branch, diff-based re-index | ~10-30 seconds |
| Tier 2 (source code) | No sync — fetched live on demand | Real-time |
| Tier 3 (issues, PRs, etc.) | Webhooks + polling fallback | ~5 seconds |
| Wiki pages | Polling (GitHub Wiki has limited webhook support) | ~60 seconds |

---

## Relationship to the Unified Data Layer

This spec does not change the core architecture. GitHub is another connector behind the same API gateway, subject to the same permission enforcer, audit logger, and search index. The differences are:

- The connector is more complex (tiered indexing, cross-referencing, tree navigation)
- The permission model has an additional enforcement layer (GitHub token scoping)
- Write operations have additional safeguards (branch protection, commit attribution)
- The indexing strategy is selective rather than comprehensive

From an agent's perspective, nothing changes. They call the same API, use the same resource types, and get results from GitHub alongside every other source — filtered by the same permission rules.
