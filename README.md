# Brunella Agent System (BAS)

**Verzió:** 2.3.0 | **Utolsó frissítés:** 2026-02-06

AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

---

# ⚠️ AI ÜGYNÖKÖK - OLVASD EL ELŐSZÖR! (KÖTELEZŐ BOOTSTRAP PROTOKOLL)

**Ha AI ügynökként dolgozol (Claude, Gemini, Cursor, Copilot, stb.), ez a szekció KÖTELEZŐ!**

## 🚀 INDULÁS PROTOKOLL (Kötelező sorrend - 3 lépés)

### 1. GitHub Szinkronizálás (MINDIG ELŐSZÖR!)
```bash
# 🔴 KÖTELEZŐ minden munkamenet elején!
scripts\sync.bat              # Windows CMD
# VAGY
.\scripts\sync.ps1            # PowerShell
# VAGY
bash scripts/sync.sh          # Git Bash / WSL

# Opciók:
scripts\sync.bat --build      # Sync + build check
scripts\sync.bat --build --test  # Sync + build + test (teljes ellenőrzés)
```

**Mit csinál a sync script:**
- ✅ Fetch + Pull GitHub változásokat (Jules work!)
- ✅ Auto-stash uncommitted changes
- ✅ Jules PR-ek listázása
- ✅ Conflict detection
- ✅ Build/Test check (opcionális)

**Részletek:** [scripts/SYNC_README.md](scripts/SYNC_README.md)

### 2. Dokumentáció Beolvasás
```
✅ KÖTELEZŐ:
1. README.md (ez a fájl) - TELJES TARTALOM!
2. .ai/FOSZAL.md - Mi történt legutóbb? (Egyesített napló)
3. .ai/<te_neved>.md - Van félbehagyott feladatod?

❌ NEM KÖTELEZŐ (csak ha konkrét track-en dolgozol):
- conductor/tracks.md - Aktív track-ek
- conductor/workflow.md - Részletes workflow
```

### 3. Rendszer Validáció (Munka ELŐTT)
```bash
# Ha nem futtattad a sync --build -ot:
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)
npm test                      # Vitest tesztek (MUSZÁJ PASS!)
```

**Ha bármelyik FAIL** → **NE kezdj fejlesztésbe!** Javítsd először!

### 3. Dokumentálás (Munka UTÁN)
```bash
# 1. Frissítsd a saját naplódat
# Szerkeszd: .ai/<te_neved>.md (formátum alább)

# 2. Szinkronizáld a FŐSZÁLAT
python scripts/sync_foszal.py

# 3. Commit (ha működő állapot)
git add -A
git commit -m "Leírás"
```

---

## 📝 .ai/ Mappa Használat (KRITIKUS!)

### Struktúra
```
.ai/
├── FOSZAL.md           # 🔴 EGYESÍTETT NAPLÓ (auto-generált, olvasd KÖTELEZŐEN!)
├── claude.md           # Claude Code napló (TE frissíted!)
├── gemini.md           # Gemini CLI napló
├── cursor.md           # Cursor AI napló
└── copilot.md          # GitHub Copilot napló
```

### FOSZAL.md - Egyesített Napló
- **Mit tartalmaz:** Összes ügynök munkája időrendben
- **Generálás:** `python scripts/sync_foszal.py` (automatikus)
- **MIÉRT FONTOS:** Tudod mi történt mióta utoljára dolgoztál

### Saját Napló Formátum (.ai/<te_neved>.md)

**MINDEN munkamenet végén add hozzá:**

```markdown
### YYYY-MM-DD HH:MM - [Rövid cím]

**Feladat:** Mit csináltál (1-2 mondat)
**Érintett fájlok:** fájl1.ts, fájl2.py, fájl3.md
**Státusz:** ✅ Befejezve / ⏳ Folyamatban / ❌ Sikertelen
**Megjegyzés:** Fontos info a következő ügynöknek (félbehagyott feladat, blocker, stb.)
```

**Példa:**
```markdown
### 2026-02-06 14:30 - Dashboard Theme Fix

**Feladat:** Sötét téma beállítások javítása, theme-provider.tsx runtime error fix
**Érintett fájlok:** src/dashboard/components/theme-provider.tsx, src/dashboard/components/ui/theme-provider.tsx
**Státusz:** ✅ Befejezve
**Megjegyzés:** Dashboard most működik, tesztek PASS (58/58)
```

---

## 🏗️ Projekt Architektúra (Gyors Áttekintés)

