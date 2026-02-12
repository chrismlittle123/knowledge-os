/**
 * Planning Session
 *
 * Handles plan generation and stress testing.
 * Uses Claude Code SDK with read-only tools to explore codebase
 * and generate bulletproof plans.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { PLANNER_SYSTEM_PROMPT, PLANNER_TOOLS } from "../prompts/planner.js";
import type { Plan, Task, SessionEvent, ClarifyingQuestion } from "../types.js";

export interface PlannerOptions {
  workDir: string;
}

/**
 * Run a planning session
 *
 * @param requirement - What the user wants to build
 * @param options - Session configuration
 * @param onEvent - Callback for streaming events
 * @returns The generated plan
 */
export async function runPlanningSession(
  requirement: string,
  options: PlannerOptions,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan> {
  const emit = onEvent ?? (() => {});

  emit({ type: "thinking", message: "Starting planning session..." });

  const queryOptions: Options = {
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    cwd: options.workDir,
    allowedTools: [...PLANNER_TOOLS],
  };

  let fullResponse = "";

  const response = query({
    prompt: requirement,
    options: queryOptions,
  });

  for await (const event of response) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          emit({ type: "output", text: block.text });
          fullResponse += block.text;
        }
      }
    }
  }

  // Check for clarifying questions first
  const questions = parseQuestions(fullResponse);
  if (questions.length > 0) {
    emit({ type: "questions", questions });
    // Return empty plan - waiting for answers
    return {
      raw: fullResponse,
      repo: "",
      flow: [],
      title: "Awaiting Clarification",
      playbook: {
        type: "new_feature",
        name: "Pending",
        description: "Awaiting clarification",
        reasoning: "Questions need to be answered first",
      },
      tasks: [],
    };
  }

  // Parse the plan from the response
  const plan = parsePlan(fullResponse);

  emit({ type: "plan_ready", plan });

  return plan;
}

/**
 * Continue a planning session with additional input
 * Used for iteration and refinement
 */
export async function continuePlanningSession(
  followUp: string,
  previousContext: string,
  options: PlannerOptions,
  onEvent?: (event: SessionEvent) => void
): Promise<Plan> {
  const emit = onEvent ?? (() => {});

  emit({ type: "thinking", message: "Refining plan..." });

  // Combine previous context with follow-up
  const prompt = `Previous context:\n${previousContext}\n\nUser feedback:\n${followUp}\n\nPlease refine the plan based on this feedback.`;

  const queryOptions: Options = {
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    cwd: options.workDir,
    allowedTools: [...PLANNER_TOOLS],
  };

  let fullResponse = "";

  const response = query({
    prompt,
    options: queryOptions,
  });

  for await (const event of response) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          emit({ type: "output", text: block.text });
          fullResponse += block.text;
        }
      }
    }
  }

  // Check for clarifying questions first
  const questions = parseQuestions(fullResponse);
  if (questions.length > 0) {
    emit({ type: "questions", questions });
    // Return empty plan - waiting for answers
    return {
      raw: fullResponse,
      repo: "",
      flow: [],
      title: "Awaiting Clarification",
      playbook: {
        type: "new_feature",
        name: "Pending",
        description: "Awaiting clarification",
        reasoning: "Questions need to be answered first",
      },
      tasks: [],
    };
  }

  const plan = parsePlan(fullResponse);

  emit({ type: "plan_ready", plan });

  return plan;
}

/**
 * Parse clarifying questions from response
 * Supports both JSON format and markdown table format
 */
