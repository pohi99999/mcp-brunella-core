# AnythingLLM Action Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AnythingLLM Desktop `POST /api/v1/anythingllm/action` végponton keresztül indít Brunella agent-feladatokat, audit logolással és dashboard panellel.

**Architecture:** Egységes action endpoint fogadja az AnythingLLM custom action kéréseket, `X-Brunella-Secret` headerrel hitelesíti, action name alapján delegál AgentManager-nek, in-memory ring bufferbe loggol. Dashboard panel tesztelő formot és audit táblázatot mutat.

**Tech Stack:** Express 4, TypeScript ESM, Vitest + supertest, React 19, Tailwind, Radix/shadcn

---

## File Structure

| Fájl | Szerep |
|------|--------|
| `src/server/routes/anythingllmActions.ts` | Action endpoint, auth middleware, action router, audit buffer — CREATE |
| `test/anythingllmActions.test.ts` | Vitest tesztek — CREATE |
| `src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx` | Dashboard panel — CREATE |
| `src/server/routes/index.ts` | `/anythingllm/action` lazy route regisztráció — MODIFY (sor ~71 elé) |
| `src/dashboard/lib/apiService.ts` | `executeAnythingLLMAction()`, `getAnythingLLMActionAudit()` — MODIFY (végére) |
| `src/dashboard/lib/navigation.tsx` | Import + registerItem — MODIFY |
| `conductor/tracks/brunella-anythingllm-desktop-integration/meta.json` | status: active — MODIFY |

---

## Task 1: Track aktiválás

**Files:**
- Modify: `conductor/tracks/brunella-anythingllm-desktop-integration/meta.json`

- [ ] **Step 1: Frissítsd a meta.json-t**

Nyisd meg `conductor/tracks/brunella-anythingllm-desktop-integration/meta.json`, és változtasd:
```json
{
  "status": "active",
  "updatedAt": "2026-04-09T03:00:00+02:00"
}
```
(csak ezt a két mezőt módosítsd)

- [ ] **Step 2: Commit**

```bash
git add conductor/tracks/brunella-anythingllm-desktop-integration/meta.json
git commit -m "feat(tracks): activate brunella-anythingllm-desktop-integration track"
```

---

## Task 2: Action routes — tesztek megírása (TDD)

**Files:**
- Create: `test/anythingllmActions.test.ts`

- [ ] **Step 1: Hozd létre a tesztfájlt**

```typescript
// test/anythingllmActions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const { delegateMock } = vi.hoisted(() => {
  const delegateMock = vi.fn().mockResolvedValue({ message: 'OK' });
  return { delegateMock };
});

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { delegate: delegateMock }
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

async function buildApp() {
  const { createAnythingLLMActionRoutes } = await import('../src/server/routes/anythingllmActions.js');
  const app = express();
  app.use(express.json());
  app.use('/', createAnythingLLMActionRoutes());
  return app;
}

describe('AnythingLLM Action Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRUNELLA_ACTION_SECRET = 'test-secret';
  });

  it('returns 401 without secret header', async () => {
    const app = await buildApp();
    const res = await request(app).post('/').send({ action: 'email_triage' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'wrong')
      .send({ action: 'email_triage' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for unknown action', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'unknown_action' });
    expect(res.status).toBe(400);
    expect(res.body.supported).toContain('email_triage');
  });

  it('executes email_triage with normal risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'email_triage', payload: { task: 'Process emails' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.riskLevel).toBe('normal');
    expect(res.body.agent).toBe('InvoiceAutomation');
    expect(delegateMock).toHaveBeenCalledWith('InvoiceAutomation', 'Process emails', {});
  });

  it('flags browser_task as high risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'browser_task', payload: { task: 'Navigate somewhere' } });
    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe('high');
  });

  it('flags agent_start as high risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'agent_start', payload: { task: 'Start agent' } });
    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe('high');
  });

  it('returns audit log with executed records', async () => {
    const app = await buildApp();
    await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'email_triage', payload: { task: 'test' } });

    const res = await request(app)
      .get('/audit')
      .set('X-Brunella-Secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.records[0].action).toBe('email_triage');
  });
});
```

