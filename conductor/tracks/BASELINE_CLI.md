# Brunella CLI Baseline – Surfaces and Defaults (Do Not Break)

This document records current CLI surfaces and defaults that must remain stable when adding Gemini-level parity. Extend only; do not remove or change behavior of the following.

## 1. `src/cli.ts`

**Stable entry:** `program.name('brunella')`, `program.version(version)`.

**Stable commands (behavior must be preserved):**

| Command | Behavior |
|--------|----------|
| `config list` | List all settings (flat or nested keys). |
| `config get <key>` | Get one setting by key or dot-path. |
| `config set <key> <value>` | Set one setting; persists to user file. |
| `tools` | List MCP tools; `--json` for JSON, `--desc`/`--schema` for descriptions/schemas. |
| `run <toolName> [args...]` | Call MCP tool; args as key=value or single JSON. `--json` for raw response. |
| `chat` | Interactive chat; `-m/--model` overrides; uses `ollama_generate` or equivalent backend tool. |
| `agents` | List agents via `agent_list`; `--json` for JSON. |
| `agents describe <name>` | Describe one agent by name. |
| `delegate <agentName> <task>` | Delegate via `agent_delegate`; `--json` for raw. |
| `interpreter` | Interactive Python interpreter (Open Interpreter mode). |

**Defaults:** Banner shown unless `--version`/`--help`; telemetry init from config; `flushTelemetry` on `beforeExit`.

## 2. `src/utils/cliConfig.ts`

**Stable surfaces:**

- **Legacy keys:** `serverUrl`, `apiKey`, `theme`. Reading/writing these must keep working.
- **Paths:** User file `~/.brunella/settings.json`; project file `.brunella/settings.json` (discovered from cwd).
- **API:** `configManager.get(key)`, `configManager.set(key, value)`, `configManager.getAll()`, `configManager.userSettingsPath`, `configManager.projectSettingsPath`.
- **Singleton:** `getConfigManager(cwd?)` and exported `configManager`.

**Stable defaults:** `serverUrl: 'http://localhost:3000'`, `theme: 'dark'`. Nested defaults (general, ui, tools, telemetry, etc.) may be extended but existing keys must not change semantics.

## 3. `src/utils/mcpClient.ts`

**Stable surfaces:**

- **Constructor:** `new BrunellaClient()` (no required args).
- **Methods:** `connect()`, `listTools()`, `callTool(name, args)`, `close()`.
- **Connection logic:** If server on port 3000 → `SSEClientTransport("http://localhost:3000/sse")`; else → `StdioClientTransport` with `node build/index.js` and `WEB_UI_ENABLED: 'true'`.

Do not change method names or the hybrid (SSE vs stdio) decision flow.

## 4. `src/utils/serverManager.ts`

**Stable surfaces:**

- **`checkServerRunning(port = 3000): Promise<boolean>`** – TCP connect to 127.0.0.1:port.
- **`startServer(): ChildProcess`** – `spawn('node', [serverPath], { env: { ...process.env, WEB_UI_ENABLED: 'true' } })`.

Do not change signatures or the port default.

## Compatibility (post–Gemini parity)

- **Stable commands** above keep the same behavior and output semantics. New options (e.g. `--json`, `--desc`, `--schema` on `tools`) are additive.
- **Shims/aliases:** `settings` prints usage for `config list | get | set`; no command renames or removals.
- **Config:** Legacy flat keys `serverUrl`, `apiKey`, `theme` remain; old `~/.brunella/settings.json` with only those keys is migrated once to the nested shape on load.
- **Deprecations:** None. New flags and config keys are optional.
