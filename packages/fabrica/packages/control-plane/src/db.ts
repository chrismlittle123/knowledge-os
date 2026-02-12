import pg from 'pg';
import type { Session, Message, SessionStatus, MessageType } from '@fabrica/core';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Create a new session
 */
export async function createSession(repoUrl: string): Promise<Session> {
  const result = await pool.query(
    `INSERT INTO sessions (repo_url) VALUES ($1) RETURNING *`,
    [repoUrl]
  );
  return mapSessionRow(result.rows[0]);
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'branchName' | 'prUrl' | 'status' | 'completedAt'>>
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.branchName !== undefined) {
    sets.push(`branch_name = $${idx++}`);
    values.push(updates.branchName);
  }
  if (updates.prUrl !== undefined) {
    sets.push(`pr_url = $${idx++}`);
    values.push(updates.prUrl);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${idx++}`);
    values.push(updates.status);
  }
  if (updates.completedAt !== undefined) {
    sets.push(`completed_at = $${idx++}`);
    values.push(updates.completedAt);
  }

  if (sets.length === 0) return;

  values.push(id);
  await pool.query(
    `UPDATE sessions SET ${sets.join(', ')} WHERE id = $${idx}`,
    values
  );
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<Session | null> {
  const result = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [id]);
  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<Session[]> {
  const result = await pool.query(`SELECT * FROM sessions ORDER BY created_at DESC`);
  return result.rows.map(mapSessionRow);
}

/**
 * Get all messages
 */
export async function getAllMessages(): Promise<Message[]> {
  const result = await pool.query(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 100`);
  return result.rows.map(mapMessageRow);
}

/**
 * Save a spec version for a session
 */
export async function saveSpec(sessionId: string, content: string): Promise<void> {
  const versionResult = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM specs WHERE session_id = $1`,
    [sessionId]
  );
  const version = versionResult.rows[0].next_version;

  await pool.query(
    `INSERT INTO specs (session_id, content, version) VALUES ($1, $2, $3)`,
    [sessionId, content, version]
  );
}

/**
 * Send a message for a session
 */
export async function sendMessage(
  sessionId: string,
  type: MessageType,
  content: { message: string; metadata?: Record<string, unknown> }
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (session_id, type, content) VALUES ($1, $2, $3)`,
    [sessionId, type, JSON.stringify(content)]
  );
}

/**
 * Get messages for a session
 */
export async function getMessages(sessionId: string): Promise<Message[]> {
  const result = await pool.query(
    `SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows.map(mapMessageRow);
}

// Row mappers
function mapSessionRow(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    repoUrl: row.repo_url as string,
    branchName: row.branch_name as string | undefined,
    prUrl: row.pr_url as string | undefined,
    status: row.status as SessionStatus,
    createdAt: new Date(row.created_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
  };
}

function mapMessageRow(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    type: row.type as MessageType,
    content: row.content as { message: string; metadata?: Record<string, unknown> },
    createdAt: new Date(row.created_at as string),
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
  };
}
