# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Master dokumentum: `README.md`** — Részletes architektúra, API-k, konvenciók.
> **Copilot referencia: `.github/copilot-instructions.md`** — Teljes parancsreferencia, agent routing táblázat.

## Projekt Röviden

**Brunella Agent System (BAS)** — Hibrid Node.js/Python multi-agent rendszer, MCP protokoll.
Technológiák: TypeScript ESM, Express 4, React 19, Ollama, Gemini, GitHub Models, FastAPI, Cloudflare Workers.

---

## KÖTELEZŐ Bootstrap (Munkamenet Elején!)

### 1. GitHub Szinkronizálás
```bash
bash scripts/sync.sh              # Git Bash / WSL
# VAGY: scripts\sync.bat (CMD) / .\scripts\sync.ps1 (PowerShell)
```

### 2. Kontextus Fájlok (sorrendben!)
```
1. .ai/BOOTSTRAP.md              # Projekt összefoglaló
2. conductor/tracks.md            # Aktív fejlesztések (mit csinálunk MOST)
3. .ai/FOSZAL.md                  # Mi történt legutóbb?
4. .ai/claude.md                  # Te mit csináltál legutóbb
```

### 3. Rendszer Validáció
```bash
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)
npm run test:fast             # Gyors tesztek (~1-2 perc) — commit előtt
npm test                      # Teljes suite (~10 perc) — push / track lezárás előtt
```

**Ha BUILD FAIL vagy TESZT FAIL → NE kezdj fejlesztésbe! Javítsd először!**

---

## Gyors Parancs Referencia

```bash
# Build & Run
npm run build        # TypeScript fordítás (src/ → build/) + registry.json/TRIZ adatok másolása
npm run build:ui     # Dashboard build (tsconfig.ui.json + vite.config.ts — KÜLÖNÁLLÓ!)
npm run dev          # MCP stdio + Express :3000 (ts-node/esm loader)
npm run dev:ui       # Vite Dashboard :5173
npm run lint         # ESLint (max-warnings=0 — CI meghiúsítja)
npm run lint:fix     # ESLint auto-fix
npm run smoke        # Health check (Ollama, Express, FastAPI)
start-full.bat       # Teljes rendszer (Windows)

# Tesztelés
npm run test:fast                     # Gyors tesztek (~1-2 perc) — napi munka
npm test                              # Build + teljes Vitest suite (~10 perc)
npx vitest run test/foo.test.ts       # Egy teszt fájl
npm run test:watch                    # Watch mód
npm run test:e2e                      # Playwright e2e

# CLI
brunella                  # Interaktív menü (nyíl + enter navigáció)
brunella chat             # Chat
brunella agents           # Ügynökök listája
brunella conductor status # Projekt státusz

# Python alrendszer (Python ≥3.12, uv a csomagkezelő)
cd myai && uv sync                          # Függőségek
uvicorn server:app --reload --port 8000     # FastAPI

# Szinkronizálás
python scripts/sync_foszal.py  # .ai/FOSZAL.md frissítése munka után
```

---

## Architektúra

### Belépési Pontok

- **`src/index.ts`** — Dual-mode: egyszerre indít MCP `StdioServerTransport`-ot (Claude Desktop-hoz) és Express HTTP szervert (`:3000`). Mindkét mód `registerAllTools()`-t hív.
- **`src/cli.ts`** — CLI belépési pont (Commander.js, 70+ parancs). Magyar nyelvű, inquirer.js menüvezérelt.

### Fő Alrendszerek

| Alrendszer | Helye | Technológia |
|---|---|---|
| Node.js backend | `src/` | TypeScript ESM, Express 4, Socket.IO |
| REST routes | `src/server/routes/` | 52 fájl, de csak ~20 aktív `index.ts`-ben (lásd figyelmeztetés!) |
| Dashboard | `src/dashboard/` | React 19, Vite, Tailwind v4, Radix UI |
| Python alrendszer | `myai/` | FastAPI `:8000`, FastMCP, LanceDB, ChromaDB |
| Agent rendszer | `src/agents/` | 95+ agent, SQLite task queue |
| MCP tools | `src/tools/` | 53 tool, 33 fájl |

