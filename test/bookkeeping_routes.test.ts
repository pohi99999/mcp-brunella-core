import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createBookkeepingRoutes } from '../src/server/routes/bookkeeping.js';
import type { BookkeepingTransaction } from '../src/types/bookkeeping.d.js';

const { delegateMock, dbState } = vi.hoisted(() => {
  const delegateMock = vi.fn();
  return {
    delegateMock,
    dbState: {
      transactions: [] as BookkeepingTransaction[],
    },
  };
});

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: delegateMock,
  },
}));

vi.mock('../src/data/bookkeeping_db.js', () => ({
  getAllTransactions: vi.fn(() => dbState.transactions),
  getPendingTransactions: vi.fn((source?: string) =>
    dbState.transactions.filter((transaction) => {
      if (transaction.status !== 'PENDING_MATCH') {
        return false;
      }
      return source ? transaction.source === source : true;
    }),
  ),
  getTransaction: vi.fn((id: string) =>
    dbState.transactions.find((transaction) => transaction.id === id) ?? null,
  ),
  updateTransaction: vi.fn((id: string, updates: Partial<BookkeepingTransaction>) => {
    const index = dbState.transactions.findIndex((transaction) => transaction.id === id);
    if (index === -1) {
      return;
    }

    dbState.transactions[index] = {
      ...dbState.transactions[index],
      ...updates,
    };
  }),
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/bookkeeping', createBookkeepingRoutes());
  return app;
}

describe('Bookkeeping routes', () => {
  let tempDir: string;
  let statusPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookkeeping-routes-'));
    statusPath = path.join(tempDir, 'status.json');
    process.env.BOOKKEEPING_STATUS_PATH = statusPath;

    dbState.transactions = [
      {
        id: 'bank_1',
        source: 'BankAgent',
        data: { date: '2026-03-01', partner: 'Kovacs Kft.', amount: 100, reference: 'INV-1' },
        status: 'PENDING_MATCH',
      },
      {
        id: 'nav_1',
        source: 'NAV',
        data: { invoiceNumber: 'INV-1', amount: 100, partner: 'Kovacs Kft.', issueDate: '2026-03-01' },
        status: 'COMPLETED',
        matchedInvoice: 'INV-1',
      },
      {
        id: 'email_1',
        source: 'EmailAgent',
        data: { invoiceNumber: 'INV-2', amount: 80, partner: 'Masik Kft.', issueDate: '2026-03-02' },
        status: 'MANUAL_REVIEW',
      },
      {
        id: 'bank_2',
        source: 'BankAgent',
        data: { date: '2026-03-03', partner: 'Unknown Bt.', amount: 50, reference: 'N/A' },
        status: 'UNMATCHED',
      },
    ];

    delegateMock.mockReset();
    delegateMock.mockResolvedValue({
      success: true,
      status: 'success',
      message: 'Matching finished',
      data: { total: 1, matched: 1, manual: 0 },
    });
  });

  afterEach(async () => {
    delete process.env.BOOKKEEPING_STATUS_PATH;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    vi.clearAllMocks();
  });

  it('GET /status returns aggregated bookkeeping counts', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/bookkeeping/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toMatchObject({
      total: 4,
      pending: 1,
      completed: 1,
      manualReview: 1,
      unmatched: 1,
      partiallyMatched: 0,
      error: 0,
    });
    expect(res.body.pendingTransactions).toBe(1);
    expect(res.body.snapshot).toBeNull();
  });

  it('PATCH /status persists a snapshot and GET /status reads it back', async () => {
    const app = createApp();

    const patchResponse = await request(app)
      .patch('/api/v1/bookkeeping/status')
      .send({
        summary: {
          total: 4,
          pending: 1,
          completed: 1,
        },
        exceptions: [{ id: 'exc-1', message: 'NAV mismatch' }],
        timestamp: '2026-03-28T20:00:00.000Z',
        source: 'n8n',
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.success).toBe(true);
    expect(patchResponse.body.snapshot.summary).toMatchObject({ total: 4, pending: 1, completed: 1 });

    const raw = await fs.readFile(statusPath, 'utf-8');
    const stored = JSON.parse(raw) as { source: string; exceptions: unknown[]; summary: Record<string, unknown> };
    expect(stored.source).toBe('n8n');
    expect(stored.exceptions).toHaveLength(1);

    const getResponse = await request(app).get('/api/v1/bookkeeping/status');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.snapshot).toMatchObject({
      source: 'n8n',
      timestamp: '2026-03-28T20:00:00.000Z',
    });
  });

  it('GET /cash-entries supports filters and pagination', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/bookkeeping/cash-entries?status=PENDING_MATCH&limit=1&offset=0');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].id).toBe('bank_1');
  });

  it('GET /cash-entries/:id returns a single transaction', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/bookkeeping/cash-entries/nav_1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.id).toBe('nav_1');
    expect(res.body.entry.matchedInvoice).toBe('INV-1');
  });

  it('PATCH /transactions/:id updates status and matched invoice', async () => {
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/bookkeeping/transactions/bank_1')
      .send({ status: 'COMPLETED', matchedInvoice: 'INV-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.status).toBe('COMPLETED');
    expect(res.body.transaction.matchedInvoice).toBe('INV-1');
  });

  it('POST /reconcile delegates to MatchingAgent', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/bookkeeping/reconcile')
      .send({ task: 'Reconcile the current bookkeeping batch' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(delegateMock).toHaveBeenCalledWith(
      'MatchingAgent',
      'Reconcile the current bookkeeping batch',
      undefined,
    );
  });
});
