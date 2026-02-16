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

**Monitoring docs:** [docs/MONITORING_PROMETHEUS.md](docs/MONITORING_PROMETHEUS.md)

### 2. KRITIKUS Fájlok Beolvasása (KÖTELEZŐ MINDEN INDÍTÁSKOR!)

**🔴 MINDIG olvasd be ezeket a fájlokat munkamenet kezdéskor:**

```
✅ KÖTELEZŐ KONFIGURÁCIÓK:
1. package.json - Függőségek, scriptek, verzió
2. tsconfig.json - TypeScript konfiguráció
3. src/agents/registry.json - Ügynök regisztráció

✅ KÖTELEZŐ PROJEKT ÁLLAPOT:
4. PROJEKT_DIAGRAM.md - Rendszer architektúra (KÖTELEZŐ!)
5. conductor/tracks.md - Aktív track-ek (mi van folyamatban?)
6. .ai/FOSZAL.md - Mi történt legutóbb? (Egyesített napló)
7. TEST_RESULTS.md - Legutóbbi teszt eredmények (KÖTELEZŐ!)

✅ KÖTELEZŐ HIBAKEZELÉS:
8. logs/ könyvtár - Legfrissebb log fájlok
   - logs/phoenix.log - Phoenix Protocol hibák és állapotok
   - logs/agent_*.log - Ügynök specifikus logok
   - logs/developer.log - Legutóbbi fejlesztési események

✅ OPCIONÁLIS (csak ha track-en dolgozol):
- .ai/<te_neved>.md - Van félbehagyott feladatod?
- conductor/tracks/<track_id>/plan.md - Track részletes terv
- conductor/workflow.md - Részletes workflow
```

**⚠️ FIGYELEM:** Ha ezek bármelyikét NEM olvasod be, hibás döntéseket hozhatsz!

### 3. Rendszer Validáció & Teszt Protokoll (Munka ELŐTT - KÖTELEZŐ!)

```bash
# STEP 1: Build check
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)

# STEP 2: Test check
npm test                      # Vitest tesztek (MUSZÁJ PASS!)

# STEP 3: Teszt eredmények dokumentálása
# Ha új tesztet írtál vagy teszteket futtattál:
echo "## Teszt Futás - $(date +%Y-%m-%d_%H-%M)" >> TEST_RESULTS.md
npm test 2>&1 | tee -a TEST_RESULTS.md

# STEP 4: Phoenix Protocol Állapot Ellenőrzés
# Ellenőrizd a legfrissebb Phoenix logokat:
tail -n 50 logs/phoenix.log   # Windows: type logs\phoenix.log | more
```

**⚠️ 0-HIBA STRATÉGIA:**
- **Ha BUILD FAIL** → NE kezdj fejlesztésbe! Javítsd először!
- **Ha TESZT FAIL** → Dokumentáld TEST_RESULTS.md-ben, majd javítsd!
- **Ha Phoenix hibát ír** → Olvasd el logs/phoenix.log-ot és reagálj rá!

**🔴 KRITIKUS:** A Phoenix Protocol öngyógyító, de TE vagy felelős a logok ellenőrzéséért!

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
  ├── TaskDecomposerAgent   - Komplex feladat dekompozíció (preview-only DAG)
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

### VÉDETT FÁJLOK - SOHA NE TÖRÖLD

| Fájl                       | Miért kritikus                    |
| -------------------------- | --------------------------------- |
| `.env`                     | API kulcsok, titkos konfigurációk |
| `package.json`             | Projekt definíció, függőségek     |
| `src/agents/*.ts`          | Core ügynökök implementációi      |
| `src/agents/types.ts`      | IAgent interfész definíció        |
| `src/agents/registry.json` | Ügynök regisztráció               |
| `src/server/web.ts`        | Web szerver                       |
| `src/server/registry.ts`   | MCP tool regisztráció             |
| `src/cli.ts`               | CLI belépési pont                 |
| `src/core/llm_client.ts`   | LLM kommunikáció                  |
| `src/index.ts`             | Fő belépési pont                  |

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

