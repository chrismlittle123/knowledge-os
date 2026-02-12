/**
 * Research Session
 *
 * Handles answering user questions with web search and codebase exploration.
 * Uses Claude Code SDK with web search enabled.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { RESEARCHER_SYSTEM_PROMPT, RESEARCHER_TOOLS } from "../prompts/researcher.js";
import type { SessionEvent } from "../types.js";

export interface ResearcherOptions {
  workDir: string;
}

export interface ResearchResult {
  answer: string;
  sources: string[];
}

/**
 * Run a research session to answer a user question
 */
export async function runResearchSession(
  question: string,
  options: ResearcherOptions,
  onEvent?: (event: SessionEvent) => void
): Promise<ResearchResult> {
  const emit = onEvent ?? (() => {});

  emit({ type: "thinking", message: "Researching your question..." });

  const queryOptions: Options = {
    systemPrompt: RESEARCHER_SYSTEM_PROMPT,
    cwd: options.workDir,
    allowedTools: [...RESEARCHER_TOOLS],
  };

  let fullResponse = "";

  const response = query({
    prompt: question,
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

  // Extract sources from the response (URLs)
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  const sources = [...new Set(fullResponse.match(urlRegex) || [])];

  return {
    answer: fullResponse,
    sources,
  };
}
