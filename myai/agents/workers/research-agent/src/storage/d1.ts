// D1 Database Storage Module
import { AnalyzedResult } from '../types.js';
import { logError, logInfo } from '../utils/logger.js';

export interface StoredResult {
  id: string;
  result: AnalyzedResult;
}

/**
 * Store analyzed results in D1
 */
export async function storeResults(
  db: D1Database,
  taskId: string,
  results: AnalyzedResult[]
): Promise<StoredResult[]> {
  if (results.length === 0) {
    return [];
  }

  try {
    const now = new Date().toISOString();
    const storedResults: StoredResult[] = results.map(result => ({
      id: `result-${crypto.randomUUID()}`,
      result,
    }));

    // Batch insert to edge_results table
    const statements = storedResults.map(({ id, result }) => {
      return db.prepare(`
        INSERT INTO edge_results (
          id, task_id, result_type, title, description,
          content, relevance_score, confidence_score,
          category, tags, source_url, source_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        taskId,
        'research',
        result.title,
        result.summary,
        JSON.stringify(result),
        result.relevance_score,
        result.confidence_score,
        result.category,
        result.tags.join(','),
        result.url,
        result.source,
        now
      );
    });

    // Execute batch
    await db.batch(statements);

    logInfo("Stored results in D1", {
      taskId,
      count: results.length,
    });

    return storedResults;
  } catch (error: any) {
    logError("D1 storage error", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Mark D1 results as synced to Vectorize.
 */
export async function markResultsSynced(
  db: D1Database,
  results: StoredResult[],
  embeddingModel: string
): Promise<void> {
  if (results.length === 0) {
    return;
  }

  const syncedAt = new Date().toISOString();
  const statements = results.map(({ id }) =>
    db.prepare(`
      UPDATE edge_results
      SET embedding_id = ?, embedding_model = ?, synced_to_r1_at = ?
      WHERE id = ?
    `).bind(id, embeddingModel, syncedAt, id)
  );

  await db.batch(statements);
  logInfo("Marked results synced to Vectorize", {
    count: results.length,
  });
}

/**
 * Query results from D1
 */
export async function queryResults(
  db: D1Database,
  filters: {
    result_type?: string;
    category?: string;
    min_score?: number;
    limit?: number;
  } = {}
): Promise<any[]> {
  const {
    result_type = 'research',
    category,
    min_score = 0,
    limit = 100,
  } = filters;

  let query = `
    SELECT * FROM edge_results
    WHERE result_type = ?
      AND relevance_score >= ?
  `;

  const bindings: any[] = [result_type, min_score];

  if (category) {
    query += ` AND category = ?`;
    bindings.push(category);
  }

  query += ` ORDER BY relevance_score DESC, created_at DESC LIMIT ?`;
  bindings.push(limit);

  const result = await db.prepare(query).bind(...bindings).all();
  
  return result.results || [];
}
