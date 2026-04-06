



---
description: "Use this agent when you need to orchestrate complex multi-agent workflows, intelligently delegate tasks across the Brunella agent ecosystem, or handle sophisticated system operations that require coordinated execution across multiple specialized agents.\n\nTrigger phrases include:\n- 'orchestrate this workflow across multiple agents'\n- 'delegate this task to the right agent'\n- 'handle this complex operation end-to-end'\n- 'coordinate multiple agents to solve this'\n- 'manage this multi-step system process'\n- 'I need professional coordination of this task'\n- 'route this to the appropriate specialized agent'\n\nExamples:\n- User says 'I need to automate a complex bookkeeping workflow involving n8n, data validation, and reconciliation' → invoke this agent to analyze the problem, identify which agents (n8n-orchestrator, validation-agent, etc.) should handle each step, and coordinate their execution\n- User asks 'Handle this end-to-end invoice-to-payment process with proper state tracking and error recovery' → invoke this agent to orchestrate the workflow, delegate to specialized agents (bank agent, matching agent, etc.), track progress, and manage recovery if steps fail\n- During a complex system task, user says 'I need this coordinated professionally across our agent network' → invoke this agent to evaluate available agents in src/agents, myai/agents, and .github/agents, make intelligent routing decisions, and execute the workflow with full control and oversight\n- When facing problems requiring multiple tool types and agents, user says 'Use your best judgment to solve this' → invoke this agent to assess the situation, select optimal agents and tools, coordinate their actions, and deliver a comprehensive solution"
name: brunella-orchestrator
---

# brunella-orchestrator instructions

You are the PAIOS Orchestrator, the LLM brain of the Brunella system. Your role is to act as the central coordinator and delegator for all complex tasks, workflows, and multi-agent operations.

# Core Identity & Mission
You are a sophisticated orchestration engine that:
- Understands the complete Brunella agent ecosystem (agents in src/agents/, myai/agents/, .github/agents/)
- Makes intelligent decisions about which agent should handle which task
- Tracks workflow state, dependencies, and execution across multiple agents
- Maintains oversight and control throughout distributed task execution
- Ensures professional, efficient resolution of complex problems
- Uses modern tools and techniques optimally for each situation

# Agent Ecosystem Knowledge
You must maintain awareness of:
- Available specialized agents in F:\mcp-brunella-core\src\agents\*
- Python-based agents in F:\mcp-brunella-core\myai\agents\*
- GitHub workflow agents in F:\mcp-brunella-core\.github\agents\*
- Each agent's specific capabilities, constraints, and expected inputs
- When agents can work in parallel vs when they must sequence
- Agent communication patterns and data handoff requirements
- **Self-improvement loop agents and channel (NEW — 2026-04-06):**
  - `.github/agents/bas-self-reflect.agent.md` — activated after every track closure; reads last 50 FOSZAL.md lines, detects patterns, writes proposals to `conductor/backlog.md`
  - `.github/agents/bas-golden-dataset-enricher.agent.md` — after every quality tool run (score ≥ 0.7), feeds fine-tuning examples into `goldenDatasetBridge.ts` → `learningLoopService`
  - `.github/agents/bas-pattern-scout.agent.md` — weekly registry scanner; reads `src/agents/registry.json`, proposes agent consolidations or capability gaps
  - `src/core/copilotFeedbackChannel.ts` (`copilotFeedbackChannel` singleton from `autonomousInfraRuntime.ts`) — Copilot CLI code-review JSON → `SelfModelSignal`s → `selfModel.ingestCopilotFeedback()` → `copilotCognitiveBridge.reflect()`. **Never instantiate separately.**

# Decision-Making Framework
When delegating a task:
1. **Analyze the problem**: Break down the task into logical components
2. **Assess available agents**: Match task components to agent specializations
3. **Plan the workflow**: Determine execution order, dependencies, and data flow
4. **Evaluate efficiency**: Consider parallelization, tool availability, and time complexity
5. **Select optimal tools**: For each component, choose the best tool (agent, API, direct execution)
6. **Design error recovery**: Plan for potential failures and recovery paths

# Delegation Strategy
- Prefer delegating specialized tasks to specialized agents (e.g., code review to code-review agent, testing to test-writer agent)
- Use agents in parallel when tasks are independent to maximize efficiency
- Maintain direct control for orchestration, decision-making, and final quality verification
- Communicate clearly with delegated agents about requirements, constraints, and success criteria
- Track all delegated work and ensure dependencies are satisfied

# Process Tracking & State Management
- Maintain explicit knowledge of workflow progress and state at all times
- Track which agents are working, what they're working on, and expected completion
- Use background agents (mode: "background") for long-running tasks so you can continue coordinating
- Read agent results promptly and adapt the workflow if needed
- Document workflow state clearly so users understand what's happening and why

# Quality Control & Verification
- Verify each delegated agent's output meets requirements before proceeding
- Spot-check critical outputs from delegated agents
- If a delegated agent fails or produces suboptimal results, assess whether to retry, escalate, or handle directly
- Ensure final workflow output is coherent, complete, and meets the original request
- Use code-review agents or similar to validate critical code changes before considering them done

# Tool Selection & Optimization
- Direct tools (grep, view, edit, powershell) for quick operations when you have enough context
- Use agents for complex analysis, creative work, or domain-specific tasks
- Combine tools efficiently: explore agent for codebase understanding, then use direct tools for targeted changes
- Know when to use sync (quick, blocking) vs async/background (long-running) execution
- Use specialized custom agents (bas-lead-developer, strict-code-reviewer, devops-infra-guardian, etc.) for their respective domains

# Workflow Orchestration Patterns
- **Linear workflows**: Task → Agent1 → Agent2 → Agent3 → Verify → Done
- **Parallel workflows**: Task → [Agent1, Agent2, Agent3 in parallel] → Merge results → Verify → Done
- **Conditional workflows**: Task → Evaluate → Route to Agent A OR Agent B based on conditions
- **Iterative workflows**: Task → Agent → Verify → If satisfied: Done; Else: Refine → Agent → Verify → Done
- **Fault-tolerant workflows**: Task → Agent → If success: Continue; Else: Retry/Escalate/Alternate → Continue

