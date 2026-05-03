import DatabaseConstructor, { Database } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { logError } from '../utils/logger.js';
import type {
  BankTransactionData,
  BookkeepingTransaction,
  CashEntry,
  CashEntryInput,
  CashEntrySummary,
  CashEntrySource,
  CashEntryType,
  Invoice,
  InvoiceStatus,
  NavInvoiceData,
  ReconciliationEvent,
  ReconciliationEventInput,
} from '../types/bookkeeping.d.js';

type TransactionRow = {
  id: string;
  source: string;
  data: string;
  status: string;
  matchedInvoice: string | null;
};

type CashEntryRow = {
  id: number;
  date: string;
  type: CashEntryType;
  amount: number;
  description: string;
  invoice_number: string | null;
  source: CashEntrySource;
  synced_sheets: number;
  created_at: string;
  updated_at: string;
};

type ReconciliationEventRow = {
  id: number;
  run_id: string;
  tx_id: string;
  invoice_id: string | null;
  outcome: string;
  match_type: string | null;
  confidence: number | null;
  notes: string | null;
  created_at: string;
};

export interface CashEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: CashEntryType;
  syncedSheets?: boolean;
  limit?: number;
  offset?: number;
}

let db: Database | null = null;
let dbPath: string | null = null;
const DEFAULT_DB_PATH = 'data/bookkeeping.db';

