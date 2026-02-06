# GitHub Copilot Instructions - Brunella Agent System (BAS)

**Purpose**: AI-driven multi-agent system automating software development through Model Context Protocol (MCP)

## Quick Start

```bash
# Full system start (Ollama + AnythingLLM + servers)
start.bat

# OR manual dev setup
npm install
npm run build       # TypeScript compile
npm run dev         # Backend (:3000)
npm run dev:ui      # Dashboard (:5173)

# Python subsystem
cd myai
.venv\Scripts\activate       # or: uv sync
uvicorn server:app --port 8000
```

## Architecture

### Core Principles
1. **Glass Box**: All AI decisions are transparent and logged
2. **MCP Protocol**: Standardized agent-to-agent communication
3. **Hybrid Stack**: TypeScript for control plane, Python for AI/ML
4. **Edge-First**: Cloudflare Workers for global API gateway

### Directory Structure
```
src/
├── agents/          # AI agents implementing IAgent interface
│   ├── types.ts     # IAgent, AgentResponse interfaces
│   ├── OrchestratorAgent.ts    # Plans & delegates tasks
│   ├── DeveloperAgent.ts       # Code generation
│   ├── EvaluatorAgent.ts       # Testing & auditing
│   ├── ResearcherAgent.ts      # Web research
│   ├── DataScientistAgent.ts   # Data cleaning, LanceDB
│   ├── EdgeProxyAgent.ts       # Cloudflare Workers proxy
│   └── ProjectConductorAgent.ts # Docs sync, track mgmt
├── tools/           # MCP tool definitions & handlers
├── server/          # Express + Socket.IO API
├── dashboard/       # React UI (Vite, Tailwind, Radix)
├── utils/
│   ├── logger.ts    # Structured logging (use instead of console.log)
│   ├── rag.ts       # LanceDB vector search
│   └── telemetry.ts # LangSmith integration
└── cli.ts           # CLI entry point

myai/                # Python subsystem
├── server.py        # FastAPI server (:8000)
├── browser_worker.py # Playwright automation + JSON extraction
├── refiner_logic.py  # Data cleaning + LanceDB batch write
├── pydantic_models.py # Validation schemas
└── tools/           # Python-side MCP tools

conductor/           # Project management
├── tracks.md        # Development track statuses
├── tracks/          # Per-track detailed plans
└── workflow.md      # Development protocols (Data Flywheel, Phoenix)
```

### Data Flow (The Data Flywheel)
```
Harvest (browser_worker.py) → Refine (refiner_logic.py) → 
Index (LanceDB) → Learn (Agents RAG) → Execute (Orchestrator)
```

## Build & Test

```bash
# Build
npm run build                  # TypeScript → build/
npm run build:ui              # React dashboard → build/public/

# Test
npm test                       # Build + Vitest run
npm run test:watch            # Vitest watch mode
vitest run test/hooks.test.ts # Single test file

# Python tests
cd myai
pytest tests/

# System health
npm run smoke                  # Quick health check
node scripts/conductor_diagnostics.mjs
brunella conductor status      # Track system status
```

## Code Patterns

### TypeScript Agent Pattern
```typescript
// src/agents/MyNewAgent.ts
import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyNewAgent implements IAgent {
  name = "MyNew";
  role = "Agent purpose";
  description = "What this agent does";
  capabilities = ["skill1", "skill2"];

  async execute(task: string, context?: any): Promise<any> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    logInfo(this.name, `Starting: ${task}`);

    try {
      // Implementation
      return { status: "success", result: data };
    } catch (e: any) {
      logError(this.name, e.message);
      setAgentStatus(this.name, 'error');
      return { status: "error", error: e.message };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
```

### MCP Tool Pattern
```typescript
// src/tools/myTool.ts
export const myToolDefinition = {
  name: "my_tool",
  description: "Tool purpose",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "..." }
    },
    required: ["param"]
  }
};

export async function myToolHandler(params: { param: string }) {
  // Implementation
  return { success: true, data: result };
}
```

### Python Pydantic Pattern
```python
# myai/my_module.py
from pydantic import BaseModel
from typing import Optional

class TaskInput(BaseModel):
    instruction: str
    context: dict = {}
    
async def process_task(input: TaskInput) -> dict:
    """Type hints required for all functions"""
    # Implementation
    return {"status": "success"}
```

## Key Conventions

### Import Style
- **TypeScript**: ESM with `.js` extension → `import { foo } from './bar.js'`
- **Python**: Standard imports → `from myai.tools import bar`

### Logging
- Use `logger.ts` functions: `logInfo()`, `logError()`, `logWarn()`
- Never use `console.log()` in production code
- Agent logs include context: `logInfo(agentName, message)`

