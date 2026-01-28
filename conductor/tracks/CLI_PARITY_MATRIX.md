# Brunella CLI vs Gemini CLI – Full Command Matrix (Design)

Map of Gemini slash commands and conductor commands to Brunella equivalents. Existing Brunella commands stay stable.

## Slash commands → Brunella

| Gemini CLI | Brunella equivalent | Status |
|------------|---------------------|--------|
| /about | `brunella about` | implemented |
| /auth login, logout | `brunella auth login`, `auth logout` | stub |
| /bug | `brunella bug` | stub |
| /chat | `brunella chat` | stable |
| /chat list, save, resume, delete, share | (future) chat subcommands | not yet |
| /clear | `brunella clear` | implemented |
| /compress | `brunella compress` | stub |
| /copy | `brunella copy` | stub |
| /docs | `brunella docs` | implemented |
| /directory add, show | `brunella directory add <paths>`, `directory show` | implemented |
| /editor | `brunella editor [path]` | implemented |
| /extensions list, update, explore, restart | `brunella extensions list|update|explore|restart` | stub |
| /help | `brunella help` or `--help` | implemented |
| /hooks panel, enable, disable, enable-all, disable-all | `brunella hooks panel|enable|disable|enable-all|disable-all` | implemented |
| /ide | `brunella ide` | stub |
| /init | `brunella init` | implemented (BRUNELLA.md) |
| /mcp list, desc, schema, auth, refresh | `brunella mcp list|desc|schema|auth|refresh` | implemented (list/desc/schema/refresh), auth stub |
| /memory show, add, refresh, list | `brunella memory show|add|refresh|list` | implemented |
| /model | `brunella model [name]` | implemented |
| /privacy | `brunella privacy` | implemented |
| /policies list | `brunella policies list` | stub |
| /quit | (interactive exit) | n/a |
| /resume | `brunella resume [id]` | stub |
| /stats session, model, tools | `brunella stats session|model|tools` | stub |
| /theme | `brunella theme [name]` | implemented |
| /tools [desc] | `brunella tools [--json][--desc][--schema]` | stable |
| /skills list, disable, enable, reload | `brunella skills list|disable|enable|reload` | implemented |
| /settings | `brunella config list|get|set` or `settings` | stable |
| /vim | `brunella vim` | implemented |
| /setup-github | `brunella setup-github` | stub |
| /terminal-setup | `brunella terminal-setup` | stub |
| ! (shell) | `brunella run &lt;shell_tool&gt; ...` | via run |
| [MCP] | `brunella run &lt;toolName&gt; [args]` | stable |

## Conductor commands → Brunella

| Gemini /conductor:* | Brunella equivalent | Status |
|--------------------|---------------------|--------|
| /conductor:status | `brunella conductor status` (future) | not yet |
| /conductor:setup | `brunella conductor setup` (future) | not yet |
| /conductor:revert | `brunella conductor revert` (future) | not yet |
| /conductor:newTrack | `brunella conductor newTrack` (future) | not yet |
| /conductor:implement | `brunella conductor implement` (future) | not yet |

## Jules / agents

| Gemini | Brunella | Status |
|--------|----------|--------|
| /jules | `brunella delegate Jules &lt;task&gt;` or `agents describe Jules` | via delegate/agents |
| agents | `brunella agents [--json]`, `agents describe &lt;name&gt;` | stable |
| delegate | `brunella delegate &lt;agentName&gt; &lt;task&gt; [--json]` | stable |

## Hiányok összefoglaló (Gaps)

- **Nem implementált:** /chat list, save, resume, delete, share; /conductor:status, setup, revert, newTrack, implement.
- **Stub (UX, későbbi logika):** /auth (login/logout mentés működik), /bug, /compress, /copy, /extensions, /ide, /policies list, /resume, /stats, /setup-github, /terminal-setup, mcp auth.

## Stable Brunella commands (do not remove or change behavior)

- `config list | get <key> | set <key> <value>`
- `tools [--json][--desc][--schema]`
- `run <toolName> [args...] [--json]`
- `chat [-m model]`
- `agents [--json]` | `agents describe <name>`
- `delegate <agentName> <task> [--json]`
- `interpreter`
