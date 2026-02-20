import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { createWebhookRoutes } from '../src/server/routes/webhooks.js';
// Mock config
vi.mock('../src/config/schema.js', () => ({
    config: {
        githubToken: 'test-token',
        githubWebhookSecret: 'test-secret'
    }
}));
// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn()
}));
// Mock fetch for log retrieval
global.fetch = vi.fn();
describe('Webhook Routes Integration', () => {
    let app;
    let db;
    beforeEach(() => {
        // Setup in-memory DB
        db = new Database(':memory:');
        // Create tables
        db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
        db.exec(`
      CREATE TABLE IF NOT EXISTS suggested_tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        source TEXT,
        file_path TEXT,
        line_number INTEGER,
        todo_text TEXT,
        context TEXT,
        confidence_score REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
        app = express();
        // Capture raw body for signature verification (same as in server/web.ts)
        app.use(express.json({
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            }
        }));
        app.use('/api', createWebhookRoutes(db));
    });
    afterEach(() => {
        vi.clearAllMocks();
        db.close();
    });
    it('should accept valid signature and process workflow failure', async () => {
        // Mock GitHub log response
        const mockLogs = `
      Error: build failed at src/index.ts(10,5)
      error TS2322: Type 'string' is not assignable to type 'number'.
    `;
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                jobs: [{ id: 123, conclusion: 'failure' }]
            }),
            text: async () => mockLogs
        });
        const payload = {
            action: 'completed',
            workflow_run: {
                id: 999,
                conclusion: 'failure',
                head_commit: { id: 'abc1234' }
            },
            repository: {
                name: 'owner/repo'
            }
        };
        const payloadString = JSON.stringify(payload);
        // Calculate signature
        const hmac = crypto.createHmac('sha256', 'test-secret');
        const signature = 'sha256=' + hmac.update(payloadString).digest('hex');
        const response = await request(app)
            .post('/api/github')
            .set('X-GitHub-Event', 'workflow_run')
            .set('X-Hub-Signature-256', signature)
            .set('Content-Type', 'application/json')
            .send(payload);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Verify webhook event stored
        const event = db.prepare('SELECT * FROM webhook_events').get();
        expect(event).toBeDefined();
        expect(event.type).toBe('github.workflow_run');
        expect(event.processed).toBe(1); // Should be marked as processed for failure events
        // NOTE: Automatic suggested_task creation from webhook failures
        // is a future enhancement (would require log parsing + AI analysis)
        // For now, we just verify the webhook event was stored and processed
    });
    it('should reject invalid signature', async () => {
        const payload = { foo: 'bar' };
        const response = await request(app)
            .post('/api/github')
            .set('X-GitHub-Event', 'push')
            .set('X-Hub-Signature-256', 'sha256=invalid')
            .send(payload);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid signature');
    });
});
