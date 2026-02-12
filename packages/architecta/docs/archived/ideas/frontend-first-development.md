# Frontend-First Development

A methodology for building applications where the frontend drives everything, the contract is auto-generated, and the intelligence layer is encoded separately from structure.

---

## Core Principle

The frontend **is** the product. It knows what data is needed, what shape it should be in, and what user actions exist. Everything else—API contracts, database schemas, backend logic—should be derived from or defined alongside the frontend, not the other way around.

```
Traditional (backend-first):
Backend builds API → Frontend adapts → Mismatch → Rework

Frontend-first:
Frontend defines needs → Contract extracted → Backend generated → Done
```

---

## The Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DESIGN LAYER                                                  │
│   ────────────                                                  │
│   Human creativity                                              │
│   Figma, wireframes, drawings                                   │
│   "What should it look like? What's the user journey?"          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   UI LAYER                                                      │
│   ────────                                                      │
│   AI-generated                                                  │
│   React/Vue/Svelte components                                   │
│   Uses component library                                        │
│   Fake data throughout                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CONTRACT LAYER                                                │
│   ──────────────                                                │
│   Auto-extracted                                                │
│   Types, endpoints, relationships                               │
│   OpenAPI spec                                                  │
│   This is STRUCTURE, not logic                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   STRUCTURE LAYER                                               │
│   ───────────────                                               │
│   AI-generated                                                  │
│   Database schema                                               │
│   CRUD endpoints                                                │
│   Validation                                                    │
│   Mechanical, boilerplate                                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   INTELLIGENCE LAYER                                            │
│   ──────────────────                                            │
│   Human-defined                                                 │
│   Permissions, business rules                                   │
│   Automations, workflows                                        │
│   Integrations                                                  │
│   This is where the THINKING happens                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Workflow

### Step 1: Design

Create the visual design in Figma, sketches, or wireframes.

Define:
- All screens and states
- User flows
- What data appears where
- What actions users can take

This is human creative work. It cannot be automated.

---

### Step 2: Generate UI with Fake Data

Feed designs to an AI coding agent. It generates:
- React/Vue/Svelte components
- Using your component library (shadcn, etc.)
- With fake data inline or via mocks

The output is a **fully working frontend** with all flows, all states, all interactions—just no real backend.

#### Fake Data with MSW + Faker

MSW (Mock Service Worker) intercepts real fetch calls at the network level. Your frontend code doesn't know the data is fake.

```typescript
// mocks/data.ts
import { faker } from '@faker-js/faker'

export const createUser = () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  role: faker.helpers.arrayElement(['admin', 'member']),
  createdAt: faker.date.past().toISOString(),
})

export const createProject = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  description: faker.lorem.sentence(),
  ownerId: faker.string.uuid(),
  memberCount: faker.number.int({ min: 1, max: 20 }),
  createdAt: faker.date.past().toISOString(),
  ...overrides,
})
```

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'
import { createUser, createProject } from './data'

// Generate pool of fake data
const users = Array.from({ length: 20 }, createUser)
const projects = Array.from({ length: 10 }, createProject)

export const handlers = [
  // Users
  http.get('/api/users', () => {
    return HttpResponse.json(users)
  }),

  http.get('/api/users/:id', ({ params }) => {
    const user = users.find(u => u.id === params.id)
    if (!user) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json(user)
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json()
    const newUser = { ...createUser(), ...body }
    users.push(newUser)
    return HttpResponse.json(newUser, { status: 201 })
  }),

  http.delete('/api/users/:id', ({ params }) => {
    const index = users.findIndex(u => u.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
    users.splice(index, 1)
    return HttpResponse.json({ success: true })
  }),

  // Projects
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url)
    const ownerId = url.searchParams.get('ownerId')
    const filtered = ownerId
      ? projects.filter(p => p.ownerId === ownerId)
      : projects
    return HttpResponse.json(filtered)
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json()
    const newProject = { ...createProject(), ...body }
    projects.push(newProject)
    return HttpResponse.json(newProject, { status: 201 })
  }),
]
```

```typescript
// mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

```typescript
// main.tsx
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    return worker.start()
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
  )
})
```

Your frontend now works completely. Real fetch calls, real error handling, real loading states—all with fake data.

---

### Step 3: Extract the Contract

The MSW handlers and TypeScript types **are** your contract. Extract them into a formal spec.

#### Auto-Extraction