# Common Orchestration Scenarios

**Complex Development Task** (e.g., "Build a new API feature with full test coverage"):
1. Assess requirements and design
2. Delegate to bas-lead-developer for implementation
3. Delegate to robust-test-writer for test coverage
4. Delegate to strict-code-reviewer for quality validation
5. Verify integration with existing system
6. Report completion and any issues

**Multi-Agent Data Pipeline** (e.g., "Process CSV, validate, transform, load to database"):
1. Parse CSV and understand schema
2. Delegate validation to appropriate validator agent
3. Delegate transformation if needed
4. Execute database load (may delegate to db-specific agent)
5. Verify data integrity
6. Report summary and any discrepancies

**Copilot Self-Improvement Loop** (e.g., "Run daily self-improvement cycle" / after `self-improve.yml` triggers):
1. Run `brunella conductor health` and pass output to Copilot CLI Code-review agent
2. Pipe review JSON into `copilotFeedbackChannel.ingest()` (singleton in `autonomousInfraRuntime.ts`)
3. Wait for aggregate reflection: `copilotCognitiveBridge.reflect()` updates GoldenDataset + GraphRAG
4. Trigger `bas-self-reflect.agent.md` to analyze last 50 FOSZAL entries and write backlog proposals
5. Trigger `bas-pattern-scout.agent.md` if it is weekly cadence (check `.github/workflows/self-improve.yml` schedule)
6. Report newly created backlog entries and updated capability map

**System Troubleshooting** (e.g., "Why is this test failing?"):
1. Gather error context and logs
2. Analyze root cause
3. Delegate specialized debugging to relevant agent (TypeScript, Python, infrastructure, etc.)
4. Coordinate any fixes
5. Verify resolution
6. Report findings and solution

# Edge Case Handling

**Ambiguous task requests**:
- Ask for clarification on priorities, constraints, or success criteria
- Propose a default interpretation and ask if it matches their intent

**Agent unavailability**:
- Assess if the task can be handled directly
- Suggest an alternative agent or approach
- Escalate if no viable path exists

**Task scope grows during execution**:
- Alert the user to scope creep
- Ask if expanded scope should be included
- Adjust workflow if approved

**Conflicting requirements**:
- Document the conflict clearly
- Propose resolution options
- Ask user to choose direction

**Agent failure or poor output**:
- Assess if retry with refined instructions would help
- Consider delegating to a different agent
- Handle the task directly if necessary
- Report what went wrong and how you resolved it

# Output Format
- Present workflow progress clearly as you coordinate
- When delegating, explain why each agent was chosen
- Provide intermediate results as agents complete
- Final output should summarize: what was done, which agents were involved, what the results are, any issues encountered
- For technical tasks, include verification details and quality metrics
- For process-oriented tasks, include execution timeline and state transitions


# Success Criteria
You succeed when:
- The task is completed to the user's satisfaction
- Specialized agents were used appropriately for their domains
- Workflow execution was efficient and well-coordinated
- Quality gates were enforced at critical steps
- The user understands what was done and why
- No critical issues were missed or overlooked

# When to Ask for Clarification
- If task requirements are vague or potentially conflicting
- If you need to know performance/quality priorities (e.g., speed vs. perfection)
- If agent dependencies or constraints are unclear
- If the user's success criteria differ from your assumptions
- If system state is unclear and would affect routing decisions

Remember: You are the orchestrator. You maintain control, make intelligent decisions, and delegate to specialists. Your job is to transform complex, multi-faceted requests into coordinated, professional solutions using the full power of the Brunella agent ecosystem.

# Brunella Agent System — Projekt Diagram v2

**Utolsó frissítés:** 2026-04-06
**Verzió:** 3.6.0
**Korábbi verzió:** PROJEKT_DIAGRAM.md (v2.4.0, 2026-03-25)

---

## 🏗️ Rendszer Architektúra (High-Level — Bővített)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         BRUNELLA AGENT SYSTEM (BAS)                           │
│                     Multi-Agent + Federation + Edge + KKV                     │
│                         Verzió: 3.5.x  (2026-04-04)                           │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
            ┌───────▼────────┐                     ┌───────▼──────┐
            │  FRONTEND UI   │                     │   BACKEND    │
            │  (React 19)    │                     │  (Node.js)   │
            │  Vite :5173    │                     │  Express :3000│
            └───────┬────────┘                     └───────┬──────┘
                    │                                       │
        ┌───────────┴──────────┐             ┌─────────────┴────────────┐
        │                      │             │                          │
   ┌────▼─────┐         ┌──────▼──┐   ┌─────▼──────┐    ┌─────────────▼──────┐
   │  Vite    │         │Socket.IO│   │  MCP Server│    │  Agent Manager     │
   │ Server   │         │Realtime │   │  (stdio)   │    │  Orchestrator      │
   │  :5173   │         │ Events  │   │  53 tools  │    │  76 agents · DAG   │
   └──────────┘         └─────────┘   └────────────┘    └─────────┬──────────┘
                                                                   │
                                           ┌───────────────────────┤
                                           │                       │
                                 ┌─────────▼──────┐   ┌───────────▼──────────┐
                                 │ PYTHON BACKEND │   │   ADVANCED CORE      │
                                 │  FastAPI :8000 │   │  Federation · Refl.  │
                                 │  AutoGen/MCP   │   │  Ephemeral · CEAN    │
                                 └────────────────┘   └──────────────────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │                           │
                    ┌─────────▼─────────┐     ┌──────────▼──────────┐
                    │  CLOUDFLARE EDGE  │     │   KKV AUTOMATION    │
                    │  Workers · D1 · R2│     │  n8n · 7 Vertikum   │
                    │  (CEAN Network)   │     │  CRM · HR · Finance  │
                    └───────────────────┘     └─────────────────────┘
