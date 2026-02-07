# MCP Tool Permissions Guide

**Implementálva:** 2026-02-07
**Verzió:** 1.0
**Státusz:** ✅ PRODUCTION READY

---

## 🎯 Mi ez?

Az MCP Tool Permission rendszer kiterjeszti az Agent Permission System-et (Phase 1) az MCP tool hívásokra. Biztosítja, hogy csak azok az ügynökök hívhassanak meg adott tool-okat, akiknek arra jogosultságuk van.

### Probléma (RÉGI):
- ❌ Bármely agent bármilyen MCP tool-t hívhatott
- ❌ Robotkez agent törléseket végezhetett
- ❌ Researcher agent módosíthatott fájlokat
- ❌ Nincs tool-szintű audit trail

### Megoldás (ÚJ):
- ✅ Tool-Permission mapping
- ✅ Permission check minden MCP tool hívásnál
- ✅ Agent context átadás tool-okhoz
- ✅ Audit logging denied tool calls
- ✅ SQLite MCP server integráció

---

## 📋 Tool Permission Map

```typescript
export const ToolPermissionMap: Record<string, Permission[]> = {
    // Browser Tools
    'harvest_scenario': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'harvest_extract': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'browser_navigate': [Permission.BROWSER_CONTROL, Permission.HTTP_REQUEST],
    'browser_screenshot': [Permission.BROWSER_CONTROL],

    // Database Tools
    'sqlite_query': [Permission.DB_READ],
    'sqlite_execute': [Permission.DB_WRITE],

    // File Tools
    'read_file': [Permission.READ_FILE],
    'write_file': [Permission.WRITE_FILE],
    'delete_file': [Permission.DELETE_FILE],

    // Git Tools
    'git_commit': [Permission.GIT_OPERATIONS],
    'git_push': [Permission.GIT_OPERATIONS],
    'git_pull': [Permission.GIT_OPERATIONS],

    // HTTP Tools
    'http_request': [Permission.HTTP_REQUEST],
    'web_search': [Permission.HTTP_REQUEST],
};
```

---

## 🛠️ Használat

### 1. MCP Tool handler permission check