function parseQuestions(response: string): ClarifyingQuestion[] {
  // Try JSON format first
  const questionsMatch = response.match(/```questions\n([\s\S]*?)\n```/);
  if (questionsMatch) {
    try {
      const parsed = JSON.parse(questionsMatch[1]);
      if (Array.isArray(parsed)) {
        return parsed.map((q: Record<string, unknown>, index: number) => ({
          id: (q.id as string) || `q${index + 1}`,
          question: (q.question as string) || "",
          options: Array.isArray(q.options)
            ? (q.options as Array<Record<string, unknown>>).map((opt) => ({
                value: (opt.value as string) || "",
                label: (opt.label as string) || "",
                description: opt.description as string | undefined,
              }))
            : [],
          allowMultiple: q.allowMultiple as boolean | undefined,
        }));
      }
    } catch {
      // Fall through to markdown parsing
    }
  }

  // Check if this looks like a questions response (has "Questions" section or numbered bold questions)
  const hasQuestionsSection = /##\s*Questions|Questions for You|\*\*\d+\.\s*[^*]+\?\*\*/i.test(response);
  if (!hasQuestionsSection) {
    return [];
  }

  // Try markdown table format
  const questions: ClarifyingQuestion[] = [];

  // Split by numbered questions (e.g., "**1. Question?**" or "1. **Question?**")
  const sections = response.split(/(?=\*\*\d+\.|(?:^|\n)\d+\.\s*\*\*)/);

  for (const section of sections) {
    // Extract question number and text
    const questionMatch = section.match(/\*\*(\d+)\.\s*([^*]+?)\??\*\*|\b(\d+)\.\s*\*\*([^*]+?)\??\*\*/);
    if (!questionMatch) continue;

    const questionNum = questionMatch[1] || questionMatch[3];
    const questionText = (questionMatch[2] || questionMatch[4])?.trim();
    if (!questionText) continue;

    // Extract table rows - look for | **Option** | Description | pattern
    const options: ClarifyingQuestion["options"] = [];

    // Match rows with bold option names
    const rowRegex = /\|\s*\*\*([^*|]+)\*\*\s*(?:\(([^)]*)\))?\s*\|\s*([^|\n]+)/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(section)) !== null) {
      const label = rowMatch[1].trim();
      const annotation = rowMatch[2]?.trim() || "";
      const description = rowMatch[3].trim();

      // Skip header rows
      if (label.toLowerCase() === "option") continue;

      const isRecommended = annotation.toLowerCase().includes("recommended");

      options.push({
        value: label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        label: isRecommended ? `${label} (Recommended)` : label,
        description: description,
      });
    }

    // If no bold options found, try plain table format
    if (options.length === 0) {
      const plainRowRegex = /\|\s*([^|*\n]+)\s*\|\s*([^|\n]+)/g;
      let plainMatch;

      while ((plainMatch = plainRowRegex.exec(section)) !== null) {
        const label = plainMatch[1].trim();
        const description = plainMatch[2].trim();

        // Skip header rows and separator rows
        if (label.toLowerCase() === "option" || label.match(/^-+$/)) continue;

        const isRecommended = label.toLowerCase().includes("recommended") || description.toLowerCase().includes("recommended");
        const cleanLabel = label.replace(/\s*\(recommended\)/i, "").trim();

        options.push({
          value: cleanLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
          label: isRecommended ? `${cleanLabel} (Recommended)` : cleanLabel,
          description: description,
        });
      }
    }

    if (options.length >= 2) {
      questions.push({
        id: `q${questionNum}`,
        question: questionText.endsWith("?") ? questionText : `${questionText}?`,
        options,
      });
    }
  }

  return questions;
}

/**
 * Parse a plan from markdown response
 */
function parsePlan(response: string): Plan {
  // Extract markdown code block
  const planMatch = response.match(/```markdown\n([\s\S]*?)\n```/);
  const raw = planMatch ? planMatch[1] : response;

  // Parse YAML frontmatter
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  let repo = "";
  let flow: string[] = [];

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const repoMatch = frontmatter.match(/repo:\s*(.+)/);
    const flowMatch = frontmatter.match(/flow:\s*\[([^\]]+)\]/);

    if (repoMatch) repo = repoMatch[1].trim();
    if (flowMatch) {
      flow = flowMatch[1].split(",").map((s) => s.trim());
    }
  }

  // Parse title
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : "Untitled Plan";

  // Parse tasks
  const tasks = parseTasks(raw);

  // Default playbook for legacy markdown parsing
  const playbook = {
    type: "new_feature" as const,
    name: "New Feature",
    description: "Feature implementation",
    reasoning: "Inferred from plan content",
  };

  return { raw, repo, flow, title, playbook, tasks };
}

/**
 * Parse tasks from plan markdown
 */
function parseTasks(markdown: string): Task[] {
  const tasks: Task[] = [];
  const taskRegex = /##\s+Task\s+(\d+):\s*(.+?)(?=\n##|\n*$)/gs;

  let match;
  while ((match = taskRegex.exec(markdown)) !== null) {
    const id = parseInt(match[1], 10);
    const fullMatch = match[0];

    // Extract title (first line after "## Task N:")
    const titleMatch = fullMatch.match(/##\s+Task\s+\d+:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract description (text before Requirements:)
    const descMatch = fullMatch.match(
      /##\s+Task\s+\d+:[^\n]*\n\n?([\s\S]*?)(?=\n\s*Requirements:|\n\s*Acceptance Criteria:|$)/
    );
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract requirements
    const reqMatch = fullMatch.match(
      /Requirements:\n((?:[-*]\s+.+\n?)+)/
    );
    const requirements = reqMatch
      ? reqMatch[1]
          .split("\n")
          .filter((line) => line.match(/^[-*]\s+/))
          .map((line) => line.replace(/^[-*]\s+/, "").trim())
      : [];

    // Extract acceptance criteria
    const criteriaMatch = fullMatch.match(
      /Acceptance Criteria:\n((?:[-*]\s*\[[ x]\]\s+.+\n?)+)/
    );
    const acceptanceCriteria = criteriaMatch
      ? criteriaMatch[1]
          .split("\n")
          .filter((line) => line.match(/^[-*]\s*\[[ x]\]/))
          .map((line) => line.replace(/^[-*]\s*\[[ x]\]\s*/, "").trim())
      : [];

    tasks.push({
      id,
      title,
      description,
      humanRole: "must_verify",
      risk: "medium",
      complexity: "medium",
      dependsOn: [],
      requirements,
      acceptanceCriteria,
    });
  }

  return tasks;
}
