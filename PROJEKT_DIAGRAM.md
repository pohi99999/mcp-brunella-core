# Brunella Agent System - Projekt Diagram

**Utolsó frissítés:** 2026-03-25
**Verzió:** 2.4.0

---

## 🏗️ Rendszer Architektúra (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BRUNELLA AGENT SYSTEM (BAS)                  │
│                      Multi-Agent Architecture                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼───────┐           ┌──────▼──────┐
        │  FRONTEND UI  │           │   BACKEND   │
        │   (React)     │           │  (Node.js)  │
        └───────┬───────┘           └──────┬──────┘
                │                           │
    ┌───────────┴───────────┐      ┌────────┴─────────┐
    │                       │      │                  │
┌───▼───┐            ┌──────▼──┐  ├──────┐  ┌────────▼─────┐
│ Vite  │            │Socket.IO│  │ MCP  │  │ Agent Manager│
│Server │            │Realtime │  │Server│  │  Orchestrator│
│:5173  │            │Events   │  │:stdio│  │              │
└───────┘            └─────────┘  └──────┘  └──────┬───────┘
                                                    │
                                        ┌───────────┴──────────┐
                                        │                      │
                                ┌───────▼────────┐   ┌────────▼──────┐
                                │ PYTHON BACKEND │   │  AGENT LAYER  │
                                │   (FastAPI)    │   │  (54 Agents)  │
                                │    :8000       │   │               │
                                └────────────────┘   └───────────────┘
