# 🏗️ BRUNELLA AGENT SYSTEM - TELJES ARCHITEKTÚRA DIAGRAM

**Generálva:** 2026-02-14
**Verzió:** 2.3.0
**Állapot:** Production-ready

---

## 📊 NAGY KÉP - Teljes Rendszer Topológia

```mermaid
graph TB
    subgraph "🖥️ USER LAYER"
        USER[👨‍💻 Felhasználó<br/>Kreatív/Stratégiai]
        CLI[💻 CLI<br/>brunella chat/agents/conductor]
        DASHBOARD[🎨 Dashboard<br/>React UI :5173]
    end

    subgraph "🧠 NODE.JS BACKEND - Port 3000"
        EXPRESS[⚡ Express Server<br/>REST API + Socket.IO]
        MCP_SERVER[📡 MCP Server<br/>StdioServerTransport]
        ORCHESTRATOR[🎯 OrchestratorAgent<br/>Top-level Planner]

        subgraph "14 AI AGENTS"
            DEV[💻 DeveloperAgent<br/>Code Gen/Test/Fix]
            EVAL[🔍 EvaluatorAgent<br/>Audit/Review]
            RESEARCH[🔬 ResearcherAgent<br/>Web Search/RAG]
            DATA_SCI[📊 DataScientistAgent<br/>Data Processing]
            SPEC[📝 SpecWriterAgent<br/>Auto Spec Gen]
            CONDUCTOR[📋 ProjectConductor<br/>Track Management]
            EDGE_PROXY[☁️ EdgeProxyAgent<br/>CF Routing]
            ROBOTKEZ[🤖 RobotkezAgent<br/>Browser Auto]
            VOICE[🎤 VoiceAgent<br/>Speech/Whisper]
            LINT[🔧 LintFixerAgent<br/>Auto Lint Fix]
            DEP_GRAPH[📈 DependencyGraphAgent<br/>Dep Analysis]
            PYTHON_AGENT[🐍 PythonAgent<br/>Python Monitor]
            DOCS_INTEL[📖 DocsIntelligence<br/>Docs Check]
            TASK_DECOMP[🧩 TaskDecomposer<br/>Task Breakdown]
        end

        subgraph "50+ API ROUTES"
            ROUTES_AGENTS[/agents/execute]
            ROUTES_TRACKS[/tracks/generate]
            ROUTES_CF[/cloudflare/task]
            ROUTES_ROBOTKEZ[/robotkez/execute]
            ROUTES_HEALTH[/health]
        end

        AGENT_MANAGER[🎛️ AgentManager<br/>Registry + Dispatcher]
        TASK_QUEUE[📥 Task Queue<br/>SQLite]
    end

    subgraph "🐍 PYTHON BACKEND - Port 8000"
        FASTAPI[⚡ FastAPI Server<br/>REST API]

        subgraph "PYTHON AGENTS & TOOLS"
            TECH_HARVEST[🌐 Tech Harvester<br/>Web Scraping]
            KNOWLEDGE_INT[🧠 Knowledge Integrator<br/>LLM Summary]
            HARVEST_PIPE[🔄 Harvest Pipeline<br/>End-to-End]
            BROWSER_WORKER[🖱️ Browser Worker<br/>Playwright/Browser-Use]
            REFINER[🔧 Data Refiner<br/>Cleaning + Validation]
        end

        MCP_PYTHON[📡 Python MCP Server]
    end

    subgraph "🗄️ DATA LAYER"
        LANCEDB[(🗃️ LanceDB<br/>Vector RAG)]
        SQLITE[(💾 SQLite<br/>Task Queue/Audit)]
        CHROMADB[(🔵 ChromaDB<br/>Optional RAG)]
        GOLDEN_DS[📊 Golden Dataset<br/>training_data.jsonl]
        SCENARIOS[📄 Scenarios<br/>n8n/browser JSON]
    end

    subgraph "🤖 LOCAL LLM - Port 11434"
        OLLAMA[🦙 Ollama<br/>18 models]
        MODELS[llama3.1:8b<br/>qwen2.5-coder<br/>deepseek-coder<br/>mistral]
    end

    subgraph "🌐 EXTERNAL LLM"
        GEMINI[💎 Gemini 2.0<br/>Google Cloud]
        GITHUB_MODELS[🐙 GitHub Models<br/>GPT-4o/o1-preview]
        CLAUDE_API[🧠 Claude API<br/>Sonnet 4.5]
    end

    subgraph "☁️ CLOUDFLARE EDGE"
        CF_WORKER[⚡ Workers<br/>bas-orchestrator]
        CF_D1[(🗃️ D1 SQLite<br/>bas-metadata)]
        CF_R2[(📦 R2 Storage<br/>vodor1)]
        CF_KV[(🔑 KV Cache<br/>BAS_TASKS)]
        CF_AI[🤖 Workers AI<br/>LLM Inference]
        SWARM_COORD[🐝 Swarm Coordinator<br/>Multi-worker]
    end

    subgraph "🔗 EXTERNAL SERVICES"
        GITHUB[🐙 GitHub<br/>Jules AI/PRs]
        N8N[🔄 n8n<br/>Workflow Automation]
        LANGSMITH[📊 LangSmith<br/>LLM Tracing]
        LANCEDB_CLOUD[☁️ LanceDB Cloud<br/>Remote RAG]
    end

    subgraph "📋 PROJECT MANAGEMENT"
        CONDUCTOR_DIR[📁 conductor/<br/>Track System]
        TRACKS_MD[📄 tracks.md<br/>Master Index]
        EPP_V2[📖 epp-v2.md<br/>7 Golden Rules]
        WORKFLOW_MD[🔄 workflow.md<br/>Data Flywheel]
        AI_DIR[📁 .ai/<br/>Agent Logs]
        FOSZAL[📄 FOSZAL.md<br/>Unified Log]
    end

    subgraph "🤖 JULES AI"
        JULES[🧑‍💼 Jules AI<br/>Autonomous Dev]
        JULES_SESSIONS[📊 .Jules/sessions.json<br/>Session Tracking]
        GITHUB_ACTIONS[⚙️ GitHub Actions<br/>Auto-runs]
    end

    %% USER → INTERFACES
    USER --> CLI
    USER --> DASHBOARD

    %% CLI/DASHBOARD → BACKEND
    CLI --> EXPRESS
    CLI --> MCP_SERVER
    DASHBOARD --> EXPRESS

    %% EXPRESS → ROUTES
    EXPRESS --> ROUTES_AGENTS
    EXPRESS --> ROUTES_TRACKS
    EXPRESS --> ROUTES_CF
    EXPRESS --> ROUTES_ROBOTKEZ
    EXPRESS --> ROUTES_HEALTH

    %% ROUTES → AGENTS
    ROUTES_AGENTS --> AGENT_MANAGER
    ROUTES_TRACKS --> SPEC
    ROUTES_CF --> EDGE_PROXY
    ROUTES_ROBOTKEZ --> ROBOTKEZ

    %% AGENT MANAGER → ORCHESTRATOR
    AGENT_MANAGER --> ORCHESTRATOR
    AGENT_MANAGER --> TASK_QUEUE

    %% ORCHESTRATOR → AGENTS
    ORCHESTRATOR --> DEV
    ORCHESTRATOR --> EVAL
    ORCHESTRATOR --> RESEARCH
    ORCHESTRATOR --> DATA_SCI
    ORCHESTRATOR --> SPEC
    ORCHESTRATOR --> CONDUCTOR
    ORCHESTRATOR --> EDGE_PROXY
    ORCHESTRATOR --> ROBOTKEZ
    ORCHESTRATOR --> VOICE
    ORCHESTRATOR --> LINT
    ORCHESTRATOR --> DEP_GRAPH
    ORCHESTRATOR --> PYTHON_AGENT
    ORCHESTRATOR --> DOCS_INTEL
    ORCHESTRATOR --> TASK_DECOMP

    %% AGENTS → LLM
    DEV --> OLLAMA
    DEV --> GEMINI
    DEV --> GITHUB_MODELS
    SPEC --> OLLAMA
    RESEARCH --> OLLAMA

    %% AGENTS → PYTHON BACKEND
    ROBOTKEZ --> FASTAPI
    DATA_SCI --> FASTAPI
    PYTHON_AGENT --> FASTAPI

    %% PYTHON BACKEND → TOOLS
    FASTAPI --> TECH_HARVEST
    FASTAPI --> KNOWLEDGE_INT
    FASTAPI --> HARVEST_PIPE
    FASTAPI --> BROWSER_WORKER
    FASTAPI --> REFINER

    %% PYTHON TOOLS → DATA
    TECH_HARVEST --> LANCEDB
    KNOWLEDGE_INT --> LANCEDB
    KNOWLEDGE_INT --> GOLDEN_DS
    REFINER --> LANCEDB
    BROWSER_WORKER --> SCENARIOS

    %% DATA FLYWHEEL
    TECH_HARVEST --> REFINER
    REFINER --> KNOWLEDGE_INT
    KNOWLEDGE_INT --> RESEARCH
    RESEARCH --> ORCHESTRATOR

    %% PYTHON TOOLS → LLM
    TECH_HARVEST --> OLLAMA
    KNOWLEDGE_INT --> OLLAMA

    %% EDGE PROXY → CLOUDFLARE
    EDGE_PROXY --> CF_WORKER
    CF_WORKER --> CF_D1
    CF_WORKER --> CF_R2
    CF_WORKER --> CF_KV
    CF_WORKER --> CF_AI
    CF_WORKER --> SWARM_COORD

    %% CLOUDFLARE → EXTERNAL
    CF_WORKER --> GITHUB
    CF_WORKER --> N8N

    %% AGENTS → EXTERNAL SERVICES
    DEV --> LANGSMITH
    RESEARCH --> LANCEDB_CLOUD
    ROBOTKEZ --> N8N

    %% CONDUCTOR → PROJECT MGMT
    CONDUCTOR --> CONDUCTOR_DIR
    CONDUCTOR --> TRACKS_MD
    CONDUCTOR --> EPP_V2
    CONDUCTOR --> WORKFLOW_MD
    CONDUCTOR --> AI_DIR
    CONDUCTOR --> FOSZAL

    %% JULES AI → GITHUB
    JULES --> GITHUB
    JULES --> JULES_SESSIONS
    GITHUB_ACTIONS --> JULES
    GITHUB --> EXPRESS

    %% MCP SERVER → AGENTS
    MCP_SERVER --> AGENT_MANAGER

    classDef userLayer fill:#e1f5ff,stroke:#0288d1,stroke-width:3px
    classDef nodeBackend fill:#fff3e0,stroke:#ff6f00,stroke-width:3px
    classDef pythonBackend fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px
    classDef dataLayer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px
    classDef llmLayer fill:#fff9c4,stroke:#f57f17,stroke-width:3px
    classDef cloudflare fill:#e0f2f1,stroke:#00695c,stroke-width:3px
    classDef external fill:#fce4ec,stroke:#c2185b,stroke-width:3px
    classDef mgmt fill:#efebe9,stroke:#5d4037,stroke-width:3px
    classDef jules fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px

    class USER,CLI,DASHBOARD userLayer
    class EXPRESS,MCP_SERVER,ORCHESTRATOR,DEV,EVAL,RESEARCH,DATA_SCI,SPEC,CONDUCTOR,EDGE_PROXY,ROBOTKEZ,VOICE,LINT,DEP_GRAPH,PYTHON_AGENT,DOCS_INTEL,TASK_DECOMP,AGENT_MANAGER,TASK_QUEUE,ROUTES_AGENTS,ROUTES_TRACKS,ROUTES_CF,ROUTES_ROBOTKEZ,ROUTES_HEALTH nodeBackend
    class FASTAPI,TECH_HARVEST,KNOWLEDGE_INT,HARVEST_PIPE,BROWSER_WORKER,REFINER,MCP_PYTHON pythonBackend
    class LANCEDB,SQLITE,CHROMADB,GOLDEN_DS,SCENARIOS dataLayer
    class OLLAMA,MODELS,GEMINI,GITHUB_MODELS,CLAUDE_API llmLayer
    class CF_WORKER,CF_D1,CF_R2,CF_KV,CF_AI,SWARM_COORD cloudflare
    class GITHUB,N8N,LANGSMITH,LANCEDB_CLOUD external
    class CONDUCTOR_DIR,TRACKS_MD,EPP_V2,WORKFLOW_MD,AI_DIR,FOSZAL mgmt
    class JULES,JULES_SESSIONS,GITHUB_ACTIONS jules
```

