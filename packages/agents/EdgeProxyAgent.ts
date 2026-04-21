/**
 * EdgeProxyAgent - Cloudflare Edge Kommunikáció
 * 
 * Felelősségek:
 * 1. Cloudflare Workers kommunikáció
 * 2. Task routing edge-re
 * 3. Fallback kezelés (ha tunnel nem elérhető)
 * 4. Távoli állapot szinkronizálás
 * 
 * @author Brunella Core Team
 * @version 1.0.0
 */

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, logDebug, setAgentStatus } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { cloudflareClient } from '@packages/utils/cloudflareClient.js';
import { getGlobalDb } from '@packages/utils/globalDb.js';
import type { Database } from 'better-sqlite3';

// ============================================================================
// INTERFACES
// ============================================================================

interface EdgeConfig {
  workerUrl: string;
  tunnelEnabled: boolean;
  fallbackToLocal: boolean;
  healthCheckInterval: number;
  apiKey?: string;
  tunnelUrl?: string;
  tunnelN8nUrl?: string;
  tunnelBrowserUrl?: string;
  tunnelDashboardUrl?: string;
}

interface EdgeHealth {
  edge: 'healthy' | 'degraded' | 'offline';
  tunnel: 'connected' | 'disconnected' | 'unknown';
  latency: number;
  lastCheck: string;
}

type JsonRecord = Record<string, unknown>;

interface EdgeTask {
  taskId: string;
  type: string;
  status: string;
  payload: JsonRecord;
  result?: unknown;
  createdAt: string;
  completedAt?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeTunnelStatus(value: unknown): EdgeHealth['tunnel'] {
  return value === 'connected' || value === 'disconnected' ? value : 'unknown';
}

function normalizeEdgeTask(value: unknown): EdgeTask | null {
  if (!isRecord(value)) {
    return null;
  }

  const taskId = asString(value.taskId ?? value.id, '');
  if (!taskId) {
    return null;
  }

  const status = asString(value.status, 'unknown');
  const createdAt = asString(value.createdAt, new Date().toISOString());

  return {
    taskId,
    type: asString(value.type, 'unknown'),
    status,
    payload: isRecord(value.payload) ? value.payload : {},
    result: value.result,
    createdAt,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
  };
}

function normalizeEdgeTaskList(value: unknown): EdgeTask[] {
  if (!isRecord(value) || !Array.isArray(value.tasks)) {
    return [];
  }

  return value.tasks
    .map((task) => normalizeEdgeTask(task))
    .filter((task): task is EdgeTask => task !== null);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: EdgeConfig = {
  workerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://bas-orchestrator.workers.dev',
  tunnelEnabled: process.env.CLOUDFLARE_TUNNEL_ENABLED === 'true',
  fallbackToLocal: true,
  healthCheckInterval: 30000,
  tunnelUrl: process.env.CLOUDFLARE_TUNNEL_URL,
  tunnelN8nUrl: process.env.CLOUDFLARE_TUNNEL_N8N_URL,
  tunnelBrowserUrl: process.env.CLOUDFLARE_TUNNEL_BROWSER_URL,
  tunnelDashboardUrl: process.env.CLOUDFLARE_TUNNEL_DASHBOARD_URL
};

// ============================================================================
// AGENT IMPLEMENTATION
// ============================================================================

export class EdgeProxyAgent extends BaseAgent {
  name = 'EdgeProxy';
  description = 'Cloudflare Edge kommunikáció és task routing';
  role = 'Edge Proxy & Remote Access';

  private config: EdgeConfig;
  private health: EdgeHealth;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config?: Partial<EdgeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.health = {
      edge: 'offline',
      tunnel: 'disconnected',
      latency: -1,
      lastCheck: ''
    };
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    logInfo(this.name, `Inicializálás: ${this.config.workerUrl}`);

    // Adatbázis séma inicializálás (ha még nincs meg a tábla)
    try {
      const db: Database = getGlobalDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS edge_tasks (
          task_id TEXT PRIMARY KEY,
          type TEXT,
          status TEXT,
          payload TEXT,
          result TEXT,
          created_at TEXT,
          completed_at TEXT,
          synced_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_edge_tasks_status ON edge_tasks(status);
      `);
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Adatbázis hiba: ${err.message}`);
    }

    // Kezdeti health check
    await this.checkHealth();

    // Periodikus health check
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(
        () => this.checkHealth(),
        this.config.healthCheckInterval
      );
    }
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    logInfo(this.name, 'Leállítva');
  }

