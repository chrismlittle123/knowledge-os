# Architecta

The Intelligent Orchestrator - from intent to shipped code with minimal human effort.

Part of [KnowledgeOS](https://github.com/chrismlittle123/knowledge-os).

## What is Architecta?

Architecta is an AI agent that orchestrates the entire software development loop. It uses Claude to explore your codebase, generate stress-tested plans, execute them via [Fabrica](https://github.com/chrismlittle123/fabrica), review the output, and iterate until done.

**Design principle:** Minimize human effort/time. Maximize velocity/quality.

```
Human: "Add user authentication"
              ↓
┌─────────────────────────────────────┐
│           ARCHITECTA                │
│                                     │
│  1. Explore codebase                │
│  2. Generate plan                   │
│  3. Stress-test plan                │
│  4. Human quick approval (30 sec)   │
│  5. Send to Fabrica                 │
│  6. Review output against spec      │
│  7. Score confidence                │
│  8. Auto-approve / iterate / ship   │
│                                     │
└─────────────────────────────────────┘
              ↓
         Shipped code
```

## Human Touchpoints

Architecta minimizes human involvement to three moments:

| Touchpoint | Human Action | Time |
|------------|--------------|------|
| **Intent** | "I want X" | 30 sec |
| **Plan approval** | Quick yes/no on stress-tested plan | 30 sec |
| **Ship approval** | Only when AI confidence is low | varies |

High-confidence work auto-ships. Humans handle escalations.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run against a target repo
TARGET_REPO=/path/to/your/project docker-compose up
```

### Option 2: Local

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run
ANTHROPIC_API_KEY=sk-ant-... pnpm start /path/to/your/project
```

### Option 3: Development

```bash
pnpm install
ANTHROPIC_API_KEY=sk-ant-... pnpm run dev /path/to/your/project
```

## Current Implementation

The current version implements the **plan generation** phase:

1. Ask what you want to build
2. Explore your codebase to understand context
3. Ask clarifying questions
4. Generate a detailed plan

Commands:
- Type your requirements naturally
- `save` - Save the generated plan to a file
- `exit` - Quit

### Roadmap

**Core Planning (Complete)**
- [x] Plan generation with codebase exploration
- [x] Clarifying questions (tool-based structured UI)
- [x] Research/Ask feature (questions without modifying plan)
- [x] Human role tracking (MUST DO / MUST VERIFY per task)
- [x] Task progress tracking (mark tasks complete)
- [x] GCP Secret Manager integration

**Infrastructure (In Progress)**
- [ ] Persistence (database for workflow history)
- [ ] Authentication (user login)
- [ ] GitHub integration (branches, commits, PRs)

**UI/UX (In Progress)**
- [ ] Project/session management (switch between workflows)
- [ ] Progress visualization (workflow stages)
- [x] Dark mode business theme

**Out of Scope**
- ~~Fabrica integration~~ (execution handled separately)
- ~~Automated iteration~~ (human-driven workflow)
- ~~Confidence scoring~~ (human judgment instead)

## Example Session

```
╔════════════════════════════════════════╗
║           ARCHITECTA                   ║
║      Product Engineer Agent            ║
╚════════════════════════════════════════╝

Working directory: /home/user/my-project

You: Add a logout button to the navbar

Architecta: I'll explore the codebase to understand the navbar structure...

[explores files]

I found the Navbar component at src/components/Navbar.tsx.
It uses your Button component from the design system.

A few questions:
1. Should the logout button only appear when logged in?
2. Where should it redirect after logout?

You: Yes only when logged in, redirect to /login

Architecta: Here's the plan:

---
repo: my-project
flow: [builder, tester, reviewer]
---

# Add logout button to navbar

## Task 1: Add LogoutButton component

Requirements:
- Use existing Button component
- Call POST /api/auth/logout
- Redirect to /login on success

Acceptance Criteria:
- [ ] Button appears only when user is logged in
- [ ] Clicking logs user out
- [ ] User redirected to /login

You: save

Plan saved to: plan-2024-01-27T10-30-00.md
```

## Plan Format

Architecta produces markdown plans with YAML frontmatter:

```markdown
---
repo: my-frontend
flow: [builder, tester, reviewer]
---

# Title

## Task 1: First task

Description...

Requirements:
- Requirement 1
- Requirement 2

Acceptance Criteria:
- [ ] Criterion 1
- [ ] Criterion 2
```

## Flow Options

| Specialist | Use When |
|------------|----------|
| `builder` | Writing new code |
| `tester` | Writing tests |
| `reviewer` | Code review |
| `debugger` | Fixing bugs |
| `deployer` | CI/CD changes |

## Project Structure

```
architecta/
├── src/
│   └── index.ts          # Main agent implementation
├── docs/
│   └── architecture.md   # Full architecture documentation
├── eslint.config.js      # ESLint configuration
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Scripts

```bash
pnpm build      # Compile TypeScript
pnpm start      # Run compiled version
pnpm dev        # Run with tsx (development)
pnpm lint       # Run ESLint
pnpm lint:fix   # Fix ESLint issues
pnpm typecheck  # Type check without emitting
```

## Documentation

- [Architecture](docs/architecture.md) - Full system design: Architecta + Fabrica

## License

MIT
