import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/index.js';
import { ensureError } from './ensureError.js';
import { logError, logWarn } from './logger.js';

interface TableInfoRow {
  name: string;
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private pathModule: typeof import('path') | null = null;
  private fsModule: typeof import('fs') | null = null;

  constructor(private readonly dbPath: string = path.join(config.systemLogDir, 'brunella.db')) {}

  async getDb(): Promise<Database.Database | null> {
    if (this.db) return this.db;

    await this.ensureDeps();
    if (!this.pathModule || !this.fsModule) return null;

    try {
      if (!this.fsModule.existsSync(path.dirname(this.dbPath))) {
        this.fsModule.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      }

      const { default: DatabaseConstructor } = await import('better-sqlite3');
      this.db = new DatabaseConstructor(this.dbPath);
      this.initTables(this.db);
      return this.db;
    } catch (error: unknown) {
      logWarn('System', `Failed to initialize SQLite database: ${ensureError(error).message}`);
      this.db = null;
      return null;
    }
  }

  async open(): Promise<Database.Database | null> {
    return this.getDb();
  }

  close(): void {
    if (!this.db) return;

    try {
      this.db.close();
    } catch (error: unknown) {
      logError('System', `Failed to close SQLite database: ${ensureError(error).message}`);
    } finally {
      this.db = null;
    }
  }

  private async ensureDeps(): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      if (!this.pathModule) this.pathModule = await import('path');
      if (!this.fsModule) this.fsModule = await import('fs');
    }
  }

  private initTables(database: Database.Database): void {
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
}

export const defaultDatabaseManager = new DatabaseManager();
