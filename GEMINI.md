# Brunella Agent System (BAS) - Project Context

## Project Overview
Brunella Agent System (BAS) is a hybrid architecture MCP (Model Context Protocol) server and agentic platform. It combines a Node.js/TypeScript core for orchestration and serving with a Python-based subsystem (`myai`) for complex analysis, sandboxing, and CLI operations. The system is designed as a "digital nervous system" capable of swarm intelligence, data harvesting, and agent training.

## Architecture & Tech Stack
- **Core Server:** Node.js, Express, Socket.IO (TypeScript).
- **Python Subsystem (`myai`):** FastAPI, FastMCP, `uvicorn`. Used for heavy-lifting, dev agents (Planner/Coder), and sandboxing.
- **Frontend Dashboard:** React, Vite, TailwindCSS, Radix UI (`src/dashboard`).
- **Data & Storage:** LanceDB (Vector DB), SQLite (`brunella.db`, `agents.db`), Local Filesystem.
- **AI Integration:** Ollama (Local LLMs), AnythingLLM, Google Vertex AI (Cloud).
- **Protocol:** Model Context Protocol (MCP) for tool and resource exposure.

## Key Components
- **Brunella (Orchestrator):** The central internal agent managing tasks and tools.
- **Jules (External QA/DevOps):** An agent responsible for continuous testing, log analysis, and refactoring.
- **Harvester Swarm:** Components responsible for data collection from web sources.
- **Refiner Factory:** Processes raw data into structured formats (JSON/Vector).
- **Conductor:** A project management module (`conductor/`) tracking tracks, plans, and product definitions.

## Setup & Running

### Prerequisites
- Node.js (v20+)
- Python (v3.14+)
- Ollama (running locally)

### Quick Start
The project includes a unified startup script:
```bash
start.bat
```
This script launches Ollama, AnythingLLM, and the BAS Server.

### Manual Commands
- **Install JS Dependencies:** `npm install`
- **Build JS Core:** `npm run build`
- **Start JS Server:** `npm start`
- **Run CLI:** `npm run cli` or `brunella <command>`
- **Dashboard Dev:** `npm run dev:ui`

### Python Environment
Dependencies are managed via `uv` or `pip`.
- Config: `pyproject.toml`
- Entry: `src/main.py` or `myai/cli.py`

## Development Conventions

### Structure
- `src/`: Core TypeScript source code.
  - `server/`: Express/MCP server logic.
  - `agents/`: Agent definitions.
  - `tools/`: MCP tool implementations.
  - `dashboard/`: React frontend.
- `myai/`: Python agentic subsystem.
- `conductor/`: Project documentation and management (Tracks, Plans).

### Testing
- **Unit/Integration:** `npm test` (uses `vitest` and custom runners).
- **E2E:** `npm run test:e2e` (Playwright).
- **Smoke Tests:** `npm run smoke`.
- **Python Tests:** `npm run test:python`.

### Documentation
- **API/Tools:** `Toolskeszlet.md`
- **Architecture:** `AGENTS.md`, `conductor/*.md`
- **Logs:** `logs/` directory.

## Current Status (Conductor)
Check `conductor/tracks.md` for active development tracks and `CONDUCTOR_PLAN.md` for the roadmap.
