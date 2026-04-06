import type Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { ensureError } from './ensureError.js';
import { logError, logInfo, logWarn } from './logger.js';

let db: Database.Database | null = null;
let pathModule: typeof import('path') | null = null;
let fsModule: typeof import('fs') | null = null;

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

interface CountRow {
  count: number;
}

interface TableInfoRow {
  name: string;
}

interface BusinessJobSummaryRow {
  type: string;
  query: string;
}

interface BusinessJobRow {
  id: string;
  type: string;
  status: string;
  query: string;
  results_json: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface BusinessLeadRow {
  id: string;
  job_id: string;
  company_name: string;
  contact_person: string | null;
  contact_email: string | null;
  status: string;
  notes: string | null;
  metadata: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
  email_status: string | null;
  demo_url: string | null;
  outreach_status: string | null;
  icebreaker_text: string | null;
}

interface StudioProjectRow {
  id: string;
  name: string | null;
  description: string | null;
  tech_stack: string | null;
  status: string;
  root_dir: string | null;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
}

interface PullRequestRow extends DbPullRequest {}

interface DbTaskRow {
  id: number;
  parent_id: number | null;
  agent_name: string | null;
  description: string | null;
  context: string | null;
  status: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

async function ensureDeps(): Promise<void> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    if (!pathModule) pathModule = await import('path');
    if (!fsModule) fsModule = await import('fs');
  }
}

export async function getDb(): Promise<Database.Database | null> {
  if (db) return db;

  await ensureDeps();
  if (!pathModule || !fsModule) return null;

  try {
    if (!fsModule.existsSync(config.systemLogDir)) {
      fsModule.mkdirSync(config.systemLogDir, { recursive: true });
    }

    const dbPath = pathModule.join(config.systemLogDir, 'brunella.db');

    const { default: DatabaseConstructor } = await import('better-sqlite3');
    db = new DatabaseConstructor(dbPath);

    initTables(db);
    return db;
  } catch (error: unknown) {
    logWarn('System', `Failed to initialize SQLite database: ${ensureError(error).message}`);
    return null;
  }
}

function initTables(database: Database.Database): void {
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
      type TEXT,
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
      status TEXT DEFAULT 'new',
      notes TEXT,
      metadata TEXT,
      last_interaction_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      email_status TEXT DEFAULT 'unknown',
      demo_url TEXT,
      outreach_status TEXT DEFAULT 'pending',
      icebreaker_text TEXT,
      FOREIGN KEY(job_id) REFERENCES business_jobs(id)
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

  const tableInfoResult = database.prepare<[], TableInfoRow>('PRAGMA table_info(business_leads)').all();
  const tableInfo = Array.isArray(tableInfoResult) ? tableInfoResult : [];
  const columnNames = tableInfo.map((column) => column.name);

  if (!columnNames.includes('email_status')) {
    database.exec("ALTER TABLE business_leads ADD COLUMN email_status TEXT DEFAULT 'unknown'");
  }
  if (!columnNames.includes('demo_url')) {
    database.exec('ALTER TABLE business_leads ADD COLUMN demo_url TEXT');
  }
  if (!columnNames.includes('outreach_status')) {
    database.exec("ALTER TABLE business_leads ADD COLUMN outreach_status TEXT DEFAULT 'pending'");
  }
  if (!columnNames.includes('icebreaker_text')) {
    database.exec('ALTER TABLE business_leads ADD COLUMN icebreaker_text TEXT');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS studio_projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      tech_stack TEXT,
      status TEXT DEFAULT 'ideation',
      root_dir TEXT,
      preview_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Public API - Async wrappers

export async function initDb(): Promise<void> {
  await getDb();
}

export async function saveStudioProject(project: {
  id: string;
  name: string;
  description: string;
  tech_stack: string;
  root_dir: string;
}): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<
    [string, string, string, string, string],
    unknown
  >('INSERT INTO studio_projects (id, name, description, tech_stack, root_dir) VALUES (?, ?, ?, ?, ?)');
  stmt.run(project.id, project.name, project.description, project.tech_stack, project.root_dir);
  return project.id;
}

export async function getStudioProjects(): Promise<StudioProjectRow[]> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[], StudioProjectRow>('SELECT * FROM studio_projects ORDER BY created_at DESC');
  return stmt.all();
}

export async function updateProjectStatus(id: string, status: string, previewUrl?: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string, string | null, string], unknown>(
    'UPDATE studio_projects SET status = ?, preview_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  );
  stmt.run(status, previewUrl ?? null, id);
}

export async function saveBusinessLead(lead: {
  id: string;
  job_id: string;
  company_name: string;
  contact_person?: string;
  contact_email?: string;
  metadata?: string;
  email_status?: string;
  demo_url?: string;
  outreach_status?: string;
  icebreaker_text?: string;
}): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<
    [string, string, string, string | null, string | null, string | null, string, string | null, string, string | null],
    unknown
  >(`
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
    lead.contact_person ?? null,
    lead.contact_email ?? null,
    lead.metadata ?? null,
    lead.email_status ?? 'unknown',
    lead.demo_url ?? null,
    lead.outreach_status ?? 'pending',
    lead.icebreaker_text ?? null,
  );
  return lead.id;
}

export async function updateLeadStatus(id: string, status: string, notes?: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string, string | null, string], unknown>(`
    UPDATE business_leads
    SET status = ?, notes = ?, last_interaction_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, notes ?? null, id);
}

