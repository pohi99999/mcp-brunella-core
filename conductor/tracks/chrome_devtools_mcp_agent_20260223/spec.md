# Specifikáció: Chrome DevTools MCP Agent
**Track ID:** `chrome_devtools_mcp_agent_20260223`
**Státusz:** proposed
**Prioritás:** LOW
**Forrás:** `docs/Claude-nak/fejlesztes.md` — "UX & Web Debug Agent (chrome-devtools-mcp)"

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| RobotkezV2Agent (Playwright) | ✅ KÉSZ | Böngésző automatizálás |
| browser_worker.py (Python) | ✅ KÉSZ | Scraping + adatkinyerés |
| **ChromeDevToolsAgent** | ❌ HIÁNYZIK | CDP-alapú debug agent |

A Playwright-alapú RobotkezV2 böngészőt *vezérel*, de nem *debuggol*. A Chrome DevTools Protocol (CDP) lehetővé teszi a hálózati kérések, JS hibák és performance adatok rögzítését — amit a Playwright nem tesz elérhetővé könnyen.

---

## 2. Agent Interfész

```typescript
// src/agents/ChromeDevToolsAgent.ts
export class ChromeDevToolsAgent implements IAgent {
  name = 'ChromeDevTools';
  role = 'Web Debug & Performance Analyst';
  description = 'Chrome DevTools Protocol-alapú web debug: hálózati kérések, JS hibák, performance metrics';
  capabilities = ['network_capture', 'console_errors', 'performance_metrics', 'debug_report'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    // task: "Debug https://localhost:5173 API hívásait"
    // context: { url?: string, timeout?: number }
  }
}
```

---

## 3. CDP Kapcsolat

Chrome indítása debug módban:
```bash
# Windows
start chrome --remote-debugging-port=9222 --user-data-dir=C:\temp\chrome-debug

# VAGY Playwright CDP mode (kompatibilis a meglévő infrastruktúrával)
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
```

**Fontos:** Playwright CDP mode-t preferáljuk, mert a Playwright már telepítve van a projektben.

---

## 4. Képességek

### 4.1. Network Capture
```typescript
async captureNetworkRequests(url: string, durationMs = 5000): Promise<{
  requests: { url: string; method: string; status: number; duration: number }[];
  failedRequests: { url: string; error: string }[];
}>
```

### 4.2. Console Errors
```typescript
async captureConsoleErrors(url: string, durationMs = 5000): Promise<{
  errors: { message: string; source: string; line: number }[];
  warnings: { message: string }[];
}>
```

### 4.3. Performance Metrics
```typescript
async getPerformanceMetrics(url: string): Promise<{
  domLoadTime: number;
  firstContentfulPaint: number;
  totalBlockingTime: number;
  resourceCount: number;
}>
```

### 4.4. Debug Report
```typescript
async generateDebugReport(url: string): Promise<string>
// Returns: Markdown report összefoglalóval
```

---

## 5. Tipikus Használat

```typescript
// OrchestratorAgent delegálás:
const result = await agentManager.executeAgent('ChromeDevTools',
  'Debug a localhost:5173 dashboard network hibáit',
  { url: 'http://localhost:5173', timeout: 10000 }
);
// result.data.report → markdown debug riport
```

---

## 6. Függőségek

- Playwright már telepítve (`playwright` package) — CDP mode-ot használunk
- Chrome böngésző a gépen (debug port szükséges)
- Nincs más blocker — önállóan implementálható
