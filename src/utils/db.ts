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

        // Dynamically import better-sqlite3 using module.createRequire if available
        // or a dynamic import that bundlers might ignore or handle gracefully
        let Database;
        try {
            // Using a template literal for import sometimes fools simple static analysis
            const moduleName = 'better-sqlite3';
            const imported = await import(moduleName);
            Database = imported.default || imported;
        } catch (e) {
            console.warn("Could not import better-sqlite3:", e);
            return null;
        }

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

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

export interface DbTask {
    id: number;
    parent_id?: number;
    agent_name: string;
    description: string;
    context: string; // JSON string
    status: string;
    result?: string; // JSON string
    created_at: string;
    updated_at: string;
}

export async function saveTask(agentName: string, description: string, context: any, parentId?: number): Promise<number | null> {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('INSERT INTO tasks (agent_name, description, context, parent_id) VALUES (?, ?, ?, ?)');
    const result = stmt.run(agentName, description, JSON.stringify(context), parentId || null);
    // @ts-ignore
    return result.lastInsertRowid as number;
}

export async function updateTask(id: number, updates: { status?: string, result?: any, context?: any }): Promise<boolean> {
    const database = await getDb();
    if (!database) return false;

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
        sets.push('status = ?');
        values.push(updates.status);
    }
    if (updates.result !== undefined) {
        sets.push('result = ?');
        values.push(JSON.stringify(updates.result));
    }
    if (updates.context !== undefined) {
        sets.push('context = ?');
        values.push(JSON.stringify(updates.context));
    }

    // Always update timestamp
    sets.push('updated_at = CURRENT_TIMESTAMP');

    values.push(id);
    const sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`;

    const stmt = database.prepare(sql);
    const info = stmt.run(...values);
    return info.changes > 0;
}

export async function getPendingTasks(agentName: string, statuses?: string[]): Promise<DbTask[]> {
    const database = await getDb();
    if (!database) return [];

    if (statuses && statuses.length > 0) {
        const placeholders = statuses.map(() => '?').join(', ');
        const stmt = database.prepare(
            `SELECT * FROM tasks WHERE agent_name = ? AND status IN (${placeholders}) ORDER BY created_at ASC`,
        );
        return stmt.all(agentName, ...statuses) as DbTask[];
    }

    const stmt = database.prepare(
        "SELECT * FROM tasks WHERE agent_name = ? AND status NOT IN ('completed', 'failed') ORDER BY created_at ASC",
    );
    return stmt.all(agentName) as DbTask[];
}

export async function getTask(id: number): Promise<DbTask | null> {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id) as DbTask || null;
}
