// D1 Database Storage Module
import { AnalyzedResult } from '../types';

/**
 * Store analyzed results in D1
 */
export async function storeResults(
  db: D1Database,
  taskId: string,
  results: AnalyzedResult[]
): Promise<void> {
  if (results.length === 0) {
    return;
  }

  try {
    // Batch insert to edge_results table
    const statements = results.map(result => {
      const resultId = `result-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      return db.prepare(`
        INSERT INTO edge_results (
          id, task_id, result_type, title, description,
          content, relevance_score, confidence_score,
          category, tags, source_url, source_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        resultId,
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

    console.log(`Stored ${results.length} results for task ${taskId}`);
  } catch (error: any) {
    console.error('D1 storage error:', error.message);
    throw error;
  }
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