# Task Decomposer (komplex feladat bontás)
brunella decompose [task]     # Feladat dekompozíció (preview-only DAG)

# Agent Architect (új ügynök generálás)
brunella architect create [description]  # Új ügynök létrehozása TOML config-ból
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

### 🛡️ Engineering Precision Protocol (EPP) - "Zero Broken Windows"

Ez a protokoll garantálja, hogy a rendszer mérnöki precizitással működjön, és soha ne "felejtsen el" feladatokat.

#### 1. 🛑 "Stop-and-Fix" Törvény (Red Light Rule)

**"Nem lépünk tovább hibás rendszerrel."**

Ha bármilyen munkafolyamat során (fejlesztés, tesztelés, robotkéz) hibát észlelsz:

1. **AZONNAL ÁLLJ MEG!** Ne folytasd a feature fejlesztést.
2. **JAVÍTSD KI!** A hibát addig kell diagnosztizálni és javítani, amíg el nem tűnik.
3. **CSAK AKKOR FOLYTASD**, ha a rendszer újra "Zöld" (Build OK, Test OK).

_Tilos a "majd később visszatérünk rá" vagy "ez most nem az én dolgom" mentalitás._

#### 2. 📝 "Spec First" Elv (Vague to Precise)

Soha ne írj kódot "vázlatos" utasítás alapján. Konvertáld a szöveget mérnöki tervvé:

1. **User Input:** "Csinálj egy olyat, hogy..."
2. **Specifikáció:** Hozz létre egy Track-et (`conductor/tracks/uj_feature/spec.md`).
3. **Jóváhagyás:** A userrel (vagy Conductorral) validáltasd a tervet.
4. **Implementáció:** Csak a jóváhagyott spec alapján kódolj.

#### 3. 🧠 Kontextus Perzisztencia (No Amsnesia)

Minden feladatnak nyoma kell legyen. Ami nincs írásban, az nem létezik.

- **Aktív Feladat:** `conductor/tracks.md` (Track)
- **Hiba/Javítás:** `data/fix_queue.json` (Self-Healing Queue)
- **Ötlet:** `conductor/backlog.md` (ha van) vagy `tracks.md` (Proposed)

---

### 🚀 EPP v2 Protocol (2026-02-11 ÚJ!)

**Engineering Precision Protocol v2** - Teljes fejlesztési protokoll frissítése.

**📖 Teljes dokumentáció:** [`conductor/epp-v2.md`](./conductor/epp-v2.md)

#### 🎯 A 7 Arany Szabály (Quick Reference)

| #   | Szabály             | Mit jelent?                                             |
| --- | ------------------- | ------------------------------------------------------- |
| 1️⃣  | **Track Required**  | Nincs kódírás track nélkül (`conductor/tracks/<name>/`) |
| 2️⃣  | **Fix Bugs**        | Fejlesztés közben talált hibák azonnal javítandók       |
| 3️⃣  | **Commit Often**    | Minden Phase befejezése után git commit                 |
| 4️⃣  | **TODO List**       | Track.md checkbox lista folyamatos frissítése           |
| 5️⃣  | **All Tests Green** | COMPLETED csak ha: build ✅ + test ✅ + manual ✅       |
| 6️⃣  | **Dashboard + CLI** | Mindkettő kötelező minden új funkcióhoz!                |
| 7️⃣  | **Final Docs**      | Track befejezés után: .ai/<agent>.md + sync_foszal.py   |

#### ⚠️ KRITIKUS ÚJ SZABÁLY: Dashboard + CLI Integráció KÖTELEZŐ!

**Mi változott v1 → v2:**

- ✅ **6. szabály hozzáadva:** Minden új funkció = Dashboard komponens + CLI parancs (magyar, menüvezérelt)
- ✅ Track template frissítve (Dashboard + CLI checklist kötelező)
- ✅ COMPLETED státusz csak ha MINDKETTŐ működik

**Minden új funkció implementálása során:**

