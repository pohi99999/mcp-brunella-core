# Brunella MCP Integration

This document defines how Brunella should use MCP servers and tools in a safe, declarative way.

## Principles

- Keep MCP startup declarative in `mcp_servers.json`.
- Classify tools by default behavior instead of treating every server the same.
- Treat every tool input as untrusted.
- Log every tool path with enough detail to debug failures without exposing secrets.
- Prefer small, explicit tool sets for a given task.

## Skill boundary

- Use a Copilot skill when the user-facing behavior is a thin wrapper over an existing Brunella dashboard surface, CLI command, or MCP tool.
- Use an MCP adapter when the task needs a new transport, process, or credential boundary.
- Keep the skill and adapter documents aligned if both layers exist for the same capability.

## Tool classes

### Required

These should be treated as the default base set for Brunella AI work:

- `brunella-core` — the local Brunella MCP process itself
- `filesystem` — workspace and user-home file access
- `fetch` — web content retrieval for docs and reference lookups
- `memory` — lightweight local memory store
- `sequential-thinking` — structured reasoning helper

### Optional

Enable these only when the task needs them:

- `brunella-remote` — remote Brunella FastMCP deployment
- `github` — repository and issue/PR operations
- `chrome-devtools` — browser inspection and page diagnostics
- `playwright` — deterministic browser automation
- `csharp-mcp-server` — Windows workspace tools for C#-heavy tasks
- `workspace-mcp-server` — workspace introspection and review helpers
- `windows_automation_bridge` — native Windows UI automation

### Experimental

These stay off by default until a specific task justifies them:

- `sqlite` — disabled placeholder in the manifest
- `vscode-mcp` — disabled placeholder for future VS Code integration
- `copilot-mcp` — disabled placeholder for future Copilot-specific wiring
- `brunella-self-improve` — manual or scheduled self-improvement entry point

## Security boundaries

- Never put secrets into prompts, logs, or tracked files.
- Use environment variables or the repository's secret management for credentials.
- Canonicalize file paths and restrict access to approved workspace roots.
- Treat browser output, network output, and remote tool output as untrusted.
- Keep shell commands parameterized; do not build them from concatenated user text.
- Use browser and network tools only when the task actually needs them.

## Timeouts and retries

Recommended defaults:

- local file and workspace tools: 5-10 seconds, usually no retry or one retry
- networked API tools: 15-30 seconds, exponential backoff, up to 2 retries
- browser automation: 30-60 seconds, retry only when the action is idempotent
- write or mutation tools: require explicit intent and a clear rollback or verification path

If a server has a stricter built-in limit, honor the stricter limit.

## Logging

Every tool wrapper or integration layer should log:

- server name
- tool name
- redacted arguments or a safe summary
- duration
- retry count
- outcome or error category
- correlation id when available

## Canonical config snippets

Use the same shapes as `mcp_servers.json`. These are the recommended default entries.

### Required core set

```json
{
  "name": "brunella-core",
  "transport": "self",
  "args": [],
  "description": "Brunella Agent System - belso core MCP szerver (a sajat processz jelenti)",
  "autoStart": true,
  "required": true,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 0,
  "retryDelayMs": 1000
}
```

```json
{
  "name": "filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "${WORKSPACE_ROOT}",
    "${USER_HOME}"
  ],
  "description": "Filesystem MCP server - workspace es user home hozzaferes",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 0,
  "retryDelayMs": 1000
}
```

```json
{
  "name": "fetch",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"],
  "description": "Fetch MCP server - web content retrieval",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 1,
  "retryDelayMs": 1500
}
```

```json
{
  "name": "memory",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {
    "MEMORY_FILE_PATH": "${WORKSPACE_ROOT}\\data\\mcp_memory.json"
  },
  "description": "Memory MCP server - lokalis memoria tarolo",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 0,
  "retryDelayMs": 1000
}
```

```json
{
  "name": "sequential-thinking",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "description": "Sequential Thinking MCP server - strukturalt gondolkodasi seged",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 0,
  "retryDelayMs": 1000
}
```

### Optional tools

```json
{
  "name": "github",
  "transport": "stdio",
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "-e",
    "GITHUB_PERSONAL_ACCESS_TOKEN",
    "ghcr.io/github/github-mcp-server:0.31.0"
  ],
  "envFromHost": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": [
      "GITHUB_PERSONAL_ACCESS_TOKEN",
      "GITHUB_PAT",
      "GITHUB_TOKEN"
    ]
  },
  "description": "GitHub MCP server - dockeres GitHub integracio",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  "connectRetries": 1,
  "retryDelayMs": 1500
}
```

```json
{
  "name": "chrome-devtools",
  "transport": "stdio",
  "command": "npx",
  "args": [
    "--registry",
    "https://registry.npmjs.org",
    "chrome-devtools-mcp@0.17.0"
  ],
  "description": "Chrome DevTools MCP server - bongeszo diagnosztika",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 1,
  "retryDelayMs": 1500
}
```

```json
{
  "name": "playwright",
  "transport": "stdio",
  "command": "npx",
  "args": ["@playwright/mcp@latest"],
  "description": "Playwright MCP server - browser automatizalas",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "connectRetries": 1,
  "retryDelayMs": 1500
}
```

```json
{
  "name": "windows_automation_bridge",
  "transport": "stdio",
  "command": "python",
  "args": ["windows_bridge/wab_server.py"],
  "description": "Windows Automation Bridge - natív Windows automatizalas",
  "autoStart": true,
  "required": false,
  "disabled": false,
  "requiredEnv": [],
  "platforms": ["win32"],
  "connectRetries": 0,
  "retryDelayMs": 1000
}
```

## Operational guidance

- Use required tools by default only when the task needs them.
- Add optional tools only when their benefits outweigh the context and security cost.
- Leave experimental tools off until a task or track explicitly calls for them.
- Keep the manifest and docs in sync whenever a server is added, removed, or reclassified.
