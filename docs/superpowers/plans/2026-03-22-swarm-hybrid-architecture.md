# Swarm Hybrid Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brunella hibrid Swarm architektúra megépítése: VSCode MCP konfiguráció javítása, SwarmManager bekötése, Enterprise Event Bus, és CEAN Edge Agents Phoenix fallbackkel.

**Architecture:** A meglévő SwarmAgent/SwarmManager kód (Phase 5) bekötésre kerül az AgentManagerbe és MCP toolként elérhetővé válik. SQLite WAL-alapú EventBus biztosítja a real-time Dashboard frissítést. CEAN Cloudflare Workers Edge fallbackként szolgál, Phoenix Protocol automatikusan vált Ollama → CEAN között.

**Tech Stack:** TypeScript (ESM, `import ... from './foo.js'`), Express 5, Socket.IO, MCP SDK (`SSEServerTransport`), Zod, better-sqlite3, Cloudflare Workers (`@cloudflare/workers-types`), Vitest

---

## Fájl Térkép

### Phase 1 — MCP Config Fix
| Fájl | Változás |
|------|----------|
| `.vscode/mcp.json` | Teljes újraírás — hibás bejegyzések ki, filesystem/brunella/sequential-thinking be |
| `.vscode/settings.json` | `chat.mcp.serverSampling` kulcsa `brunella-python` → `brunella` |

### Phase 2 — Swarm Bekötés + Dashboard + CLI
| Fájl | Változás |
|------|----------|
| `src/agents/swarm/SwarmManager.ts` | `'paused'` status + `pauseAllColonies()` + `resumeAllColonies()` + Triád init helper |
| `src/agents/AgentManager.ts` | `swarmManager` singleton exportálása + Triád kolónia inicializálás |
| `src/tools/swarmTools.ts` | `swarm_dispatch` + `swarm_status` MCP tool hozzáadása |
| `src/server/routes/swarm.ts` | ÚJ — `GET /api/v1/swarm/status`, `POST /api/v1/swarm/dispatch` |
| `src/server/web.ts` | `v1Router.use('/swarm', swarmRouter)` mount |
| `src/dashboard/components/dashboard/SwarmStatusWidget.tsx` | ÚJ — kolónia státusz widget |
| `src/dashboard/lib/widgetRegistry.tsx` | `swarm_status` bejegyzés |
| `src/cli/swarmCommands.ts` | ÚJ — `brunella swarm status/dispatch` |
| `src/cli.ts` | `registerSwarmCommands` import + hívás |

### Phase 3 — Enterprise Event Bus
| Fájl | Változás |
|------|----------|
| `src/core/eventBus.ts` | ÚJ — SQLite WAL event bus |
| `src/agents/swarm/SwarmManager.ts` | `eventBus.emit()` hívások kolónia eseményeknél |
| `src/agents/AgentManager.ts` | `eventBus.emit()` hívások task state változásokhoz |
| `src/server/SocketService.ts` | EventBus → WebSocket broadcast bridge |

### Phase 4 — CEAN Edge + Phoenix Fallback
| Fájl | Változás |
|------|----------|
| `src/core/bifrost_gateway.ts` | `setMode(mode)` metódus hozzáadása (pre-requisite) |
| `src/core/ceanFallback.ts` | ÚJ — Phoenix degraded/recovery handler modul |
| `workers/cean-router/index.ts` | ÚJ — API Gateway Worker |
| `workers/cean-harvest/index.ts` | ÚJ — Scheduled harvest Worker |
| `workers/cean-research/index.ts` | ÚJ — edge ResearcherAgent |
| `workers/cean-refine/index.ts` | ÚJ — edge DataScientist |
| `src/server/routes/harvest.ts` | ÚJ — harvest sync endpoint |
| `src/server/web.ts` | harvest router mount |
| `docker-compose.yml` | github-mcp service hozzáadás |
| `.env` | `CEAN_WORKER_URL`, `CEAN_API_KEY` dokumentálás |

---

## Task 1: VSCode MCP Konfiguráció Javítása

**Files:**
- Modify: `.vscode/mcp.json`
- Modify: `.vscode/settings.json`

**Kontextus:** A jelenlegi `mcp.json` 3 hibás bejegyzést tartalmaz (`brunella-python`, `my-mcp-server-ae032121`, `filesystem` placeholder útvonalakkal) és duplikált GitHub MCP szervert (`io.github.github/github-mcp-server` + `github`). A Brunella SSE endpoint már létezik a `web.ts:359`-ben (`GET /sse`).

- [ ] **Step 1: Biztonsági mentés és ellenőrzés**

```bash
cp .vscode/mcp.json .vscode/mcp.json.bak
cat .vscode/mcp.json
```

Ellenőrizd a meglévő bejegyzéseket. A következőket fogod eltávolítani:
- `brunella-python` (nem létező `myai.mcp_server` modul)
- `my-mcp-server-ae032121` (törött command)
- `filesystem` (placeholder `/Users/username/Desktop` útvonal)
- `github` (duplikált — marad az `io.github.github/github-mcp-server`)

- [ ] **Step 2: mcp.json teljes újraírása**

Cseréld le az egész fájl tartalmát:

```json
{
  "servers": {
    "brunella": {
      "type": "http",
      "url": "http://localhost:3000/sse"
    },
    "io.github.ChromeDevTools/chrome-devtools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "--registry",
        "https://registry.npmjs.org",
        "chrome-devtools-mcp@0.17.0"
      ],
      "gallery": "https://api.mcp.github.com",
      "version": "0.17.0"
    },
    "io.github.wonderwhy-er/desktop-commander": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "--registry",
        "https://registry.npmjs.org",
        "@wonderwhy-er/desktop-commander@0.2.35"
      ],
      "gallery": "https://api.mcp.github.com",
      "version": "0.2.35"
    },
    "io.github.upstash/context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["@upstash/context7-mcp@1.0.31"],
      "env": {
        "CONTEXT7_API_KEY": "${input:CONTEXT7_API_KEY}"
      },
      "gallery": "https://api.mcp.github.com",
      "version": "1.0.31"
    },
    "io.github.github/github-mcp-server": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN=${input:github_token}",
        "ghcr.io/github/github-mcp-server:0.31.0"
      ],
      "gallery": "https://api.mcp.github.com",
      "version": "0.31.0"
    },
    "io.github.vercel/next-devtools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["next-devtools-mcp@0.3.6"],
      "gallery": "https://api.mcp.github.com",
      "version": "0.3.6"
    },
    "cloudflare": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_ACCOUNT_ID": "${input:cloudflareAccountId}",
        "CLOUDFLARE_API_TOKEN": "${input:cloudflareApiToken}"
      }
    },
    "sqlite": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "data/brunella.db"]
    },
    "fetch": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": "data/mcp_memory.json"
      }
    },
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y", "@modelcontextprotocol/server-filesystem",
        "F:\\mcp-brunella-core",
        "C:\\Users\\pohi9"
      ]
    },
    "microsoft/playwright-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "gallery": "https://api.mcp.github.com",
      "version": "0.0.1-seed"
    }
  },
  "inputs": [
    {
      "id": "github_token",
      "type": "promptString",
      "description": "GitHub Personal Access Token (repo/issues scope)",
      "password": true
    },
    {
      "id": "CONTEXT7_API_KEY",
      "type": "promptString",
      "description": "Context7 API key",
      "password": true
    },
    {
      "id": "cloudflareAccountId",
      "type": "promptString",
      "description": "Cloudflare Account ID",
      "password": false
    },
    {
      "id": "cloudflareApiToken",
      "type": "promptString",
      "description": "Cloudflare API Token (Workers/KV/D1/R2 permissions)",
      "password": true
    }
  ]
}
```