### Dual-Mode MCP Szerver
`src/index.ts` két párhuzamos kommunikációs csatornát indít:

1. **MCP stdio** (StdioServerTransport) - Claude Desktop / MCP kliens
2. **Express webszerver** (:3000) - REST API + Socket.IO + Dashboard

### Ügynök Hierarchia
```
OrchestratorAgent (Planner & Dispatcher)
  ├── DeveloperAgent        - Kód írás, Python végrehajtás
  ├── EvaluatorAgent        - Audit, testing, code review
  ├── ResearcherAgent       - Web search, RAG keresés
  ├── DataScientistAgent    - Adat tisztítás, LanceDB
  ├── EdgeProxyAgent        - Cloudflare Workers proxy
  ├── ProjectConductor      - Docs sync, track management
  └── VoiceAgent            - Hangfelismerés (Whisper)
```

### Data Flywheel (5 lépéses ciklus)
```
1. Harvest (browser_worker.py)    → Webes adatgyűjtés
2. Refine (refiner_logic.py)      → Adat tisztítás
3. Index (LanceDB)                → Vektoros indexelés
4. Learn (RAG Query)              → Releváns dokumentumok keresése
5. Execute (OrchestratorAgent)    → Feladat végrehajtás
   └─► Feedback loop: újra Harvest-be
```

### Phoenix Protocol (Öngyógyító Mechanika)
```
Hiba detektálva → Checkpointing (SQLite task queue)
                → Auto-Reset (max 3 kísérlet)
                → Git Recovery (sync_foszal.py + commit)
```

### Track Rendszer (Fejlesztési Szálak)
```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```
Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában.
**Jelenleg:** 9 aktív track, 4 lezárt, 25 archivált.

---

## 📁 Könyvtárstruktúra (Kritikus Fájlok)

```
mcp-brunella-core/
├── .ai/                      # 🔴 AI ügynök koordináció (OLVASD!)
│   ├── FOSZAL.md            # Egyesített napló (KÖTELEZŐ olvasni!)
│   └── <ügynök>.md          # Saját naplód (KÖTELEZŐ frissíteni!)
│
├── src/                      # 💻 TypeScript forráskód
│   ├── agents/              # AI ügynökök (NE TÖRÖLD!)
│   │   ├── types.ts         # IAgent interfész
│   │   ├── BaseAgent.ts     # Absztrakt ősosztály
│   │   ├── registry.json    # Ügynök regisztráció
│   │   └── *.ts             # Ügynök implementációk
│   ├── tools/               # MCP eszközök
│   ├── server/              # Express + Socket.IO
│   │   ├── web.ts           # Web szerver
│   │   └── registry.ts      # MCP tool regisztráció
│   ├── dashboard/           # React UI (Vite, Tailwind v4)
│   ├── core/
│   │   └── llm_client.ts    # Ollama/Gemini LLM hívások
│   ├── utils/
│   │   ├── logger.ts        # Naplózás (használd console.log helyett!)
│   │   └── pythonShell.ts   # Python alrendszer kommunikáció
│   ├── cli.ts               # CLI belépési pont
│   └── index.ts             # Fő belépési pont (MCP server)
│
├── myai/                     # 🐍 Python alrendszer
│   ├── server.py            # FastAPI szerver (:8000)
│   ├── browser_worker.py    # Playwright automatizálás (Robotkéz)
│   └── refiner_logic.py     # Adat tisztítás + LanceDB
│
├── conductor/                # 📋 Projekt menedzsment
│   ├── tracks.md            # Aktív track-ek (opcionális olvasás)
│   └── workflow.md          # Részletes workflow (opcionális)
│
├── .env                      # 🔐 TITKOS - NE commitold!
├── package.json             # 📦 NE TÖRÖLD!
└── README.md                # 📖 Ez a fájl (MASTER DOCUMENT)
```

### VÉDETT FÁJLOK - SOHA NE TÖRÖLD!

| Fájl | Miért kritikus |
|------|----------------|
| `.env` | API kulcsok, titkos konfigurációk |
| `package.json` | Projekt definíció, függőségek |
| `src/agents/*.ts` | Core ügynökök implementációi |
| `src/agents/types.ts` | IAgent interfész definíció |
| `src/agents/registry.json` | Ügynök regisztráció |
| `src/server/web.ts` | Web szerver |
| `src/server/registry.ts` | MCP tool regisztráció |
| `src/cli.ts` | CLI belépési pont |
| `src/core/llm_client.ts` | LLM kommunikáció |
| `src/index.ts` | Fő belépési pont |