---

## 🔄 DATA FLYWHEEL PIPELINE (Self-Learning Loop)

```mermaid
graph LR
    A[1️⃣ HARVEST<br/>Tech Sources<br/>GitHub/Vercel/LangChain] --> B[2️⃣ REFINE<br/>Data Cleaning<br/>Validation]
    B --> C[3️⃣ INDEX<br/>LanceDB<br/>Vector Embeddings]
    C --> D[4️⃣ LEARN<br/>RAG Query<br/>ResearcherAgent]
    D --> E[5️⃣ EXECUTE<br/>OrchestratorAgent<br/>Task Completion]
    E --> F{Feedback Loop}
    F -->|New insights| A
    F -->|Completed| G[📊 Golden Dataset<br/>Fine-tuning Data]

    style A fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff
    style B fill:#ff9800,stroke:#e65100,stroke-width:2px,color:#fff
    style C fill:#2196f3,stroke:#0d47a1,stroke-width:2px,color:#fff
    style D fill:#9c27b0,stroke:#4a148c,stroke-width:2px,color:#fff
    style E fill:#f44336,stroke:#b71c1c,stroke-width:2px,color:#fff
    style F fill:#ffeb3b,stroke:#f57f00,stroke-width:3px
    style G fill:#00bcd4,stroke:#006064,stroke-width:2px,color:#fff
```

