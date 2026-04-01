# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Master dokumentum: `README.md`** — Részletes architektúra, API-k, konvenciók.
> **Copilot referencia: `.github/copilot-instructions.md`** — Teljes parancsreferencia, agent routing táblázat.

## Projekt Röviden

**Brunella Agent System (BAS)** — Hibrid Node.js/Python multi-agent rendszer, MCP protokoll.
Technológiák: TypeScript ESM, Express 4, React 19, Ollama, Gemini, GitHub Models, FastAPI, Cloudflare Workers.

Méret (2026-03-25 audit): 95+ agent, 53 MCP tool, 52 route fájl (~20 aktív), ~55 dashboard panel, 6 SQLite DB, 5 LLM provider.

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
npm run test:fast             # Gyors tesztek (~1-2 perc) — commit/push előtt
npm test                      # Teljes suite (~10 perc) — napi scheduled run / manuális release-check
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
npm run test:coverage                 # Lefedettségi riport
npm run test:e2e                      # Playwright e2e
cd myai && pytest tests/              # Python tesztek

# Mikor mit futtass:
# | Esemény                          | Parancs                  |
# | Commit előtt                     | npm run test:fast        |  ← pre-commit hook is futtatja
# | Push előtt                       | npm run test:fast        |  ← pre-push hook ezt futtatja
# | Napi teljes kör                  | GitHub Actions daily full suite (`npm test`) |
# | Track lezárásakor / Release előtt| npm test + npm run smoke |
# | Napi fejlesztés                  | npm run test:fast        |

# CLI
brunella                  # Interaktív menü (nyíl + enter navigáció)
brunella chat             # Chat
brunella agents           # Ügynökök listája
brunella conductor status # Projekt státusz

# Python alrendszer (Python ≥3.12, uv a csomagkezelő)
cd myai && uv sync                          # Függőségek
uvicorn server:app --reload --port 8000     # FastAPI

# Copilot Dashboard Bridge (szerver nélküli gyors műveletek)
node scripts/copilot-dashboard.js tracks list
node scripts/copilot-dashboard.js agents execute <name> "<task>"
node scripts/copilot-route.js "feladat"     # Agent routing (confidence score)

# Szinkronizálás
python scripts/sync_foszal.py  # .ai/FOSZAL.md frissítése munka után
npm run sync:bootstrap         # .ai/BOOTSTRAP.md regenerálása
npm run agent:health           # Agent registry + capability health check
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
| REST routes | `src/server/routes/` | 52 fájl, központosítva `index.ts`-ben |
| Dashboard | `src/dashboard/` | React 19, Vite, Tailwind v4, Radix UI |
| Python alrendszer | `myai/` | FastAPI `:8000`, FastMCP, LanceDB |
| Agent rendszer | `src/agents/` | 95+ agent, SQLite task queue |
| MCP tools | `src/tools/` | 53 tool, 33 fájl |

> ✅ **Route regisztráció:** Az összes (52+) route fájl központilag regisztrálva van a `src/server/routes/index.ts`-ben.
> ✅ **Dashboard panelek:** Az összes elérhető komponens regisztrálva van a `src/dashboard/lib/navigation.tsx`-ben (NavigationRegistry).

### Agent Hierarchia

```
OrchestratorAgent / EnterpriseOrchestratorAgent  (koordinátorok)
├── Core: Developer, Evaluator, Researcher, TaskDecomposer
├── Automatizálás: RobotkezV2 (Playwright/browser-use), Voice (Whisper)
├── Engineering: SpecWriter, GenesisOrchestrator, LintFixer
├── Enterprise (~20): Finance, Sales, HR, Logistics, Legal, Marketing…
├── Swarm: SwarmManager + SwarmAgent (src/agents/swarm/)
├── TOML Dynamic: myai/agents/*.toml
└── Menedzsment: ProjectConductor (tracks.md sync)
```

**Registry:** `src/agents/registry.json` — minden bejegyzés: `name`, `module`, `class`, `triggers`, `priority`, `capabilities`. TOML-alapú agentek `"class": "DynamicAgent"` + `"tomlPath"`.

**RBAC:** `src/agents/permissions.ts` — 6 profil: `ADMIN`, `DEVELOPER`, `RESEARCHER`, `EVALUATOR`, `ROBOTKEZ`, `READONLY`.

**Agent routing (confidence-alapú):**
```bash
node scripts/copilot-route.js "feladat"   # → { bestAgent, confidence }
# confidence >= 0.7 → delegálj; < 0.7 → csinálj magad vagy keress alternativát
# Fájl szerkesztés / git → NE delegálj (natív Claude képesség jobb)
```

### Model Router / Bifrost Gateway

- **Model Router** (`src/core/modelRouter.ts`) — RULE-MR1–4: Brain (Cloud: Gemini, GPT-4o) = `complexity: 'high'`; Muscle (Local: Ollama `qwen2.5-coder:7b`) = `complexity: 'low'` vagy `budget=0`
- **Bifrost Gateway** (`src/core/bifrost_gateway.ts`) — 4 provider (Ollama, Gemini, GitHub Models, Anthropic) auto-fallback lánccal.

### Phoenix Protocol (Self-Healing)

`src/core/checkpoint.ts` + `src/core/phoenixEventBus.ts` — hiba esetén:
1. SQLite-ba checkpoint (`executing` → `failed`)
2. AgentManager auto-retry: 1s → 3s → 10s, max 3 kísérlet
3. Git recovery `sync_foszal.py` + commit

### SQLite Adatbázisok

