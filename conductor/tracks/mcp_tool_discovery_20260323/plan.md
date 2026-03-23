# Implementációs Terv: MCP Tool Discovery & Composability
**Track ID:** `mcp_tool_discovery_20260323`

---

## Phase 1: Dynamic Tool Registry

* [ ] **Task 1.1** — `src/core/dynamicToolRegistry.ts`
  - `ToolManifest` interfész (schema: spec.md)
  - `DynamicToolRegistry` singleton class
  - `registerTool(manifest)`: Zod validáció + store
  - `deregisterTool(toolId)`: cleanup
  - `discoverTools(filter?)`: tags, publishedBy, version filter

* [ ] **Task 1.2** — MCP Server integráció
  - `mcpServer.ts`: dynamic tool lista frissítés regisztrációkor
  - Auto-publish: registerAllTools() → dynamic registry migrálás
  - Backwards compatible: meglévő statikus tool-ok is regisztrálva

* [ ] **Task 1.3** — Agent tool publikálás
  - `BaseAgent.registerTools()`: agent-specifikus tool manifest
  - Auto-call: agent initialize → registerTools()
  - Auto-cleanup: agent destroy → deregisterTools()

* [ ] **Task 1.4** — Tesztek: `test/mcp/dynamicToolRegistry.test.ts`

## Phase 2: Versioning & Compatibility

* [ ] **Task 2.1** — Semver support
  - `semver` library: version compare, range matching
  - `resolveVersion(toolName, range)`: legújabb kompatibilis
  - Version conflict: warning + fallback legutóbbi stable

* [ ] **Task 2.2** — Deprecation
  - `manifest.deprecated = true`: warning log tool hívásnál
  - `deprecatedMessage`: migration guide
  - Deprecated tool statistics: hány hívás deprecated tool-ra

## Phase 3: Tool Composition

* [ ] **Task 3.1** — `src/core/toolComposition.ts`
  - `composeTools(steps)`: chain definíció
  - Schema kompatibilitás check: output ⊇ input
  - Error propagálás: chain megszakítás hiba esetén

* [ ] **Task 3.2** — Macro tool-ok
  - Chain → single MCP tool regisztráció
  - Macro tool hívás → belső chain végrehajtás
  - Nested chain support (macro → macro)

* [ ] **Task 3.3** — Tool recommendation
  - `recommendTools(taskDescription)`: embedding-based keresés
  - Tool similarity: tag + description overlap scoring

## Phase 4: Metrics + Dashboard + CLI

* [ ] **Task 4.1** — Per-tool metrikák
  - `ToolMetrics`: call count, latency avg/p95, error rate
  - Prometheus exportálás: `bas_tool_calls_total`, `bas_tool_latency_seconds`
  - SQLite backup: tool_metrics tábla

* [ ] **Task 4.2** — Timeout/retry
  - Tool-szintű timeout (manifest.timeout)
  - Configurable retry: linear/exponential backoff
  - Circuit breaker: 5 consecutive error → tool disabled 60s

* [ ] **Task 4.3** — Dashboard: `ToolDiscoveryPanel.tsx`
  - Tool lista: név, verzió, publisher, deprecated, metrikák
  - Chain vizualizáció: tool flow diagram
  - Health: per-tool success/error rate sparkline

* [ ] **Task 4.4** — CLI: `src/cli/commands/tools-hu.ts`
  - `brunella tools list`: aktív tool-ok
  - `brunella tools info <toolId>`: részletek + metrikák
  - `brunella tools chain <chain-def>`: chain tesztelés

---

## 🎯 Sikerességi Kritériumok

1. Dynamic register/deregister: MCP tool lista frissül runtime-ban
2. Semver: version range resolution
3. Deprecation: warning + migration info
4. Tool composition: chain A→B→C schema validációval
5. Per-tool metrikák + circuit breaker
6. Dashboard ToolDiscoveryPanel + CLI `brunella tools`
7. Összes teszt PASS
