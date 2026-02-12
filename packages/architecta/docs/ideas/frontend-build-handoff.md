# Frontend Build Handoff

Seamless transition from Architecta planning to Claude Code execution.

---

## The Idea

For frontend work, Build mode produces a comprehensive plan that includes:

- Screenshots / wireframes / design references
- Component descriptions
- UI library to use
- Page structure
- Data requirements

Once the plan is approved, Architecta:

1. Builds a prompt optimized for frontend development
2. Opens a terminal window (user's preferred terminal)
3. Pipes the prompt directly into Claude Code
4. User continues in their local Claude Code session

---

## Why This Works

Architecta is great at **planning** — asking the right questions, understanding context, producing structured specs.

Claude Code is great at **execution** — writing code, iterating quickly, using tools.

Instead of building execution into Architecta (duplicating Claude Code), we hand off cleanly:

```
Architecta (planning)          Claude Code (execution)
─────────────────────          ─────────────────────────
Ask questions                  Write code
Gather context                 Run commands
Produce spec                   Iterate with user
Build prompt          ───►     Execute from prompt
```

---

## The Frontend Plan

A frontend-specific plan would include:

### Visual References

- Screenshots of designs (Figma exports, sketches)
- Reference images for similar UIs
- Component library examples

### Component Breakdown

```
Page: Dashboard
├── Header (sticky)
│   ├── Logo
│   ├── Navigation
│   └── UserMenu
├── Sidebar (collapsible)
│   └── NavLinks
└── MainContent
    ├── StatsCards (grid)
    ├── RecentActivity (list)
    └── QuickActions (buttons)
```

### UI Library

- Which library to use (shadcn, Radix, custom)
- Theme/styling approach
- Existing components to reuse

### Data Shape

```typescript
interface DashboardData {
  stats: { label: string; value: number; trend: number }[];
  recentActivity: Activity[];
  user: User;
}
```

---

## The Handoff

### Step 1: Build the Prompt

Architecta compiles the plan into a Claude Code-optimized prompt:

```markdown
# Frontend Task: Build Dashboard Page

## Context
- Next.js 14 app with App Router
- Using @architecta/ui component library
- Dark mode theme

## Design Reference
[Embedded image or link to screenshot]

## Component Structure
[Component tree from plan]

## Requirements
1. Implement the Dashboard page at /dashboard
2. Use existing Card, Button components from @architecta/ui
3. Create new StatsCard component
4. Fetch data from /api/dashboard endpoint
5. Mobile responsive (stack on small screens)

## Acceptance Criteria
- [ ] Page renders at /dashboard
- [ ] Stats cards show live data
- [ ] Sidebar collapses on mobile
- [ ] Matches design reference
```

### Step 2: Open Terminal

Architecta opens user's preferred terminal:

- iTerm2 / Terminal.app (macOS)
- Windows Terminal (Windows)
- User-configured preference

### Step 3: Pipe to Claude Code

```bash
cd /path/to/project
echo "<prompt>" | claude
```

Or open Claude Code with the prompt pre-loaded:

```bash
claude --prompt-file /tmp/architecta-prompt.md
```

### Step 4: User Takes Over

User is now in their local Claude Code session with:

- Full prompt context
- Their customized Claude Code settings
- Local tool access
- Familiar environment

---

## User's Local Claude Code Setup

The user's Claude Code can be optimized for frontend:

- Custom system prompts for React/Next.js
- Preferred component patterns
- Linting/formatting rules
- Test generation preferences

Architecta doesn't need to know these details — it just hands off the plan.

---

## Implementation

### Terminal Integration

```typescript
import { spawn } from 'child_process';

function openInTerminal(workDir: string, prompt: string) {
  // Write prompt to temp file
  const promptPath = `/tmp/architecta-${Date.now()}.md`;
  writeFileSync(promptPath, prompt);

  // Detect terminal
  const terminal = detectTerminal(); // iTerm2, Terminal.app, etc.

  // Open terminal with Claude Code
  if (terminal === 'iterm2') {
    spawn('osascript', [
      '-e', `tell application "iTerm2"
        create window with default profile
        tell current session of current window
          write text "cd ${workDir} && claude --prompt-file ${promptPath}"
        end tell
      end tell`
    ]);
  }
}
```

### API Endpoint

```typescript
// POST /workflow/:id/handoff
app.post('/workflow/:id/handoff', async (req, res) => {
  const { id } = req.params;
  const workflow = await getWorkflow(id);

  // Build prompt from plan
  const prompt = buildFrontendPrompt(workflow.plan);

  // Return prompt for client to handle terminal
  res.json({
    prompt,
    workDir: workflow.workDir,
    suggestedCommand: `claude --prompt-file /tmp/architecta-${id}.md`
  });
});
```

### Frontend Button

In the Build page, after plan approval:

```tsx
<Button onClick={handleHandoff}>
  Open in Claude Code
</Button>
```

---

## Benefits

1. **Best of both worlds** — Architecta for planning, Claude Code for execution
2. **No duplication** — Don't rebuild execution in Architecta
3. **User's environment** — They get their customized Claude Code setup
4. **Clean separation** — Planning is done, execution begins fresh
5. **Local tools** — Claude Code has full access to local dev environment

---

## Future Enhancements

- **Bi-directional sync** — Claude Code reports progress back to Architecta
- **Session resumption** — Pick up where you left off
- **Multi-terminal** — Open multiple terminals for parallel tasks
- **Template library** — Pre-built prompts for common frontend patterns
