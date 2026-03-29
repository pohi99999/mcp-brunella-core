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
  NavInvoiceData,
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

function toTransaction(row: TransactionRow): BookkeepingTransaction {
  return {
    id: row.id,
    source: row.source,
    data: JSON.parse(row.data) as BankTransactionData | NavInvoiceData,
    status: row.status as BookkeepingTransaction['status'],
    matchedInvoice: row.matchedInvoice ?? undefined,
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