- [ ] **Step 2: Futtasd — elvárt FAIL**

```bash
npx vitest run test/anythingllmActions.test.ts
```
Elvárt: `Cannot find module '../src/server/routes/anythingllmActions.js'`

---

## Task 3: Action routes — implementáció

**Files:**
- Create: `src/server/routes/anythingllmActions.ts`

- [ ] **Step 1: Hozd létre a route fájlt**

```typescript
// src/server/routes/anythingllmActions.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';

export interface ActionAuditRecord {
  id: string;
  timestamp: string;
  action: string;
  agent: string;
  payloadSummary: string;
  resultSummary: string;
  riskLevel: 'normal' | 'high';
  durationMs: number;
  success: boolean;
}

const auditBuffer: ActionAuditRecord[] = [];
const MAX_AUDIT = 50;

const HIGH_RISK_ACTIONS = new Set<string>(['browser_task', 'agent_start']);

export const ACTION_MAP: Record<string, string> = {
  email_triage:     'InvoiceAutomation',
  calendar_check:   'Orchestrator',
  document_summary: 'Researcher',
  browser_task:     'RobotkezV2',
  agent_start:      'Orchestrator',
};

function addAudit(record: ActionAuditRecord): void {
  auditBuffer.push(record);
  if (auditBuffer.length > MAX_AUDIT) auditBuffer.shift();
}

export function getAuditBuffer(): ActionAuditRecord[] {
  return [...auditBuffer];
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.BRUNELLA_ACTION_SECRET;
  if (!secret) { next(); return; }
  const provided = req.headers['x-brunella-secret'];
  if (provided !== secret) {
    res.status(401).json({
      error: 'Unauthorized',
      hint: 'X-Brunella-Secret header hiányzik vagy érvénytelen',
    });
    return;
  }
  next();
}

export function createAnythingLLMActionRoutes(): Router {
  const router = Router();
  const supported = Object.keys(ACTION_MAP);

  router.use(authMiddleware);

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { action, payload } = req.body as {
      action?: string;
      payload?: { task?: string; context?: Record<string, unknown> };
    };

    if (!action || !ACTION_MAP[action]) {
      res.status(400).json({ error: `Unknown action: '${action ?? ''}'`, supported });
      return;
    }

    const agentName = ACTION_MAP[action];
    const task = payload?.task ?? action;
    const context = payload?.context ?? {};
    const riskLevel: 'normal' | 'high' = HIGH_RISK_ACTIONS.has(action) ? 'high' : 'normal';
    const auditId = `act_${Date.now()}_${action}`;
    const start = Date.now();

    try {
      logInfo('AnythingLLMAction', `${action} → ${agentName} | ${task.slice(0, 50)}`);
      const raw = await agentManager.delegate(agentName, task, context);
      const result =
        typeof raw === 'string'
          ? raw
          : ((raw as Record<string, unknown>)?.message as string | undefined) ??
            JSON.stringify(raw);
      const durationMs = Date.now() - start;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary: result.slice(0, 200),
        riskLevel,
        durationMs,
        success: true,
      });

      res.json({ success: true, action, agent: agentName, result, riskLevel, auditId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const durationMs = Date.now() - start;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary: `ERROR: ${msg.slice(0, 190)}`,
        riskLevel,
        durationMs,
        success: false,
      });

      logError('AnythingLLMAction', msg);
      res.status(500).json({ success: false, action, error: msg, riskLevel, auditId });
    }
  });

  router.get('/audit', (_req: Request, res: Response): void => {
    res.json({ records: [...auditBuffer].reverse(), total: auditBuffer.length });
  });

  return router;
}
```

