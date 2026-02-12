# Architecta MVP

The minimum viable product to validate the core concept.

---

## Summary

| Dimension | MVP Scope |
|-----------|-----------|
| Component | Architecta only |
| Mode | Build only |
| Interface | Chat UI (web) |
| Target user | Just me (dogfooding) |
| Core value | Ask great clarifying questions |
| Out of scope | Execution (Fabrica) |

---

## What It Does

A web chat interface where I can:

1. **Describe what I want to build** - Natural language input
2. **Answer clarifying questions** - AI asks smart questions before planning
3. **Receive a plan** - Structured task list with MUST DO / MUST VERIFY roles
4. **Iterate on the plan** - Refine until it captures my intent

That's it. No execution. No code generation. Just planning with great questions.

---

## The Core Bet

**If the AI asks the right questions, the plans will be good.**

Most AI coding tools fail because they guess instead of ask. They produce code that doesn't match intent, requiring extensive back-and-forth.

The MVP tests whether a question-first approach produces better outcomes.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  User: "I want to add authentication to my app"            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Architecta is thinking...                            │   │
│  │                                                      │   │
│  │ Exploring codebase:                                  │   │
│  │ • Reading package.json                               │   │
│  │ • Checking existing auth patterns                    │   │
│  │ • Looking at database schema                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Architecta: "Before I create a plan, I have a few         │
│  questions:"                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. What auth method do you prefer?                   │   │
│  │    ○ Email/password                                  │   │
│  │    ○ OAuth (Google, GitHub)                          │   │
│  │    ○ Magic link                                      │   │
│  │    ○ Not sure, recommend something                   │   │
│  │                                                      │   │
│  │ 2. Do you need role-based access control?            │   │
│  │    ○ Yes, multiple roles (admin, user, etc.)         │   │
│  │    ○ No, just authenticated/unauthenticated          │   │
│  │                                                      │   │
│  │ 3. Where should sessions be stored?                  │   │
│  │    ○ JWT (stateless)                                 │   │
│  │    ○ Database sessions                               │   │
│  │    ○ Not sure, recommend based on my stack           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  User answers questions...                                  │
│                                                             │
│  Architecta: "Here's my plan:"                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ # Add Authentication                                 │   │
│  │                                                      │   │
│  │ ## Task 1: Choose auth provider [MUST DO]            │   │
│  │ Based on your preference for OAuth...                │   │
│  │                                                      │   │
│  │ ## Task 2: Set up NextAuth [MUST VERIFY]             │   │
│  │ Install and configure NextAuth with Google...        │   │
│  │                                                      │   │
│  │ ## Task 3: Add protected routes [MUST VERIFY]        │   │
│  │ Wrap dashboard pages with auth check...              │   │
│  │                                                      │   │
│  │ [Approve] [Refine]                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## What Makes Questions "Great"

The AI should ask questions that are:

1. **Contextual** - Based on what it found exploring the codebase
2. **Decisive** - Lead to clear choices, not open-ended
3. **Minimal** - Only ask what's needed, don't over-question
4. **Smart defaults** - Offer recommendations based on the stack
5. **Progressive** - Ask follow-ups based on previous answers

### Bad Questions

- "What do you want?" (too vague)
- "Have you considered security?" (not actionable)
- "What's your timeline?" (irrelevant to planning)

### Good Questions

- "I see you're using Postgres. Should auth use the same database or a separate service?" (contextual)
- "Your app has admin routes. Should admins have different permissions than regular users?" (specific)
- "I notice you have Stripe integration. Should auth link to Stripe customer IDs?" (discovered dependency)

---

## What Already Exists

The codebase already has significant infrastructure:

| Component | Status | Location |
|-----------|--------|----------|
| Orchestrator | ✅ Complete | `packages/core/src/orchestrator/` |
| Planning session | ✅ Complete | `packages/core/src/sessions/planner-tools.ts` |
| Clarifying questions (tool-based) | ✅ Complete | Uses `ask_clarifying_questions` tool |
| Plan generation | ✅ Complete | Uses `output_plan` tool |
| Plan refinement | ✅ Complete | Multi-turn conversation |
| MUST DO / MUST VERIFY roles | ✅ Complete | `humanRole` field on tasks |
| API server | ✅ Complete | `apps/api/` with Fastify |
| SSE streaming | ✅ Complete | Real-time events |
| Web frontend | ⚠️ Needs redesign | `apps/web/` - single page, not mode-based |