**Működés:**
1. **Harvest** - `tech_harvester.py` scrape-eli az AI/Tech forrásokat (6 source)
2. **Refine** - `refiner_logic.py` tisztítja és validálja az adatokat
3. **Index** - `knowledge_integrator.py` LLM summaryt készít + LanceDB embedding
4. **Learn** - `ResearcherAgent` RAG query-vel keresi a releváns tudást
5. **Execute** - `OrchestratorAgent` végrehajtja a feladatot az új tudással
6. **Feedback** - Sikeres execution után új adatok kerülnek vissza a Harvest-be

---

## 🤖 AGENT HIERARCHIA & KAPCSOLATOK

```mermaid
graph TD
    ORG[🎯 OrchestratorAgent<br/>TOP-LEVEL PLANNER]

    subgraph "CODE AGENTS"
        DEV[💻 DeveloperAgent<br/>Gen/Test/Fix]
        EVAL[🔍 EvaluatorAgent<br/>Audit/Review]
        LINT[🔧 LintFixerAgent<br/>Auto Lint]
        DEP[📈 DependencyGraph<br/>Dep Analysis]
    end

    subgraph "RESEARCH & DATA"
        RES[🔬 ResearcherAgent<br/>Web/RAG Search]
        DATA[📊 DataScientist<br/>Processing]
        DOCS[📖 DocsIntelligence<br/>Docs Check]
    end

    subgraph "PROJECT MANAGEMENT"
        SPEC[📝 SpecWriter<br/>Auto Spec Gen]
        COND[📋 ProjectConductor<br/>Track Mgmt]
        TASK[🧩 TaskDecomposer<br/>Breakdown]
    end

    subgraph "AUTOMATION"
        ROBOT[🤖 RobotkezAgent<br/>Browser Auto]
        EDGE[☁️ EdgeProxy<br/>CF Routing]
        VOICE[🎤 VoiceAgent<br/>Speech]
        PY[🐍 PythonAgent<br/>Monitor]
    end

    ORG --> DEV
    ORG --> EVAL
    ORG --> RES
    ORG --> DATA
    ORG --> SPEC
    ORG --> COND
    ORG --> ROBOT
    ORG --> EDGE
    ORG --> VOICE
    ORG --> LINT
    ORG --> DEP
    ORG --> PY
    ORG --> DOCS
    ORG --> TASK

    DEV --> EVAL
    DEV --> LINT
    RES --> DATA
    SPEC --> COND
    ROBOT --> EDGE

    style ORG fill:#e91e63,stroke:#880e4f,stroke-width:4px,color:#fff
    style DEV fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff
    style EVAL fill:#ff9800,stroke:#e65100,stroke-width:2px,color:#fff
    style RES fill:#2196f3,stroke:#0d47a1,stroke-width:2px,color:#fff
    style DATA fill:#9c27b0,stroke:#4a148c,stroke-width:2px,color:#fff
    style SPEC fill:#00bcd4,stroke:#006064,stroke-width:2px,color:#fff
    style COND fill:#ffc107,stroke:#f57f00,stroke-width:2px,color:#000
    style ROBOT fill:#795548,stroke:#3e2723,stroke-width:2px,color:#fff
    style EDGE fill:#607d8b,stroke:#263238,stroke-width:2px,color:#fff
```