Parse the frontend code to find:
- All fake data shapes → Types
- All MSW handlers → Endpoints
- Relationships between entities

Output:

```typescript
// contracts/types.ts

export interface User {
  id: string
  name: string
  email: string
  avatar: string
  role: 'admin' | 'member'
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  memberCount: number
  createdAt: string
}

export interface CreateUserInput {
  name: string
  email: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  memberIds?: string[]
}
```

```yaml
# contracts/openapi.yaml

openapi: 3.0.0
info:
  title: My App API
  version: 1.0.0

paths:
  /api/users:
    get:
      summary: List all users
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /api/users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: Not found
    delete:
      summary: Delete user
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Deleted

  /api/projects:
    get:
      summary: List projects
      parameters:
        - name: ownerId
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Project'
    post:
      summary: Create project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProjectInput'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

components:
  schemas:
    User:
      type: object
      required: [id, name, email, role, createdAt]
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
          format: email
        avatar:
          type: string
        role:
          type: string
          enum: [admin, member]
        createdAt:
          type: string
          format: date-time

    Project:
      type: object
      required: [id, name, ownerId, createdAt]
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        ownerId:
          type: string
        memberCount:
          type: integer
        createdAt:
          type: string
          format: date-time

    CreateUserInput:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
        email:
          type: string
          format: email

    CreateProjectInput:
      type: object
      required: [name]
      properties:
        name:
          type: string
        description:
          type: string
        memberIds:
          type: array
          items:
            type: string
```

This is pure **structure**. No business logic. Just "what shape is the data."

---

### Step 4: Encode the Intelligence

This is the critical step. Separate from the structure, define the **rules** that govern your application.

#### Permissions

Who can do what?

```yaml
# rules/permissions.yaml

entities:
  user:
    view:
      - self
      - org_admins
    edit:
      - self
      - org_admins
    delete:
      - org_admins

  project:
    view:
      - owner
      - members
      - org_admins
    edit:
      - owner
      - org_admins
    delete:
      - owner
    invite_member:
      - owner
      - org_admins
    remove_member:
      - owner
      - org_admins

  invoice:
    view:
      - org_owner
      - billing_admins
    pay:
      - org_owner
      - billing_admins
    download:
      - org_owner
      - billing_admins

roles:
  org_admin:
    inherits: [member]
    permissions:
      - users.view
      - users.edit
      - users.delete
      - projects.*

  member:
    permissions:
      - users.view_self
      - projects.view_own
      - projects.edit_own
```

#### Automations

What happens when?

```yaml
# rules/automations.yaml

triggers:
  user.created:
    actions:
      - send_email:
          template: welcome
          to: "{{ user.email }}"
      - create_default_project:
          name: "{{ user.name }}'s First Project"
          ownerId: "{{ user.id }}"
      - notify_slack:
          channel: "#signups"
          message: "New user: {{ user.name }} ({{ user.email }})"

  invoice.overdue:
    condition: "invoice.dueDate < now() AND invoice.status == 'pending'"
    actions:
      - send_email:
          template: invoice_overdue
          to: "{{ invoice.user.email }}"
      - notify_slack:
          channel: "#billing"
          message: "Invoice {{ invoice.id }} is overdue (${{ invoice.amount }})"
      - schedule:
          action: send_reminder
          delay: "3 days"

  subscription.cancelled:
    actions:
      - downgrade_access:
          orgId: "{{ subscription.orgId }}"
          to: "free"
      - send_email:
          template: subscription_cancelled
          to: "{{ subscription.org.owner.email }}"
      - schedule:
          action: delete_data
          delay: "30 days"
          data:
            orgId: "{{ subscription.orgId }}"

  usage.threshold_reached:
    condition: "org.usage >= org.plan.limit * threshold"
    actions:
      - when:
          threshold: 0.8
          action:
            - send_email:
                template: usage_warning_80
                to: "{{ org.owner.email }}"
      - when:
          threshold: 1.0
          action:
            - rate_limit:
                orgId: "{{ org.id }}"
            - send_email:
                template: usage_limit_reached
                to: "{{ org.owner.email }}"

  project.member_added:
    actions:
      - send_email:
          template: project_invite
          to: "{{ member.email }}"
          data:
            projectName: "{{ project.name }}"
            invitedBy: "{{ actor.name }}"
```

#### Validations

What constraints exist?

