/**
 * Review Session
 *
 * Compares implementation against spec (plan).
 * Checks each acceptance criterion and scores confidence.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { REVIEWER_SYSTEM_PROMPT, REVIEWER_TOOLS } from "../prompts/reviewer.js";
import type {
  Plan,
  Implementation,
  ReviewResult,
  CriteriaResult,
  ConfidenceLevel,
  ReviewAction,
  SessionEvent,
} from "../types.js";

export interface ReviewerOptions {
  workDir: string;
}

/**
 * Run a review session
 *
 * @param plan - The spec to review against
 * @param implementation - The code changes to review
 * @param options - Session configuration
 * @param onEvent - Callback for streaming events
 * @returns The review result with confidence score
 */
export async function runReviewSession(
  plan: Plan,
  implementation: Implementation,
  options: ReviewerOptions,
  onEvent?: (event: SessionEvent) => void
): Promise<ReviewResult> {
  const emit = onEvent ?? (() => {});

  emit({ type: "thinking", message: "Starting review session..." });

  // Build the review prompt
  const prompt = buildReviewPrompt(plan, implementation);

  const queryOptions: Options = {
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    cwd: options.workDir,
    allowedTools: [...REVIEWER_TOOLS],
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

  // Parse the review from the response
  const result = parseReviewResult(fullResponse, plan);

  emit({ type: "review_ready", result });

  return result;
}

/**
 * Build the prompt for the review session
 */
function buildReviewPrompt(plan: Plan, implementation: Implementation): string {
  let prompt = `## Spec (Plan)\n\n${plan.raw}\n\n`;

  prompt += `## Implementation\n\n`;

  switch (implementation.type) {
    case "pr":
      prompt += `Pull Request: ${implementation.identifier}\n`;
      break;
    case "branch":
      prompt += `Branch: ${implementation.identifier}\n`;
      break;
    case "local":
      prompt += `Local changes in: ${implementation.identifier}\n`;
      break;
  }

  if (implementation.diff) {
    prompt += `\n### Diff\n\n\`\`\`diff\n${implementation.diff}\n\`\`\`\n`;
  }

  if (implementation.files && implementation.files.length > 0) {
    prompt += `\n### Changed Files\n\n${implementation.files.map((f) => `- ${f}`).join("\n")}\n`;
  }

  prompt += `\n## Your Task\n\n`;
  prompt += `Review this implementation against the spec. Check each acceptance criterion, `;
  prompt += `identify any issues, and provide a confidence score with your recommendation.`;

  return prompt;
}

/**
 * Parse review result from Claude's response
 */
function parseReviewResult(response: string, plan: Plan): ReviewResult {
  // Extract confidence score
  const confidenceMatch = response.match(
    /\*\*Confidence Score:\*\*\s*(\d+)/i
  );
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;

  // Determine confidence level
  const confidenceLevel = getConfidenceLevel(confidence);

  // Extract recommendation
  const recommendationMatch = response.match(
    /\*\*Recommendation:\*\*\s*(APPROVE|REQUEST_CHANGES|ITERATE|ESCALATE)/i
  );
  const recommendationStr = recommendationMatch
    ? recommendationMatch[1].toUpperCase()
    : "ITERATE";

  // Parse criteria results (simplified - in practice would be more robust)
  const criteriaResults = parseCriteriaResults(response, plan);

  // Extract issues
  const issues = parseIssues(response);

  // Extract summary
  const summaryMatch = response.match(
    /## Summary\n\n([\s\S]*?)(?=\n##|$)/
  );
  const summary = summaryMatch ? summaryMatch[1].trim() : "";

  // Build recommended action
  const recommendedAction = buildRecommendedAction(
    recommendationStr,
    issues
  );

  return {
    planId: plan.title, // Using title as ID for now
    confidence,
    confidenceLevel,
    criteriaResults,
    issues,
    summary,
    recommendedAction,
  };
}

/**
 * Determine confidence level from score
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 90) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

/**
 * Parse criteria results from response
 */
function parseCriteriaResults(response: string, plan: Plan): CriteriaResult[] {
  const results: CriteriaResult[] = [];

  for (const task of plan.tasks) {
    for (const criterion of task.acceptanceCriteria) {
      // Look for this criterion in the response
      const passed =
        response.includes(`✅`) &&
        response.toLowerCase().includes(criterion.toLowerCase().slice(0, 20));

      results.push({
        taskId: task.id,
        criterion,
        passed,
        evidence: "", // Would need more sophisticated parsing
      });
    }
  }

  return results;
}

/**
 * Parse issues from response
 */
function parseIssues(response: string): string[] {
  const issues: string[] = [];

  // Look for numbered issues
  const issueMatches = response.matchAll(
    /\d+\.\s+\*\*([^*]+)\*\*:\s*([^\n]+)/g
  );
  for (const match of issueMatches) {
    issues.push(`${match[1]}: ${match[2]}`);
  }

  return issues;
}

/**
 * Build recommended action from parsed data
 */
function buildRecommendedAction(
  recommendation: string,
  issues: string[]
): ReviewAction {
  switch (recommendation) {
    case "APPROVE":
      return { type: "approve" };
    case "REQUEST_CHANGES":
      return { type: "request_changes", issues };
    case "ITERATE":
      return { type: "iterate", reason: issues[0] || "Issues found in review" };
    case "ESCALATE":
      return {
        type: "escalate",
        reason: issues[0] || "Major issues require human review",
      };
    default:
      return { type: "iterate", reason: "Review inconclusive" };
  }
}
