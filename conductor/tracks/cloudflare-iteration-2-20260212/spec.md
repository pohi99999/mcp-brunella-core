# Cloudflare Chat Integration - Iteration 2 Specifikáció

**Track ID**: `cloudflare-iteration-2-20260212`  
**Dependency**: `cloudflare-chat-integration-20260211` (✅ COMPLETED 100%)  
**Status**: ✅ **COMPLETED**  
**Priority**: HIGH  
**Estimated Effort**: 6 hours

---

## Áttekintés

### Post-Completion Stabilization Addendum (2026-02-12)

Az Iteration 2 lezárása után futásidőben egy kapcsolati regresszió jelentkezett a dashboard `EdgePanel` komponensben:

- tünet: `Connection closed: code 1006`
- lokális ellenőrzés: `http://localhost:3000/ws` → `404`
- gyökérok: a backend valós idejű csatornája Socket.IO (`/socket.io`), nem natív WebSocket `/ws` endpoint.

**Végrehajtott javítások:**

- `EdgePanel` átállítása Socket.IO provider használatra (`useSocket`) a natív `WebSocket` helyett.
- Kapcsolati diagnosztika hozzáadása az UI-hoz.
- Socket ID megjelenítés.
- Transport megjelenítés.
- Reconnect attempts számláló megjelenítés.
- Last disconnect reason megjelenítés.
- Dashboard key-stabilizálás és API export fix (`getCloudflareStatus`) külön validálva.

**Validáció:**

- `npm run build:ui` ✅
- Edge kapcsolat dashboardon zöld (connected) ✅

---

Az Iteration 1 sikeres lezárása után (Backend API + Dashboard UI + Tests + Docs + Feature-flag 100%) az Iteration 2 három fő komponenst ad hozzá:

1. **WebSocket Real-time Communication** - Bidirectional real-time updates (eliminating polling)
2. **D1 Persistent Task Storage** - Cloudflare D1 (SQLite) based task history & queries
3. **CLI Commands** - 5 new Brunella CLI commands for Edge interaction

---

## Komponens 1: WebSocket Real-time Communication

### Célok

- Kétirányú real-time kommunikáció Backend ↔ Worker ↔ Dashboard között
- Polling eliminálása (jelenlegi 5s intervallum → live updates)
- Streaming chat support (token-by-token streaming)
- Task status live updates (submit → progress → complete)

### Technológiai Stack

- **Backend**: `socket.io` vagy `ws` (Node.js WebSocket library)
- **Worker**: Cloudflare Durable Objects (WebSocket support)
- **Frontend**: `socket.io-client` vagy native WebSocket API
- **Protocol**: WebSocket (wss:// for production)

### Environment Variables

```env
CLOUDFLARE_WEBSOCKET_URL=wss://brunella-edge.YOUR_SUBDOMAIN.workers.dev/ws
WEBSOCKET_ENABLED=true  # Feature flag
WEBSOCKET_PORT=3001     # Backend WebSocket port (if separate from HTTP)
```

### Backend Implementáció (src/server/websocket.ts)

**1. WebSocket Server Setup**

```typescript
import { Server } from "socket.io";
import { createServer } from "http";

export function initializeWebSocketServer(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io/",
  });

  io.on("connection", (socket) => {
    logInfo("WebSocket", `Client connected: ${socket.id}`);

    socket.on("edge:task:submit", async (data) => {
      // Forward task to Worker via HTTP API
      // Emit real-time updates back to client
    });

    socket.on("disconnect", () => {
      logInfo("WebSocket", `Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
```

**2. Event Types**

- **Client → Server**:
  - `edge:task:submit` - Submit new task
  - `edge:chat:message` - Send chat message
  - `edge:status:query` - Query task status
- **Server → Client**:
  - `edge:task:progress` - Task progress update (0-100%)
  - `edge:task:complete` - Task completion (result)
  - `edge:chat:token` - Streaming chat token
  - `edge:status:update` - Edge health status change

### Dashboard Integration (src/dashboard/hooks/useWebSocket.ts)

**Custom Hook**

```typescript
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(url, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [url]);

  return { socket, connected };
}
```

### Worker WebSocket Endpoint (Cloudflare Durable Objects)

**Why Durable Objects?**

- Cloudflare Workers don't support long-lived WebSocket connections by default
- Durable Objects provide persistent WebSocket state & coordination
- Single Durable Object instance can handle multiple WebSocket clients

**Implementation (cloudflare/edge-coordinator.ts)**

```typescript
export class EdgeCoordinator {
  private state: DurableObjectState;
  private sessions: Map<string, WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.sessions.set(crypto.randomUUID(), server);

