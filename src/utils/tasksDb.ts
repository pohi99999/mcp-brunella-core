let db: any = null;
let path: any = null;
let fs: any = null;

interface TaskRow {
    id: number;
    agent: string;
    task: string;
    status: string;
    context?: string | null;
    result?: string | null;
    created_at: string;
    completed_at?: string | null;
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
    if (!path || !fs) return null;

    const dbPath = path.join(process.cwd(), 'data', 'tasks.db');

    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const Database = (await import('better-sqlite3')).default;
    db = new Database(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent TEXT,
            task TEXT,
            status TEXT DEFAULT 'pending',
            context TEXT,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        )
    `);

    return db;
}

export async function initTasksDb() {
    await getDb();
}

export async function saveTask(task: { agent: string; task: string; context?: string | null }) {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('INSERT INTO tasks (agent, task, context) VALUES (?, ?, ?)');
    const result = stmt.run(task.agent, task.task, task.context || null);
    return result.lastInsertRowid as number;
}

export async function updateTaskStatus(id: number | bigint, status: string, result?: string) {
    const database = await getDb();
    if (!database) return;

    const isFinal = ['done', 'error', 'cancelled'].includes(status);
    const completedAt = isFinal ? new Date().toISOString() : null;
    const stmt = database.prepare('UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?');
    stmt.run(status, result || null, completedAt, id);
}

export async function getTasks(limit: number = 20, offset: number = 0, status?: string): Promise<TaskRow[]> {
    const database = await getDb();
    if (!database) return [];

    if (status) {
        const stmt = database.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
        return stmt.all(status, limit, offset) as TaskRow[];
    }

    const stmt = database.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as TaskRow[];
}

export async function getTaskCount(status?: string): Promise<number> {
    const database = await getDb();
    if (!database) return 0;

    if (status) {
        const stmt = database.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?');
        return (stmt.get(status) as any).count;
    }

    const stmt = database.prepare('SELECT COUNT(*) as count FROM tasks');
    return (stmt.get() as any).count;
}

export async function getTaskById(id: number): Promise<TaskRow | null> {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('SELECT * FROM tasks WHERE id = ?');
    return (stmt.get(id) as TaskRow) || null;
}

export async function getTaskStats(): Promise<{
    total: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    runningCount: number;
    cancelledCount: number;
    successRate: number;
    avgDurationMs: number;
    failedByAgent: Array<{ agent: string; count: number }>;
}> {
    const database = await getDb();
    if (!database) {
        return {
            total: 0,
            successCount: 0,
            errorCount: 0,
            pendingCount: 0,
            runningCount: 0,
            cancelledCount: 0,
            successRate: 0,
            avgDurationMs: 0,
            failedByAgent: []
        };
    }

    const counts = database.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as successCount,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningCount,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledCount,
            AVG(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at) - julianday(created_at)) * 86400000 ELSE NULL END) as avgDurationMs
        FROM tasks
    `).get() as any;

    const failedByAgent = database.prepare(`
        SELECT agent, COUNT(*) as count
        FROM tasks
        WHERE status = 'error'
        GROUP BY agent
        ORDER BY count DESC
    `).all() as Array<{ agent: string; count: number }>;

    const total = counts.total || 0;
    const successCount = counts.successCount || 0;
    const errorCount = counts.errorCount || 0;
    const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

    return {
        total,
        successCount,
        errorCount,
        pendingCount: counts.pendingCount || 0,
        runningCount: counts.runningCount || 0,
        cancelledCount: counts.cancelledCount || 0,
        successRate,
        avgDurationMs: Math.round(counts.avgDurationMs || 0),
        failedByAgent
    };
}
