# Implementation Plan: System Cleanup, Dockerization & Agent Integration

## Phase 1: Inventory & Documentation Consolidation (Leltár és Centralizáció)
- [ ] Task: Create `_archive` directory structure.
- [ ] Task: **Audit & Consolidation Script (Dry Run)**
    - Implement a script (`scripts/audit_workspace.ts`) to scan `F:\mcp-brunella-core`.
    - Logic: List all `.md` files in root, `myai/agents`, `01_AI_ML_Projects`, `_KNOWLEDGE_BASE`.
    - Output: A JSON report proposing which files to keep, merge, or archive based on heuristics (size, last modified, keywords).
- [ ] Task: **Content Merge Implementation**
    - Enhance script to read content of files marked for merge.
    - Append structured content to `Brunella.md` (Project Info) or `konyvtarfa.md` (Structure).
    - Backup original files to `_archive/merged_content/`.
- [ ] Task: **Execute Cleanup**
    - Run the script in "execute" mode.
    - Delete merged/archived files from root.
    - Verify `Brunella.md` and `konyvtarfa.md` integrity.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Inventory' (Protocol in workflow.md)

## Phase 2: Containerization (Dockerizálás)
- [ ] Task: **Review Dockerfiles**
    - Check `Dockerfile.node` and `Dockerfile.python` for completeness (dependencies, ports).
    - Update if necessary (e.g., adding `uv` or `npm` specific flags).
- [ ] Task: **Create/Update docker-compose.yml**
    - Define `brunella-core` (Node.js) service.
    - Define `brunella-ai` (Python) service.
    - Configure networking between them.
    - Set up bind mounts for `src/` and `myai/` folders (Hot Reload support).
    - Map necessary ports (3000, 8000, etc.).
- [ ] Task: **Test Container Build & Run**
    - Run `docker-compose build`.
    - Run `docker-compose up -d`.
    - Verify connectivity between services.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Dockerization' (Protocol in workflow.md)

## Phase 3: Agent Integration (Brunella CLI)
- [ ] Task: **Register Agents in Brunella Core**
    - Locate `src/agents/registry.json` (or equivalent registry mechanism).
    - Add entries for `project_organizer` and `agent_architect`.
    - Ensure paths point to the TOML/Prompt files (migrated to `myai/agents/`).
- [ ] Task: **Implement Brunella CLI Command Handlers**
    - Update `src/cli.ts` to recognize the new agent names.
    - Ensure the CLI can instantiate the agents and pass user input correctly.
- [ ] Task: **End-to-End Smoke Test**
    - Run `npm run cli -- project_organizer --help` (or equivalent).
    - Run a test task: "Brunella CLI, please organize the `scripts` folder."
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Agent Integration' (Protocol in workflow.md)
