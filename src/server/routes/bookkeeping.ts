import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import {
  createCashEntry,
  getAllTransactions,
  getCashEntries,
  getCashEntry as getCashEntryById,
  getCashSummary,
  getExceptionCount,
  getPendingTransactions,
  getReconciliationEvents,
  getTransaction,
  updateTransaction,
  updateCashEntry,
} from '../../data/bookkeeping_db.js';
import { buildBookkeepingReadinessReport } from '../../utils/bookkeepingReadiness.js';
import { logError, logInfo } from '../../utils/logger.js';
import {
  readBookkeepingStatusSnapshot,
  writeBookkeepingStatusSnapshot,
} from './bookkeepingStatusSnapshot.js';
import type {
  BookkeepingTransaction,
  CashEntry,
  CashEntryInput,
  CashEntrySource,
  CashEntrySummary,
  CashEntryType,
  TransactionStatus,
} from '../../types/bookkeeping.d.js';
import type { BookkeepingStatusSnapshot } from './bookkeepingStatusSnapshot.js';

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

function isCashEntryType(value: unknown): value is CashEntryType {
  return value === 'KP_IN' || value === 'KP_OUT';
}

function isCashEntrySource(value: unknown): value is CashEntrySource {
  return value === 'manual' || value === 'email' || value === 'import';
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function getPositiveInteger(value: unknown, fallback: number, max = 500): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(Math.trunc(parsed), max);
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

function parseCashEntryInput(body: Record<string, unknown>): CashEntryInput | null {
  const date = getOptionalString(body.date);
  const description = getOptionalString(body.description);
  const type = getOptionalString(body.type);
  const amount = Number(body.amount);
  const invoiceNumber = getOptionalString(body.invoice_number ?? body.invoiceNumber);
  const source = getOptionalString(body.source);
  const syncedSheets = getBooleanLike(body.synced_sheets ?? body.syncedSheets);

  if (!date || !description || !isCashEntryType(type) || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  if (source !== undefined && !isCashEntrySource(source)) {
    return null;
  }

  return {
    date,
    type,
    amount,
    description,
    ...(invoiceNumber ? { invoiceNumber } : {}),
    ...(source ? { source } : {}),
    ...(typeof syncedSheets === 'boolean' ? { syncedSheets } : {}),
  };
}

function parseCashEntryUpdate(body: Record<string, unknown>): Partial<CashEntryInput> {
  const updates: Partial<CashEntryInput> = {};

  if (body.date !== undefined) {
    const date = getOptionalString(body.date);
    if (!date) {
      throw new Error('date is required');
    }
    updates.date = date;
  }

  if (body.type !== undefined) {
    const type = getOptionalString(body.type);
    if (!isCashEntryType(type)) {
      throw new Error(`Invalid cash entry type: ${String(body.type)}`);
    }
    updates.type = type;
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('amount must be a positive number');
    }
    updates.amount = amount;
  }

  if (body.description !== undefined) {
    const description = getOptionalString(body.description);
    if (!description) {
      throw new Error('description is required');
    }
    updates.description = description;
  }

  if (body.invoice_number !== undefined || body.invoiceNumber !== undefined) {
    const invoiceNumber = getOptionalString(body.invoice_number ?? body.invoiceNumber);
    updates.invoiceNumber = invoiceNumber;
  }

  if (body.source !== undefined) {
    const source = getOptionalString(body.source);
    if (!isCashEntrySource(source)) {
      throw new Error(`Invalid cash entry source: ${String(body.source)}`);
    }
    updates.source = source;
  }

  if (body.synced_sheets !== undefined || body.syncedSheets !== undefined) {
    const syncedSheets = getBooleanLike(body.synced_sheets ?? body.syncedSheets);
    if (typeof syncedSheets !== 'boolean') {
      throw new Error('synced_sheets must be boolean-like');
    }
    updates.syncedSheets = syncedSheets;
  }

  return updates;
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
      const snapshot = await readBookkeepingStatusSnapshot();
      const readiness = buildBookkeepingReadinessReport();

      res.json({
        success: true,
        summary,
        pendingTransactions: getPendingTransactions().length,
        snapshot,
        readiness,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read bookkeeping status: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/readiness', (_req, res) => {
    try {
      const readiness = buildBookkeepingReadinessReport();
      res.json({ success: true, ...readiness });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to build bookkeeping readiness report: ${message}`);
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

      const snapshot: BookkeepingStatusSnapshot = {
        summary,
        exceptions: exceptions.filter(isRecord),
        timestamp,
        updatedAt: new Date().toISOString(),
        source: source === 'dashboard' || source === 'api' ? source : 'n8n',
      };

      await writeBookkeepingStatusSnapshot(snapshot);
      logInfo('BookkeepingRoutes', 'Stored bookkeeping status snapshot');

      res.json({ success: true, snapshot });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to store bookkeeping status: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/transactions', (_req, res) => {
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
      logError('BookkeepingRoutes', `Failed to list bookkeeping transactions: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/transactions/:id', (req, res) => {
    try {
      const entry = getTransaction(req.params.id);
      if (!entry) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      res.json({ success: true, entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read bookkeeping transaction ${req.params.id}: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/cash-entries', (_req, res) => {
    try {
      const dateFrom = getOptionalString(_req.query.date_from ?? _req.query.dateFrom);
      const dateTo = getOptionalString(_req.query.date_to ?? _req.query.dateTo);
      const typeRaw = getOptionalString(_req.query.type);
      const syncedRaw = _req.query.synced_sheets ?? _req.query.syncedSheets;
      const syncedSheets = syncedRaw === undefined ? undefined : getBooleanLike(syncedRaw);
      const limit = getPositiveInteger(_req.query.limit, 100);
      const offset = getPositiveInteger(_req.query.offset, 0);

      if (typeRaw && !isCashEntryType(typeRaw)) {
        res.status(400).json({ success: false, error: `Invalid cash entry type: ${typeRaw}` });
        return;
      }

      if (syncedRaw !== undefined && typeof syncedSheets !== 'boolean') {
        res.status(400).json({ success: false, error: 'synced_sheets must be boolean-like' });
        return;
      }

      const filters = {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(typeRaw ? { type: typeRaw as CashEntryType } : {}),
        ...(typeof syncedSheets === 'boolean' ? { syncedSheets } : {}),
      };

      const allEntries: CashEntry[] = getCashEntries(filters);
      const entries = allEntries.slice(offset, offset + limit);

      res.json({
        success: true,
        entries,
        total: allEntries.length,
        offset,
        limit,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to list cash entries: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/cash-entries', (req, res) => {
    try {
      const body: unknown = req.body;
      if (!isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      const input = parseCashEntryInput(body);
      if (!input) {
        res.status(400).json({ success: false, error: 'Invalid cash entry payload' });
        return;
      }

      const entry = createCashEntry(input);
      res.status(201).json({ success: true, entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to create cash entry: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/cash-entries/:id', (req, res) => {
    try {
      const entry = getCashEntryById(req.params.id);
      if (!entry) {
        res.status(404).json({ success: false, error: 'Cash entry not found' });
        return;
      }

      res.json({ success: true, entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read cash entry ${req.params.id}: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.patch('/cash-entries/:id', (req, res) => {
    try {
      const body: unknown = req.body;
      if (!isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      let updates: Partial<CashEntryInput>;
      try {
        updates = parseCashEntryUpdate(body);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(400).json({ success: false, error: message });
        return;
      }

      const updated = updateCashEntry(req.params.id, updates);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Cash entry not found' });
        return;
      }

      res.json({ success: true, entry: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to update cash entry ${req.params.id}: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/cash-summary', (_req, res) => {
    try {
      const dateFrom = getOptionalString(_req.query.date_from ?? _req.query.dateFrom);
      const dateTo = getOptionalString(_req.query.date_to ?? _req.query.dateTo);
      const typeRaw = getOptionalString(_req.query.type);
      const syncedRaw = _req.query.synced_sheets ?? _req.query.syncedSheets;
      const syncedSheets = syncedRaw === undefined ? undefined : getBooleanLike(syncedRaw);

      if (typeRaw && !isCashEntryType(typeRaw)) {
        res.status(400).json({ success: false, error: `Invalid cash entry type: ${typeRaw}` });
        return;
      }

      if (syncedRaw !== undefined && typeof syncedSheets !== 'boolean') {
        res.status(400).json({ success: false, error: 'synced_sheets must be boolean-like' });
        return;
      }

      const filters = {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(typeRaw ? { type: typeRaw as CashEntryType } : {}),
        ...(typeof syncedSheets === 'boolean' ? { syncedSheets } : {}),
      };

      const summary: CashEntrySummary = getCashSummary(filters);
      res.json({ success: true, summary, timestamp: new Date().toISOString() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to read cash summary: ${message}`);
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
  /**
   * GET /api/v1/bookkeeping/reconciliation-events
   * Returns reconciliation events, optionally filtered by run_id.
   *
   * Query params:
   *  - run_id: filter to a specific agent run
   *  - limit:  max rows to return (default 200)
   */
  router.get('/reconciliation-events', (req, res) => {
    try {
      const runId = typeof req.query.run_id === 'string' ? req.query.run_id : undefined;
      const limit =
        typeof req.query.limit === 'string'
          ? Math.min(parseInt(req.query.limit, 10) || 200, 500)
          : 200;

      const events = getReconciliationEvents(runId, limit);
      const exceptionCount = getExceptionCount();

      res.json({
        success: true,
        events,
        total: events.length,
        exceptionCount,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to get reconciliation events: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/summary-email', async (_req, res) => {
    try {
      const transactions = getAllTransactions();
      const summary = buildSummary(transactions);
      const exceptions = transactions.filter(t => t.status === 'UNMATCHED' || t.status === 'ERROR');

      const { sendNotificationEmail, isNotificationEmailConfigured } = await import('../../utils/notificationService.js');

      if (!isNotificationEmailConfigured()) {
        res.status(503).json({ success: false, error: 'Email service not configured' });
        return;
      }

      const html = `
        <h2>Brunella Könyvelési Összefoglaló</h2>
        <p><strong>Dátum:</strong> ${new Date().toLocaleDateString('hu-HU')}</p>
        <p><strong>Összes tranzakció:</strong> ${summary.total}</p>
        <p><strong>Sikeresen párosítva:</strong> ${summary.completed}</p>
        <p><strong>Kivételek (beavatkozást igényel):</strong> ${exceptions.length}</p>
        <hr/>
        <h3>Kivételek listája:</h3>
        <ul>
          ${exceptions.slice(0, 10).map(e => `<li>${(e.data as any).partner || 'Ismeretlen'} - ${(e.data as any).amount} HUF (${e.status})</li>`).join('')}
        </ul>
        ${exceptions.length > 10 ? `<p>... és további ${exceptions.length - 10} tétel.</p>` : ''}
      `;

      await sendNotificationEmail({
        subject: `Brunella Könyvelési Összefoglaló - ${exceptions.length} kivétel`,
        text: `Összesen ${summary.total} tranzakcióból ${exceptions.length} igényel kézi ellenőrzést.`,
        html
      });

      res.json({ success: true, message: 'Summary email sent' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BookkeepingRoutes', `Failed to send summary email: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
