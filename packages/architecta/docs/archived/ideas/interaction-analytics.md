# Interaction Analytics

## Idea

Capture all messages exchanged between users and Architecta to build a comprehensive dataset of team development activity.

## What to Capture

### User Messages
- Original requirement/prompt
- Refinement feedback
- Question responses
- Approval/rejection decisions

### Architecta Responses
- Clarifying questions asked
- Plans generated (full structured data)
- Review results
- Tool usage (which files explored, what searches ran)
- Thinking/reasoning steps

### Metadata
- Timestamp
- User ID / session ID
- Workflow ID
- Target repository
- Duration of each phase
- Token usage per request

## Use Cases

### Team Insights
- What features/areas are being worked on most?
- Common patterns in requirements
- Frequently modified parts of the codebase

### Bottleneck Detection
- Where do plans get rejected most often?
- What types of requirements need the most iterations?
- Average time from requirement to approved plan

### Quality Improvement
- Which clarifying questions lead to better plans?
- Correlation between codebase exploration depth and plan quality
- Common misunderstandings to address in prompts

### Knowledge Base
- Build a searchable history of "how did we implement X?"
- Reference previous similar requirements
- Auto-suggest based on past successful patterns

## Implementation Options

### 1. Event Store (Recommended)
Store every SSE event with full context:
```typescript
interface InteractionEvent {
  id: string;
  workflowId: string;
  userId: string;
  timestamp: Date;
  type: 'user_message' | 'assistant_response' | 'tool_use' | 'plan_ready' | 'question' | 'approval';
  payload: unknown;
  metadata: {
    repository: string;
    tokenCount?: number;
    latencyMs?: number;
  };
}
```

### 2. Storage Options
- **PostgreSQL/SQLite** - Structured queries, good for analytics
- **ClickHouse** - Time-series optimized, great for high volume
- **S3 + Athena** - Cost-effective for large scale, query when needed
- **Elasticsearch** - Full-text search across all interactions

### 3. Privacy Considerations
- PII scrubbing for sensitive data
- Opt-out mechanism per user/repo
- Retention policies
- Access controls for analytics dashboard

## Future Extensions

- **AI-powered insights**: Summarize weekly team activity
- **Anomaly detection**: Flag unusual patterns (sudden spike in auth-related work)
- **Recommendations**: "Teams working on similar features often also need..."
- **Training data**: Fine-tune models on successful interaction patterns