- [ ] **Step 3: settings.json javítása**

A `.vscode/settings.json`-ban keresd meg a `chat.mcp.serverSampling` kulcsot. Cseréld a `brunella-python` bejegyzést `brunella`-ra:

```json
// Keresendő sor (körülbelül):
"brunella-python": { ... }
// Cserélendő:
"brunella": { ... }
```

Futtatás: `grep -n "brunella-python\|serverSampling" .vscode/settings.json`
Ha megtaláltad, szerkeszd a fájlt és nevezd át.

- [ ] **Step 4: Manuális ellenőrzés VSCode-ban**

1. Nyisd meg a VSCode Copilot Chat panelt
2. Kattints az MCP ikon melletti fogaskerékre
3. Ellenőrizd, hogy a `brunella` szerver megjelenik HTTP típussal
4. Ellenőrizd, hogy `filesystem`, `sequential-thinking`, `memory` is megjelenik

- [ ] **Step 5: Commit**

```bash
git add .vscode/mcp.json .vscode/settings.json
git commit -m "fix(mcp): rewite mcp.json - remove broken entries, add brunella SSE + sequential-thinking + filesystem"
```

---

## Task 2: SwarmManager Bővítése (pause/resume + Triád)

**Files:**
- Modify: `src/agents/swarm/SwarmManager.ts`

**Kontextus:** A jelenlegi `SwarmColony.status` union: `'forming' | 'active' | 'degraded' | 'dissolved'`. Hiányzik a `'paused'` állapot. A `pauseAllColonies()` és `resumeAllColonies()` metódusok szükségesek a Phoenix Protocol failoverhez.

- [ ] **Step 1: Teszt írása (failing)**

Hozd létre: `test/swarmManager.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmManager } from '../src/agents/swarm/SwarmManager.js';
import { SwarmAgent } from '../src/agents/swarm/SwarmAgent.js';

describe('SwarmManager', () => {
  let manager: SwarmManager;

  beforeEach(() => {
    manager = new SwarmManager();
  });

  it('pauseAllColonies sets all active colonies to paused', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.createColony({ swarmId: 'c2', name: 'Beta', objective: 'test' });
    // Force active status
    manager.getColony('c1')!.status = 'active';
    manager.getColony('c2')!.status = 'active';

    manager.pauseAllColonies();

    expect(manager.getColony('c1')!.status).toBe('paused');
    expect(manager.getColony('c2')!.status).toBe('paused');
  });

  it('resumeAllColonies restores paused colonies to active', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.getColony('c1')!.status = 'paused';

    manager.resumeAllColonies();

    expect(manager.getColony('c1')!.status).toBe('active');
  });

  it('dissolved colony is not affected by pause/resume', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.getColony('c1')!.status = 'dissolved';

    manager.pauseAllColonies();
    expect(manager.getColony('c1')!.status).toBe('dissolved');

    manager.resumeAllColonies();
    expect(manager.getColony('c1')!.status).toBe('dissolved');
  });

  it('createTriadColony creates colony with researcher/DataScientist/Developer', () => {
    const config = SwarmManager.getTriadConfig();
    expect(config.name).toBe('Triad');
    expect(config.agentIds).toContain('researcher');
    expect(config.agentIds).toContain('DataScientist');
    expect(config.agentIds).toContain('Developer');
  });
});
```

- [ ] **Step 2: Teszt futtatása (kell, hogy FAIL)**

```bash
npx vitest run test/swarmManager.test.ts
```

Várt kimenet: `FAIL — pauseAllColonies is not a function`

- [ ] **Step 3: SwarmManager módosítása**

Nyisd meg: `src/agents/swarm/SwarmManager.ts`

**3a.** A `SwarmColony.status` union-ban add hozzá a `'paused'`-ot (sor ~22):
```typescript
status: 'forming' | 'active' | 'degraded' | 'dissolved' | 'paused';
```

**3b.** A `submitTask` metódusban a `dissolved` check mellé add a `paused` ellenőrzést is (sor ~148):
```typescript
if (!colony || colony.status === 'dissolved' || colony.status === 'paused') {
```

**3c.** A `dissolveColony` metódus UTÁN add hozzá a két új metódust (sor ~218 körül):

```typescript
/** Pause all active colonies (Phoenix Protocol failover) */
pauseAllColonies(): void {
  for (const colony of this.colonies.values()) {
    if (colony.status === 'active' || colony.status === 'forming') {
      colony.status = 'paused';
      logInfo('SwarmManager', `Colony ${colony.swarmId} paused`);
      this.emit('colony:paused', colony);
    }
  }
}

/** Resume all paused colonies (Phoenix Protocol recovery) */
resumeAllColonies(): void {
  for (const colony of this.colonies.values()) {
    if (colony.status === 'paused') {
      colony.status = 'active';
      logInfo('SwarmManager', `Colony ${colony.swarmId} resumed`);
      this.emit('colony:resumed', colony);
    }
  }
}

/** Returns the default Triád colony configuration */
static getTriadConfig(): { name: string; agentIds: string[] } {
  return {
    name: 'Triad',
    agentIds: ['researcher', 'DataScientist', 'Developer'],
  };
}
```

- [ ] **Step 4: Tesztek futtatása (kell PASS)**

```bash
npx vitest run test/swarmManager.test.ts
```

Várt: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/agents/swarm/SwarmManager.ts test/swarmManager.test.ts
git commit -m "feat(swarm): add pause/resume colony support + Triád static config"
```

---

## Task 3: SwarmManager Singleton az AgentManagerben

**Files:**
- Modify: `src/agents/AgentManager.ts`

**Kontextus:** A SwarmManager jelenleg nem inicializált. Az AgentManagerből exportálni kell egy singleton példányt, ami elérhető a registry.ts és a Phoenix handler számára.

- [ ] **Step 1: Teszt írása (failing)**

Add hozzá a `test/swarmManager.test.ts` fájlhoz:

```typescript
import { swarmManager } from '../src/agents/AgentManager.js';

