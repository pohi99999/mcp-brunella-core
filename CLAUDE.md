# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Első Lépés

**Mielőtt bármit csinálsz, olvasd be:**
1. `.ai/FOSZAL.md` - Összes ügynök egyesített naplója
2. `conductor/tracks.md` - Aktív fejlesztési szálak
3. `.ai/claude.md` - Saját naplód (félbehagyott feladatok)

## Projekt

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására.
- Lokális LLM: Ollama
- Protokoll: MCP (Model Context Protocol)
- Stack: TypeScript (Node.js) + Python (FastAPI)

## Parancsok

```bash
# Indítás
start-full.bat               # Teljes rendszer (Windows)
npm run build                # TypeScript fordítás
npm run dev                  # Backend (:3000)
npm run dev:ui               # Dashboard (:5173)

# Tesztelés
npm test                     # Build + Vitest
npm run test:watch           # Watch mód
npx vitest run test/foo.test.ts   # Egy teszt

# CLI
brunella doctor              # Rendszer diagnosztika
brunella chat                # Interaktív chat
brunella agents              # Ügynökök listája
brunella tools               # MCP eszközök
brunella conductor           # Projekt menedzsment

# Python alrendszer
cd myai && uv sync           # Függőségek
uvicorn server:app --reload --port 8000

# Cloudflare (bas-cloudflare-orchestrator mappából)
npx wrangler deploy          # Worker deploy
npx wrangler d1 list         # D1 adatbázisok
npx wrangler r2 bucket list  # R2 bucket-ek

# Szinkronizálás
python scripts/sync_foszal.py   # FŐSZÁL frissítés
```

## Architektúra

```
src/
├── agents/         # AI ügynökök (IAgent implementációk)
│   └── types.js    # IAgent, AgentResponse interfészek (FONTOS!)
├── tools/          # MCP eszközök
├── server/         # Express + Socket.IO API
├── dashboard/      # React UI (Vite, Tailwind)
├── utils/
│   ├── logger.ts   # Strukturált naplózás (MINDIG HASZNÁLD!)
│   └── rag.ts      # LanceDB vektor keresés
└── cli.ts          # CLI belépési pont

myai/               # Python alrendszer
├── server.py       # FastAPI (:8000)
├── browser_worker.py # Playwright automatizálás
└── refiner_logic.py  # Adat tisztítás + LanceDB

conductor/          # Projekt menedzsment
├── tracks.md       # Fejlesztési szálak (AUTO-GENERÁLT, ne szerkeszd!)
├── workflow.md     # Data Flywheel, Phoenix Protocol
└── tracks/         # Track részletek

.ai/                # AI ügynök naplók
├── FOSZAL.md       # Egyesített napló (auto-generált)
└── claude.md       # Claude Code napló
```

## Aktív Ügynökök

| Ügynök | Szerep | Fájl |
|--------|--------|------|
| **Orchestrator** | Központi tervező, feladat delegálás | `OrchestratorAgent.ts` |
| **Evaluator** | Audit, tesztelés, öngyógyítás | `EvaluatorAgent.ts` |
| **ProjectConductor** | Dokumentáció szinkron, track kezelés | `ProjectConductorAgent.ts` |
| Developer | Kódírás, Python futtatás | `DeveloperAgent.ts` |
| Researcher | Web keresés (Playwright) | `ResearcherAgent.ts` |
| DataScientist | Adat tisztítás, LanceDB | `DataScientistAgent.ts` |
| EdgeProxy | Cloudflare Workers proxy | `EdgeProxyAgent.ts` |
| DependencyGraph | Függőség elemzés | `DependencyGraphAgent.ts` |
| DocsIntelligence | Dokumentáció elemzés | `DocsIntelligenceAgent.ts` |
| Python | Python alrendszer kezelés | `PythonAgent.ts` |

## Kód Minta - Új Agent

```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = "MyAgent";
  role = "Cél";
  description = "Mit csinál";
  capabilities = ["skill1", "skill2"];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // Implementáció
      return { status: "success", data: result };
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

## Konvenciók

| Szabály | Helyes | Helytelen |
|---------|--------|-----------|
| ESM importok | `import { foo } from './bar.js'` | `require('./bar')` |
| Naplózás | `logInfo()`, `logError()` | `console.log()` |
| Típusok | `unknown` vagy konkrét típus | `any` |
| Agent válasz | `{ status: 'success' \| 'error' }` | Egyedi formátum |

## Protokollok

### Data Flywheel
```
Harvest (browser_worker.py) → Refine (refiner_logic.py) →
Index (LanceDB) → Learn (RAG) → Execute (Orchestrator)
```

### Phoenix Protocol (Öngyógyítás)
- Hiba → Automatikus javítási kísérlet
- Checkpointing minden művelet előtt
- Git recovery (`git_sync.ps1`)

### 0-Hiba Stratégia
- `npm run build` MUSZÁJ átmennie
- `npm test` MUSZÁJ átmennie commit előtt

## Munkamenet Végén

**KÖTELEZŐ frissíteni a `.ai/claude.md` fájlt:**

```markdown
### YYYY-MM-DD HH:MM - Cím

**Feladat:** Mit csináltál
**Fájlok:** fájl1.ts, fájl2.py
**Státusz:** ✅ Befejezve / ⏳ Folyamatban / ❌ Sikertelen
**Megjegyzés:** Info a következő munkamenethez
```

Majd: `python scripts/sync_foszal.py`

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| Ollama connection failed | `ollama serve` |
| Port 3000 foglalt | `npm run dev:alt` (:3001) |
| Python import hiba | `cd myai && uv sync` |
| Build hiba | `rmdir /s /q build && npm run build` |

## Cloudflare Infrastruktúra

| Erőforrás | Név | Típus |
|-----------|-----|-------|
| D1 Database | `bas-metadata` | Metadata tároló |
| R2 Bucket | `vodor1` | Fájl tároló |
| KV Namespace | `BAS_TASKS` | Task queue |
| Worker | `bas-cloudflare-orchestrator` | Edge orchestrátor |

## Környezeti Változók (.env)

```env
OLLAMA_BASE_URL=http://localhost:11434
LANGCHAIN_API_KEY=...              # LangSmith tracing (opcionális)
ANYTHINGLLM_API_KEY=...
BRUNELLA_WORKSPACE_ROOT=.
CLOUDFLARE_API_TOKEN=...           # Cloudflare (opcionális)
CLOUDFLARE_ACCOUNT_ID=...
```

## Megjegyzés

A projekt tulajdonosa kreatív, nem programozó. A fejlesztés AI ügynökökkel történik. Ha ellentmondást találsz, kérdezz rá.
