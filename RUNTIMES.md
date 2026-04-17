<!-- Purpose: Canonical multi-runtime architecture overview and startup policy for Brunella. -->

# Brunella Multi-Runtime Architecture

## Active Runtimes

| Runtime | Entry Point | Start Command | Status |
| --- | --- | --- | --- |
| Node.js (MCP Server) | `src/index.ts` | `npm run start:stable` | PRIMARY |
| Python (AI Agent) | `myai/server.py` | `npm run start:python:stable` | ACTIVE |
| Rust/Tauri (Desktop) | `src-tauri/src/main.rs` | `npm run desktop:dev` | OPTIONAL |
| C# (.NET MCP) | `csharp-mcp-server/` | `dotnet run` | EXPERIMENTAL |

## Unified Start (Primary)

```bash
npm run start:stable        # Node.js MCP server
npm run start:python:stable # Python AI agent (separate terminal)
```

## Runtime Dependencies

- Node.js >= 20.x
- Python >= 3.11 (with uv)
- Rust >= 1.75 (only for Tauri desktop build)
- .NET >= 8.0 (only for C# MCP experiments)

## Notes

- The PRIMARY runtime is Node.js. All other runtimes are supplementary.
- Python runtime communicates with Node via HTTP (port 8000 by default).
- Do NOT mix npm and pnpm. Use npm exclusively (package-lock.json is authoritative).
- pnpm-lock.yaml exists but is NOT authoritative — delete it if causing conflicts.