1. **Dashboard Komponens** (`src/dashboard/components/`)
   - React komponens Radix UI + Tailwind
   - Működő backend integráció (API endpoint)
   - Real-time frissítés ahol releváns (WebSocket)
   - Responsive design + error handling

2. **CLI Parancs** (`src/cli/commands/`)
   - **MAGYAR nyelven, menüvezérelt!** (NINCS begépelés!)
   - inquirer.js menü (nyíl + enter navigáció)
   - Színes output (chalk, boxen, ora)
   - Interaktív kiválasztás

3. **Track Checklist** kötelező pontok minden track-ben:

   ```markdown
   ## 🎨 Dashboard Integráció

   - [ ] React komponens létrehozva: src/dashboard/components/<Feature>.tsx
   - [ ] Radix UI + Tailwind használat
   - [ ] Backend API integráció
   - [ ] Real-time updates (ha releváns)

   ## 🖥️ CLI Integráció

   - [ ] Magyar menü: src/cli/commands/<feature>-hu.ts
   - [ ] Inquirer.js menü (nyíl + enter)
   - [ ] Színes output (chalk, boxen)
   - [ ] CLI regisztráció (src/cli.ts)
   ```

**Ha valamelyik elmarad → Track NEM lehet COMPLETED!**

**További részletek, példák, anti-patterns:** [`conductor/epp-v2.md`](./conductor/epp-v2.md)

---

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

### 🤖 Jules Async Test Automation (GitHub Actions)

**15 párhuzamos teszt suite 4 óránként + napi összesítő**

```bash
# CLI használat
brunella jules tests           # Interaktív menü: futások / trigger

# Dashboard
# Mission Control → Jules Integration → "Async Tests" szekció
# - Latest runs táblázat
# - Success trend chart
# - "Trigger" gomb
```

**Workflow-k:**

- `.github/workflows/jules-async-tests.yml` - 15 suite (unit, integration, e2e, performance, security)
- `.github/workflows/jules-test-coordinator.yml` - Napi összesítő (8 AM UTC)

**Test Suites:**

1. unit_fast / unit_slow
2. integration_ollama / integration_gemini / integration_github_models
3. dashboard
4. e2e_full / e2e_critical
5. performance_stress / performance_memory
6. security_scan
7. api_contracts
8. accessibility / browser_compat / regression

**Trigger:**

- Automatikus: 4 óránként (cron)
- Manuális: `brunella jules tests` → "Workflow indítása"
- Dashboard: "Trigger" gomb

---

## 📖 Kód Konvenciók (FONTOS!)

### ESM + .js Kiterjesztés

A projekt `"type": "module"`. **Minden import `.js` kiterjesztéssel:**

```typescript
import { foo } from "./bar.js"; // ✅ HELYES
import { foo } from "./bar"; // ❌ HELYTELEN (build fail!)
```

### Naplózás (Console.log TILOS!)

**Használd a `logger.ts` függvényeket:**

```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from "../utils/logger.js";
logInfo("AgentName", "message");
setAgentStatus("AgentName", "working", "task desc");

// Szerver kódban:
import { Logger } from "../utils/logger.js";
const logger = new Logger("feature.log");
await logger.info("message");
```

**NE használj `console.log()` production kódban!**

### Agent Implementációs Minták

#### 1. Egyszerű Agent (IAgent interfész)

```typescript
import { IAgent, AgentResponse } from "./types.js";
import { logInfo, logError, setAgentStatus } from "../utils/logger.js";

export class MyAgent implements IAgent {
  name = "MyAgent";
  role = "Cél";
  description = "Mit csinál";
  capabilities = ["skill1", "skill2"];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, "working", task.slice(0, 50));
    try {
      // Implementáció
      return { status: "success", data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, "idle"); // KÖTELEZŐ!
    }
  }
}
```

**try/finally KÖTELEZŐ:** Garantálja hogy az ügynök státusza mindig `idle`-ba tér vissza!

#### 2. Komplex Agent (BaseAgent leszármazott)

