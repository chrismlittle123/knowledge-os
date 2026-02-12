# Architecta: Formalised Vision

A comprehensive vision for AI-assisted software development.

**Target users:** Solo developers, small teams, and enterprises. The system scales from individual projects to complex organizational workflows.

---

## Philosophy

### Core Belief

**AI should amplify human capability, not replace human judgment.**

Software development requires both mechanical work (CRUD, boilerplate, tests) and thoughtful work (design, architecture, risk assessment). AI excels at the former; humans remain essential for the latter.

The goal is not to "automate developers away" but to:
1. Free humans from tedious work
2. Let AI handle what it does well
3. Keep humans in control of what matters
4. Make the collaboration seamless

### The Problem We're Solving

Current AI coding tools have two failure modes:

1. **Too autonomous** - AI makes decisions it shouldn't, produces code that doesn't match intent, requires extensive review
2. **Too dependent** - Human babysits every step, loses productivity gains, AI becomes glorified autocomplete

We need a middle ground: **intelligent task division**.

The AI should know:
- What it can do independently
- What requires human input
- What requires human verification
- When to ask for help

### Core Principles

1. **Explicit Human Touchpoints** - Never ambiguous about what humans need to do
2. **Risk-Aware Execution** - Higher risk = more human involvement
3. **Complexity-Aware Planning** - Harder tasks get broken into smaller verifiable chunks
4. **Knowledge Accumulation** - Learn from every interaction to improve over time
5. **Clear Separation of Concerns** - Structure vs intelligence, mechanical vs thoughtful

---

## The Ecosystem

Six components working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           THE ECOSYSTEM                              │
│                                                                      │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│   │ CAPTURA  │ →  │  SAPIEN  │ →  │ARCHITECTA│ →  │ FABRICA  │      │
│   │          │    │          │    │          │    │          │      │
│   │  Ingest  │    │ Structure│    │   Plan   │    │ Execute  │      │
│   │   Data   │    │ Knowledge│    │   Work   │    │   Work   │      │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│                                         ↑                            │
│                                         │                            │
│   ┌──────────┐                   ┌──────────┐                        │
│   │  LUMINA  │ ← ─ ─ ─ ─ ─ ─ ─ ─ │  OPERA   │                        │
│   │          │                   │          │                        │
│   │ Measure  │                   │ Observe  │                        │
│   │ Outcomes │                   │Orchestrate│                        │
│   └──────────┘                   └──────────┘                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Captura - Data Engineer

**Role:** Ingest and transform data from diverse sources.

**Responsibilities:**
- Connect to repositories (GitHub, GitLab, Bitbucket)
- Ingest documentation, specs, designs
- Handle file formats (code, markdown, images, Figma)
- Transform into normalized structure

**Output:** Raw, normalized data ready for structuring.

### Sapien - Knowledge Engineer

**Role:** Structure data into queryable knowledge.

**Responsibilities:**
- Build knowledge graph from ingested data
- Understand relationships (files, functions, dependencies)
- Maintain project context and history
- Surface relevant context for planning

**Output:** Structured knowledge base that Architecta can query.

### Architecta - Product Engineer

**Role:** Intelligent orchestrator for planning and review.

**Responsibilities:**
- Understand human intent through clarifying questions
- Generate actionable plans with explicit human roles
- Determine task classification (complexity, risk, who does what)
- Track progress and manage iterations

**Output:** Plans with MUST DO / MUST VERIFY tasks.

### Fabrica - Software Engineer

**Role:** Execution engine that produces artifacts.

**Responsibilities:**
- Execute AI-only tasks autonomously
- Run Claude Code sessions for implementation
- Produce code, tests, documentation
- Report completion and results

**Output:** Code changes, PRs, artifacts.

### Lumina - Product Manager

**Role:** Measure outcomes and guide priorities.

**Responsibilities:**
- Track success metrics (time to completion, quality scores)
- Identify bottlenecks and improvement opportunities
- Guide prioritization based on data
- Surface insights to humans

**Output:** Analytics, recommendations, priority signals.

### Opera - Systems Engineer

**Role:** Observe, orchestrate, optimize the system.

**Responsibilities:**
- Monitor system health and performance
- Orchestrate component interactions
- Handle failures and recovery
- Optimize resource usage

**Output:** System stability, performance optimization.

---

## Architecta Deep Dive

Architecta is the heart of the system—the intelligent orchestrator that bridges human intent and machine execution.

