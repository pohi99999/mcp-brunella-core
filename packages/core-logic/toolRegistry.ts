import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logWarn } from '@packages/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface UniversalToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

interface RegistryAgent {
  name: string;
  description?: string;
  role?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

interface RegistryFile {
  version?: number;
  agents?: RegistryAgent[];
}

const SYSTEM_TOOLS: UniversalToolDefinition[] = [
  {
    name: 'get_system_status',
    description: 'Rendszer állapot lekérdezése: futó agentok, health check, build állapot, aktív feladatok száma.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_active_tasks',
    description: 'Listázza az éppen futó és sorban álló feladatokat az összes agentben.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'run_full_test_suite',
    description: 'Lefuttatja a teljes tesztcsomagot (npm run build + npm test) és visszaadja az összefoglalót.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_agent_logs',
    description: 'Visszaadja egy adott agent utolsó N log sorát.',
    parameters: {
      type: 'object',
      properties: {
        agentName: { type: 'string', description: 'Az agent neve (pl. RobotkezV2Agent)' },
        lines: { type: 'string', description: 'Visszaadandó sorok száma (alapértelmezett: 20)' }
      },
      required: ['agentName']
    }
  }
];

const CF_WORKER_TOOLS: UniversalToolDefinition[] = [
  'CEAN', 'D1Bridge', 'AI', 'Browser', 'Tunnel', 'AIGateway',
  'R2', 'KV', 'Vectorize', 'DurableObjects', 'Queue', 'Pages'
].map(name => ({
  name: `delegate_CloudflareWorker_${name}`,
  description: `Cloudflare Worker delegálás: ${name}. Felhőalapú edge végrehajtás Cloudflare infrastruktúrán.`,
  parameters: {
    type: 'object' as const,
    properties: {
      task: { type: 'string', description: 'Elvégzendő feladat leírása' }
    },
    required: ['task']
  }
}));

export function getFallbackToolDefinitions(): UniversalToolDefinition[] {
  return [...SYSTEM_TOOLS, ...CF_WORKER_TOOLS];
}

export class ToolRegistry {
  private tools: UniversalToolDefinition[] = [];
  private registryPath: string;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.registryPath = path.resolve(process.cwd(), 'packages', 'agents', 'registry.json');
  }

  async init(): Promise<void> {
    await this.loadTools();
    this.setupWatcher();
  }

  private async loadTools(): Promise<void> {
    try {
      const raw = fs.readFileSync(this.registryPath, 'utf-8');
      const parsed = JSON.parse(raw) as RegistryFile | RegistryAgent[];

      // Support both formats: plain array OR { version, agents: [...] }
      let agentList: RegistryAgent[];
      if (Array.isArray(parsed)) {
        agentList = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.agents)) {
        agentList = parsed.agents;
      } else {
        logWarn('ToolRegistry', 'registry.json ismeretlen formátum, üres agent lista használva');
        agentList = [];
      }

      const agentTools: UniversalToolDefinition[] = agentList.map(agent => ({
        name: `delegate_${agent.name}`,
        description: agent.description || agent.role || `${agent.name} agent delegálása`,
        parameters: {
          type: 'object' as const,
          properties: {
            task: { type: 'string', description: 'Elvégzendő feladat részletes leírása magyarul' }
          },
          required: ['task']
        }
      }));

      this.tools = [...SYSTEM_TOOLS, ...agentTools, ...CF_WORKER_TOOLS];
      logInfo('ToolRegistry', `${this.tools.length} tool betöltve (${agentTools.length} agent + ${SYSTEM_TOOLS.length} rendszer + ${CF_WORKER_TOOLS.length} CF worker)`);
    } catch (e: unknown) {
      logWarn('ToolRegistry', `registry.json betöltési hiba: ${e instanceof Error ? e.message : String(e)}`);
      this.tools = getFallbackToolDefinitions();
    }
  }

  private setupWatcher(): void {
    try {
      this.watcher = fs.watch(this.registryPath, () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => { void this.loadTools(); }, 300);
      });
    } catch {
      // Windows fallback: polling
      this.pollTimer = setInterval(() => { void this.loadTools(); }, 500);
    }
  }

  getToolDefinitions(): UniversalToolDefinition[] {
    return this.tools;
  }

  destroy(): void {
    this.watcher?.close();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}

let _registry: ToolRegistry | null = null;
export async function getToolRegistry(): Promise<ToolRegistry> {
  if (!_registry) {
    _registry = new ToolRegistry();
    await _registry.init();
  }
  return _registry;
}

/**
 * Execute a locally-registered tool by name.
 * This is a thin stub — the real implementation lives in apps/mcp-core/server/registry.ts.
 * Returns undefined if the tool has no registered handler in this package.
 */
export async function executeLocalTool(
  _name: string,
  _args: unknown,
  _ctx?: { agentName?: string; requestId?: string; metadata?: Record<string, unknown> },
): Promise<unknown> {
  return undefined;
}
