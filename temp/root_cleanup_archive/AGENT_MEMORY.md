# Purpose: Unified append-only memory file for all agents working on this repository.

# Brunella Agent Memory
**Purpose:** Accumulated knowledge, decisions, and facts for ALL agents working on this repo.
**Protocol:** Append-only. Never delete entries. Add new entries at the TOP.

***

## 🔴 CRITICAL FACTS (every agent must know)

- **Package manager:** npm ONLY. Do not use pnpm or yarn.
- **Primary runtime:** Node.js (`npm run start:stable`)
- **MCP SDK version:** `@modelcontextprotocol/sdk` ^1.29.0
- **Build output:** `build/` directory (NOT committed to git)
- **TypeScript:** strict mode, ESM modules (`"type": "module"`)
- **Test framework:** Vitest (use `npm run test:master` for full suite)
- **Agent memory:** Write to `_KNOWLEDGE_BASE/` NOT to tool-specific folders

## 🟡 ARCHITECTURAL DECISIONS

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04 | npm is authoritative package manager | pnpm-lock.yaml caused build inconsistencies |
| 2026-04 | `workers/` is the canonical worker directory | Merged from `worker/` and `workers/` |
| 2026-04 | `archive/` is the canonical archive | Merged from `archive/` and `_archive/` |
| 2026-04 | `vitest.master.config.ts` is master test runner | Replaces fragmented config files |

## 🟢 ACTIVE WORK STREAMS

<!-- Agents: add your current task here when starting, mark DONE when complete -->

| Agent | Task | Status | Last Updated |
|-------|------|--------|-------------|
| brunella-orchestrator | Architectural cleanup and runtime unification | IN-PROGRESS | 2026-04-17 |

## 📋 KNOWN ISSUES

<!-- Document discovered bugs, limitations, or workarounds here -->

| Issue | Severity | Discovered | Status |
|-------|----------|-----------|--------|
| pnpm-lock.yaml conflicts with package-lock.json | Medium | 2026-04 | Mitigation: use npm only |
| Multiple vitest configs cause confusion | Low | 2026-04 | Fixed: use vitest.master.config.ts |
| `test/cloudflare_core.test.ts` used `self` in a Node test double | Medium | 2026-04 | Pending fix in cleanup run |

## 🔧 ENVIRONMENT SETUP

```bash
# Clone and setup
git clone https://github.com/pohi99999/mcp-brunella-core
cd mcp-brunella-core
npm install

# Build
npm run build

# Start (Node.js MCP server)
npm run start:stable

# Start (Python AI agent, separate terminal)
npm run start:python:stable

# Run tests
npm run test:master
```