**Ha "takarítani" akarsz vagy "tisztítani" a projektet - KÉRDEZZ ELŐSZÖR!**

---

## 🔧 Build & Fejlesztés

### Indítás
```bash
# Teljes rendszer indítás (ajánlott - Windows)
start-full.bat

# VAGY manuálisan:
npm install && npm run build
npm run dev          # Backend (:3000)
npm run dev:ui       # Dashboard (:5173)

# Python alrendszer (FastAPI :8000)
cd myai
uv sync              # Függőségek telepítése
uvicorn server:app --reload --port 8000
```

### Build & Teszt (KÖTELEZŐ munka előtt/után!)
```bash
# Build
npm run build        # TypeScript → build/ (MUSZÁJ sikerülnie!)

# Tesztek
npm test             # Build + Vitest run (MUSZÁJ PASS!)
npm run test:watch   # Watch mód (fejlesztés közben)
npx vitest run test/foo.test.ts  # Egy specifikus teszt

# Gyors health check
npm run smoke        # Ollama, Express, FastAPI ellenőrzés
```

### CLI Parancsok
```bash
brunella chat                 # Interaktív chat (VIP menü)
brunella agents               # Ügynökök listázása
brunella tools                # MCP eszközök listázása
brunella run <tool>           # MCP tool futtatás

# Conductor (projekt menedzsment)
brunella conductor status     # Projekt státusz
brunella conductor sync       # Dokumentáció szinkron
brunella conductor health     # Track-ek health check
```

### Chat Parancsok (interaktív módban)
```
/edge on|off         # Cloudflare Edge mód be/ki
/switch ollama       # Váltás Ollama-ra
/switch gemini       # Váltás Gemini-re
/switch claude       # Váltás Claude-ra
/model <név>         # Ollama modell váltás
/save                # Utolsó kód mentése
/run                 # Utolsó kód futtatása
/exit                # Kilépés
```

---

## 🧪 Tesztelés (KÖTELEZŐ Munkafolyamat Része!)

### 0-Hiba Stratégia
```bash
# 1. Build MUSZÁJ sikeresnek lennie
npm run build
# Ha FAIL → Javítsd a TypeScript hibákat!

# 2. Tesztek MUSZÁJANAK átmennie
npm test
# Ha FAIL → Javítsd a failing teszteket! (NE töröld a tesztet!)

# 3. Csak akkor commitolj ha mindkettő OK
git add -A && git commit -m "Fix: description"
```

### Teszt Parancsok
```bash
npm test                      # Build + összes teszt
npm run test:watch            # Watch mód (fejlesztés közben)
npx vitest run test/foo.test.ts  # Egy teszt fájl
npm run test:coverage         # Lefedettségi jelentés

# Python tesztek
cd myai
pytest tests/
```

### Mit Ellenőrizz Munka Előtt
- [ ] `npm run build` - TypeScript fordítás OK
- [ ] `npm test` - Tesztek PASS
- [ ] `git status` - Nincs váratlan változás

### Mit Ellenőrizz Munka Után
- [ ] `npm run build` - Még mindig OK
- [ ] `npm test` - Még mindig PASS
- [ ] `.ai/<te_neved>.md` - Napló frissítve
- [ ] `python scripts/sync_foszal.py` - FOSZAL szinkronizálva

---

## 📖 Kód Konvenciók (FONTOS!)

### ESM + .js Kiterjesztés
A projekt `"type": "module"`. **Minden import `.js` kiterjesztéssel:**
```typescript
import { foo } from './bar.js';  // ✅ HELYES
import { foo } from './bar';     // ❌ HELYTELEN (build fail!)
```

### Naplózás (Console.log TILOS!)
**Használd a `logger.ts` függvényeket:**
```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
logInfo('AgentName', 'message');
setAgentStatus('AgentName', 'working', 'task desc');

// Szerver kódban:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

**NE használj `console.log()` production kódban!**

### Agent Implementációs Minták

#### 1. Egyszerű Agent (IAgent interfész)
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
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ!
    }
  }
}
```

**try/finally KÖTELEZŐ:** Garantálja hogy az ügynök státusza mindig `idle`-ba tér vissza!

#### 2. Komplex Agent (BaseAgent leszármazott)
```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MyComplexAgent extends BaseAgent {
  name = "MyComplex";
  description = "Komplex ügynök";
  role = "Szerep";
  capabilities = ["skill1"];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // BaseAgent automatikusan kezeli a status frissítést
    return { success: true, message: "OK", data: result };
  }
}
```