it('AgentManager exports swarmManager singleton', () => {
  expect(swarmManager).toBeDefined();
  expect(typeof swarmManager.listColonies).toBe('function');
});
```

- [ ] **Step 2: Teszt futtatása (kell FAIL)**

```bash
npx vitest run test/swarmManager.test.ts
```

Várt: `FAIL — swarmManager is not exported`

- [ ] **Step 3: AgentManager módosítása**

Nyisd meg: `src/agents/AgentManager.ts`

Az importok aljára, de az `AgentManager` class előtt add hozzá:
```typescript
import { SwarmManager } from './swarm/SwarmManager.js';
```

A fájl végén, az exportok részen (ahol az `agentManager` is exportálva van), add hozzá:
```typescript
export const swarmManager = new SwarmManager();
```

Majd az `initializeAgentManager` function-ban (vagy az `AgentManager` `initialize()` metódusában), a Triád kolónia előkészítéséhez add hozzá (a végén, de az `await agentManager.initialize()` UTÁN):

```typescript
// Triád kolónia inicializálás
const triadConfig = SwarmManager.getTriadConfig();
swarmManager.createColony({
  swarmId: 'triad-default',
  name: triadConfig.name,
  objective: 'General purpose: research, data analysis, development',
});
logInfo('System', `Triad colony initialized: ${triadConfig.agentIds.join(', ')}`);
```

- [ ] **Step 4: Build ellenőrzés**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 5: Tesztek futtatása**

```bash
npx vitest run test/swarmManager.test.ts
```

Várt: mind PASS

- [ ] **Step 6: Commit**

```bash
git add src/agents/AgentManager.ts
git commit -m "feat(swarm): export swarmManager singleton + initialize Triad colony on startup"
```

---

## Task 4: swarm_dispatch + swarm_status MCP Tools

**Files:**
- Modify: `src/tools/swarmTools.ts`

**Kontextus:** A `swarmTools.ts` jelenleg csak `swarm_ingest` tartalmaz (browser → knowledge store pipeline). Hozzá kell adni `swarm_dispatch` és `swarm_status` toolokat, amelyek a `swarmManager` singletonon keresztül működnek.

- [ ] **Step 1: Teszt írása (failing)**

Hozd létre: `test/swarmTools.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock AgentManager BEFORE importing swarmTools
vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { initialize: vi.fn() },
  swarmManager: {
    listColonies: vi.fn(() => [
      { swarmId: 'triad-default', name: 'Triad', status: 'active', agents: new Map(), leaderId: null,
        metrics: { tasksCompleted: 2, tasksFailed: 0, avgDurationMs: 50, throughput: 1, lastActivity: Date.now() } }
    ]),
    submitTask: vi.fn(async () => ({ status: 'success', result: 'done', durationMs: 100, agentId: 'researcher', taskId: 'task-1' })),
    nextTaskId: vi.fn(() => 'task-123'),
    getColony: vi.fn((id: string) => id === 'triad-default'
      ? { swarmId: id, name: 'Triad', status: 'active', agents: new Map(), leaderId: null }
      : undefined),
  }
}));

// Mock config/rag imports used by swarmTools
vi.mock('../src/config/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('../src/utils/rag.js', () => ({ addToIndex: vi.fn() }));

describe('swarmTools MCP registration', () => {
  it('registerSwarmTools registers swarm_dispatch, swarm_status, and swarm_ingest', async () => {
    const registeredTools: string[] = [];
    const mockServer = {
      tool: vi.fn((name: string) => { registeredTools.push(name); return mockServer; })
    };

    const { registerSwarmTools } = await import('../src/tools/swarmTools.js');
    registerSwarmTools(mockServer as any);

    expect(registeredTools).toContain('swarm_ingest');
    expect(registeredTools).toContain('swarm_dispatch');
    expect(registeredTools).toContain('swarm_status');
  });

  it('swarm_status returns colony list via handler', async () => {
    let statusHandler: (() => Promise<unknown>) | null = null;
    const mockServer = {
      tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: () => Promise<unknown>) => {
        if (name === 'swarm_status') statusHandler = handler;
        return mockServer;
      })
    };

    const { registerSwarmTools } = await import('../src/tools/swarmTools.js');
    registerSwarmTools(mockServer as any);

    expect(statusHandler).not.toBeNull();
    const result = await statusHandler!() as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(1);
    expect(parsed.colonies[0].name).toBe('Triad');
  });
});
```

- [ ] **Step 2: swarmTools.ts módosítása** (ezt a Step 4-ben hajtsd végre)

Nyisd meg: `src/tools/swarmTools.ts`

Az import rész elejére add hozzá:
```typescript
import { swarmManager } from '../agents/AgentManager.js';
```

A meglévő `registerSwarmTools` function-ban, a `swarm_ingest` tool UTÁN add hozzá:

```typescript
  // swarm_dispatch: kolónia indítása feladattal
  server.tool(
    'swarm_dispatch',
    'Triád swarm kolónia indítása feladattal. Competitive bidding alapján a legalkalmasabb agent veszi át a feladatot.',
    {
      task: z.string().describe('A végrehajtandó feladat leírása'),
      swarmId: z.string().optional().describe('Kolónia azonosítója (alapértelmezett: triad-default)'),
      requiredCapabilities: z.array(z.string()).optional().describe('Szükséges képességek szűréséhez'),
    },
    async ({ task, swarmId = 'triad-default', requiredCapabilities = [] }) => {
      try {
        const colony = swarmManager.getColony(swarmId);
        if (!colony) {
          return { isError: true, content: [{ type: 'text' as const, text: `Colony not found: ${swarmId}` }] };
        }
        if (colony.status === 'paused') {
          return { isError: true, content: [{ type: 'text' as const, text: `Colony ${swarmId} is paused (Phoenix failover active)` }] };
        }

        const swarmTask = {
          taskId: swarmManager.nextTaskId(),
          task,
          requiredCapabilities,
          priority: 1,
        };

        const result = await swarmManager.submitTask(swarmId, swarmTask);
        if (!result) {
          return { isError: true, content: [{ type: 'text' as const, text: 'No bids received — no available agents in colony' }] };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ status: result.status, result: result.result, durationMs: result.durationMs }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { isError: true, content: [{ type: 'text' as const, text: `swarm_dispatch error: ${msg}` }] };
      }
    }
  );

  // swarm_status: aktív kolóniák listázása
  server.tool(
    'swarm_status',
    'Összes swarm kolónia és azok állapotának lekérdezése.',
    {},
    async () => {
      const colonies = swarmManager.listColonies().map(c => ({
        swarmId: c.swarmId,
        name: c.name,
        status: c.status,
        agentCount: c.agents.size,
        leaderId: c.leaderId,
        metrics: c.metrics,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ colonies, total: colonies.length }, null, 2) }]
      };
    }
  );