      server.addEventListener("message", (event) => {
        // Handle incoming WebSocket messages
        const data = JSON.parse(event.data);
        if (data.type === "task:submit") {
          // Process task, broadcast progress to all clients
        }
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not a WebSocket request", { status: 400 });
  }

  private broadcast(message: any) {
    for (const [id, ws] of this.sessions) {
      ws.send(JSON.stringify(message));
    }
  }
}
```

### Success Metrics (WebSocket Component)

| Metrika                  | Célérték       | Mérési Módszer                           |
| ------------------------ | -------------- | ---------------------------------------- |
| WebSocket Backend Server | Working        | `socket.io` initialized, clients connect |
| Worker Durable Object    | Working        | WebSocket upgrade returns 101            |
| Dashboard Connection     | Stable         | `useWebSocket` hook connected=true       |
| Real-time Updates        | <500ms latency | Task submit → progress event             |
| Reconnection Logic       | Working        | Auto-reconnect after disconnect          |

---

## Komponens 2: D1 Persistent Task Storage

### Célok

- Minden task perzisztálása (history, analytics, audit trail)
- Query support (taskId, date range, status filter)
- Long-term storage (nem csak in-memory)
- Analytics dashboard support (későbbi feature)

### Cloudflare D1 Schema

**Table: `tasks`**

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,           -- UUID vagy nanoid
  instruction TEXT NOT NULL,      -- Task instruction (user input)
  status TEXT NOT NULL,           -- 'pending' | 'running' | 'success' | 'error'
  result TEXT,                    -- Task result (JSON or plaintext)
  error TEXT,                     -- Error message if failed
  created_at INTEGER NOT NULL,    -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,    -- Unix timestamp (ms)
  completed_at INTEGER,           -- Completion timestamp
  metadata TEXT                   -- JSON extra metadata (agent, priority, etc.)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
```

### Environment Variables

```env
CLOUDFLARE_D1_DATABASE_ID=your-d1-database-id
D1_ENABLED=true  # Feature flag
```

### Worker D1 Integration (cloudflare/wrangler.toml)

**Binding Configuration**

```toml
[[d1_databases]]
binding = "DB"
database_name = "brunella-edge-tasks"
database_id = "your-d1-database-id"
```

**Query Examples (cloudflare/worker.ts)**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/task" && request.method === "POST") {
      const { instruction } = await request.json();
      const taskId = crypto.randomUUID();

      // INSERT into D1
      await env.DB.prepare(
        "INSERT INTO tasks (id, instruction, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(taskId, instruction, "pending", Date.now(), Date.now())
        .run();

      return Response.json({ taskId, status: "pending" });
    }

    if (pathname.startsWith("/api/status/")) {
      const taskId = pathname.split("/").pop();

      // SELECT from D1
      const result = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?")
        .bind(taskId)
        .first();

      return Response.json(result || { error: "Task not found" });
    }

    if (pathname === "/api/history") {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "20");

      // Query recent tasks
      const { results } = await env.DB.prepare(
        "SELECT id, instruction, status, created_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT ?",
      )
        .bind(limit)
        .all();

