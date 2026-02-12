import { parse as parseYaml } from 'yaml';
import type { Plan } from './types.js';

/**
 * Error thrown when plan parsing fails
 */
export class PlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanParseError';
  }
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new PlanParseError('Missing YAML frontmatter. Plan must start with ---');
  }

  try {
    const metadata = parseYaml(match[1]) as Record<string, unknown>;
    return { metadata, body: match[2] };
  } catch (e) {
    throw new PlanParseError(`Invalid YAML frontmatter: ${(e as Error).message}`);
  }
}

/**
 * Extract plan title from markdown body or frontmatter
 */
function extractTitle(body: string, metadata: Record<string, unknown>): string {
  // First try frontmatter
  if (metadata.title && typeof metadata.title === 'string') {
    return metadata.title;
  }
  // Then try first heading
  const titleMatch = body.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : 'Untitled Plan';
}

/**
 * Extract description from markdown body
 */
function extractDescription(body: string): string {
  // Get content after title until first ## heading
  const afterTitle = body.replace(/^#\s+.+$/m, '').trim();
  const beforeSection = afterTitle.split(/^##\s+/m)[0].trim();
  return beforeSection || '';
}

/**
 * Parse a markdown plan with YAML frontmatter
 */
export function parsePlan(content: string): Plan {
  const { metadata, body } = parseFrontmatter(content);

  if (!metadata.repo || typeof metadata.repo !== 'string') {
    throw new PlanParseError('Missing required field: repo');
  }

  return {
    repoUrl: metadata.repo,
    title: extractTitle(body, metadata),
    description: extractDescription(body),
    rawMarkdown: content,
  };
}