> ⚠️ **Route regisztrációs rés:** `src/server/routes/` 52 fájlt tartalmaz, de csak ~20 van importálva `src/server/routes/index.ts`-ben. Új route hozzáadása előtt ellenőrizd, hogy nem létezik-e már nem-regisztrált fájlként.

> ⚠️ **Dashboard panel rés:** Sok komponens van `src/dashboard/components/dashboard/`-ban, ami **nincs** regisztrálva `src/dashboard/lib/navigation.tsx`-ben (NavigationRegistry). Minden új panelt ott is regisztrálj.

### Agent Hierarchia

```
OrchestratorAgent / EnterpriseOrchestratorAgent  (koordinátorok)
├── Core: Developer, Evaluator, Researcher, TaskDecomposer
├── Automatizálás: RobotkezV2 (Playwright/LLM), Voice (Whisper)
├── Engineering: SpecWriter, GenesisOrchestrator, LintFixer
├── Enterprise (~20): Finance, Sales, HR, Logistics, Legal, Marketing…
├── Swarm: SwarmManager + SwarmAgent (src/agents/swarm/)
├── TOML Dynamic: myai/agents/*.toml
└── Menedzsment: ProjectConductor (tracks.md sync)
```

**Registry:** `src/agents/registry.json` — minden bejegyzés: `name`, `module`, `class`, `triggers`, `priority`, `capabilities`. TOML-alapú agentek `"class": "DynamicAgent"` + `"tomlPath"`.

**RBAC:** `src/agents/permissions.ts` — 6 profil: `ADMIN`, `DEVELOPER`, `RESEARCHER`, `EVALUATOR`, `ROBOTKEZ`, `READONLY`.

### Model Router / Bifrost Gateway

- **Model Router** (`src/core/modelRouter.ts`) — RULE-MR1–4: Brain (Cloud: Gemini, GPT-4o) = `complexity: 'high'`; Muscle (Local: Ollama `qwen2.5-coder:7b`) = `complexity: 'low'` vagy `budget=0`
- **Bifrost Gateway** (`src/core/bifrost_gateway.ts`) — 4 provider (Ollama, Gemini, GitHub Models, Anthropic) auto-fallback lánccal.

### Phoenix Protocol (Self-Healing)

`src/core/checkpoint.ts` + `src/core/phoenixEventBus.ts` — hiba esetén:
1. SQLite-ba checkpoint (`executing` → `failed`)
2. AgentManager auto-retry: 1s → 3s → 10s, max 3 kísérlet
3. Git recovery `sync_foszal.py` + commit

### TypeScript konfiguráció

- Target: ES2022, Module: Node16, Strict mode
- `rootDir: ./src`, `outDir: ./build`
- **`src/dashboard/` KI VAN ZÁRVA a fő `tsconfig.json`-ból** — saját `tsconfig.ui.json` és `vite.config.ts` van. Buildelés: `npm run build:ui`.

---

## Kód Konvenciók

**Kritikus szabályok:**
- **ESM `.js` kiterjesztés KÖTELEZŐ:** `import { foo } from './bar.js'` — BUILD FAIL nélküle
- **`any` TILOS** — használj `unknown` + type guard
- **`console.log` TILOS** — ESLint `no-console: warn` érvényesíti. Használd:
  - Agent kódban: `logInfo('AgentName', 'msg')`, `logError('AgentName', 'msg')`, `setAgentStatus()`
  - Szerver/utility kódban: `new Logger('feature.log')` → `logger.info('msg')`
- **Agent `finally` KÖTELEZŐ:** `setAgentStatus(this.name, 'idle')` mindig legyen `finally`-ban
- **Vitest (NE Jest!):** `vi.fn()`, `vi.mock()`, `vi.spyOn()` — soha nem `jest.*`
- **Teszt konfig:** `fileParallelism: false`, 15s default timeout, `test/setup.ts`

**Commit:** Conventional Commits — `feat(scope): subject`, `fix(scope): subject`

---

## Agent Implementációs Minták (3 féle)

### 1. Egyszerű agent — `IAgent` interfész
```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent'; role = 'Purpose'; description = 'What it does';
  capabilities = ['skill1'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ finally-ban!
    }
  }
}
```

### 2. RAG memóriával — `BaseAgent` (Bridge Pattern)
```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MyComplexAgent extends BaseAgent {
  name = 'MyComplex'; role = 'Role'; description = '...';
  capabilities = ['skill1'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // context.pastExperiences — RAG memória auto-betöltve
    return { success: true, message: 'OK', data: result };
  }
}
```

