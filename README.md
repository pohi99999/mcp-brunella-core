# Brunella Agent System (BAS)

**Verzió:** 2.4.0 | **Utolsó frissítés:** 2026-03-25

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

### 2. Fájlok Beolvasása (3 FÁZIS)

> **Elv:** Ne olvass be mindent vakon — fázisonként haladj, és csak azt olvasd, amire szükséged van.

**🟢 FÁZIS 1 — GYORS KONTEXTUS (MINDIG, ~5 perc)**

```
1. .ai/BOOTSTRAP.md              # Projekt összefoglaló (LEGELŐSZÖR!)
2. conductor/tracks.md            # Aktív fejlesztések (mit csinálunk MOST)
3. .ai/FOSZAL.md                  # Mi történt legutóbb? (egyesített napló)
4. .ai/<te_neved>.md              # Te mit csináltál legutóbb (claude/gemini/copilot/cursor)
```

> Ez a 4 fájl elegendő a kontextushoz. Ha van folyamatban lévő feladatod, innen kiderül.

**🟡 FÁZIS 2 — FELADAT-SPECIFIKUS (csak ami releváns)**

| Ha a feladatod... | Olvasd be: |
|---|---|
| Bármilyen kódolás | `README.md` → "Kód Konvenciók" szekció |
| Új feature / architektúra | `PROJEKT_DIAGRAM.md`, `README.md` → "Architektúra" szekció |
| Agent fejlesztés | `src/agents/registry.json` (94 agent), `README.md` → "Agent Implementáció" |
| Függőség/konfig módosítás | `package.json`, `tsconfig.json` |
| Track-en dolgozol | `conductor/tracks/<track_id>/plan.md` |
| Teszt probléma | `TEST_RESULTS.md`, `logs/` könyvtár |
| Hiba diagnózis | `logs/phoenix.log`, `logs/agent_*.log`, `logs/developer.log` |
| Dashboard fejlesztés | `src/dashboard/lib/navigation.tsx`, `README.md` → "Dashboard" szekció |

**🔴 FÁZIS 3 — REFERENCIA (szükség szerint, bármikor)**

A `README.md` a master dokumentum (~1100 sor). NE olvasd be egészben induláskor — használd szekciónként:
- "Build, Test, Lint" — parancsok
- "Kód Konvenciók" — szabályok, minták
- "EPP v2" — fejlesztési protokoll
- "API Végpontok" — REST endpoint lista
- "Hibaelhárítás" — gyakori hibák és megoldások
- "Environment Variables" — .env beállítások

<!-- DOC_STATS_START -->
## 📊 Auto-generated projekt statisztikák

- Agent registry entries: **94**
- Route modulok a `src/server/routes/` alatt: **99**
- Aktív route mountok a központi routerben: **110**
- MCP tool fájlok a `src/tools/` alatt: **61**
- Detektált MCP tool definíciók / regisztrációk: **4**
- CLI parancs deklarációk: **319**
- Dashboard navigációs panelek: **110**

> Ezt a blokkot a `npm run sync:doc-stats` generálja.
<!-- DOC_STATS_END -->

## Brunella Studio Agent

A BAS most tartalmaz egy dedikált video post-production alrendszert fashion promo workflow-khoz.

Fő komponensek:
- `brunella studio probe` — FFmpeg + Resolve readiness
- `brunella studio ingest` — media manifest és binning
- `brunella studio rough-cut` — deterministic timeline plan
- `brunella studio audio-plan` — beat/ducking/cue terv
- `brunella studio render` — FFmpeg baseline deliverables
- `brunella studio qc` — render QC report
- `brunella studio full-pipeline` — end-to-end futtatás

Dokumentáció:
- `docs/brunella-studio-agent.md`
- `docs/davinci-resolve-setup.md`

### 3. Rendszer Validáció & Teszt Protokoll (Munka ELŐTT - KÖTELEZŐ!)

