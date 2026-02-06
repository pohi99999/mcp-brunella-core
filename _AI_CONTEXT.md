# 🧠 Brunella Project Context
**Generálva:** 2026-02-04
**Mód:** essential

> Másold be ezt a teljes szöveget az AI asszisztensnek a projekt megértéséhez.

---

## 📄 Projekt Útmutató (CLAUDE.md)

```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ELSŐ LÉPÉS - MINDIG OLVASD EL!

**Mielőtt bármit csinálsz, olvasd be ezeket a fájlokat:**

1. `.ai/FOSZAL.md` - Összes ügynök egyesített naplója (mi történt legutóbb?)
2. `conductor/tracks.md` - Aktív fejlesztési szálak (min dolgozunk?)
3. `.ai/claude.md` - Saját naplód (van félbehagyott feladat?)

---

## Projekt Áttekintés

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

---

## Parancsok

```bash
# Teljes rendszer indítás
start-full.bat

# Manuális indítás
npm run build            # TypeScript fordítás
npm run dev              # Backend (:3000)
npm run dev:ui           # Dashboard (:5173)

# Tesztelés
npm test                 # Build + Vitest
npm run test:watch       # Watch mód
npx vitest run test/foo.test.ts  # Egy teszt

# CLI
brunella chat            # Ollama chat
brunella agents          # Ügynökök listája
brunella conductor status # Projekt státusz

# Python
cd myai && uv sync                           # Függőségek
uvicorn server:app --reload --port 8000      # FastAPI

# Szinkronizálás
python scripts/sync_foszal.py                # FŐSZÁL frissítés
python myai/sync_to_r2.py full               # R2 szinkron
```

---

## Architektúra

```
src/
├── agents/           # AI ügynökök (IAgent implementációk)
│   ├── types.ts      # IAgent, AgentResponse interfészek
│   └── *.ts          # Ügynök implementációk
├── tools/            # MCP eszközök
├── server/           # Express + Socket.IO
├── dashboard/        # React UI (Vite, Tailwind)
├── utils/
│   ├── logger.ts     # Strukturált naplózás (HASZNÁLD!)
│   └── rag.ts        # LanceDB vektor keresés
└── cli.ts            # CLI belépési pont

myai/                 # Python alrendszer
├── server.py         # FastAPI (:8000)
├── browser_worker.py # Playwright automatizálás
├── sync_to_r2.py     # R2 szinkron
└── refiner_logic.py  # Adat tisztítás

conductor/            # Projekt menedzsment
├── tracks.md         # Fejlesztési szálak (auto-generált)
├── workflow.md       # Protokollok
└── tracks/           # Track részletek

.ai/                  # AI ügynök naplók
├── FOSZAL.md         # Egyesített napló (auto-generált)
├── claude.md         # Claude napló
├── gemini.md         # Gemini napló
├── cursor.md         # Cursor napló
└── copilot.md        # Copilot napló
```

---

## Ügynök Hierarchia

```
OrchestratorAgent (Központi tervező és delegáló)
  ├── DeveloperAgent      - Kódírás, Python futtatás
  ├── EvaluatorAgent      - Audit, tesztelés
  ├── ResearcherAgent     - Web keresés, információgyűjtés
  ├── DataScientistAgent  - Adat tisztítás, LanceDB
  ├── EdgeProxyAgent      - Cloudflare Workers proxy
  └── ProjectConductor    - Dokumentáció szinkron
```

---

## Kód Minták

### TypeScript Agent
```typescript
import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = "MyAgent";
  role = "Agent célja";
  description = "Mit csinál";
  capabilities = ["képesség1", "képesség2"];

  async execute(task: string, context?: unknown): Promise<unknown> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // Implementáció
      return { status: "success", result: data };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
```

### MCP Tool
```typescript
export const myToolDefinition = {
  name: "my_tool",
  description: "Tool célja",
  inputSchema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"]
  }
};

export async function myToolHandler(params: { param: string }) {
  return { success: true, data: result };
}
```

---

## Konvenciók

| Szabály | Példa |
|---------|-------|
| ESM importok `.js` végződéssel | `import { foo } from './bar.js'` |
| Logger használata | `logInfo()`, `logError()` - NE `console.log()` |
| Típusbiztonság | `unknown` használata `any` helyett |
| Agent válaszok | `{ status: 'success' \| 'error' \| 'delegated' }` |

---

## Fejlesztési Protokollok

### Phoenix Protocol (Öngyógyítás)
- Hiba esetén először próbáld automatikusan javítani
- Checkpointing: állapot mentés minden művelet előtt
- Git Recovery: `git_sync.ps1` mentési pontok

### Data Flywheel
```
Harvest → Refine → Index → Learn → Execute
   ↑                                    │
   └────────────────────────────────────┘
```

### 0-Hiba Stratégia
- `npm run build` MUSZÁJ sikeresnek lennie
- `npm test` MUSZÁJ átmennie commit előtt
- Dokumentáció frissítés ha API változik

---

## KÖTELEZŐ: Napló Frissítés

**Munkamenet végén MINDIG frissítsd a `.ai/claude.md` fájlt!**

Formátum:
```markdown
### YYYY-MM-DD HH:MM - Rövid cím

