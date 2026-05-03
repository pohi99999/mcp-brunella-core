/**
 * CEAN (Cloudflare Edge Agents Network) Routes
 * - Chat history persistence (SQLite)
 * - Task management
 * - Worker status
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '@packages/utils/logger.js';
import { normalizeTenantContext } from '@packages/core-logic/tenantRegistry.js';

const router = Router();
const db = new Database(process.env.DATABASE_PATH || 'data/cean.db');

// Initialization: Create tables if needed
function initializeTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cean_chat_history (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'system',
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        task_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_tenant_id ON cean_chat_history(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_session_id ON cean_chat_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_role ON cean_chat_history(role);
      CREATE INDEX IF NOT EXISTS idx_created_at ON cean_chat_history(created_at);
    `);
    logInfo('CEAN Routes', 'Chat history tables initialized');
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('CEAN Routes', `Table init failed: ${error}`);
  }
}

initializeTables();

function getTenantId(req: Request): string {
  return normalizeTenantContext(req.header('X-Tenant-ID') || undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readLimit(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value.trim(), 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function readOffset(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value.trim(), 10) : 0;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
}

function readRole(value: unknown): 'user' | 'assistant' | undefined {
  const role = readString(value);
  return role === 'user' || role === 'assistant' ? role : undefined;
}

/**
 * POST /api/cean/chat/save
 * Save a chat message to history
 *
 * Body:
 * {
 *   sessionId: string (UUID)
 *   role: "user" | "assistant"
 *   content: string (message text)
 *   taskId?: string (optional task reference)
 * }
 *
 * Response:
 * {
 *   id: string (UUID)
 *   timestamp: number
 *   created_at: string (ISO-8601)
 * }
 */
router.post('/cean/chat/save', (req: Request, res: Response): void => {
  try {
    const tenantId = getTenantId(req);
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const roleText = readString(body.role);
    const role = readRole(body.role);
    const content = readString(body.content);
    const taskId = readString(body.taskId);

    // Validation
    if (!sessionId || !roleText || !content) {
      res.status(400).json({
        error: 'Missing required fields: sessionId, role, content',
      });
      return;
    }

    if (!role) {
      res.status(400).json({
        error: 'Invalid role. Must be "user" or "assistant"',
      });
      return;
    }

    const id = `msg-${uuidv4()}`;
    const timestamp = Date.now();
    const created_at = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO cean_chat_history 
      (id, tenant_id, session_id, role, content, task_id, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, tenantId, sessionId, role, content, taskId ?? null, timestamp, created_at);

    logInfo('CEAN Routes', `Chat message saved: ${role} - ${content.slice(0, 50)}...`);

    res.json({
      id,
      tenantId,
      timestamp,
      created_at,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('CEAN Routes', `Save failed: ${error}`);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

/**
 * GET /api/cean/chat/history/:sessionId
 * Load chat history for a session
 *
 * Query params:
 * - limit: number (default: 100, max: 500)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   sessionId: string
 *   messages: Array<{
 *     id: string
 *     role: "user" | "assistant"
 *     content: string
 *     taskId?: string
 *     timestamp: number
 *     created_at: string
 *   }>
 *   total: number
 * }
 */
router.get('/cean/chat/history/:sessionId', (req: Request, res: Response): void => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = readString(req.params.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Parse and validate pagination
    const limitNum = readLimit(req.query.limit, 100);
    const offsetNum = readOffset(req.query.offset);

    const stmt = db.prepare(`
      SELECT id, tenant_id, role, content, task_id, timestamp, created_at
      FROM cean_chat_history
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);

    const allMessages = stmt.all(sessionId) as Array<{
      id: string;
      tenant_id: string;
      role: string;
      content: string;
      task_id: string | null;
      timestamp: number;
      created_at: string;
    }>;

    const scopedMessages = allMessages.filter((msg) => msg.tenant_id === tenantId);
    const messages = scopedMessages.slice(offsetNum, offsetNum + limitNum);
    const total = scopedMessages.length;

    logInfo('CEAN Routes', `Chat history loaded: ${sessionId} (${messages.length}/${total} messages)`);

    res.json({
      sessionId,
      tenantId,
      messages: messages.map((msg) => ({
        id: msg.id,
        tenantId: msg.tenant_id,
        role: msg.role,
        content: msg.content,
        taskId: msg.task_id,
        timestamp: msg.timestamp,
        created_at: msg.created_at,
      })),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('CEAN Routes', `History load failed: ${error}`);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

/**
 * DELETE /api/cean/chat/history/:sessionId
 * Clear all messages for a session
 */
router.delete('/cean/chat/history/:sessionId', (req: Request, res: Response): void => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = readString(req.params.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const rows = db.prepare(
      'SELECT id, tenant_id FROM cean_chat_history WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as Array<{ id: string; tenant_id: string }>;
    const idsToDelete = rows.filter((row) => row.tenant_id === tenantId).map((row) => row.id);

    const result = idsToDelete.length > 0
      ? db.prepare(`DELETE FROM cean_chat_history WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`).run(...idsToDelete)
      : { changes: 0 };

    logInfo('CEAN Routes', `Chat history cleared: ${sessionId} (${result.changes} messages deleted)`);

    res.json({
      sessionId,
      tenantId,
      deleted: result.changes,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('CEAN Routes', `History clear failed: ${error}`);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