export async function getLeadsByJob(jobId: string): Promise<BusinessLeadRow[]> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[string], BusinessLeadRow>(
    'SELECT * FROM business_leads WHERE job_id = ? ORDER BY created_at DESC',
  );
  return stmt.all(jobId);
}

export async function getPipelineStats(): Promise<Array<{ status: string; count: number }>> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[], { status: string; count: number }>(
    'SELECT status, COUNT(*) as count FROM business_leads GROUP BY status',
  );
  return stmt.all();
}

export async function saveBusinessJob(job: {
  id: string;
  type: string;
  query: string;
  metadata?: string;
  status?: string;
  resultsJson?: string;
}): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<
    [string, string, string, string, string | null, string | null],
    unknown
  >('INSERT INTO business_jobs (id, type, status, query, results_json, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(job.id, job.type, job.status ?? 'pending', job.query, job.resultsJson ?? null, job.metadata ?? null);
  return job.id;
}

export async function getBusinessJobs(limit: number = 20, type?: string): Promise<BusinessJobRow[]> {
  const database = await getDb();
  if (!database) return [];

  if (type) {
    const stmt = database.prepare<[string, number], BusinessJobRow>(
      'SELECT * FROM business_jobs WHERE type = ? ORDER BY created_at DESC LIMIT ?',
    );
    return stmt.all(type, limit);
  }

  const stmt = database.prepare<[number], BusinessJobRow>(
    'SELECT * FROM business_jobs ORDER BY created_at DESC LIMIT ?',
  );
  return stmt.all(limit);
}

export async function getBusinessJobById(id: string): Promise<BusinessJobRow | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<[string], BusinessJobRow>('SELECT * FROM business_jobs WHERE id = ?');
  return stmt.get(id) ?? null;
}

export async function updateBusinessJobStatus(id: string, status: string, resultsJson?: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string, string | null, string], unknown>(
    'UPDATE business_jobs SET status = ?, results_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  );
  stmt.run(status, resultsJson ?? null, id);

  if (status === 'completed' && resultsJson) {
    try {
      const jobStmt = database.prepare<[string], BusinessJobSummaryRow>(
        'SELECT type, query FROM business_jobs WHERE id = ?',
      );
      const job = jobStmt.get(id);

      if (!job) {
        return;
      }

      const baseUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
      void fetch(`${baseUrl}/incubator/gold-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: job.query,
          completion: resultsJson,
          source: job.type,
          quality: 0.9,
        }),
      })
        .then((response) => {
          if (response.ok) {
            logInfo('GoldenBridge', `Sample saved to Dataset from ${job.type}`);
          }
        })
        .catch((error: unknown) => {
          logError('GoldenBridge', `Failed to connect to Python API: ${ensureError(error).message}`);
        });
    } catch (error: unknown) {
      logError('GoldenBridge', `Error processing sample: ${ensureError(error).message}`);
    }
  }
}

export async function saveMessage(
  chatId: string,
  role: string,
  content: string,
  isLog: boolean = false,
): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmtChat = database.prepare<[string], unknown>('INSERT OR IGNORE INTO chats (id) VALUES (?)');
  stmtChat.run(chatId);

  const stmt = database.prepare<[string, string, string, number], unknown>(
    'INSERT INTO messages (chat_id, role, content, is_log) VALUES (?, ?, ?, ?)',
  );
  stmt.run(chatId, role, content, isLog ? 1 : 0);
}

export async function getMessages(chatId: string): Promise<DbMessage[]> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[string], DbMessage>(
    'SELECT role, content, is_log, timestamp FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
  );
  return stmt.all(chatId);
}

export async function createChat(id: string, title: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string, string], unknown>('INSERT OR IGNORE INTO chats (id, title) VALUES (?, ?)');
  stmt.run(id, title);
}

export async function saveTask(task: {
  agent_name: string;
  description: string;
  context?: string;
  parent_id?: number;
}): Promise<number | bigint | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<
    [string, string, string | null, number | null],
    unknown
  >('INSERT INTO tasks (agent_name, description, context, parent_id) VALUES (?, ?, ?, ?)');
  const result = stmt.run(task.agent_name, task.description, task.context ?? null, task.parent_id ?? null);
  return result.lastInsertRowid;
}

export async function updateTaskStatus(id: number | bigint, status: string, result?: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string, string | null, number | bigint], unknown>(
    'UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  );
  stmt.run(status, result ?? null, id);
}

export async function getTasks(limit: number = 50, offset: number = 0): Promise<DbTaskRow[]> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[number, number], DbTaskRow>(
    'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?',
  );
  return stmt.all(limit, offset);
}

export async function getTaskCount(): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  const stmt = database.prepare<[], CountRow>('SELECT COUNT(*) as count FROM tasks');
  const row = stmt.get() ?? { count: 0 };
  return row.count;
}

export async function savePullRequest(pr: {
  pr_number: number;
  github_id: number;
  title: string;
  owner: string;
  repo: string;
  branch: string;
  state: string;
  action: string;
}): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<
    {
      pr_number: number;
      github_id: number;
      title: string;
      owner: string;
      repo: string;
      branch: string;
      state: string;
      action: string;
    },
    unknown
  >(`
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

  const stmt = database.prepare<[string, string, number], PullRequestRow>(
    'SELECT * FROM pull_requests WHERE owner = ? AND repo = ? AND pr_number = ?',
  );
  return stmt.get(owner, repo, prNumber) ?? null;
}