```typescript
import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";

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
      param: { type: "string", description: "Parameter leírás" },
    },
    required: ["param"],
  },
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
import { myToolDefinition, myToolHandler } from "../tools/myTool.js";

export function registerAllTools(server: MCPServer) {
  server.registerTool(myToolDefinition, async (params: unknown) =>
    myToolHandler(params as { param: string }),
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

# Cloudflare Chat Integration (Edge)
EDGE_ENABLED=true                  # Cloudflare Edge proxy engedélyezése
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.iam-dd1.workers.dev
CLOUDFLARE_CHAT_URL=https://llm-chat-app-template.iam-dd1.workers.dev
```

**SOHA NE COMMITOLD** a `.env` fájlt git-be!

---

## ☁️ Cloudflare Chat Integration (Edge Mode)

A BAS támogatja a **Cloudflare Workers** integrációt távoli chat és orchestration kontrollhoz.

### 🔧 Környezeti Változók

```env
# Cloudflare Edge mód engedélyezése
EDGE_ENABLED=true

# Cloudflare Worker URL-ek
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.iam-dd1.workers.dev
CLOUDFLARE_CHAT_URL=https://llm-chat-app-template.iam-dd1.workers.dev
```

### 📡 Backend API Végpontok

| Végpont                          | Metódus | Leírás                                                  |
| -------------------------------- | ------- | ------------------------------------------------------- |
| `/api/cloudflare/status`         | GET     | Edge enabled/healthy/tunnel státusz                     |
| `/api/cloudflare/task`           | POST    | Task submission Cloudflare Worker-nek                   |
| `/api/cloudflare/status/:taskId` | GET     | Task status lekérdezés                                  |
| `/api/cloudflare/chat`           | POST    | Chat proxy Cloudflare Worker-hez (history támogatással) |

**Feature Flag:** Ha `EDGE_ENABLED != true`, akkor minden /task és /status/:taskId végpont 503-at dob.

### 🖥️ Dashboard Használat

**Neural Link Chat komponensben:**

1. **Cloudflare Chat mód** - Közvetlen folyamatos beszélgetés Worker-rel
   - Dropdown: válaszd a "Cloudflare Chat" opciót
   - History támogatás: teljes beszélgetés kontextus küldhető
   - Endpoint fallback: próbál /api/chat, /chat, /api/v1/chat, / sorrendben

2. **Cloudflare (Edge) mód** - Task submission Edge Worker-nek
   - Dropdown: válaszd a "Cloudflare (Edge)" opciót
   - Task-based execution: instruction + context küldhető
   - Status tracking taskId alapján

**Connection Status:** Zöld/piros badge jelzi az Edge enabled/disabled állapotot a mód váltó mellett.

### 🧪 TypeScript Client Példa

```typescript
import * as api from "@/lib/apiService";

// 1. Edge Status Check
const status = await api.getCloudflareStatus();
console.log(status); // { enabled: true, healthy: true, tunnelConnected: true }

// 2. Task Submission
const task = await api.submitCloudflareTask(
  "Generate a Python function for CSV parsing",
  { format: "pandas" },
);
console.log(task.taskId); // "task_abc123"

// 3. Chat with History
const chat = await api.chatWithCloudflare("Explain TypeScript generics", [
  { role: "user", content: "Hi!" },
  { role: "assistant", content: "Hello! How can I help?" },
]);
console.log(chat.message);
```

### 🛠️ CLI Parancsok

```bash
brunella chat                 # Edge mód interaktív váltás
/edge on                      # Edge mód bekapcsolás
/edge off                     # Edge mód kikapcsolás
```

### ⚠️ Hibaelhárítás

| Probléma                 | Megoldás                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| **503 "Edge disabled"**  | Állítsd be: `EDGE_ENABLED=true` a `.env`-ben                        |
| **Edge unhealthy**       | Ellenőrizd hogy a Worker URL elérhető-e                             |
| **Tunnel not connected** | Cloudflare tunnel nincs konfigurálva (normális helyi fejlesztésben) |
| **Chat proxy 502**       | Worker endpoint nem elérhető, ellenőrizd `CLOUDFLARE_CHAT_URL`      |

