# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI multi-agent system (Brunella Agent System) automating software development via local LLMs (Ollama), MCP protocol, and hybrid Node.js/Python architecture.

## Quick Start

```bash
# Full system (Windows) - starts Ollama + AnythingLLM + server
start.bat

# OR manually:
npm install && npm run build
npm run dev          # Backend (port 3000)
npm run dev:ui       # Frontend (port 5173)

# Python subsystem (uv preferred)
cd myai && uv sync && uvicorn server:app --reload --port 8000
```

## Commands

```bash
# Build & Run
npm run build        # TypeScript compile
npm run dev          # Dev server (tsx watch, port 3000)
npm run dev:alt      # Alt port (3001) if 3000 busy
npm run dev:ui       # Vite Dashboard (port 5173)

# Testing
npm test                           # Build + Vitest run
npm run test:watch                 # Vitest watch mode
npx vitest run test/foo.test.ts   # Single test file

# CLI
brunella conductor status      # Project status
brunella chat                  # Ollama chat
brunella agents                # List agents
brunella run <tool>            # Run MCP tool

# Docker
docker-compose up -d           # All services
```

## Architecture

### Directory Structure

```
src/
├── agents/          # AI agents implementing IAgent interface
│   ├── types.ts     # IAgent, AgentResponse interfaces
│   └── *.ts         # Agent implementations
├── tools/           # MCP tool definitions & handlers
├── server/          # Express + Socket.IO API
├── dashboard/       # React UI (Vite, Tailwind, Radix)
├── utils/
│   ├── logger.ts    # Structured logging (use instead of console.log)
│   └── rag.ts       # LanceDB vector search
└── cli.ts           # CLI entry point

myai/                # Python subsystem
├── server.py        # FastAPI server (:8000)
├── browser_worker.py # Playwright automation + JSON extraction
├── refiner_logic.py  # Data cleaning + LanceDB batch write
└── pydantic_models.py # Validation schemas

conductor/           # Project management
├── tracks.md        # Development track statuses
├── tracks/          # Per-track detailed plans
└── workflow.md      # Development protocols (Data Flywheel, Phoenix)
```

### Agent Hierarchy

```
OrchestratorAgent (Planner & Dispatcher)
  ├── DeveloperAgent     - Code writing, Python execution
  ├── EvaluatorAgent     - Audit, testing, code review
  ├── ResearcherAgent    - Web search, info gathering
  ├── DataScientistAgent - Data cleaning, LanceDB
  ├── EdgeProxyAgent     - Cloudflare Workers proxy
  └── ProjectConductor   - Docs sync, track management
```

`AgentManager` handles registry (`src/agents/registry.json`) and Task Queue (SQLite).

## Code Patterns

### TypeScript Agent Pattern
```typescript
import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyNewAgent implements IAgent {
  name = "MyNew";
  role = "Agent purpose";
  description = "What this agent does";
  capabilities = ["skill1", "skill2"];

  async execute(task: string, context?: any): Promise<any> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // Implementation
      return { status: "success", result: data };
    } catch (e: any) {
      logError(this.name, e.message);
      return { status: "error", error: e.message };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
```

### MCP Tool Pattern
```typescript
export const myToolDefinition = {
  name: "my_tool",
  description: "Tool purpose",
  inputSchema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"]
  }
};

export async function myToolHandler(params: { param: string }) {
  return { success: true, data: result };
}
```

## Key Conventions

- **Imports:** ESM with `.js` extension → `import { foo } from './bar.js'`
- **Logging:** Use `logger.ts` functions (`logInfo()`, `logError()`), never `console.log()`
- **Types:** Avoid `any`; use `unknown` if type is truly dynamic
- **Agent responses:** Follow `AgentResponse` interface (`status: 'success' | 'error' | 'delegated'`)

## Environment Variables (.env)

```env
OLLAMA_BASE_URL=http://localhost:11434
LANGCHAIN_API_KEY=...              # LangSmith tracing
ANYTHINGLLM_API_KEY=...
BRUNELLA_WORKSPACE_ROOT=.
```

## API Endpoints

- `GET /api/health` - System health
- `GET /api/agents` - List agents
- `POST /api/agents/:name/execute` - Execute agent
- `GET /api/tools` - MCP tools
- `POST /api/ollama/generate` - LLM generation
- `GET /api-docs` - Swagger UI

## Development Rules

1. **Conductor protocol:** Check `conductor/tracks.md` before major changes
2. **Track system:** New feature = new track in `conductor/tracks/`
3. **Testing:** `npm test` must pass before commit
4. **Types:** TypeScript strict mode, avoid `any`
5. **Do not manually edit** `conductor/tracks.md` (ProjectConductor manages it)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Ollama connection failed" | Run `ollama serve` |
| Port 3000 busy | `npm run dev:alt` (port 3001) |
| Python import errors | `cd myai && uv sync` |
| Build fails | `rmdir /s build` + `npm run build` |

## Data Flywheel

```
Harvest (browser_worker.py) → Refine (refiner_logic.py) →
Index (LanceDB) → Learn (Agents RAG) → Execute (Orchestrator)
```

## Anti-Patterns (Avoid)

- Using `any` type without justification
- CommonJS `require()` (this is ESM)
- Leaving `console.log()` in production code
- Skipping `npm test` before commits
- Creating agents without implementing `IAgent` interface
- Manually editing `conductor/tracks.md`

## Project Note

Project owner is a creative, non-programmer. Development happens via AI agents. Documentation may be scattered - ask if you find contradictions.
