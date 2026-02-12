import { execa } from 'execa';
import type { Plan } from '@fabrica/core';
import * as db from './db.js';

const CONTAINER_IMAGE = process.env.AGENT_IMAGE || 'fabrica-agent:latest';
const CONTAINER_TIMEOUT = 60 * 60 * 1000; // 1 hour

/**
 * Spawn a container to execute the plan
 */
export async function spawnContainer(sessionId: string, plan: Plan): Promise<void> {
  const planBase64 = Buffer.from(plan.rawMarkdown).toString('base64');

  // Build environment variables
  const env: Record<string, string> = {
    SESSION_ID: sessionId,
    REPO_URL: plan.repoUrl,
    PLAN_MARKDOWN: planBase64,
    DATABASE_URL: process.env.DATABASE_URL || '',
  };

  // Pass through API keys if set
  if (process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.GITHUB_TOKEN) {
    env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }

  // Build docker run command
  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

  const containerName = `fabrica-${sessionId.slice(0, 8)}`;
  const networkName = process.env.DOCKER_NETWORK || 'fabrica_default';

  await db.sendMessage(sessionId, 'progress', {
    message: `Starting container ${containerName}...`,
  });

  try {
    const { stdout, stderr } = await execa('docker', [
      'run',
      '--rm',
      '--name', containerName,
      '--network', networkName,
      ...envArgs,
      CONTAINER_IMAGE,
    ], {
      timeout: CONTAINER_TIMEOUT,
    });

    // Container completed successfully
    await db.sendMessage(sessionId, 'progress', {
      message: 'Container execution completed',
      metadata: { stdout: stdout.slice(-1000), stderr: stderr.slice(-1000) },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a timeout
    if (errorMessage.includes('timed out')) {
      // Kill the container if still running
      try {
        await execa('docker', ['kill', containerName]);
      } catch {
        // Container may have already stopped
      }

      await db.updateSession(sessionId, {
        status: 'failed',
        completedAt: new Date(),
      });
      await db.sendMessage(sessionId, 'error', {
        message: 'Container execution timed out after 1 hour',
      });
      return;
    }

    // Check exit code for escalation vs failure
    const exitCode = (error as NodeJS.ErrnoException & { exitCode?: number }).exitCode;

    if (exitCode === 2) {
      // Exit code 2 = escalation needed
      await db.updateSession(sessionId, { status: 'escalated' });
      await db.sendMessage(sessionId, 'escalation', {
        message: 'Agent requires human assistance',
        metadata: { output: errorMessage },
      });
    } else {
      // Any other non-zero exit = failure
      await db.updateSession(sessionId, {
        status: 'failed',
        completedAt: new Date(),
      });
      await db.sendMessage(sessionId, 'error', {
        message: `Container exited with code ${exitCode}: ${errorMessage}`,
      });
    }
  }
}