**Feladat:** Mit csináltál

**Érintett fájlok:**
- fájl1.ts
- fájl2.py

**Státusz:** ✅ Befejezve / ⏳ Folyamatban / ❌ Sikertelen

**Megjegyzések:** Bármilyen fontos info a következő munkamenethez
```

Majd futtasd:
```bash
python scripts/sync_foszal.py
```

---

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| "Ollama connection failed" | `ollama serve` |
| Port 3000 foglalt | `npm run dev:alt` (:3001) |
| Python import hiba | `cd myai && uv sync` |
| Build hiba | `rmdir /s build && npm run build` |

---

## Környezeti Változók (.env)

```env
OLLAMA_BASE_URL=http://localhost:11434
LANGCHAIN_API_KEY=...              # LangSmith tracing
ANYTHINGLLM_API_KEY=...
BRUNELLA_WORKSPACE_ROOT=.
```

---

## Anti-Patterns (KERÜLD)

- `any` típus indoklás nélkül
- CommonJS `require()` (ez ESM projekt)
- `console.log()` produkciós kódban
- `npm test` kihagyása commit előtt
- `conductor/tracks.md` kézi szerkesztése
- `.ai/claude.md` frissítés kihagyása

---

## Megjegyzés

A projekt tulajdonosa kreatív, nem programozó. A fejlesztés AI ügynökökkel történik. Ha ellentmondást találsz a dokumentációban, kérdezz rá.

```

---

## 📄 Fejlesztési Státusz (conductor/tracks.md)

```
# Projekt Nyomkövetés (Tracks)

**Utolsó frissítés:** 2026-02-04
**Generátor:** conductor-tracks-sync.js (pre-commit)

Ez a fájl követi nyomon a fő fejlesztési szálakat (tracks).

---

## 🚀 Aktív Szálak (32)

- [ ] **Agent Swarm Core** [MEDIUM]
  - **ID:** `agent_swarm_core_20260129`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-29
  - 📂 *[./tracks/agent_swarm_core_20260129/](./tracks/agent_swarm_core_20260129/)*

- [ ] **Plan: AI Evaluator & Self-Healing** [MEDIUM]
  - **ID:** `ai_evaluator_self_healing_20260130`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-31
  - 📂 *[./tracks/ai_evaluator_self_healing_20260130/](./tracks/ai_evaluator_self_healing_20260130/)*

- [ ] **Autonomous Reasoning** [MEDIUM]
  - **ID:** `autonomous_reasoning_20260129`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-31
  - 📂 *[./tracks/autonomous_reasoning_20260129/](./tracks/autonomous_reasoning_20260129/)*

- [ ] **BAS Scale-Up & Stabilization (2026-01-31)** [MEDIUM]
  - **ID:** `bas_scale_up_stabilization_20260131`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-02-02
  - 📂 *[./tracks/bas_scale_up_stabilization_20260131/](./tracks/bas_scale_up_stabilization_20260131/)*

- [ ] **Implementation Plan: Browser-Use Harvester with Structured JSON Output** [MEDIUM]
  - **ID:** `browser_use_harvester_20260131`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-02-04
  - 📂 *[./tracks/browser_use_harvester_20260131/](./tracks/browser_use_harvester_20260131/)*

- [ ] **Megvalósítási Terv: Brunella CLI Megvalósítás** [MEDIUM]
  - **ID:** `brunella_cli_replacement_20260121`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-22
  - 📂 *[./tracks/brunella_cli_replacement_20260121/](./tracks/brunella_cli_replacement_20260121/)*

- [ ] **Plan: CLI Gemini-fication & Developer Agent Integration** [MEDIUM]
  - **ID:** `cli_gemini_fication_20260130`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-31
  - 📂 *[./tracks/cli_gemini_fication_20260130/](./tracks/cli_gemini_fication_20260130/)*

- [ ] **Cli Verification** [MEDIUM]
  - **ID:** `cli_verification_20260129`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-29
  - 📂 *[./tracks/cli_verification_20260129/](./tracks/cli_verification_20260129/)*

- [ ] **Cloudflare Edge Integration** [HIGH]
  - **ID:** `cloudflare_edge_integration_20260202`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-02-03
  - 📂 *[./tracks/cloudflare_edge_integration_20260202/](./tracks/cloudflare_edge_integration_20260202/)*

- [ ] **Implementation Plan - A Cogella Core alapstruktúra és aszinkron Gateway alapozása** [MEDIUM]
  - **ID:** `cogella_core_init_20260120`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-22
  - 📂 *[./tracks/cogella_core_init_20260120/](./tracks/cogella_core_init_20260120/)*

- [ ] **Megvalósítási Terv: Szigorú Tesztelés** [MEDIUM]
  - **ID:** `comprehensive_testing_20260128`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-29
  - 📂 *[./tracks/comprehensive_testing_20260128/](./tracks/comprehensive_testing_20260128/)*

- [ ] **Megvalósítási Terv: Dashboard MCP Natív Összekapcsolás** [MEDIUM]
  - **ID:** `dashboard_mcp_native_binding_20260121`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-22
  - 📂 *[./tracks/dashboard_mcp_native_binding_20260121/](./tracks/dashboard_mcp_native_binding_20260121/)*

- [ ] **Implementation Plan: Dashboard UI & Functionality Restoration** [MEDIUM]
  - **ID:** `dashboard_restoration_20260130`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-31
  - 📂 *[./tracks/dashboard_restoration_20260130/](./tracks/dashboard_restoration_20260130/)*

- [ ] **Dashboard V2** [MEDIUM]
  - **ID:** `dashboard_v2_20260129`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-29
  - 📂 *[./tracks/dashboard_v2_20260129/](./tracks/dashboard_v2_20260129/)*

- [ ] **Plan: Containerization & Docker Compose** [MEDIUM]
  - **ID:** `docker_containerization_20260130`
  - **Progress:** 0%
  - **Utolsó aktivitás:** 2026-01-31
  - 📂 *[./tracks/docker_containerization_20260130/](./tracks/docker_containerization_20260130/)*

... (122 további sor)
```

