import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { agentManager } from '../../agents/AgentManager.js';
import {
  getAllTransactions,
  getPendingTransactions,
  getTransaction,
  updateTransaction,
} from '../../data/bookkeeping_db.js';
import { logError, logInfo } from '../../utils/logger.js';
import type {
  BookkeepingTransaction,
  TransactionStatus,
} from '../../types/bookkeeping.d.js';

type BookkeepingException = Record<string, unknown>;

interface BookkeepingSummary {
  total: number;
  pending: number;
  completed: number;
  manualReview: number;
  unmatched: number;
  partiallyMatched: number;
  error: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

interface StatusSnapshot {
  summary: Record<string, unknown>;
  exceptions: BookkeepingException[];
  timestamp: string;
  updatedAt: string;
  source: 'api' | 'n8n' | 'dashboard';
}

const STATUS_VALUES: readonly TransactionStatus[] = [
  'PENDING_MATCH',
  'PARTIALLY_MATCHED',
  'COMPLETED',
  'MANUAL_REVIEW',
  'UNMATCHED',
  'ERROR',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && STATUS_VALUES.includes(value as TransactionStatus);
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getPositiveInteger(value: unknown, fallback: number, max = 500): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(Math.trunc(parsed), max);
}

function getStatusSnapshotPath(): string {
  return process.env.BOOKKEEPING_STATUS_PATH || path.join(process.cwd(), 'data', 'bookkeeping', 'status.json');
}

async function readStatusSnapshot(): Promise<StatusSnapshot | null> {
  const snapshotPath = getStatusSnapshotPath();
  try {
    const text = await fs.readFile(snapshotPath, 'utf-8');
    return JSON.parse(text) as StatusSnapshot;
  } catch (error: unknown) {
    if (isRecord(error) && typeof error.code === 'string' && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeStatusSnapshot(snapshot: StatusSnapshot): Promise<void> {
  const snapshotPath = getStatusSnapshotPath();
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

function buildSummary(transactions: BookkeepingTransaction[]): BookkeepingSummary {
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const transaction of transactions) {
    byStatus[transaction.status] = (byStatus[transaction.status] || 0) + 1;
    bySource[transaction.source] = (bySource[transaction.source] || 0) + 1;
  }

  return {
    total: transactions.length,
    pending: byStatus.PENDING_MATCH || 0,
    completed: byStatus.COMPLETED || 0,
    manualReview: byStatus.MANUAL_REVIEW || 0,
    unmatched: byStatus.UNMATCHED || 0,
    partiallyMatched: byStatus.PARTIALLY_MATCHED || 0,
    error: byStatus.ERROR || 0,
    byStatus,
    bySource,
  };
}

function isAgentSuccess(result: unknown): boolean {
  if (!isRecord(result)) {
    return true;
  }

  if (typeof result.success === 'boolean') {
    return result.success;
  }

  if (typeof result.status === 'string') {
    return result.status !== 'error';
  }

  return true;
}

function getAgentErrorMessage(result: unknown): string | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error;
  }

  if (typeof result.message === 'string' && result.message.trim()) {
    return result.message;
  }

  return undefined;
}

export function createBookkeepingRoutes(): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    try {
      const transactions = getAllTransactions();
      const summary = buildSummary(transactions);
      const snapshot = await readStatusSnapshot();

      res.json({
        success: true,
        summary,
        pendingTransactions: getPendingTransactions().length,
        snapshot,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read bookkeeping status: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.patch('/status', async (req, res) => {
    try {
      const body: unknown = req.body;
      if (!isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      const summary = body.summary;
      const exceptions = body.exceptions;
      const timestamp = getOptionalString(body.timestamp) || new Date().toISOString();
      const source = getOptionalString(body.source) || 'n8n';

      if (!isRecord(summary)) {
        res.status(400).json({ success: false, error: 'summary is required' });
        return;
      }

      if (!Array.isArray(exceptions)) {
        res.status(400).json({ success: false, error: 'exceptions must be an array' });
        return;
      }

      const snapshot: StatusSnapshot = {
        summary,
        exceptions: exceptions.filter(isRecord),
        timestamp,
        updatedAt: new Date().toISOString(),
        source: source === 'dashboard' || source === 'api' ? source : 'n8n',
      };

      await writeStatusSnapshot(snapshot);
      logInfo('BookkeepingRoutes', `Stored bookkeeping status snapshot at ${getStatusSnapshotPath()}`);

      res.json({ success: true, snapshot });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to store bookkeeping status: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/cash-entries', (_req, res) => {
    try {
      const transactions = getAllTransactions();
      const statusFilter = getOptionalString(_req.query.status);
      const sourceFilter = getOptionalString(_req.query.source);
      const limit = getPositiveInteger(_req.query.limit, 100);
      const offset = getPositiveInteger(_req.query.offset, 0);

      if (statusFilter && !isTransactionStatus(statusFilter)) {
        res.status(400).json({ success: false, error: `Invalid status filter: ${statusFilter}` });
        return;
      }

      const filtered = transactions.filter((transaction) => {
        if (statusFilter && transaction.status !== statusFilter) {
          return false;
        }
        if (sourceFilter && transaction.source !== sourceFilter) {
          return false;
        }
        return true;
      });

      res.json({
        success: true,
        entries: filtered.slice(offset, offset + limit),
        total: filtered.length,
        offset,
        limit,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to list bookkeeping entries: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/cash-entries/:id', (req, res) => {
    try {
      const entry = getTransaction(req.params.id);
      if (!entry) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      res.json({ success: true, entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read bookkeeping entry ${req.params.id}: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.patch('/transactions/:id', (req, res) => {
    try {
      const body: unknown = req.body;
      if (!isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      const status = body.status;
      const matchedInvoice = getOptionalString(body.matchedInvoice);

      if (!isTransactionStatus(status)) {
        res.status(400).json({ success: false, error: 'A valid transaction status is required' });
        return;
      }

      updateTransaction(req.params.id, {
        status,
        ...(matchedInvoice ? { matchedInvoice } : {}),
      });

      const updated = getTransaction(req.params.id);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      res.json({ success: true, transaction: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to update transaction ${req.params.id}: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/reconcile', async (req, res) => {
    try {
      const body: unknown = req.body;
      if (body !== undefined && !isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      const task = getOptionalString(isRecord(body) ? body.task : undefined) || 'Match all PENDING bank transactions';
      const contextValue = isRecord(body) ? body.context : undefined;
      const context = isRecord(contextValue) ? contextValue : undefined;

      logInfo('BookkeepingRoutes', `Triggering MatchingAgent reconciliation with task: ${task}`);
      const result = await agentManager.delegate('MatchingAgent', task, context);

      if (!isAgentSuccess(result)) {
        const message = getAgentErrorMessage(result) || 'MatchingAgent failed';
        res.status(502).json({ success: false, error: message, result });
        return;
      }

      res.json({ success: true, result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Reconcile failed: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
