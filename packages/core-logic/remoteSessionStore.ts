/**
 * Remote Session Store — SQLite-backed persistence
 * Phase 2: Discovery, Capability & Auth
 *
 * Provides durable storage for RemoteSession and RemoteCommand records
 * using the same better-sqlite3 pattern as src/utils/db.ts.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '@packages/utils/schema.js';
import { logInfo } from '@packages/utils/logger.js';
import type { RemoteSession, RemoteCommand } from './types/remote.js';

interface SessionRow {
  id: string;
  user_id: string;
  target_id: string;
  created_at: number;
  expires_at: number;
  active: number;
  metadata: string | null;
}

interface CommandRow {
  id: string;
  session_id: string;
  target_id: string;
  tool_name: string;
  input: string;
  status: string;
  result: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

let _db: InstanceType<typeof Database> | null = null;

function getDb(): InstanceType<typeof Database> {
  if (_db) return _db;

  const dir = config.workspaceRoot ? path.join(config.workspaceRoot, 'data') : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, 'remote_sessions.db');
  _db = new Database(dbPath);
  _initTables(_db);
  logInfo('RemoteSessionStore', `Initialized at ${dbPath}`);
  return _db;
}

function _initTables(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS remote_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rs_user ON remote_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_rs_active ON remote_sessions(active);

    CREATE TABLE IF NOT EXISTS remote_commands (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES remote_sessions(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      input TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rc_session ON remote_commands(session_id);
    CREATE INDEX IF NOT EXISTS idx_rc_status ON remote_commands(status);
  `);
}

// ────────────────────────────────────────────────────────────────────────────
// Session CRUD
// ────────────────────────────────────────────────────────────────────────────

export function saveSession(session: RemoteSession): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO remote_sessions (id, user_id, target_id, created_at, expires_at, active, metadata)
    VALUES (@id, @userId, @targetId, @createdAt, @expiresAt, @active, @metadata)
    ON CONFLICT(id) DO UPDATE SET
      active    = excluded.active,
      expires_at = excluded.expires_at,
      metadata  = excluded.metadata
  `);
  stmt.run({
    id: session.id,
    userId: session.userId,
    targetId: session.targetId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    active: session.active ? 1 : 0,
    metadata: session.metadata ? JSON.stringify(session.metadata) : null,
  });
}

export function getSession(sessionId: string): RemoteSession | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM remote_sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
  if (!row) return null;
  return _rowToSession(row);
}

export function listActiveSessions(userId?: string): RemoteSession[] {
  const db = getDb();
  const now = Date.now();
  const rows = userId
    ? db.prepare('SELECT * FROM remote_sessions WHERE active = 1 AND expires_at > ? AND user_id = ?').all(now, userId) as SessionRow[]
    : db.prepare('SELECT * FROM remote_sessions WHERE active = 1 AND expires_at > ?').all(now) as SessionRow[];
  return rows.map(_rowToSession);
}

export function deactivateSession(sessionId: string): void {
  const db = getDb();
  db.prepare('UPDATE remote_sessions SET active = 0 WHERE id = ?').run(sessionId);
}

export function deleteExpiredSessions(): number {
  const db = getDb();
  return db.prepare('DELETE FROM remote_sessions WHERE expires_at < ?').run(Date.now()).changes;
}

function _rowToSession(row: SessionRow): RemoteSession {
  const commands = listCommandsForSession(row.id);
  return {
    id: row.id,
    userId: row.user_id,
    targetId: row.target_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    active: row.active === 1,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    commands,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Command CRUD
// ────────────────────────────────────────────────────────────────────────────

export function saveCommand(cmd: RemoteCommand): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO remote_commands (id, session_id, target_id, tool_name, input, status, result, error, created_at, updated_at)
    VALUES (@id, @sessionId, @targetId, @toolName, @input, @status, @result, @error, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      status     = excluded.status,
      result     = excluded.result,
      error      = excluded.error,
      updated_at = excluded.updated_at
  `);
  stmt.run({
    id: cmd.id,
    sessionId: cmd.sessionId,
    targetId: cmd.targetId,
    toolName: cmd.toolName,
    input: JSON.stringify(cmd.input),
    status: cmd.status,
    result: cmd.result ? JSON.stringify(cmd.result) : null,
    error: cmd.error ?? null,
    createdAt: cmd.createdAt,
    updatedAt: cmd.updatedAt,
  });
}

export function getCommand(commandId: string): RemoteCommand | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM remote_commands WHERE id = ?').get(commandId) as CommandRow | undefined;
  return row ? _rowToCommand(row) : null;
}

export function listCommandsForSession(sessionId: string): RemoteCommand[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM remote_commands WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as CommandRow[];
  return rows.map(_rowToCommand);
}

export function updateCommandStatus(
  commandId: string,
  status: RemoteCommand['status'],
  result?: Record<string, unknown>,
  error?: string,
): void {
  const db = getDb();
  db.prepare(`
    UPDATE remote_commands
    SET status = ?, result = ?, error = ?, updated_at = ?
    WHERE id = ?
  `).run(status, result ? JSON.stringify(result) : null, error ?? null, Date.now(), commandId);
}

function _rowToCommand(row: CommandRow): RemoteCommand {
  return {
    id: row.id,
    sessionId: row.session_id,
    targetId: row.target_id,
    toolName: row.tool_name,
    input: JSON.parse(row.input),
    status: row.status as RemoteCommand['status'],
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Housekeeping
// ────────────────────────────────────────────────────────────────────────────

export function closeStore(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