| DB | Tartalom |
|----|----------|
| `brunella.db` | Fő rendszer adatok |
| `tasks.db` | Agent task queue |
| `checkpoints.db` | Phoenix Protocol checkpointok |
| `audit.db` | Audit trail |
| `cean.db` | Cloudflare Edge Agent Network |
| `comet_memory.db` | COMET memória |

### TypeScript konfiguráció

- Target: ES2022, Module: Node16, Strict mode
- `rootDir: ./src`, `outDir: ./build`
- **`src/dashboard/` KI VAN ZÁRVA a fő `tsconfig.json`-ból** — saját `tsconfig.ui.json` és `vite.config.ts` van. Buildelés: `npm run build:ui`.

---

## Data Flywheel Pipeline

```
1. Harvest  → myai/agents/tech_harvester.py (Playwright/browser-use scraping)
2. Refine   → myai/refiner_logic.py (LLM summary, adattisztítás, dedup)
3. Index    → LanceDB (data/brunella_lancedb/) + Golden Dataset (JSONL)
4. Learn    → Agent RAG (src/core/goldenDatasetBridge.ts)
5. Execute  → OrchestratorAgent döntések (RAG-enhanced)
```

```bash
brunella harvest run      # Teljes pipeline
brunella harvest status   # Utolsó harvest összegzés
```

**Golden Dataset formátum** (`myai/data/training/golden_dataset.jsonl`):
```json
{ "instruction": "...", "input": "", "output": "...", "metadata": {"source": "...", "timestamp": "..."} }
```

---

## Kód Konvenciók

**TypeScript kritikus szabályok:**
- **ESM `.js` kiterjesztés KÖTELEZŐ:** `import { foo } from './bar.js'` — BUILD FAIL nélküle
- **`any` TILOS** — használj `unknown` + type guard
- **`console.log` TILOS** — ESLint `no-console: warn` érvényesíti. Használd:
  - Agent kódban: `logInfo('AgentName', 'msg')`, `logError('AgentName', 'msg')`, `setAgentStatus()`
  - Szerver/utility kódban: `new Logger('feature.log')` → `logger.info('msg')`
- **Agent `finally` KÖTELEZŐ:** `setAgentStatus(this.name, 'idle')` mindig legyen `finally`-ban. Megjegyzés: A `BaseAgent` ezt automatikusan kezeli az `execute()` metódusában, de a standalone (IAgent-et közvetlenül megvalósító) ágenseknél manuálisan kell alkalmazni!
- **Vitest (NE Jest!):** `vi.fn()`, `vi.mock()`, `vi.spyOn()` — soha nem `jest.*`
- **Teszt konfig:** `fileParallelism: false`, 15s default timeout, `test/setup.ts`

**Python kritikus szabályok:**
- **Pydantic modellek** kötelezők (`myai/pydantic_models.py`) — ne használj nyers dict-et
- **FastMCP ≥2.14.3** a Python MCP serverhez
- **browser-use** a Playwright helyett LLM-vezérelt böngészőautomatizáláshoz
- **Windows Unicode:** emoji-t NE használj logban — `[OK]` / `[AI]` ASCII alternatívák (UnicodeEncodeError!)
- **LanceDB opcionális import:** `try: import lancedb; HAS_LANCEDB = True except: HAS_LANCEDB = False`

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
    // A BaseAgent.execute() automatikusan kezeli a státusz-visszaállítást finally blokkban!
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

Regisztrálás: `src/server/registry.ts` → `registerAllTools()` → `server.tool(name, desc, schema, handler)`.

---

## CLI Konvenció

Minden új CLI parancsnak:
- **Magyar nyelvűnek** kell lennie
- **Inquirer.js menüvezérelt** (nyíl + enter — nem szabad szöveges input)
- **Színes output:** chalk, boxen, ora spinner
- Fájlok: `src/cli/commands/`. Regisztrálás: `src/cli.ts`.

---

## Fejlesztési Workflow

**Track életciklus:** PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED

**EPP v2 — 7 Arany Szabály (mind kötelező!):**
1. Minden feature = új track a `conductor/tracks/`-ban
2. Hibák javítása AZONNAL — ne haladj tovább törött kóddal
3. Commit gyakran — kis, logikus egységek
4. TODO lista frissítése folyamatosan
5. `npm run build` + `npm run test:fast` MUSZÁJ PASS commit előtt
6. Minden új funkció = **Dashboard panel** (React, Radix UI) + **CLI parancs** (magyar, inquirer.js) IS KÖTELEZŐ
7. Track lezárásakor: teljes dokumentáció + `sync_foszal.py`

**Új feature ellenőrzőlista:**
- [ ] Route regisztrálva `src/server/routes/index.ts`-ben?
- [ ] Panel regisztrálva `src/dashboard/lib/navigation.tsx`-ben?
- [ ] Agent hozzáadva `src/agents/registry.json`-hoz?
- [ ] `npm run build` + `npm run test:fast` zöld?

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

**.env változtatás után MINDIG:** Node.js restart + FastAPI restart + health check!

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
| Windows Unicode hiba | Emoji → ASCII (`[OK]` / `[AI]`) a Python logokban |
| cron-parser v5 | Csak `CronExpressionParser.parse()` érvényes — nem `parseExpression()` |

---

## Védett Fájlok — SOHA NE TÖRÖLD!

`src/index.ts`, `src/cli.ts`, `src/agents/types.ts`, `src/agents/registry.json`, `src/server/web.ts`, `src/server/registry.ts`, `src/core/llm_client.ts`, `conductor/tracks.md`, `.ai/FOSZAL.md`

**Ha "takarítani" akarsz — KÉRDEZZ ELŐSZÖR!**

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
