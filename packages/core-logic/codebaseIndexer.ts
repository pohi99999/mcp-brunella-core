// FILE: src/core/codebaseIndexer.ts
// PURPOSE: G4.2 — Proactive codebase indexing into LanceDB via Ollama embeddings
// Periodically scans .ts, .py, .md files, chunks them, and indexes via Python backend.

import { logInfo, logError } from '@packages/utils/logger.js';
import { aiGateway } from '@packages/utils/aiGateway.js';

// ============================================================================
// TYPES
// ============================================================================

export interface IndexStats {
  fileCount: number;
  chunkCount: number;
  durationMs: number;
  skippedFiles: number;
  errors: string[];
}

export interface ChunkInfo {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface IndexerConfig {
  rootDir: string;
  extensions: string[];
  chunkSize: number;         // characters per chunk
  chunkOverlap: number;      // overlap between chunks
  excludeDirs: string[];
  maxFileSize: number;       // bytes
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://localhost:8000';
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

const DEFAULT_CONFIG: IndexerConfig = {
  rootDir: process.cwd(),
  extensions: ['.ts', '.py', '.md', '.tsx', '.jsx'],
  chunkSize: 500,
  chunkOverlap: 100,
  excludeDirs: [
    'node_modules', '.git', 'build', 'dist', '__pycache__',
    '_archive', '_br_temp', 'agentenv', '.venv', 'data',
    'external_research', '_KNOWLEDGE_BASE', 'logs'
  ],
  maxFileSize: 100 * 1024 // 100KB
};

// ============================================================================
// SCHEDULING STATE
// ============================================================================

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastIndexTime: number = 0;
let lastIndexStats: IndexStats | null = null;

// ============================================================================
// CHUNKING
// ============================================================================

/**
 * Split file content into overlapping chunks.
 */
export function chunkContent(content: string, filePath: string, config: Partial<IndexerConfig> = {}): ChunkInfo[] {
  const chunkSize = config.chunkSize ?? DEFAULT_CONFIG.chunkSize;
  const overlap = config.chunkOverlap ?? DEFAULT_CONFIG.chunkOverlap;
  const chunks: ChunkInfo[] = [];

  const lines = content.split('\n');
  let currentChunk = '';
  let startLine = 1;
  let currentLine = 1;

  for (const line of lines) {
    currentChunk += line + '\n';

    if (currentChunk.length >= chunkSize) {
      chunks.push({
        filePath,
        content: currentChunk.trim(),
        startLine,
        endLine: currentLine
      });

      // Calculate overlap: keep last N characters for context continuity
      const overlapStart = Math.max(0, currentChunk.length - overlap);
      const overlapText = currentChunk.slice(overlapStart);
      currentChunk = overlapText;
      startLine = Math.max(1, currentLine - overlapText.split('\n').length + 1);
    }
    currentLine++;
  }

  // Remaining content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      filePath,
      content: currentChunk.trim(),
      startLine,
      endLine: currentLine - 1
    });
  }

  return chunks;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

/**
 * Discover indexable files recursively.
 * Requires Node.js runtime for fs/path.
 */
async function discoverFiles(config: IndexerConfig): Promise<string[]> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return [];
  }

  const fs = await import('fs');
  const path = await import('path');
  const files: string[] = [];

  function walkDir(dir: string): void {
    try {
      const entries = fs.default.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.default.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (config.excludeDirs.includes(entry.name)) continue;
          if (entry.name.startsWith('.')) continue;
          walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.default.extname(entry.name);
          if (!config.extensions.includes(ext)) continue;

          // Skip large files
          try {
            const stat = fs.default.statSync(fullPath);
            if (stat.size > config.maxFileSize) continue;
          } catch {
            continue;
          }

          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip unreadable directories
    }
  }

  walkDir(config.rootDir);
  return files;
}

// ============================================================================
// GIT DIFF BASED DISCOVERY
// ============================================================================

/**
 * Get changed files since last index using git diff.
 */
async function getChangedFiles(sinceTimestamp: number): Promise<string[]> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return [];
  }

  try {
    const { execSync } = await import('child_process');
    const sinceDate = new Date(sinceTimestamp).toISOString();
    const output = execSync(`git diff --name-only --diff-filter=ACMR HEAD`, {
      encoding: 'utf-8',
      timeout: 10000,
      cwd: process.cwd()
    }).trim();

    if (!output) return [];

    const path = await import('path');
    return output.split('\n')
      .filter(f => DEFAULT_CONFIG.extensions.some(ext => f.endsWith(ext)))
      .map(f => path.default.resolve(process.cwd(), f));
  } catch {
    return [];
  }
}

// ============================================================================
// EMBEDDING
// ============================================================================

/**
 * Generate embedding for a text chunk using Ollama's embedding API (via AI Gateway if enabled).
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Use AI Gateway wrapper for embeddings (v3.0 pure fetch)
    const embedding = await aiGateway.embeddings(text, {
      model: EMBED_MODEL
    });

    return embedding || null;
  } catch {
    return null;
  }
}

// ============================================================================
// CORE INDEXING
// ============================================================================

/**
 * Index the full codebase.
 * Reads all matching files, chunks them, and sends to Python backend for LanceDB storage.
 */