---

## ☁️ CLOUDFLARE EDGE INFRASTRUCTURE

```mermaid
graph TB
    subgraph "LOCAL BRUNELLA"
        LOCAL[🖥️ Local Backend<br/>Express :3000]
        EDGE_AGENT[☁️ EdgeProxyAgent<br/>Task Router]
    end

    subgraph "CLOUDFLARE WORKERS"
        WORKER[⚡ bas-orchestrator.iam-dd1.workers.dev<br/>Main Worker]
        SWARM[🐝 Swarm Coordinator<br/>Multi-worker Mgmt]
        WORKER_2[⚡ Worker 2]
        WORKER_3[⚡ Worker 3]
    end

    subgraph "CLOUDFLARE DATA"
        D1[(🗃️ D1 Database<br/>bas-metadata<br/>SQLite)]
        R2[(📦 R2 Storage<br/>vodor1<br/>Zero-egress)]
        KV[(🔑 KV Namespace<br/>BAS_TASKS<br/>Cache)]
    end

    subgraph "CLOUDFLARE AI"
        CF_AI[🤖 Workers AI<br/>@cf/meta/llama-2-7b<br/>LLM Inference]
    end

    EDGE_AGENT -->|POST /task| WORKER
    WORKER --> SWARM
    SWARM --> WORKER_2
    SWARM --> WORKER_3

    WORKER --> D1
    WORKER --> R2
    WORKER --> KV
    WORKER --> CF_AI

    WORKER -->|Result| LOCAL

    style LOCAL fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style EDGE_AGENT fill:#607d8b,stroke:#263238,stroke-width:2px,color:#fff
    style WORKER fill:#00bcd4,stroke:#006064,stroke-width:3px,color:#fff
    style SWARM fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff
    style WORKER_2 fill:#00bcd4,stroke:#006064,stroke-width:2px,color:#fff
    style WORKER_3 fill:#00bcd4,stroke:#006064,stroke-width:2px,color:#fff
    style D1 fill:#2196f3,stroke:#0d47a1,stroke-width:2px,color:#fff
    style R2 fill:#ff9800,stroke:#e65100,stroke-width:2px,color:#fff
    style KV fill:#9c27b0,stroke:#4a148c,stroke-width:2px,color:#fff
    style CF_AI fill:#f44336,stroke:#b71c1c,stroke-width:2px,color:#fff
```

