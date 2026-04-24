# GEMINI.md - Brunella Agent System (BAS)

**Version:** 2.4.0
**Last Updated:** 2026-04-20

This document provides the necessary context for an AI agent to understand and work on the Brunella Agent System (BAS).

---

## 1. 🏗️ Project Overview

The **Brunella Agent System (BAS)** is a hybrid, multi-agent AI ecosystem designed for software development, research, and business process automation.

**Core Architecture:**

*   **Backend (Orchestration):** A Node.js/TypeScript application using Express.js for the API, Socket.IO for real-time communication, and the Model Context Protocol (MCP) for agent interaction.
*   **AI Subsystem (Intelligence):** A Python application using FastAPI to serve AI/ML models, perform browser automation with Playwright, and handle Retrieval-Augmented Generation (RAG) with LanceDB.
*   **Frontend (Dashboard):** A React application built with Vite and styled with TailwindCSS, providing a user interface for monitoring and controlling the system.
*   **AI Models:** The system is designed to work with both local models via Ollama and cloud-based models like Google's Gemini and GitHub's Copilot.
*   **Database:** SQLite is used for task queuing and metadata, while LanceDB is used for vector storage and retrieval.

**Key Features:**

*   **Multi-Agent System:** The system has a registry of 79 specialized agents for various tasks.
*   **Self-Healing:** The "Phoenix Protocol" allows the system to detect failures and automatically restart or recover.
*   **Extensible Tooling:** The MCP server provides a set of tools that agents can use to interact with the system and the environment.
*   **CI/CD:** The project uses GitHub Actions for continuous integration and testing.
*   **Containerization:** Docker is used for creating reproducible development and production environments.

---

## 2. 🔧 Building and Running

### Prerequisites

*   Node.js
*   Python (with `uv` for package management)
*   Docker
*   Ollama (for local AI models)

### Development Environment

1.  **Install Dependencies:**
    *   Node.js: `npm install`
    *   Python: `cd myai && uv sync`

2.  **Run the System:**
    *   **All-in-one (recommended for Windows):**
        ```bash
        inditas.bat
        ```
    *   **Manually (in separate terminals):**
        1.  **Python Backend:**
            ```bash
            cd myai
            uvicorn server:app --reload --port 8000
            ```
        2.  **Node.js Backend:**
            ```bash
            npm run dev
            ```
        3.  **Frontend Dashboard:**
            ```bash
            npm run dev:ui
            ```

### Docker

You can also run the system using Docker Compose:

```bash
docker-compose up --build
```

---

## 3. 🧪 Testing

The project uses Vitest for unit and integration testing, and Playwright for end-to-end testing.

*   **Run all tests:**
    ```bash
    npm test
    ```
*   **Run fast tests (unit tests):**
    ```bash
    npm run test:fast
    ```
*   **Run tests in watch mode:**
    ```bash
    npm run test:watch
    ```
*   **Run Python tests:**
    ```bash
    cd myai
    pytest
    ```

---

## 4. 📖 Development Conventions

*   **Code Style:** The project uses ESLint for TypeScript and likely a similar tool for Python. Adhere to the existing code style.
*   **Modularity:** The project is highly modular, with clear separation of concerns between the Node.js backend, Python subsystem, and React frontend.
*   **Agent Implementation:** New agents should implement the `IAgent` interface or extend the `BaseAgent` class, as defined in `src/agents/`.
*   **MCP Tools:** New tools should be defined in `src/tools/` and registered in `src/server/registry.ts`.
*   **Logging:** Use the provided logger in `src/utils/logger.ts` instead of `console.log`.
*   **ESM Modules:** The TypeScript code uses ESM modules, so all relative imports must include the `.js` extension.
*   **Documentation:** For any new feature, update the relevant documentation, especially the `README.md`.

---

## 5. 📂 Key Directories and Files

*   `.ai/`: Coordination and logging for AI agents. **Read `FOSZAL.md` first.**
*   `conductor/`: Project management, tracks, and workflow definitions.
*   `src/`: TypeScript source code for the backend and frontend.
    *   `src/agents/`: Agent implementations and registry.
    *   `src/tools/`: MCP tool definitions.
    *   `src/server/`: Express.js server and MCP tool registry.
    *   `src/dashboard/`: React frontend application.
    *   `src/core/`: Core logic, including LLM clients and the Phoenix Protocol.
*   `myai/`: Python source code for the AI subsystem.
    *   `myai/server.py`: FastAPI server.
    *   `myai/browser_worker.py`: Playwright automation.
*   `README.md`: The master document for the project.
*   `package.json`: Node.js project definition and scripts.
*   `pyproject.toml`: Python project definition and dependencies.
*   `docker-compose.yml`: Docker service definitions.
* `mcp_servers.json`: Configuration for all MCP servers.

---

## 6. 📝 Recent Updates & Audit (2026-04-22)

### System Audit and Critical Fixes
- **Dashboard Rendering:** Resolved a critical issue where the Node `events` module was externalized by Vite, causing the frontend build to crash in the browser. 
  - *Fix:* Implemented `packages/utils/events-shim.ts`, added `events` alias to `vite.config.ts`, and a global fallback in `index.html`.
- **LLM Stability:** Fixed an infinite recursion bug in `llm_client.ts` during fallback (Gemini ↔ Ollama), which caused OOM crashes. Added `isFallback` guard.
- **Universal Logger:** Standardized `packages/utils/logger.ts` to be fully compatible with both Node.js and Browser environments. Fixed function signatures to handle flexible argument counts.
- **Test Suite Optimization:**
  - Fixed relative paths in `ev_hunter_research.test.ts` and `linuxRuntimeThresholdLoader.test.ts`.
  - Updated `AIAgentBriefingPanel.test.tsx` to match current Hungarian UI labels ("Jelentés" instead of "Összefoglaló").
  - Enhanced `setup-ui.ts` with a robust `react-i18next` global mock.
- **Phoenix Protocol:** Verified recovery logic and event bus connectivity.

