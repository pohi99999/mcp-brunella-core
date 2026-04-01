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

    // RobotkezV2 Background Tasks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS robotkez_background_tasks (
            id TEXT PRIMARY KEY,
            instruction TEXT NOT NULL,
            plan TEXT NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            steps TEXT,
            current_step_index INTEGER DEFAULT 0,
            error TEXT,
            checkpoints TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create index for faster status queries
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_robotkez_status
        ON robotkez_background_tasks(status)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_robotkez_started_at
        ON robotkez_background_tasks(started_at DESC)
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

/**
 * Loads unfinished tasks (pending + running) for queue rehydration on startup.
 * Running tasks are reset to pending by the caller after recovery.
 */
export async function loadQueuedTasksForHydration(): Promise<TaskRow[]> {
    const database = await getDb();
    if (!database) return [];
    const stmt = database.prepare(
        "SELECT * FROM tasks WHERE status IN ('pending', 'running') ORDER BY id ASC"
    );
    return stmt.all() as TaskRow[];
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

// ============================================================
// RobotkezV2 Background Tasks Persistence (Phase 4.2)
// ============================================================

/**
 * BackgroundTask interface (from backgroundTaskManager.ts)
 * Replicated here to avoid circular imports
 */
interface BackgroundTaskRow {
    id: string;
    instruction: string;
    plan: string; // JSON
    status: string;
    progress: number;
    started_at: number;
    completed_at?: number | null;
    steps: string; // JSON
    current_step_index: number;
    error?: string | null;
    checkpoints: string; // JSON
}

/**
 * Save a new background task to database
 *
 * @param task - BackgroundTask object
 */
export async function saveBackgroundTask(task: {
    id: string;
    instruction: string;
    plan: any;
    status: string;
    progress: number;
    startedAt: number;
    completedAt?: number;
    steps: any[];
    currentStepIndex: number;
    error?: string;
    checkpoints: any[];
}): Promise<void> {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare(`
        INSERT INTO robotkez_background_tasks (
            id, instruction, plan, status, progress, started_at, completed_at,
            steps, current_step_index, error, checkpoints
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        task.id,
        task.instruction,
        JSON.stringify(task.plan),
        task.status,
        task.progress,
        task.startedAt,
        task.completedAt || null,
        JSON.stringify(task.steps),
        task.currentStepIndex,
        task.error || null,
        JSON.stringify(task.checkpoints)
    );
}

/**
 * Update an existing background task
 *
 * @param task - BackgroundTask object with updated fields
 */
export async function updateBackgroundTask(task: {
    id: string;
    status: string;
    progress: number;
    completedAt?: number;
    steps: any[];
    currentStepIndex: number;
    error?: string;
    checkpoints: any[];
}): Promise<void> {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare(`
        UPDATE robotkez_background_tasks
        SET status = ?, progress = ?, completed_at = ?, steps = ?,
            current_step_index = ?, error = ?, checkpoints = ?
        WHERE id = ?
    `);

    stmt.run(
        task.status,
        task.progress,
        task.completedAt || null,
        JSON.stringify(task.steps),
        task.currentStepIndex,
        task.error || null,
        JSON.stringify(task.checkpoints),
        task.id
    );
}

/**
 * Load a background task by ID
 *
 * @param id - Task ID
 * @returns BackgroundTask object or null
 */
export async function loadBackgroundTask(id: string): Promise<any | null> {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('SELECT * FROM robotkez_background_tasks WHERE id = ?');
    const row = stmt.get(id) as BackgroundTaskRow | undefined;

    if (!row) return null;

    return {
        id: row.id,
        instruction: row.instruction,
        plan: JSON.parse(row.plan),
        status: row.status,
        progress: row.progress,
        startedAt: row.started_at,
        completedAt: row.completed_at || undefined,
        steps: JSON.parse(row.steps),
        currentStepIndex: row.current_step_index,
        error: row.error || undefined,
        checkpoints: JSON.parse(row.checkpoints)
    };
}

/**
 * Load all background tasks (sorted by started_at desc)
 *
 * @param limit - Max tasks to return (default: 50)
 * @param status - Filter by status (optional)
 * @returns Array of BackgroundTask objects
 */
export async function loadAllBackgroundTasks(limit: number = 50, status?: string): Promise<any[]> {
    const database = await getDb();
    if (!database) return [];

    let stmt;
    let rows: BackgroundTaskRow[];

    if (status) {
        stmt = database.prepare('SELECT * FROM robotkez_background_tasks WHERE status = ? ORDER BY started_at DESC LIMIT ?');
        rows = stmt.all(status, limit) as BackgroundTaskRow[];
    } else {
        stmt = database.prepare('SELECT * FROM robotkez_background_tasks ORDER BY started_at DESC LIMIT ?');
        rows = stmt.all(limit) as BackgroundTaskRow[];
    }

    return rows.map(row => ({
        id: row.id,
        instruction: row.instruction,
        plan: JSON.parse(row.plan),
        status: row.status,
        progress: row.progress,
        startedAt: row.started_at,
        completedAt: row.completed_at || undefined,
        steps: JSON.parse(row.steps),
        currentStepIndex: row.current_step_index,
        error: row.error || undefined,
        checkpoints: JSON.parse(row.checkpoints)
    }));
}

/**
 * Delete a background task by ID
 *
 * @param id - Task ID
 */
export async function deleteBackgroundTask(id: string): Promise<void> {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare('DELETE FROM robotkez_background_tasks WHERE id = ?');
    stmt.run(id);
}

/**
 * Get background task statistics
 *
 * @returns Stats object
 */
export async function getBackgroundTaskStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    error: number;
    cancelled: number;
    avgProgress: number;
}> {
    const database = await getDb();
    if (!database) {
        return { total: 0, running: 0, completed: 0, error: 0, cancelled: 0, avgProgress: 0 };
    }

    const counts = database.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            AVG(progress) as avgProgress
        FROM robotkez_background_tasks
    `).get() as any;

    return {
        total: counts.total || 0,
        running: counts.running || 0,
        completed: counts.completed || 0,
        error: counts.error || 0,
        cancelled: counts.cancelled || 0,
        avgProgress: Math.round(counts.avgProgress || 0)
    };
}
