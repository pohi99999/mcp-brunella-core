# CLAUDE.md

Ez a fájl útmutatást nyújt a Claude Code-nak (claude.ai/code) a repóban történő munkavégzéshez.

## Projekt Áttekintés

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

**Technológiák:** TypeScript (ESM), Express, Socket.IO, React (Dashboard), Ollama, Gemini, Python (FastAPI), LanceDB, SQLite

## Gyors Indítás

```bash
# Teljes rendszer indítás (Windows)
start.bat

# VAGY lépésenként:
npm install && npm run build      # Függőségek + build
npm run dev                        # Backend (port 3000)
npm run dev:ui                     # Dashboard (port 5173)

# Python alrendszer (FastAPI :8000)
cd myai
uv sync                            # Függőségek
uvicorn server:app --reload --port 8000
```

## Parancsok

```bash
# Build & Run
npm run build        # TypeScript fordítás
npm run dev          # Dev server (tsx watch, port 3000)
npm run dev:ui       # Vite Dashboard (port 5173)

# Tesztelés
npm test             # Build + Vitest run (KÖTELEZŐ munka előtt/után!)
npm run test:watch   # Watch mód
npx vitest run test/foo.test.ts   # Egy teszt fájl

# CLI
brunella chat                 # Interaktív chat
brunella agents               # Ügynökök listázása
brunella conductor status     # Projekt státusz
brunella run <tool>           # MCP tool futtatás
```

## Architektúra (Gyors Áttekintés)

### Fő Komponensek

```
src/
├── agents/          # AI ügynökök (IAgent interfész implementációk)
│   ├── types.ts     # IAgent, AgentResponse interfaces
│   ├── BaseAgent.ts # Absztrakt ősosztály
│   └── *.ts         # Ügynök implementációk (30+ agent)
├── tools/           # MCP tool definíciók & handlerek
├── server/          # Express + Socket.IO backend
│   ├── web.ts       # Fő webszerver
│   └── registry.ts  # MCP tool & agent regisztrációk
├── dashboard/       # React UI (Vite, Tailwind v4, Radix UI)
├── core/
│   └── llm_client.ts # Ollama/Gemini/GitHub Models integráció
├── utils/
│   ├── logger.ts    # HASZNÁLD console.log helyett!
│   └── pythonShell.ts # Python alrendszer kommunikáció
├── cli.ts           # CLI belépési pont
└── index.ts         # MCP server (StdioServerTransport)

myai/                # Python alrendszer
├── server.py        # FastAPI szerver (:8000)
├── browser_worker.py # Playwright automatizálás
└── refiner_logic.py  # Adat tisztítás + LanceDB

conductor/           # Projekt menedzsment
├── tracks.md        # Aktív track-ek
└── workflow.md      # Data Flywheel, Phoenix Protocol
```

### Ügynök Hierarchia

```
OrchestratorAgent (Központi koordinátor)
  ├── DeveloperAgent        - Kód írás, Python végrehajtás
  ├── EvaluatorAgent        - Audit, testing, code review
  ├── ResearcherAgent       - Web search, RAG keresés
  ├── DataScientistAgent    - Adat elemzés, LanceDB
  ├── EdgeProxyAgent        - Cloudflare Workers proxy
  ├── ProjectConductor      - Docs sync, track management
  ├── TaskDecomposerAgent   - Komplex feladat dekompozíció
  └── VoiceAgent            - Hangfelismerés (Whisper)
```

## Kód Konvenciók (KRITIKUS!)

### 1. ESM + .js Kiterjesztés (KÖTELEZŐ!)

A projekt `"type": "module"`. **Minden import `.js` kiterjesztéssel kell legyen:**

```typescript
// ✅ HELYES
import { foo } from './bar.js';

// ❌ HELYTELEN (build fail!)
import { foo } from './bar';
```

### 2. Logging (console.log TILOS!)

**MINDIG használd a `logger.ts` függvényeket:**

```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

logInfo('AgentName', 'message');
setAgentStatus('AgentName', 'working', 'task description');

// Szerver kódban:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

**NE használj `console.log()` production kódban!**

### 3. Agent Implementációs Minta

```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent';
  role = 'Agent célja';
  description = 'Mit csinál';
  capabilities = ['skill1', 'skill2'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // Implementáció
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ!
    }
  }
}
```

**try/finally KÖTELEZŐ:** Garantálja hogy az ügynök státusza mindig `idle`-ba tér vissza!

### 4. MCP Tool Minta

```typescript
// Tool definíció (src/tools/myTool.ts)
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Tool célja',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Paraméter leírás' }
    },
    required: ['param']
  }
};

export async function myToolHandler(params: { param: string }) {
  try {
    if (!params.param) {
      return { success: false, error: 'param cannot be empty' };
    }
    const result = await doSomething(params.param);
    return { success: true, data: result };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('myTool', error);
    return { success: false, error };
  }
}

// Regisztráció (src/server/registry.ts)
import { myToolDefinition, myToolHandler } from '../tools/myTool.js';