**The backend is ready. The frontend needs a new Build page.**

---

## Page Structure

Modes = Pages. Each mode has its own dedicated page with UI optimized for that workflow.

```
/                   Home - "What's next?" prompt
/build              Build mode - question-focused planning (MVP)
/research           Research mode (future)
/unblock            Unblock mode (future)
/ship               Ship mode (future)
```

**MVP builds `/build` only.** The home page can be a simple redirect for now.

---

## Technical Approach

### What We're Building

A new `/build` page from scratch, designed specifically for the question-answer-refine flow.

### Stack (already exists)

- **Frontend:** Next.js 14 with `@architecta/ui` components
- **Backend:** Fastify API with SSE streaming (ready)
- **AI:** Claude API with tool-based questions (ready)
- **Persistence:** In-memory (as intended for MVP)

### The Build Page UI

Three distinct phases, each with focused UI:

**Phase 1: Intent**
- Clean input for "what do you want to build?"
- Single action: Start Planning

**Phase 2: Questions**
- Show exploration progress
- Present questions one group at a time
- Clear, large radio buttons
- Recommendations highlighted
- Single action: Submit Answers

**Phase 3: Plan**
- Task cards with human role badges
- Expandable details (requirements, acceptance criteria)
- Inline refinement input
- Actions: Refine / Approve

### API Endpoints (already exist)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/workflow` | Create new workflow | ✅ |
| GET | `/workflow/:id` | Get workflow state | ✅ |
| POST | `/workflow/:id/plan` | Submit requirement | ✅ |
| POST | `/workflow/:id/plan/answer` | Submit question answers | ✅ |
| POST | `/workflow/:id/plan/refine` | Refine the plan | ✅ |
| POST | `/workflow/:id/plan/approve` | Approve plan | ✅ |
| GET | `/workflow/:id/stream` | SSE for real-time updates | ✅ |

---

## What's NOT in MVP

| Feature | Why Not |
|---------|---------|
| Execution (Fabrica) | Validate planning first |
| Multiple modes | Build mode is the core |
| Persistence | In-memory is fine for dogfooding |
| Authentication | Just me using it |
| AI background modes | Not needed without execution |
| Playbook selection | Let AI infer from context |
| Task classification matrix | Plans are human-executed for now |
| Todo/task tracking | Focus on plan generation |

---

## Success Criteria

### The MVP works if:

1. **Questions are relevant** - I don't have to answer questions about things the AI could have figured out from the codebase
2. **Plans match intent** - After answering questions, the plan captures what I actually wanted
3. **Iterations are rare** - Good questions = good plans on first try
4. **I use it** - I actually reach for this tool when starting new work

### Metrics to Track

- Questions asked per workflow
- Plan approval rate (approve vs refine)
- Refinement iterations before approval
- Time from intent to approved plan

---

## Next Steps After MVP

If the MVP validates the question-first approach:

1. **Add persistence** - Save workflows to database
2. **Add Todo mode** - Track task completion
3. **Add Fabrica** - Execute MUST VERIFY tasks
4. **Add more playbooks** - Explicit workflow selection
5. **Open to others** - Add auth, multi-user

---

## Implementation Tasks

What needs to be built to reach MVP:

### 1. Create `/build` route

Create `apps/web/src/app/build/page.tsx` with:
- Three-phase UI (intent → questions → plan)
- Clean, focused design for each phase
- SSE subscription for real-time updates

### 2. Intent Phase Component

- Large text input for requirement
- "Start Planning" button
- Minimal distractions

### 3. Questions Phase Component

- Show "exploring codebase" progress
- Render structured questions with radio buttons
- Highlight recommended options
- "Submit Answers" button

### 4. Plan Phase Component

- Task list with expandable cards
- Human role badges (MUST DO / MUST VERIFY)
- Inline refinement input
- "Refine" and "Approve" buttons

### 5. Update home page

- Simple redirect to `/build` for now
- Or: "What's next?" prompt that leads to Build

---

## Open Questions

1. How should the AI decide when it has enough information to generate a plan?
2. Should questions be asked all at once or progressively?
3. How to handle "I don't know, you decide" answers?
4. What's the right balance between exploration depth and speed?