### 🧪 Tesztelés

```bash
# Unit tesztek (Edge disabled állapotban)
npm test -- cloudflare
# 5 teszt (feature-flag behavior, validation, proxy success)

# Edge enabled manuális teszt
EDGE_ENABLED=true npm run dev
# Dashboard-on: Cloudflare Chat vagy Cloudflare (Edge) mód
```

### 📚 További Dokumentáció

- **Spec:** `conductor/tracks/cloudflare-chat-integration-20260211/spec.md`
- **Implementation Plan:** `conductor/tracks/cloudflare-chat-integration-20260211/plan.md`
- **Backend Routes:** `src/server/routes/cloudflare.ts`
- **Cloudflare Client:** `src/utils/cloudflareClient.ts`
- **Tests:** `test/cloudflare_routes.test.ts`

---

## 🚨 Hibaelhárítás

| Probléma                     | Megoldás                                                                   |
| ---------------------------- | -------------------------------------------------------------------------- |
| **Ollama connection failed** | Indítsd el: `ollama serve` vagy ellenőrizd port 11434                      |
| **Port 3000 foglalt**        | `npm run dev:alt` (port 3001) vagy zárd be a másik process-t               |
| **Python import hiba**       | `cd myai && uv sync` vagy `.venv` újraépítés                               |
| **Build hiba**               | `rmdir /s /q build && npm run build`                                       |
| **Teszt fail**               | **JAVÍTSD a tesztet**, ne töröld! Ellenőrizd: `npm run smoke`              |
| **Hiányzó fájl (git)**       | `git checkout HEAD -- <fájl>`                                              |
| **uv sync lock hiba**        | `.venv` törlése: `Remove-Item -Recurse -Force .venv && uv venv && uv sync` |
| **Dashboard fehér képernyő** | Ellenőrizd a konzolt, gyakran import hiba vagy props error                 |
| **FastAPI nem indul**        | Ellenőrizd: `cd myai && uvicorn server:app --reload --port 8000`           |
| **LanceDB ImportError**      | Opcionális függőség: `cd myai && uv pip install lancedb pyarrow`           |

### Gyakori Hibák

1. **Import `.js` kiterjesztés nélkül** → Build fail
2. **`console.log()` használata** → Használj `logger.ts`-t!
3. **Agent `finally` hiányzik** → Status nem tér vissza `idle`-ba
4. **`.env` commitolva** → Git revert + `.gitignore` ellenőrzés

---

## 📚 API Végpontok

| Végpont                          | Leírás                                   |
| -------------------------------- | ---------------------------------------- |
| `GET /api/health`                | Rendszer állapot (Ollama, FastAPI, stb.) |
| `GET /api/agents`                | Ügynökök listája                         |
| `POST /api/agents/:name/execute` | Ügynök futtatás                          |
| `GET /api/tools`                 | MCP eszközök listája                     |
| `POST /api/ollama/generate`      | LLM generálás (LangSmith traced)         |
| `GET /api-docs`                  | Swagger UI (API dokumentáció)            |
| `GET /files/list`                | Fájl lista (Dashboard File Explorer)     |
| `GET /files/content`             | Fájl tartalom olvasás                    |

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

**Részletes dokumentáció:** [docs/CLOUDFLARE_INTEGRATION.md](docs/CLOUDFLARE_INTEGRATION.md)

### Cloudflare Szolgáltatások

- **🌐 Cloudflare Tunnel** - Biztonságos távoli hozzáférés (port nyitás nélkül)
- **🧠 AI Gateway** - LLM cache, rate limiting, cost tracking
- **📊 Vectorize** - Globális vektor DB (POC fázis)
- **🔧 Workers KV** - Distributed task queue
- **💾 R2 Storage** - Zero-egress object storage
- **🗄️ D1 Database** - Serverless SQL

---

## 📊 Dashboard V2 Funkciók

