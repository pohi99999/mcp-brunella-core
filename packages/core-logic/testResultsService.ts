import Database from 'better-sqlite3';
import { logInfo, logError } from '@packages/utils/logger.js';

export interface TestRun {
  id: string;
  scheduledTime: string;
  startedAt: string;
  endedAt?: string;
  status: 'passed' | 'failed' | 'running';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  output: string;
  errorLog?: string;
  hostname: string;
  triggerType: 'scheduled' | 'manual' | 'api';
  created_at: string;
}

let db: Database.Database | null = null;

export async function initTestResultsDb(dbPath: string): Promise<void> {
  try {
    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS testRuns (
        id TEXT PRIMARY KEY,
        scheduledTime TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'running')),
        totalTests INTEGER DEFAULT 0,
        passed INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        output TEXT,
        errorLog TEXT,
        hostname TEXT NOT NULL,
        triggerType TEXT NOT NULL CHECK(triggerType IN ('scheduled', 'manual', 'api')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_testRuns_status ON testRuns(status);
      CREATE INDEX IF NOT EXISTS idx_testRuns_created_at ON testRuns(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_testRuns_triggerType ON testRuns(triggerType);
    `);
    
    logInfo('TestResultsService', 'Database initialized');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to initialize database: ${message}`);
    throw err;
  }
}

export function saveTestRun(run: Omit<TestRun, 'id'> & { id?: string }): TestRun {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const id = run.id || `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const stmt = db.prepare(`
      INSERT INTO testRuns (
        id, scheduledTime, startedAt, endedAt, status, totalTests, passed, failed, skipped,
        duration, output, errorLog, hostname, triggerType, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      run.scheduledTime,
      run.startedAt,
      run.endedAt || null,
      run.status,
      run.totalTests,
      run.passed,
      run.failed,
      run.skipped,
      run.duration,
      run.output,
      run.errorLog || null,
      run.hostname,
      run.triggerType,
      run.created_at
    );
    
    return { ...run, id } as TestRun;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to save test run: ${message}`);
    throw err;
  }
}

export function getTestRuns(limit: number = 10, offset: number = 0): TestRun[] {
  if (!db) {
    logInfo('TestResultsService', 'Database not initialized, returning empty test runs');
    return [];
  }
  
  try {
    const stmt = db.prepare(`
      SELECT * FROM testRuns
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const results = stmt.all(limit, offset) as TestRun[];
    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to fetch test runs: ${message}`);
    throw err;
  }
}

export function getTestRunById(id: string): TestRun | null {
  if (!db) {
    logInfo('TestResultsService', `Database not initialized, cannot fetch test run: ${id}`);
    return null;
  }
  
  try {
    const stmt = db.prepare('SELECT * FROM testRuns WHERE id = ?');
    const result = stmt.get(id) as TestRun | undefined;
    return result || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to fetch test run: ${message}`);
    throw err;
  }
}

export interface TestStats {
  totalRuns: number;
  passRate: number;
  averageDuration: number;
  lastRunStatus: 'passed' | 'failed' | 'unknown';
  lastRunTime: string;
  sevenDayStats: {
    passRate: number;
    passCount: number;
    failCount: number;
  };
}

function createEmptyStats(): TestStats {
  return {
    totalRuns: 0,
    passRate: 0,
    averageDuration: 0,
    lastRunStatus: 'unknown',
    lastRunTime: 'Never',
    sevenDayStats: {
      passRate: 0,
      passCount: 0,
      failCount: 0,
    },
  };
}

export function getTestStats(): TestStats {
  if (!db) {
    logInfo('TestResultsService', 'Database not initialized, returning empty test stats');
    return createEmptyStats();
  }
  
  try {
    // Get total runs
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM testRuns');
    const totalResult = totalStmt.get() as { count: number };
    const totalRuns = totalResult.count;
    
    // Get pass rate (lifetime)
    const passRateStmt = db.prepare(`
      SELECT 
        CAST(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as rate
      FROM testRuns
      WHERE status IN ('passed', 'failed')
    `);
    const passRateResult = passRateStmt.get() as { rate: number | null };
    const passRate = passRateResult.rate ?? 0;
    
    // Get average duration
    const avgDurationStmt = db.prepare('SELECT AVG(duration) as avg FROM testRuns WHERE duration > 0');
    const avgDurationResult = avgDurationStmt.get() as { avg: number | null };
    const averageDuration = avgDurationResult.avg ?? 0;
    
    // Get last run status and time
    const lastRunStmt = db.prepare(`
      SELECT status, created_at FROM testRuns ORDER BY created_at DESC LIMIT 1
    `);
    const lastRunResult = lastRunStmt.get() as { status?: string; created_at?: string } | undefined;
    const lastRunStatus = (lastRunResult?.status === 'passed' ? 'passed' : lastRunResult?.status === 'failed' ? 'failed' : 'unknown') as 'passed' | 'failed' | 'unknown';
    const lastRunTime = lastRunResult?.created_at || 'Never';
    
    // Get 7-day stats
    const sevenDaysStmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM testRuns
      WHERE datetime(created_at) >= datetime('now', '-7 days')
      AND status IN ('passed', 'failed')
    `);
    const sevenDaysResult = sevenDaysStmt.get() as { passed: number | null; failed: number | null };
    const sevenDayTotal = (sevenDaysResult.passed || 0) + (sevenDaysResult.failed || 0);
    const sevenDayPassRate = sevenDayTotal > 0 ? (sevenDaysResult.passed || 0) / sevenDayTotal : 0;
    
    return {
      totalRuns,
      passRate,
      averageDuration,
      lastRunStatus,
      lastRunTime,
      sevenDayStats: {
        passRate: sevenDayPassRate,
        passCount: sevenDaysResult.passed || 0,
        failCount: sevenDaysResult.failed || 0,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to get test stats: ${message}`);
    throw err;
  }
}

export function getTestRunsByDateRange(startDate: string, endDate: string): TestRun[] {
  if (!db) {
    logInfo('TestResultsService', 'Database not initialized, returning empty date-range test runs');
    return [];
  }
  
  try {
    const stmt = db.prepare(`
      SELECT * FROM testRuns
      WHERE datetime(created_at) BETWEEN datetime(?) AND datetime(?)
      ORDER BY created_at DESC
    `);
    
    const results = stmt.all(startDate, endDate) as TestRun[];
    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to fetch test runs by date range: ${message}`);
    throw err;
  }
}

export function deleteOldTestRuns(daysOld: number = 30): number {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(`
      DELETE FROM testRuns
      WHERE datetime(created_at) < datetime('now', ? || ' days')
    `);
    
    const result = stmt.run(`-${daysOld}`);
    const changes = typeof result.changes === 'number' ? result.changes : 0;
    logInfo('TestResultsService', `Deleted ${changes} old test runs`);
    return changes;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('TestResultsService', `Failed to delete old test runs: ${message}`);
    throw err;
  }
}

/** Returns the current database instance, or null if not yet initialized. */
export function getTestResultsDb(): Database.Database | null {
  return db;
}

export function closeDb(): void {
  if (db) {
    try {
      db.close();
      db = null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logError('TestResultsService', `Failed to close database: ${message}`);
    }
  }
}