---

## 📄 Elérhető Eszközök (Toolskeszlet.md)

```
# 🛠️ MCP Brunella Core - Eszközkészlet (Tool Inventory)

Ez a dokumentum a szerver által biztosított MCP eszközök automatikusan generált listája.
**Generálva:** 2026. 02. 04. 23:03:08

---

## 🤖 Ágensek (Agents)
- **Orchestrator**: Központi tervező és feladatdelegáló. Az LLM Planner használatával bontja részfeladatokra a komplex kéréseket.
- **ProjectConductor**: Projekt karmester - állapot monitorozás, dokumentáció szinkronizálás, track koordináció. A projekt egységes dokumentálásáért felelős.
- **Developer**: Kódfejlesztő ügynök. Kódírás, refaktorálás, hibakeresés.
- **Evaluator**: Minőségbiztosítási ügynök. Kódellenőrzés, tesztelés, auditálás.
- **Researcher**: Kutató ügynök. Információgyűjtés, összefoglalás, elemzés.
- **DataScientist**: Adattudós ügynök. Adattisztítás, elemzés, vizualizáció.
- **EdgeProxy**: Cloudflare Edge proxy ügynök. Edge kommunikáció, task routing, fallback kezelés.
- **DependencyGraph**: Függőségi gráf elemző. Kód függőségek feltérképezése, körkörös hivatkozások detektálása, hotspot azonosítás.
- **Python**: Python alrendszer őre. Python környezet, FastAPI, függőségek és modulok felügyelete.
- **DocsIntelligence**: Dokumentáció intelligencia. Dokumentáció és kód összehasonlítás, elavult referenciák, hiányzó dokumentáció detektálása.
- **ProjectOrganizer**: Projekt szervező. Fájlrendszer elemzés, struktúra optimalizálás.
- **AgentArchitect**: Ügynök architekt. Új ügynökök tervezése és implementálása.
- **SpecWriterAgent**: Specifikáció generálás. Specifikációkat generál a projekt számára a bemeneti információk alapján.
- **PromptEngineerAgent**: Prompt optimalizálás. Optimalizálja a promptokat a hatékonyabb LLM interakció érdekében.
- **FixerAgent**: Hiba javítás. Kódhibákat javít a megadott kontextus és hibaüzenetek alapján.
- **RefactorAgent**: Kód refaktorálás. Refaktorálja a kódot a jobb olvashatóság, karbantarthatóság és teljesítmény érdekében.
- **MemoryCuratorAgent**: LanceDB karbantartás. Kezeli a LanceDB vektor adatbázis tartalmát, optimalizálja és tisztítja a bejegyzéseket.

## 💻 Brunella CLI Parancsok
- **brunella conductor status**: Projekt státuszának megjelenítése.
- **brunella conductor setup**: Conductor infrastruktúra ellenőrzése.
- **brunella memory list/show/refresh**: Kontextus kezelés.
- **brunella run <tool>**: MCP eszköz futtatása.
- **brunella chat**: Interaktív chat (Ollama).
- **brunella agents**: Ágensek listázása CLI-ből.

```

---

## 📁 Projekt Struktúra (Főbb Mappák)

```
src/
  agents/      - AI ügynökök (Orchestrator, Developer, Evaluator...)
  server/      - Express API + Socket.IO
  dashboard/   - React frontend
  tools/       - MCP eszközök
myai/          - Python alrendszer (FastAPI, Playwright)
conductor/     - Projekt menedzsment, tracks
```

---

## 💡 Gyors Útmutató az AI-nak

1. Ez egy **multi-agent AI rendszer** ami automatizálja a fejlesztést
2. A **Conductor** kezeli a fejlesztési szálakat (tracks)
3. **Ollama** a lokális LLM (llama3.1, deepseek-coder)
4. A gazdája **nem programozó** - érthetően kommunikálj
5. Ha kódot írsz, magyarázd el mit csinál