**Edge Features:**
- ✅ **Zero Cold Start** - Workers instant startup
- ✅ **Global Distribution** - 300+ PoPs worldwide
- ✅ **Zero Egress Cost** - R2 storage
- ✅ **Serverless SQL** - D1 database
- ✅ **Workers AI** - Built-in LLM inference

---

## 🧑‍💼 JULES AI INTEGRATION

```mermaid
graph LR
    subgraph "LOCAL DEV"
        LOCAL_CODE[💻 Local Codebase<br/>F:\mcp-brunella-core]
        SYNC[🔄 GitHub Sync<br/>scripts/sync.bat]
    end

    subgraph "GITHUB"
        REPO[🐙 GitHub Repo<br/>main branch]
        ACTIONS[⚙️ GitHub Actions<br/>Auto-triggers]
        PR[📬 Pull Requests<br/>Jules PR-ek]
    end

    subgraph "JULES AI"
        JULES[🧑‍💼 Jules AI<br/>Autonomous Dev]
        SESSIONS[📊 Sessions<br/>.Jules/sessions.json]
        MEMORY[🧠 Memory<br/>Past work context]
    end

    LOCAL_CODE -->|git push| REPO
    REPO -->|trigger| ACTIONS
    ACTIONS -->|invoke| JULES
    JULES -->|100 sessions/day| SESSIONS
    JULES -->|learns from| MEMORY
    JULES -->|creates| PR
    PR -->|auto-merge| REPO
    REPO -->|git pull| SYNC
    SYNC --> LOCAL_CODE

    style LOCAL_CODE fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style REPO fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style ACTIONS fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style JULES fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#fff
    style SESSIONS fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style MEMORY fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style PR fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style SYNC fill:#e0f2f1,stroke:#00695c,stroke-width:2px
```

**Jules Workflow:**
1. **GitHub Actions trigger** - Scheduled (daily) vagy manual
2. **Jules AI activation** - Autonomous coding session (1-4 óra)
3. **PR Creation** - Jules hozza létre a PR-t branch-el
4. **Auto-merge** - Ha tesztek pass, auto-approve + merge
5. **Local pull** - `scripts/sync.bat` pull-olja a Jules változásokat

---

## 📋 TRACK RENDSZER (Conductor)

