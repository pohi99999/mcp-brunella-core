import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import Database from 'better-sqlite3';
import { logInfo, logError } from '../utils/logger.js';

export interface SuggestedTask {
  id: string;
  file_path: string;
  line_number: number;
  todo_text: string;
  context: string;
  confidence_score: number;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

let db: Database.Database | null = null;

export async function initSuggestedTasksDb(dbPath: string): Promise<void> {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Create tables (they also live in schema.sql, but we ensure they exist here)
    db.exec(`
      CREATE TABLE IF NOT EXISTS suggested_tasks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        todo_text TEXT NOT NULL,
        context TEXT,
        confidence_score REAL DEFAULT 0.5,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'archived')),
        assigned_to TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(file_path, line_number)
      );
      
      CREATE INDEX IF NOT EXISTS idx_suggested_tasks_status ON suggested_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_suggested_tasks_confidence ON suggested_tasks(confidence_score DESC);
      CREATE INDEX IF NOT EXISTS idx_suggested_tasks_created_at ON suggested_tasks(created_at DESC);
    `);
    
    logInfo('SuggestedTasksScanner', `Database initialized at ${dbPath}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('SuggestedTasksScanner', `Database init failed: ${message}`);
    throw err;
  }
}

export function getSuggestedTasksDb(): Database.Database | null {
  return db;
}

export async function scanCodebaseForTodos(codebasePath: string): Promise<SuggestedTask[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const foundTodos: Array<{
      file_path: string;
      line_number: number;
      todo_text: string;
      context: string;
    }> = [];

    // Scan directories (src/, test/, myai/)
    const scanDirs = ['src', 'test', 'myai', 'scripts', 'conductor'];
    const ignorePatterns = [
      'node_modules',
      '.git',
      'build',
      'dist',
      'coverage',
      '.next',
      '__pycache__',
      '.venv',
      'venv',
    ];

    for (const dir of scanDirs) {
      const fullPath = join(codebasePath, dir);
      await scanDirectory(fullPath, codebasePath, foundTodos, ignorePatterns);
    }

    // Store in database
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO suggested_tasks (id, file_path, line_number, todo_text, context, confidence_score, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const stored: SuggestedTask[] = [];
    for (const todo of foundTodos) {
      const id = `todo_${todo.file_path}_${todo.line_number}`.replace(/[^a-zA-Z0-9_]/g, '_');
      const confidence = calculateConfidence(todo.todo_text);

      try {
        insertStmt.run(
          id,
          todo.file_path,
          todo.line_number,
          todo.todo_text,
          todo.context,
          confidence,
          'pending',
        );

        stored.push({
          id,
          file_path: todo.file_path,
          line_number: todo.line_number,
          todo_text: todo.todo_text,
          context: todo.context,
          confidence_score: confidence,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Duplicate might occur, it's OK (IGNORE clause)
        logInfo('SuggestedTasksScanner', `Skipped duplicate todo at ${todo.file_path}:${todo.line_number}`);
      }
    }

    logInfo('SuggestedTasksScanner', `Scanned ${foundTodos.length} TODOs, stored ${stored.length}`);
    return stored;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('SuggestedTasksScanner', `Failed to scan codebase: ${message}`);
    throw err;
  }
}

async function scanDirectory(
  dirPath: string,
  basePath: string,
  todos: Array<{ file_path: string; line_number: number; todo_text: string; context: string }>,
  ignorePatterns: string[],
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored patterns
      if (ignorePatterns.some((pattern) => entry.name.includes(pattern))) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, basePath, todos, ignorePatterns);
      } else if (shouldScanFile(entry.name)) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const relativePath = fullPath.replace(basePath, '').replace(/\\/g, '/').substring(1);
          extractTodos(content, relativePath, todos);
        } catch {
          // File read error, skip
        }
      }
    }
  } catch {
    // Directory read error, skip
  }
}

function shouldScanFile(filename: string): boolean {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.md', '.sql'];
  return extensions.some((ext) => filename.endsWith(ext));
}

function extractTodos(
  content: string,
  filePath: string,
  todos: Array<{ file_path: string; line_number: number; todo_text: string; context: string }>,
): void {
  const lines = content.split('\n');
  lines.forEach((line, idx): void => {
    if (/(TODO|FIXME|XXX|HACK|BUG)[\s:]*/.test(line)) {
      const todoTextMatch = line.match(/(TODO|FIXME|XXX|HACK|BUG)[\s:]*(.+)/i);
      if (todoTextMatch) {
        const lineNumber = idx + 1;

        // Extract context (surrounding 2 lines)
        const startLine = Math.max(0, idx - 1);
        const endLine = Math.min(lines.length - 1, idx + 2);
        const context = lines.slice(startLine, endLine + 1).join('\n');

        todos.push({
          file_path: filePath,
          line_number: lineNumber,
          todo_text: todoTextMatch[2].trim(),
          context,
        });
      }
    }
  });
}

function calculateConfidence(todoText: string): number {
  // Simple confidence scoring
  let score = 0.5; // Base score

  // Increase confidence for specific markers
  if (todoText.toLowerCase().includes('urgent')) score += 0.2;
  if (todoText.toLowerCase().includes('critical')) score += 0.25;
  if (todoText.toLowerCase().includes('bug')) score += 0.15;
  if (todoText.toLowerCase().includes('security')) score += 0.2;
  if (todoText.includes('FIXME')) score += 0.1;

  // Length bonus (detailed description = more important)
  if (todoText.length > 100) score += 0.1;

  return Math.min(score, 1.0);
}

export function getAllSuggestedTasks(): SuggestedTask[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    SELECT id, file_path, line_number, todo_text, context, confidence_score, status, assigned_to, created_at, updated_at
    FROM suggested_tasks
    WHERE status != 'archived'
    ORDER BY confidence_score DESC, created_at DESC
  `);

  return stmt.all() as SuggestedTask[];
}

export function getSuggestedTasksByStatus(status: string): SuggestedTask[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    SELECT id, file_path, line_number, todo_text, context, confidence_score, status, assigned_to, created_at, updated_at
    FROM suggested_tasks
    WHERE status = ?
    ORDER BY confidence_score DESC, created_at DESC
  `);

  return stmt.all(status) as SuggestedTask[];
}

export function updateSuggestedTaskStatus(taskId: string, newStatus: string): boolean {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    UPDATE suggested_tasks
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(newStatus, taskId);
  return result.changes > 0;
}

export function deleteSuggestedTask(taskId: string): boolean {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    UPDATE suggested_tasks
    SET status = 'archived', updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(taskId);
  return result.changes > 0;
}