**BaseAgent Bridge Pattern:**
- `execute(task, context)` → IAgent interfész (külső API)
- `executeTask(context)` → Belső implementáció
- Automatikus status management, logging, error recovery

### MCP Tool Minta

**Tool definiálás (`src/tools/myTool.ts`):**
```typescript
export const myToolDefinition = {
  name: "my_tool",
  description: "Tool purpose",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "Parameter leírás" }
    },
    required: ["param"]
  }
};

export async function myToolHandler(params: { param: string }) {
  try {
    if (!params.param) {
      return { success: false, error: "param cannot be empty" };
    }
    const result = await doSomething(params.param);
    return { success: true, data: result };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError("myTool", error);
    return { success: false, error };
  }
}
```

**Tool regisztráció (`src/server/registry.ts`):**
```typescript
import { myToolDefinition, myToolHandler } from '../tools/myTool.js';

export function registerAllTools(server: MCPServer) {
  server.registerTool(
    myToolDefinition,
    async (params: unknown) => myToolHandler(params as { param: string })
  );
}
```

### Típusok
- **Kerüld az `any` típust** → használj `unknown` vagy konkrét típust
- TypeScript strict mode aktív (`tsconfig.json`)
- Agent válaszok az `AgentResponse` interfészt követik

---

## 🔄 Fejlesztési Workflow (Kivonat)

### Data Flywheel (5 lépés)
1. **Harvest** (`myai/browser_worker.py`) - Webes adatgyűjtés Playwright-tel
2. **Refine** (`myai/refiner_logic.py`) - Adat tisztítás, validáció
3. **Index** (LanceDB) - Vektoros indexelés (opcionális: lancedb, pyarrow)
4. **Learn** (RAG Query) - Releváns dokumentumok keresése
5. **Execute** (OrchestratorAgent) - Feladat végrehajtás → Feedback loop

### Track Rendszer (Életciklus)
```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```
- **PROPOSED:** Ötlet fázis
- **ACTIVE:** Fejlesztés folyamatban
- **TESTING:** QA/Review
- **COMPLETED:** Merge megtörtént
- **ARCHIVED:** 30+ nap inaktivitás → automatikus archiválás

**Track-en dolgozol?** Olvasd be: `conductor/tracks.md` + `conductor/tracks/<track_név>/plan.md`

### Phoenix Protocol (Öngyógyítás)
**Hiba esetén:**
1. **Checkpointing** - SQLite task queue: `executing` → `failed`
2. **Auto-Reset** - AgentManager retry: 1s → 3s → 10s (max 3 kísérlet)
3. **Git Recovery** - `sync_foszal.py` + commit

---

## 🌐 Környezeti Változók (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**OPCIONÁLIS (de ajánlott):**
```env
LANGCHAIN_API_KEY=...              # LangSmith tracing
ANYTHINGLLM_API_KEY=...
GEMINI_API_KEY=...                 # Google Gemini
GOOGLE_API_KEY=...                 # Google APIs
CLOUDFLARE_API_TOKEN=...           # Edge deploy
CLOUDFLARE_ACCOUNT_ID=...
N8N_HOST=...                       # n8n automatizálás
N8N_API_KEY=...
```

**SOHA NE COMMITOLD** a `.env` fájlt git-be!

---

## 🚨 Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| **Ollama connection failed** | Indítsd el: `ollama serve` vagy ellenőrizd port 11434 |
| **Port 3000 foglalt** | `npm run dev:alt` (port 3001) vagy zárd be a másik process-t |
| **Python import hiba** | `cd myai && uv sync` vagy `.venv` újraépítés |
| **Build hiba** | `rmdir /s /q build && npm run build` |
| **Teszt fail** | **JAVÍTSD a tesztet**, ne töröld! Ellenőrizd: `npm run smoke` |
| **Hiányzó fájl (git)** | `git checkout HEAD -- <fájl>` |
| **uv sync lock hiba** | `.venv` törlése: `Remove-Item -Recurse -Force .venv && uv venv && uv sync` |
| **Dashboard fehér képernyő** | Ellenőrizd a konzolt, gyakran import hiba vagy props error |
| **FastAPI nem indul** | Ellenőrizd: `cd myai && uvicorn server:app --reload --port 8000` |
| **LanceDB ImportError** | Opcionális függőség: `cd myai && uv pip install lancedb pyarrow` |