```

---

## 🔄 Kommunikációs Protokollok

### 1. **Frontend ↔ Backend**
- **Socket.IO** (WebSocket) — Realtime events, agent státuszok
- **REST API** (HTTP) — CRUD műveletek (`/api/v1/*`)
- **Port:** 3000 (backend), 5173 (frontend Vite proxy)

### 2. **Backend ↔ Python**
- **HTTP API** (FastAPI `:8000`) — Python toolchain, browser worker
- **Stdio** — Python subprocess execution
- **LanceDB** — Shared vector database (RAG)
- **AutoGen** (új ✨) — Multi-agent conversation layer GitHub Models felett

### 3. **Backend ↔ Claude Code / Copilot / External Agents**
- **MCP Protocol** (stdio) — 53 MCP tool a `src/tools/` alatt
- **Copilot Cognitive Bridge** (új ✨) — `src/core/copilotCognitiveBridge.ts`
- **Ephemeral Agent Bridge** (új ✨) — Zero-prompt → futtatás azonnal

### 4. **Federation Layer** (új ✨)
- **Peer Auth** (`src/core/federation/federationPeerAuth.ts`)
- **Peer Proof + Replay Guard** — Signed capability manifests
- **Distributed Brunella nodes** — Federation Center dashboard

### 5. **Cloudflare Edge (CEAN)** (fejlesztés alatt)
- **Workers** — Agent execution az edge-en
- **D1** — SQLite adatbázis a cloud-ban
- **R2** — Objektum tárolás
- **Hyperdrive** — Connection pooling a D1-hez

---

<!-- DOC_STATS_START -->
## 📊 Projekt Statisztikák (2026-04-04)

| Metrika | Érték |
|---------|-------|
| Agent registry bejegyzések | **76** |
| TypeScript agent fájlok (`src/agents/`) | **118** |
| Route modulok (`src/server/routes/`) | **72** |
| MCP tool fájlok (`src/tools/`) | **36** |
| Core modulok (`src/core/`) | **90+** |
| CLI parancs deklarációk | **211+** |
| Dashboard navigációs panelek | **75+** |
| TypeScript teszt fájlok | **297** |
| Python agent TOML fájlok | **6** |
| Aktív fejlesztési track | **25** |
| Befejezett track | **14** |
| Archivált track | **166+** |

> Statisztikák: `npm run sync:doc-stats` / manuális audit 2026-04-04
<!-- DOC_STATS_END -->

---

## 📂 Fájl Struktúra (Kritikus Komponensek — Bővített)

```
F:\mcp-brunella-core\
│
├── src/                                # TypeScript Source (ESM)
│   ├── agents/                         # 🤖 76 Agent (registry.json)  [118 .ts fájl]
│   │   ├── AgentManager.ts            # 🔴 KÖZPONTI KOORDINÁTOR
│   │   ├── BaseAgent.ts               # 🔴 Alap agent osztály (RAG, memory, scoring)
│   │   ├── registry.json              # 🔴 76 Agent + TOML DynamicAgent definíciók
│   │   ├── OrchestratorAgent.ts       # Fő orchestrátor
│   │   ├── EnterpriseOrchestratorAgent.ts  # Enterprise-szintű orchestrátor
│   │   ├── DeveloperAgent.ts          # Kód írás, futtatás
│   │   ├── EvaluatorAgent.ts          # Tesztelés, auditálás
│   │   ├── ResearcherAgent.ts         # Web search + RAG
│   │   ├── swarm/                     # 🕸️ SwarmManager + SwarmAgent
│   │   ├── permissions.ts             # RBAC: 6 profil
│   │   └── [76 agent összesen...]
│   │
│   ├── tools/                          # 🔧 36 MCP Tool fájl (53 tool definíció)
│   │   ├── toolDefinitions.ts         # Tool sémák
│   │   ├── pythonShell.ts             # Python végrehajtás
│   │   ├── browserAutomation.ts       # 🆕 Browser automatizálás
│   │   └── [36 fájl / 53 tool...]
│   │
│   ├── server/                         # 🌐 Express + Socket.IO
│   │   ├── web.ts                     # 🔴 Fő szerver + deferredInit()
│   │   ├── registry.ts                # 🔴 MCP + Tool regisztráció
│   │   ├── McpProcessManager.ts       # 🆕 MCP auto-start (mcp_servers.json)
│   │   ├── routes/                    # 72 route fájl, lazy-loaded
│   │   │   └── index.ts               # 🔴 Központi route mount tábla
│   │   └── phoenixRoutes.ts           # Phoenix API endpoints
│   │
│   ├── core/                           # 🧠 90+ Core modul
│   │   ├── llm_client.ts              # 🔴 Ollama/Gemini/GitHub Models
│   │   ├── bifrost_gateway.ts         # 🔴 4 provider auto-fallback
│   │   ├── modelRouter.ts             # Brain/Muscle routing (RULE-MR1-4)
│   │   ├── checkpoint.ts              # 🔴 SQLite állapot mentés
│   │   ├── phoenixEventBus.ts         # 🔴 Event system
│   │   ├── reflectionEngine.ts        # 🆕 Önreflexió / Continual Learning
│   │   ├── learningLoopService.ts     # 🆕 Learning loop aktiválás
│   │   ├── dagEngine.ts               # 🆕 DAG-alapú workflow motor
│   │   ├── ephemeralAgentExecutor.ts  # 🆕 Zero-prompt ephemeral ügynök
│   │   ├── ephemeralAgentManager.ts   # 🆕 Ephemeral életciklus
│   │   ├── copilotCognitiveBridge.ts  # 🆕 Copilot-Brunella integráció
│   │   ├── federation/                # 🆕 Federáció
│   │   │   ├── federationAuth.ts      #   Peer autentikáció
│   │   │   ├── federationPeerProof.ts #   Signed capability manifests
│   │   │   ├── federationReplayGuard.ts # Nonce replay védelem
│   │   │   └── capabilityManifest.ts  #   MANIFEST_SIGNING_SECRET (32+ char)
│   │   ├── graphRagEngine.ts          # 🆕 Graph-alapú RAG
│   │   ├── scheduledTasksEngine.ts    # 🆕 Ütemezett feladatok
│   │   ├── zeroPromptRuntime.ts       # 🆕 Zero-prompt futtatókörnyezet
│   │   ├── autonomousInfraRuntime.ts  # Autonóm infrastruktúra
│   │   ├── retryStrategy.ts           # Retry logika
│   │   ├── failoverRegistry.ts        # Cross-agent failover
│   │   └── [90+ modul összesen...]
│   │
│   ├── types/                          # TypeScript típusok
│   │   └── cean.ts                    # 🆕 CEAN edge típusok
│   │
│   ├── utils/                          # 🛠️ Utility modulok
│   │   ├── logger.ts                  # 🔴 Strukturált logging
│   │   ├── heartbeatMonitor.ts        # 🔴 5s interval health check
│   │   └── rag.ts                     # LanceDB vektoros keresés
│   │
│   ├── dashboard/                      # 🎨 React 19 UI (Vite)
│   │   ├── components/
│   │   │   ├── PAIOSOrchestratorChat.tsx    # 🔴 Fő AI chat felület
│   │   │   ├── PhoenixEventsPanel.tsx       # Phoenix esemény megjelenítő
│   │   │   ├── AgentManagementPanel.tsx     # Agent kezelés
│   │   │   ├── FederationCenter.tsx         # 🆕 Federation monitoring
│   │   │   ├── NeuralLinkChat.tsx           # Neural chat interface
│   │   │   └── [75+ komponens összesen...]
│   │   ├── context/SocketContext.tsx        # Socket.IO kapcsolat
│   │   └── lib/navigation.tsx              # 🔴 NavigationRegistry (panelregisztráció)
│   │
│   ├── cli.ts                          # 🔴 CLI belépési pont (211+ parancs)
│   └── index.ts                        # 🔴 MCP Server + Express dual-mode start
│
├── myai/                               # 🐍 Python Alrendszer
│   ├── server.py                       # FastAPI (:8000) + OpenAI-kompatibilis végpontok
│   ├── mcp_server.py                   # Python MCP Server (FastMCP)
│   ├── browser_worker.py               # Playwright automatizálás
│   ├── refiner_logic.py                # Adat tisztítás + LanceDB batch írás
│   ├── pydantic_models.py              # 🔴 Validációs sémák
│   ├── agents/                         # Python Agentek + TOML DynamicAgentek
│   │   ├── agent_architect.toml        # 🆕 TOML DynamicAgent példa
│   │   ├── CopywriterAgent.toml
│   │   ├── ev_hunter.toml
│   │   ├── lint_fixer.toml
│   │   ├── MarketingDirectorAgent.toml
│   │   └── project_organizer.toml
│   └── agents/workers/                 # 🆕 Cloudflare Workers (CEAN)
│       ├── schema/d1_schema.sql        # CEAN D1 adatbázis séma (12 tábla)
│       └── cean-test/                  # CEAN tesztworker
│
├── conductor/                          # 📋 Projekt menedzsment
│   ├── tracks.md                       # 🔴 212 track (25 aktív, 14 kész, 166+ archív)
│   ├── workflow.md                     # Fejlesztési protokoll (EPP v2)
│   ├── tracks/                         # 55+ track mappa részletes tervekkel
│   └── project_state.json             # Aktuális állapot
│
├── .ai/                                # 📝 Agent naplók
│   ├── FOSZAL.md                       # 🔴 Egységes log (auto-generált)
│   ├── BOOTSTRAP.md                    # 🔴 Projekt összefoglaló
│   ├── copilot.md                      # Copilot munkamenet napló
│   └── claude.md                       # Claude Code napló
│
├── logs/                               # 📊 Runtime naplók
│   ├── phoenix.log                     # 🔴 Phoenix Protocol esemény napló
│   ├── agent_*.log                     # Agent-specifikus naplók
│   └── node-server.log                 # Szerver napló
│
├── data/                               # 💾 Adatbázisok
│   ├── brunella.db                     # SQLite (fő rendszer)
│   ├── tasks.db                        # Agent task queue
│   ├── checkpoints.db                  # Phoenix checkpointok
│   ├── audit.db                        # Audit trail
│   ├── cean.db                         # 🆕 CEAN hálózat
│   ├── comet_memory.db                 # 🆕 COMET memória
│   └── brunella_lancedb/               # Vector DB (RAG)
│
├── test/                               # ✅ 297 teszt fájl
│   ├── phoenixRecoveryLogic.test.ts
│   ├── heartbeatMonitor.test.ts
│   ├── federation/                     # 🆕 Federation tesztek
│   └── [297 teszt fájl összesen...]
│
├── mcp_servers.json                    # 🔴 MCP auto-start konfiguráció
├── package.json                        # 🔴 Node.js konfig
├── tsconfig.json                       # 🔴 TypeScript konfig (Node16 ESM)
├── paios.config.yaml                   # PAIOS konfig (TTS: nova, stb.)
└── README.md                           # 🔴 Fő dokumentáció
```

**🔴 = Munkamenet elején kötelező beolvasni!**
**🆕 = 2026-03-25 óta ÚJONNAN hozzáadott komponens!**

---

## 🤖 Agent Hierarchia (Bővített — 76 regisztrált agent)

```
                     ORCHESTRATOR RÉTEG
            ┌─────────────────────────────────┐
            │     OrchestratorAgent            │
            │  EnterpriseOrchestratorAgent     │
            └────────────┬────────────────────┘
                         │
   ┌─────────────────────┼──────────────────────────┐
   │                     │                          │
   ▼                     ▼                          ▼
CORE AGENTEK        ENGINEERING               AUTOMATIZÁLÁS
DeveloperAgent      SpecWriterAgent           RobotkezV2Agent
EvaluatorAgent      GenesisOrchestrator       VoiceAgent
ResearcherAgent     LintFixerAgent            SchedulerAgent
TaskDecomposer      CodebaseIndexer           JulesIntegration
   │                     │
   ▼                     ▼
ENTERPRISE (~20)    SWARM RÉTEG
FinanceAgent        SwarmManager
SalesAgent          SwarmAgent × N
HRAgent             (src/agents/swarm/)
LogisticsAgent
LegalAgent               │
MarketingAgent      TOML DYNAMIC
...                 myai/agents/*.toml
                    (6 DynamicAgent)
```

**Agent Végrehajtási Folyamat:**

```
User Input → OrchestratorAgent → Plan
  │
  ├─→ dagEngine.ts (új DAG-alapú végrehajtás)
  │     │
  │     └─→ AgentManager.queueTask() × N
  │           │
  │           ├─→ Agent.execute(task, context)
  │           │     │
  │           │     └─→ reflectionEngine (tanulás)
  │           │
  │           └─→ Phoenix Recovery (hiba esetén)
  │
  └─→ Eredmény → Socket.IO → Dashboard UI
```

---

## 🔥 Phoenix Protocol v2 (Öngyógyító Rendszer)

```
┌──────────────────────────────────────────────────────────────────┐
│                      PHOENIX PROTOCOL v2                          │
│               Autonomous Recovery & Resilience                    │
└──────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┴──────────────────┐
           │                                      │
   ┌───────▼────────┐                   ┌────────▼──────────┐
   │   HEARTBEAT    │                   │  AGENT MANAGER    │
   │    MONITOR     │                   │  RECOVERY LOGIC   │
   │  (5mp interval)│                   │                   │
   └────────────────┘                   └───────────────────┘
           │                                      │
   ┌───────┴────────┐              ┌─────────────┴───────────┐
   │                │              │                         │
Ollama (:11434) FastAPI       executeWithRecovery()     restartService()
Dashboard (:3000) (:8000)     restoreState()            Circuit Breaker
                              retryStrategy.ts
```

### Phoenix Komponensek:

1. **Heartbeat Monitor** (`src/utils/heartbeatMonitor.ts`)
   - 5s interval health checks az összes service-re
   - Service failure detection → PhoenixEventBus

2. **AgentManager Recovery** (`src/agents/AgentManager.ts`)
   - `executeWithRecovery()` — Auto retry 1s → 3s → 10s, max 3 kísérlet
   - `restartService()` — Service/agent újraindítás
   - `restoreState()` — Checkpoint-alapú állapot visszaállítás

3. **Checkpoint System** (`src/core/checkpoint.ts`)
   - SQLite-alapú állapot mentés (`checkpoints.db`)
   - `executing` → `failed` státuszváltás
   - &lt; 5ms mentési latency

4. **Phoenix Event Bus** (`src/core/phoenixEventBus.ts`)
   - Típusos event rendszer + dashboard integráció
   - 200 esemény history

### Phoenix Események:
- `phoenix:recovery`, `phoenix:restart`, `phoenix:state_restored`
- `phoenix:agent_failed`, `phoenix:failover_triggered`, `phoenix:circuit_breaker`

---

## 🌐 Federation Layer (ÚJ — Phase 5 Hardened) ✅

```
┌───────────────────────────────────────────────────────────────┐
│              BRUNELLA FEDERATION NETWORK                       │
│          Distributed Multi-Node Agent Coordination            │
└───────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
  ┌──────▼──────┐    ┌──────▼──────┐   ┌──────▼──────┐
  │  CORE NODE  │    │  PEER NODE  │   │  PEER NODE  │
  │  (helyi    │◄───►│  (remote)   │   │  (remote)   │
  │   Brunella) │    │             │   │             │
  └─────────────┘    └─────────────┘   └─────────────┘
         │
  ┌──────▼──────────────────────────────────────────┐
  │           FEDERATION BIZTONSÁGI RÉTEG           │
  │  federationPeerAuth.ts — Peer Auth              │
  │  federationPeerProof.ts — Signed Manifests      │
  │  federationReplayGuard.ts — Nonce Replay védelem│
  │  MANIFEST_SIGNING_SECRET (min 32 karakter)      │
  └─────────────────────────────────────────────────┘
```

**Státusz:** ✅ **Phase 5 Execute Hardening — BEFEJEZVE** (2026-04-02)

---

## 🪄 Ephemeral Agent Bridge (ÚJ) ✅

```
Zero-Prompt Request
       │
       ▼
zeroPromptRuntime.ts
       │
       ├─→ ephemeralAgentManager.ts
       │         │
       │         └─→ ephemeralAgentExecutor.ts
       │               │
       │               ├─→ ephemeralSandbox.ts    (izolált futtatás)
       │               ├─→ ephemeralLeaseManager  (TTL-alapú életciklus)
       │               └─→ ephemeralScopedToolRegistry (korlátozott tool hozzáférés)
       │
       └─→ ephemeralAudit.ts (napló minden ephemeral futtatáshoz)
```

**Státusz:** ✅ **Brunella Zero-Prompt → Ephemeral Agent Bridge — BEFEJEZVE** (2026-04-02)

---

## 🧠 Reflection & Continual Learning (ÚJ) ✅

```
Agent Végrehajtás befejezve
          │
          ▼
reflectionEngine.ts
          │
          ├─→ Teljesítmény kiértékelés
          ├─→ Minta felismerés (patternReuse.ts)
          ├─→ learningLoopService.ts → Tudásbázis frissítés
          │
          └─→ goldenDatasetBridge.ts
                    │
                    └─→ LanceDB (brunella_lancedb/)
                              │
                              └─→ RAG lookup a jövőbeli feladatoknál
```

**Komponensek:**
- `src/core/reflectionEngine.ts` — Önreflexió motor
- `src/core/learningLoopService.ts` — Tanulási ciklus
- `src/core/goldenDatasetBridge.ts` — Golden Dataset integráció
- `src/core/selfModel.ts` — Önmodell (képességtérkép)
- `src/core/patternReuse.ts` — Minta újrafelhasználás

**Státusz:** ✅ **Brunella Reflection / Continual Learning — BEFEJEZVE** (2026-04-02)

---

## 🤖 AutoGen GitHub Models Pilot (ÚJ) ✅

```
Python MCP Server (myai/mcp_server.py)
          │
          ├─→ AutoGen Conversation Framework
          │       │
          │       ├─→ GitHub Models API (GPT-4o, o1, etc.)
          │       │       Hitelesítés: GITHUB_PAT
          │       │
          │       └─→ Multi-agent AutoGen conversations
          │
          └─→ FastMCP ≥ 2.14.3 (Python MCP protokoll)
```

**Státusz:** ✅ **AutoGen GitHub Models pilot — BEFEJEZVE** (2026-04-01)

---

## 🔌 MCP (Model Context Protocol) Integráció

### MCP Szerverek:

**1. Brunella Core MCP Server** (stdio)
```typescript
// src/index.ts — StdioServerTransport
// 53 tool: execute_agent, list_agents, run_python, stb.
```

**2. Brunella Python MCP Server** (stdio/SSE)
```python
# myai/mcp_server.py — FastMCP ≥ 2.14.3
# Python tools: python_execute, browser_automation, AutoGen, stb.
```

**3. MCP Config Sync** (ÚJ) ✅
- `mcp_servers.json` ↔ `.vscode/mcp.json` szinkron
- `McpProcessManager.ts` — auto-start, requiredEnv, platforms, retry
- `self` MCP bejegyzés = Brunella Core (nem spawnolja újra önmagát!)

**4. VS Code Insiders Integráció**
- GitHub MCP Server (HTTP remote)
- Filesystem, Windows Manager, Playwright, Memory MCP Serverek

---

## 💼 KKV Automatizálási Suite (ÚJ — 7 Vertikum)

```
┌─────────────────────────────────────────────────────────────────┐
│              KKV AUTOMATIZÁLÁSI CSOMAG (2026-04-04)             │
│          Kis- és Középvállalkozások teljes automatizálása        │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─→ 🔵 CRM & Lead Utánkövetés (kkv_crm_automation_20260404)
         │         Automatikus CRM frissítés, lead scoring
         │
         ├─→ 🔵 Ügyfélszolgálati AI (kkv_customer_service_ai_20260404)
         │         Ticketkezelés, FAQ bot, eszkaláció
         │
         ├─→ 🔵 Pénzügyi Jóváhagyás (kkv_finance_automation_20260404)
         │         Emlékeztetők, approval workflow-k
         │
         ├─→ 🔵 HR & Dolgozói Adminisztráció (kkv_hr_automation_20260404)
         │         Szabadság kezelés, onboarding folyamatok
         │
         ├─→ 🔵 Készlet & Leltár (kkv_inventory_automation_20260404)
         │         Raktárkészlet figyelés, automatikus rendelés
         │
         ├─→ 🔵 Marketing & Kommunikáció (kkv_marketing_automation_20260404)
         │         Hírlevelek, közösségi média, kampányok
         │
         └─→ 🔵 Projekt & Feladat (kkv_project_task_automation_20260404)
                   Feladatkövetés, státuszriport, deadline kezelés
```

**Státusz:** 🟡 **0% — Újonnan indított, 7 aktív track** (2026-04-04)
**Assignee:** GitHub Copilot

---

## 📊 n8n + Könyvelési Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                   n8n KÖNYVELÉSI PIPELINE                     │
└──────────────────────────────────────────────────────────────┘
         │
         ├─→ ✅ Phase 1-2: Bank + KP + szamlazz.hu BEFEJEZVE (04-03)
         │         OTP Bank → n8n → KP szoftver szinkron
         │         szamlazz.hu → n8n → automatikus könyvelési bejegyzés
         │
         ├─→ 🔴 Phase 3: KRITIKUS (n8n_bookkeeping_phase3_finalization)
         │         WF-6..9 workflow-k + NAV Live integráció + IMAP
         │         Státusz: 0% — Assignee: GitHub Copilot
         │
         ├─→ 🆕 P-Sales Human-in-Loop Pipeline
         │         P-Sales → n8n → emberi jóváhagyás → végrehajtás
         │
         └─→ 🆕 P-Search Pipeline
                   Pályázat- és hitelkereső workflow-k n8n-ben
```

---

## 🤖 PAIOS Orchestrator + Nova Architecture (ÚJ)

```
PAIOS (Personal AI Operating System)
          │
          ├─→ PAIOSOrchestratorChat.tsx (dashboard főfelület)
          │       TTS: OpenAI Nova via /api/tts (paios.config.yaml → response_voice: nova)
          │
          ├─→ nova_knowledge_workflows_20260404
          │       Nova tudásbázis és interakciós workflow-k
          │       n8n + LanceDB + RAG alapú tudáskezelés
          │
          └─→ nova_multiagent_gatekeeper_20260404
                  Nova multi-agent gatekeeper architektúra
                  Kapuőr az összes bejövő feladathoz
```

---

## 🌍 Cloudflare Edge Agent Network (CEAN) — Fejlesztés alatt

```
┌──────────────────────────────────────────────────────────────────┐
│               CEAN (Cloudflare Edge Agent Network)               │
│              Phase 1A-D: Infrastructure Foundation               │
└──────────────────────────────────────────────────────────────────┘
         │
         ├─→ ✅ Phase 1A: Domain Setup + DNS konfigurálás
         ├─→ ✅ Phase 1B: D1 Schema + R1 Vector Mappings + Test Worker
         ├─→ ✅ Phase 1C: GitHub Actions CI/CD deploy workflow
         ├─→ 🔄 Phase 1D: Test Worker Deploy + Endpoint Verification
         │
         ├─→ src/types/cean.ts          (TypeScript típusok)
         ├─→ myai/agents/workers/schema/d1_schema.sql (12 tábla)
         ├─→ myai/agents/workers/cean-test/           (test worker)
         └─→ data/cean.db               (lokális CEAN adatok)
```

---

## 🔗 Model Router & Bifrost Gateway

```
Feladat érkezik
      │
      ▼
modelRouter.ts
      │
      ├─→ complexity: 'high' → BRAIN (Cloud)
      │         ├─→ Gemini (GEMINI_API_KEY)
      │         ├─→ GitHub Models / GPT-4o (GITHUB_PAT)
      │         └─→ Anthropic (ANTHROPIC_API_KEY)
      │
      └─→ complexity: 'low' | budget=0 → MUSCLE (Local)
                └─→ Ollama (qwen2.5-coder:7b)
                          │
                          └─→ bifrost_gateway.ts
                                    (4 provider auto-fallback lánc)
```

**RULE-MR1-4:**
- MR1: Magas komplexitás → Cloud brain
- MR2: Budget=0 / privacy → Local muscle
- MR3: Fallback: Ollama → Gemini → GitHub Models → Anthropic
- MR4: GITHUB_PAT preferált a GITHUB_TOKEN előtt

---

## 📊 Data Flow Szcenáriók

### 1. Dashboard Felhasználói Kérés

```
User (Browser :5173)
  │
  ├─→ Socket.IO (:3000) → AgentManager.delegateTask()
  │         │
  │         ├─→ OrchestratorAgent → DAG Plan
  │         │         │
  │         │         └─→ dagEngine.ts → AgentManager.queueTask() × N
  │         │               │
  │         │               ├─→ Agent.execute() → LLM (bifrost_gateway)
  │         │               ├─→ reflectionEngine.ts (tanulás)
  │         │               └─→ Socket.IO → Dashboard frissítés
  │         │
  │         └─→ Phoenix Recovery (hiba esetén)
  │
  └─→ Success / Error Response
```

### 2. MCP Tool Call (GitHub Copilot / Claude Code)

```
Copilot/Claude (stdio)
  │
  ├─→ MCP Request → src/index.ts (StdioServerTransport)
  │         │
  │         └─→ Tool Handler (pl. execute_agent)
  │               │
  │               └─→ AgentManager.delegate() → [Agent flow]
  │
  └─→ MCP Response
```

### 3. n8n Workflow Trigger

```
n8n Workflow
  │
  ├─→ HTTP Webhook → /api/v1/webhook/*
  │         │
  │         └─→ Route Handler → AgentManager
  │               │
  │               └─→ Specialist Agent (Finance/HR/CRM stb.)
  │
  └─→ n8n Callback / Response
```

### 4. Data Flywheel Pipeline

```
Harvest (browser_worker.py + Playwright)
  │
  ▼
Refine (refiner_logic.py + LLM summary)
  │
  ▼
Index (LanceDB data/brunella_lancedb/)
  │
  ▼
Learn (reflectionEngine + goldenDatasetBridge)
  │
  ▼
Execute (OrchestratorAgent + RAG-enhanced decisions)
```

---

## 🧪 Tesztelési Stratégia (Bővített)

```
         ┌───────────────────┐
         │    E2E Tesztek     │  playwright / Socket.IO reconnect
         └───────────────────┘
       ┌────────────────────────┐
       │  Integrációs Tesztek   │  API, Agent, Federation
       └────────────────────────┘
   ┌─────────────────────────────────┐
   │  Egység Tesztek (297 fájl)      │  Vitest, modul szintű
   └─────────────────────────────────┘
```

### Teszt Parancsok:

```bash
npm run test:fast              # Gyors suite (~1-2 perc) — commit előtt
npm test                       # Teljes suite + build (~10 perc)
npm run test:dashboard         # Dashboard-specifikus Vitest (vitest.dashboard.config.ts)
npm run test:e2e               # Playwright e2e
cd myai && pytest tests/       # Python tesztek (pytest.ini: --basetemp=.pytest_tmp)
npx vitest run test/foo.test.ts # Egy fájl
```

### Kulcs Tesztek:

| Teszt | Státusz |
|-------|---------|
| `phoenixRecoveryLogic.test.ts` | ✅ PASSED |
| `heartbeatMonitor.test.ts` | ✅ PASSED |
| `ironCladBackend.test.ts` | ✅ PASSED |
| `e2e/socket-reconnect.spec.ts` | ✅ PASSED |
| `federation/**` | ✅ PASSED |
| Összesített | ~99%+ |

---

## 🚀 Deployment & Git Flow

```
Fejlesztés (Helyi)
  │
  ├─→ Git Commit
  │     │
  │     └─→ Husky Pre-commit Hook
  │           ├─→ npx tsx scripts/sync_bootstrap.ts --stage
  │           ├─→ npm run build (MUSZÁJ OK!)
  │           └─→ node scripts/precommit-lint.mjs
  │
  ├─→ Git Push
  │     │
  │     └─→ Husky Pre-push Hook
  │           ├─→ npx tsx scripts/sync_doc_stats.ts --dry-run
  │           └─→ npm run test:fast (MUSZÁJ OK!)
  │
  └─→ GitHub Repository (pohi99999/mcp-brunella-core)
        │
        ├─→ Jules PR Integration (18% — folyamatban)
        └─→ CEAN GitHub Actions CI/CD (.github/workflows/deploy-edge-agents.yml)
```

---

## 🔧 Kritikus Környezeti Változók

```bash
# Ollama (Helyi LLM — MUSZÁJ!)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b

# Workspace
BRUNELLA_WORKSPACE_ROOT=.

# LLM Providerek (prioritás sorrendben)
GITHUB_PAT=...                          # GitHub Models — GITHUB_TOKEN ELŐTT!
GEMINI_API_KEY=...                      # Gemini Flash/Pro
ANTHROPIC_API_KEY=...                   # Claude (Bifrost Gateway)

# Federation (kritikus biztonsági követelmény!)
MANIFEST_SIGNING_SECRET=<min 32 karakter>   # Fail-closed, nincs default!

# Google Auth (két külön szerződés!)
GOOGLE_CREDENTIALS_FILE=credentials/google-service-account.json  # Service Account
GOOGLE_WORKSPACE_CREDENTIALS_FILE=credentials/...                 # OAuth interaktív

# Phoenix Protocol
PHOENIX_ENABLED=true
PHOENIX_HEARTBEAT_INTERVAL=5000        # 5s

# Cloudflare (CEAN)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.workers.dev
```

---

## 📋 Aktív Fejlesztési Trackek (2026-04-04)

### 🔴 CRITICAL

| Track | Státusz | Hozzárendelt |
|-------|---------|--------------|
| n8n Könyvelési Phase 3 finalizálás | 0% — induló | GitHub Copilot |
| Brunella Core Stabilization | 85% — közel kész | - |

### 🟠 HIGH

| Track | Státusz | Megjegyzés |
|-------|---------|------------|
| Error Handling Standardization | 0% | `catch (e: unknown)` enforcement |
| Type Safety Enforcement | 0% | `any` elimináció |
| Logging Refactor | 0% | console.log → Logger |
| P-Sales Human-in-Loop | 0% | n8n emberi jóváhagyás |
| P-Search n8n Pipeline | 0% | Pályázat/hitel keresés |
| Napi Intelligens Briefing | 0% | Reggeli AI összefoglaló |
| Nova Tudásbázis Workflow | 0% | LanceDB + RAG |
| Nova Multi-Agent Gatekeeper | 0% | Kapuőr architektúra |
| Kognitív Könyvelés Bővítmény | 0% | Multi-agent egyeztetés |
| Jules PR Integration | 18% | GitHub PR automatizálás |
| KKV CRM Automation | 0% | - |
| KKV Customer Service AI | 0% | - |
| KKV Finance Automation | 0% | - |
| KKV HR Automation | 0% | - |
| KKV Inventory Automation | 0% | - |

### 🟡 MEDIUM / 🔵 LOW

| Track | Státusz |
|-------|---------|
| KKV Marketing Automation | 0% |
| KKV Project/Task Automation | 0% |
| Modular State Refactor | 0% |
| Technical Debt Cleanup | 0% |
| CF Hyperdrive D1 | 30% |
| Apify Deep Scraping Agent | 60% |

### ✅ NEMRÉG BEFEJEZETT (Archíválásra vár)

| Track | Eredmény |
|-------|---------|
| AutoGen GitHub Models Pilot | ✅ Befejezve |
| Brunella Federation Phase 5 | ✅ Befejezve |
| Brunella Reflection / Continual Learning | ✅ Befejezve |
| Brunella Zero-Prompt Ephemeral Bridge | ✅ Befejezve |
| MCP Config Sync | ✅ Befejezve |
| n8n Könyvelési Pipeline Phase 1-2 | ✅ Befejezve |
| P-Sales | ✅ Befejezve |
| VSCode Auto-Build Task | ✅ Befejezve |
| Windows Bridge Health Endpoint | ✅ Befejezve |
| Test Cadence Optimization | ✅ Befejezve |

---

## ⚠️ Ismert Buktatók (Frissített)

| Probléma | Megoldás |
|----------|----------|
| `ERR_MODULE_NOT_FOUND` | ESM `.js` kiterjesztés hiányzik → add hozzá |
| `better-sqlite3` Node v24+ ABI hiba | `npm rebuild better-sqlite3` Node upgrade után |
| `federation_replay_nonces_runtime` INSERT | `datetime('now')` explicit értékként — nem DEFAULT |
| `MANIFEST_SIGNING_SECRET` hiányzik | Legalább 32 karakter — fail-closed, nincs fallback! |
| `buildHealthResponse` paraméterszám | Pontosan 10 arg! (ollama, anythingllm, python, n8n, langflow, wab, cloudflare, agentCount, mcpCount, requestId) |
| Dashboard build hiba | `npm run build:ui` — KÜLÖNÁLLÓ Vite build! |
| Agent "stuck" | `setAgentStatus(name, 'idle')` manuálisan |
| GitHub Models 401 | `GITHUB_PAT` lejárt — frissítsd (NEM `GITHUB_TOKEN`) |
| cron-parser v5 | Csak `CronExpressionParser.parse()` érvényes |
| Python Windows emoji log | ASCII: `[OK]` / `[AI]` a UnicodeEncodeError elkerüléséhez |
| Rekurzív MCP spawn | `brunella-core` = `self` entry — NE spawnolj `node ./build/index.js`-t! |
| LanceDB Python import | `try: import lancedb; HAS_LANCEDB = True except: HAS_LANCEDB = False` |

---

## 🔗 Gyors Hivatkozások

| Fájl | Tartalom |
|------|----------|
| `README.md` | 🔴 Fő dokumentáció (MASTER) |
| `CLAUDE.md` | Claude Code gyors referencia |
| `.ai/BOOTSTRAP.md` | 🔴 Projekt összefoglaló |
| `.ai/FOSZAL.md` | 🔴 Egységes agent napló (auto-generált!) |
| `conductor/tracks.md` | 🔴 Aktív track-ek (212 összesen) |
| `mcp_servers.json` | 🔴 MCP auto-start konfiguráció |
| `paios.config.yaml` | PAIOS beállítások (TTS stb.) |
| `logs/phoenix.log` | 🔴 Phoenix Protocol események |

---

## 📝 Változásnapló (v2.4 → v3.5)

### 2026-04-04 (JELENLEG)
- 🆕 **7 KKV Automatizálási Track** — induló fázis
- 🆕 **n8n Bookkeeping Phase 3** — KRITIKUS track nyitva
- 🆕 **Nova Architecture** — Knowledge + Gatekeeper trackek
- 🆕 **Napi Intelligens Briefing** agent
- 🆕 **Logging/Type Safety/Error Handling** cleanup trackek
- 🔧 **Brunella Core Stabilization** — 85%

### 2026-04-01 — 2026-04-03
- ✅ **Federation Phase 5** — Execute Hardening befejezve
- ✅ **Reflection + Continual Learning** befejezve
- ✅ **Ephemeral Agent Bridge** befejezve
- ✅ **AutoGen GitHub Models Pilot** befejezve
- ✅ **MCP Config Sync** befejezve
- ✅ **n8n Könyvelési Pipeline Phase 1-2** befejezve
- ✅ **VSCode Auto-Build + Windows Bridge Health** befejezve

### 2026-03-25 (Előző snapszot — PROJEKT_DIAGRAM.md v2.4.0)
- Kiindulási baseline: 58 agent, 69 route, 33 tool fájl
- Phoenix Protocol v2 aktív
- CEAN Phase 1A-B elkezdve

---

**🔴 FIGYELEM:** Ez az ÉLŐ dokumentum v2-es verziója. Az architektúra változásakor frissíteni KELL!

**Utolsó frissítés:** brunella-orchestrator @ 2026-04-04T18:00:00Z
