# Implementációs Terv: Chrome DevTools MCP Agent
**Track ID:** `chrome_devtools_mcp_agent_20260223`

> LOW prioritás — csak a PAIOS core implementáció (Orchestrator Chat + ModelSelector) után érdemes kezdeni.

---

## Phase 1: CDP integráció (Playwright CDP mode)

* [ ] **Task 1.1** — Ellenőrizd hogy `playwright` már telepítve van:
  ```bash
  npm ls playwright
  ```
  Ha nem: `npm install playwright`

* [ ] **Task 1.2** — `src/agents/ChromeDevToolsAgent.ts` alap struktúra (IAgent implementáció)
  - CDP kapcsolat Playwright CDP mode-dal: `chromium.connectOverCDP('http://localhost:9222')`
  - Graceful fallback: ha Chrome nem fut debug módban → descriptív hibaüzenet

* [ ] **Task 1.3** — `src/agents/ChromeDevToolsAgent.ts` alapfunkciók:
  - `captureNetworkRequests(url, durationMs)` — hálózati kérések listázása
  - `captureConsoleErrors(url, durationMs)` — JS hibák és warningok
  - `getPerformanceMetrics(url)` — DOM load, FCP, resource count

---

## Phase 2: generateDebugReport + execute()

* [ ] **Task 2.1** — `generateDebugReport(url): Promise<string>`
  - Összes képesség futtatása
  - Markdown report generálás: fejléc, network summary, errors, performance

* [ ] **Task 2.2** — `execute(task, context)` implementálása:
  - `context.url` kinyerése, ha nincs → URL keresés a task stringből (regex)
  - `generateDebugReport()` hívás
  - `AgentResponse { status: 'success', data: { report, metrics, errors } }`

---

## Phase 3: Regisztráció + tesztek

* [ ] **Task 3.1** — `src/agents/registry.json` bővítése:
  ```json
  {
    "name": "ChromeDevTools",
    "module": "ChromeDevToolsAgent.js",
    "class": "ChromeDevToolsAgent",
    "triggers": ["debug", "network", "performance", "chrome", "devtools"],
    "priority": 3
  }
  ```

* [ ] **Task 3.2** — `test/chromeDevToolsAgent.test.ts`
  - Mock Playwright CDP: fake network request lista
  - `captureNetworkRequests` → helyes formátum
  - `execute` → markdown report a data.report-ban
  - Chrome nem elérhető eset → `status: 'error'` + érthető hibaüzenet

* [ ] **Task 3.3** — `npm run build && npm test` → 0 hiba

---

## 🎯 Sikerességi Kritériumok

- `ChromeDevToolsAgent.execute('Debug localhost:5173', { url: 'http://localhost:5173' })` → markdown report
- Ha Chrome debug port nem elérhető → graceful error (nem crash)
- registry.json-ban regisztrálva
- `npm run build` → 0 TypeScript hiba
- `npm test` → minden PASS