### Gyakori Hibák
1. **Import `.js` kiterjesztés nélkül** → Build fail
2. **`console.log()` használata** → Használj `logger.ts`-t!
3. **Agent `finally` hiányzik** → Status nem tér vissza `idle`-ba
4. **`.env` commitolva** → Git revert + `.gitignore` ellenőrzés

---

## 📚 API Végpontok

| Végpont | Leírás |
|---------|--------|
| `GET /api/health` | Rendszer állapot (Ollama, FastAPI, stb.) |
| `GET /api/agents` | Ügynökök listája |
| `POST /api/agents/:name/execute` | Ügynök futtatás |
| `GET /api/tools` | MCP eszközök listája |
| `POST /api/ollama/generate` | LLM generálás (LangSmith traced) |
| `GET /api-docs` | Swagger UI (API dokumentáció) |
| `GET /files/list` | Fájl lista (Dashboard File Explorer) |
| `GET /files/content` | Fájl tartalom olvasás |

---

## ☁️ Cloudflare Edge Integration

```
bas-cloudflare-orchestrator/    # Edge Worker projekt
├── src/index.ts                # Worker entry point
├── wrangler.toml               # Cloudflare konfig
└── README.md                   # Deploy útmutató

# Erőforrások
D1 Database:  bas-metadata      # Metadata tároló
R2 Bucket:    vodor1            # Fájl tároló
KV Namespace: BAS_TASKS         # Task queue
```

**Deploy:**
```bash
cd bas-cloudflare-orchestrator
npx wrangler deploy
```

---

## 📊 Dashboard V2 Funkciók

| Funkció | Leírás | Gyorsbillentyű |
|---------|--------|----------------|
| **AgentGraph** | Ügynök kapcsolatok vizualizáció (React Flow) | - |
| **CommandMenu** | Globális parancs paletta | `Ctrl+K` |
| **ThemeToggle** | Sötét/Világos téma váltás | - |
| **FileExplorer** | Projekt fájl böngésző | - |
| **NeuralLinkChat** | Beágyazott chat interfész | - |
| **ServiceControl** | Szolgáltatások indítás/leállítás | - |

---

## 🎯 Aktív Ügynökök

| Ügynök | Szerep | Státusz |
|--------|--------|---------|
| **Orchestrator** | Központi koordinátor, feladat delegálás | Active |
| **Developer** | Kód generálás, self-healing pipeline | Active |
| **Evaluator** | Rendszer audit, tesztelés, health check | Active |
| **Researcher** | RAG keresés, tudásbázis, összefoglalás | Active |
| **DataScientist** | Adat elemzés, Python végrehajtás, LanceDB | Active |
| **ProjectConductor** | Projekt struktúra, docs sync (Chief-of-Staff) | Active |
| **EdgeProxy** | Cloudflare Workers proxy | Active |
| **VoiceAgent** | Hangfelismerés (Whisper) | Active |
| **LintFixer** | Automatikus lint javítás (mikro-ügynök) | Active |

---

## 🔗 További Dokumentáció (Opcionális Olvasás)

| Fájl | Mikor olvasd |
|------|-------------|
| `conductor/tracks.md` | Ha konkrét track-en dolgozol |
| `conductor/workflow.md` | Ha mélyebben érdekel a Data Flywheel/Phoenix Protocol |
| `conductor/tracks/<id>/plan.md` | Ha track-specifikus detailsre van szükséged |
| `CLAUDE.md` | **ELAVULT** - Ez a README.md az aktuális! |
| `GEMINI.md` | **ELAVULT** - Ez a README.md az aktuális! |

---

## 📋 Changelog

### v2.3.0 (2026-02-06)
- **BREAKING:** README.md most a központi master dokumentum
- **DEPRECATED:** CLAUDE.md, GEMINI.md lecserélve redirect-re
- **NEW:** .ai/ mappa használat részletesen dokumentálva
- **NEW:** Bootstrap protokoll kötelező lépésekkel
- **NEW:** 0-Hiba stratégia tesztelési protokoll

### v2.2.0 (2026-02-05)
- Dashboard V2 funkciók
- Cloudflare Edge Integration
- ProjectConductor 2.0 Chief-of-Staff
- VoiceAgent (Whisper)

### v2.1.0 (2026-02-04)
- Multi-agent koordinációs rendszer
- FOSZAL.md egyesített napló
- Track nagytakarítás (28→9 aktív)