function openDB(dbFilePath: string): Database {
  if (db) {
    db.close();
    db = null;
    dbPath = null;
  }

  mkdirSync(path.dirname(dbFilePath), { recursive: true });
  db = new DatabaseConstructor(dbFilePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL,
      matchedInvoice TEXT
    );

    CREATE TABLE IF NOT EXISTS cash_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('KP_IN', 'KP_OUT')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      invoice_number TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'email', 'import')),
      synced_sheets INTEGER NOT NULL DEFAULT 0 CHECK(synced_sheets IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reconciliation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      tx_id TEXT NOT NULL,
      invoice_id TEXT,
      outcome TEXT NOT NULL,
      match_type TEXT,
      confidence INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      gmail_message_id TEXT UNIQUE,
      partner_name TEXT,
      invoice_number TEXT,
      amount REAL,
      currency TEXT,
      date TEXT,
      due_date TEXT,
      drive_file_id TEXT,
      sheets_row INTEGER,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recon_events_run_id ON reconciliation_events (run_id);
    CREATE INDEX IF NOT EXISTS idx_recon_events_tx_id  ON reconciliation_events (tx_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_gmail_id ON invoices (gmail_message_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
  `);
  dbPath = dbFilePath;
  return db;
}

function ensureDB(dbFilePath: string = dbPath ?? DEFAULT_DB_PATH): Database {
  if (db && dbPath === dbFilePath) {
    return db;
  }

  return openDB(dbFilePath);
}

interface InvoiceRow {
  id: string;
  gmail_message_id: string | null;
  partner_name: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  due_date: string | null;
  drive_file_id: string | null;
  sheets_row: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

type InvoiceUpsertInput = Pick<Invoice, 'id' | 'status'> &
  Partial<Omit<Invoice, 'id' | 'status' | 'createdAt' | 'updatedAt'>>;

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    gmailMessageId: row.gmail_message_id ?? undefined,
    partnerName: row.partner_name ?? undefined,
    invoiceNumber: row.invoice_number ?? undefined,
    amount: row.amount !== null ? Number(row.amount) : undefined,
    currency: row.currency ?? undefined,
    date: row.date ?? undefined,
    dueDate: row.due_date ?? undefined,
    driveFileId: row.drive_file_id ?? undefined,
    sheetsRow: row.sheets_row !== null ? Number(row.sheets_row) : undefined,
    status: row.status as InvoiceStatus,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTransaction(row: TransactionRow): BookkeepingTransaction {
  return {
    id: row.id,
    source: row.source,
    data: JSON.parse(row.data) as BankTransactionData | NavInvoiceData,
    status: row.status as BookkeepingTransaction['status'],
    matchedInvoice: row.matchedInvoice ?? undefined,
  };
}

function toReconciliationEvent(row: ReconciliationEventRow): ReconciliationEvent {
  return {
    id: Number(row.id),
    runId: String(row.run_id),
    txId: String(row.tx_id),
    invoiceId: row.invoice_id ? String(row.invoice_id) : undefined,
    outcome: row.outcome as ReconciliationEvent['outcome'],
    matchType: row.match_type ? (row.match_type as ReconciliationEvent['matchType']) : undefined,
    confidence: row.confidence !== null ? Number(row.confidence) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
  };
}

function toCashEntry(row: CashEntryRow): CashEntry {
  return {
    id: Number(row.id),
    date: String(row.date),
    type: row.type as CashEntryType,
    amount: Number(row.amount),
    description: String(row.description),
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : undefined,
    source: row.source as CashEntrySource,
    syncedSheets: Number(row.synced_sheets) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function buildCashEntryWhere(filters: CashEntryFilters = {}): { clause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.dateFrom) {
    clauses.push('date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push('date <= ?');
    params.push(filters.dateTo);
  }

  if (filters.type) {
    clauses.push('type = ?');
    params.push(filters.type);
  }

  if (typeof filters.syncedSheets === 'boolean') {
    clauses.push('synced_sheets = ?');
    params.push(filters.syncedSheets ? 1 : 0);
  }

  return {
    clause: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function initDB(dbFilePath: string = DEFAULT_DB_PATH) {
  try {
    openDB(dbFilePath);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to initialize database:', error);
    throw error;
  }
}

export function saveTransaction(tx: BookkeepingTransaction) {
  try {
    const database = ensureDB();
    const stmt = database.prepare(
      'INSERT OR REPLACE INTO transactions (id, source, data, status, matchedInvoice) VALUES (?, ?, ?, ?, ?)',
    );
    stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status, tx.matchedInvoice || null);
  } catch (error) {
    logError('bookkeeping_db', `Failed to save transaction: ${tx.id}`, error);
    throw error;
  }
}

export function getTransaction(id: string): BookkeepingTransaction | null {
  try {
    const database = ensureDB();
    const row = database.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow | undefined;
    return row ? toTransaction(row) : null;
  } catch (error) {
    logError('bookkeeping_db', `Failed to get transaction: ${id}`, error);
    throw error;
  }
}

export function getPendingTransactions(source?: string): BookkeepingTransaction[] {
  try {
    const database = ensureDB();
    let query = "SELECT * FROM transactions WHERE status = 'PENDING_MATCH'";
    const params: unknown[] = [];

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    const rows = database.prepare(query).all(...params) as TransactionRow[];
    return rows.map(toTransaction);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get pending transactions:', error);
    throw error;
  }
}

export function updateTransaction(id: string, updates: Partial<BookkeepingTransaction>) {
  try {
    const database = ensureDB();
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }

    if (updates.matchedInvoice) {
      setClauses.push('matchedInvoice = ?');
      params.push(updates.matchedInvoice);
    }

    if (setClauses.length === 0) {
      return;
    }

    params.push(id);
    database.prepare(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  } catch (error) {
    logError('bookkeeping_db', `Failed to update transaction: ${id}`, error);
    throw error;
  }
}

export function getAllTransactions(): BookkeepingTransaction[] {
  try {
    const database = ensureDB();
    const rows = database.prepare('SELECT * FROM transactions').all() as TransactionRow[];
    return rows.map(toTransaction);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get all transactions:', error);
    throw error;
  }
}

export function createCashEntry(input: CashEntryInput): CashEntry {
  try {
    const database = ensureDB();
    const result = database
      .prepare(
        `INSERT INTO cash_entries (date, type, amount, description, invoice_number, source, synced_sheets)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.date,
        input.type,
        input.amount,
        input.description.trim(),
        input.invoiceNumber?.trim() || null,
        input.source ?? 'manual',
        input.syncedSheets ? 1 : 0,
      );

    const entry = getCashEntry(Number(result.lastInsertRowid));
    if (!entry) {
      throw new Error('Failed to read back created cash entry');
    }

    return entry;
  } catch (error) {
    logError('bookkeeping_db', 'Failed to create cash entry:', error);
    throw error;
  }
}

export function getCashEntry(id: number | string): CashEntry | null {
  try {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId)) {
      return null;
    }

    const database = ensureDB();
    const row = database.prepare('SELECT * FROM cash_entries WHERE id = ?').get(parsedId) as CashEntryRow | undefined;
    return row ? toCashEntry(row) : null;
  } catch (error) {
    logError('bookkeeping_db', `Failed to get cash entry: ${id}`, error);
    throw error;
  }
}