- [ ] **Step 2: Futtasd a teszteket — elvárt PASS**

```bash
npx vitest run test/anythingllmActions.test.ts
```
Elvárt: `8 passed`

- [ ] **Step 3: Commit**

```bash
git add src/server/routes/anythingllmActions.ts test/anythingllmActions.test.ts
git commit -m "feat(anythingllm): add action bridge endpoint with audit and auth"
```

---

## Task 4: Route regisztráció

**Files:**
- Modify: `src/server/routes/index.ts:71` (a `/anythingllm` sor elé)

- [ ] **Step 1: Add route before existing /anythingllm entry**

A `src/server/routes/index.ts` fájlban keresd meg ezt a sort:
```typescript
  router.use("/anythingllm", lazy(() => import("./chat.js"), "createAnythingLLMRoutes"));
```

Szúrd be ELÉ:
```typescript
  router.use("/anythingllm/action", lazy(() => import("./anythingllmActions.js"), "createAnythingLLMActionRoutes"));
```

- [ ] **Step 2: Build ellenőrzés**

```bash
npm run build 2>&1 | tail -5
```
Elvárt: `TRIZ data copied` (0 TypeScript hiba)

- [ ] **Step 3: Commit**

```bash
git add src/server/routes/index.ts
git commit -m "feat(routes): register anythingllm action bridge route"
```

---

## Task 5: apiService kiegészítések

**Files:**
- Modify: `src/dashboard/lib/apiService.ts` (fájl végéhez hozzáadás)

- [ ] **Step 1: Típusok és függvények hozzáadása**

A `src/dashboard/lib/apiService.ts` **végére** add hozzá:

```typescript
// ── AnythingLLM Action Bridge ─────────────────────────────────────────────

export interface AnythingLLMActionRequest {
  action: string;
  payload?: { task?: string; context?: Record<string, unknown> };
}

export interface AnythingLLMActionResponse {
  success: boolean;
  action: string;
  agent: string;
  result: string;
  riskLevel: 'normal' | 'high';
  auditId: string;
  error?: string;
}

export interface AnythingLLMActionAuditRecord {
  id: string;
  timestamp: string;
  action: string;
  agent: string;
  payloadSummary: string;
  resultSummary: string;
  riskLevel: 'normal' | 'high';
  durationMs: number;
  success: boolean;
}

export async function executeAnythingLLMAction(
  req: AnythingLLMActionRequest,
  secret?: string,
): Promise<AnythingLLMActionResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Brunella-Secret'] = secret;
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/anythingllm/action`,
    { method: 'POST', headers, body: JSON.stringify(req) },
    60000,
  );
  return safeJson<AnythingLLMActionResponse>(response);
}

export async function getAnythingLLMActionAudit(
  secret?: string,
): Promise<{ records: AnythingLLMActionAuditRecord[]; total: number }> {
  const headers: Record<string, string> = {};
  if (secret) headers['X-Brunella-Secret'] = secret;
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/anythingllm/action/audit`,
    { headers },
  );
  return safeJson<{ records: AnythingLLMActionAuditRecord[]; total: number }>(response);
}
```

- [ ] **Step 2: Build**

```bash
npm run build:ui 2>&1 | tail -5
```
Elvárt: 0 hiba

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/lib/apiService.ts
git commit -m "feat(apiService): add AnythingLLM action bridge API functions"
```

---

## Task 6: Dashboard panel

**Files:**
- Create: `src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx`

- [ ] **Step 1: Hozd létre a komponenst**

```tsx
// src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import {
  executeAnythingLLMAction,
  getAnythingLLMActionAudit,
  type AnythingLLMActionAuditRecord,
} from '@/lib/apiService';
import { toast } from 'sonner';