### The Interface

Main interface is voice or text chat. The AI prompts: "What's next?"

Users interact naturally or via slash commands:

| Command | Purpose |
|---------|---------|
| `/todo` | Context-aware task list ranked by priority |
| `/research` | Ideation, discovery, learning, experiments |
| `/build` | Planning and writing specs |
| `/unblock` | Review blocked tasks, debug AI failures |
| `/ship` | Production transitions, deployment, rollout |

The interface looks like a chat app with rich interactions. When users start a session (research/build/unblock/ship), they navigate to a dedicated page for that mode.

### Modes vs Playbooks

**Modes** are the operational context—what activity you're doing.

**Playbooks** are templates within Build mode—what type of thing you're building.

```
Modes
├── Todo
├── Research
├── Build ─────────────► Playbooks
│                        ├── Greenfield
│                        ├── New Feature
│                        ├── Redesign
│                        ├── Refactor
│                        ├── Pivot
│                        ├── Hotfix
│                        ├── Optimisation
│                        ├── Migration
│                        └── Integration
├── Unblock
└── Ship
```

### Operational Modes

#### Todo Mode

Present a context-aware task list ranked by priority. The AI understands:
- What's blocked
- What's ready to work on
- What the human needs to do
- What can be delegated

#### Research Mode

For ideation and discovery. Mainly for:
- Learning about technologies
- Running experiments and tests
- Exploring possibilities

**Output:** Learnings, ideas, new work items.

#### Build Mode

The most sophisticated mode. The AI's job:

1. **Figure out what you want exactly** - Ask clarifying questions, especially about larger vision/plans
2. **Determine task division** - Which tasks for human, which for AI

##### Playbooks

Predefined flows based on what you're building:

| Playbook | When to Use |
|----------|-------------|
| Greenfield/Setup | New project from scratch |
| New Feature | Adding functionality to existing project |
| Redesign | UI/UX overhaul |
| Refactor | Code restructuring |
| Pivot | Major direction change |
| Hotfix | Urgent production fix |
| Optimisation | Performance improvements |
| Migration | Moving to new stack/framework/database |
| Integration | Adding third-party service or API |

Each requires different spec outputs, so flows differ.

##### Task Classification

Tasks are classified on two dimensions:

**Complexity** (determined by lines of code needed):
- Low
- Medium
- High

**Risk** (impact if something goes wrong):
- Low
- Medium
- High

**Additional factors:**
- Backend vs Frontend (AI excels at backend; human+AI is better at frontend)
- Anything high complexity → consider making it an npm package

##### The Classification Matrix

| Complexity | Risk | Assignment | Examples |
|------------|------|------------|----------|
| Low | Low | AI 100% | Add simple CRUD to unreleased app |
| Medium | Low | AI 100% | Set up prototype with auth; new dev infrastructure; write tests |
| High | Low | Human + AI | Create reusable npm package |
| Low | Medium | AI + Human | Fix simple backend bug in production |
| Medium | Medium | AI + Human | - |
| Medium | High | AI + Human | - |
| High | High | AI + Human (high verification) | Database migration; stack change |
| Any | Critical | Human 100% | Security decisions, legal/compliance, production credentials, sensitive business logic |

**Key principle:** The higher the complexity and risk, the more tasks are broken into smaller human-verifiable chunks.

##### Routing

- **AI 100%** → Sent to Fabrica for autonomous execution
- **AI + Human (Backend)** → Fabrica executes with human checkpoints
- **AI + Human (Frontend)** → Human + Claude Code interactive terminal sessions
- **Human 100%** → Human performs entirely, AI may advise but doesn't execute

#### Unblock Mode

For human verification and debugging.

When AI cannot resolve something or reaches an impasse:
1. Human gets alerted
2. AI provides exactly the information needed to make a decision
3. Human goes into terminal/Claude Code session if needed
4. Issue is resolved and workflow continues

The AI simplifies the unblock workflow by providing:
- What was attempted
- What failed
- What decisions are needed
- Suggested options

#### Ship Mode

For production transitions and deployment.

Covers:
- Environment promotion (dev → staging → production)
- Pre-deployment checklists
- Rollback planning
- Feature flags and gradual rollouts
- Post-deployment verification

Ship mode ensures that working code actually reaches users safely.

### Task Assignment

Every task gets a human role:

