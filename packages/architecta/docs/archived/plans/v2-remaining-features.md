# Implementation Plan: Remaining Features (v2)

## Overview

Architecta is a **planning and task management** tool. It creates plans where each task is marked as:
- **MUST DO** - Human performs the task
- **MUST VERIFY** - Agent can do it, human checks/approves

This plan covers the remaining features to make Architecta production-ready.

---

## What's Already Done

- [x] Monorepo structure (pnpm workspace + turbo)
- [x] API server (Fastify + SSE streaming)
- [x] Web frontend (Next.js + dark theme)
- [x] Plan generation with codebase exploration
- [x] Tool-based clarifying questions
- [x] Research/Ask feature
- [x] Human role tracking (MUST DO / MUST VERIFY)
- [x] Task progress tracking (checkboxes)
- [x] GCP Secret Manager integration

---

## Remaining Features

### 1. Persistence (Database)

**Description:** Store workflows in a database instead of in-memory.

**Human Role:** MUST VERIFY

**Requirements:**
- Use PostgreSQL (matches Fabrica)
- Store: workflows, plans, task statuses
- Support workflow history and retrieval

**Acceptance Criteria:**
- [ ] Workflows persist across server restarts
- [ ] Can list all workflows for a user
- [ ] Task completion status is saved

**Implementation Notes:**
- Add `@architecta/db` package with Drizzle ORM
- Schema: `workflows`, `plans`, `tasks`, `task_completions`
- Migrate from in-memory store

---

### 2. Authentication

**Description:** Add user authentication to protect workflows.

**Human Role:** MUST DO (design decision on auth method)

**Requirements:**
- OAuth2 or magic link authentication
- Associate workflows with users
- Protect API endpoints

**Acceptance Criteria:**
- [ ] Users can sign in
- [ ] Workflows are scoped to user
- [ ] Unauthenticated requests are rejected

**Implementation Notes:**
- Options: Clerk, Auth.js, or custom OAuth
- Add `userId` to workflow schema
- Middleware for auth checking

---

### 3. GitHub Integration

**Description:** Create branches and PRs from approved plans.

**Human Role:** MUST VERIFY

**Requirements:**
- GitHub OAuth for repo access
- Create branch from plan
- Create PR with plan as description

**Acceptance Criteria:**
- [ ] "Create Branch" button on approved plan
- [ ] Branch created with meaningful name
- [ ] PR created with tasks as checklist

**Implementation Notes:**
- Use Octokit or gh CLI
- Branch name: `architecta/<plan-title-slug>`
- PR body: plan markdown with task checkboxes

---

### 4. Project/Session Management

**Description:** Support multiple workflows and switching between them.

**Human Role:** MUST VERIFY

**Requirements:**
- List all user's workflows
- Switch between workflows
- Archive/delete old workflows

**Acceptance Criteria:**
- [ ] Sidebar showing workflow list
- [ ] Click to switch workflows
- [ ] New workflow button
- [ ] Delete workflow option

**Implementation Notes:**
- Add workflow list API endpoint
- Sidebar component in UI
- Active workflow state management

---

### 5. Progress Visualization

**Description:** Show workflow stages visually.

**Human Role:** MUST VERIFY

**Requirements:**
- Visual pipeline: Planning → Ready → In Progress → Done
- Show which tasks are MUST DO vs MUST VERIFY
- Overall progress indicator

**Acceptance Criteria:**
- [ ] Stage indicator at top of workflow
- [ ] Tasks grouped by human role
- [ ] Progress percentage visible

**Implementation Notes:**
- Stepper/pipeline component
- Filter tasks by humanRole
- Calculate progress from task statuses

---

## Implementation Order

1. **Persistence** - Foundation for everything else
2. **Project/Session Management** - Requires persistence
3. **Progress Visualization** - UI enhancement
4. **Authentication** - Security layer
5. **GitHub Integration** - Nice-to-have

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fabrica integration | Execution handled by separate system |
| Automated iteration | Human-driven workflow |
| Confidence scoring | Human judgment replaces AI scoring |
| Stress testing | Simplified planning flow |
| Auto-approval | All plans require human action |

---

## Dependencies

### New Packages Needed

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "postgres": "^3.4.0",
    "@auth/core": "^0.30.0",
    "octokit": "^3.1.0"
  }
}
```

---

## Success Criteria

1. User can sign in
2. Create multiple workflows
3. Generate plans with MUST DO / MUST VERIFY tasks
4. Track task completion (persisted)
5. Create GitHub PR from approved plan
6. Switch between workflows
