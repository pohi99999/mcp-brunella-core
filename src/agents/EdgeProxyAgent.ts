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
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { getGlobalDb } from '../utils/globalDb.js';
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
  tunnel: 'connected' | 'disconnected';
  latency: number;
  lastCheck: string;
}

interface EdgeTask {
  taskId: string;
  type: string;
  status: 'pending' | 'dispatched' | 'completed' | 'failed';
  payload: any;
  result?: any;
  createdAt: string;
  completedAt?: string;
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
      const db = getGlobalDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS edge_tasks (
          taskId TEXT PRIMARY KEY,
          type TEXT,
          status TEXT,
          payload TEXT,
          result TEXT,
          createdAt TEXT,
          completedAt TEXT,
          syncedAt TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_edge_tasks_status ON edge_tasks(status);
      `);
    } catch (error) {
      logError(this.name, `Adatbázis hiba: ${error}`);
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

    } catch (error) {
      logError(this.name, `Hiba: ${error}`);
      setAgentStatus(this.name, 'error');
      return {
        success: false,
        message: `EdgeProxy hiba: ${error}`,
        data: null
      };
    } finally {
      setAgentStatus(this.name, 'idle');
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
        const data = await response.json() as any;
        this.health = {
          edge: 'healthy',
          tunnel: data.tunnel || 'unknown',
          latency,
          lastCheck: new Date().toISOString()
        };
      } else {
        this.health.edge = 'degraded';
        this.health.latency = latency;
      }
    } catch (error) {
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
      const payload: any = {
        instruction: context.task,
        context: context.context || {},
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

      const result = await response.json() as EdgeTask;

      logInfo(this.name, `Task beküldve: ${result.taskId}`);

      return {
        success: true,
        message: `Task sikeresen beküldve: ${result.taskId}`,
        data: { task: result }
      };

    } catch (error) {
      logError(this.name, `Task beküldés sikertelen: ${error}`);

      if (this.config.fallbackToLocal) {
        return {
          success: false,
          message: `Edge hiba, lokális fallback: ${error}`,
          data: { fallback: true, error: String(error) }
        };
      }

      throw error;
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
        return await response.json() as EdgeTask;
      }

      return null;
    } catch {
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

      // 1. Fetch history from Edge
      const response = await fetch(`${this.config.workerUrl}/history`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`History fetch failed: ${response.status}`);
      }

      const tasks = await response.json() as EdgeTask[];

      // 2. Upsert fetched tasks to local DB
      const insert = db.prepare(`
        INSERT INTO edge_tasks (taskId, type, status, payload, result, createdAt, completedAt, syncedAt)
        VALUES (@taskId, @type, @status, @payload, @result, @createdAt, @completedAt, datetime('now'))
        ON CONFLICT(taskId) DO UPDATE SET
          status = excluded.status,
          result = excluded.result,
          completedAt = excluded.completedAt,
          syncedAt = datetime('now')
      `);

      const transaction = db.transaction((taskList: EdgeTask[]) => {
        for (const task of taskList) {
          insert.run({
            taskId: task.taskId,
            type: task.type || 'unknown',
            status: task.status,
            payload: JSON.stringify(task.payload),
            result: JSON.stringify(task.result),
            createdAt: task.createdAt,
            completedAt: task.completedAt || null
          });
        }
      });

      transaction(tasks);
      logInfo(this.name, `${tasks.length} task szinkronizálva az edge-ről`);

      // 3. Check for pending tasks locally and poll for updates
      const pendingTasks = db.prepare("SELECT taskId FROM edge_tasks WHERE status = 'pending'").all() as { taskId: string }[];

      let updatedCount = 0;
      for (const pending of pendingTasks) {
        const currentStatus = await this.getTaskStatus(pending.taskId);

        if (currentStatus && currentStatus.status !== 'pending') {
          insert.run({
            taskId: currentStatus.taskId,
            type: currentStatus.type || 'unknown',
            status: currentStatus.status,
            payload: JSON.stringify(currentStatus.payload),
            result: JSON.stringify(currentStatus.result),
            createdAt: currentStatus.createdAt,
            completedAt: currentStatus.completedAt || null
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        logInfo(this.name, `${updatedCount} pending task frissítve`);
      }

      return {
        success: true,
        message: 'Szinkronizálás befejezve',
        data: {
          health: this.health,
          syncedCount: tasks.length,
          updatedPendingCount: updatedCount
        }
      };

    } catch (error) {
      logError(this.name, `Szinkronizációs hiba: ${error}`);
      return {
        success: false,
        message: `Szinkronizációs hiba: ${error}`,
        data: { error: String(error) }
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
      } catch (error) {
        results.push({
          test: test.name,
          success: false,
          duration: Date.now() - start,
          error: String(error)
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