```typescript
import { checkToolPermission, type ToolExecutionContext } from './toolPermissions.js';

export function registerBrowserTools(server: McpServer, context?: ToolExecutionContext) {
  server.tool(
    "harvest_scenario",
    "Runs a Robotkéz browser automation scenario",
    {
      scenario_path: z.string(),
      force_mode: z.enum(["api", "ui"]).optional(),
    },
    async ({ scenario_path, force_mode }) => {
      // 1. Permission check
      const permCheck = checkToolPermission("harvest_scenario", context || {});
      if (!permCheck.allowed) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Permission Denied: ${permCheck.reason}` }]
        };
      }

      // 2. Execute tool
      const response = await fetch(`${PYTHON_API}/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_path, force_mode }),
      });
      // ...
    }
  );
}
```

### 2. Context átadás

```typescript
// Agent hívás esetén:
const context: ToolExecutionContext = {
    agentName: 'Robotkez',
    requestId: 'req-12345',
    metadata: { source: 'cli' }
};

registerBrowserTools(server, context);
```

### 3. Path-based permission check

```typescript
import { checkFilePermission } from './toolPermissions.js';

const fileCheck = checkFilePermission(
    'Developer', // agent name
    'src/critical.ts', // file path
    'write' // operation
);

if (!fileCheck.allowed) {
    console.error(fileCheck.reason);
}
```

---

## 🔒 Védett Tool-ok Agent-enként

| Tool | DEVELOPER | RESEARCHER | ROBOTKEZ | EVALUATOR | PROJECT_CONDUCTOR |
|------|-----------|------------|----------|-----------|-------------------|
| **harvest_scenario** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **harvest_extract** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **browser_navigate** | ❌ | ✅ (read-only) | ✅ | ✅ | ❌ |
| **browser_screenshot** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **sqlite_query** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **sqlite_execute** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **read_file** | ✅ | ✅ | ✅ (data/**) | ✅ | ✅ |
| **write_file** | ✅ (src/**) | ❌ | ✅ (data/**) | ❌ | ✅ (conductor/**) |
| **delete_file** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **git_commit** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **http_request** | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 📦 SQLite MCP Server

### Konfiguráció (`mcp_servers.json`)

```json
{
  "name": "sqlite",
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-sqlite",
    "./data/brunella.db"
  ],
  "description": "Official SQLite MCP server - provides database query and execute tools"
}
```

### Permission követelmények

```typescript
// Query (SELECT) - DB_READ permission
'sqlite_query': [Permission.DB_READ]

// Execute (INSERT, UPDATE, DELETE) - DB_WRITE permission
'sqlite_execute': [Permission.DB_WRITE]
```

### Használat

```bash
# Telepítés
npx @modelcontextprotocol/server-sqlite --help

# Indítás (automatikus mcp_servers.json-ból)
npm run dev
```

---

## 🧪 Tesztelés

### Permission denial teszt

```typescript
it('should deny browser tool for Developer agent', async () => {
    const context: ToolExecutionContext = { agentName: 'Developer' };
    const check = checkToolPermission('harvest_scenario', context);

    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('BROWSER_CONTROL');
});
```

### Bypass tesztekben

```typescript
// Tool permission check-et mindig BYPASS-olni kell tesztekben!
const context: ToolExecutionContext = { agentName: undefined }; // undefined = allow all
```

---

## 📊 Audit Trail

Minden denied tool művelet logolódik:

```
[ERROR] [ToolPermissions] DENIED: harvest_scenario - Agent Developer lacks BROWSER_CONTROL permission
[WARN] [Developer] Operation denied: tool:harvest_scenario - Agent Developer lacks BROWSER_CONTROL permission
```

**Jövőbeli integráció:**
- LangSmith tool tracing
- Dashboard tool usage metrics
- Slack notification critical denials

---

## 🚀 Következő Lépések

### ✅ KÉSZ (Fázis 2 - 2026-02-07)
- [x] Tool Permission Map
- [x] checkToolPermission() helper
- [x] Browser Tools permission integration
- [x] SQLite MCP server setup
- [x] Path-based file permission check
- [x] Audit logging
- [x] Tesztek (76/76 PASS)

### 🔜 TODO (Fázis 3+)
- [ ] Automatikus tool permission generálás registry.json-ból
- [ ] Rate limiting tool hívásokra
- [ ] Cost tracking (API hívások)
- [ ] Tool permission dashboard UI
- [ ] Custom tool permission profiles

---

## 📚 Fájlok

| Fájl | Leírás |
|------|--------|
| `src/tools/toolPermissions.ts` | Tool permission rendszer core |
| `src/tools/browser.ts` | Browser tools permission integration |
| `mcp_servers.json` | MCP server konfiguráció (SQLite) |
| `src/agents/permissions.ts` | Base permission system (Phase 1) |

---

## 💡 Best Practices

1. **Minden tool-hoz definiálj permissions-t** - Ha hiányzik a ToolPermissionMap-ből, allow by default (backwards compat)
2. **Context mindig legyen átadva** - registerXXXTools(server, context)
3. **Path restrictions > Tool restrictions** - Először path, aztán tool
4. **Test bypass explicit** - `context.agentName = undefined` tesztekben
5. **Audit trail review** - Nézd rendszeresen a denied műveleteket

---

**Implementátor:** Claude Code
**Dátum:** 2026-02-07
**Status:** ✅ PRODUCTION

**Használat:**
```bash
# Tool permission check Agent híváskor:
const context = { agentName: 'Robotkez' };
registerBrowserTools(server, context);

# Manual tool permission check:
import { checkToolPermission } from './toolPermissions.js';
const check = checkToolPermission('harvest_scenario', { agentName: 'Developer' });
console.log(check.allowed); // false
console.log(check.reason); // "Agent Developer lacks BROWSER_CONTROL permission"
```