| Funkció            | Leírás                                       | Gyorsbillentyű |
| ------------------ | -------------------------------------------- | -------------- |
| **AgentGraph**     | Ügynök kapcsolatok vizualizáció (React Flow) | -              |
| **CommandMenu**    | Globális parancs paletta                     | `Ctrl+K`       |
| **ThemeToggle**    | Sötét/Világos téma váltás                    | -              |
| **FileExplorer**   | Projekt fájl böngésző                        | -              |
| **NeuralLinkChat** | Beágyazott chat interfész                    | -              |
| **ServiceControl** | Szolgáltatások indítás/leállítás             | -              |

---

## 🎯 Aktív Ügynökök

| Ügynök               | Szerep                                        | Státusz |
| -------------------- | --------------------------------------------- | ------- |
| **Orchestrator**     | Központi koordinátor, feladat delegálás       | Active  |
| **RobotkezV2**       | Magyar agentic browser (Perplexity Comet-style) | Active  |
| **Developer**        | Kód generálás, self-healing pipeline          | Active  |
| **Evaluator**        | Rendszer audit, tesztelés, health check       | Active  |
| **Researcher**       | RAG keresés, tudásbázis, összefoglalás        | Active  |
| **DataScientist**    | Adat elemzés, Python végrehajtás, LanceDB     | Active  |
| **ProjectConductor** | Projekt struktúra, docs sync (Chief-of-Staff) | Active  |
| **EdgeProxy**        | Cloudflare Workers proxy                      | Active  |
| **VoiceAgent**       | Hangfelismerés (Whisper)                      | Active  |
| **LintFixer**        | Automatikus lint javítás (mikro-ügynök)       | Active  |

### RobotkezV2 - Magyar Agentic Browser

**Comet-style intelligens böngésző ügynök magyar természetes nyelv támogatással.**

**Funkciók:**
- 🇭🇺 Magyar nyelvű utasítások ("Keress rá az AI hírekre")
- 🤖 LLM-based multi-step planning (GPT-4o/Gemini)
- 🌐 Automated browser control (Playwright + Python)
- ⏱️ Background task management (long-running operations)
- 📊 Live View dashboard + CLI interface

**Gyors használat:**

```bash
# Dashboard
# http://localhost:5173 → "Robotkéz V2" tab

# CLI
brunella robotkez chat "Navigálj a google.com-ra és keress rá az AI hírekre"
brunella robotkez plan "..."  # Plan preview (no execution)
brunella robotkez status      # Agent status
```

**Dokumentáció:**
- 📖 [User Guide (magyar)](docs/robotkezv2-user-guide.md) - Felhasználói útmutató
- 🔧 [Developer Guide](docs/robotkezv2-dev-guide.md) - API & architecture
- 📋 [Track Details](conductor/tracks/robotkezv2-full-comet-20260215/) - Implementation plan

---

## 🔗 További Dokumentáció (Opcionális Olvasás)

| Fájl                            | Mikor olvasd                                          |
| ------------------------------- | ----------------------------------------------------- |
| `conductor/tracks.md`           | Ha konkrét track-en dolgozol                          |
| `conductor/workflow.md`         | Ha mélyebben érdekel a Data Flywheel/Phoenix Protocol |
| `conductor/tracks/<id>/plan.md` | Ha track-specifikus detailsre van szükséged           |
| `CLAUDE.md`                     | **ELAVULT** - Ez a README.md az aktuális!             |
| `GEMINI.md`                     | **ELAVULT** - Ez a README.md az aktuális!             |

---

## 📋 Changelog

### v2.4.0 (2026-02-15)

- **NEW:** RobotkezV2 Agent - Magyar agentic browser (Comet-style) ⭐
- **NEW:** LLM-based multi-step planning (GPT-4o/Gemini)
- **NEW:** Background task manager for long-running browser operations
- **NEW:** Live View dashboard with real-time screenshots
- **NEW:** CLI commands (`brunella robotkez ...`)
- **IMPROVED:** Persistent Browser (Playwright + Python bridge)
- **DOCS:** User Guide + Developer Guide for RobotkezV2

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

_Projekt tulajdonos: Pohánka Péter_
_Ha kérdésed van, kérdezz - ne találgass!_