| Role | Meaning | Examples |
|------|---------|----------|
| **MUST DO** | Human performs this task | Design decisions, config, deployment, manual testing |
| **MUST VERIFY** | Agent executes, human reviews | Code changes, tests, documentation |

### The Review Process

Every PR ready for human input goes through review. Strictness depends on classification.

**Review dimensions:**
- Against **intent** - Does it do what was asked?
- Against **standards** - Does it meet quality standards?
- Against **correctness** - Is the implementation correct?

**Risk-based intensity:**
- Low risk → AI review may be sufficient if score is high
- High risk → Always requires human review
- Very high risk → Multiple review passes, slower pace

### Quality Gates

PRs must pass AI review before merging. The system includes:

**Scoring:**
- Tasks receive quality scores
- Lower risk: AI acceptance with high score is sufficient
- Higher risk: Human review required regardless of score

**Agents:**
- Debugger agents (work in dev/staging, restricted access)
- Bug finder agents (dev/staging only, not production)
- Code scanning agents (periodic, daily reports, detect quality degradation)

---

## Triggers and AI Modes

The system operates through different triggers and the AI has its own operational modes distinct from the human-facing UI modes.

### Trigger Types

| Trigger | Description | Examples |
|---------|-------------|----------|
| **Human-triggered** | Interactive, user initiates | Build mode, Research mode, approvals |
| **Schedule-triggered** | Automated, time-based | Daily code scans, dependency checks |
| **Event-triggered** | Reactive, something happens | PR opened, deploy completed, build failed |

### Human Modes (UI)

What the human is doing:

| Mode | Purpose |
|------|---------|
| Todo | View and manage tasks |
| Research | Explore and learn |
| Build | Plan and specify |
| Unblock | Resolve blocked items |
| Ship | Deploy to production |

### AI Modes

What the AI is doing (can run in background):

| AI Mode | Trigger | What it does |
|---------|---------|--------------|
| **Planner** | Human (Build mode) | Creates plans, asks clarifying questions |
| **Executor** | Human approval | Runs tasks autonomously in Fabrica |
| **Reviewer** | PR ready / schedule | Reviews code against standards and intent |
| **Scanner** | Schedule (daily) | Scans for code quality degradation |
| **Debugger** | Failure / blocked | Investigates issues, suggests fixes |
| **Monitor** | Always on | Watches system health, alerts on problems |
| **Learner** | Continuous | Improves from interaction patterns |

### Scheduled Processes

Background processes that run automatically:

- **Daily code quality scans** - Detect degradation in production apps
- **Dependency vulnerability checks** - Flag security issues
- **Performance regression detection** - Catch slowdowns early
- **Analytics generation** - Produce insights and reports

### Event-Triggered Processes

Reactive processes that respond to events:

- **PR opened** → AI Reviewer activates
- **Build fails** → AI Debugger investigates
- **Deploy completes** → AI Monitor verifies health
- **Task blocked** → Human gets alerted with context

---

## Human-AI Collaboration Model

### The Principle

AI handles mechanical work. Humans handle thoughtful work.

```
MECHANICAL (AI-first)              THOUGHTFUL (Human-first)
─────────────────────              ──────────────────────────
CRUD endpoints                     Product vision
Database schema                    User experience design
Boilerplate code                   Business rules
Unit tests                         Security decisions
Type definitions                   Architecture choices
Documentation                      Risk assessment
Refactoring                        Trade-off decisions
```

### Handoffs

Every handoff between human and AI is explicit:

1. **Human → AI:** "Here's what I want" (requirement, intent)
2. **AI → Human:** "Here's my plan, here's what I need from you" (questions, decisions)
3. **Human → AI:** "Proceed with this approach" (approval, feedback)
4. **AI → Human:** "Here's what I built, please verify" (PR, result)
5. **Human → AI:** "This needs changes" or "Approved" (iteration or completion)

### When AI Asks for Help

AI should recognize when it's stuck and ask for help:

- Conflicting requirements
- Ambiguous specifications
- Decisions that require business context
- Technical choices with significant trade-offs
- When multiple valid approaches exist

The AI's job is to present options clearly, not to guess.

---

## Frontend-First Development

**Core methodology for anything with a user interface.**

When building anything that requires a frontend, this is THE approach:

1. Build the frontend MVP first (with fake data)
2. AI extracts the contract from the UI layer
3. AI designs the backend with both current needs AND future expansion in mind
4. Backend is generated to match what the frontend already expects

