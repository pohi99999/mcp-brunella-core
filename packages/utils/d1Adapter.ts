/**
 * D1 Adapter: Node.js → Cloudflare Worker → D1 Database
 * 
 * Purpose: Enable Node.js backend to query D1 via Cloudflare Worker proxy
 * Architecture: HTTP bridge pattern (Node.js cannot access D1 directly)
 * 
 * Flow:
 *   Node.js → HTTP POST /d1/query → Cloudflare Worker → D1 Database
 * 
 * Tables (Phase 1):
 *   - enterprise_events: All enterprise-level events
 *   - agent_tasks: Agent task executions
 *   - golden_samples: Golden dataset samples
 */

import { logInfo, logError, logWarn } from './logger.js';

export interface D1QueryResult<T = unknown> {
  status: 'success' | 'error';
  results?: T[];
  meta?: {
    served_by: string;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
  error?: string;
}

export interface D1QueryRequest {
  sql: string;
  params?: unknown[];
}

/**
 * D1 Adapter Configuration
 */
export interface D1AdapterConfig {
  workerUrl: string;
  apiKey: string;
  timeout?: number; // Default: 30000ms
}

/**
 * D1 Adapter: Query Cloudflare D1 from Node.js via Worker proxy
 */
export class D1Adapter {
  private config: Required<D1AdapterConfig>;

  constructor(config: D1AdapterConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
    };

    if (!this.config.workerUrl) {
      throw new Error('D1Adapter: workerUrl is required');
    }

    if (!this.config.apiKey) {
      throw new Error('D1Adapter: apiKey is required');
    }
  }

  /**
   * Execute a SQL query on D1
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<D1QueryResult<T>> {
    const startTime = Date.now();

    try {
      const requestBody: D1QueryRequest = { sql, params };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.workerUrl}/d1/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CEAN-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logError('D1 Adapter', `HTTP ${response.status}: ${errorText}`);

        return {
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const rawBody = await response.text();
      const contentType = response.headers.get('content-type') || 'unknown';

      if (!contentType.toLowerCase().includes('application/json')) {
        const snippet = rawBody.replace(/\s+/g, ' ').slice(0, 200);
        const error = `Expected JSON from D1 worker, received ${contentType}: ${snippet}`;
        logError('D1 Adapter', error);

        return {
          status: 'error',
          error,
        };
      }

      let result: D1QueryResult<T>;
      try {
        result = JSON.parse(rawBody) as D1QueryResult<T>;
      } catch {
        const snippet = rawBody.replace(/\s+/g, ' ').slice(0, 200);
        const error = `Failed to parse D1 worker JSON response: ${snippet}`;
        logError('D1 Adapter', error);

        return {
          status: 'error',
          error,
        };
      }

      const duration = Date.now() - startTime;
      logInfo(
        'D1 Adapter',
        `Query executed in ${duration}ms (D1: ${result.meta?.duration || 0}ms, rows: ${result.meta?.rows_read || 0})`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('D1 Adapter', `Query failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * Insert a new enterprise event
   */
  async insertEnterpriseEvent(event: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    source_module: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  }): Promise<D1QueryResult> {
    const sql = `
      INSERT INTO enterprise_events (id, type, payload, source_module, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      event.id,
      event.type,
      JSON.stringify(event.payload),
      event.source_module,
      event.priority || 'MEDIUM',
      event.status || 'PENDING',
      Date.now(),
    ];

    return this.query(sql, params);
  }

  /**
   * Get enterprise events by type
   */
  async getEnterpriseEventsByType(
    type: string,
    limit = 100,
  ): Promise<D1QueryResult<{
    id: string;
    type: string;
    payload: string;
    source_module: string;
    priority: string;
    status: string;
    created_at: number;
    processed_at: number | null;
  }>> {
    const sql = `
      SELECT * FROM enterprise_events
      WHERE type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.query(sql, [type, limit]);
  }

  /**
   * Get enterprise events without type filter
   */
  async getEnterpriseEvents(
    limit = 100,
  ): Promise<D1QueryResult<{
    id: string;
    type: string;
    payload: string;
    source_module: string;
    priority: string;
    status: string;
    created_at: number;
    processed_at: number | null;
  }>> {
    const sql = `
      SELECT * FROM enterprise_events
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.query(sql, [limit]);
  }

  /**
   * Insert agent task
   */
  async insertAgentTask(task: {
    id: string;
    agent_name: string;
    task: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
  }): Promise<D1QueryResult> {
    const sql = `
      INSERT INTO agent_tasks (id, agent_name, task, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [task.id, task.agent_name, task.task, task.status || 'pending', Date.now()];

    return this.query(sql, params);
  }

  /**
   * Update agent task status
   */
  async updateAgentTaskStatus(
    id: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    result?: string,
  ): Promise<D1QueryResult> {
    const sql = result
      ? 'UPDATE agent_tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?'
      : 'UPDATE agent_tasks SET status = ? WHERE id = ?';

    const params = result ? [status, result, Date.now(), id] : [status, id];

    return this.query(sql, params);
  }

  /**
   * Get agent tasks by status
   */
  async getAgentTasksByStatus(
    status: 'pending' | 'running' | 'completed' | 'failed',
    limit = 100,
  ): Promise<D1QueryResult<{
    id: string;
    agent_name: string;
    task: string;
    status: string;
    result: string | null;
    created_at: number;
    completed_at: number | null;
  }>> {
    const sql = `
      SELECT * FROM agent_tasks
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.query(sql, [status, limit]);
  }

  /**
   * Insert golden sample
   */
  async insertGoldenSample(sample: {
    id: string;
    instruction: string;
    output: string;
    source?: string;
    agent_name?: string;
  }): Promise<D1QueryResult> {
    const sql = `
      INSERT INTO golden_samples (id, instruction, output, source, agent_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      sample.id,
      sample.instruction,
      sample.output,
      sample.source || null,
      sample.agent_name || null,
      Date.now(),
    ];

    return this.query(sql, params);
  }

  /**
   * Get golden samples by agent
   */
  async getGoldenSamplesByAgent(
    agent_name: string,
    limit = 100,
  ): Promise<D1QueryResult<{
    id: string;
    instruction: string;
    output: string;
    source: string | null;
    agent_name: string | null;
    created_at: number;
  }>> {
    const sql = `
      SELECT * FROM golden_samples
      WHERE agent_name = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.query(sql, [agent_name, limit]);
  }

  /**
   * Get all golden samples
   */
  async getAllGoldenSamples(
    limit = 100,
  ): Promise<D1QueryResult<{
    id: string;
    instruction: string;
    output: string;
    source: string | null;
    agent_name: string | null;
    created_at: number;
  }>> {
    const sql = `
      SELECT * FROM golden_samples
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return this.query(sql, [limit]);
  }
}

/**
 * Create D1 Adapter instance from environment variables
 */
export function createD1Adapter(): D1Adapter | null {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const apiKey = process.env.CEAN_API_KEY;

  if (!workerUrl || !apiKey) {
    logWarn('D1 Adapter', 'CLOUDFLARE_WORKER_URL or CEAN_API_KEY not set (D1 disabled)');
    return null;
  }

  return new D1Adapter({ workerUrl, apiKey });
}
