import DatabaseConstructor, { Database } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { logError } from '../utils/logger.js';
import { BookkeepingTransaction, BankTransactionData, NavInvoiceData } from '../types/bookkeeping.d.js';

let db: Database | null = null; // better-sqlite3 Database instance
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
        )
    `);
    dbPath = dbFilePath;
    return db;
}

function ensureDB(dbFilePath: string = dbPath ?? DEFAULT_DB_PATH): Database {
    if (db && dbPath === dbFilePath) {
        return db;
    }

    if (db && dbPath !== dbFilePath) {
        return openDB(dbFilePath);
    }

    return openDB(dbFilePath);
}

export function initDB(dbPath: string = 'data/bookkeeping.db') {
    try {
        openDB(dbPath);
    } catch (error) {
        logError("bookkeeping_db", "Failed to initialize database:", error);
        throw error;
    }
}

export function saveTransaction(tx: BookkeepingTransaction) {
    try {
        const database = ensureDB();
        const stmt = database.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status, matchedInvoice) VALUES (?, ?, ?, ?, ?)');
        stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status, tx.matchedInvoice || null);
    } catch (error) {
        logError("bookkeeping_db", `Failed to save transaction: ${tx.id}`, error);
        throw error;
    }
}

export function getTransaction(id: string): BookkeepingTransaction | null {
    try {
        const database = ensureDB();
        const stmt = database.prepare('SELECT * FROM transactions WHERE id = ?');
        const row = stmt.get(id) as Record<string, unknown> | null;
        if (!row) return null;
        return {
            id: String(row.id),
            source: String(row.source),
            data: JSON.parse(String(row.data)) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice ? String(row.matchedInvoice) : undefined
        };
    } catch (error) {
        logError("bookkeeping_db", `Failed to get transaction: ${id}`, error);
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
        const rows = database.prepare(query).all(...params) as Record<string, unknown>[];
        return rows.map(row => ({
            id: String(row.id),
            source: String(row.source),
            data: JSON.parse(String(row.data)) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice ? String(row.matchedInvoice) : undefined
        }));
    } catch (error) {
        logError("bookkeeping_db", "Failed to get pending transactions:", error);
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

        if (setClauses.length === 0) return; // Nothing to update

        const query = `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`;
        params.push(id);

        database.prepare(query).run(...params);
    } catch (error) {
        logError("bookkeeping_db", `Failed to update transaction: ${id}`, error);
        throw error;
    }
}

export function getAllTransactions(): BookkeepingTransaction[] {
    try {
        const database = ensureDB();
        const rows = database.prepare('SELECT * FROM transactions').all() as Record<string, unknown>[];
        return rows.map(row => ({
            id: String(row.id),
            source: String(row.source),
            data: JSON.parse(String(row.data)) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice ? String(row.matchedInvoice) : undefined
        }));
    } catch (error) {
        logError("bookkeeping_db", "Failed to get all transactions:", error);
        throw error;
    }
}