```yaml
# rules/validations.yaml

user:
  name:
    required: true
    type: string
    min_length: 2
    max_length: 100
  email:
    required: true
    type: string
    format: email
    unique: true
  role:
    required: true
    type: string
    enum: [admin, member]

project:
  name:
    required: true
    type: string
    min_length: 1
    max_length: 200
  description:
    type: string
    max_length: 2000
  members:
    type: array
    max_items: "{{ org.plan.maxProjectMembers }}"

invoice:
  amount:
    required: true
    type: number
    min: 0
  dueDate:
    required: true
    type: date
    min: "{{ now() }}"
```

#### Workflows

Multi-step processes?

```yaml
# rules/workflows.yaml

onboarding:
  steps:
    - verify_email:
        timeout: "24 hours"
        on_timeout: cancel_signup
    - complete_profile:
        required_fields: [name, company]
    - choose_plan:
        options: [free, pro, enterprise]
    - invite_team:
        optional: true
        skip_action: create_default_workspace
  on_complete:
    - send_email:
        template: onboarding_complete
    - notify_slack:
        channel: "#conversions"

subscription_upgrade:
  steps:
    - select_plan:
        from: "{{ current_plan }}"
        to: [pro, enterprise]
    - enter_payment:
        provider: stripe
    - confirm:
        show_summary: true
  on_complete:
    - upgrade_access:
        immediate: true
    - send_email:
        template: upgrade_confirmation
    - prorate_billing:
        from: "{{ upgrade_date }}"
```

#### Computed Fields

Derived data?

```yaml
# rules/computed.yaml

user:
  displayName: "{{ name || email.split('@')[0] }}"
  isAdmin: "{{ role == 'admin' }}"

project:
  memberCount: "{{ members.length }}"
  isOverdue: "{{ deadline && deadline < now() }}"

org:
  usagePercent: "{{ (usage / plan.limit) * 100 }}"
  isNearLimit: "{{ usagePercent >= 80 }}"
  isAtLimit: "{{ usagePercent >= 100 }}"
```

---

### Step 5: Generate the Backend

Feed the contract + rules to AI or a code generator.

#### Input

```
contracts/
├── types.ts
└── openapi.yaml

rules/
├── permissions.yaml
├── automations.yaml
├── validations.yaml
├── workflows.yaml
└── computed.yaml
```

#### Prompt

```
Generate a Node.js backend with:
- Express routes matching the OpenAPI spec
- Drizzle ORM with Postgres
- Middleware that enforces permissions.yaml
- Event triggers that implement automations.yaml
- Zod schemas matching validations.yaml
- Include authentication with JWT
- Include error handling
- Include tests
```

#### Output

```
backend/
├── src/
│   ├── routes/
│   │   ├── users.ts
│   │   └── projects.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── permissions.ts
│   ├── events/
│   │   ├── handlers.ts
│   │   └── triggers.ts
│   ├── validators/
│   │   └── schemas.ts
│   └── index.ts
├── tests/
│   ├── users.test.ts
│   └── projects.test.ts
├── docker-compose.yml
└── package.json
```

Alternatively, use a **rules engine** that interprets the YAML at runtime instead of generating code.

---

### Step 6: Connect

Disable MSW. Frontend now hits real API.

```typescript
// main.tsx
async function enableMocking() {
  // Only mock in development when explicitly enabled
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API === 'true') {
    const { worker } = await import('./mocks/browser')
    return worker.start()
  }
}
```

```bash
# .env.development (mocked)
VITE_MOCK_API=true

# .env.development (real API)
VITE_MOCK_API=false
VITE_API_URL=http://localhost:8000
```

The frontend code doesn't change. It was always calling `/api/users`. Now those calls hit the real backend instead of MSW.

---

## Folder Structure

```
my-app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── api.ts           # fetch wrapper
│   │   └── mocks/
│   │       ├── browser.ts       # MSW setup
│   │       ├── handlers.ts      # mock endpoints
│   │       └── data.ts          # faker generators
│   ├── package.json
│   └── vite.config.ts
│
├── contracts/                    # Auto-extracted
│   ├── types.ts
│   └── openapi.yaml
│
├── rules/                        # Human-defined
│   ├── permissions.yaml
│   ├── automations.yaml
│   ├── validations.yaml
│   ├── workflows.yaml
│   └── computed.yaml
│
├── backend/                      # Generated
│   ├── src/
│   ├── tests/
│   └── docker-compose.yml
│
└── README.md
```

---

## Development Workflow

### Frontend Developer (local)

```bash
cd frontend
npm run dev
# MSW intercepts all API calls
# Full app working with fake data
```

