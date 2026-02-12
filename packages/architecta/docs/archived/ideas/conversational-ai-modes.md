# Conversational AI Modes

A chat-based interface for AI-assisted development with distinct operational modes.

---

## Core Interface

Main interface is voice or text chat. The AI prompts the user with "what's next".

Users interact via slash commands or natural speech:

- `/todo` - Context-aware task list ranked by priority
- `/research` - Ideation and discovery, learning, experiments. Outputs learnings, ideas, new work items
- `/build` - Planning and writing specs
- `/unblock` - Review pending human tasks or areas where AI failed and needs intervention

The main chat window looks like ChatGPT apps with nice interactions. When a user wants to start a research/build/unblock session, they get a button to navigate to a new page.

Users can speak naturally - e.g., "add this idea somewhere" and the AI knows where to store it.

---

## Build Mode

The most sophisticated of the three modes.

### AI's Job

1. Figure out what you want exactly
2. Figure out exactly which tasks to give to human vs AI

### Predefined Flows

We have predefined flows (playbooks) for everything we can build:

- **Greenfield/Setup** - New project from scratch
- **New Feature** - Adding functionality to existing project
- **Redesign** - UI/UX overhaul
- **Refactor** - Code restructuring
- **Pivot** - Major direction change
- **Hotfix** - Urgent production fix
- **Optimisation** - Performance improvements

Each requires different spec outputs, so the flow differs for each.

### Task Classification

The AI determines task splits based on:

1. **Complexity** (determined by lines of code needed)
2. **Risk level**
3. **Backend vs Frontend** (AI excels at backend; human+AI is better at frontend)

#### Complexity/Risk Matrix

| Complexity | Risk | Assignment | Example |
|------------|------|------------|---------|
| Low | Low | AI 100% | Add simple CRUD to unreleased app |
| Medium | Low | AI 100% | Set up full prototype with auth, frontend; new infrastructure in dev; write tests |
| High | Low | Human + AI pairing | Create new npm package (reusable open source potential) |
| Low | Medium | AI + Human | Fix simple backend bug affecting production |
| Medium | Medium | AI + Human | - |
| Medium | High | AI + Human | - |
| High | High | AI + Human with high verification | Database migration requiring huge codebase refactor; stack migration |

### Packaging Principle

Anything that is a difficult or high-complexity task should be put into its own npm package.

### Routing

- **AI 100% tasks** - Sent to Fabrica (automated execution)
- **Human + AI tasks** - Collaborative workflow (TBD)

---

## Unblock Mode

For human verification and debugging issues.

When the AI cannot resolve something or reaches an impasse, human intervention is required. The user goes into a terminal/Claude Code session to figure out what's happening.

The AI simplifies the unblock workflow by providing exactly the right information for a human to make a decision.

---

## Review Process

Every PR ready for human input goes through a review process. The strictness depends on the work classification.

### Review Dimensions

- Against **intent** - Does it do what was asked?
- Against **standards** - Does it meet quality standards?
- Against **correctness** - Is the implementation correct?

### Risk-Based Review Intensity

The higher the risk, the more intense the review process.

For highly complex and high-risk work:
- Break down into much smaller human-verifiable chunks
- More granular verification steps
- Higher scrutiny per chunk

---

## AI Agents

### Debugger Agents

- Work in dev and staging environments
- Have restricted access depending on environment

### Bug Finder Agents

- Work in dev and staging only (not production)
- Proactively search for issues

### Code Scanning Agents

- Run periodically (daily)
- Generate detailed reports
- Detect code quality degradation in production apps

---

## Quality Gates

### PR Merge Requirements

PRs must pass AI review process before merging.

### Scoring System

- Higher complexity/risk = more resources (debugger agents, bug finders)
- Tasks receive a quality score
- For lower-risk work, AI acceptance with high score is sufficient
- For higher-risk work, human review is required regardless of score

---

## Additional Ideas

### Conflict Resolver

AI needs a conflict resolver that detects information differences between knowledge base and codebase.

### Smart Questioning

The AI is good at asking the right questions, specifically around larger vision/plans. This is especially helpful in Research mode.

### Data Collection

Over time, collect:
- What humans spend their time on (browser tracking)
- What agents do (agent time tracking)
- Which issues were blocked
- Conversation history

This data informs workflow improvements.

### Research Mode Purpose

Mainly for:
- Learning
- Running experiments and tests
- Outputs: learnings, ideas, new work items