      return Response.json({ tasks: results });
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

### Backend API Updates (src/server/cloudflare_routes.ts)

**New Endpoint: GET /api/cloudflare/history**

```typescript
// Get task history from D1 (via Worker proxy)
app.get("/api/cloudflare/history", async (req, res) => {
  if (!EDGE_ENABLED) {
    return res
      .status(503)
      .json({ error: "Cloudflare Edge Integration disabled" });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const response = await fetch(
      `${CLOUDFLARE_WORKER_URL}/api/history?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    logError("CloudflareRoutes", `History query error: ${error.message}`);
    res.status(500).json({ error: "Failed to query task history" });
  }
});
```

### Success Metrics (D1 Component)

| Metrika                | Célérték | Mérési Módszer                                                |
| ---------------------- | -------- | ------------------------------------------------------------- |
| D1 Database Created    | Yes      | `wrangler d1 list` shows DB                                   |
| Tasks Table Schema     | Created  | `wrangler d1 execute --command "SELECT * FROM sqlite_master"` |
| INSERT on Task Submit  | Working  | POST /task → row in DB                                        |
| SELECT on Status Query | Working  | GET /status/:id → data from DB                                |
| History Endpoint       | Working  | GET /history → recent tasks array                             |

---

## Komponens 3: CLI Commands

### Célok

- CLI-ből is elérhető Edge features (nem csak Dashboard UI)
- Developer workflow support (`brunella edge ...` commands)
- Automation & scripting support (CI/CD integration)
- Hungarian + English descriptions

### Új CLI Parancsok (5 commands)

#### 1. `brunella edge status`

**Leírás**: Edge Worker health check (GET /api/cloudflare/status)  
**Output**:

```bash
✅ Cloudflare Edge Worker: HEALTHY
🌍 Worker URL: https://brunella-edge.YOUR_SUBDOMAIN.workers.dev
⏱️  Response Time: 123ms
📊 Last 24h: 1,234 requests
```

#### 2. `brunella edge chat "<message>"`

**Leírás**: Chat az Edge Worker LLM-jén keresztül (POST /api/cloudflare/chat)  
**Example**:

```bash
brunella edge chat "Mi a TypeScript?"
# Output: TypeScript egy Microsoft által fejlesztett...
```

#### 3. `brunella edge task "<instruction>"`

**Leírás**: Task submit Edge-re (POST /api/cloudflare/task), taskId visszaadás  
**Example**:

```bash
brunella edge task "Elemezd a README.md fájlt"
# Output: ✅ Task submitted: task_abc123
#         Query status: brunella edge query task_abc123
```

#### 4. `brunella edge query <taskId>`

**Leírás**: Task status lekérdezés (GET /api/cloudflare/status/:taskId)  
**Example**:

```bash
brunella edge query task_abc123
# Output: 📋 Task: task_abc123
#         Status: success ✅
#         Result: A README.md file contains...
#         Created: 2026-02-12 18:30:45
#         Completed: 2026-02-12 18:31:02
```

#### 5. `brunella edge history [--limit N]`

**Leírás**: Recent tasks listázása D1-ből (GET /api/cloudflare/history)  
**Example**:

```bash
brunella edge history --limit 5
# Output:
# 📜 Edge Task History (Last 5):
# 1. task_abc123 | success ✅ | Elemezd a README.md fájlt | 2026-02-12 18:31:02
# 2. task_def456 | pending ⏳ | Mi a Python? | 2026-02-12 18:29:10
# 3. task_ghi789 | error ❌ | Invalid task | 2026-02-12 18:25:33
# ...
```

### Implementáció (src/cli/commands/edge.ts)

**New File Structure**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import fetch from "node-fetch";

const BACKEND_URL = process.env.BRUNELLA_BACKEND_URL || "http://localhost:3000";

export function registerEdgeCommands(program: Command) {
  const edge = program
    .command("edge")
    .description("Cloudflare Edge Worker műveletek");

  // 1. edge status
  edge
    .command("status")
    .description("Edge Worker állapot ellenőrzése")
    .action(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/cloudflare/status`);
        const data = await res.json();

        if (data.enabled) {
          console.log(chalk.green("✅ Cloudflare Edge Worker: HEALTHY"));
          console.log(chalk.blue(`🌍 Worker URL: ${data.workerUrl}`));
          console.log(chalk.yellow(`⏱️  Response Time: ${data.latency}ms`));
        } else {
          console.log(
            chalk.red("❌ Edge Worker disabled (EDGE_ENABLED=false)"),
          );
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // 2. edge chat "<message>"
  edge
    .command("chat <message>")
    .description("Chat üzenet küldése Edge Worker-re")
    .action(async (message: string) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/cloudflare/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: message }),
        });
        const data = await res.json();

        if (res.ok) {
          console.log(chalk.green("✅ Edge LLM válasz:"));
          console.log(chalk.white(data.assistantText));
        } else {
          console.error(chalk.red(`❌ Error: ${data.error}`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // 3. edge task "<instruction>"
  edge
    .command("task <instruction>")
    .description("Task submit Edge Worker-re")
    .action(async (instruction: string) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/cloudflare/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction }),
        });
        const data = await res.json();

        if (res.ok) {
          console.log(chalk.green(`✅ Task submitted: ${data.taskId}`));
          console.log(
            chalk.blue(`Query status: brunella edge query ${data.taskId}`),
          );
        } else {
          console.error(chalk.red(`❌ Error: ${data.error}`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // 4. edge query <taskId>
  edge
    .command("query <taskId>")
    .description("Task status lekérdezése")
    .action(async (taskId: string) => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/cloudflare/status/${taskId}`,
        );
        const data = await res.json();

        if (res.ok) {
          console.log(chalk.blue(`📋 Task: ${taskId}`));
          console.log(chalk.yellow(`Status: ${data.status}`));
          if (data.result) {
            console.log(chalk.green(`Result: ${data.result}`));
          }
          console.log(
            chalk.gray(
              `Created: ${new Date(data.created_at).toLocaleString()}`,
            ),
          );
          if (data.completed_at) {
            console.log(
              chalk.gray(
                `Completed: ${new Date(data.completed_at).toLocaleString()}`,
              ),
            );
          }
        } else {
          console.error(chalk.red(`❌ Error: ${data.error}`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // 5. edge history [--limit N]
  edge
    .command("history")
    .description("Recent tasks listázása D1-ből")
    .option("-l, --limit <number>", "Hány task-ot listázzon", "20")
    .action(async (options: { limit: string }) => {
      try {
        const limit = parseInt(options.limit);
        const res = await fetch(
          `${BACKEND_URL}/api/cloudflare/history?limit=${limit}`,
        );
        const data = await res.json();

        if (res.ok) {
          console.log(chalk.blue(`📜 Edge Task History (Last ${limit}):`));
          data.tasks.forEach((task: any, idx: number) => {
            const statusIcon =
              task.status === "success"
                ? "✅"
                : task.status === "error"
                  ? "❌"
                  : "⏳";
            console.log(
              chalk.white(
                `${idx + 1}. ${task.id} | ${task.status} ${statusIcon} | ${task.instruction.slice(0, 40)}... | ${new Date(task.created_at).toLocaleString()}`,
              ),
            );
          });
        } else {
          console.error(chalk.red(`❌ Error: ${data.error}`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });
}
```

**Register in src/cli/index.ts**

```typescript
import { registerEdgeCommands } from "./commands/edge.js";

// ... existing code ...

registerEdgeCommands(program);

program.parse();
```

### Success Metrics (CLI Component)

| Metrika                 | Célérték | Mérési Módszer                               |
| ----------------------- | -------- | -------------------------------------------- |
| CLI Commands Registered | 5        | `brunella edge --help` lists all 5           |
| `edge status` Working   | Yes      | `brunella edge status` returns health check  |
| `edge chat` Working     | Yes      | `brunella edge chat "test"` returns response |
| `edge task` Working     | Yes      | `brunella edge task "test"` returns taskId   |
| `edge query` Working    | Yes      | `brunella edge query <id>` returns task data |
| `edge history` Working  | Yes      | `brunella edge history` lists recent tasks   |

---

## Overall Success Metrics (Iteration 2)

| Metrika                  | Célérték  | Elért | Státusz    |
| ------------------------ | --------- | ----- | ---------- |
| WebSocket Server         | Working   | 0%    | ⏳ PENDING |
| Worker Durable Objects   | Working   | 0%    | ⏳ PENDING |
| Dashboard WebSocket Hook | Connected | 0%    | ⏳ PENDING |
| D1 Database Schema       | Created   | 0%    | ⏳ PENDING |
| D1 INSERT/SELECT         | Working   | 0%    | ⏳ PENDING |
| History Endpoint         | Working   | 0%    | ⏳ PENDING |
| CLI Commands             | 5 working | 0%    | ⏳ PENDING |
| Build Errors             | 0         | TBD   | ⏳ PENDING |
| Tests Pass Rate          | 100%      | TBD   | ⏳ PENDING |

**Average Completion**: **0%** (Iteration 2 not started)

---

## Dependencies

### Iteration 1 Completion (✅ REQUIRED)

- ✅ Backend API routes (status, task, query, chat) - DONE
- ✅ Dashboard integration (NeuralLinkChat 2 modes) - DONE
- ✅ Tests (9/9 passing) - DONE
- ✅ Feature-flag (EDGE_ENABLED) - DONE
- ✅ Documentation (README ~250 words) - DONE

### New npm Packages (Iteration 2)

```json
{
  "dependencies": {
    "socket.io": "^4.6.0",
    "socket.io-client": "^4.6.0"
  },
  "devDependencies": {
    "@types/socket.io": "^3.0.2"
  }
}
```

### Cloudflare Resources

- **Durable Objects**: Enabled in Cloudflare Workers plan (Paid plan required)
- **D1 Database**: Created via `wrangler d1 create brunella-edge-tasks`
- **WebSocket Support**: Available in Workers with Durable Objects

---

## Estimated Timeline (6 hours)

| Phase                           | Estimated Time | Tasks                                                 |
| ------------------------------- | -------------- | ----------------------------------------------------- |
| Phase 1: WebSocket Backend      | 2 hours        | socket.io setup, event handlers, backend integration  |
| Phase 2: Worker Durable Objects | 1.5 hours      | WebSocket upgrade, session management, broadcasting   |
| Phase 3: D1 Schema + Queries    | 1.5 hours      | D1 database creation, schema migration, INSERT/SELECT |
| Phase 4: CLI Commands           | 1 hour         | Register 5 commands, chalk output, error handling     |
| Phase 5: Tests + Docs           | 1 hour         | Unit tests (WebSocket, D1 mocks), README updates      |

**Total**: **~6-7 hours** (HIGH effort track)

---

## Known Risks & Mitigation

### Risk 1: Durable Objects Complexity (HIGH)

- **Risk**: Durable Objects require paid Cloudflare plan (not free tier)
- **Mitigation**: Start with HTTP long-polling fallback, add WebSocket incrementally, document upgrade path
- **Impact**: Feature may be demo-only if paid plan not available

### Risk 2: WebSocket Connection Stability (MEDIUM)

- **Risk**: Reconnection logic, network interruptions, state sync
- **Mitigation**: Use socket.io (auto-reconnect built-in), heartbeat pings, client-side retry
- **Impact**: Edge cases may cause message loss (acceptable for non-critical features)

### Risk 3: D1 Migration (MEDIUM)

- **Risk**: Schema changes in future iterations require migrations
- **Mitigation**: Design schema upfront (extensible), use Wrangler migrations, test locally
- **Impact**: Downtime during migration (mitigated by D1 local preview)

### Risk 4: CLI Testing (MEDIUM)

- **Risk**: CLI harder to unit test (terminal I/O, colors, mocks)
- **Mitigation**: Test API endpoints separately, use Commander testing patterns, mock fetch
- **Impact**: Lower test coverage for CLI (acceptable - focus on API tests)

---

## Approval Checklist

Before starting implementation:

- [ ] User confirms Durable Objects feasibility (paid plan availability)
- [ ] WebSocket vs. HTTP long-polling decision finalized
- [ ] D1 schema reviewed (extensible for future analytics)
- [ ] CLI command names approved (Hungarian vs. English descriptions)
- [ ] Priority confirmed (HIGH - can start immediately after approval)

---

**Status**: ⏳ **PENDING_APPROVAL** (awaiting user confirmation)  
**Next Actions**:

1. User reviews spec
2. User approves or requests changes
3. Track status → `active`, progress → begins at 0%
4. Implementation starts (Phase 1: WebSocket Backend)
