# AGENTS.md - The Unified Agent Protocol for Cogella Core

## 1. System Context
**Product:** Cogella Core (Brunella Agent System Backend & Dashboard)
**Role:** Central Gateway & Orchestrator via MCP Protocol.
**Tech Stack:** TypeScript (Node.js), Express, Socket.io, MCP SDK, LanceDB, SQLite.
**Frontend:** React (Vite) Dashboard.

## 2. Agent Roster

### 🤖 Jules (External - Google Cloud / CLI)
**Role:** Hybrid DevOps Partner & QA Lead.
**Interface:** `jules` CLI or Web UI.
**Access Level:** White Box (Source Code, Logs, DB, Config).
**Responsibilities:**
1.  **Continuous Testing:** Execute scenarios from `testing/TEST_BOOK.md`.
2.  **Log Analysis:** Monitor `logs/web_ui.log` and `logs/agent-manager.log` for anomalies.
3.  **Refactoring:** Proactively improve code quality in `src/`.
4.  **Bug Fixing:** Diagnose and patch issues based on test failures or logs.

**Operational Guidelines for Jules:**
- **Always check `testing/TEST_BOOK.md`** first to understand the expected behavior.
- **Use `npm test`** to verify backend logic.
- **Use `npm run smoke`** for quick system health checks.
- **Logs are your eyes:** Check `logs/` directory frequently.

### 👩‍💼 Brunella (Internal - Orchestrator)
**Role:** Primary Assistant & Task Delegator.
**Capabilities:** Uses internal tools (RAG, Browser) to serve user requests.

### 🕵️ Researcher (Internal)
**Role:** Knowledge gathering via RAG.

### 👨‍💻 Developer (Internal)
**Role:** Code generation via LLM Pipeline.

## 3. Interaction Protocol
- **Jules to System:** Jules operates via GitHub PRs, Issues, and direct code access (if running locally via CLI).
- **System to Jules:** Logs and Test Reports are the primary feedback mechanism.

## 4. Key Directories
- `src/`: Backend source code.
- `src/dashboard/`: Frontend source code.
- `conductor/`: Project management & plans.
- `logs/`: Runtime logs & SQLite DB (`brunella.db`).
- `testing/`: Semantic Test Book (`TEST_BOOK.md`).