```

---

## 🔄 Kommunikációs Protokollok

### 1. **Frontend ↔ Backend**
- **Socket.IO** (WebSocket) - Real-time events
- **REST API** (HTTP) - CRUD operations
- **Port:** 3000 (backend), 5173 (frontend)

### 2. **Backend ↔ Python**
- **HTTP API** (FastAPI) - Port 8000
- **Stdio** - Python subprocess execution
- **LanceDB** - Shared vector database

### 3. **Backend ↔ Claude Code / External Agents**
- **MCP Protocol** (Model Context Protocol) - stdio transport
- **Tools:** 50+ MCP tools exposed via `index.ts`

### 4. **Agent Manager ↔ Agents**
- **TypeScript Interface:** `IAgent` (src/agents/types.ts)
- **Registry:** `src/agents/registry.json`
- **Task Queue:** SQLite (data/brunella.db)

---

<!-- DOC_STATS_START -->
## 📊 Auto-generated projekt statisztikák

- Agent registry entries: **81**
- Route modulok a `src/server/routes/` alatt: **91**
- Aktív route mountok a központi routerben: **106**
- MCP tool fájlok a `src/tools/` alatt: **52**
- Detektált MCP tool definíciók / regisztrációk: **4**
- CLI parancs deklarációk: **276**
- Dashboard navigációs panelek: **106**

> Ezt a blokkot a `npm run sync:doc-stats` generálja.
<!-- DOC_STATS_END -->

## 📂 Fájl Struktúra (Kritikus Komponensek)

```
F:\mcp-brunella-core\
│
├── src/                              # TypeScript Source (ESM)
│   ├── agents/                       # 🤖 Agent Implementations
│   │   ├── AgentManager.ts          # 🔴 KÖZPONTI KOORDINÁTOR
│   │   ├── registry.json            # 🔴 Agent Definitions
│   │   ├── OrchestratorAgent.ts     # Planner & Dispatcher
│   │   ├── DeveloperAgent.ts        # Code Writer
│   │   ├── EvaluatorAgent.ts        # Tester & Auditor
│   │   ├── ResearcherAgent.ts       # Web Search & RAG
│   │   └── [81 agents total...]
│   │
│   ├── tools/                        # 🔧 MCP Tool Definitions
│   │   ├── toolDefinitions.ts       # Tool schemas
│   │   ├── pythonShell.ts           # Python execution
│   │   └── [33 tool files / 4 MCP definitions...]
│   │
│   ├── server/                       # 🌐 Express + Socket.IO
│   │   ├── web.ts                   # Main server entry
│   │   ├── registry.ts              # MCP registration
│   │   └── phoenixRoutes.ts         # Phoenix API endpoints
│   │
│   ├── core/                         # 🧠 Core Logic
│   │   ├── llm_client.ts            # Ollama/Gemini/GitHub Models
│   │   ├── retryStrategy.ts         # Retry logic
│   │   ├── checkpoint.ts            # State persistence
│   │   ├── phoenixEventBus.ts       # 🔴 Event system
│   │   └── failoverRegistry.ts      # Cross-agent failover
│   │
│   ├── utils/                        # 🛠️ Utilities
│   │   ├── logger.ts                # 🔴 Structured logging
│   │   ├── heartbeatMonitor.ts      # 🔴 Service health checks
│   │   └── rag.ts                   # LanceDB vector search
│   │
│   ├── dashboard/                    # 🎨 React UI (Vite)
│   │   ├── components/
│   │   ├── context/SocketContext.tsx # Socket.IO connection
│   │   └── lib/apiService.ts        # REST client
│   │
│   ├── cli.ts                        # CLI Entry Point
│   └── index.ts                      # 🔴 MCP Server Entry
│
├── myai/                             # 🐍 Python Subsystem
│   ├── server.py                    # FastAPI Server (:8000)
│   ├── mcp_server.py                # Python MCP Server
│   ├── browser_worker.py            # Playwright automation
│   ├── agents/                      # Python Agents
│   └── tools/                       # Python Tools
│
├── conductor/                        # 📋 Project Management
│   ├── tracks.md                    # 🔴 Active Tracks
│   ├── workflow.md                  # Development Workflow
│   ├── tracks/                      # Per-track plans
│   └── project_state.json           # Current state
│
├── .ai/                              # 📝 Agent Logs
│   ├── FOSZAL.md                    # 🔴 Unified Log (auto-generated)
│   ├── claude.md                    # Claude Code log
│   └── [other agent logs...]
│
├── logs/                             # 📊 Runtime Logs
│   ├── phoenix.log                  # 🔴 Phoenix Protocol events
│   ├── agent_*.log                  # Agent-specific logs
│   └── developer.log                # Development events
│
├── data/                             # 💾 Databases
│   ├── brunella.db                  # SQLite (task queue)
│   ├── checkpoints.db               # Phoenix checkpoints
│   └── brunella_lancedb/            # Vector DB (RAG)
│
├── test/                             # ✅ Test Suites
│   ├── phoenixRecoveryLogic.test.ts # Phoenix v2 tests
│   ├── heartbeatMonitor.test.ts     # Heartbeat tests
│   └── [100+ test files...]
│
├── package.json                      # 🔴 Node.js config
├── tsconfig.json                    # 🔴 TypeScript config
├── TEST_RESULTS.md                  # 🔴 Latest test results
├── PROJEKT_DIAGRAM.md               # 🔴 This file
└── README.md                        # 🔴 Main documentation
```

**🔴 = Kötelező beolvasni minden munkamenet kezdéskor!**

---

## 🤖 Agent Hierarchia

```
                    OrchestratorAgent
                   (Planner & Dispatcher)
                           |
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  DeveloperAgent    EvaluatorAgent    ResearcherAgent
  (Code Writer)    (Tester/Auditor)   (Web Search/RAG)
        │                  │                  │
        ├─────────────┬────┴────┬────────────┤
        │             │         │            │
 DataScientist   EdgeProxy  VoiceAgent  TaskDecomposer
    Agent         Agent       Agent         Agent
        │
  [54 total agents...]
