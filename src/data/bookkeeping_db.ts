import Database from 'better-sqlite3';
import { BookkeepingTransaction } from '../types/bookkeeping.d.js';

let db: Database.Database; // Use the specific Database type

export function initDB(dbPath: string = 'data/bookkeeping.db') {
    try {
        db = new Database(dbPath);
        db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                data TEXT NOT NULL,
                status TEXT NOT NULL
            )
        `);
    } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
    }
}

export function saveTransaction(tx: BookkeepingTransaction) {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status) VALUES (?, ?, ?, ?)');
        stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status);
    } catch (error) {
        console.error("Failed to save transaction:", tx.id, error);
        throw error;
    }
}

export function getTransaction(id: string): BookkeepingTransaction | null {
    try {
        const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
        const row = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id as string,
            source: row.source as string,
            data: JSON.parse(row.data as string),
            status: row.status as BookkeepingTransaction['status']
        };
    } catch (error) {
        console.error("Failed to get transaction:", id, error);
        throw error;
    }
}

export async function getPendingTransactions(source?: string): Promise<BookkeepingTransaction[]> {
    try {
        let query = 'SELECT * FROM transactions WHERE status = \'PENDING_MATCH\'';
        const params: string[] = [];
        if (source) {
            query += ' AND source = ?';
            params.push(source);
        }
        const rows = db.prepare(query).all(params);
        return rows.map((row: any) => ({
            id: row.id,
            source: row.source,
            data: JSON.parse(row.data),
            status: row.status
        }));
    } catch (error) {
        console.error("Failed to get pending transactions:", error);
        throw error;
    }
}

export async function updateTransaction(id: string, updates: Partial<BookkeepingTransaction>) {
    try {
        let setClauses: string[] = [];
        const params: (string | number)[] = [];

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

        db.prepare(query).run(params);
    } catch (error) {
        console.error("Failed to update transaction:", id, error);
        throw error;
    }
}

export async function getAllTransactions(): Promise<BookkeepingTransaction[]> {
    try {
        const rows = db.prepare('SELECT * FROM transactions').all();
        return rows.map((row: any) => ({
            id: row.id,
            source: row.source,
            data: JSON.parse(row.data),
            status: row.status
        }));
    } catch (error) {
        console.error("Failed to get all transactions:", error);
        throw error;
    }
}
