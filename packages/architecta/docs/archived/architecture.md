# Architecta Architecture

## Overview

Architecta is a **planning and task management** tool that transforms human requirements into actionable task lists. Each task specifies whether the human must perform it themselves (MUST DO) or just verify/approve it (MUST VERIFY).

```
Human Intent → Architecta → Task List → Human Execution
                    ↑
              clarifying questions
```

## Design Principle

**Create clear, actionable plans with explicit human involvement.**

Architecta's role:
- Explore codebase and understand context
- Ask clarifying questions
- Generate detailed task plans
- Track task completion

Human touchpoints:
1. **Intent** - "I want X"
2. **Clarification** - Answer questions about requirements
3. **Plan approval** - Review and approve the task list
4. **Execution** - Complete MUST DO tasks, verify MUST VERIFY tasks

## Components

| Component | Role | Function |
|-----------|------|----------|
| **Captura** | Data Engineer | Ingest and transform data |
| **Sapien** | Knowledge Engineer | Structure into queryable knowledge |
| **Architecta** | Product Engineer | Intelligent orchestrator - planning, review, iteration |
| **Fabrica** | Software Engineer | Execution engine - runs Claude Code, produces artifacts |
| **Lumina** | Product Manager | Measure outcomes, guide priorities |
| **Opera** | Systems Engineer | Observe, orchestrate, optimize |

This document focuses on **Architecta** and **Fabrica**.

---

## Architecta

The Planning Engine. Creates actionable task lists from requirements.

### Architecture

```
Human: "I want X"
       ↓
┌─────────────────────────────────────────────────────────────────┐
│                         ARCHITECTA                               │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │   Explore        │ ← Understand codebase context              │
│  └────────┬─────────┘                                            │
│           ↓                                                      │
│  ┌──────────────────┐                                            │
│  │   Clarify        │ ← Ask questions about requirements         │
│  └────────┬─────────┘                                            │
│           ↓                                                      │
│  ┌──────────────────┐                                            │
│  │   Plan Gen       │ ← Create task list with human roles        │
│  └────────┬─────────┘                                            │
│           ↓                                                      │
│  ┌──────────────────┐                                            │
│  │   Human Approval │ ← Review and approve plan                  │
│  └────────┬─────────┘                                            │
│           ↓                                                      │
│  ┌──────────────────┐                                            │
│  │   Track Progress │ ← Human completes/verifies tasks           │
│  └──────────────────┘                                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
       ↓
Human: Completes tasks, marks done
```

### Phases

#### 1. Exploration

Architecta explores the codebase to understand context:

- Read relevant files using tools (Read, Glob, Grep, git)
- Understand existing patterns and conventions
- Identify constraints and dependencies

#### 2. Clarification

Before creating a plan, Architecta asks clarifying questions:

- Structured questions with multiple-choice options
- Ensures requirements are clear
- Avoids assumptions

#### 3. Plan Generation

Architecta creates a detailed task list:

- Each task has a human role:
  - **MUST DO** - Human performs this task (design decisions, config, deployment)
  - **MUST VERIFY** - Agent can help, human reviews (code changes, tests)
- Requirements and acceptance criteria for each task
- Clear, actionable descriptions

#### 4. Human Approval

Human reviews the plan:

- Does this capture my intent?
- Are the human roles appropriate?
- Approve or provide feedback to refine

#### 5. Progress Tracking

Human works through the tasks:

- Mark MUST DO tasks as complete when done
- Mark MUST VERIFY tasks as complete after reviewing
- Visual progress tracking in UI

### What Architecta Produces

A structured plan with tasks and human roles:

```markdown
# Add user authentication

## Task 1: Design auth flow [MUST DO]

Human designs the authentication approach.

Requirements:
- Decide on auth method (JWT, session, OAuth)
- Define user data model

Acceptance Criteria:
- [ ] Auth method documented
- [ ] User schema defined

## Task 2: Create auth API endpoints [MUST VERIFY]

Implementation task - human reviews the result.

Requirements:
- Follow chosen auth method
- Must follow security-standards.md

Acceptance Criteria:
- [ ] POST /auth/login works
- [ ] POST /auth/logout invalidates session
- [ ] Passwords hashed with bcrypt

## Task 3: Deploy to staging [MUST DO]

Human performs deployment.

Requirements:
- Configure environment variables
- Run migrations

Acceptance Criteria:
- [ ] Staging environment updated
- [ ] Auth flow tested end-to-end
```

### Human Roles

| Role | Meaning | Examples |
|------|---------|----------|
| **MUST DO** | Human performs | Design decisions, config, deployment, manual testing |
| **MUST VERIFY** | Human reviews | Code changes, automated tests, documentation |

---

## Summary

**Architecta** is a planning and task management tool that:

1. **Explores** your codebase to understand context
2. **Clarifies** requirements through structured questions
3. **Generates** detailed task lists with human roles
4. **Tracks** task completion as humans work through them

Each task is marked as:
- **MUST DO** - Human performs the task (design, config, deployment)
- **MUST VERIFY** - Human reviews/approves the result (code, tests, docs)

**The goal**: Clear, actionable plans where humans know exactly what they need to do vs. what they need to review.
