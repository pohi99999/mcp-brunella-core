/**
 * CEAN (Cloudflare Edge Agents Network) Routes
 * - Chat history persistence (SQLite)
 * - Task management
 * - Worker status
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';

const router = Router();
const db = new Database(process.env.DATABASE_PATH || 'data/cean.db');

// Initialization: Create tables if needed
function initializeTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cean_chat_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        task_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      
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
    const { sessionId, role, content, taskId } = req.body;

    // Validation
    if (!sessionId || !role || !content) {
      res.status(400).json({
        error: 'Missing required fields: sessionId, role, content',
      });
      return;
    }

    if (!['user', 'assistant'].includes(role)) {
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
      (id, session_id, role, content, task_id, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, sessionId, role, content, taskId || null, timestamp, created_at);

    logInfo('CEAN Routes', `Chat message saved: ${role} - ${content.slice(0, 50)}...`);

    res.json({
      id,
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
    const { sessionId } = req.params;
    const { limit, offset } = req.query;

    // Parse and validate pagination
    let limitNum = parseInt(String(limit) || '100', 10);
    let offsetNum = parseInt(String(offset) || '0', 10);

    if (limitNum > 500) limitNum = 500;
    if (limitNum < 1) limitNum = 1;
    if (offsetNum < 0) offsetNum = 0;

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM cean_chat_history WHERE session_id = ?');
    const { count: total } = countStmt.get(sessionId) as { count: number };

    const stmt = db.prepare(`
      SELECT id, role, content, task_id, timestamp, created_at
      FROM cean_chat_history
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);

    const messages = stmt.all(sessionId, limitNum, offsetNum) as Array<{
      id: string;
      role: string;
      content: string;
      task_id: string | null;
      timestamp: number;
      created_at: string;
    }>;

    logInfo('CEAN Routes', `Chat history loaded: ${sessionId} (${messages.length}/${total} messages)`);

    res.json({
      sessionId,
      messages: messages.map((msg) => ({
        id: msg.id,
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
    const { sessionId } = req.params;

    const stmt = db.prepare('DELETE FROM cean_chat_history WHERE session_id = ?');
    const result = stmt.run(sessionId);

    logInfo('CEAN Routes', `Chat history cleared: ${sessionId} (${result.changes} messages deleted)`);

    res.json({
      sessionId,
      deleted: result.changes,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('CEAN Routes', `History clear failed: ${error}`);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
