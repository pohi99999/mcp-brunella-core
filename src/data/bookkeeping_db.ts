import { BookkeepingTransaction, BankTransactionData, NavInvoiceData } from '../types/bookkeeping.d.js';
import { logError } from '../utils/logger.js';
let db: any = null; // better-sqlite3 Database instance

export function initDB(dbPath: string = 'data/bookkeeping.db') {
    try {
        const Database = require('better-sqlite3');
        db = new Database(dbPath);
        db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                data TEXT NOT NULL,
                status TEXT NOT NULL,
                matchedInvoice TEXT
            )
        `);
    } catch (error) {
        logError("bookkeeping_db", "Failed to initialize database:", error);
        throw error;
    }
}

export function saveTransaction(tx: BookkeepingTransaction) {
    try {
        if (!db) throw new Error('Database not initialized');
        const stmt = db.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status, matchedInvoice) VALUES (?, ?, ?, ?, ?)');
        stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status, tx.matchedInvoice || null);
    } catch (error) {
        logError("bookkeeping_db", `Failed to save transaction: ${tx.id}`, error);
        throw error;
    }
}

export function getTransaction(id: string): BookkeepingTransaction | null {
    try {
        if (!db) throw new Error('Database not initialized');
        const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
        const row: { id: string; source: string; data: string; status: string; matchedInvoice: string | null } = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id,
            source: row.source,
            data: JSON.parse(row.data) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice || undefined
        };
    } catch (error) {
        logError("bookkeeping_db", `Failed to get transaction: ${id}`, error);
        throw error;
    }
}

export async function getPendingTransactions(source?: string): Promise<BookkeepingTransaction[]> {
    try {
        if (!db) throw new Error('Database not initialized');
        let query = "SELECT * FROM transactions WHERE status = 'PENDING_MATCH'";
        const params: any[] = [];
        if (source) {
            query += ' AND source = ?';
            params.push(source);
        }
        const rows: { id: string; source: string; data: string; status: string; matchedInvoice: string | null }[] = db.prepare(query).all(...params);
        return rows.map(row => ({
            id: row.id,
            source: row.source,
            data: JSON.parse(row.data) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice || undefined
        }));
    } catch (error) {
        logError("bookkeeping_db", "Failed to get pending transactions:", error);
        throw error;
    }
}

export async function updateTransaction(id: string, updates: Partial<BookkeepingTransaction>) {
    try {
        if (!db) throw new Error('Database not initialized');
        let setClauses: string[] = [];
        const params: any[] = [];

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

        db.prepare(query).run(...params);
    } catch (error) {
        logError("bookkeeping_db", `Failed to update transaction: ${id}`, error);
        throw error;
    }
}

export async function getAllTransactions(): Promise<BookkeepingTransaction[]> {
    try {
        if (!db) throw new Error('Database not initialized');
        const rows: { id: string; source: string; data: string; status: string; matchedInvoice: string | null }[] = db.prepare('SELECT * FROM transactions').all();
        return rows.map(row => ({
            id: row.id,
            source: row.source,
            data: JSON.parse(row.data) as (BankTransactionData | NavInvoiceData),
            status: row.status as BookkeepingTransaction['status'],
            matchedInvoice: row.matchedInvoice || undefined
        }));
    } catch (error) {
        logError("bookkeeping_db", "Failed to get all transactions:", error);
        throw error;
    }
}