export async function indexCodebase(config: Partial<IndexerConfig> = {}): Promise<IndexStats> {
  const cfg: IndexerConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const stats: IndexStats = { fileCount: 0, chunkCount: 0, durationMs: 0, skippedFiles: 0, errors: [] };

  logInfo('CodebaseIndexer', `Starting full index of ${cfg.rootDir}...`);

  try {
    const files = await discoverFiles(cfg);
    const fs = await import('fs');

    for (const filePath of files) {
      try {
        const content = fs.default.readFileSync(filePath, 'utf-8');
        const chunks = chunkContent(content, filePath, cfg);

        if (chunks.length === 0) {
          stats.skippedFiles++;
          continue;
        }

        stats.fileCount++;
        stats.chunkCount += chunks.length;

        // Send chunks to Python backend for batch indexing
        await sendChunksToPython(chunks).catch((err: Error) => {
          stats.errors.push(`${filePath}: ${err.message}`);
        });
      } catch (error: unknown) {
        stats.skippedFiles++;
        const msg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`${filePath}: ${msg}`);
      }
    }

    stats.durationMs = Date.now() - startTime;
    lastIndexTime = Date.now();
    lastIndexStats = { ...stats };

    logInfo('CodebaseIndexer', `Index complete: ${stats.fileCount} files, ${stats.chunkCount} chunks in ${stats.durationMs}ms`);
    return stats;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('CodebaseIndexer', `Index failed: ${msg}`);
    stats.durationMs = Date.now() - startTime;
    stats.errors.push(msg);
    return stats;
  }
}

/**
 * Re-index only changed files (git diff based).
 */
export async function reindexChangedFiles(): Promise<IndexStats> {
  const startTime = Date.now();
  const stats: IndexStats = { fileCount: 0, chunkCount: 0, durationMs: 0, skippedFiles: 0, errors: [] };

  logInfo('CodebaseIndexer', 'Starting incremental reindex (git diff)...');

  try {
    const changedFiles = await getChangedFiles(lastIndexTime || 0);

    if (changedFiles.length === 0) {
      logInfo('CodebaseIndexer', 'No changed files to reindex');
      stats.durationMs = Date.now() - startTime;
      return stats;
    }

    const fs = await import('fs');

    for (const filePath of changedFiles) {
      try {
        if (!fs.default.existsSync(filePath)) {
          stats.skippedFiles++;
          continue;
        }

        const content = fs.default.readFileSync(filePath, 'utf-8');
        const chunks = chunkContent(content, filePath);

        stats.fileCount++;
        stats.chunkCount += chunks.length;

        await sendChunksToPython(chunks).catch((err: Error) => {
          stats.errors.push(`${filePath}: ${err.message}`);
        });
      } catch (error: unknown) {
        stats.skippedFiles++;
      }
    }

    stats.durationMs = Date.now() - startTime;
    lastIndexTime = Date.now();
    lastIndexStats = { ...stats };

    logInfo('CodebaseIndexer', `Reindex complete: ${stats.fileCount} files, ${stats.chunkCount} chunks in ${stats.durationMs}ms`);
    return stats;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('CodebaseIndexer', `Reindex failed: ${msg}`);
    stats.durationMs = Date.now() - startTime;
    stats.errors.push(msg);
    return stats;
  }
}

// ============================================================================
// PYTHON BACKEND COMMUNICATION
// ============================================================================

/**
 * Send chunks to Python backend for LanceDB indexing.
 */
async function sendChunksToPython(chunks: ChunkInfo[]): Promise<void> {
  const response = await fetch(`${PYTHON_BASE_URL}/index/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chunks: chunks.map(c => ({
        file_path: c.filePath,
        content: c.content,
        start_line: c.startLine,
        end_line: c.endLine
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`Python index API error: ${response.status}`);
  }
}

// ============================================================================
// SCHEDULER
// ============================================================================

/**
 * Start periodic reindexing.
 * @param intervalMinutes — how often to reindex (default: 30)
 */
export function scheduleReindex(intervalMinutes: number = 30): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  schedulerInterval = setInterval(() => {
    reindexChangedFiles().catch((err: Error) => {
      logError('CodebaseIndexer', `Scheduled reindex failed: ${err.message}`);
    });
  }, intervalMs);

  logInfo('CodebaseIndexer', `Scheduled reindex every ${intervalMinutes} minutes`);
}

/**
 * Stop periodic reindexing.
 */
export function stopScheduledReindex(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logInfo('CodebaseIndexer', 'Scheduled reindex stopped');
  }
}

// ============================================================================
// STATUS API
// ============================================================================

/**
 * Get index status for dashboard/API.
 */
export function getIndexStatus(): { lastIndexTime: number; lastStats: IndexStats | null; schedulerActive: boolean } {
  return {
    lastIndexTime,
    lastStats: lastIndexStats ? { ...lastIndexStats } : null,
    schedulerActive: schedulerInterval !== null
  };
}