server.registerTool(myToolDefinition, async (params: unknown) =>
  myToolHandler(params as { param: string })
);
```

## Fejlesztési Workflow

### 1. Track Rendszer (KÖTELEZŐ nagyobb munkához!)

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában.

**Track-en dolgozol?** Olvasd be:
- `conductor/tracks.md` (aktív track-ek)
- `conductor/tracks/<track_név>/plan.md` (részletes terv)

### 2. Testing (0-Hiba Stratégia)

**KÖTELEZŐ minden munka előtt/után:**

```bash
npm run build        # TypeScript fordítás (MUSZÁJ OK!)
npm test             # Vitest tesztek (MUSZÁJ PASS!)
```

**Ha bármelyik FAIL** → **NE kezdj fejlesztésbe!** Javítsd először!

### 3. Típusok

- **Kerüld az `any` típust** → használj `unknown` vagy konkrét típust
- TypeScript strict mode aktív (`tsconfig.json`)
- Agent válaszok az `AgentResponse` interfészt követik

## Gyakori Feladatok

### Új Agent Létrehozása

1. **Létrehozás:** `src/agents/MyNewAgent.ts`
2. **Implementáció:** Lásd "Agent Implementációs Minta" fent
3. **Regisztráció:** `src/agents/registry.json` - add hozzá az agent-et
4. **Teszt:** `test/myNewAgent.test.ts` - írj teszteket
5. **Build & Test:** `npm run build && npm test` - ellenőrizd hogy minden zöld

### Új MCP Tool Létrehozása

1. **Létrehozás:** `src/tools/myTool.ts`
2. **Implementáció:** Lásd "MCP Tool Minta" fent
3. **Regisztráció:** `src/server/registry.ts` - `registerAllTools()` függvényben
4. **Teszt:** `test/myTool.test.ts` - írj teszteket
5. **Build & Test:** Ellenőrizd hogy minden zöld

### Dashboard Komponens Hozzáadása

1. **Komponens:** `src/dashboard/components/dashboard/MyComponent.tsx`
2. **Radix UI + Tailwind v4** használat
3. **API integráció:** `src/dashboard/lib/apiService.ts` - API client methods
4. **Backend endpoint:** `src/server/routes/` - REST API route
5. **Layout integráció:** `src/dashboard/components/dashboard/MissionControlLayout.tsx`

## Environment Variables (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**OPCIONÁLIS (de ajánlott):**
```env
GEMINI_API_KEY=...              # Google Gemini
GITHUB_PAT=...                  # GitHub Models (GPT-4o)
LANGCHAIN_API_KEY=...           # LangSmith tracing
CLOUDFLARE_API_TOKEN=...        # Edge deploy
```

**SOHA NE COMMITOLD** a `.env` fájlt git-be!

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| "Ollama connection failed" | `ollama serve` futtatása vagy port 11434 ellenőrzése |
| Port 3000 foglalt | `npm run dev:alt` (port 3001) |
| Python import hiba | `cd myai && uv sync` |
| Build hiba | `rmdir /s /q build && npm run build` |
| Teszt fail | **JAVÍTSD a tesztet**, ne töröld! |
| `.js` import hiba | Add hozzá `.js` kiterjesztést minden relatív import-hoz |

## API Végpontok

| Végpont | Leírás |
|---------|--------|
| `GET /api/health` | Rendszer állapot |
| `GET /api/agents` | Ügynökök listája |
| `POST /api/agents/:name/execute` | Ügynök futtatás |
| `GET /api/tools` | MCP eszközök |
| `POST /api/ollama/generate` | LLM generálás |
| `GET /api-docs` | Swagger UI |

## Fontos Szabályok

1. **Track Required** - Nagyobb fejlesztéshez track kell (`conductor/tracks/`)
2. **Fix Bugs** - Fejlesztés közben talált hibák azonnal javítandók
3. **Commit Often** - Minden nagyobb lépés után commit
4. **All Tests Green** - Build ✅ + Test ✅ kötelező minden commit előtt
5. **ESM + .js** - Minden import `.js` kiterjesztéssel
6. **Logger használat** - console.log helyett `logger.ts`
7. **try/finally** - Ügynökökben kötelező (status reset garantálása)

## Anti-Patterns (Kerülendők!)

- ❌ `any` típus használata indoklás nélkül
- ❌ CommonJS `require()` (ez ESM projekt!)
- ❌ `console.log()` production kódban
- ❌ Import `.js` kiterjesztés nélkül
- ❌ Agent-ben hiányzó `finally` blokk (status nem reset-elődik)
- ❌ `.env` fájl git commit-olása

## További Dokumentáció

- **README.md** - Teljes projekt dokumentáció (központi master document)
- **.ai/FOSZAL.md** - Mi történt legutóbb? (egyesített napló)
- **conductor/tracks.md** - Aktív track-ek
- **conductor/workflow.md** - Data Flywheel & Phoenix Protocol
- **docs/** - Részletes útmutatók (Agent Permissions, MCP Tools, stb.)

---

**💡 Pro Tipp:** Ha bizonytalan vagy, MINDIG olvasd el a README.md-t először! Ez a CLAUDE.md csak gyors referencia, a README.md a teljes dokumentáció.

**Projekt tulajdonos:** Pohánka Péter
**Ha kérdésed van, kérdezz - ne találgass!**