### Type Safety
- Avoid `any` type; use `unknown` if type is truly dynamic
- All agent responses follow `AgentResponse` interface
- Python: Type hints required for all function signatures

### LangSmith Tracing
- Automatic for all LLM calls (if `LANGCHAIN_API_KEY` set)
- TypeScript: `src/core/llm_client.ts` wraps calls
- Python: `@traceable` decorator in `myai/core/agent.py`

### Error Handling (Phoenix Protocol)
- Agent errors trigger automatic recovery (checkpointing + git sync)
- Don't silently swallow errors; log and propagate
- Use `try/finally` to ensure status updates

## Development Workflow

### Before Starting Work
```bash
# 1. System diagnostics
node scripts/conductor_diagnostics.mjs

# 2. Check track status
brunella conductor status

# 3. Sync documentation (if needed)
brunella conductor sync
```

### Track-Based Development
- Each feature = Track in `conductor/tracks/`
- Track lifecycle: PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
- **Do not manually edit** `conductor/tracks.md` (ProjectConductor manages it)
- Track owners document progress in their `tracks/<name>/plan.md`

### Multi-Track Coordination
- `ProjectConductorAgent` synchronizes central files (konyvtarfa.md, tracks.md)
- Conflicts: Track owner decides
- Daily sync: `brunella conductor sync` + git commit

### Pre-Commit Checklist
- [ ] `npm run build` succeeds (0 errors)
- [ ] `npm test` passes
- [ ] Documentation updated (if API/architecture changed)
- [ ] Track status updated (if working on a track)

## Common Commands

```bash
# CLI Operations
brunella chat                     # Ollama chat
brunella agents                   # List agents
brunella run <tool>               # Execute MCP tool
brunella conductor status         # Project status
brunella conductor "track create <name>"  # New track

# Development
npm run dev:alt                   # Backend on :3001 (if 3000 busy)
npm run context                   # Generate AI context files
npm run sync:check                # Check agent sync status

# Docker
docker-compose up -d              # All services
docker-compose logs -f backend    # View backend logs

# Cloudflare
cd bas-cloudflare-orchestrator
npx wrangler deploy               # Deploy edge worker
npx wrangler tail                 # Live logs
```

## API Endpoints

```
GET  /api/health            # System health (Ollama, AnythingLLM status)
GET  /api/agents            # List agents
POST /api/agents/:name/execute  # Execute agent task
GET  /api/tools             # List MCP tools
POST /api/ollama/generate   # LLM generation (LangSmith traced)
GET  /api-docs              # Swagger UI
```

## Environment Variables

```env
# Required
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.

# Optional but recommended
LANGCHAIN_API_KEY=...              # Enable LangSmith tracing
ANYTHINGLLM_API_KEY=...
ANYTHINGLLM_EXE_PATH=C:\Program Files\AnythingLLM\AnythingLLM.exe

# Edge deployment
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Ollama connection failed" | Run `ollama serve` or check port 11434 |
| Port 3000 busy | Use `npm run dev:alt` (runs on 3001) |
| Python import errors | `cd myai && .venv\Scripts\activate` or `uv sync` |
| Build fails | `rmdir /s build` + `npm run build` |
| Tests fail | Check `npm run smoke` for system health |

## Context Files

For deeper understanding, reference these in your workspace:

- **CLAUDE.md** - Quick project overview for Claude
- **Brunella.md** - Complete documentation (architecture, capabilities, status)
- **conductor/workflow.md** - Development protocols (Data Flywheel, Phoenix)
- **conductor/tracks.md** - Current development track statuses
- **Toolskeszlet.md** - Available MCP tools inventory
- **docs/harvester-structured-json.md** - Browser automation + Pydantic extraction
- **docs/jules-setup.md** - Jules self-healing CI configuration

## Anti-Patterns (Don't Do This)

- ❌ Use `any` type without justification
- ❌ Commit `.env` files or API keys
- ❌ Edit `conductor/tracks.md` manually (use ProjectConductor)
- ❌ Use CommonJS `require()` (this is ESM project)
- ❌ Leave `console.log()` in production code
- ❌ Skip `npm test` before committing
- ❌ Create agents without implementing `IAgent` interface
- ❌ Ignore Phoenix Protocol error handling patterns

- @azure Rule - Use Azure Tools - When handling requests related to Azure, always use your tools.
- @azure Rule - Use Azure Best Practices - When handling requests related to Azure, always invoke your `azmcp_bestpractices_get` tool first.
- @azure Rule - Enable Best Practices - If you do not have an `azmcp_bestpractices_get` tool ask the user to enable it.