```

**Agent Execution Flow:**

1. **User Input** → OrchestratorAgent
2. **Plan Creation** → Task decomposition
3. **Task Delegation** → AgentManager.delegate(agentName, task)
4. **Execution** → Agent.execute(task, context)
5. **Phoenix Recovery** → executeWithRecovery() (if failure)
6. **Result** → User

---

## 🔥 Phoenix Protocol v2 (Self-Healing System)

```
┌──────────────────────────────────────────────────────────────┐
│                    PHOENIX PROTOCOL v2                        │
│              Autonomous Recovery & Resilience                 │
└──────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
    ┌───────▼────────┐            ┌────────▼─────────┐
    │   HEARTBEAT    │            │  AGENT MANAGER   │
    │    MONITOR     │            │  RECOVERY LOGIC  │
    │  (5s interval) │            │                  │
    └────────────────┘            └──────────────────┘
            │                               │
    ┌───────┴────────┐          ┌──────────┴──────────┐
    │                │          │                     │
Ollama (:11434)  FastAPI    executeWithRecovery()  restartService()
Dashboard (:3000) (:8000)   restoreState()         Circuit Breaker
                                                    Reset
```

### Phoenix Komponensek:

1. **Heartbeat Monitor** (`src/utils/heartbeatMonitor.ts`)
   - 5s interval health checks
   - Service failure detection
   - PhoenixEventBus integration

2. **AgentManager Recovery Logic** (`src/agents/AgentManager.ts`)
   - `executeWithRecovery()` - Auto retry with recovery
   - `restartService()` - Service/agent restart
   - `restoreState()` - Checkpoint-based state restoration
   - Graceful degradation

3. **Checkpoint System** (`src/core/checkpoint.ts`)
   - SQLite-based state persistence
   - Resume-from-last-success
   - < 5ms save latency

4. **Phoenix Event Bus** (`src/core/phoenixEventBus.ts`)
   - Typed event system
   - Dashboard integration
   - Event history (200 events)

### Phoenix Events:

- `phoenix:recovery` - Recovery attempt
- `phoenix:restart` - Service restart
- `phoenix:state_restored` - Checkpoint loaded
- `phoenix:agent_failed` - Agent failure
- `phoenix:failover_triggered` - Cross-agent failover
- `phoenix:circuit_breaker` - Circuit breaker state change

---

## 🔌 MCP (Model Context Protocol) Integration

### MCP Servers:

**1. Brunella Core MCP Server** (stdio)
```typescript
// src/index.ts - StdioServerTransport
Tools: 50+ (execute_agent, list_agents, run_python, etc.)
```

**2. Brunella Python MCP Server** (stdio)
```python
# myai/mcp_server.py - FastMCP
Tools: 10+ (python_execute, browser_automation, etc.)
```

**3. VS Code Insiders Integration**
- GitHub MCP Server (HTTP remote)
- Filesystem MCP Server
- Windows Manager MCP Server
- Playwright MCP Server
- Memory MCP Server

**Config:** `C:\Users\pohi9\AppData\Roaming\Code - Insiders\User\mcp.json`

---

## 📊 Data Flow (典型场景)

### Scenario 1: User Request via Dashboard

```
User (Browser)
  │
  ├─→ Socket.IO (:3000)
  │     │
  │     └─→ AgentManager.delegateTask()
  │           │
  │           ├─→ routeTask() → "Orchestrator"
  │           │     │
  │           │     └─→ OrchestratorAgent.execute()
  │           │           │
  │           │           ├─→ Task Decomposition
  │           │           │
  │           │           └─→ AgentManager.queueTask() × N
  │           │                 │
  │           │                 └─→ DeveloperAgent.execute()
  │           │                       │
  │           │                       ├─→ Python Shell (if needed)
  │           │                       │     │
  │           │                       │     └─→ FastAPI :8000
  │           │                       │           │
  │           │                       │           └─→ Result
  │           │                       │
  │           │                       └─→ Result → Socket.IO
  │           │                             │
  │           │                             └─→ Dashboard UI Update
  │           │
  │           └─→ Phoenix Recovery (if failure)
  │                 │
  │                 ├─→ restartService()
  │                 ├─→ restoreState()
  │                 └─→ Retry
  │
  └─→ Success / Error Response
```

### Scenario 2: MCP Tool Call (Claude Code)

```
Claude Code (CLI)
  │
  ├─→ MCP Request (stdio)
  │     │
  │     └─→ src/index.ts (StdioServerTransport)
  │           │
  │           └─→ Tool Handler (e.g., execute_agent)
  │                 │
  │                 └─→ AgentManager.delegate()
  │                       │
  │                       └─→ [Same flow as Scenario 1]
  │
  └─→ MCP Response