```

- [ ] **Step 3: Teszt futtatása — kell FAIL (a tool még nem létezik)**

```bash
npx vitest run test/swarmTools.test.ts
```

Várt: `FAIL — expect(registeredTools).toContain('swarm_dispatch')`

- [ ] **Step 4: swarmTools.ts módosítása** (lásd Step 2 lent)

- [ ] **Step 5: Build + teszt futtatása — kell PASS**

```bash
npm run build && npx vitest run test/swarmTools.test.ts
```

Várt: build `0 errors`, teszt PASS

- [ ] **Step 6: Commit**

```bash
git add src/tools/swarmTools.ts test/swarmTools.test.ts
git commit -m "feat(mcp): add swarm_dispatch and swarm_status MCP tools"
```

---

## Task 5: Swarm REST API Routes

**Files:**
- Create: `src/server/routes/swarm.ts`
- Modify: `src/server/web.ts`

**Kontextus:** A Dashboard `SwarmStatusWidget` REST API-n keresztül kérdezi le az adatokat (`GET /api/v1/swarm/status`). A `swarm_dispatch` POST is szükséges CLI → REST hídnak.

- [ ] **Step 1: Route fájl létrehozása**

Hozd létre: `src/server/routes/swarm.ts`

```typescript
import express from 'express';
import { swarmManager } from '../../agents/AgentManager.js';
import { logError } from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/v1/swarm/status
 * Összes kolónia állapota
 */
router.get('/status', (_req, res) => {
  try {
    const colonies = swarmManager.listColonies().map(c => ({
      swarmId: c.swarmId,
      name: c.name,
      status: c.status,
      agentCount: c.agents.size,
      leaderId: c.leaderId,
      createdAt: c.createdAt,
      metrics: c.metrics,
    }));
    res.json({ success: true, colonies, total: colonies.length });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('SwarmRoutes', `GET /status: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/v1/swarm/dispatch
 * Feladat küldése a Triád kolóniába
 * Body: { task: string, swarmId?: string }
 */
router.post('/dispatch', async (req, res) => {
  try {
    const { task, swarmId = 'triad-default' } = req.body as { task?: string; swarmId?: string };

    if (!task || typeof task !== 'string') {
      return res.status(400).json({ success: false, error: 'task is required' });
    }

    const colony = swarmManager.getColony(swarmId);
    if (!colony) {
      return res.status(404).json({ success: false, error: `Colony not found: ${swarmId}` });
    }
    if (colony.status === 'paused') {
      return res.status(503).json({ success: false, error: 'Colony paused (Phoenix failover active)' });
    }

    const swarmTask = {
      taskId: swarmManager.nextTaskId(),
      task,
      requiredCapabilities: [],
      priority: 1,
    };

    const result = await swarmManager.submitTask(swarmId, swarmTask);
    if (!result) {
      return res.status(503).json({ success: false, error: 'No bids received' });
    }

    res.json({ success: true, taskId: swarmTask.taskId, result });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('SwarmRoutes', `POST /dispatch: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

export default router;
```

- [ ] **Step 2: web.ts — router mount**

Nyisd meg: `src/server/web.ts`

Az importok között (sor ~60 körül), a többi route import mellé add:
```typescript
import swarmRouter from './routes/swarm.js';
```

A `v1Router.use(...)` blokkban (sor ~196-224 körül), a többi sor mellé add:
```typescript
v1Router.use('/swarm', swarmRouter);
```

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 4: Manuális teszt (szerver indítva legyen!)**

```bash
curl http://localhost:3000/api/v1/swarm/status
```

Várt kimenet (Triád kolónia létezik):
```json
{"success":true,"colonies":[{"swarmId":"triad-default","name":"Triad",...}],"total":1}
```

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/swarm.ts src/server/web.ts
git commit -m "feat(api): add /api/v1/swarm/status and /dispatch REST endpoints"
```

---

## Task 6: SwarmStatusWidget (Dashboard)

**Files:**
- Create: `src/dashboard/components/dashboard/SwarmStatusWidget.tsx`
- Modify: `src/dashboard/lib/widgetRegistry.tsx`

**Kontextus:** EPP v2 Rule 6 — minden új feature Dashboard widget-et kap. Ez egy minimális read-only widget, ami a `/api/v1/swarm/status` endpointot kérdezi le.

- [ ] **Step 1: Widget komponens létrehozása**

Hozd létre: `src/dashboard/components/dashboard/SwarmStatusWidget.tsx`

```tsx
import React, { useEffect, useState, useCallback } from 'react';

interface ColonyInfo {
  swarmId: string;
  name: string;
  status: 'forming' | 'active' | 'degraded' | 'dissolved' | 'paused';
  agentCount: number;
  leaderId: string | null;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
  };
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400',
  forming: 'text-yellow-400',
  degraded: 'text-orange-400',
  paused: 'text-blue-400',
  dissolved: 'text-gray-500',
};

export function SwarmStatusWidget() {
  const [colonies, setColonies] = useState<ColonyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/swarm/status');
      const data = await res.json();
      if (data.success) {
        setColonies(data.colonies);
        setError(null);
      }
    } catch (e) {
      setError('Failed to fetch swarm status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // 5s auto-refresh
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80">Swarm Colonies</h3>
        <span className="text-xs text-white/30">{colonies.length} colony</span>
      </div>

      {loading && <p className="text-xs text-white/40">Loading...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!loading && colonies.length === 0 && (
        <p className="text-xs text-white/30">No active colonies</p>
      )}

      <div className="space-y-2">
        {colonies.map(colony => (
          <div key={colony.swarmId} className="bg-white/5 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/70">{colony.name}</span>
              <span className={`text-xs font-mono ${STATUS_COLOR[colony.status] ?? 'text-white/40'}`}>
                {colony.status}
              </span>
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-white/30">{colony.agentCount} agents</span>
              <span className="text-xs text-white/30">
                {colony.metrics.tasksCompleted}✓ {colony.metrics.tasksFailed}✗
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: WIDGET_REGISTRY regisztráció**

Nyisd meg: `src/dashboard/lib/widgetRegistry.tsx`

Az import-ok végéhez add:
```typescript
import { SwarmStatusWidget } from '@/components/dashboard/SwarmStatusWidget';
```

A `WIDGET_REGISTRY` objektum végéhez add (az utolsó bejegyzés után, vesszővel):
```typescript
  swarm_status: {
    id: 'swarm_status',
    label: 'Swarm Colonies',
    component: SwarmStatusWidget,
    defaultSize: { w: 4, h: 6 }
  },
```

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/dashboard/SwarmStatusWidget.tsx src/dashboard/lib/widgetRegistry.tsx
git commit -m "feat(dashboard): add SwarmStatusWidget with 5s auto-refresh"
```

---

## Task 7: Swarm CLI Parancsok

**Files:**
- Create: `src/cli/swarmCommands.ts`
- Modify: `src/cli.ts`

**Kontextus:** EPP v2 Rule 6 — CLI parancs is szükséges. A mintát a `robotkezCommands.ts` adja: Commander.js + fetch a REST API-ra.

- [ ] **Step 1: CLI module létrehozása**

Hozd létre: `src/cli/swarmCommands.ts`

```typescript
/**
 * Swarm CLI Commands
 *
 * brunella swarm status        — aktív kolóniák listázása
 * brunella swarm dispatch <task> — Triád kolónia indítása feladattal
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api/v1/swarm${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  if (!text) throw new Error(`Empty response from ${path}`);
  const data = JSON.parse(text) as T;
  if (!response.ok) throw new Error((data as { error?: string }).error || `HTTP ${response.status}`);
  return data;
}

export function registerSwarmCommands(program: Command): void {
  const swarm = program.command('swarm').description('Swarm kolónia műveletek');

  swarm
    .command('status')
    .description('Aktív swarm kolóniák listázása')
    .action(async () => {
      const spinner = ora('Kolóniák lekérdezése...').start();
      try {
        const data = await apiFetch<{ colonies: Array<{ name: string; status: string; agentCount: number; metrics: { tasksCompleted: number; tasksFailed: number } }> }>('/status');
        spinner.stop();
        if (data.colonies.length === 0) {
          console.log(chalk.yellow('Nincs aktív kolónia'));
          return;
        }
        console.log(chalk.bold('\nSwarm kolóniák:\n'));
        for (const c of data.colonies) {
          const statusColor = c.status === 'active' ? chalk.green : c.status === 'paused' ? chalk.blue : chalk.yellow;
          console.log(`  ${chalk.white(c.name)} — ${statusColor(c.status)} | ${c.agentCount} agent | ✓${c.metrics.tasksCompleted} ✗${c.metrics.tasksFailed}`);
        }
        console.log('');
      } catch (e: unknown) {
        spinner.fail(e instanceof Error ? e.message : 'Hiba a lekérdezés közben');
        process.exit(1);
      }
    });

  swarm
    .command('dispatch <task>')
    .description('Feladat küldése a Triád kolóniába')
    .option('--colony <id>', 'Kolónia azonosítója', 'triad-default')
    .action(async (task: string, options: { colony: string }) => {
      const spinner = ora(`Feladat küldése: ${task.slice(0, 50)}...`).start();
      try {
        const result = await apiFetch<{ taskId: string; result: { status: string; result: unknown; durationMs: number } }>(
          '/dispatch',
          { method: 'POST', body: JSON.stringify({ task, swarmId: options.colony }) }
        );
        spinner.succeed(`Feladat kész (${result.result.durationMs}ms)`);
        console.log(chalk.cyan('\nEredmény:'));
        console.log(JSON.stringify(result.result.result, null, 2));
      } catch (e: unknown) {
        spinner.fail(e instanceof Error ? e.message : 'Hiba a végrehajtás közben');
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: cli.ts módosítása**

Nyisd meg: `src/cli.ts`

Az importok közé (a többi `register...Commands` import mellé):
```typescript
import { registerSwarmCommands } from './cli/swarmCommands.js';
```

A `registerSwarmCommands` regisztrálása (ahol a többi register-call van):
```typescript
registerSwarmCommands(program);
```

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 4: Manuális teszt (szerver indítva legyen!)**

```bash
node build/cli.js swarm status
```

Várt: kolónia lista kiírása

- [ ] **Step 5: Commit**

```bash
git add src/cli/swarmCommands.ts src/cli.ts
git commit -m "feat(cli): add 'brunella swarm status' and 'brunella swarm dispatch' commands"
```

---

## Task 8: Enterprise Event Bus (SQLite WAL)

**Files:**
- Create: `src/core/eventBus.ts`

**Kontextus:** Race condition-mentes, async event tárolás better-sqlite3 WAL módban. A SwarmManager és AgentManager eseményei ide kerülnek, a SocketService pedig broadcasts-olja a Dashboard-nak.

- [ ] **Step 1: Teszt írása (failing)**

Hozd létre: `test/eventBus.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus, type BusEvent } from '../src/core/eventBus.js';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = 'data/test_eventbus.db';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus(TEST_DB);
  });

  afterEach(() => {
    bus.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('emits and stores an event', () => {
    bus.emit({ source: 'test', type: 'task.started', payload: { id: '1' } });
    const events = bus.getRecent(10);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task.started');
    expect(events[0].source).toBe('test');
  });

  it('marks event as consumed', () => {
    bus.emit({ source: 'test', type: 'agent.working', payload: {} });
    const events = bus.getRecent(10);
    bus.markConsumed(events[0].id);
    const pending = bus.getPending(10);
    expect(pending).toHaveLength(0);
  });

  it('on() handler fires when event is emitted', () => {
    const received: BusEvent[] = [];
    bus.on('swarm.spawned', (e) => received.push(e));
    bus.emit({ source: 'SwarmManager', type: 'swarm.spawned', payload: { swarmId: 'c1' } });
    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ swarmId: 'c1' });
  });
});
```

- [ ] **Step 2: Teszt futtatása (kell FAIL)**

```bash
npx vitest run test/eventBus.test.ts
```

Várt: `FAIL — Cannot find module '../src/core/eventBus.js'`

- [ ] **Step 3: EventBus implementálása**

Hozd létre: `src/core/eventBus.ts`

```typescript
/**
 * Enterprise Event Bus — SQLite WAL-backed async event system
 *
 * Race condition-mentes esemény tárolás. SwarmManager és AgentManager
 * eseményeit tárolja, SocketService broadcastolja Dashboard-nak.
 */