  // --------------------------------------------------------------------------
  // MAIN EXECUTION
  // --------------------------------------------------------------------------

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task?.toLowerCase() || '';
    setAgentStatus(this.name, 'working', task);

    try {
      // Command routing
      if (task.includes('health') || task.includes('status')) {
        return await this.getEdgeStatus();
      }

      if (task.startsWith('dispatch')) {
        return await this.handleDispatchCommand(context);
      }

      if (task.includes('submit') || task.includes('task')) {
        return await this.submitTask(context);
      }

      if (task.includes('sync') || task.includes('szinkron')) {
        return await this.syncWithEdge();
      }

      if (task.includes('test') || task.includes('teszt')) {
        return await this.runEdgeTest();
      }

      // Default: show help
      return this.showHelp();

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Hiba: ${err.message}`);
      setAgentStatus(this.name, 'error');
      return {
        success: false,
        message: `EdgeProxy hiba: ${err.message}`,
        data: null
      };
    }
  }

  /**
   * Új dispatch flow: konkrét ágens hívása az Edge-en keresztül
   */
  private async handleDispatchCommand(context: AgentContext): Promise<AgentResult> {
    const parts = context.task?.split(' ') || [];
    const agentName = parts[1];
    const agentTask = parts.slice(2).join(' ');

    if (!agentName || !agentTask) {
      return {
        success: false,
        message: 'Használat: dispatch <AgentName> <feladat>',
        data: null
      };
    }

    logInfo(this.name, `Delegálás az Edge-re: ${agentName} -> ${agentTask}`);

    try {
      const edgeContext = (context.context as Record<string, unknown> | undefined) ?? {};
      const result = await cloudflareClient.dispatch(agentName, agentTask, edgeContext);
      return {
        success: true,
        message: `Edge dispatch sikeres: ${agentName}`,
        data: result
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Edge dispatch hiba: ${err.message}`);
      return {
        success: false,
        message: `Edge dispatch hiba: ${err.message}`,
        data: null
      };
    }
  }

  // --------------------------------------------------------------------------
  // CORE FUNCTIONS
  // --------------------------------------------------------------------------

  /**
   * Edge health check
   */
  async checkHealth(): Promise<EdgeHealth> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.workerUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000)
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json() as unknown;
        this.health = {
          edge: 'healthy',
          tunnel: isRecord(data) ? normalizeTunnelStatus(data.tunnel) : 'unknown',
          latency,
          lastCheck: new Date().toISOString()
        };
      } else {
        this.health.edge = 'degraded';
        this.health.latency = latency;
      }
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(this.name, `Edge health check failed: ${err.message}`);
      this.health = {
        edge: 'offline',
        tunnel: 'disconnected',
        latency: -1,
        lastCheck: new Date().toISOString()
      };
    }

    return this.health;
  }

  /**
   * Edge státusz lekérdezése
   */
  private async getEdgeStatus(): Promise<AgentResult> {
    logInfo(this.name, 'Edge státusz lekérdezése...');

    await this.checkHealth();

    const statusIcon = this.health.edge === 'healthy' ? '✅' :
      this.health.edge === 'degraded' ? '⚠️' : '❌';

    const report = `
# 🌐 Cloudflare Edge Státusz

**Worker URL:** ${this.config.workerUrl}
**Státusz:** ${statusIcon} ${this.health.edge}
**Tunnel:** ${this.health.tunnel === 'connected' ? '✅' : '❌'} ${this.health.tunnel}
**Latency:** ${this.health.latency}ms
**Utolsó ellenőrzés:** ${this.health.lastCheck}

## Konfiguráció
- **Tunnel engedélyezve:** ${this.config.tunnelEnabled}
- **Lokális fallback:** ${this.config.fallbackToLocal}
- **Health check intervallum:** ${this.config.healthCheckInterval}ms
`;

    return {
      success: true,
      message: `Edge státusz: ${this.health.edge}`,
      data: { health: this.health, report }
    };
  }

  /**
   * Task beküldése az edge-re
   */
  async submitTask(context: AgentContext): Promise<AgentResult> {
    logInfo(this.name, 'Task beküldése az edge-re...');

    // Edge elérhetőség ellenőrzése
    if (this.health.edge === 'offline') {
      await this.checkHealth();
    }

    if (this.health.edge === 'offline' && this.config.fallbackToLocal) {
      logInfo(this.name, 'Edge offline, lokális fallback...');
      return {
        success: false,
        message: 'Edge nem elérhető, lokális feldolgozás szükséges',
        data: { fallback: true }
      };
    }

    try {
      const edgeContext = isRecord(context.context) ? { ...context.context } : {};
      const payload: JsonRecord = {
        instruction: context.task,
        context: edgeContext,
        source: 'brunella-core',
        timestamp: new Date().toISOString()
      };

      // Add tunnel callback URLs if available
      if (this.config.tunnelEnabled && this.config.tunnelUrl) {
        payload.callbackUrls = {
          api: this.config.tunnelUrl,
          n8n: this.config.tunnelN8nUrl,
          browser: this.config.tunnelBrowserUrl,
          dashboard: this.config.tunnelDashboardUrl
       };
        logInfo(this.name, `Tunnel callback URL-ek hozzáadva: ${this.config.tunnelUrl}`);
      }

      const response = await fetch(`${this.config.workerUrl}/task`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`Edge error: ${response.status}`);
      }

      const result = normalizeEdgeTask(await response.json());
      if (!result) {
        throw new Error('Invalid edge task response');
      }

      logInfo(this.name, `Task beküldve: ${result.taskId}`);

      return {
        success: true,
        message: `Task sikeresen beküldve: ${result.taskId}`,
        data: { task: result }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Task beküldés sikertelen: ${err.message}`);

      if (this.config.fallbackToLocal) {
       return {
         success: false,
          message: `Edge hiba, lokális fallback: ${err.message}`,
          data: { fallback: true, error: err.message }
       };
      }

      throw err;
    }
  }

  /**
   * Task státusz lekérdezése
   */
  async getTaskStatus(taskId: string): Promise<EdgeTask | null> {
    try {
      const response = await fetch(`${this.config.workerUrl}/status/${taskId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        return normalizeEdgeTask(await response.json());
      }

      return null;
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(this.name, `Task status lookup failed for ${taskId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Szinkronizálás az edge-gel
   */
  private async syncWithEdge(): Promise<AgentResult> {
    logInfo(this.name, 'Szinkronizálás az edge-gel...');

    // Health check
    await this.checkHealth();

    if (this.health.edge === 'offline') {
      return {
        success: false,
        message: 'Edge nem elérhető',
        data: { health: this.health }
      };
    }

    try {
      const db = getGlobalDb();
      const existingPendingTasks = db
        .prepare("SELECT task_id FROM edge_tasks WHERE status IN ('pending', 'dispatched')")
        .all() as { task_id: string }[];
      let syncedCount = 0;
      let updatedCount = 0;

      // 1. Fetch history from Cloudflare Worker
      const response = await fetch(`${this.config.workerUrl}/history?limit=50`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const tasks = normalizeEdgeTaskList(await response.json());

        const stmt = db.prepare(`
          INSERT INTO edge_tasks (task_id, type, status, payload, result, created_at, completed_at, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(task_id) DO UPDATE SET
            status = excluded.status,
            result = excluded.result,
            completed_at = excluded.completed_at,
            synced_at = datetime('now')
        `);

        const insertMany = db.transaction((tasks: EdgeTask[]) => {
          for (const task of tasks) {
            stmt.run(
              task.taskId,
              task.type || 'unknown',
              task.status,
              JSON.stringify(task.payload || {}),
              JSON.stringify(task.result || null),
              task.createdAt || new Date().toISOString(),
              task.completedAt || null
           );
          }
        });

        insertMany(tasks);
        syncedCount = tasks.length;
      }

      // 2. Update only tasks that were already pending before the sync
      const updateStmt = db.prepare(`
        UPDATE edge_tasks
        SET status = ?, result = ?, completed_at = ?, synced_at = datetime('now')
        WHERE task_id = ?
      `);

      for (const { task_id } of existingPendingTasks) {
        const taskStatus = await this.getTaskStatus(task_id);
        if (taskStatus) {
          updateStmt.run(
            taskStatus.status,
            JSON.stringify(taskStatus.result || null),
            taskStatus.completedAt || null,
            task_id
          );
          updatedCount++;
        }
      }

      logInfo(this.name, `Szinkronizálás kész: ${syncedCount} új/frissített, ${updatedCount} státusz ellenőrzött`);

      return {
        success: true,
        message: 'Szinkronizálás befejezve',
        data: {
          health: this.health,
          stats: { syncedCount, updatedCount }
        }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Szinkronizálási hiba: ${err.message}`);
      return {
        success: false,
        message: `Szinkronizálási hiba: ${err.message}`,
        data: { health: this.health }
      };
    }
  }

  /**
   * Edge kapcsolat tesztelése
   */
  private async runEdgeTest(): Promise<AgentResult> {
    logInfo(this.name, 'Edge kapcsolat tesztelése...');

    const tests = [
      { name: 'Health Check', fn: () => this.checkHealth() },
      { name: 'Task Submit', fn: () => this.submitTask({ task: 'test', context: {} } as AgentContext) },
    ];

    const results: Array<{ test: string; success: boolean; duration: number; error?: string }> = [];

    for (const test of tests) {
      const start = Date.now();
      try {
        await test.fn();
        results.push({
          test: test.name,
          success: true,
          duration: Date.now() - start
        });
      } catch (error: unknown) {
        const err = ensureError(error);
        results.push({
          test: test.name,
         success: false,
          duration: Date.now() - start,
          error: err.message
        });
      }
    }

    const allPassed = results.every(r => r.success);

    return {
      success: allPassed,
      message: `Edge teszt: ${allPassed ? 'PASSED' : 'FAILED'}`,
      data: { results }
    };
  }

  // --------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------------------------------

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'User-Agent': 'Brunella-Core/1.0'
    };

    if (this.config.apiKey) {
      headers['X-BAS-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  private showHelp(): AgentResult {
    const helpText = `
# EdgeProxy Agent - Súgó

## Elérhető parancsok:

| Parancs | Leírás |
|---------|--------|
| \`health\` / \`status\` | Edge státusz lekérdezése |
| \`submit [task]\` | Task beküldése az edge-re |
| \`sync\` | Szinkronizálás az edge-gel |
| \`test\` | Edge kapcsolat tesztelése |

## Konfiguráció (.env):

\`\`\`
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.workers.dev
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_API_KEY=your-api-key
\`\`\`
`;

    return {
      success: true,
      message: 'EdgeProxy súgó',
      data: { help: helpText }
    };
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  isEdgeHealthy(): boolean {
    return this.health.edge === 'healthy';
  }

  isTunnelConnected(): boolean {
    return this.health.tunnel === 'connected';
  }

  getHealth(): EdgeHealth {
    return { ...this.health };
  }
}

export default EdgeProxyAgent;

