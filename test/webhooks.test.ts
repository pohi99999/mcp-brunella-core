
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { createWebhookRoutes } from '../src/server/routes/webhooks.js';
import { config } from '../src/config/schema.js';
import { eventFabric } from '../src/core/eventFabric.js';

const hookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));

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

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHook: hookHarness.fireHook,
  fireHookSafely: hookHarness.fireHook,
  isHookEnabled: vi.fn(() => false),
}));

// Mock fetch for log retrieval
global.fetch = vi.fn();

function signPayload(payload: unknown): string {
  return `sha256=${crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex')}`;
}

describe('Webhook Routes Integration', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    // Clear event fabric history to avoid duplicate dedupKey errors
    eventFabric.clearHistory();
    hookHarness.fireHook.mockClear();

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
      verify: (req: any, _res, buf) => {
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
    
    (global.fetch as any).mockResolvedValue({
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

    const signature = signPayload(payload);

    const response = await request(app)
      .post('/api/github')
      .set('X-GitHub-Event', 'workflow_run')
      .set('X-Hub-Signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.remediationAccepted).toBe(true);

    // Verify webhook event stored
    const event = db.prepare('SELECT * FROM webhook_events').get() as any;
    expect(event).toBeDefined();
    expect(event.type).toBe('github.workflow_run');
    expect(event.processed).toBe(1); // Should be marked as processed for failure events
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'webhook.received',
      expect.objectContaining({
        provider: 'github',
        event: 'github.workflow_run',
      }),
      expect.anything(),
    );

    // NOTE: Automatic suggested_task creation from webhook failures
    // is a future enhancement (would require log parsing + AI analysis)
    // For now, we just verify the webhook event was stored and processed
  });

  it('should emit n8n workflow completion hooks for generic n8n webhooks', async () => {
    const response = await request(app)
      .post('/api/webhook/n8n')
      .send({
        workflowId: 'wf-1',
        status: 'completed',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'n8n:workflow:completed',
      expect.objectContaining({
        provider: 'n8n',
      }),
      expect.anything(),
    );
  });

  it('should reject missing signature when a GitHub webhook secret is configured', async () => {
    const response = await request(app)
      .post('/api/github')
      .set('X-GitHub-Event', 'push')
      .send({ foo: 'bar' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Missing signature');
  });

  it('should require a valid signature for GitHub push webhooks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { count: 0, tasks: [] } }),
    } as Response);

    const payload = {
      repository: { name: 'mcp-brunella-core' },
      pusher: { name: 'tester' },
      ref: 'refs/heads/main',
      head_commit: { id: 'abc123' },
    };

    const missingSignature = await request(app)
      .post('/api/github/push')
      .send(payload);

    expect(missingSignature.status).toBe(401);
    expect(missingSignature.body.error).toBe('Missing signature');

    const signed = await request(app)
      .post('/api/github/push')
      .set('X-Hub-Signature-256', signPayload(payload))
      .send(payload);

    expect(signed.status).toBe(200);
    expect(signed.body.success).toBe(true);

    fetchSpy.mockRestore();
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