import Database from 'better-sqlite3';
import { logInfo } from '../utils/logger.js';

export type BusEventType =
  | 'task.started' | 'task.completed' | 'task.failed'
  | 'swarm.spawned' | 'swarm.dissolved' | 'swarm.leader_elected' | 'swarm.paused' | 'swarm.resumed'
  | 'agent.working' | 'agent.idle' | 'agent.error'
  | 'system.failover' | 'system.recovered'
  | 'phoenix.snapshot' | 'phoenix.restored';

export interface BusEvent {
  id: number;
  ts: number;
  source: string;
  type: BusEventType | string;
  payload: Record<string, unknown>;
  consumed: boolean;
}

type EventHandler = (event: BusEvent) => void;

const DEFAULT_DB_PATH = 'data/brunella.db';

export class EventBus {
  private db: Database.Database;
  private handlers = new Map<string, EventHandler[]>();

  constructor(dbPath = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_bus (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        ts       INTEGER NOT NULL,
        source   TEXT NOT NULL,
        type     TEXT NOT NULL,
        payload  TEXT NOT NULL,
        consumed INTEGER DEFAULT 0
      )
    `);
  }

  /** Emit an event — stores in DB and fires in-process handlers */
  emit(event: Omit<BusEvent, 'id' | 'ts' | 'consumed'>): void {
    const ts = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO event_bus (ts, source, type, payload) VALUES (?, ?, ?, ?)'
    );
    const info = stmt.run(ts, event.source, event.type, JSON.stringify(event.payload));
    const busEvent: BusEvent = {
      id: info.lastInsertRowid as number,
      ts,
      source: event.source,
      type: event.type,
      payload: event.payload,
      consumed: false,
    };

    // Fire in-process handlers
    const handlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    [...handlers, ...wildcardHandlers].forEach(h => {
      try { h(busEvent); } catch { /* non-critical */ }
    });

    logInfo('EventBus', `Emitted: ${event.type} from ${event.source}`);
  }

  /** Subscribe to a specific event type or '*' for all */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, []);
    this.handlers.get(eventType)!.push(handler);
  }

  /** Get recent events from DB */
  getRecent(limit = 50): BusEvent[] {
    return this.db
      .prepare('SELECT * FROM event_bus ORDER BY id DESC LIMIT ?')
      .all(limit)
      .map(this.deserialize)
      .reverse();
  }

  /** Get unconsumed events */
  getPending(limit = 100): BusEvent[] {
    return this.db
      .prepare('SELECT * FROM event_bus WHERE consumed = 0 ORDER BY id ASC LIMIT ?')
      .all(limit)
      .map(this.deserialize);
  }

  /** Mark an event as consumed */
  markConsumed(id: number): void {
    this.db.prepare('UPDATE event_bus SET consumed = 1 WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }

  private deserialize(row: Record<string, unknown>): BusEvent {
    return {
      id: row['id'] as number,
      ts: row['ts'] as number,
      source: row['source'] as string,
      type: row['type'] as string,
      payload: JSON.parse(row['payload'] as string),
      consumed: (row['consumed'] as number) === 1,
    };
  }
}

// Singleton — importálható az egész rendszerben
export const eventBus = new EventBus();
export default eventBus;
```

- [ ] **Step 4: Tesztek futtatása (kell PASS)**

```bash
npx vitest run test/eventBus.test.ts
```

Várt: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/eventBus.ts test/eventBus.test.ts
git commit -m "feat(core): add SQLite WAL EventBus with wildcard handler support"
```

---

## Task 9: EventBus → SocketService Bridge

**Files:**
- Modify: `src/server/SocketService.ts`
- Modify: `src/agents/swarm/SwarmManager.ts`

**Kontextus:** A SocketService egy `broadcastBusEvent` metódust kap, amit az EventBus `on('*', ...)` handlere hív. A SwarmManager kolónia eseményeket az EventBusba emittál.

- [ ] **Step 1: SocketService bővítése**

Nyisd meg: `src/server/SocketService.ts`

Az importok közé add:
```typescript
import { eventBus } from '../core/eventBus.js';
import type { BusEvent } from '../core/eventBus.js';
```

Az `init(io: Server)` metódusban, a `this.io = io;` sor UTÁN add:
```typescript
// EventBus → WebSocket broadcast
eventBus.on('*', (event: BusEvent) => {
  this.io?.emit('bus:event', event);
});
logInfo('SocketService', 'EventBus → WebSocket bridge active');
```

- [ ] **Step 2: SwarmManager EventBus integráció**

Nyisd meg: `src/agents/swarm/SwarmManager.ts`

Az importok közé add:
```typescript
import { eventBus } from '../../core/eventBus.js';
```

A `createColony` metódusban, az `this.emit('colony:created', colony);` SOR UTÁN add:
```typescript
eventBus.emit({ source: 'SwarmManager', type: 'swarm.spawned', payload: { swarmId: colony.swarmId, name: colony.name } });
```

A `dissolveColony` metódusban, az `this.emit('colony:dissolved', colony);` SOR UTÁN add:
```typescript
eventBus.emit({ source: 'SwarmManager', type: 'swarm.dissolved', payload: { swarmId: colony.swarmId } });
```

A `pauseAllColonies` metódusban, az `this.emit('colony:paused', colony);` SOR UTÁN add:
```typescript
eventBus.emit({ source: 'SwarmManager', type: 'swarm.paused', payload: { swarmId: colony.swarmId } });
```

A `resumeAllColonies` metódusban, az `this.emit('colony:resumed', colony);` SOR UTÁN add:
```typescript
eventBus.emit({ source: 'SwarmManager', type: 'swarm.resumed', payload: { swarmId: colony.swarmId } });
```

- [ ] **Step 3: Build + összes teszt**

```bash
npm run build && npm test
```

Várt: `0 errors`, mind PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/SocketService.ts src/agents/swarm/SwarmManager.ts
git commit -m "feat(events): connect SwarmManager → EventBus → SocketService → Dashboard"
```

---

## Task 10: BifrostGateway setMode() + Phoenix Protocol CEAN Fallback Handler

**Files:**
- Modify: `src/core/bifrost_gateway.ts` (pre-requisite: `setMode()` hozzáadása)
- Create: `src/core/ceanFallback.ts`

**Kontextus:** A `BifrostGateway`-nek nincs `setMode()` metódusa — ezt hozzá kell adni. Amikor `phoenix:degraded` esemény érkezik, az edge-only mód aktiválódik és a SwarmManager pausolódik. Visszaálláskor (`phoenix:recovery`) a lokális mód jön vissza.

**Fontos:** `saveCheckpoint()` 4 argumentumot vár: `(taskId, stepIndex, stepName, state)`. A `state` üres objektum is lehet.

- [ ] **Step 1: BifrostGateway setMode() hozzáadása**

Nyisd meg: `src/core/bifrost_gateway.ts`

Keresd meg a `private providers` field deklarációját (kb. sor ~100). A class property-k mellé add hozzá:
```typescript
private preferredMode: 'local-preferred' | 'edge-only' = 'local-preferred';
```

Keress egy publikus metódust — bárhova a class-on belül add hozzá `setMode`:
```typescript
/** Set provider routing mode (Phoenix Protocol failover) */
setMode(mode: 'local-preferred' | 'edge-only'): void {
  this.preferredMode = mode;
  logInfo('BifrostGateway', `Mode set to: ${mode}`);
}

/** Get current routing mode */
getMode(): 'local-preferred' | 'edge-only' {
  return this.preferredMode;
}
```

A meglévő `generate()` metódusban, ahol a provider kiválasztás történik (kb. sor ~224-230), az auto-select logika elé add egy módvizsgálatot:
```typescript
// Edge-only mód: kizárólag cloudflare providerrel
if (this.preferredMode === 'edge-only' && !options.provider) {
  options = { ...options, provider: 'cloudflare' };
}
```

- [ ] **Step 2: Build ellenőrzés (BifrostGateway)**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 3: CEAN fallback modul létrehozása**

Hozd létre: `src/core/ceanFallback.ts`

```typescript
/**
 * CEAN Fallback Handler
 *
 * Phoenix Protocol integrációs modul.
 * phoenix:degraded → edge-only mód + swarm pause
 * phoenix:recovery → local-preferred mód + swarm resume
 */
import { phoenixEventBus } from './phoenixEventBus.js';
import { getBifrostGateway } from './bifrost_gateway.js';
import { saveCheckpoint, loadCheckpoint } from './checkpoint.js';
import type { CheckpointState } from './checkpoint.js';
import { swarmManager } from '../agents/AgentManager.js';
import { eventBus } from './eventBus.js';
import { logInfo, logWarn } from '../utils/logger.js';

const FAILOVER_TASK_ID = 'cean-failover';
const EMPTY_STATE: CheckpointState = { taskId: FAILOVER_TASK_ID, data: {} };

export function initCeanFallback(): void {
  const bifrost = getBifrostGateway();

  phoenixEventBus.subscribe('phoenix:degraded', async (_event) => {
    logWarn('CeanFallback', 'Phoenix degraded — switching to edge-only mode');
    try {
      await saveCheckpoint(FAILOVER_TASK_ID, 0, 'pre-edge-failover', EMPTY_STATE);
      bifrost.setMode('edge-only');
      swarmManager.pauseAllColonies();
      eventBus.emit({ source: 'CeanFallback', type: 'system.failover', payload: { target: 'edge', reason: 'phoenix:degraded' } });
      logInfo('CeanFallback', 'Failover complete: edge-only mode active');
    } catch (e: unknown) {
      logWarn('CeanFallback', `Failover error: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  phoenixEventBus.subscribe('phoenix:recovery', async (_event) => {
    logInfo('CeanFallback', 'Phoenix recovery — restoring local-preferred mode');
    try {
      await loadCheckpoint(FAILOVER_TASK_ID);
      bifrost.setMode('local-preferred');
      swarmManager.resumeAllColonies();
      eventBus.emit({ source: 'CeanFallback', type: 'system.recovered', payload: { from: 'edge' } });
      logInfo('CeanFallback', 'Recovery complete: local-preferred mode active');
    } catch (e: unknown) {
      logWarn('CeanFallback', `Recovery error: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  logInfo('CeanFallback', 'Phoenix Protocol CEAN handlers registered');
}
```

- [ ] **Step 5: initCeanFallback hívása a szerver startup-ban**

Nyisd meg: `src/server/web.ts`

Az importok közé:
```typescript
import { initCeanFallback } from '../core/ceanFallback.js';
```

A szerver inicializáció blokkjában (ahol a többi `init...` hívás van, kb. sor ~190-195 körül):
```typescript
initCeanFallback();
```

- [ ] **Step 6: Build ellenőrzés**

```bash
npm run build
```

Várt: `0 errors`

- [ ] **Step 8: Teszt írása**

Hozd létre: `test/ceanFallback.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    subscribe: vi.fn(),
  }
}));
vi.mock('../src/agents/AgentManager.js', () => ({
  swarmManager: { pauseAllColonies: vi.fn(), resumeAllColonies: vi.fn() },
  agentManager: { initialize: vi.fn() }
}));
vi.mock('../src/core/bifrost_gateway.js', () => ({
  getBifrostGateway: vi.fn(() => ({ setMode: vi.fn() }))
}));
vi.mock('../src/core/checkpoint.js', () => ({
  saveCheckpoint: vi.fn(), loadCheckpoint: vi.fn()
}));
vi.mock('../src/core/eventBus.js', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() }
}));

import { phoenixEventBus } from '../src/core/phoenixEventBus.js';
import { initCeanFallback } from '../src/core/ceanFallback.js';

describe('initCeanFallback', () => {
  it('registers handlers for phoenix:degraded and phoenix:recovery', () => {
    initCeanFallback();
    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:degraded', expect.any(Function));
    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:recovery', expect.any(Function));
  });
});
```

- [ ] **Step 9: Tesztek futtatása**

```bash
npx vitest run test/ceanFallback.test.ts
```

Várt: `1 passed`

- [ ] **Step 10: Commit**

```bash
git add src/core/bifrost_gateway.ts src/core/ceanFallback.ts src/server/web.ts test/ceanFallback.test.ts
git commit -m "feat(phoenix): add BifrostGateway setMode() + CEAN fallback handler for phoenix:degraded/recovery"
```

---

## Task 11: CEAN Cloudflare Workers

**Files:**
- Create: `workers/cean-router/index.ts`
- Create: `workers/cean-harvest/index.ts`
- Create: `workers/cean-research/index.ts`
- Create: `workers/cean-refine/index.ts`
- Create: `workers/cean-router/wrangler.toml`
- Create: `workers/cean-harvest/wrangler.toml`

**Kontextus:** 4 Cloudflare Worker az edge réteghez. Workers AI modell: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Nincs TypeScript build szükséges — Wrangler kezeli.

- [ ] **Step 1: Könyvtárstruktúra létrehozása**

```bash
mkdir -p workers/cean-router workers/cean-harvest workers/cean-research workers/cean-refine
```

- [ ] **Step 2: cean-router Worker**

Hozd létre: `workers/cean-router/index.ts`

```typescript
/**
 * CEAN Router Worker — API Gateway + Workers AI gyors feladatok
 * Brunella fallback amikor Ollama nem elérhető
 */
export interface Env {
  AI: Ai;
  BRUNELLA_API_KEY: string;
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth check
    const apiKey = request.headers.get('X-Api-Key');
    if (apiKey !== env.BRUNELLA_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'cean-router', ts: Date.now() });
    }

    if (url.pathname === '/generate' && request.method === 'POST') {
      const body = await request.json() as { prompt: string; system?: string };
      const messages: RoleScopedChatInput[] = [];
      if (body.system) messages.push({ role: 'system', content: body.system });
      messages.push({ role: 'user', content: body.prompt });

      const result = await env.AI.run(MODEL, { messages }) as { response: string };
      return Response.json({ success: true, response: result.response, worker: 'cean-router' });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

Hozd létre: `workers/cean-router/wrangler.toml`

```toml
name = "cean-router"
main = "index.ts"
compatibility_date = "2024-09-23"

[ai]
binding = "AI"

[vars]
BRUNELLA_API_KEY = "changeme"
```

- [ ] **Step 3: cean-harvest Worker**

Hozd létre: `workers/cean-harvest/index.ts`

```typescript
/**
 * CEAN Harvest Worker — Scheduled harvest (GitHub, hírek)
 * Cron: every 6 hours
 */
export interface Env {
  AI: Ai;
  HARVEST_KV: KVNamespace;
  BRUNELLA_API_KEY: string;
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function summarizeContent(ai: Ai, content: string): Promise<string> {
  const result = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: 'Summarize the following content in 3 bullet points, focus on key insights.' },
      { role: 'user', content: content.slice(0, 2000) }
    ]
  }) as { response: string };
  return result.response;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const sources = [
      'https://api.github.com/repos/anthropics/claude-code/commits?per_page=5',
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'CEAN-Harvest/1.0' } });
        if (!res.ok) continue;
        const text = await res.text();
        const summary = await summarizeContent(env.AI, text);
        await env.HARVEST_KV.put(`harvest:${Date.now()}:${encodeURIComponent(url)}`, summary, { expirationTtl: 86400 * 7 });
      } catch {
        // non-critical, continue
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const apiKey = request.headers.get('X-Api-Key');
    if (apiKey !== env.BRUNELLA_API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'cean-harvest' });
    }
    return new Response('Not Found', { status: 404 });
  }
};
```

Hozd létre: `workers/cean-harvest/wrangler.toml`

```toml
name = "cean-harvest"
main = "index.ts"
compatibility_date = "2024-09-23"

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "HARVEST_KV"
id = "REPLACE_WITH_KV_NAMESPACE_ID"

