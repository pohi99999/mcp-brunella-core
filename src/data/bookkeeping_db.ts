// src/data/bookkeeping_db.ts
import Database from 'better-sqlite3';

let db: any;

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

export function saveTransaction(tx: any) {
    const stmt = db.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status) VALUES (?, ?, ?, ?)');
    stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status);
}

export function getTransaction(id: string) {
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
        id: row.id,
        source: row.source,
        data: JSON.parse(row.data),
        status: row.status
    };
}
