import Database from 'better-sqlite3';
import { BookkeepingTransaction } from '../types/bookkeeping.d.js';

let db: Database.Database; // Use the specific Database type

export function initDB(dbPath: string = 'data/bookkeeping.db') {
    db = new Database(dbPath);
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            data TEXT NOT NULL,
            status TEXT NOT NULL
        )
    `);
}

export function saveTransaction(tx: BookkeepingTransaction) {
    const stmt = db.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status) VALUES (?, ?, ?, ?)');
    stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status);
}

export function getTransaction(id: string): BookkeepingTransaction | null {
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
        id: row.id as string,
        source: row.source as string,
        data: JSON.parse(row.data as string),
        status: row.status as BookkeepingTransaction['status']
    };
}

// Temporary functions for MatchingAgent
export async function getPendingTransactions(source?: string): Promise<BookkeepingTransaction[]> {
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
}

export async function updateTransaction(id: string, updates: Partial<BookkeepingTransaction>) {
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
    // Add more update fields as needed

    if (setClauses.length === 0) return; // Nothing to update

    const query = `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);

    db.prepare(query).run(params);
}

export async function getAllTransactions(): Promise<BookkeepingTransaction[]> {
    const rows = db.prepare('SELECT * FROM transactions').all();
    return rows.map((row: any) => ({
        id: row.id,
        source: row.source,
        data: JSON.parse(row.data),
        status: row.status
    }));
}