[triggers]
crons = ["0 */6 * * *"]
```

- [ ] **Step 4: cean-research + cean-refine (egyszerűsített)**

Hozd létre: `workers/cean-research/index.ts`

```typescript
/** CEAN Research Worker — ResearcherAgent edge verziója (Phoenix fallback) */
export interface Env { AI: Ai; BRUNELLA_API_KEY: string; }
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('X-Api-Key') !== env.BRUNELLA_API_KEY) return new Response('Unauthorized', { status: 401 });
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });

    const { query } = await request.json() as { query: string };
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a research assistant. Provide factual, concise research summaries.' },
        { role: 'user', content: query }
      ]
    }) as { response: string };

    return Response.json({ success: true, result: result.response, worker: 'cean-research' });
  }
};
```

Hozd létre: `workers/cean-refine/index.ts`

```typescript
/** CEAN Refine Worker — DataScientist edge verziója (Phoenix fallback) */
export interface Env { AI: Ai; BRUNELLA_API_KEY: string; }
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('X-Api-Key') !== env.BRUNELLA_API_KEY) return new Response('Unauthorized', { status: 401 });
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });

    const { data } = await request.json() as { data: string };
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are a data scientist. Analyze and refine the provided data, extract key insights.' },
        { role: 'user', content: data }
      ]
    }) as { response: string };

    return Response.json({ success: true, result: result.response, worker: 'cean-refine' });
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add workers/
git commit -m "feat(cean): add 4 Cloudflare Edge Workers (router, harvest, research, refine)"
```

---

## Task 12: Harvest Sync Endpoint

**Files:**
- Create: `src/server/routes/harvest.ts`
- Modify: `src/server/web.ts`

**Kontextus:** A `POST /api/harvest/sync` a CEAN Worker harvest KV tartalmát szinkronizálja a lokális LanceDB-be. A `GET /api/harvest/status` az utolsó szinkronizálás időpontját adja vissza.

- [ ] **Step 1: Route fájl létrehozása**

Hozd létre: `src/server/routes/harvest.ts`

```typescript
import express from 'express';
import { logInfo, logError } from '../../utils/logger.js';