### The Principle

The frontend **is** the product. It knows what data is needed, what shape it should be in, and what user actions exist. Everything else—API contracts, database schemas, backend logic—should be derived from or defined alongside the frontend.

```
Traditional (backend-first):
Backend builds API → Frontend adapts → Mismatch → Rework

Frontend-first:
Frontend defines needs → Contract extracted → Backend generated → Done
```

This isn't optional—it's how Architecta expects frontend work to be done.

### The Layers

```
┌─────────────────────────────────────────────────────┐
│ DESIGN LAYER - Human creativity                     │
│ Figma, wireframes, drawings                         │
├─────────────────────────────────────────────────────┤
│ UI LAYER - AI-generated                             │
│ React/Vue components, fake data                     │
├─────────────────────────────────────────────────────┤
│ CONTRACT LAYER - Auto-extracted                     │
│ Types, endpoints, relationships                     │
├─────────────────────────────────────────────────────┤
│ STRUCTURE LAYER - AI-generated                      │
│ Database schema, CRUD endpoints, validation         │
├─────────────────────────────────────────────────────┤
│ INTELLIGENCE LAYER - Human-defined                  │
│ Permissions, business rules, automations            │
└─────────────────────────────────────────────────────┘
```

### Separation of Structure and Intelligence

**Structure** (mechanical, AI-generated):
- Database schema
- CRUD endpoints
- Type definitions
- Validation logic

**Intelligence** (thoughtful, human-defined):
- Permissions (who can do what)
- Business rules (constraints, conditions)
- Automations (when X happens, do Y)
- Workflows (multi-step processes)

Intelligence is encoded in readable YAML, version controlled, auditable.

---

## Data & Learning

### What We Capture

Every interaction is logged for learning:

- User messages and requirements
- Clarifying questions asked
- Plans generated
- Approval/rejection decisions
- Time spent on each phase
- What blocked, what succeeded

### Use Cases

**Team Insights:**
- What features/areas are being worked on most?
- Common patterns in requirements
- Frequently modified parts of the codebase

**Bottleneck Detection:**
- Where do plans get rejected most often?
- What types of requirements need the most iterations?
- Average time from requirement to approved plan

**Quality Improvement:**
- Which clarifying questions lead to better plans?
- Correlation between exploration depth and plan quality
- Common misunderstandings to address

**Knowledge Base:**
- Searchable history of "how did we implement X?"
- Reference previous similar requirements
- Auto-suggest based on past successful patterns

---

## Future Ideas

### Conflict Resolver

AI detects information differences between knowledge base and codebase. When documentation says one thing but code does another, surface this for resolution.

### Smart Questioning

AI is especially good at asking questions about larger vision/plans. This is particularly helpful in Research mode, where understanding context unlocks better recommendations.

### Progressive Verification

As complexity and risk increase:
- Break work into smaller chunks
- Each chunk is independently verifiable
- Humans can check progress incrementally
- Failures are caught early

### Resource Allocation

Higher complexity/risk tasks get more resources:
- More thorough planning
- More debugging agents
- More review passes
- Slower, more careful execution

### Environment-Specific Agents

| Agent | Dev | Staging | Production |
|-------|-----|---------|------------|
| Debugger | Full access | Restricted | None |
| Bug finder | Full access | Restricted | None |
| Code scanner | Full access | Full access | Read-only |

---

## Success Metrics

### For Humans

- Time from idea to working software
- Clarity of tasks (do they know what to do?)
- Confidence in AI output (do they trust the code?)
- Reduction in tedious work

### For the System

- Plan approval rate on first submission
- Iteration count per workflow
- Time spent in "blocked" state
- Quality score distribution

### For Code Quality

- Test coverage of AI-generated code
- Bug rate in AI-generated code
- Adherence to coding standards
- Review feedback frequency

---

## Summary

Architecta is not just a coding assistant. It's a system for intelligent human-AI collaboration in software development.

**Key differentiators:**

1. **Explicit task division** - Clear who does what
2. **Risk-aware execution** - Adjust autonomy based on stakes
3. **Frontend-first methodology** - Structure derived from UI
4. **Separated concerns** - Mechanical work vs thoughtful work
5. **Continuous learning** - Every interaction improves the system
6. **Multiple operational modes** - Todo, Research, Build, Unblock, Ship

**The goal:** Humans work on what matters. AI handles the rest. Both know their roles. The collaboration is seamless.
