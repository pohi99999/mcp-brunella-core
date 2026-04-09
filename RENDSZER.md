# BRUNELLA AGENT SYSTEM — RENDSZERLEÍRÁS

> **Master Blueprint Dokumentum**  
> Verzió: 1.0.0 | Kelt: 2026-04-08  
> Tulajdonos: Pohánka Péter  

---

## ELŐSZÓ

Ez a dokumentum a Brunella Agent System (BAS) teljes körű, tudományos igényű leírását tartalmazza. Célja, hogy bármely fejlesztő, AI ügynök vagy érdeklődő fél egyetlen forrásból megismerhesse a rendszer architektúráját, alrendszereit, képességeit, kommunikációs mintáit, infrastruktúráját és jelenlegi állapotát. A dokumentum diploma-munka stílusban, a rendszer teljes vertikumát lefedve készült.

---

## TARTALOMJEGYZÉK

1. [Bevezetés és projektháttér](#1-bevezetés-és-projektháttér)
2. [Rendszerarchitektúra](#2-rendszerarchitektúra)
3. [Backend alrendszer — Node.js/TypeScript](#3-backend-alrendszer--nodejs-typescript)
4. [Python alrendszer — FastAPI](#4-python-alrendszer--fastapi)
5. [Dashboard — React/Vite](#5-dashboard--reactvite)
6. [Ügynökrendszer (Agent System)](#6-ügynökrendszer-agent-system)
7. [LLM Provider réteg és Bifrost Gateway](#7-llm-provider-réteg-és-bifrost-gateway)
8. [MCP (Model Context Protocol) szerverek](#8-mcp-model-context-protocol-szerverek)
9. [Adatbázis-réteg](#9-adatbázis-réteg)
10. [Phoenix Protocol — öngyógyítás](#10-phoenix-protocol--öngyógyítás)
11. [Data Flywheel — önfejlesztő tanulási pipeline](#11-data-flywheel--önfejlesztő-tanulási-pipeline)
12. [Kernel Pipeline — 8 fázisú szupervisor](#12-kernel-pipeline--8-fázisú-szupervisor)
13. [Conductor Track System — projektvezénylés](#13-conductor-track-system--projektvezénylés)
14. [SDLC Pipeline — fejlesztési életciklus](#14-sdlc-pipeline--fejlesztési-életciklus)
15. [Cloudflare Edge infrastruktúra](#15-cloudflare-edge-infrastruktúra)
16. [PAIOS — Péter AI Operating System](#16-paios--péter-ai-operating-system)
17. [Swarm Architecture — raj-alapú végrehajtás](#17-swarm-architecture--raj-alapú-végrehajtás)
18. [RBAC — szerepkör alapú jogosultságkezelés](#18-rbac--szerepkör-alapú-jogosultságkezelés)
19. [CLI rendszer](#19-cli-rendszer)
20. [Biztonság és auditálás](#20-biztonság-és-auditálás)
21. [Google Workspace integráció](#21-google-workspace-integráció)
22. [Jelenlegi állapot és statisztikák](#22-jelenlegi-állapot-és-statisztikák)
23. [Összefoglalás és jövőkép](#23-összefoglalás-és-jövőkép)

---

## 1. Bevezetés és projektháttér

### 1.1 A projekt célja

A Brunella Agent System (BAS) egy hibrid, multi-ügynök mesterséges intelligencia rendszer, amelynek célja a szoftverfejlesztési, üzleti automatizálási és tudásmenedzsment feladatok autonóm elvégzése. A projekt mögött álló alapelv: **az AI nem eszköz, hanem partner** — olyan rendszer, amely az emberi kreativitással szimbiózisban képes 10-szeres produktivitásnövekedést elérni.

A projekt egyetlen fejlesztő munkájának eredménye, akinek célja egy olyan demonstrátort alkotni, amely megmutatja, milyen potenciál rejlik az ember-AI együttműködésben valós, üzleti problémák megoldásában.

### 1.2 Technológiai alapok

| Réteg | Technológia |
|-------|------------|
| Backend | Node.js, TypeScript ESM, Express 4, Socket.IO |
| Frontend | React 19, Vite, Tailwind CSS v4, Radix UI |
| Python alrendszer | FastAPI, Playwright, browser-use, LanceDB |
| LLM integráció | Ollama (lokális), Gemini, GitHub Models (GPT-4.1), Anthropic Claude, Cloudflare Workers AI |
| Protokoll | MCP (Model Context Protocol) — StdioServerTransport |
| Felhő | Cloudflare Workers, R2, D1, KV, Vectorize, AI Gateway |
| Adatbázis | SQLite (6 db), LanceDB (vektoros), ChromaDB |

### 1.3 Verziótörténet és fejlődés

A rendszer 2026 februárjától aktív fejlesztés alatt áll. Az első munkamenetek az alapinfrastruktúra kiépítésével foglalkoztak (DeveloperAgent, Dashboard, MCP), ezt követte a PAIOS Suite, a Swarm Architecture, a Universal Orchestrator, majd az üzleti ügynökök (könyvelés, logisztika, HR) beépítése. Jelenleg v2.4.0 verziónál tart.

---

## 2. Rendszerarchitektúra

### 2.1 Rendszerszintű áttekintés

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BRUNELLA AGENT SYSTEM v2.4.0                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  NODE.JS BACKEND│  │ PYTHON FASTAPI  │  │  DASHBOARD (React)  │  │
│  │  :3000 (HTTP)   │  │  :8000 (HTTP)   │  │  :5173 (Vite)       │  │
│  │  MCP StdIO      │  │  Playwright     │  │  Real-time UI       │  │
│  │  78 AI Agents   │  │  LanceDB        │  │  95 Panel           │  │
│  │  99 REST Routes │  │  browser-use    │  │  Socket.IO          │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                        │              │
│           └────────────────────┴────────────────────────┘              │
│                                │                                       │
│                    ┌───────────┴──────────┐                            │
│                    │  LLM PROVIDER LAYER  │                            │
│                    │  Bifrost Gateway     │                            │
│                    │  + Model Router      │                            │
│                    └──────────────────────┘                            │
│         ┌──────────┬──────────┬──────────┬──────────┬────────────┐   │
│         │ Ollama   │ Gemini   │ GitHub   │Anthropic │ Cloudflare │   │
│         │ (lokális)│ 2.5-Flash│ GPT-4.1  │ Sonnet   │ Workers AI │   │
│         └──────────┴──────────┴──────────┴──────────┴────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │            CLOUDFLARE EDGE (6 aktív Worker)                     │ │
│  │  AI Gateway │ Tunnel │ R2 │ D1 │ KV │ Vectorize │ DO           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Belépési pontok

| Belépési pont | Fájl | Leírás |
|--------------|------|--------|
| MCP + HTTP szerver | `src/index.ts` | Dual-mode: StdioServerTransport + Express |
| CLI | `src/cli.ts` | Commander.js, 239 parancs, interaktív menü |
| Dashboard | `src/dashboard/` | React 19 SPA, Vite |
| Python API | `myai/server.py` | FastAPI, browser automation |

### 2.3 Kommunikációs csatornák

A rendszer komponensei három fő csatornán kommunikálnak:

1. **HTTP REST** — Express 4, 99 mountolt route, Swagger dokumentáció
2. **WebSocket** — Socket.IO, valós idejű eseményközvetítés (agent státusz, Phoenix events, task frissítések)
3. **MCP StdIO** — Claude Desktop integráció, eszközregisztráció és végrehajtás

---

## 3. Backend alrendszer — Node.js/TypeScript

### 3.1 Technikai jellemzők

- **Runtime:** Node.js (v20+), TypeScript ESM (Node16 module resolution)
- **HTTP szerver:** Express 4, port 3000
- **WebSocket:** Socket.IO (valós idejű kommunikáció)
- **Modulrendszer:** Kizárólag ESM `.js` kiterjesztésekkel
- **Build:** `tsc` → `build/` mappa

### 3.2 Route-ok és API

Az összes route fájl (85 db) centrálisan van regisztrálva a `src/server/routes/index.ts`-ben, lazy-loading proxyn keresztül. A főbb API csoportok:

| API csoport | Prefix | Leírás |
|------------|--------|--------|
| Egészség | `/api/health` | Rendszer health check (Ollama, Python, CF, stb.) |
| Ügynökök | `/api/agents` | Ügynök listázás, végrehajtás |
| Orchestrator | `/api/orchestrator/universal` | Universal chat, multi-provider |
| PAIOS | `/api/paios/*` | Chat, státusz, konfiguráció |
| Kernel | `/api/v1/kernel` | 8 fázisú kernel pipeline |
| Swarm | `/api/v1/swarm/*` | Colony státusz, dispatch |
| Harvest | `/api/v1/harvest/*` | Data Flywheel pipeline |
| Track-ek | `/api/v1/tracks/*` | Conductor track kezelés |
| LLM | `/api/providers/status` | Provider státusz |
| Cloudflare | `/api/cloudflare/*` | Edge proxy |
| Robotkéz | `/api/robotkez/*` | Browser automatizálás |
| Könyvelés | `/api/bookkeeping/*` | Pénzügyi pipeline |
| RAG | `/api/rag/*` | Vektoros keresés, memória |
| Federation | `/api/federation/*` | Elosztott agent hálózat |

### 3.3 Startup sorrend és lazy-loading

A szerver `src/server/web.ts` fájlban inicializálódik:
1. HTTP szerver elindul (`startWebServer()`) → `/ping` azonnal elérhető
2. `deferredInit()` a nehéz inicializációra (adatbázisok, agent registry) — OOM-elkerülés
3. Route-ok lazy-loading proxyn keresztül töltődnek

### 3.4 Fontosabb core modulok

| Modul | Fájl | Funkció |
|-------|------|---------|
| Model Router | `src/core/modelRouter.ts` | Feladat-komplexitás alapú LLM routing |
| Bifrost Gateway | `src/core/bifrost_gateway.ts` | Multi-provider auto-fallback |
| Phoenix Protocol | `src/core/checkpoint.ts` + `phoenixEventBus.ts` | Öngyógyítás |
| Kernel Pipeline | `src/core/conductor.ts` | 8 fázisú supervisor |
| Event Bus | `src/core/eventBus.ts` | SQLite WAL-backed eseménybusz |
| Tool Registry | `src/core/toolRegistry.ts` | MCP tool auto-generálás registry.json-ból |
| Logger | `src/utils/logger.ts` | Strukturált naplózás |
| RAG Bridge | `src/core/goldenDatasetBridge.ts` | Agent memória LanceDB-ből |
| CEAN Fallback | `src/core/ceanFallback.ts` | Phoenix degraded → edge-only mód |

---

## 4. Python alrendszer — FastAPI

### 4.1 Áttekintés

A Python alrendszer (`myai/`) a böngésző-automatizálás, adatfeldolgozás és ML pipeline feladatait látja el. A `myai/server.py` FastAPI szervere a 8000-es porton fut.

### 4.2 Főbb komponensek

| Komponens | Fájl | Leírás |
|-----------|------|--------|
| FastAPI szerver | `myai/server.py` | REST API, Python code execution |
| Browser Worker | `myai/browser_worker.py` | Playwright + browser-use automatizálás |
| Refiner Logic | `myai/refiner_logic.py` | Adattisztítás, LLM összefoglalás, LanceDB |
| Knowledge Integrator | `myai/tools/knowledge_integrator.py` | Embeddings, deduplikáció, Golden Dataset |
| Harvest Pipeline | `myai/tools/harvest_pipeline.py` | End-to-end scraping → tárolás |
| Tech Harvester | `myai/agents/tech_harvester.py` | AI/tech forrásokból scraping |
| Pydantic modellek | `myai/pydantic_models.py` | Adat validációs sémák |

### 4.3 Python ügynökök (TOML-alapú)

A TOML-alapú dinamikus ügynökök a `myai/agents/*.toml` fájlokban definiáltak, és a Node.js oldalon `DynamicAgent` osztályon keresztül hajtódnak végre:

- `agent_architect.toml` — Új ügynöktervező
- `project_organizer.toml` — Projekt szervezés
- `CopywriterAgent.toml` — Szövegírás
- `copywriter_pro.toml` — Professzionális copywriting

### 4.4 Robotkéz Pro

A `myai/robotkez_pro/` alrendszer az autonóm böngéső-vezérlést valósítja meg:

- `main.py` — Uvicorn szerver (port 8090), Computer Use API
- `training_suite.py` — n8n workflow-builder training
- `myai/agents/comet/` — CometOrchestrator (x/y koordinátás kattintás, pyautogui)

**Comet szintek:**
1. Computer Use Auto (LLM-vezérelt)
2. Socket.IO valós idejű stream
3. n8n Workflow Auto-Builder
4. Dashboard Training Pipeline

---

## 5. Dashboard — React/Vite

### 5.1 Technikai alap

- **Framework:** React 19, Vite (port 5173)
- **UI könyvtár:** Radix UI, Tailwind CSS v4
- **Ikoncsomagok:** Lucide React, Phosphor Icons
- **Állapotkezelés:** React hooks, Context API
- **Valós idejű:** Socket.IO kliens
- **Build:** külön `tsconfig.ui.json` + `vite.config.ts`

### 5.2 Navigációs rendszer

Az összes (95) dashboard panel a `src/dashboard/lib/navigation.tsx` NavigationRegistry-ben van regisztrálva. A főbb panelcsoportok:

| Csoport | Leírás |
|---------|--------|
| AI & Agents | NeuralLink Chat, Agent Monitor, PAIOS Orchestrator, Swarm Status |
| Rendszer | Health Monitor, LLM Providers, Phoenix Events, Process Control |
| Track-ek | Track Generátor, Track Progress |
| Bevétel | Lead Mining, Sales Pipeline, Invoice Sync, Market Watcher |
| HR & Munka | Digital HR, KKV HR |
| Könyvelés | KP Pénztár, Bank Reconciliation |
| Fejlesztő | RAG Memory, Dev Studio, Harvest Pipeline |
| Robotkéz | RobotkezV2 Chat (3 tab: Chat, Gépi Vezérlés, DevTools) |

### 5.3 Főbb dashboard komponensek

| Komponens | Fájl | Funkció |
|-----------|------|---------|
| PAIOSOrchestratorChat | dashboard/PAIOSOrchestratorChat.tsx | Multi-provider orchestrator chat |
| NeuralLinkChat | dashboard/NeuralLinkChat.tsx | 7 chat mód, hangrögzítés |
| SystemHealthCard | dashboard/SystemHealthCard.tsx | 6 szolgáltatás health |
| AgentStatusMonitor | dashboard/AgentStatusMonitor.tsx | Ügynök futási státusz |
| PhoenixEventsPanel | dashboard/PhoenixEventsPanel.tsx | Phoenix recovery events |
| SwarmStatusWidget | dashboard/SwarmStatusWidget.tsx | Swarm colony monitor |
| PAIOSConfigDisplay | dashboard/PAIOSConfigDisplay.tsx | PAIOS konfiguráció megjelenítő |
| RobotkezV2Chat | dashboard/RobotkezV2Chat.tsx | 3 tab: chat/gépi vezérlés/devtools |
| ModelSelector | dashboard/ModelSelector.tsx | LLM provider váltó |

### 5.4 API Service réteg

A `src/dashboard/lib/apiService.ts` centralizált HTTP kliens az összes backend híváshoz, beleértve:
- Agent végrehajtás, task queue
- Harvest pipeline indítás/státusz
- Computer Use (screenshot, click, type)
- Robotkéz DevTools API
- Cloudflare edge státusz

---

## 6. Ügynökrendszer (Agent System)

### 6.1 Ügynök interfészek

A rendszer kétféle alapinterfészt támogat:

**1. IAgent (közvetlen)**
```typescript
interface IAgent {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  execute(task: string, context?: unknown): Promise<AgentResponse>;
}
```

**2. BaseAgent (Bridge Pattern)**
```typescript
abstract class BaseAgent implements IAgent {
  abstract executeTask(context: AgentContext): Promise<AgentResult>;
  // Automatikus finally: setAgentStatus(name, 'idle')
  // RAG memória auto-betöltés context.pastExperiences-ből
}
```

**3. DynamicAgent (TOML-alapú)**
Nem igényel TypeScript kódot; a TOML konfig `systemPrompt`, `queryTemplate` és `tags` mezőkből épül fel.

### 6.2 Ügynök hierarchia

```
OrchestratorAgent / EnterpriseOrchestratorAgent  (koordinátorok)
├── Core fejlesztői ügynökök
│   ├── DeveloperAgent      — kódgenerálás, Python futtatás, öngyógyítás
│   ├── EvaluatorAgent      — audit, review, hallucinációellenőrzés
│   ├── ResearcherAgent     — web keresés, információgyűjtés
│   ├── DataScientistAgent  — adattisztítás, LanceDB kezelés
│   ├── TaskDecomposer      — feladatbontás
│   └── ProjectConductor    — tracks.md szinkron, track menedzsment
│
├── Automatizálás
│   ├── RobotkezV2Agent     — Playwright/browser-use, Computer Use
│   └── VoiceAgent          — Whisper STT, OpenAI TTS
│
├── Engineering
│   ├── SpecWriterAgent     — spec generálás LLM-mel
│   ├── GenesisOrchestrator — projekt generálás (Genesis protokoll)
│   ├── LintFixerAgent      — automatikus ESLint javítás
│   ├── ArchitectAgent      — rendszerarchitektúra tervezés
│   └── AgentArchitect      — új ügynök tervező (TOML generálás)
│
├── Enterprise üzleti ügynökök (~20)
│   ├── FinanceGuardian     — Gmail + Sheets pénzügyi monitoring
│   ├── BankAgent           — banki kivonatok feldolgozása
│   ├── MatchingAgent       — számla-kifizetés párosítás
│   ├── NavAgent            — NAV XML validálás
│   ├── InvoiceAutomation   — Gmail → Drive → Sheets számla pipeline
│   ├── ReconciliationIngestion — banki normalizálás
│   ├── AdvancedMatching    — kognitív számlapárosítás
│   ├── MarketIntelAgent    — piaci intelligencia
│   ├── LeadMiningAgent     — lead gyűjtés
│   ├── CampaignGenerator   — marketing kampány
│   ├── MarketingDirector   — kampány orchestrator
│   ├── SalesAgent          — értékesítési pipeline
│   ├── DigitalHRAgent      — HR automatizálás
│   ├── LawDetectiveAgent   — Magyar Közlöny figyelés
│   ├── GrantHunterAgent    — pályázat kutatás
│   ├── PropertyVisionary   — ingatlan elemzés
│   ├── ConflictMediator    — szervezeti konfliktuskezelés
│   └── PropertyVisionary   — ingatlanpiaci elemzés
│
├── Scraping & Research
│   ├── ApifyScrapingAgent  — Google/LinkedIn/e-commerce scraping
│   ├── ChromeDevToolsAgent — CDP-alapú web debug
│   └── ResearcherAgent     — web keresés
│
├── Innovációs ügynökök
│   ├── InnovationBridgeAgent — TRIZ keresztipar tudástranszfer
│   └── LawDetectiveAgent   — jogi compliance figyelés
│
├── Swarm alrendszer
│   ├── SwarmManager        — colony életciklus vezénylés
│   └── SwarmAgent          — végrehajtó swarm ügynök
│
├── Edge / Cloudflare
│   ├── EdgeProxyAgent      — Cloudflare Worker proxy
│   └── GitHubModelsAgent   — multi-iterációs tool execution loop
│
└── Meta / Infrastruktúra
    ├── ProjectMaintainerAgent — napi karbantartás, log rotáció
    └── DynamicAgent           — TOML-alapú általános ügynök
```

### 6.3 Ügynök registry

Az összes ügynök központilag a `src/agents/registry.json` fájlban van regisztrálva. Minden bejegyzés tartalmaz:
- `name` — azonosító
- `module` / `class` — TypeScript osztály
- `triggers` — routing kulcsszavak
- `capabilities` — képességek listája
- `priority` — 1-10 (routing súlyozáshoz)
- `category` — `core` | `enterprise` | `engineering` | `marketing` | `finance` | stb.

**Statisztika (2026-03-25 audit):** 78 bejegyzett ügynök.

### 6.4 AgentManager és Task Queue

Az `AgentManager` (`src/agents/AgentManager.ts`) felelős:
- Ügynök registry betöltéséért (`initialize()`)
- Task queue kezeléséért (SQLite `tasks.db`)
- Phoenix auto-retry végrehajtásáért (`executeWithRecovery()`)
- Edge konfig kezeléséért (`getEdgeStatus()`)

**Confidence-alapú routing:**
```bash
node scripts/copilot-route.js "feladat"  # → { bestAgent, confidence }
# confidence >= 0.7 → delegálás; < 0.7 → közvetlen végrehajtás
```

---

## 7. LLM Provider réteg és Bifrost Gateway

### 7.1 Provider áttekintés

| Provider | Modell | Env változó | Használat |
|---------|--------|-------------|-----------|
| **GitHub Models** | `gpt-4.1` | `GITHUB_PAT` | Elsődleges agy, erős reasoning |
| **Gemini** | `gemini-2.5-flash` | `GEMINI_API_KEY` | Alternatív agy |
| **Anthropic** | `claude-sonnet-4-*` | `ANTHROPIC_API_KEY` | Komplex elemzés |
| **Ollama** | `qwen2.5-coder:7b` | `OLLAMA_BASE_URL` | Lokális, alacsony költségű |
| **Cloudflare** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `CF_API_TOKEN` | Edge inference |

### 7.2 Bifrost Gateway

A `src/core/bifrost_gateway.ts` multi-provider gateway auto-fallback lánccal:

```
GitHub Models (gpt-4.1)
    │
    ├─ hiba/timeout → Gemini (gemini-2.5-flash)
    │                      │
    │                      ├─ hiba → Anthropic (claude-sonnet)
    │                      │              │
    │                      │              └─ hiba → Ollama (lokális)
    │
    └─ fast task → Cloudflare Workers AI
```

**Gateway funkcionalitás:**
- `generate()` / `chat()` egységes interfész
- `GatewayMode` váltás: `local-preferred` | `cloud-first` | `edge-only`
- Tool call formátumok: OpenAI, Anthropic `tool_use`, GitHub Models OpenAI format

### 7.3 Model Router

A `src/core/modelRouter.ts` feladatkomplexitás alapján irányít:

| Szabály | Modell | Konfiguráció |
|---------|--------|-------------|
| RULE-MR1: `complexity: 'high'` | Cloud LLM (Gemini/GPT-4.1) | Brain modell |
| RULE-MR2: `complexity: 'low'` | Ollama qwen2.5-coder:7b | Muscle modell |
| RULE-MR3: `budget: 0` | Ollama | Ingyenes végrehajtás |
| RULE-MR4: `fast` task | Cloudflare Workers AI | Edge inference |

### 7.4 Universal Orchestrator

A `src/core/universalOrchestratorService.ts` egyetlen chat felületet biztosít, amely:
- 78 ügynököt + 12 CF Worker-t = 69 eszközt irányít
- Magyar rendszerpromptot használ
- Tool call végrehajtást végez
- `[DELEGÁLÁS:]` regex fallback Qwen-hez

---

## 8. MCP (Model Context Protocol) szerverek

### 8.1 Aktív MCP szerverek

Az `mcp_servers.json` konfigurálja a 15 MCP szervert. Az aktívak:

| Szerver | Leírás | Transport |
|---------|--------|-----------|
| **brunella-core** | Saját backend (önreferencia) | StdIO |
| **brunella-remote** | Távoli HTTP FastMCP szerver | HTTP |
| **filesystem** | Fájlrendszer hozzáférés | StdIO |
| **csharp-mcp-server** | Windows automation | StdIO |
| **workspace-mcp-server** | uv-managed munkaterület | StdIO |
| **memory** | Kulcs-érték memória | StdIO |
| **sequential-thinking** | Lépésenkénti gondolkodás | StdIO |
| **github** | GitHub API (Docker) | HTTP |
| **chrome-devtools** | Chrome DevTools Protocol | WebSocket |
| **playwright** | Böngésző automatizálás | StdIO |
| **windows_automation_bridge** | Windows GUI vezérlés | StdIO |

**Letiltott:**
- `sqlite`, `vscode-mcp`, `copilot-mcp`, `brunella-self-improve`

### 8.2 Brunella-core MCP eszközök

A `src/tools/` mappában 37 MCP tool fájl van, összesen ~53 eszköz definícióval. A fontosabbak:

| Eszközcsoport | Eszközök |
|--------------|---------|
| Ügynök delegálás | `agent_delegate`, `agent_execute` |
| LLM generálás | `ollama_generate`, `gemini_generate`, `github_models_generate` |
| Böngésző | `harvest_scenario`, `harvest_extract`, `browser_navigate`, `browser_screenshot` |
| Swarm | `swarm_dispatch`, `swarm_status` |
| Memória/RAG | `rag_search`, `rag_store` |

### 8.3 Tool Permission Map

Az eszközök hozzáférése ügynök-szerepkörhöz kötött (`src/tools/toolPermissions.ts`):

| Eszköz | Szükséges jogosultság |
|--------|----------------------|
| `harvest_scenario` / `harvest_extract` | `BROWSER_CONTROL + HTTP_REQUEST` |
| `browser_navigate` | `BROWSER_CONTROL + HTTP_REQUEST` |
| `sqlite_query` | `DB_READ` |
| `sqlite_execute` | `DB_WRITE` |

---

## 9. Adatbázis-réteg

### 9.1 SQLite adatbázisok

| Adatbázis | Fájl | Tartalom |
|-----------|------|---------|
| **Fő rendszer** | `brunella.db` | Általános rendszeradatok |
| **Task queue** | `tasks.db` | Agent feladat sor, státuszok |
| **Checkpoints** | `checkpoints.db` | Phoenix Protocol mentési pontok |
| **Audit** | `audit.db` | Hozzáférési napló, RBAC esemény |
| **CEAN** | `cean.db` | Cloudflare Edge Agent Network adatai |
| **COMET memória** | `comet_memory.db` | Browser automatizálás memória |

### 9.2 LanceDB (vektoros)

A `data/brunella_lancedb/` mappában a következő vektortáblák találhatók:
- `memory` — agent általános memória
- `memory_v2` / `memory_v3` — fejlettebb memória verziók
- `tech_trends` — Tech Harvester által gyűjtött AI/tech trendek

A LanceDB-t a `myai/refiner_logic.py` írja és a `src/core/goldenDatasetBridge.ts` olvassa (RAG keresés).

### 9.3 Golden Dataset

Az instruction tuning adatbázis (`myai/incubator/training_data.jsonl`) JSONL formátumban tárolja a tanítási mintákat:

```json
{
  "instruction": "What are the latest AI developments?",
  "input": "",
  "output": "Based on recent findings...",
  "metadata": {"source": "GitHub Trending", "timestamp": "..."}
}
```

**Jelenlegi méret (2026-03-25):** ~1431 minta.

### 9.4 Cloudflare D1

A Cloudflare oldalon két D1 SQLite adatbázis fut:
- `brunella-tasks` — felhőalapú task tracking
- `brunella-agents` — agent metaadat

---

## 10. Phoenix Protocol — öngyógyítás

### 10.1 Alapelv

A Phoenix Protocol garantálja, hogy egyetlen ügynökhibát sem veszít el a rendszer. Ha egy ügynök végrehajtása meghiúsul, automatikusan újraindul, a mentési pontokból helyreáll, és az állapota konzisztenssé válik.

### 10.2 Folyamat

```
Ügynök futás
    │
    ├─ Siker → Checkpoint frissítés ("completed")
    │
    └─ Hiba → Checkpoint ("failed") + PhoenixEventBus emit
                   │
                   └─ AgentManager auto-retry:
                       1s delay → újrapróbálkozás #1
                       3s delay → újrapróbálkozás #2
                       10s delay → újrapróbálkozás #3
                           │
                           ├─ Siker → "completed"
                           └─ Végleges hiba → logolás + CEAN edge fallback
```

### 10.3 Komponensek

| Komponens | Fájl | Funkció |
|-----------|------|---------|
| Checkpoint Manager | `src/core/checkpoint.ts` | SQLite checkpoint CRUD |
| Phoenix Event Bus | `src/core/phoenixEventBus.ts` | Typed 10-event bus |
| CEAN Fallback | `src/core/ceanFallback.ts` | Edge-only mód degradált állapotban |
| SocketService bridge | `src/server/SocketService.ts` | Phoenix events → Dashboard |

### 10.4 PAIOS konfiguráció

```yaml
phoenix:
  retry_max_attempts: 3
  retry_base_delay_ms: 1000
  checkpoint_interval_ms: 30000   # 30s
  heartbeat_interval_ms: 5000     # 5s
```

### 10.5 Phoenix eseménytípusok

A 10 típusú Phoenix esemény (`phoenixEventBus.ts`):
`phoenix:recovery`, `phoenix:restart`, `phoenix:state_restored`, `phoenix:checkpoint_saved`, `phoenix:agent_failed`, `phoenix:failover_triggered`, `phoenix:failover_result`, `phoenix:degraded`, `phoenix:edge_health`, `phoenix:circuit_breaker`

---

## 11. Data Flywheel — önfejlesztő tanulási pipeline

### 11.1 Koncepció

A Data Flywheel egy önfejlesztő tudásfelhasználási kör: a rendszer folyamatosan adatot gyűjt, finomít, indexel, majd a finomított tudást saját döntéseibe integrálja.

```
Harvest (tech_harvester.py)
    ↓
Refine (refiner_logic.py + knowledge_integrator.py)
    ↓
Index (LanceDB vektortábla + Golden Dataset JSONL)
    ↓
Learn (goldenDatasetBridge.ts → agent RAG)
    ↓
Execute (OrchestratorAgent RAG-enhanced döntések)
```

### 11.2 Harvest fázis

A `myai/agents/tech_harvester.py` a következő forrásokból gyűjt adatot:

| Forrás | Kulcsszavak |
|--------|------------|
| GitHub Trending AI | MCP, Agent, Orchestrator |
| Vercel AI SDK Docs | AI SDK, Agent, Streaming |
| LangChain Blog | Agent, LangGraph, Multi-Agent |
| HuggingFace Daily Papers | LLM, Fine-tuning, RAG |
| Anthropic Developer Docs | Claude, Tool Use |

**Két mód:**
- **Playwright** (alapértelmezett) — CSS selector-alapú scraping
- **Browser-Use** (intelligens) — LangChain + Ollama LLM természetes nyelvű végrehajtás

### 11.3 Refine fázis

A `myai/tools/knowledge_integrator.py` lépései:
1. Pydantic validáció (HarvestItem séma)
2. LLM összefoglalás (Ollama qwen2.5-coder:latest)
3. Embedding generálás (Ollama API)
4. Deduplikáció (koszinusz-hasonlóság, küszöb: 0.85)
5. LanceDB tárolás (RAG)
6. Golden Dataset bővítés (JSONL)

### 11.4 CLI parancsok

```bash
brunella harvest run       # Teljes pipeline futtatás
brunella harvest status    # Utolsó harvest összegzés
```

---

## 12. Kernel Pipeline — 8 fázisú szupervisor

### 12.1 Architektúra

A `src/core/conductor.ts` Kernel Pipeline a legmagasabb szintű feladatfelügyelő. Minden kérés 8 fázison megy keresztül:

```
IntentRouter
    ↓
Planner
    ↓
ContextBuilder
    ↓
ToolExecutor
    ↓
Critic
    ↓
Guardrail
    ↓
LearningLoop
    ↓
[ResponseAssembler]
```

### 12.2 Technikai részletek

- **Megosztott kontextus:** `RunEnvelope` (minden modulnak látható)
- **Modul interfész:** `ModuleResponse<T>`
- **Eseménybusz:** `src/core/kernelEventBus.ts` — 10-esemény typed bus
- **REST:** `POST /api/v1/kernel`
- **Teljesítmény:** Minden modul lazy-importált, max 2 retry per modul
- **Auditálás:** `RunLedger` tárolja az utolsó 50 futást

---

## 13. Conductor Track System — projektvezénylés

### 13.1 Track életciklus

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

Minden track a `conductor/tracks/<track-id>/` mappában van, legalább:
- `meta.json` — azonosító, státusz, progress, fázisok
- `plan.md` — checklistek, fázis tervek
- `spec.md` — elfogadási kritériumok (opcionális)

### 13.2 Jelenlegi állapot (2026-04-08)

| Státusz | Darab |
|---------|-------|
| Összes track | ~220 |
| Aktív | ~15 |
| Befejezett | ~24 |
| Archivált | ~179 |

**Aktív track csoportok:**
- Könyvelés/üzleti (6 track): n8n pipeline, Phase 3 szamlazz.hu, KKV HR
- Nova asszisztens (5 track): Nova_Assiss helyi fejlesztés, knowledge workflows
- Brunella rendszer: logistics vertical, p-search
- Egyéb: Google Workspace OAuth, Remote Layer

### 13.3 ProjectConductor Agent

A `ProjectConductorAgent` automatikusan szinkronizálja a `conductor/tracks.md` fájlt:
- Track-ek listázása és státuszfrissítés
- Anomália keresés (orphan fájlok, nagy fájlok, elavult dokumentáció)
- Napi összefoglaló generálás
- Service health monitoring

### 13.4 CLI parancsok

```bash
brunella conductor status      # Projekt státusz
brunella conductor sync        # tracks.md szinkronizálás
brunella conductor health      # Rendszer health check
brunella tracks generate       # Új track LLM-alapú generálás
brunella tracks list           # Track-ek táblázatban
brunella tracks view <id>      # Track tartalom
```

---

## 14. SDLC Pipeline — fejlesztési életciklus

### 14.1 5 fázisú pipeline

Minden conductor track automatikusan kap egy 5 fázisú SDLC blokkot (`meta.json` → `sdlc.enabled: true`):

| Fázis | Ügynök | Kötelező kimenet |
|-------|--------|----------------|
| 1. `architect` | ArchitectAgent | `phases/1-architect.md` — spec, pszeudokód, adatmodell |
| 2. `devops` | DevOpsAgent | `phases/2-devops.md` — env, függőségek, build |
| 3. `coder` | DeveloperAgent | `phases/3-coder.md` — implementáció |
| 4. `qa` | EvaluatorAgent | `phases/4-qa.md` — tesztek, debug |
| 5. `reviewer` | LintFixerAgent | `phases/5-reviewer.md` — refaktor, EPP v2 review |

### 14.2 EPP v2 — Engineering Precision Protocol

A fejlesztési protokoll 7 aranyszabálya:
1. Minden feature = új track
2. Hibák javítása azonnali
3. Commit gyakran, kis logikus egységekben
4. TODO lista folyamatos frissítése
5. `npm run build` + `npm run test:fast` kötelező commit előtt
6. Minden új funkció = **Dashboard panel + CLI parancs** (mindkettő kötelező!)
7. Track lezárásakor: teljes dokumentáció + `sync_foszal.py`

### 14.3 CLI vezérlés

```bash
brunella sdlc status|run|reset <trackId>
brunella sdlc phase <trackId> <phase>
```

---

## 15. Cloudflare Edge infrastruktúra

### 15.1 Deployed Workers (6 aktív)

| Worker | URL | Funkció |
|--------|-----|---------|
| bas-cloudflare-orchestrator | *.workers.dev | MCP + Task routing + AI auto-routing |
| bas-cloudflare-browser-proxy | *.workers.dev | Browser-Use callback webhook |
| bas-cloudflare-n8n-webhook | *.workers.dev | n8n automation callback |
| bas-cloudflare-kv-adapter | *.workers.dev | KV storage CRUD |
| bas-cloudflare-d1-adapter | *.workers.dev | D1 SQLite CRUD |
| bas-cloudflare-webhook-manager | *.workers.dev | Unified webhook routing |

### 15.2 Infrastruktúra-szolgáltatások

| Szolgáltatás | Leírás |
|-------------|--------|
| **AI Gateway** | Cache, rate limit, fallback lánc (Workers AI → Ollama → külső API-k) |
| **Tunnel** | brunella.pohanka.cloud — Ollama (:11434) + FastAPI (:8000) + Dashboard (:5173) |
| **R2** | Object Storage: brunella-cache, brunella-artifacts |
| **D1** | SQLite: brunella-tasks, brunella-agents |
| **KV** | Key-Value: brunella-kv-prod |
| **Vectorize** | Embeddings: brunella-vectors (768 dim, koszinusz) |
| **Durable Objects** | brunella-sessions (WebSocket állapot) |

### 15.3 CEAN Workers (tervezett)

A Cloudflare Edge Agent Network (CEAN) 4 implementált Worker-rel rendelkezik a `workers/` mappában:
- `cean-router` — AI Gateway, Llama-3.3-70b-instruct routing
- `cean-harvest` — Scheduled harvest (6 óránként), GitHub Trending + HN Best
- `cean-research` — ResearcherAgent edge fallback
- `cean-refine` — DataScientistAgent edge fallback

### 15.4 Cloudflare integrációs logika (Node.js oldalon)

A `src/core/bifrost_gateway.ts` `cloudflare` providerként kezeli a Workers AI-t:
- `AI_GATEWAY_ENABLED=true` szükséges az aktiváláshoz
- `CF_API_TOKEN` a hitelesítéshez
- Cloudflare Dashboard-on létrehozni: `brunella-gateway` AI Gateway

---

## 16. PAIOS — Péter AI Operating System

### 16.1 Koncepció

A PAIOS (Péter AI Operating System) a Brunella Agent System operációs rendszer szintű rétege: egységes konfiguráció, orchestrator chat, modellválasztó és monitoring.

### 16.2 Komponensek

| Komponens | Fájl | Funkció |
|-----------|------|---------|
| Unified Config | `paios.config.yaml` + `src/config/paiosConfig.ts` | Zod-validált YAML konfiguráció |
| Orchestrator Chat | `src/orchestrator/orchestratorCore.ts` | Multi-LLM chat, agent delegálás |
| PAIOS API | `src/server/routes/paiosOrchestrator.ts` | REST: `/api/paios/chat`, `/api/paios/status` |
| Dashboard Chat | `PAIOSOrchestratorChat.tsx` | 5 provider selector, Action Bubble UI |
| Config Display | `PAIOSConfigDisplay.tsx` | Konfiguráció read-only viewer |
| Voice | `src/dashboard/hooks/useTTS.ts` | OpenAI TTS Nova hang |

### 16.3 PAIOS konfiguráció (`paios.config.yaml`)

```yaml
orchestrator:
  default_model: github          # gpt-4.1
  max_tasks_per_request: 5
  concurrency:
    profile: balanced
    max_concurrent_tasks: 3

voice:
  response_voice: nova
  tts_model: tts-1
  speed: 1.0

dashboard:
  base_url: http://localhost:5173
  chat_panel_enabled: true
  phoenix_events_enabled: true
  model_selector_enabled: true
```

### 16.4 NeuralLink Chat módok

A NeuralLink Chat 7 módot támogat:
1. `master_orchestrator` — EnterpriseOrchestratorAgent
2. `orchestrator` — OrchestratorAgent
3. `ollama` — közvetlen Ollama
4. `github` — GitHub Models GPT-4.1
5. `gemini` — Gemini 2.5 Flash
6. `cloudflare` — Cloudflare Workers AI
7. `cloudflare_chat` — CF chat proxy

---

## 17. Swarm Architecture — raj-alapú végrehajtás

### 17.1 Alapelv

A Swarm Architecture párhuzamos, elosztott végrehajtást tesz lehetővé: több SwarmAgent egy SwarmColony-ban dolgozik, amelyet a SwarmManager koordinál.

### 17.2 Komponensek

| Komponens | Fájl | Funkció |
|-----------|------|---------|
| SwarmManager | `src/agents/swarm/SwarmManager.ts` | Colony életciklus, pause/resume |
| SwarmColony | `src/agents/swarm/SwarmColony.ts` | Párhuzamos ügynök csoport |
| Swarm Tools | `src/tools/swarmTools.ts` | `swarm_dispatch`, `swarm_status` |
| Swarm Routes | `src/server/routes/swarm.ts` | REST: `/api/v1/swarm/*` |
| SwarmStatusWidget | dashboard/SwarmStatusWidget.tsx | 5s polling, badge-ek |

### 17.3 Colony státuszok

`active` → `forming` → `paused` → `dissolved`

### 17.4 CLI parancsok

```bash
brunella swarm status
brunella swarm dispatch --colony <colonyId>
```

---

## 18. RBAC — szerepkör alapú jogosultságkezelés

### 18.1 Permission profilok

A `src/agents/permissions.ts` 6 profilt definiál:

| Profil | Path-ok | Jogosultságok |
|--------|---------|---------------|
| `ADMIN` | `**` | Összes |
| `DEVELOPER` | `src/**`, `test/**` | READ, WRITE, DB, GIT, HTTP |
| `RESEARCHER` | (olvasás) | READ, HTTP |
| `EVALUATOR` | `src/**`, `test/**` | READ, DB_READ |
| `ROBOTKEZ` | `data/**`, `scenarios/**` | READ, WRITE, BROWSER, HTTP |
| `READONLY` | (olvasás) | READ |

### 18.2 Audit naplózás

Minden megtagadott művelet az `audit.db` adatbázisba kerül (`src/core/auditLog.ts`).

### 18.3 Federation Manifest Signing

Az `src/core/federation/capabilityManifest.ts` megköveteli a `MANIFEST_SIGNING_SECRET`-et (min. 32 karakter), nincs alapértelmezett fallback.

---

## 19. CLI rendszer

### 19.1 Áttekintés

A CLI (`src/cli.ts`) Commander.js alapú, 239 paranccsal, interaktív menürendszerrel (inquirer.js + figlet ASCII banner).

### 19.2 Főmenü kategóriák

```
BRUNELLA CLI
├─ 🤖 Ügynökök (10 parancs)
├─ 📋 Track-ek (8 parancs)
├─ 💬 Chat & AI (6 parancs)
├─ 🧪 Tesztek & Minőség (15 parancs)
├─ 🔧 Rendszer & Infrastruktúra (22 parancs)
└─ ⚙️ Beállítások (10 parancs)
```

### 19.3 Fontosabb parancsok

```bash
# Általános
brunella                          # Interaktív menü
brunella chat                     # Universal orchestrator chat
brunella agents                   # Ügynök lista
brunella run <tool>               # MCP tool futtatás

# Conductor
brunella conductor status
brunella tracks generate/list/view

# Harvest
brunella harvest run/status

# Swarm
brunella swarm status/dispatch

# Developer
brunella dev generate/test/fix/heal/review/refactor/context/metrics

# SDLC
brunella sdlc status|run|reset|phase <trackId>

# Git
brunella git status/diff/commit/push/branches/checkout/log
```

### 19.4 Copilot Dashboard Bridge

Szerver nélküli gyors műveletek:
```bash
node scripts/copilot-dashboard.js tracks list
node scripts/copilot-dashboard.js agents execute <name> "<task>"
node scripts/copilot-route.js "feladat"     # Agent routing (confidence)
```

---

## 20. Biztonság és auditálás

### 20.1 BAS Security Sandbox

A `src/security/` mappában az E2B Sandbox Manager és Safe Zone Validator biztosítja az ügynökvégrehajtás izolációját:

| Komponens | Fájl | Funkció |
|-----------|------|---------|
| E2B Sandbox | `src/security/e2b_sandbox_manager.ts` | Izolált végrehajtási környezet |
| Safe Zone Validator | `src/security/safe_zone_validator.ts` | Útvonal és scope validálás |
| Security Events Monitor | `src/core/securityEventsMonitor.ts` | 7 eseménytípus, alert rules |
| Worker Thread Pool | `src/core/workerThreadPool.ts` | Izolált Worker Thread végrehajtás |

### 20.2 Security Events Monitor

7 eseménytípus:
- `permission_denied`, `sandbox_escape_attempt`, `worker_crash`
- `anomalous_execution`, `policy_violation`
- `resource_quota_exceeded`, `suspicious_pattern`

4 severity szint: `low`, `medium`, `high`, `critical`

### 20.3 EvaluatorAgent guardrails

Az EvaluatorAgent `checkHallucination()` metódusa három szabályt érvényesít:
- **RULE-G1:** Forrás nélküli tény-állítás detektálás
- **RULE-G2:** Konfidencia score ellenőrzés (küszöb: 0.6)
- **RULE-G3:** URL validáció (HTTP HEAD request)

---

## 21. Google Workspace integráció

### 21.1 Két hitelesítési mód

| Mód | Env változók | Fájl | Alkalmazás |
|-----|-------------|------|-----------|
| Service account | `GOOGLE_CREDENTIALS_FILE` | `credentials/google-service-account.json` | Automatizált pipeline |
| OAuth interaktív | `GOOGLE_WORKSPACE_CREDENTIALS_FILE` + `GOOGLE_WORKSPACE_TOKEN_FILE` | `credentials/` | Felhasználói hozzáférés |

### 21.2 Főbb integrációk

| Integráció | Ügynök/Modul | Leírás |
|-----------|-------------|--------|
| Gmail | InvoiceAutomation, FinanceGuardian | Számla letöltés, e-mail feldolgozás |
| Google Drive | InvoiceAutomation | Számla archiválás |
| Google Sheets | InvoiceAutomation, WF-5 KP Pénztár | Könyvelési adatok szinkronizálás |
| Google Calendar | n8n Workflow | Munkaidő, szabadság sync |
| Gemini Vision | invoice_ocr_demo.py | Számla OCR |

### 21.3 InvoiceAutomation Agent képességei

- Gmail olvasás (számlák szűrése)
- Gemini Vision alapú adatkinyerés
- Google Drive mentés (szervezett mappastruktúrában)
- Google Sheets rögzítés (automatikus sorok hozzáadása)

---

## 22. Jelenlegi állapot és statisztikák

### 22.1 Rendszerstatisztikák (2026-03-25 audit)

| Metrika | Érték |
|---------|-------|
| Regisztrált AI ügynökök | **78** |
| Route modulok (`src/server/routes/`) | **85** |
| Aktív route mountok | **99** |
| MCP tool fájlok (`src/tools/`) | **37** |
| CLI parancs deklarációk | **239** |
| Dashboard navigációs panelek | **95** |
| Conductor tracks (összes) | **~220** |
| Tesztek (utolsó futtatás) | **1748 PASS, 0 FAIL** |
| SQLite adatbázisok | **6** |
| LanceDB vektortáblák | **6** |
| Golden Dataset minták | **~1431** |
| Ollama lokális modellek | **18** |
| Cloudflare Workers (aktív) | **6** |
| MCP szerverek (konfig) | **15** |

### 22.2 Aktív fejlesztési területek (2026-04-08)

| Track csoport | Prioritás | Leírás |
|--------------|-----------|--------|
| Könyvelési pipeline Phase 3 | HIGH | szamlazz.hu integráció, WF-6..9 |
| Nova_Assiss helyi fejlesztés | HIGH | Phase 3-5 (multiagent, gatekeeper) |
| KKV HR szabadság-jóváhagyás | MEDIUM | HR workflow automatizálás |
| Logistics vertical | MEDIUM | Logisztikai irányítóközpont |
| Google Workspace OAuth demo | MEDIUM | OAuth flow demonstráció |

### 22.3 Funkcionális állapot

| Alrendszer | Státusz |
|-----------|--------|
| Node.js backend (port 3000) | ✅ Stabil |
| Python FastAPI (port 8000) | ✅ Stabil |
| React Dashboard (port 5173) | ✅ Stabil |
| Ollama lokális LLM | ✅ Aktív (18 modell) |
| GitHub Models (GPT-4.1) | ✅ Aktív |
| Gemini API | ✅ Aktív |
| Cloudflare Edge (6 Worker) | ✅ Deployed |
| Phoenix Protocol | ✅ Aktív öngyógyítás |
| Data Flywheel | ✅ Működőképes |
| Universal Orchestrator | ✅ Production-ready |
| Swarm Architecture | ✅ 1 aktív colony |
| Google Workspace | ✅ SA + OAuth |

---

## 23. Összefoglalás és jövőkép

### 23.1 Elért eredmények

A Brunella Agent System jelenleg egy teljes körű, production-ready multi-agent AI platform, amely:

1. **78 specializált AI ügynökkel** lefedi a fejlesztői, üzleti, automatizálási és kutatási feladatok széles körét
2. **5 LLM provider auto-fallback lánccal** biztosítja a folyamatos rendelkezésre állást
3. **Phoenix Protocol** segítségével öngyógyítóképes — egyetlen ügynökhiba sem blokkolja a folyamatokat
4. **Data Flywheel** révén folyamatosan tanul és bővíti tudásbázisát
5. **Cloudflare Edge** infrastruktúrán skálázható felhős képességekkel rendelkezik
6. **EPP v2** fejlesztési protokoll garantálja a kódminőséget és a teljes Dashboard+CLI integrációt
7. **RBAC** jogosultságrendszer védi az ügynökök közötti határokat
8. **95 dashboard panellel** valós idejű átláthatóságot biztosít

### 23.2 A rendszer küldetése

> *"Olyan rendszert alkotni, amit a mesterséges intelligencia és az ember képességei egymást erősítve olyan termelékenységet és innovációs átalakulást ér el, ami elősegíti az AI képét pozitív megítélésre, és az ember gondolkodásának megváltoztatására is hatással van."*
>
> — Pohánka Péter, projekttulajdonos

A Brunella Agent System nem egy chatbot prototípus, hanem egy valódi demonstrátor arra, hogy az ember-AI együttműködés képes valódi problémákat megoldani, valódi értéket teremteni — és ezt megtenni etikusan, átláthatóan, fenntartható módon.

### 23.3 Tervezett fejlesztések

| Területi irány | Leírás |
|---------------|--------|
| Remote Layer Phase 8-9 | Planet-scale elosztott architektúra, emergent superintelligence réteg |
| Könyvelési pipeline teljesítés | szamlazz.hu, NAV valós idejű, teljes automatizálás |
| Nova_Assiss integrálás | Multiagent gatekeeper, knowledge workflows |
| Fine-tuning pipeline | Golden Dataset → Ollama fine-tune |
| Logistics vertical | Teljes logisztikai irányítóközpont |

---

## MELLÉKLETEK

### A. Fontosabb fájlstruktúra

```
F:\mcp-brunella-core\
├── src/
│   ├── agents/          # 78 AI ügynök
│   │   ├── types.ts     # IAgent, AgentResponse interfészek
│   │   ├── registry.json # Ügynök registry
│   │   ├── permissions.ts # RBAC
│   │   ├── BaseAgent.ts   # Bridge Pattern alaposztály
│   │   └── *.ts          # Ügynök implementációk
│   ├── server/
│   │   ├── web.ts        # Express szerver főfájl
│   │   ├── routes/       # 85 route fájl
│   │   └── registry.ts   # MCP + agent regisztráció
│   ├── core/
│   │   ├── bifrost_gateway.ts    # Multi-provider LLM
│   │   ├── modelRouter.ts        # Routing döntések
│   │   ├── conductor.ts          # Kernel Pipeline
│   │   ├── checkpoint.ts         # Phoenix Protocol
│   │   ├── eventBus.ts           # SQLite WAL Events
│   │   └── universalOrchestratorService.ts
│   ├── tools/            # 37 MCP tool fájl
│   ├── dashboard/        # React UI
│   │   ├── components/dashboard/  # 95 panel komponens
│   │   └── lib/navigation.tsx     # Navigáció registry
│   ├── utils/
│   │   ├── logger.ts     # Strukturált naplózás
│   │   └── rag.ts        # LanceDB RAG
│   └── index.ts          # MCP + Express belépési pont
├── myai/
│   ├── server.py         # FastAPI szerver
│   ├── browser_worker.py # Playwright automatizálás
│   ├── refiner_logic.py  # Adatfeldolgozás
│   ├── agents/           # Python + TOML ügynökök
│   └── tools/            # Pipeline eszközök
├── conductor/
│   ├── tracks.md         # Aktív track-ek
│   ├── tracks/           # Track részletek
│   └── archive/          # Archivált track-ek
├── workers/              # Cloudflare Edge Workers
├── data/
│   └── brunella_lancedb/ # Vektortáblák
├── docs/                 # Részletes dokumentációk
├── .ai/                  # Ügynök munkasession naplók
│   ├── FOSZAL.md         # Egyesített napló
│   ├── claude.md         # Claude session napló
│   ├── gemini.md         # Gemini session napló
│   └── BOOTSTRAP.md      # Bootstrap protokoll
├── paios.config.yaml     # PAIOS unified konfig
├── mcp_servers.json      # MCP szerver konfigurációk
└── RENDSZER.md           # Ez a dokumentum
```

### B. Kulcsszótár

| Fogalom | Magyarázat |
|---------|------------|
| **BAS** | Brunella Agent System |
| **PAIOS** | Péter AI Operating System |
| **MCP** | Model Context Protocol |
| **EPP v2** | Engineering Precision Protocol v2 |
| **CEAN** | Cloudflare Edge Agent Network |
| **Bifrost** | Multi-provider LLM gateway |
| **Phoenix** | Öngyógyító protokoll |
| **Data Flywheel** | Önfejlesztő tanulási kör |
| **TOML agent** | TOML fájlból definiált DynamicAgent |
| **Golden Dataset** | Instruction tuning JSONL adatbázis |
| **Track** | Fejlesztési egység (conductor rendszer) |
| **Colony** | Swarm ügynökök csoportja |
| **RAG** | Retrieval-Augmented Generation |
| **FOSZAL** | Főszál — egyesített munkasession napló |

---

*Ez a dokumentum a Brunella Agent System v2.4.0 állapotát írja le (2026-04-08). A rendszer aktív fejlesztés alatt áll; a technikai részletek az újabb verziókban változhatnak.*

**Készítette:** Claude Code (claude-sonnet-4-6)  
**Tulajdonos:** Pohánka Péter  
**Licenc:** Belső dokumentáció — nem publikus