const router = express.Router();

let lastSync: { ts: number; count: number } | null = null;

/**
 * GET /api/harvest/status
 */
router.get('/status', (_req, res) => {
  res.json({
    success: true,
    lastSync: lastSync ? { timestamp: new Date(lastSync.ts).toISOString(), count: lastSync.count } : null,
    ceanWorkerUrl: process.env['CEAN_WORKER_URL'] ? 'configured' : 'not configured',
  });
});

/**
 * POST /api/harvest/sync
 * CEAN Worker harvest KV → lokális feldolgozás
 */
router.post('/sync', async (_req, res) => {
  const ceanUrl = process.env['CEAN_WORKER_URL'];
  const apiKey = process.env['CEAN_API_KEY'];

  if (!ceanUrl || !apiKey) {
    return res.status(503).json({
      success: false,
      error: 'CEAN_WORKER_URL or CEAN_API_KEY not configured'
    });
  }

  try {
    logInfo('HarvestSync', 'Starting CEAN harvest sync...');
    // TODO: Implement KV listing + LanceDB sync when CEAN Workers deployed
    // For now: ping the CEAN router health endpoint
    const healthRes = await fetch(`${ceanUrl}/health`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const health = await healthRes.json() as { status: string };

    lastSync = { ts: Date.now(), count: 0 };
    logInfo('HarvestSync', `Sync complete. CEAN status: ${health.status}`);

    res.json({ success: true, status: health.status, synced: 0 });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('HarvestSync', error);
    res.status(500).json({ success: false, error });
  }
});

export default router;
```

- [ ] **Step 2: web.ts — harvest router mount**

Nyisd meg: `src/server/web.ts`

Import:
```typescript
import harvestRouter from './routes/harvest.js';
```

Mount (`app.use` direkt, nem a v1Router — a spec `/api/harvest/` path-t ír, nem `/api/v1/harvest/`):
```typescript
app.use('/api/harvest', harvestRouter);
```

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build
```

- [ ] **Step 4: docker-compose.yml frissítése**

Nyisd meg: `docker-compose.yml`

A `services:` blokkba add hozzá a `github-mcp` service-t (a meglévő service-ek után):

```yaml
  # GitHub MCP Server (Docker)
  github-mcp:
    image: ghcr.io/github/github-mcp-server:0.31.0
    container_name: brunella-github-mcp
    restart: unless-stopped
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_PAT}
    stdin_open: true
    tty: true
    profiles:
      - mcp
```

- [ ] **Step 5: .env dokumentálás**

A `.env` fájlba (ha nem létezik még) add hozzá a kommentált változókat:
```bash
# CEAN Edge Agents (Cloudflare Workers)
# CEAN_WORKER_URL=https://cean-router.<your-subdomain>.workers.dev
# CEAN_API_KEY=your-secret-api-key
```

- [ ] **Step 6: Összes teszt futtatása**

```bash
npm run build && npm test
```

Várt: `0 errors`, mind PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/harvest.ts src/server/web.ts docker-compose.yml .env
git commit -m "feat(harvest): add /api/harvest/sync + /status endpoints + docker github-mcp service"
```

---

## Task 13: Végső Integráció Ellenőrzés

**Cél:** Minden siker kritérium teljesítésének manuális ellenőrzése.

- [ ] **Step 1: Teljes build + test**

```bash
npm run build && npm test
```

Várt: `0 build errors`, `0 test failures`

- [ ] **Step 2: Szerver indítás + health check**

```bash
npm run dev
# Másik terminálban:
curl http://localhost:3000/api/health | python -m json.tool
curl http://localhost:3000/api/v1/swarm/status | python -m json.tool
```

Várt: health `"status": "ok"`, swarm status `"colonies": [{"name":"Triad","status":"active",...}]`

- [ ] **Step 3: MCP SSE ellenőrzés**

```bash
curl -N http://localhost:3000/sse
```

Várt: SSE stream megnyílik (`data: ...` sorok)

- [ ] **Step 4: CLI ellenőrzés**

```bash
node build/cli.js swarm status
```

Várt: Triád kolónia megjelenik

- [ ] **Step 5: VSCode MCP ellenőrzés**

1. Nyisd meg VSCode Copilot Chat-et
2. MCP fogaskerék → ellenőrizd, hogy `brunella` HTTP szerver látható
3. Kérdezd meg: `"Milyen swarm tool-ok érhetők el?"` — várható: `swarm_dispatch`, `swarm_status`, `swarm_ingest`

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(swarm-hybrid): Phase 1-4 complete — MCP config, Swarm wiring, EventBus, CEAN Workers"
```

---

## Siker Kritériumok Összefoglalója

| Kritérium | Task | Ellenőrzés |
|-----------|------|-----------|
| VSCode Copilot látja `brunella` HTTP szervert | Task 1 | VSCode MCP panel |
| `swarm_dispatch` tool elérhető Copilotból | Task 4 | Copilot Chat kérdés |
| Triád kolónia indul `swarm_dispatch`-re | Task 3, 4 | API + log |
| EventBus eseményei megjelennek SocketService-en | Task 9 | Browser DevTools WS |
| `pauseAllColonies` működik Phoenix degraded-re | Task 2, 10 | Unit test + log |
| `npm run build && npm test` — 0 hiba | Minden Task | CI |
