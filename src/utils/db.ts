import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/index.js';

const dbPath = path.join(config.systemLogDir, 'brunella.db');
const db = new Database(dbPath);

export interface DbMessage {
    role: string;
    content: string;
    is_log: number;
    timestamp: string;
}

// Initialize Tables
export function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
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

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_description TEXT,
            result_code TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export function saveMessage(chatId: string, role: string, content: string, isLog: boolean = false) {
    const stmt = db.prepare('INSERT INTO messages (chat_id, role, content, is_log) VALUES (?, ?, ?, ?)');
    stmt.run(chatId, role, content, isLog ? 1 : 0);
}

export function getMessages(chatId: string): DbMessage[] {
    const stmt = db.prepare('SELECT role, content, is_log, timestamp FROM messages WHERE chat_id = ? ORDER BY timestamp ASC');
    return stmt.all(chatId) as DbMessage[];
}

export function createChat(id: string, title: string) {
    const stmt = db.prepare('INSERT OR IGNORE INTO chats (id, title) VALUES (?, ?)');
    stmt.run(id, title);
}

export default db;