```mermaid
stateDiagram-v2
    [*] --> PROPOSED: Új ötlet
    PROPOSED --> ACTIVE: Jóváhagyva
    ACTIVE --> IN_PROGRESS: Fejlesztés kezdődik
    IN_PROGRESS --> TESTING: Implementáció kész
    TESTING --> IN_PROGRESS: Bug found
    TESTING --> COMPLETED: Minden teszt pass
    COMPLETED --> ARCHIVED: 30+ nap inaktivitás
    PROPOSED --> ARCHIVED: Elutasítva
    ACTIVE --> ARCHIVED: Meghaladott

    note right of PROPOSED
        spec.md létrehozva
        meta.json: status="proposed"
    end note

    note right of ACTIVE
        meta.json: status="active"
        Fejlesztő hozzárendelve
    end note

    note right of IN_PROGRESS
        meta.json: progress > 0
        Commit-ok történnek
    end note

    note right of TESTING
        meta.json: status="testing"
        EPP v2 compliance check
    end note

    note right of COMPLETED
        meta.json: progress=100
        status="completed"
        Merge megtörtént
    end note

    note right of ARCHIVED
        conductor/archive/
        meta.json: status="archived"
    end note
```

**EPP v2 - 7 Arany Szabály:**
1. 🎯 **Track Required** - Nincs kódírás track nélkül
2. 🐛 **Fix Bugs** - Hibák azonnal javítandók
3. 💾 **Commit Often** - Major lépés = commit
4. ☑️ **TODO List** - Checkbox lista kötelező
5. ✅ **All Tests Green** - Build ✅ + Test ✅ 100%
6. 🎨 **Dashboard + CLI** - ⚠️ Mindkettő kötelező!
7. 📝 **Final Docs** - .ai frissítés + sync_foszal.py

---

## 🗺️ MCP KAPCSOLATOK

```mermaid
graph TB
    subgraph "MCP CLIENT (Brunella)"
        CLI_MCP[💻 CLI - MCP Client]
        DESKTOP[🖥️ Claude Desktop]
    end

    subgraph "MCP SERVERS"
        BAS_SERVER[📡 Brunella MCP Server<br/>src/index.ts<br/>:stdio]
        PYTHON_SERVER[🐍 Python MCP Server<br/>myai/mcp_server.py]
        SQLITE_SERVER[💾 SQLite MCP<br/>@modelcontextprotocol/server-sqlite]
        DOCKER_SERVER[🐳 Docker MCP<br/>@modelcontextprotocol/server-docker]
        GITHUB_SERVER[🐙 GitHub MCP<br/>@modelcontextprotocol/server-github]
    end

    subgraph "MCP TOOLS (50+)"
        AGENT_EXEC[agent_execute]
        AGENT_DELEGATE[agent_delegate]
        OLLAMA_GEN[ollama_generate]
        GEMINI_GEN[gemini_generate]
        GITHUB_GEN[github_models_generate]
        BROWSER_TOOLS[browser_navigate<br/>browser_screenshot<br/>harvest_scenario<br/>harvest_extract]
        FILE_TOOLS[read_file<br/>write_file<br/>list_files]
        DB_TOOLS[sqlite_query<br/>sqlite_execute]
    end

    CLI_MCP --> BAS_SERVER
    DESKTOP --> BAS_SERVER

    BAS_SERVER --> AGENT_EXEC
    BAS_SERVER --> AGENT_DELEGATE
    BAS_SERVER --> OLLAMA_GEN
    BAS_SERVER --> GEMINI_GEN
    BAS_SERVER --> GITHUB_GEN
    BAS_SERVER --> BROWSER_TOOLS
    BAS_SERVER --> FILE_TOOLS

    PYTHON_SERVER --> DB_TOOLS
    SQLITE_SERVER --> DB_TOOLS

    style CLI_MCP fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style DESKTOP fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
    style BAS_SERVER fill:#4caf50,stroke:#2e7d32,stroke-width:3px,color:#fff
    style PYTHON_SERVER fill:#2196f3,stroke:#0d47a1,stroke-width:2px,color:#fff
    style SQLITE_SERVER fill:#9c27b0,stroke:#4a148c,stroke-width:2px,color:#fff
    style DOCKER_SERVER fill:#00bcd4,stroke:#006064,stroke-width:2px,color:#fff
    style GITHUB_SERVER fill:#f44336,stroke:#b71c1c,stroke-width:2px,color:#fff
```

**MCP Server Config (mcp_servers.json):**
- 11 MCP server regisztrálva
- StdioServerTransport (default)
- Tool registry 50+ eszköz

---

## 📂 KÖNYVTÁR FÜGGŐSÉGEK