### Backend Developer (devcontainer)

```bash
# VS Code: "Reopen in Container"
cd backend
npm run dev
# API server + database running
# Port forwarded to localhost:8000
```

### Integration

```bash
cd frontend
VITE_MOCK_API=false npm run dev
# Frontend now hits real backend at localhost:8000
```

---

## Why This Works

### AI does what it's good at

| Task | AI Capability |
|------|---------------|
| Design → Components | Excellent |
| Generate CRUD endpoints | Excellent |
| Create database schema | Excellent |
| Write validation logic | Excellent |
| Understand business rules | Needs guidance |

### Humans focus on what matters

| Task | Human Required |
|------|----------------|
| Product vision | Yes |
| User experience | Yes |
| Business rules | Yes |
| Writing boilerplate | No |
| CRUD endpoints | No |

### Clear separation

```
GENERATED (mechanical)          DEFINED (thinking)
─────────────────────          ──────────────────
UI components                  Design
API endpoints                  Permissions
Database schema                Business rules
Validation code                Automations
                              Workflows
```

---

## Tools Summary

| Layer | Tool | Purpose |
|-------|------|---------|
| Design | Figma | Visual design |
| UI Generation | Claude/GPT + Component library | Design → Code |
| Fake Data | Faker.js | Realistic mock data |
| API Mocking | MSW | Intercept fetch calls |
| Contract | OpenAPI / TypeScript | Structure definition |
| Rules | YAML files | Intelligence definition |
| Backend Generation | Claude/GPT | Contract + Rules → Code |
| Database | Drizzle / Prisma | ORM |
| Validation | Zod | Runtime validation |

---

## Benefits

1. **Frontend is the spec** — No disconnect between UI needs and API design

2. **Contract is auto-generated** — No manual sync, no drift

3. **Structure is mechanical** — AI handles all boilerplate

4. **Intelligence is isolated** — Business rules in readable YAML, not buried in code

5. **Parallel development** — Frontend and backend can work simultaneously

6. **Easy changes** — Change the rules YAML, regenerate backend

7. **Testable** — Frontend works without backend, rules can be unit tested

8. **Auditable** — Business rules in version control, diffable, reviewable

---

## Limitations

### Complex business logic

Some logic is too complex for YAML:
- Multi-step calculations
- External API orchestration
- Complex conditional flows

Solution: Write these as code functions, reference them from YAML.

```yaml
# rules/automations.yaml
triggers:
  invoice.created:
    actions:
      - custom_function:
          name: calculateTax
          args:
            invoice: "{{ invoice }}"
```

```typescript
// backend/src/functions/calculateTax.ts
export async function calculateTax(invoice: Invoice) {
  // Complex tax calculation logic
  // Too nuanced for YAML
}
```

### Real-time features

WebSockets, live updates, collaborative editing—these need more than CRUD.

Solution: Define separately, integrate manually.

### Third-party constraints

External APIs have their own shapes and limitations.

Solution: Adapter layer between your contract and external APIs.

---

## Getting Started

1. **Design your UI** in Figma or sketches

2. **Generate components** using AI + your component library

3. **Add MSW + Faker** for realistic mock data

4. **Build all flows** with fake data—every screen, every state

5. **Extract contract** from your MSW handlers and types

6. **Write rules** in YAML—permissions, automations, validations

7. **Generate backend** from contract + rules

8. **Connect** by disabling MSW

9. **Iterate** on rules as needed, regenerate backend

---

## Future Possibilities

### Visual rules editor

Instead of YAML, a UI for defining rules:
- Drag-and-drop automation builder
- Permission matrix editor
- Workflow designer

### Hot-reloading rules

Change YAML in development, backend updates without restart.

### Rules testing

Unit tests for your business rules:

```typescript
describe('permissions', () => {
  it('allows owner to delete project', () => {
    const user = { id: '1', role: 'member' }
    const project = { ownerId: '1' }
    expect(canDelete(user, project)).toBe(true)
  })

  it('denies member from deleting others project', () => {
    const user = { id: '1', role: 'member' }
    const project = { ownerId: '2' }
    expect(canDelete(user, project)).toBe(false)
  })
})
```

### Multi-platform generation

Same contract + rules, generate:
- Node.js backend
- Python backend
- Go backend
- Mobile app (React Native)
- Desktop app (Electron)

The contract is platform-agnostic. The rules are platform-agnostic. Only the generated code differs.