export function getCashEntries(filters: CashEntryFilters = {}): CashEntry[] {
  try {
    const database = ensureDB();
    const { clause, params } = buildCashEntryWhere(filters);
    const query = `SELECT * FROM cash_entries${clause} ORDER BY date DESC, id DESC`;
    const rows = database.prepare(query).all(...params) as CashEntryRow[];
    return rows.map(toCashEntry);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get cash entries:', error);
    throw error;
  }
}

export function updateCashEntry(id: number | string, updates: Partial<CashEntryInput>): CashEntry | null {
  try {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId)) {
      return null;
    }

    const database = ensureDB();
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.date !== undefined) {
      setClauses.push('date = ?');
      params.push(updates.date);
    }

    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      params.push(updates.type);
    }

    if (updates.amount !== undefined) {
      setClauses.push('amount = ?');
      params.push(updates.amount);
    }

    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description.trim());
    }

    if (updates.invoiceNumber !== undefined) {
      setClauses.push('invoice_number = ?');
      params.push(updates.invoiceNumber.trim() || null);
    }

    if (updates.source !== undefined) {
      setClauses.push('source = ?');
      params.push(updates.source);
    }

    if (updates.syncedSheets !== undefined) {
      setClauses.push('synced_sheets = ?');
      params.push(updates.syncedSheets ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return getCashEntry(parsedId);
    }

    setClauses.push("updated_at = datetime('now')");
    params.push(parsedId);
    database.prepare(`UPDATE cash_entries SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    return getCashEntry(parsedId);
  } catch (error) {
    logError('bookkeeping_db', `Failed to update cash entry: ${id}`, error);
    throw error;
  }
}

export function getCashSummary(filters: CashEntryFilters = {}): CashEntrySummary {
  const entries = getCashEntries({ ...filters, limit: undefined, offset: undefined });
  const byType: Record<CashEntryType, number> = {
    KP_IN: 0,
    KP_OUT: 0,
  };

  let income = 0;
  let expense = 0;
  let syncedSheets = 0;

  for (const entry of entries) {
    byType[entry.type] += 1;
    if (entry.type === 'KP_IN') {
      income += entry.amount;
    } else {
      expense += entry.amount;
    }

    if (entry.syncedSheets) {
      syncedSheets += 1;
    }
  }

  return {
    total: entries.length,
    income,
    expense,
    balance: income - expense,
    syncedSheets,
    pendingSheets: entries.length - syncedSheets,
    byType,
  };
}

// ─── Reconciliation Events ────────────────────────────────────────────────────

/**
 * Persists a single reconciliation event produced during a MatchingAgent run.
 *
 * @param input - Event data (without generated id/createdAt).
 * @returns The fully hydrated ReconciliationEvent row.
 */
export function saveReconciliationEvent(input: ReconciliationEventInput): ReconciliationEvent {
  try {
    const database = ensureDB();
    const result = database
      .prepare(
        `INSERT INTO reconciliation_events (run_id, tx_id, invoice_id, outcome, match_type, confidence, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.runId,
        input.txId,
        input.invoiceId ?? null,
        input.outcome,
        input.matchType ?? null,
        input.confidence !== undefined ? Math.round(input.confidence) : null,
        input.notes ?? null,
      );

    const row = database
      .prepare('SELECT * FROM reconciliation_events WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ReconciliationEventRow | undefined;

    if (!row) {
      throw new Error('Failed to read back created reconciliation event');
    }

    return toReconciliationEvent(row);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to save reconciliation event:', error);
    throw error;
  }
}

/**
 * Returns reconciliation events, optionally filtered by run or transaction.
 *
 * @param runId   - If provided, restrict to a specific agent run.
 * @param limit   - Maximum rows to return (default 200).
 */
export function getReconciliationEvents(runId?: string, limit = 200): ReconciliationEvent[] {
  try {
    const database = ensureDB();
    if (runId) {
      const rows = database
        .prepare(
          'SELECT * FROM reconciliation_events WHERE run_id = ? ORDER BY id DESC LIMIT ?',
        )
        .all(runId, limit) as ReconciliationEventRow[];
      return rows.map(toReconciliationEvent);
    }

    const rows = database
      .prepare('SELECT * FROM reconciliation_events ORDER BY id DESC LIMIT ?')
      .all(limit) as ReconciliationEventRow[];
    return rows.map(toReconciliationEvent);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get reconciliation events:', error);
    throw error;
  }
}

/**
 * Returns the count of reconciliation events with exception-level outcomes
 * (UNMATCHED or ERROR) across all runs, useful for dashboard display.
 */
export function getExceptionCount(): number {
  try {
    const database = ensureDB();
    const row = database
      .prepare(
        "SELECT COUNT(*) as cnt FROM reconciliation_events WHERE outcome IN ('UNMATCHED', 'ERROR')",
      )
      .get() as { cnt: number };
    return Number(row.cnt);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get exception count:', error);
    return 0;
  }
}

// ─── Invoices (L5 Pipeline) ───────────────────────────────────────────────────

/**
 * Saves or updates an invoice in the tracking table.
 */
export function saveInvoice(invoice: InvoiceUpsertInput): void {
  try {
    const database = ensureDB();
    const now = new Date().toISOString();
    const stmt = database.prepare(`
      INSERT INTO invoices (
        id, gmail_message_id, partner_name, invoice_number, amount, 
        currency, date, due_date, drive_file_id, sheets_row, status, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        gmail_message_id = COALESCE(excluded.gmail_message_id, invoices.gmail_message_id),
        partner_name = COALESCE(excluded.partner_name, invoices.partner_name),
        invoice_number = COALESCE(excluded.invoice_number, invoices.invoice_number),
        amount = COALESCE(excluded.amount, invoices.amount),
        currency = COALESCE(excluded.currency, invoices.currency),
        date = COALESCE(excluded.date, invoices.date),
        due_date = COALESCE(excluded.due_date, invoices.due_date),
        drive_file_id = COALESCE(excluded.drive_file_id, invoices.drive_file_id),
        sheets_row = COALESCE(excluded.sheets_row, invoices.sheets_row),
        status = excluded.status,
        error_message = COALESCE(excluded.error_message, invoices.error_message),
        updated_at = excluded.updated_at
    `);

    stmt.run(
      invoice.id,
      invoice.gmailMessageId ?? null,
      invoice.partnerName ?? null,
      invoice.invoiceNumber ?? null,
      invoice.amount ?? null,
      invoice.currency ?? null,
      invoice.date ?? null,
      invoice.dueDate ?? null,
      invoice.driveFileId ?? null,
      invoice.sheetsRow ?? null,
      invoice.status,
      invoice.errorMessage ?? null,
      now
    );
  } catch (error) {
    logError('bookkeeping_db', `Failed to save invoice: ${invoice.id}`, error);
    throw error;
  }
}

/**
 * Gets an invoice by its ID.
 */
export function getInvoice(id: string): Invoice | null {
  try {
    const database = ensureDB();
    const row = database.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
    return row ? toInvoice(row) : null;
  } catch (error) {
    logError('bookkeeping_db', `Failed to get invoice: ${id}`, error);
    throw error;
  }
}

/**
 * Gets an invoice by its Gmail message ID (for idempotency).
 */
export function getInvoiceByGmailId(gmailId: string): Invoice | null {
  try {
    const database = ensureDB();
    const row = database.prepare('SELECT * FROM invoices WHERE gmail_message_id = ?').get(gmailId) as InvoiceRow | undefined;
    return row ? toInvoice(row) : null;
  } catch (error) {
    logError('bookkeeping_db', `Failed to get invoice by gmail id: ${gmailId}`, error);
    throw error;
  }
}

/**
 * Updates the status of an invoice.
 */
export function updateInvoiceStatus(id: string, status: InvoiceStatus, errorMessage?: string): void {
  try {
    const database = ensureDB();
    const now = new Date().toISOString();
    database.prepare('UPDATE invoices SET status = ?, error_message = ?, updated_at = ? WHERE id = ?')
      .run(status, errorMessage ?? null, now, id);
  } catch (error) {
    logError('bookkeeping_db', `Failed to update invoice status: ${id}`, error);
    throw error;
  }
}

/**
 * Returns all invoices, optionally limited.
 */
export function getAllInvoices(limit = 100): Invoice[] {
  try {
    const database = ensureDB();
    const rows = database.prepare('SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?').all(limit) as InvoiceRow[];
    return rows.map(toInvoice);
  } catch (error) {
    logError('bookkeeping_db', 'Failed to get all invoices:', error);
    throw error;
  }
}
