# Implementation Plan - Dashboard Integration & Enhancement

## Phase 1: Code Integration & Environment Setup
- [x] Task: Import Dashboard Source Code
    - [x] Clone/Download `mcp-brunella-core-ir` repository.
    - [x] Analyze structure and copy relevant source code to `src/dashboard` (or `frontend`).
    - [x] Copy static assets to `public/`.
- [x] Task: Merge Dependencies & Configuration
    - [x] Analyze `package.json` from IR repo and merge dependencies into project root `package.json`.
    - [x] Configure build tool (Vite/Webpack) for the frontend within the monorepo structure.
    - [x] Create/Update `tsconfig.json` for frontend specific needs.
- [x] Task: Setup Build Pipelines
    - [x] Create npm scripts for building the dashboard (`npm run build:ui`).
    - [x] Create npm scripts for developing the dashboard (`npm run dev:ui`).
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [checkpoint: d730a1f]

## Phase 2: Backend Integration (Serving & MCP)
- [x] Task: Serve Dashboard Static Files
    - [x] TDD: Create tests for static file serving in `src/server/web.ts`.
    - [x] Implement static file serving in Express (`src/server/web.ts`) to serve the build output.
- [x] Task: MCP Client-Server Bridge
    - [x] TDD: Verify MCP endpoint availability/connectivity for the frontend.
    - [x] Ensure frontend MCP client configuration points to the correct backend WebSocket/HTTP endpoints.
    - [x] Verify basic "Ping" or "ListTools" functionality from the integrated dashboard.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) [checkpoint: ea9d028]

## Phase 3: Agent Management System Implementation
- [x] Task: Agent Listing & Visualization UI
    - [x] TDD: Mock API endpoints (if needed) or MCP tool responses for listing agents.
    - [x] Implement/Refactor UI to list all registered agents from `src/agents/registry.json`.
    - [x] Visual representation of Agent capabilities (tools).
- [x] Task: Agent Configuration & Tool Assignment
    - [x] TDD: Create tests for Agent configuration updates.
    - [x] Implement UI for editing agent tool assignments.
    - [x] Implement backend logic (via MCP tool or API) to save configuration changes.
- [x] Task: Agent Orchestration UI
    - [x] Implement UI for composing agents (visualizing hierarchy).
    - [x] Implement controls to send direct instructions/messages to specific agents.
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) [checkpoint: 4a7b418]

## Phase 4: System Monitoring & Jules Reporting
- [x] Task: System Health Dashboard
    - [x] TDD: Create health check data providers.
    - [x] Implement UI widgets for CPU, Memory, Docker Sandbox status, Ollama status.
- [x] Task: RAG & Knowledge Base Visualization
    - [x] Implement UI to visualize LanceDB status/stats.
    - [x] Implement a "Search Tester" widget to verify RAG retrieval results.
- [x] Task: Jules Report UI
    - [x] Design data structure for "Jules Reports" (JSON/Markdown logs).
    - [x] Implement UI to list and view generated test reports/logs.
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md) [checkpoint: aa08201]

## Phase 5: Semantic Testing Infrastructure (Jules)
- [ ] Task: Create Semantic Test Book
    - [ ] Draft `testing/TEST_BOOK.md` with initial "smoke test" scenarios (Login, List Agents, Check Health).
    - [ ] Define success criteria format for Jules.
- [ ] Task: Jules Self-Testing Validation
    - [ ] Perform a guided run where Jules executes a scenario from `TEST_BOOK.md`.
    - [ ] Refine the Test Book based on Jules' feedback/performance.
- [ ] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)
