import { config } from '../config/index.js';

let db: any = null;
let path: any = null;
let fs: any = null;

export interface DbMessage {
    role: string;
    content: string;
    is_log: number;
    timestamp: string;
}

async function ensureDeps() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!path) path = await import('path');
        if (!fs) fs = await import('fs');
    }
}

async function getDb() {
    if (db) return db;

    await ensureDeps();

    // If not in Node or imports failed, return null
    if (!path || !fs) return null;

    try {
        if (!fs.existsSync(config.systemLogDir)) {
            fs.mkdirSync(config.systemLogDir, { recursive: true });
        }

        const dbPath = path.join(config.systemLogDir, 'brunella.db');
        // console.log('DEBUG: DB Path:', dbPath); // Optional logging

        const Database = (await import('better-sqlite3')).default;
        db = new Database(dbPath);

        // Auto-initialize tables on first load
        _initTables(db);

        return db;
    } catch (e) {
        console.warn("Failed to initialize SQLite database:", e);
        return null;
    }
}

function _initTables(database: any) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT,
            role TEXT,
            content TEXT,
            is_log INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(chat_id) REFERENCES chats(id)
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER,
            agent_name TEXT,
            description TEXT,
            context TEXT,
            status TEXT DEFAULT 'pending',
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(parent_id) REFERENCES tasks(id)
        )
    `);
}

// Public API - Async wrappers

export async function initDb() {
    await getDb();
}

export async function saveMessage(chatId: string, role: string, content: string, isLog: boolean = false) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare('INSERT INTO messages (chat_id, role, content, is_log) VALUES (?, ?, ?, ?)');
    stmt.run(chatId, role, content, isLog ? 1 : 0);
}

export async function getMessages(chatId: string): Promise<DbMessage[]> {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare('SELECT role, content, is_log, timestamp FROM messages WHERE chat_id = ? ORDER BY timestamp ASC');
    return stmt.all(chatId) as DbMessage[];
}

export async function createChat(id: string, title: string) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare('INSERT OR IGNORE INTO chats (id, title) VALUES (?, ?)');
    stmt.run(id, title);
}
