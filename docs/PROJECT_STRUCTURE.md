# Brunella Agent System - Project Structure

> **Version:** 2.4.0 (Green Lightning Phase)
> **Last Updated:** 2026-02-18 (Post-Cleanup Phase)
> **Status:** ✅ Production Ready

---

## 📂 ROOT LEVEL DIRECTORIES (CRITICAL ONLY)

```
f:\mcp-brunella-core/
├── 🔴 CORE SYSTEM (DO NOT MOVE)
│   ├── src/                 ← TypeScript backend (Node.js ESM)
│   ├── myai/                ← Python subsystem (FastAPI)
│   ├── test/                ← Vitest test suite
│   └── build/               ← Compiled output (gitignored)
│
├── 🟡 PROJECT MANAGEMENT
│   ├── conductor/           ← Track system (meta.json, tracks/)
│   ├── docs/                ← Master documentation
│   ├── scripts/             ← Build & automation scripts
│   └── data/                ← Runtime databases (SQLite, LanceDB)
│
├── 🔧 CONFIGURATION & INTEGRATION
│   ├── .github/             ← GitHub Actions CI/CD
│   ├── .ai/                 ← Agent brain (FOSZAL.md, logs)
│   ├── .vscode/             ← VS Code settings & tasks
│   ├── .husky/              ← Git pre-commit hooks
│   ├── .wrangler/           ← Cloudflare Workers config
│   ├── config/              ← App configuration
│   ├── cloudflare/          ← Cloudflare project (Edge)
│   ├── bas-cloudflare-**/   ← Cloudflare subprojects
│   └── node_modules/        ← npm dependencies
│
├── 📚 KNOWLEDGE BASE
│   └── _KNOWLEDGE_BASE/     ← AI knowledge documents
│
├── 🛠️ DEVELOPMENT TOOLS
│   ├── agentenv/            ← Agent development environment
│   ├── actions-runner/      ← GitHub Actions runner
│   ├── bin/                 ← Binary tools & utilities
│   ├── schemas/             ← Data schema definitions
│   ├── public/              ← Static assets
│   ├── ADR/                 ← Architecture Decision Records
│   └── logs/                ← System logs
│
├── 📦 ARCHIVE (LEGACY & CLEANUP)
│   └── archive/             ← Consolidated archive structure
│       ├── build-cache/     ← Python cache (.mypy, .pytest, .lancedb)
│       ├── ide-metadata/    ← IDE configs (.qodo, .project, .projectmanager)
│       ├── legacy-archive/  ← Older archive (conductor/, docs/, deleted_files/)
│       ├── old-projects/    ← Deprecated projects (ext_research, UIX, testing)
│       ├── temp-data/       ← Temp data (_br_temp, _diag, files/, lancedb tests)
│       └── test-artifacts/  ← Test results (playwright-report/)
│
└── 📄 ROOT LEVEL CONFIGURATION FILES
    ├── README.md                    ← Master documentation (START HERE!)
    ├── CLAUDE.md                    ← AI coding instructions
    ├── package.json                 ← npm dependencies
    ├── tsconfig.json                ← TypeScript configuration
    ├── vite.config.ts               ← Vite build config
    ├── vitest.config.ts             ← Test configuration
    ├── eslint.config.js             ← Linting rules
    ├── tailwind.config.js            ← Tailwind CSS config
    ├── playwright.config.ts          ← Playwright browser testing
    ├── .env                         ← Environment variables
    ├── .gitignore                   ← Git ignore rules
    ├── .mcp.json                    ← MCP server configuration
    └── docker-compose.yml           ← Docker service definitions
```

---

## 🏗️ CRITICAL SYSTEM COMPONENTS

### Core Architecture (src/)

```
src/
├── agents/                  ← 19+ AI agents (orchestrator, developer, qa, etc.)
│   ├── registry.json        ← Agent registration
│   ├── types.ts             ← IAgent interface
│   └── *.ts                 ← Individual agent implementations
│
├── tools/                   ← MCP tool definitions (60+ tools)
│   ├── definitions/
│   └── handlers/
│
├── server/                  ← Express + Socket.IO backend
│   ├── web.ts               ← Main server
│   ├── routes/              ← REST API endpoints
│   ├── websocket/           ← Real-time communication
│   └── registry.ts          ← MCP tool registration
│
├── dashboard/               ← React 19 UI (Vite + Tailwind)
│   ├── components/
│   ├── pages/
│   ├── lib/
│   └── assets/
│
├── core/                    ← Core utilities
│   ├── llm_client.ts        ← LLM providers (Ollama, Gemini, GitHub)
│   ├── bifrost_gateway.ts   ← Multi-provider LLM gateway
│   └── agent_manager.ts     ← Agent lifecycle management
│
├── utils/                   ← Helper utilities
│   ├── logger.ts            ← Structured logging
│   ├── pythonShell.ts       ← Python interop
│   ├── rag.ts               ← LanceDB vector search
│   └── systemHealth.ts      ← Phoenix Protocol heartbeat
│
└── index.ts                 ← MCP server entry point
```

### Python Subsystem (myai/)

```
myai/
├── server.py                ← FastAPI server (:8000)
├── browser_worker.py        ← Playwright automation
├── refiner_logic.py         ← Data cleaning + LanceDB
├── pydantic_models.py       ← Validation schemas
└── agents/
    ├── a2a-go/              ← Go agents
    ├── openai-agents-python/← OpenAI agents (Python)
    ├── openai-agents-js/    ← OpenAI agents (JavaScript)
    └── workers/             ← Cloudflare Workers
        ├── cean-*/ (Edge agents)
        └── schema/d1_schema.sql (Database schema)
```

