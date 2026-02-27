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

async function ensureDeps() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!path) path = await import('path');
        if (!fs) fs = await import('fs');
    }
}

export async function getDb() {
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
        CREATE TABLE IF NOT EXISTS business_jobs (
            id TEXT PRIMARY KEY,
            type TEXT, -- e.g., 'lead_mining', 'invoice_sync'
            status TEXT DEFAULT 'pending',
            query TEXT,
            results_json TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS business_leads (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            company_name TEXT,
            contact_person TEXT,
            contact_email TEXT,
            status TEXT DEFAULT 'new', -- stages: new, outreach, responded, meeting, loi, closed, lost
            notes TEXT,
            metadata TEXT, -- stores icebreaker, value proposition, etc.
            last_interaction_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            email_status TEXT DEFAULT 'unknown', -- unknown, valid, invalid, catch-all
            demo_url TEXT,
            outreach_status TEXT DEFAULT 'pending', -- pending, sent, failed
            icebreaker_text TEXT,
            FOREIGN KEY(job_id) REFERENCES business_jobs(id)
        )
    `);

    // Simple migration: Check if new columns exist, if not add them
    const tableInfo = database.prepare("PRAGMA table_info(business_leads)").all();
    const columnNames = tableInfo.map((c: any) => c.name);
    
    if (!columnNames.includes('email_status')) {
        database.exec("ALTER TABLE business_leads ADD COLUMN email_status TEXT DEFAULT 'unknown'");
    }
    if (!columnNames.includes('demo_url')) {
        database.exec("ALTER TABLE business_leads ADD COLUMN demo_url TEXT");
    }
    if (!columnNames.includes('outreach_status')) {
        database.exec("ALTER TABLE business_leads ADD COLUMN outreach_status TEXT DEFAULT 'pending'");
    }
    if (!columnNames.includes('icebreaker_text')) {
        database.exec("ALTER TABLE business_leads ADD COLUMN icebreaker_text TEXT");
    }

    database.exec(`
        CREATE TABLE IF NOT EXISTS studio_projects (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            tech_stack TEXT, -- e.g., 'React', 'Next.js', 'Python'
            status TEXT DEFAULT 'ideation', -- stages: ideation, coding, testing, ready
            root_dir TEXT,
            preview_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// Public API - Async wrappers

export async function initDb() {
    await getDb();
}

export async function saveStudioProject(project: { id: string, name: string, description: string, tech_stack: string, root_dir: string }) {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('INSERT INTO studio_projects (id, name, description, tech_stack, root_dir) VALUES (?, ?, ?, ?, ?)');
    stmt.run(project.id, project.name, project.description, project.tech_stack, project.root_dir);
    return project.id;
}

export async function getStudioProjects() {
    const database = await getDb();
    if (!database) return [];
    return database.prepare('SELECT * FROM studio_projects ORDER BY created_at DESC').all();
}

export async function updateProjectStatus(id: string, status: string, previewUrl?: string) {
    const database = await getDb();
    if (!database) return;
    const stmt = database.prepare('UPDATE studio_projects SET status = ?, preview_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, previewUrl || null, id);
}

export async function saveBusinessLead(lead: { 
    id: string, 
    job_id: string, 
    company_name: string, 
    contact_person?: string, 
    contact_email?: string, 
    metadata?: string,
    email_status?: string,
    demo_url?: string,
    outreach_status?: string,
    icebreaker_text?: string
}) {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare(`
        INSERT INTO business_leads (
            id, job_id, company_name, contact_person, contact_email, metadata, 
            email_status, demo_url, outreach_status, icebreaker_text
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        lead.id, 
        lead.job_id, 
        lead.company_name, 
        lead.contact_person || null, 
        lead.contact_email || null, 
        lead.metadata || null,
        lead.email_status || 'unknown',
        lead.demo_url || null,
        lead.outreach_status || 'pending',
        lead.icebreaker_text || null
    );
    return lead.id;
}

export async function updateLeadStatus(id: string, status: string, notes?: string) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare(`
        UPDATE business_leads 
        SET status = ?, notes = ?, last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    stmt.run(status, notes || null, id);
}

export async function getLeadsByJob(jobId: string) {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare('SELECT * FROM business_leads WHERE job_id = ? ORDER BY created_at DESC');
    return stmt.all(jobId);
}

export async function getPipelineStats() {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare('SELECT status, COUNT(*) as count FROM business_leads GROUP BY status');
    return stmt.all();
}

export async function saveBusinessJob(job: { id: string, type: string, query: string, metadata?: string }) {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare('INSERT INTO business_jobs (id, type, query, metadata) VALUES (?, ?, ?, ?)');
    stmt.run(job.id, job.type, job.query, job.metadata || null);
    return job.id;
}

export async function getBusinessJobs(limit: number = 20, type?: string) {
    const database = await getDb();
    if (!database) return [];

    let query = 'SELECT * FROM business_jobs';
    const params: any[] = [];

    if (type) {
        query += ' WHERE type = ?';
        params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = database.prepare(query);
    return stmt.all(...params);
}

export async function updateBusinessJobStatus(id: string, status: string, resultsJson?: string) {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare('UPDATE business_jobs SET status = ?, results_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, resultsJson || null, id);

    // Feed successful jobs to the Incubator (Golden Dataset)
    if (status === 'completed' && resultsJson) {
        try {
            const jobStmt = database.prepare('SELECT type, query FROM business_jobs WHERE id = ?');
            const job = jobStmt.get(id) as any;
            if (job) {
                const url = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
                // Fire and forget
                fetch(`${url}/incubator/gold-sample`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: job.query,
                        completion: resultsJson,
                        source: job.type,
                        quality: 0.9
                    })
                }).then(res => {
                    if (res.ok) {
                        console.log(`[GoldenBridge] Sample saved to Dataset from ${job.type}`);
                    }
                }).catch(e => {
                    console.error(`[GoldenBridge] Failed to connect to Python API:`, e.message);
                });
            }
        } catch (err: any) {
            console.error(`[GoldenBridge] Error processing sample:`, err.message);
        }
    }
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