```bash
# STEP 1: Build check
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)

# STEP 2: Test check (válaszd a megfelelőt)
npm run test:fast             # ⚡ Gyors tesztek (~1-2 perc) — napi munka, commit/push előtt
npm test                      # 🔒 Teljes suite (~10 perc) — napi scheduled run / manuális release-check

# STEP 3: Phoenix Protocol Állapot Ellenőrzés
# Ellenőrizd a legfrissebb Phoenix logokat:
tail -n 50 logs/phoenix.log   # Windows: type logs\phoenix.log | more
```

**⚠️ 0-HIBA STRATÉGIA:**
- **Ha BUILD FAIL** → NE kezdj fejlesztésbe! Javítsd először!
- **Ha TESZT FAIL** → Dokumentáld TEST_RESULTS.md-ben, majd javítsd!
- **Ha Phoenix hibát ír** → Olvasd el logs/phoenix.log-ot és reagálj rá!

**Teszt cadence szabály (2026-04-01):**

- helyi `pre-push` csak a `npm run test:fast` profilt futtatja,
- a teljes Node.js tesztkör napi egyszer, külön GitHub Actions workflow-ban fut,
- manuálisan továbbra is ajánlott teljes suite-ot futtatni nagyobb merge / release / track lezárás előtt.

**🔴 KRITIKUS:** A Phoenix Protocol öngyógyító, de TE vagy felelős a logok ellenőrzéséért!

### 🔴 Vörös Protokoll — Track lezárási kapu

`completed` vagy `archived` státusz **nem** lehet pusztán meta-frissítés eredménye. Minden lezárt track `meta.json` fájljában kötelező a `dod` blokk, és azt csak valós build + teszt + commit bizonyíték mellett szabad lezártra állítani:

### 🟡 Arany szabály — előbb a valóság, utána a meta

**Soha ne zárj le vagy archiválj tracket pusztán emberi utasításra, AI self-report alapján, vagy azért, mert a `meta.json` könnyen átírható.**  
Előbb legyen meg a **valós repo-bizonyíték** (kód / route / CLI / dashboard / teszt / build), és csak utána írható be a lezárás a `meta.json`-ba.  
Ha a valós implementáció és a meta állapot eltér, akkor a **kód az igazság**, nem a `progress: 100`.

```json
"dod": {
  "tests_pass": true,
  "build_clean": true,
  "code_committed": true,
  "no_verify_used": false
}
```

Kötelező szabályok:

- `progress: 100` csak akkor megengedett, ha a fenti DoD teljesül.
- `completed` trackhez kötelező `verificationNotes` + `completedAt`.
- `archived` trackhez kötelező `archiveReason` + `archivedAt`.
- Ha egy régi tracket egy későbbi, **validált** track váltott ki, az előzmény `archived` maradhat `supersededByTracks` hivatkozással. Ez nem `completed`, és nem szabad hamis DoD-vel 100%-ra kozmetikázni.
- Meta-only lezárás TILOS: a lezáró commitnak valódi repo-munkát is kell tartalmaznia (`src/`, `myai/`, `scripts/`, `test/`, `docs/`, `.github/`, stb.).
- `git commit --no-verify` és `git push --no-verify` TILOS.
- Ha egy lezárás vagy archiválás bizonyíték nélkül történne, azt hibának kell tekinteni, és a tracket vissza kell vinni javításra / follow-up trackre.

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
OrchestratorAgent / EnterpriseOrchestratorAgent (Koordinátorok)
├── Core: DeveloperAgent, EvaluatorAgent, ResearcherAgent, TaskDecomposerAgent
├── Automation: RobotkezV2Agent (Playwright/LLM), VoiceAgent (Whisper)
├── Engineering: SpecWriterAgent, GenesisOrchestrator, UXDesignerAgent, LintFixerAgent
├── Enterprise Suite (~20 ügynök):
│   ├── Finance: FinanceGuardian, FinancialGuardAgent, ProcurementAgent
│   ├── Sales/Marketing: SalesAgent, CopywriterAgent, MarketingDirectorAgent
│   ├── HR: HeadHunterAgent, ConflictMediatorAgent
│   ├── Logistics: LogisticsDispatcherAgent
│   └── Admin: EmailTriageAgent, GrantWatcherAgent, KnowledgeBaseBuilderAgent
├── TOML-alapú DynamicAgent: myai/agents/*.toml
├── Management: ProjectConductorAgent (tracks.md szinkron)
└── Swarm: SwarmManager + SwarmColony (párhuzamos kolónia-alapú feladatkiosztás)
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
                → Chaos Awareness (429/504 adaptív várakozás) [ÚJ]
                → Auto-Reset (max 3 kísérlet)
                → Git Recovery (sync_foszal.py + commit)
```

### Prompt Armor & Security Sandbox (IPI Defense) [ÚJ]

A BAS mostantól beépített védelmet tartalmaz az **Indirekt Prompt Injektálás (IPI)** ellen:
- **Strukturális izoláció:** A külső forrásból (web, fájlrendszer) érkező adatokat XML elválasztók (`<external_data>`) közé zárja.
- **Mintafelismerés:** Proaktívan szűri a gyanús utasításokat (pl. "ignore previous instructions").
- **Edge Protection:** A védelem a Cloudflare Worker szintjén is aktív.

### Swarm Orchestration (ClawSwarm) [ÚJ]

A hagyományos hierarchikus delegálás mellett elérhető a **Raj Intelligencia** üzemmód:
- **Unified Group Chat:** Több ügynök dolgozik egyetlen megosztott kontextusban.
- **Direct Agent Interakció:** Az ügynökök "@mention" segítségével tudnak egymástól segítséget kérni.
- **Vizualizáció:** Az `AgentGraph` a Dashboard-on valós időben mutatja a raj-kapcsolatokat.

### Model Router & Bifrost Gateway

**Model Router** (`src/core/modelRouter.ts`) — Brain vs Muscle routing:
- **Brain (Cloud):** Gemini (1M ctx), GitHub Models GPT-4o → `complexity: 'high'`
- **Muscle (Local):** Ollama → `complexity: 'low'` vagy `budget=0`

**Bifrost Gateway** (`src/core/bifrost_gateway.ts`) — Multi-LLM Gateway:
- 5 provider: Ollama, Gemini, GitHub Models, Anthropic, Cloudflare Workers AI
- Auto-fallback: ha egy provider nem elérhető, automatikusan átvált
- `setMode('edge-only'|'local-preferred'|'cloud-preferred')`
- userId alapú preferenciák támogatása

### Új Alrendszerek (2026-03 Phase 2-4)

| Alrendszer | Leírás | Dashboard | CLI |
|------------|--------|-----------|-----|
| **Crawl4AI** | Intelligens webcrawling (patchright fallback) | ✅ Crawl4AI Panel | `brunella crawl4ai` |
| **User Preferences** | Felhasználói LLM/nyelv/stílus preferenciák | ✅ Preferences Panel | `brunella preferences` |
| **LLM Observability** | Provider stats, latencia, token monitoring | ✅ Observability Panel | `brunella observability` |
| **Golden Dataset** | Tool futás instrumentáció fine-tuning-hoz | API endpoints | — |
| **Golden Dataset Bridge** | Tool futás- és sikeresség-instrumentáció fine-tuning célra | `src/core/goldenDatasetBridge.ts` | — |
| **Safe Zones** | Fájlrendszer- és titokvédelmi whitelist/blacklist réteg | `config/safe_zones.json` | — |
| **E2B Sandbox** | Izolált Python futtatás nem megbízható kódhoz | Secure Python execution | — |
| **Jules Integration** | Aszinkron tesztfuttatás és workflow koordináció | ✅ Jules Panel | `brunella jules tests` |
| **Zod Bridge** | Runtime séma validáció MCP tool-okhoz | — | — |
| **WebSocket RT** | Socket.IO real-time frissítés a panelekhez | ✅ Auto | — |

### Track Rendszer (Fejlesztési Szálak)

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában.
**Jelenleg:** 7 aktív track, 5 proposed, 114 archivált. (2026-03-25 rendszerezés)

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
│   │   ├── llm_client.ts          # Ollama/Gemini LLM hívások
│   │   ├── modelRouter.ts         # Brain vs Muscle routing
│   │   ├── bifrost_gateway.ts     # Multi-LLM Gateway (5 provider, auto-fallback)
│   │   ├── observabilityLogger.ts # LLM hívás naplózás (SQLite)
│   │   ├── toolRunCapture.ts      # Golden Dataset tool instrumentáció
│   │   └── checkpoint.ts          # Phoenix Protocol
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
# Kanonikus kezi stable inditas (ajanlott - Windows operator mod)
inditas.bat

# Kozvetlen stable console fallback (ha nincs service telepitve)
Inditsd_Brunellat_Stabil.bat

# Stable runtime kezzel, kulon terminálokban
npm run build:stable
npm run start:python:stable   # Python (:8000)
npm run start:stable          # Brunella Core + Dashboard (:3000)

# Development only
npm install && npm run build
npm run dev          # Backend (:3000)
npm run dev:ui       # Dashboard (:5173)

# Python alrendszer (FastAPI :8000)
cd myai
uv sync              # Függőségek telepítése
uvicorn server:app --reload --port 8000

# Host-native supervision
npm run services:preflight
powershell -ExecutionPolicy Bypass -File scripts\supervisors\windows\install-windows-services.ps1
bash scripts/supervisors/linux/install-systemd-services.sh

# Service operations
npm run services:status:windows
npm run services:status:linux
npm run services:uninstall:windows
npm run services:uninstall:linux
```

Stable runtime contract (minden stable indítási út ugyanazt a budgetet használja):

```bash
BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1536         # Node heap budget (MB)
BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2048         # Teljes runtime envelope (MB)
BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=1792    # Supervisor restart threshold (MB)
```

- A `scripts/start-stable.mjs` ezt a contractet validálja boot előtt.
- Ha a launcher más heap budgettel indul, a stable startup fail-fast leáll.
- Docker / PM2 / Windows service / systemd ugyanarra a contractre van igazítva.
- A `npm run services:preflight` service install előtt ellenőrzi a stable buildet, a Python runtime-ot és a `logs`/`data` írhatóságát.

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
npm run health       # Teljes health riport, runtime memória telemetriával
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

# Új integrációk (Phase 2-4)
brunella crawl4ai              # Webcrawling menü (URL crawl, status, konfiguráció)
brunella preferences           # Felhasználói preferenciák (nyelv, provider, stílus)
brunella observability         # LLM Observability (provider stats, latencia, tokens)
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
npm run test:fast             # Gyors unit tesztek (~1-2 perc) — commit előtt
npm test                      # Build + összes teszt (~10 perc) — track lezáráskor / push előtt
npm run test:nightly          # Azonos mint npm test — éjszakai / CI futtatásra
npm run test:watch            # Watch mód (fejlesztés közben)
npx vitest run test/foo.test.ts  # Egy teszt fájl
npm run test:coverage         # Lefedettségi jelentés

# Python tesztek
cd myai
pytest tests/
```

### 📋 Tesztelési Protokoll — Mikor Mit Kell Futtatni

| Esemény | Parancs | Kötelező? |
|---------|---------|-----------|
| Commit előtt | `npm run test:fast` (auto, pre-commit hook) | ✅ IGEN |
| Track lezárása | `npm test` (teljes suite) + `npm run smoke` | ✅ IGEN |
| Push előtt | `npm test` (auto, pre-push hook) | ✅ IGEN |
| Nagyobb refaktor | `npm test` + E2E smoke manuálisan | ✅ IGEN |
| Éjszakai / CI | `npm run test:nightly` | ajánlott |
| Napi fejlesztés | csak `test:fast` | elegendő |

> **Szabály:** E2E és smoke tesztek (`test/cli-e2e*`, `test/phase*`, `test/swarm_smoke*`) **NEM futnak** minden commitnál.
> Ezeket **track lezárásakor** vagy **push előtt** kell futtatni (`npm test`).
> A pre-push hook automatikusan lefuttatja a teljes suite-ot.

### Mit Ellenőrizz Munka Előtt

- [ ] `npm run build` - TypeScript fordítás OK
- [ ] `npm run test:fast` - Gyors tesztek PASS
- [ ] `git status` - Nincs váratlan változás

### Mit Ellenőrizz Munka Után

- [ ] `npm run build` - Még mindig OK
- [ ] `npm run test:fast` - Még mindig PASS
- [ ] Track lezárásnál: `npm test` + `npm run smoke` — KÖTELEZŐ
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

# MCP kapcsolat timeout (ms) — növeld lassú gépen
BRUNELLA_MCP_CONNECT_TIMEOUT_MS=8000

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
| **`brunella chat` — "fetch failed"** | A chat backend szükséges: indítsd el `npm run dev` (port 3000)   |
| **MCP connect timeout**      | Növeld: `BRUNELLA_MCP_CONNECT_TIMEOUT_MS=10000` (alapértelmezett: 8000ms)  |

### Gyakori Hibák

1. **Import `.js` kiterjesztés nélkül** → Build fail
2. **`console.log()` használata** → Használj `logger.ts`-t!
3. **Agent `finally` hiányzik** → Status nem tér vissza `idle`-ba
4. **`.env` commitolva** → Git revert + `.gitignore` ellenőrzés

---

## 📚 API Végpontok

### Core API

| Végpont                          | Metódus | Leírás                                   |
| -------------------------------- | ------- | ---------------------------------------- |
| `GET /api/health`                | GET     | Rendszer állapot (Ollama, FastAPI, stb.) |
| `GET /api/agents`                | GET     | Ügynökök listája                         |
| `POST /api/agents/:name/execute` | POST    | Ügynök futtatás                          |
| `GET /api/tools`                 | GET     | MCP eszközök listája                     |
| `POST /api/ollama/generate`      | POST    | LLM generálás (LangSmith traced)         |
| `GET /api-docs`                  | GET     | Swagger UI (API dokumentáció)            |
| `GET /files/list`                | GET     | Fájl lista (Dashboard File Explorer)     |
| `GET /files/content`             | GET     | Fájl tartalom olvasás                    |

### Crawl4AI (Webcrawling)

| Végpont                          | Metódus | Leírás                                   |
| -------------------------------- | ------- | ---------------------------------------- |
| `POST /api/v1/crawl4ai/crawl`   | POST    | URL crawl indítás                        |
| `GET /api/v1/crawl4ai/status`   | GET     | Crawl állapot lekérdezés                 |
| `GET /api/v1/crawl4ai/results`  | GET     | Crawl eredmények listázása               |

### User Preferences

| Végpont                            | Metódus | Leírás                                   |
| ---------------------------------- | ------- | ---------------------------------------- |
| `GET /api/v1/preferences/:userId`  | GET     | Felhasználó preferenciái                 |
| `PUT /api/v1/preferences/:userId`  | PUT     | Preferenciák mentése/frissítése          |
| `DELETE /api/v1/preferences/:userId` | DELETE | Preferenciák törlése                   |

### LLM Observability

| Végpont                             | Metódus | Leírás                                    |
| ----------------------------------- | ------- | ----------------------------------------- |
| `GET /api/v1/observability/stats`   | GET     | Provider statisztikák (latencia, tokens)  |
| `GET /api/v1/observability/logs`    | GET     | LLM hívás logok (szűrhető)               |
| `GET /api/v1/observability/providers` | GET   | Provider elérhetőség és fallback chain    |

### Golden Dataset

| Végpont                             | Metódus | Leírás                                    |
| ----------------------------------- | ------- | ----------------------------------------- |
| `GET /api/v1/golden-dataset/tool-runs` | GET  | Tool futások listája                      |
| `GET /api/v1/golden-dataset/tool-stats` | GET | Tool statisztikák (sikerráta, átlag idő) |
| `GET /api/v1/golden-dataset/export` | GET     | JSONL export fine-tuning célra            |

### Cloudflare Edge

| Végpont                          | Metódus | Leírás                                   |
| -------------------------------- | ------- | ---------------------------------------- |
| `GET /api/cloudflare/status`     | GET     | Edge enabled/healthy státusz             |
| `POST /api/cloudflare/task`      | POST    | Task submission Worker-nek               |
| `POST /api/cloudflare/chat`      | POST    | Chat proxy Cloudflare-hez                |

> **Összesen ~53 route fájl** a `src/server/routes/` mappában. Részletes API docs: `GET /api-docs` (Swagger UI).

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
| `CLAUDE.md`                     | Claude Code ügynök-specifikus instrukciók (auto-betöltődik) |
| `GEMINI.md`                     | Gemini CLI ügynök-specifikus instrukciók (auto-betöltődik) |
| `.ai/BOOTSTRAP.md`              | Gyors projekt összefoglaló (KÖTELEZŐ induláskor!)     |

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

### v2.5.0 (2026-04-10)

- **NEW:** Chaos Engine — Agent instability testing (timeout, rate-limit, data corruption simulation).
- **NEW:** Prompt Armor — IPI (Indirect Prompt Injection) defense with XML structural isolation.
- **NEW:** Swarm Orchestration (ClawSwarm) — Multi-agent unified group chat for collaborative task solving.
- **NEW:** Adaptive Phoenix Recovery — Chaos-aware retry logic with exponential backoff for 429/504 errors.
- **NEW:** Interactive Swarm/Chaos/Security menus in Brunella CLI.
- **IMPROVED:** AgentGraph now visualizes real-time swarm connections.
- **STABILIZATION:** Fixed test mocks for EvaluatorAgent and improved ESM compatibility.

### v2.4.1 (2026-02-24)

- **NEW:** 4 új production agent (ApifyScrapingAgent, ChromeDevToolsAgent, InnovationBridgeAgent, LawDetectiveAgent)
- **NEW:** Aider AI coding assistant integráció
- **NEW:** 39/39 új teszt (100% pass rate)
- **CLEANUP:** Teljes projekt rendszerezés (gyökér, conductor, GitHub PRs)
- **CLEANUP:** 41 nyitott PR bezárva, 74 track archiválva
- **CLEANUP:** Root gyökér fájlok rendezése (29 temp fájl törölve, 12 áthelyezve)
- **UPDATED:** project_state.json, tracks.md, SUMMARY.md frissítve

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

## 🛡️ MCP Integration Stack (v1.0.0 - 2026-02-18)

**Model Context Protocol + Multi-Provider LLM Gateway + E2B Sandboxes**

### Quick Start

```bash
# Stable control plane
npm run build:stable
npm run start:python:stable

# Kulon terminalban:
npm run start:stable

# Test MCP tools
curl http://localhost:3000/api/v1/mcp/tools | python -m json.tool

# View dashboard
# Stable dashboard: http://localhost:3000
# Dev dashboard only: npm run dev:ui -> http://localhost:5173
```

### Components

#### 1. MCP Filesystem Server (Phase 1 ✅)
- **4 Tools:** read_file, write_file, list_directory, search_files
- **Safe Zone Security:** Whitelist + blacklist + audit logging
- **Coverage:** 47 tests, 100% pass rate

#### 2. E2B Sandboxes (Phase 2 ✅)
- **Secure Python Execution:** Isolated containers for untrusted code
- **Package Support:** Auto-install numpy, pandas, etc.
- **Artifact Export:** Results validated + copied to Safe Zone
- **Integration:** DataScientistAgent uses E2B by default

#### 3. Bifrost Gateway (Phase 3 ✅)
- **4 LLM Providers:** Ollama (local), Gemini, GitHub Models (GPT-4o), Anthropic (Claude)
- **Smart Routing:** Auto-select best provider by task type
- **Fallback:** Cloud fail → Ollama (always available)
- **Health Monitoring:** Real-time provider availability tracking

#### 4. Dashboard MCPCommandCenter (Phase 4 ✅)
- **8 API Endpoints:** `/api/v1/mcp/*` (tools, providers, audit, stats)
- **React UI:** 4 tabs (Providers, MCP Tools, Audit Log, Statistics)
- **Real-time Execution:** Test tools with JSON args directly in UI
- **Monitoring:** Provider health, audit log viewer, usage stats

#### 5. Python MCP Bridge (Phase 5 ✅)
- **HTTP API Client:** Python → Node.js MCP backend
- **Async/Await:** Full async support with context manager
- **4 Methods:** read_file(), write_file(), list_directory(), search_files()
- **Integration:** Use from any Python agent

### Configuration

**Environment Variables (.env):**
```env
# Required
OLLAMA_BASE_URL=http://localhost:11434

# Optional (enable more providers)
E2B_API_KEY=your-e2b-api-key          # Secure Python sandboxes
GEMINI_API_KEY=your-gemini-key        # Google Gemini LLM
GITHUB_PAT=your-github-token           # GitHub Models (GPT-4o)
ANTHROPIC_API_KEY=your-anthropic-key   # Claude access
```

**Safe Zones (config/safe_zones.json):**
```json
{
  "safe_zones": [
    {"name": "Data Directory", "path": "./data", "permissions": ["read", "write", "delete"]},
    {"name": "Tracks", "path": "./conductor/tracks", "permissions": ["read", "write"]},
    {"name": "Incubator", "path": "./myai/incubator", "permissions": ["read", "write"]}
  ],
  "blacklist": [".env", ".env.*", ".git/**", "*.key", "*.pem"]
}
```

### Usage Examples

**TypeScript (MCP Tools):**
```typescript
import { MCPFilesystemServer } from './src/server/mcp_server.js';

const server = new MCPFilesystemServer();

// Read file
const result = await server.handleReadFile({ path: 'data/test.txt' });

// Write file
await server.handleWriteFile({
  path: 'data/output.json',
  content: '{"success": true}'
});
```

**Python (MCP Bridge):**
```python
from myai.tools.mcp_bridge import MCPBridge

async with MCPBridge() as bridge:
    # Read file
    result = await bridge.read_file("data/test.txt")
    if result["success"]:
        print(result["content"])

    # Write file
    await bridge.write_file("data/output.json", '{"test": true}')
```

**Bifrost Gateway (Multi-LLM):**
```typescript
import { getBifrostGateway } from './src/core/bifrost_gateway.js';

const gateway = getBifrostGateway();

// Auto-select best provider for task type
const response = await gateway.generate({
  prompt: "Explain quantum computing",
  taskType: "general"  // Will use Gemini (fast)
});

// Force specific provider
const codeResponse = await gateway.generate({
  prompt: "Write a Python function",
  provider: "ollama"  // Force local Ollama
});
```

**E2B Sandbox (Secure Python):**
```typescript
import { getE2BSandboxManager } from './src/security/e2b_sandbox_manager.js';

const manager = getE2BSandboxManager();

const result = await manager.executeCode(
  `import pandas as pd
   df = pd.DataFrame({'A': [1,2,3], 'B': [4,5,6]})
   print(df.to_string())`,
  {
    packages: ['pandas'],
    timeout_ms: 30000,
    export_artifacts: true
  }
);
```

### Security Features

✅ **Safe Zone Validation** - All filesystem ops validated against whitelist
✅ **Blacklist Enforcement** - Blocks `.env`, `.git/**`, `*.key`, etc.
✅ **Audit Logging** - All operations logged to `logs/mcp_audit.log`
✅ **Rate Limiting** - 100 ops/min, 5000 ops/hour
✅ **E2B Isolation** - Python code runs in network-isolated containers
✅ **Path Traversal Protection** - `../` attempts blocked

**See:** [SECURITY.md](SECURITY.md) for complete security guidelines

### Documentation

- 📖 **Deployment Guide:** [docs/MCP_DEPLOYMENT_GUIDE.md](docs/MCP_DEPLOYMENT_GUIDE.md)
- 🛡️ **Security Policy:** [SECURITY.md](SECURITY.md)
- 📝 **Track Details:** [conductor/tracks/mcp_ollama_integration_20260218/](conductor/tracks/mcp_ollama_integration_20260218/)

### Statistics

- **Total Implementation Time:** ~4.5 hours (est. 80h → **17.7x AI acceleration**)
- **Test Coverage:** 1452/1494 tests passing (100%, 42 skipped)
- **Components:** 5 major phases, 42/55 tasks complete (80%)
- **Lines of Code:** ~3000+ (TypeScript + Python)

---

_Projekt tulajdonos: Pohánka Péter_
_Ha kérdésed van, kérdezz - ne találgass!_
