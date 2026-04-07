# Workspace MCP Server

A small, production-oriented MCP server for local workspace inspection.

## Features

- `workspace_info` — report server and workspace metadata
- `inspect_path` — inspect files or directories under the workspace root
- `search_text` — search text across the workspace safely
- `calculate` — evaluate restricted math expressions
- `workspace://file/{path}` — read-only resource for file or directory snapshots
- `review_workspace_file(path, focus)` — reusable prompt for file review workflows

## Setup

```bash
cd workspace-mcp-server
uv sync
```

## Run

Default stdio transport:

```bash
python server.py
# or
uv run workspace-mcp-server
```

HTTP transport:

```bash
python server.py --transport streamable-http --host 127.0.0.1 --port 8000
# or
uv run workspace-mcp-server --transport streamable-http --host 127.0.0.1 --port 8000
```

## MCP Inspector

```bash
uv run mcp dev server.py
```

## Claude Desktop install

```bash
uv run mcp install server.py
```

## Environment variables

- `MCP_WORKSPACE_ROOT` — root directory the server can inspect
- `MCP_TRANSPORT` — `stdio` or `streamable-http`
- `MCP_HOST` — bind host for HTTP transport
- `MCP_PORT` — bind port for HTTP transport
- `MCP_STATELESS_HTTP` — `1` to enable stateless HTTP mode
- `MCP_JSON_RESPONSE` — `1` to force JSON responses over HTTP
- `MCP_LOG_LEVEL` — logging level such as `INFO` or `DEBUG`

## Example tool calls

```text
workspace_info()
inspect_path(path="README.md")
search_text(query="FastMCP", max_results=10)
calculate(expression="sqrt(81) + pi")
```

## Notes

- The calculator only supports a safe subset of Python expressions.
- Workspace access is restricted to the configured root directory.