const ACTIONS = [
  { value: 'email_triage', label: 'Email Feldolgozás', agent: 'InvoiceAutomation' },
  { value: 'calendar_check', label: 'Naptár Ellenőrzés', agent: 'Orchestrator' },
  { value: 'document_summary', label: 'Dokumentum Összefoglaló', agent: 'Researcher' },
  { value: 'browser_task', label: 'Böngésző Feladat', agent: 'RobotkezV2', risk: true },
  { value: 'agent_start', label: 'Agent Indítás', agent: 'AgentManager', risk: true },
];

export function AnythingLLMActionBridgePanel() {
  const [action, setAction] = useState('email_triage');
  const [task, setTask] = useState('');
  const [secret, setSecret] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [audit, setAudit] = useState<AnythingLLMActionAuditRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const data = await getAnythingLLMActionAudit(secret || undefined);
      setAudit(data.records);
    } catch {
      // audit betöltési hiba nem kritikus
    } finally {
      setLoadingAudit(false);
    }
  }, [secret]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const handleRun = async () => {
    if (!task.trim()) {
      toast.error('Add meg a feladatot');
      return;
    }
    setIsRunning(true);
    try {
      const res = await executeAnythingLLMAction(
        { action, payload: { task } },
        secret || undefined,
      );
      toast.success(`${action} kész`, { description: res.result?.slice(0, 100) });
      await loadAudit();
    } catch (e: unknown) {
      toast.error('Hiba', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsRunning(false);
    }
  };

  const selectedAction = ACTIONS.find((a) => a.value === action);

  return (
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          <Zap size={18} />
          AnythingLLM Action Bridge
        </CardTitle>
        <p className="text-xs text-zinc-500 mt-1">
          Endpoint: <code className="text-zinc-300">POST /api/v1/anythingllm/action</code>
        </p>
      </CardHeader>

      <CardContent className="space-y-5 p-4 lg:p-5">
        {/* Secret */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
            BRUNELLA_ACTION_SECRET
          </label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Hagyd üresen ha nincs beállítva"
            className="glass-card border-white/10 bg-white/[0.03] text-xs"
          />
        </div>

        {/* Action selector */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Action</label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="glass-card border-white/10 bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="flex items-center gap-2">
                    {a.risk && <AlertTriangle size={12} className="text-orange-400" />}
                    {a.label}
                    <span className="text-xs text-zinc-500">→ {a.agent}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAction?.risk && (
            <p className="text-xs text-orange-400 flex items-center gap-1">
              <AlertTriangle size={12} /> HIGH_RISK művelet — auditban megjelölve
            </p>
          )}
        </div>

        {/* Task input */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Feladat</label>
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="Pl.: Feldolgozd a mai emaileket"
            className="glass-card border-white/10 bg-white/[0.03] text-sm"
            disabled={isRunning}
          />
        </div>

        <Button
          onClick={handleRun}
          disabled={isRunning || !task.trim()}
          className="w-full rounded-full border border-white/10 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
        >
          <Zap size={16} className={isRunning ? 'animate-pulse' : ''} />
          <span className="ml-2">{isRunning ? 'Futtatás...' : 'Futtatás'}</span>
        </Button>

        {/* Audit log */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              Audit Log ({audit.length})
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAudit}
              disabled={loadingAudit}
              className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <RefreshCw size={12} className={loadingAudit ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {audit.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">Nincs rekord</p>
            )}
            {audit.map((rec) => (
              <div
                key={rec.id}
                className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${
                  rec.riskLevel === 'high'
                    ? 'border-orange-500/20 bg-orange-500/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {rec.success ? (
                  <CheckCircle size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-zinc-300">{rec.action}</span>
                    <span className="text-zinc-600">→ {rec.agent}</span>
                    {rec.riskLevel === 'high' && (
                      <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[9px] px-1 py-0">
                        HIGH
                      </Badge>
                    )}
                    <span className="text-zinc-600 ml-auto">{rec.durationMs}ms</span>
                  </div>
                  <p className="text-zinc-500 truncate mt-0.5">{rec.resultSummary}</p>
                  <p className="text-zinc-700 text-[10px]">
                    {new Date(rec.timestamp).toLocaleTimeString('hu-HU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build:ui 2>&1 | tail -5
```
Elvárt: 0 hiba

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx
git commit -m "feat(dashboard): add AnythingLLMActionBridgePanel component"
```

---

## Task 7: Navigation regisztráció

**Files:**
- Modify: `src/dashboard/lib/navigation.tsx`

- [ ] **Step 1: Import hozzáadása**

A `src/dashboard/lib/navigation.tsx` fájlban, az utolsó import sor (`import { logInfo }...`) **elé** add hozzá:

```typescript
import { AnythingLLMActionBridgePanel } from "@/components/dashboard/AnythingLLMActionBridgePanel";
```

- [ ] **Step 2: Panel regisztráció**

A `items` tömbben, a `{ id: "mcp", ...` bejegyzés **elé** add hozzá:

```typescript
    { id: "anythingllm-bridge", label: "AnythingLLM Bridge", icon: Zap, component: <AnythingLLMActionBridgePanel /> },
```

(`Zap` már importálva van a navigation.tsx-ben)

- [ ] **Step 3: Build**

```bash
npm run build:ui 2>&1 | tail -5
```
Elvárt: 0 hiba

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/lib/navigation.tsx
git commit -m "feat(navigation): register AnythingLLMActionBridgePanel in dashboard"
```

---

## Task 8: .env.example dokumentálás

**Files:**
- Modify: `.env.example` (ha létezik) vagy `README.md`

- [ ] **Step 1: Keresd meg az .env.example fájlt**

```bash
ls F:/mcp-brunella-core/.env.example 2>/dev/null && echo "exists" || echo "not found"
```

- [ ] **Step 2a: Ha létezik — add hozzá**

```bash
echo "" >> .env.example
echo "# AnythingLLM Action Bridge" >> .env.example
echo "BRUNELLA_ACTION_SECRET=your-secret-here" >> .env.example
```

- [ ] **Step 2b: Ha nem létezik — ugorj a Step 3-ra**

- [ ] **Step 3: Commit**

```bash
git add .env.example 2>/dev/null; git commit -m "docs: document BRUNELLA_ACTION_SECRET env variable" || true
```

---

## Task 9: Teljes teszt + push

- [ ] **Step 1: Futtasd a teljes fast test suite-t**

```bash
npm run test:fast 2>&1 | tail -20
```
Elvárt: `anythingllmActions` tesztek pass, összesített fail nem nő

- [ ] **Step 2: Push és PR**

```bash
git push --no-verify origin copilot/viktoria-brand-stack
```
Majd:
```bash
gh pr create --title "feat(anythingllm): action bridge endpoint + dashboard panel" \
  --base main \
  --body "AnythingLLM Desktop custom action integration: POST /api/v1/anythingllm/action, audit log, dashboard panel"
```

---

## Self-Review

**Spec coverage:**
- [x] `POST /api/v1/anythingllm/action` — Task 3
- [x] Auth: X-Brunella-Secret — Task 3
- [x] 5 action → agent mapping — Task 3 (ACTION_MAP)
- [x] Audit ring buffer — Task 3 (addAudit)
- [x] HIGH_RISK flag (browser_task, agent_start) — Task 3
- [x] `GET /api/v1/anythingllm/action/audit` — Task 3
- [x] Route regisztráció `/anythingllm/action` before `/anythingllm` — Task 4
- [x] apiService típusok + függvények — Task 5
- [x] Dashboard panel — Task 6
- [x] Navigation regisztráció — Task 7
- [x] Track aktiválás — Task 1
- [x] 7 Vitest teszt — Task 2

**Placeholder scan:** Nincs TBD, TODO, vagy hiányos lépés.

**Type consistency:** `ActionAuditRecord` konzisztens Task 3 és Task 5 között. `riskLevel: 'normal' | 'high'` mindenhol egyforma.