```mermaid
graph LR
    ROOT[🏠 Gyökér]

    ROOT --> SRC[src/<br/>Node.js Backend]
    ROOT --> MYAI[myai/<br/>Python Backend]
    ROOT --> CONDUCTOR[conductor/<br/>Track System]
    ROOT --> AI_DIR[.ai/<br/>Agent Logs]
    ROOT --> GITHUB_DIR[.github/<br/>CI/CD]
    ROOT --> JULES[.Jules/<br/>Jules Sessions]
    ROOT --> BAS_CF[bas-cloudflare-orchestrator/<br/>Edge Workers]
    ROOT --> CF[cloudflare/<br/>Edge Deploy]
    ROOT --> DOCS[docs/<br/>Documentation]
    ROOT --> TEST[test/<br/>Vitest Tests]
    ROOT --> SCRIPTS[scripts/<br/>Automation]
    ROOT --> EXT_RES[external_research/<br/>15+ libs]
    ROOT --> OPEN_INT[open-interpreter/<br/>Integration]

    SRC --> AGENTS[agents/<br/>14 agents]
    SRC --> TOOLS[tools/<br/>MCP tools]
    SRC --> SERVER[server/<br/>Express API]
    SRC --> DASHBOARD[dashboard/<br/>React UI]
    SRC --> CLI[cli.ts<br/>CLI Entry]

    MYAI --> PY_AGENTS[agents/<br/>Python agents]
    MYAI --> PY_TOOLS[tools/<br/>Python tools]
    MYAI --> BACKEND[backend/<br/>FastAPI]
    MYAI --> SCENARIOS[scenarios/<br/>n8n/browser]

    CONDUCTOR --> TRACKS[tracks/<br/>25+ active]
    CONDUCTOR --> ARCHIVE[archive/<br/>20+ archived]
    CONDUCTOR --> EPP[epp-v2.md<br/>7 Rules]

    style ROOT fill:#e91e63,stroke:#880e4f,stroke-width:4px,color:#fff
    style SRC fill:#ff9800,stroke:#e65100,stroke-width:3px,color:#fff
    style MYAI fill:#4caf50,stroke:#2e7d32,stroke-width:3px,color:#fff
    style CONDUCTOR fill:#2196f3,stroke:#0d47a1,stroke-width:3px,color:#fff
```

---

## 🎯 DEPLOYMENT ARCHITECTURE

```mermaid
graph TB
    subgraph "DEVELOPMENT"
        LOCAL_DEV[💻 Local Dev<br/>Windows PC]
        GIT[🐙 Git<br/>Version Control]
    end

    subgraph "CI/CD"
        GITHUB_ACTIONS[⚙️ GitHub Actions<br/>Automated Tests]
        BUILD[🔨 Build Pipeline<br/>npm run build]
        TEST[🧪 Test Pipeline<br/>npm test]
    end

    subgraph "STAGING"
        EDGE_STAGING[☁️ CF Workers<br/>Staging Env]
    end

    subgraph "PRODUCTION"
        EDGE_PROD[☁️ CF Workers<br/>Production]
        LOCAL_PROD[🖥️ Local Server<br/>:3000 + :8000]
    end

    LOCAL_DEV -->|git push| GIT
    GIT -->|trigger| GITHUB_ACTIONS
    GITHUB_ACTIONS --> BUILD
    BUILD --> TEST
    TEST -->|pass| EDGE_STAGING
    EDGE_STAGING -->|approved| EDGE_PROD
    LOCAL_DEV -->|npm run dev| LOCAL_PROD

    style LOCAL_DEV fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style GIT fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style GITHUB_ACTIONS fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style BUILD fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    style TEST fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style EDGE_STAGING fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style EDGE_PROD fill:#4caf50,stroke:#2e7d32,stroke-width:3px,color:#fff
    style LOCAL_PROD fill:#ff9800,stroke:#e65100,stroke-width:2px,color:#fff
```

---

## 📊 TECHNOLÓGIAI STACK ÖSSZEFOGLALÓ

| Layer | Technológia | Komponens |
|-------|-------------|-----------|
| **Frontend** | React 19 + Vite | Dashboard UI |
| **UI Library** | Radix UI + Tailwind v4 | Component library |
| **Backend** | Node.js 20 + Express 5 | REST API + Socket.IO |
| **Language** | TypeScript 5.3+ | Type-safe code |
| **MCP** | @modelcontextprotocol/sdk | Multi-agent protocol |
| **Python** | Python 3.12 + FastAPI | Data processing |
| **Browser** | Playwright + Browser-Use | Web automation |
| **Vector DB** | LanceDB 0.23+ | RAG embeddings |
| **Cache** | SQLite + Cloudflare KV | Local + Edge cache |
| **Edge** | Cloudflare Workers | Serverless compute |
| **Local LLM** | Ollama | 18 models |
| **External LLM** | Gemini 2.0, GPT-4o, Claude | Cloud AI |
| **Workflow** | n8n | Automation |
| **Testing** | Vitest 1.0+ | Unit + Integration |
| **CI/CD** | GitHub Actions | Automated pipeline |
| **AI Agent** | Jules AI | Autonomous dev |