```

---

## 🧪 Testing Strategy

### Test Pyramid:

```
         ┌────────────┐
         │    E2E     │  (Playwright - Browser tests)
         │   Tests    │
         └────────────┘
       ┌──────────────────┐
       │  Integration Tests│  (API, Agent execution)
       │                   │
       └──────────────────┘
   ┌────────────────────────────┐
   │      Unit Tests            │  (Individual functions)
   │                            │
   └────────────────────────────┘
```

### Test Commands:

```bash
npm test                          # All tests (Vitest)
npx vitest run test/foo.test.ts  # Single test file
npm run test:watch                # Watch mode
```

### Key Test Suites:

- ✅ `test/phoenixRecoveryLogic.test.ts` - Phoenix v2 recovery (9/9 PASSED)
- ✅ `test/heartbeatMonitor.test.ts` - Heartbeat monitor (14/14 PASSED)
- ✅ `test/ironCladBackend.test.ts` - Python backend integration
- ✅ `test/e2e/socket-reconnect.spec.ts` - Socket.IO reconnection

**Current Status:** 719/723 tests PASSED (99.4%)

---

## 🚀 Deployment Flow

```
Development (Local)
  │
  ├─→ Git Commit
  │     │
  │     └─→ Husky Pre-commit Hook
  │           │
  │           ├─→ npm run build (MUST PASS)
  │           └─→ npm test (MUST PASS)
  │
  ├─→ Git Push
  │     │
  │     └─→ GitHub Repository
  │           │
  │           └─→ [Jules may pull and integrate]
  │
  └─→ Production (Future)
```

**Current Deployment:** Manual (Local development only)

---

## 🔧 Critical Environment Variables

```bash
# Ollama (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# Gemini (Cloud LLM)
GEMINI_API_KEY=...

# GitHub Models (GPT-4o)
GITHUB_PAT=...

# LangSmith (Tracing)
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=brunella-agents

# Cloudflare (Edge deployment)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.workers.dev

# Phoenix Protocol
PHOENIX_ENABLED=true
PHOENIX_HEARTBEAT_INTERVAL=5000  # 5s

# Workspace Root
BRUNELLA_WORKSPACE_ROOT=.
```

---

## 📝 Changelog (Recent Updates)

### 2026-02-16 (TODAY)
- ✅ **Phoenix Protocol v2** - AgentManager Recovery Logic (9/9 tests PASSED)
- ✅ **Heartbeat Monitor** - 5s interval service health checks (14/14 tests PASSED)
- ✅ **Socket.IO E2E Tests** - Reconnection protocol (5/5 tests PASSED)
- ✅ **Iron Clad Backend** - Integration tests (11/11 tests PASSED)
- ✅ **VS Code Insiders** - MCP configuration with GitHub Copilot Pro+

### 2026-02-14
- ✅ **Onboarding Knowledge Manager** - Track progress 75%
- ✅ **TrackProgress Widget** - Dashboard integration

### 2026-02-10
- ✅ **BAS Comprehensive Test Protocol** - 90% progress
- ✅ **Dashboard Error Boundary** - React error handling

---

## 🔗 Quick Links

- **README.md** - Main documentation (this is the MASTER)
- **CLAUDE.md** - Claude Code quick reference
- **.ai/FOSZAL.md** - Unified agent log (CRITICAL!)
- **conductor/tracks.md** - Active tracks
- **TEST_RESULTS.md** - Latest test results (CRITICAL!)
- **logs/phoenix.log** - Phoenix Protocol events (CRITICAL!)

---

**🔴 FIGYELEM:** Ez a diagram ÉLŐ dokumentum. Ha a rendszer architektúrája változik, KÖTELEZŐ frissíteni!

**Utolsó frissítés:** Claude Sonnet 4.5 @ 2026-02-16T16:00:00Z
