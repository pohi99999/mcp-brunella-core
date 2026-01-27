# Technology Stack - MCP Brunella Core

## Backend
- **Core Runtime:** Node.js (TypeScript) & Python 3.14+
- **Agent Infrastructure:** Supervisor (Process Mgmt), Router (Message Bus), BUAP (JSON-RPC Protocol)
- **Communication:** Model Context Protocol (MCP) SDK, FastMCP (Python)
- **API Framework:** Express.js (Node.js), FastAPI (Python)
- **Real-time:** Socket.io for live updates
- **Validation:** Zod for schema-based type safety

## Frontend (Dashboard)
- **Framework:** React 19 (Vite)
- **Styling:** Tailwind CSS 4, Radix UI primitives
- **Icons:** Lucide React, Phosphor Icons
- **State Management:** Zustand
- **Visualization:** D3.js, Recharts, Three.js

## Data & Storage
- **Vector Database:** LanceDB (for context and knowledge retrieval)
- **Relational Database:** Better-SQLite3 (for logs and metadata)

## Tools & Utilities
- **Automation/Scraping:** Playwright
- **Security:** vm2 for sandboxed code execution
- **CLI:** Commander.js, Inquirer, Chalk (Interaktív menürendszer)
- **Build/Package:** npm, uv (Python)

## Agent Frameworks (Planned)
- **Orchestration:** LangGraph (Python/JS)
- **Multi-Agent:** Microsoft AutoGen, CrewAI
- **Generative UI:** CoPilotKit