---

## 🔐 SECURITY & PERMISSIONS

```mermaid
graph TB
    subgraph "AGENT RBAC"
        PERM_SYSTEM[🛡️ Permission System<br/>src/agents/permissions.ts]

        subgraph "PERMISSION PROFILES"
            DEV_PERM[💻 Developer<br/>READ/WRITE src/**<br/>GIT_OPS]
            RESEARCH_PERM[🔬 Researcher<br/>READ ONLY<br/>HTTP_REQUEST]
            ROBOT_PERM[🤖 Robotkez<br/>BROWSER_CONTROL<br/>data/**]
            EVAL_PERM[🔍 Evaluator<br/>READ ONLY<br/>src/** test/**]
        end

        subgraph "PATH RESTRICTIONS"
            SRC_PATH[src/**]
            DATA_PATH[data/**]
            CONDUCTOR_PATH[conductor/**]
        end
    end

    subgraph "TOOL PERMISSIONS"
        TOOL_PERM[🔧 Tool Permission Map<br/>src/tools/toolPermissions.ts]

        HARVEST_TOOL[harvest_scenario<br/>BROWSER_CONTROL]
        BROWSER_NAV[browser_navigate<br/>BROWSER_CONTROL]
        SQLITE_EXEC[sqlite_execute<br/>DB_WRITE]
    end

    PERM_SYSTEM --> DEV_PERM
    PERM_SYSTEM --> RESEARCH_PERM
    PERM_SYSTEM --> ROBOT_PERM
    PERM_SYSTEM --> EVAL_PERM

    DEV_PERM --> SRC_PATH
    ROBOT_PERM --> DATA_PATH

    TOOL_PERM --> HARVEST_TOOL
    TOOL_PERM --> BROWSER_NAV
    TOOL_PERM --> SQLITE_EXEC

    style PERM_SYSTEM fill:#f44336,stroke:#b71c1c,stroke-width:3px,color:#fff
    style DEV_PERM fill:#4caf50,stroke:#2e7d32,stroke-width:2px,color:#fff
    style RESEARCH_PERM fill:#2196f3,stroke:#0d47a1,stroke-width:2px,color:#fff
    style ROBOT_PERM fill:#ff9800,stroke:#e65100,stroke-width:2px,color:#fff
    style EVAL_PERM fill:#9c27b0,stroke:#4a148c,stroke-width:2px,color:#fff
```

**Permission Features:**
- ✅ Role-Based Access Control (RBAC)
- ✅ Path-based restrictions
- ✅ Tool-level permissions
- ✅ Audit logging for denied operations

---

## 📈 PROJEKT MÉRETARÁNYOK

| Metrika | Érték | Megjegyzés |
|---------|-------|------------|
| **Összes fájl** | 55,517 | Brutális projekt méret |
| **TypeScript fájlok** | 200+ | src/ + test/ |
| **Python fájlok** | 100+ | myai/ |
| **React komponensek** | 50+ | Dashboard UI |
| **AI Ügynökök** | 14 TS + Python | Multi-agent system |
| **MCP Tools** | 50+ | Registered tools |
| **API Endpoints** | 50+ | REST API routes |
| **Tests** | 471 | 99%+ pass rate |
| **Tesztfutási idő** | 60-90s | Full test suite |
| **Build idő** | 10-15s | TypeScript compile |
| **Aktív tracks** | 25+ | Fejlesztési szálak |
| **Archivált tracks** | 20+ | Lezárt szálak |
| **External research** | 15+ | Integrált könyvtárak |
| **Dokumentáció (sorok)** | 122,000+ | README, CLAUDE, docs/ |
| **Git commits** | 500+ | Aktív fejlesztés |
| **Cloudflare Workers** | 3+ | Edge deployment |
| **LLM models (local)** | 18 | Ollama models |

---

**Összefoglalás:** A Brunella Agent System egy **nagyon komplex, multi-layer, multi-agent AI orchestration platform** lokális és cloud LLM-ekkel, teljes Cloudflare Edge infrastruktúrával, autonóm Jules AI integrációval, és self-learning Data Flywheel pipeline-nal. A projekt **production-ready**, jól dokumentált, és folyamatos fejlesztés alatt áll 25+ aktív track-kel.