---

*Projekt tulajdonos: Pohánka Péter*
*Ha kérdésed van, kérdezz - ne találgass!*

# Brunella Agent System (BAS)

**Verzió:** 2.4.0 | **Utolsó frissítés:** 2026-02-08
AI multi-agent rendszer szoftverfejlesztés automatizálására, optimalizálva a Gemini CLI készségeire.

---

# ⚠️ AI ÜGYNÖKÖK - KÖTELEZŐ BOOTSTRAP PROTOKOLL

**Ha Gemini CLI-vel vagy más AI ügynökként dolgozol, ez a protokoll a "törvény"!**

## 🚀 MUNKA INDÍTÁSA (Szigorú sorrend)

1.  **GitHub Szinkron:** Futtasd: `scripts\sync.bat`
2.  **Kontextus Beolvasás:** - `README.md` (ez a fájl)
    - `.ai/FOSZAL.md` (időrendi események)
    - `.ai/gemini.md` (saját korábbi munkád)
3.  **Rendszerellenőrzés:** `npm run build` ÉS `npm test`. Ha hiba van, a javítás az első feladat!

---

## 🛠️ GEMINI CLI KÉPESSÉGEK (Skill Usage)

A hatékony és autonóm fejlesztéshez használd az alábbi `/` parancsokat és skilleket:

### 📋 Tervezés és Végrehajtás
- `/plan` (vagy `writing-plans`): Használd MINDEN összetettebb feladat előtt. Készíts részletes tervet.
- `/implement` (vagy `subagent-driven-development`): Autonóm végrehajtás részfeladatokra bontva.
- `/executing-plans`: A már jóváhagyott terv pontról pontra történő megvalósítása.
- `/brainstorm`: Használd új funkciók tervezésénél vagy kreatív elakadásoknál.

### 🧪 Minőség és Tesztelés
- `/tdd` (vagy `test-driven-development`): Előbb a teszt, aztán a kód! Kötelező minden funkcióhoz.
- `/debug` (vagy `systematic-debugging`): Teszthiba vagy váratlan viselkedés esetén kötelező használni.
- `/verification-before-completion`: Használd, mielőtt azt állítanád, hogy kész vagy! Lefuttatja az ellenőrzéseket.
- `gemini:zero-script-qa`: Log-alapú verifikáció, ha nincs írott teszt szkript.

### 🏛️ Architektúra és Council
- `/council:ask`: Konzultálj a multi-model tanáccsal kritikus döntéseknél.
- `/architecture:system-design`: Rendszerszintű tervezési minták alkalmazása.
- `/data:schema`: Adatstruktúrák és adatbázis sémák tervezése.

---

## 🔄 BKIT PIPELINE & PDCA

A projekt a **bkit** módszertant követi. Tartsd be a fázisokat:

- `gemini:pipeline-status`: Ellenőrizd, melyik fázisban van a projekt (Phase 1-9).
- `gemini:pipeline-next`: Lépj a következő fejlesztési szakaszba.
- `gemini:pdca-status`: Ellenőrizd a Plan-Design-Check-Act ciklus állását.

---

## 📝 DOKUMENTÁCIÓS KÖTELEZETTSÉG (Munka UTÁN)

Minden munkamenet végén kötelező az alábbi sorrend:

1.  **Build & Test:** Ellenőrizd, hogy nem tört el semmi.
2.  **Saját Napló:** Frissítsd a `.ai/gemini.md` fájlt:
    ```markdown
    ### YYYY-MM-DD HH:MM - [Rövid cím]
    **Feladat:** [Mit csináltál]
    **Képességek:** [/plan, /tdd, /debug, stb.]
    **Státusz:** ✅ Befejezve / ⏳ Folyamatban
    **Megjegyzés:** [Blockerek, vagy mi maradt hátra]
    ```
3.  **Főnapló Szinkron:** `python scripts/sync_foszal.py`
4.  **Git Commit:** `git add -A && git commit -m "feat/fix: rövid leírás"`

---

## 📖 KÓD KONVENCIÓK (KRITIKUS!)

- **ESM + .js:** Kötelező a `.js` kiterjesztés az importoknál! (`import { x } from './y.js'`)
- **Logger:** `console.log` TILOS! Használd: `import { logInfo } from '../utils/logger.js'`
- **Clean Code:** TypeScript strict mode bekapcsolva. Kerüld az `any` használatát.

---
*Generated by Gemini CLI - Intelligent Autonomy enabled.*