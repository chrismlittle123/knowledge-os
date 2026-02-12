/**
 * Fabrica Core Types - v2 Simplified
 */

/**
 * Session status in the execution lifecycle
 */
export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'escalated';

/**
 * Message types for session communication
 */
export type MessageType = 'progress' | 'completion' | 'escalation' | 'error';

/**
 * A parsed execution plan
 */
export interface Plan {
  repoUrl: string;
  title: string;
  description: string;
  rawMarkdown: string;
}

/**
 * Session tracking - the main unit of work in Fabrica
 */
export interface Session {
  id: string;
  repoUrl: string;
  branchName?: string;
  prUrl?: string;
  status: SessionStatus;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Message for session updates
 */
export interface Message {
  id: string;
  sessionId: string;
  type: MessageType;
  content: {
    message: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: Date;
  readAt?: Date;
}