### Testing Infrastructure (test/)

```
test/
├── *.test.ts                ← Vitest unit tests (100+ tests)
├── vitest.config.ts         ← Test configuration
└── fixtures/                ← Test data & mocks
```

### Project Management (conductor/)

```
conductor/
├── tracks.md                ← Active & archived tracks
├── project_state.json       ← Global project state
├── meta-schema.json         ← Track metadata schema
├── workflow.md              ← Development protocols (Data Flywheel, Phoenix)
└── tracks/                  ← Individual track folders
    ├── cloudflare_edge_agents_network_20260215/
    ├── cean_operations_center_ui_20260215/
    └── ... (47 total tracks)
```

---

## 🔄 DATA FLOW & INTEGRATION

### System Startup Order

```
1. Ollama (:11434)           ← LLM Engine
2. Python FastAPI (:8000)    ← Python subsystem
3. MCP Brunella Core (:3000) ← Main orchestrator
4. Vite Dashboard (:5173)    ← Web UI
5. Optional: AnythingLLM     ← Knowledge base indexing
```

### Request Flow

```
Dashboard (React) → API (:3000/api/*) → Agent → Tools → Ollama/:8000
                                        ↓
                                   LanceDB RAG
                                   SQLite DB
                                   Playwright
```

---

## 📊 CONFIGURATION REFERENCE

### Critical .env Variables

```env
# LLM Providers
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=<if using Google Gemini>
GITHUB_PAT=<if using GitHub Models>

# System
BRUNELLA_WORKSPACE_ROOT=.
NODE_ENV=development

# Optional
LANGCHAIN_API_KEY=<for LangSmith tracing>
CLOUDFLARE_API_TOKEN=<for Cloudflare deployment>
GITHUB_WEBHOOK_SECRET=<for GitHub webhooks>
```

### mcp.json (MCP Servers)

```json
{
  "mcpServers": {
    "filesystem": {...},
    "ollama": {...},
    "python": {...},
    "playwright": {...},
    ...
  }
}
```

---

## 🗂️ ARCHIVE STRUCTURE (POST-CLEANUP)

The `archive/` folder consolidates all legacy, temporary, and cache materials:

```
archive/
├── build-cache/      (Python: .mypy_cache, .pytest_cache, coverage, .lancedb)
├── ide-metadata/     (IDE configs: .qodo, .project, .projectmanager)
├── legacy-archive/   (Older archived data: conductor/, docs/, deleted_files/)
├── old-projects/     (Deprecated: external_research/, UIX, testing/, externals/)
├── temp-data/        (Temporary: _br_temp/, _diag/, files/, lancedb tests/)
└── test-artifacts/   (Test outputs: playwright-report/, test-results/)
```

**Size:** ~2.5 GB (safely isolated, not in hot path)

---

## 🚀 QUICK COMMANDS

```bash
# Development
npm install              # Install dependencies
npm run build            # TypeScript compile
npm run dev              # Backend dev server
npm run dev:ui           # Dashboard dev server
npm test                 # Run Vitest
npm run test:watch       # Test watch mode

# Python Subsystem
cd myai && uv sync       # Install Python deps
uvicorn server:app --reload  # Run FastAPI

# Git & Deployment
npm run sync             # GitHub sync (git add/commit/push)
wrangler deploy          # Deploy to Cloudflare Workers
npm run docker           # Docker Compose startup
```

---

## 📋 COMMON PATHS

| Purpose | Path |
|---------|------|
| Agent Registry | `src/agents/registry.json` |
| Track Active | `conductor/tracks.md` |
| Test Results | `test-results/`, archived in `archive/test-artifacts/` |
| Logs | `logs/`, `.ai/` |
| Database | `data/brunella.db` |
| Compiled JS | `build/` |
| Env Config | `.env` |

---

## 🔒 GITIGNORE STRATEGY

**Ignored (Security & Performance):**
- `.env` - Environment secrets
- `node_modules/` - npm dependencies
- `build/` - Compiled output
- `*.log` - Log files
- `data/developer_metrics.json` - Runtime state
- `archive/` - Legacy content

**Committed (Essential):**
- All source code (`src/`, `myai/`)
- Configuration (`package.json`, `tsconfig.json`, etc.)
- Tests (`test/`)
- Docs (`docs/`, `conductor/`, `.ai/`)

---

## 🏥 HEALTH CHECKS

```bash
# System Status
curl http://localhost:3000/api/health

# Agents List
curl http://localhost:3000/api/agents

# MCP Tools
curl http://localhost:3000/api/tools

# Ollama Status
curl http://localhost:11434/api/tags
```

---

## 📖 DOCUMENTATION INDEX

Start here based on your role:

- **Developers:** `README.md` → `CLAUDE.md` → `src/agents/types.ts`
- **DevOps:** `README.md` → `conductor/workflow.md` → `docker-compose.yml`
- **Data Scientists:** `myai/` → `docs/CEAN_R1_VECTOR_MAPPINGS.md`
- **Project Managers:** `conductor/tracks.md` → `.ai/FOSZAL.md`

---

## ✅ POST-CLEANUP CHECKLIST

- [x] Archive created with 6 subcategories
- [x] Root level cleaned (only critical folders)
- [x] Git commit & push done
- [x] This documentation created
- [x] System health verified (922 tests passing)
- [ ] API keys validated (optional step)

---

**Last Cleanup:** 2026-02-18 | **Archive Size:** ~2.5 GB | **Status:** ✅ Production Ready
