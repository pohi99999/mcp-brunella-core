import { config } from '../config/index.js';
import { logWarn } from './logger.js';

let db: any = null;
let path: any = null;
let fs: any = null;

export interface DbMessage {
    role: string;
    content: string;
    is_log: number;
    timestamp: string;
}

export interface DbPullRequest {
    id: number;
    pr_number: number;
    github_id: number;
    title: string;
    owner: string;
    repo: string;
    branch: string;
    state: string;
    action: string;
    created_at: string;
    updated_at: string;
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
    } catch (e: any) {
        logWarn('System', `Failed to initialize SQLite database: ${e.message}`);
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

    database.exec(`
        CREATE TABLE IF NOT EXISTS pull_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pr_number INTEGER,
            github_id INTEGER,
            title TEXT,
            owner TEXT,
            repo TEXT,
            branch TEXT,
            state TEXT,
            action TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    try {
        database.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_unique ON pull_requests (owner, repo, pr_number)
        `);
    } catch (e) {
        // Ignore if index already exists or other error, table creation is main goal
    }
}

// Public API - Async wrappers

export async function initDb() {
    await getDb();
}

export async function saveMessage(chatId: string, role: string, content: string, isLog: boolean = false) {
    const database = await getDb();
    if (!database) return;

    const stmtChat = database.prepare('INSERT OR IGNORE INTO chats (id) VALUES (?)');
    stmtChat.run(chatId);

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

export async function saveTask(task: { agent_name: string, description: string, context?: string, parent_id?: number }) {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('INSERT INTO tasks (agent_name, description, context, parent_id) VALUES (?, ?, ?, ?)');
    const result = stmt.run(task.agent_name, task.description, task.context || null, task.parent_id || null);
    return result.lastInsertRowid;
}

export async function updateTaskStatus(id: number | bigint, status: string, result?: string) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare('UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, result || null, id);
}

export async function getTasks(limit: number = 50, offset: number = 0) {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
}

export async function getTaskCount() {
    const database = await getDb();
    if (!database) return 0;

    const stmt = database.prepare('SELECT COUNT(*) as count FROM tasks');
    return (stmt.get() as any).count;
}

export async function savePullRequest(pr: {
    pr_number: number,
    github_id: number,
    title: string,
    owner: string,
    repo: string,
    branch: string,
    state: string,
    action: string
}) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare(`
        INSERT INTO pull_requests (pr_number, github_id, title, owner, repo, branch, state, action, updated_at)
        VALUES (@pr_number, @github_id, @title, @owner, @repo, @branch, @state, @action, CURRENT_TIMESTAMP)
        ON CONFLICT(owner, repo, pr_number) DO UPDATE SET
            title = excluded.title,
            github_id = excluded.github_id,
            branch = excluded.branch,
            state = excluded.state,
            action = excluded.action,
            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(pr);
}

export async function getPullRequest(owner: string, repo: string, prNumber: number): Promise<DbPullRequest | null> {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('SELECT * FROM pull_requests WHERE owner = ? AND repo = ? AND pr_number = ?');
    return stmt.get(owner, repo, prNumber) as DbPullRequest || null;
}