### 3. TOML-alapú DynamicAgent
Hozz létre `myai/agents/MyAgent.toml` fájlt (systemPrompt, query template, tags).
A `registry.json`-ban állítsd be: `"class": "DynamicAgent"` + `"tomlPath"`. TypeScript kód nem kell.

### Új agent regisztrálása
Add hozzá `src/agents/registry.json`-hoz, majd regisztráld `src/server/registry.ts`-ben.

---

## MCP Tool Minta

```typescript
// src/tools/myTool.ts
export const myToolDefinition = {
  name: 'my_tool', description: 'Tool purpose',
  inputSchema: { type: 'object', properties: { param: { type: 'string' } }, required: ['param'] }
};

export async function myToolHandler(params: { param: string }) {
  try {
    return { success: true, data: await doSomething(params.param) };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

Regisztrálás: `src/server/registry.ts` → `registerAllTools()` → `server.registerTool(definition, handler)`.

---

## CLI Konvenció

Minden új CLI parancsnak:
- **Magyar nyelvűnek** kell lennie
- **Inquirer.js menüvezérelt** (nyíl + enter — nem szabad szöveges input)
- **Színes output:** chalk, boxen, ora spinner
- Fájlok: `src/cli/commands/`. Regisztrálás: `src/cli.ts`.

---

## Fejlesztési Workflow

- **Track életciklus:** PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
- **0-Hiba Stratégia:** `npm run build` + `npm run test:fast` MUSZÁJ PASS commit előtt
- **EPP v2 6. szabály (KRITIKUS):** Minden új funkció = Dashboard panel (React, Radix UI) + CLI parancs (magyar, inquirer.js) IS KÖTELEZŐ
- **Új feature ellenőrzőlista:** Route regisztrálva `index.ts`-ben? Panel regisztrálva `navigation.tsx`-ben?

---

## Claude-Specifikus Koordináció

### Munkamenet Napló (.ai/claude.md)

**Munkamenet végén** add hozzá `.ai/claude.md`-be:
```markdown
### YYYY-MM-DD HH:MM - [Rövid cím]
**Feladat:** Mit csináltál
**Érintett fájlok:** fájl1.ts, fájl2.ts
**Státusz:** ✅ Befejezve / ⏳ Folyamatban
**Megjegyzés:** Info a következő ügynöknek
```
Majd: `python scripts/sync_foszal.py`

### Glass Box Filozófia

**Magyarázd el MIÉRT** csinálsz valamit, mielőtt megteszed. Ha hibát találsz, mondd el a gyökér okát.

---

## Környezeti Változók (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**LLM providerek (prioritás sorrendben):**
```env
GITHUB_PAT=...               # GitHub Models — GITHUB_TOKEN előtt prioritás!
GEMINI_API_KEY=...            # Gemini
ANTHROPIC_API_KEY=...         # Claude (Bifrost Gateway)
OLLAMA_MODEL=qwen2.5-coder:7b # Alapértelmezett lokális modell
```

---

## Gyakori Hibák

| Probléma | Megoldás |
|----------|----------|
| `ERR_MODULE_NOT_FOUND` | Import hiányzó `.js` kiterjesztés → add hozzá |
| BUILD FAIL | `rmdir /s /q build && npm run build` |
| Dashboard build fail | `npm run build:ui` — különálló Vite build, saját tsconfig |
| Ollama nem elérhető | `ollama serve` futtatása |
| Agent "stuck" | Phoenix auto-retry, kézi: `setAgentStatus(name, 'idle')` |
| GitHub Models 401 | `GITHUB_PAT` lejárt — frissítsd (ne a `GITHUB_TOKEN`-t!) |
| FastAPI nem indul | `cd myai && uv sync && uvicorn server:app --reload --port 8000` |

---

## Védett Fájlok — SOHA NE TÖRÖLD!

`src/index.ts`, `src/cli.ts`, `src/agents/types.ts`, `src/agents/registry.json`, `src/server/web.ts`, `src/server/registry.ts`, `src/core/llm_client.ts`, `conductor/tracks.md`, `.ai/FOSZAL.md`

**Ha "takarítani" akarsz — KÉRDEZZ ELŐSZÖR!**

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
