# Cloudflare Chat Integration - Iteration 2 Implementációs Terv

**Track ID**: `cloudflare-iteration-2-20260212`  
**Status**: ⏳ PENDING_APPROVAL → ACTIVE  
**Estimated Effort**: 6-7 hours  
**Priority**: HIGH

---

## Fázisok Áttekintése

| Fázis      | Komponens                 | Idő      | Progress | Státusz    |
| ---------- | ------------------------- | -------- | -------- | ---------- |
| 1          | WebSocket Backend Setup   | 2h       | 0%       | ⏳ PENDING |
| 2          | Worker Durable Objects    | 1.5h     | 0%       | ⏳ PENDING |
| 3          | D1 Schema + Queries       | 1.5h     | 0%       | ⏳ PENDING |
| 4          | CLI Commands (5 commands) | 1h       | 0%       | ⏳ PENDING |
| 5          | Dashboard WebSocket Hook  | 0.5h     | 0%       | ⏳ PENDING |
| 6          | Tests + Documentation     | 1h       | 0%       | ⏳ PENDING |
| **Totals** | **6 phases**              | **7.5h** | **0%**   | ⏳ PENDING |

---

## Phase 1: WebSocket Backend Setup (2 hours)

### Célok

- Socket.io szerver inicializálása
- WebSocket event handlers implementálása
- Backend HTTP szerver integrációja
- CORS + reconnection logika

### Tasks

#### Task 1.1: Dependencies Install (10 min)

```bash
npm install socket.io @types/socket.io
npm install socket.io-client  # Frontend
```

**Success Criteria**: `package.json` updated, `node_modules` installed

#### Task 1.2: WebSocket Server Module (30 min)

**File**: `src/server/websocket.ts`

```typescript
import { Server } from "socket.io";
import { logInfo, logError } from "../utils/logger.js";
import { submitTask, checkStatus } from "./cloudflare_client.js";

export function initializeWebSocketServer(httpServer: any): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io/",
  });

  io.on("connection", (socket) => {
    logInfo("WebSocket", `Client connected: ${socket.id}`);

    // Event 1: Task Submit
    socket.on("edge:task:submit", async (data: { instruction: string }) => {
      try {
        const result = await submitTask(data.instruction);
        socket.emit("edge:task:submitted", { taskId: result.taskId });

        // Poll task status and emit progress
        const interval = setInterval(async () => {
          const status = await checkStatus(result.taskId);
          socket.emit("edge:task:progress", status);

          if (status.status === "success" || status.status === "error") {
            clearInterval(interval);
            socket.emit("edge:task:complete", status);
          }
        }, 2000); // Poll every 2s (future: replace with Worker push)
      } catch (error: any) {
        logError("WebSocket", `Task submit error: ${error.message}`);
        socket.emit("edge:task:error", { error: error.message });
      }
    });

    // Event 2: Chat Message
    socket.on("edge:chat:message", async (data: { message: string }) => {
      try {
        // TODO: Implement streaming chat
        socket.emit("edge:chat:token", { token: "Response...", done: false });
        socket.emit("edge:chat:token", { token: "", done: true });
      } catch (error: any) {
        logError("WebSocket", `Chat error: ${error.message}`);
        socket.emit("edge:chat:error", { error: error.message });
      }
    });

    // Event 3: Disconnect
    socket.on("disconnect", () => {
      logInfo("WebSocket", `Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
```

**Success Criteria**:

- Module compiles without errors
- Exports `initializeWebSocketServer` function
- Handles 2 events (task:submit, chat:message)

#### Task 1.3: Integrate into src/index.ts (20 min)

**File**: `src/index.ts`

Add after HTTP server creation:

```typescript
import { initializeWebSocketServer } from "./server/websocket.js";

// ... existing HTTP server setup ...

const server = app.listen(PORT, () => {
  logInfo("Server", `Brunella Backend running on port ${PORT}`);
});

// Initialize WebSocket server
const io = initializeWebSocketServer(server);
logInfo("WebSocket", "Socket.io server initialized");
```

**Success Criteria**:

- Backend starts without errors
- WebSocket server listens on same port as HTTP

#### Task 1.4: Environment Variables (10 min)

**File**: `.env.example`

```env
# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3000  # Same as HTTP port (Socket.io shares port)
```

**Success Criteria**: Feature-flag added, documented in README

#### Task 1.5: Basic Connection Test (50 min)

**File**: `test/websocket.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient, Socket } from "socket.io-client";
import { app } from "../src/index.js";

let clientSocket: Socket;
let serverPort = 3001;

beforeAll(async () => {
  // Start test server
  const server = app.listen(serverPort);

  // Connect client
  clientSocket = ioClient(`http://localhost:${serverPort}`, {
    transports: ["websocket"],
  });

  await new Promise((resolve) => clientSocket.on("connect", resolve));
});

afterAll(() => {
  clientSocket.disconnect();
});

describe("WebSocket Server", () => {
  it("should connect successfully", async () => {
    expect(clientSocket.connected).toBe(true);
  });

  it("should handle edge:task:submit event", async () => {
    const response = await new Promise((resolve) => {
      clientSocket.emit("edge:task:submit", { instruction: "Test task" });
      clientSocket.once("edge:task:submitted", resolve);
    });

    expect(response).toHaveProperty("taskId");
  });
});
```

**Success Criteria**:

- Tests pass (2/2)
- WebSocket connection established
- Task submit event handled

---

## Phase 2: Worker Durable Objects (1.5 hours)

### Célok

- Durable Objects WebSocket support
- Client session management
- Broadcasting messages to connected clients

### Tasks

#### Task 2.1: Durable Object Class (40 min)

**File**: `cloudflare/edge-coordinator.ts`

```typescript
export class EdgeCoordinator {
  private state: DurableObjectState;
  private sessions: Map<string, WebSocket>;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, server);

      server.addEventListener("message", async (event) => {
        const data = JSON.parse(event.data as string);

        if (data.type === "task:submit") {
          // Process task
          const taskId = crypto.randomUUID();

          // Save to D1
          await this.env.DB.prepare(
            "INSERT INTO tasks (id, instruction, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          )
            .bind(taskId, data.instruction, "pending", Date.now(), Date.now())
            .run();

          // Broadcast to all clients
          this.broadcast({ type: "task:submitted", taskId });

          // Simulate task processing (future: call AI agent)
          setTimeout(() => {
            this.broadcast({
              type: "task:complete",
              taskId,
              status: "success",
              result: "Task completed",
            });
          }, 3000);
        }
      });

      server.addEventListener("close", () => {
        this.sessions.delete(sessionId);
      });

      server.accept();

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not a WebSocket request", { status: 400 });
  }

  private broadcast(message: any) {
    const payload = JSON.stringify(message);
    for (const [id, ws] of this.sessions) {
      try {
        ws.send(payload);
      } catch (error) {
        console.error(`Failed to send to session ${id}:`, error);
      }
    }
  }
}
```

**Success Criteria**:

- Class compiles
- WebSocket upgrade returns 101
- Sessions map tracks clients

#### Task 2.2: wrangler.toml Configuration (20 min)

**File**: `cloudflare/wrangler.toml`

```toml
name = "brunella-edge-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "EDGE_COORDINATOR", class_name = "EdgeCoordinator" }
]

[[migrations]]
tag = "v1"
new_classes = ["EdgeCoordinator"]

[[d1_databases]]
binding = "DB"
database_name = "brunella-edge-tasks"
database_id = "your-d1-database-id"  # From wrangler d1 create
```

**Success Criteria**:

- Durable Objects binding configured
- Migration defined

#### Task 2.3: Deploy & Test (30 min)

```bash
# Deploy Worker with Durable Objects
wrangler deploy

# Test WebSocket connection
wscat -c wss://brunella-edge.YOUR_SUBDOMAIN.workers.dev/ws
```

**Success Criteria**:

- Worker deploys successfully
- WebSocket connection established
- Can send/receive messages

---

## Phase 3: D1 Schema + Queries (1.5 hours)

### Célok

- D1 database létrehozása
- Schema migration
- INSERT/SELECT queries implementálása

### Tasks

#### Task 3.1: Create D1 Database (10 min)

```bash
wrangler d1 create brunella-edge-tasks
```

**Output**: Database ID → copy to `wrangler.toml`

**Success Criteria**: Database exists in Cloudflare dashboard

#### Task 3.2: Schema Migration (20 min)

**File**: `cloudflare/migrations/0001_create_tasks.sql`

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'error')),
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  metadata TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
```

**Apply Migration**:

```bash
wrangler d1 execute brunella-edge-tasks --file=./migrations/0001_create_tasks.sql
```

**Success Criteria**:

- Table created
- Indexes created
- Schema queryable

#### Task 3.3: Worker Query Functions (40 min)

**File**: `cloudflare/src/db.ts`

```typescript
export async function insertTask(
  db: D1Database,
  taskId: string,
  instruction: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO tasks (id, instruction, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(taskId, instruction, "pending", Date.now(), Date.now())
    .run();
}

export async function updateTaskStatus(
  db: D1Database,
  taskId: string,
  status: string,
  result?: string,
  error?: string,
): Promise<void> {
  const now = Date.now();
  const completedAt = status === "success" || status === "error" ? now : null;

  await db
    .prepare(
      "UPDATE tasks SET status = ?, result = ?, error = ?, updated_at = ?, completed_at = ? WHERE id = ?",
    )
    .bind(status, result || null, error || null, now, completedAt, taskId)
    .run();
}

export async function getTask(db: D1Database, taskId: string): Promise<any> {
  return await db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .bind(taskId)
    .first();
}

export async function getRecentTasks(
  db: D1Database,
  limit: number = 20,
): Promise<any[]> {
  const { results } = await db
    .prepare(
      "SELECT id, instruction, status, created_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .all();

  return results || [];
}
```

**Success Criteria**:

- 4 functions implemented
- Type-safe D1 queries
- No compilation errors

#### Task 3.4: Backend History Endpoint (20 min)

**File**: `src/server/cloudflare_routes.ts`

Add new route:

```typescript
app.get("/api/cloudflare/history", async (req, res) => {
  if (!EDGE_ENABLED) {
    return res.status(503).json({ error: "Edge disabled" });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const response = await fetch(
      `${CLOUDFLARE_WORKER_URL}/api/history?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
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

**Success Criteria**:

- Endpoint returns task array
- Proxies request to Worker
- Error handling implemented

---

## Phase 4: CLI Commands (1 hour)

### Célok

- 5 új CLI parancs regisztrálása
- Színes terminal output (chalk)
- Error handling + help text

### Tasks

#### Task 4.1: Create edge.ts Module (40 min)

**File**: `src/cli/commands/edge.ts`

(Implementation in spec.md - full code provided)

Key commands:

1. `brunella edge status` - Health check
2. `brunella edge chat "<msg>"` - Chat message
3. `brunella edge task "<instruction>"` - Submit task
4. `brunella edge query <taskId>` - Query task status
5. `brunella edge history [--limit N]` - List recent tasks

**Success Criteria**:

- All 5 commands implemented
- chalk for colored output
- Error handling (try/catch + process.exit(1))

#### Task 4.2: Register in CLI Index (10 min)

**File**: `src/cli/index.ts`

```typescript
import { registerEdgeCommands } from "./commands/edge.js";

// ... existing setup ...

registerEdgeCommands(program);

program.parse();
```

**Success Criteria**:

- Commands appear in `brunella --help`
- `brunella edge --help` lists 5 subcommands

#### Task 4.3: Manual Testing (10 min)

```bash
npm run build
node build/cli/index.js edge status
node build/cli/index.js edge chat "Hello"
node build/cli/index.js edge task "Test task"
node build/cli/index.js edge history --limit 5
```

**Success Criteria**:

- All commands execute without crash
- Colored output displays correctly
- Errors handled gracefully

---

## Phase 5: Dashboard WebSocket Hook (30 min)

### Célok

- Custom React hook WebSocket connection kezelésére
- Auto-reconnect logika
- NeuralLinkChat integráció

### Tasks

#### Task 5.1: useWebSocket Hook (20 min)

**File**: `src/dashboard/hooks/useWebSocket.ts`

```typescript
import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(url, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => {
      setConnected(true);
      console.log("WebSocket connected");
    });

    s.on("disconnect", () => {
      setConnected(false);
      console.log("WebSocket disconnected");
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [url]);

  const emit = useCallback(
    (event: string, data: any) => {
      if (socket) {
        socket.emit(event, data);
      }
    },
    [socket],
  );

  const on = useCallback(
    (event: string, handler: (data: any) => void) => {
      if (socket) {
        socket.on(event, handler);
      }
    },
    [socket],
  );

  return { socket, connected, emit, on };
}
```

**Success Criteria**:

- Hook compiles
- Auto-reconnect works
- Exposes emit/on methods

#### Task 5.2: Integrate into NeuralLinkChat (10 min)

**File**: `src/dashboard/components/NeuralLinkChat.tsx`

Add after existing imports:

```typescript
import { useWebSocket } from "../hooks/useWebSocket";

// Inside component:
const { socket, connected, emit, on } = useWebSocket("http://localhost:3000");

useEffect(() => {
  if (connected) {
    on("edge:task:submitted", (data) => {
      console.log("Task submitted:", data.taskId);
    });

    on("edge:task:complete", (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.result },
      ]);
    });
  }
}, [connected, on]);
```

**Success Criteria**:

- Component compiles
- WebSocket connection badge updates (green when connected)
- Real-time task updates display

---

## Phase 6: Tests + Documentation (1 hour)

### Célok

- WebSocket tests (connection, events)
- D1 query tests (mocks)
- CLI tests (fetch mocks)
- README updates

### Tasks

#### Task 6.1: WebSocket Tests (20 min)

**File**: `test/websocket.test.ts` (from Phase 1)

Add more tests:

- Task submit → task:submitted event
- Chat message → chat:token event
- Disconnect handling

**Success Criteria**: 5+ tests passing

#### Task 6.2: D1 Query Tests (20 min)

**File**: `test/d1_queries.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { insertTask, getTask, updateTaskStatus } from "../cloudflare/src/db.js";

describe("D1 Queries", () => {
  it("should insert task", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    await insertTask(mockDB as any, "task-1", "Test instruction");

    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tasks"),
    );
  });

  it("should get task by ID", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: "task-1", status: "success" }),
        }),
      }),
    };

    const task = await getTask(mockDB as any, "task-1");

    expect(task.status).toBe("success");
  });
});
```

**Success Criteria**: 4+ tests passing

#### Task 6.3: CLI Tests (10 min)

**File**: `test/cli_edge.test.ts`

Mock fetch calls, test command parsing:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import fetch from "node-fetch";

vi.mock("node-fetch");

describe("Edge CLI Commands", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, healthy: true }),
    } as any);
  });

  it("should execute edge status command", async () => {
    // Mock CLI execution
    // Assert fetch called with correct URL
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/cloudflare/status"),
    );
  });
});
```

**Success Criteria**: 3+ tests passing

#### Task 6.4: README Updates (10 min)

**File**: `README.md`

Add new sections:

**WebSocket Integration**:

```markdown
### WebSocket Real-time Communication

Backend exposes Socket.io server at `http://localhost:3000/socket.io/`.

**Events**:

- `edge:task:submit` - Submit task
- `edge:task:submitted` - Task submitted (returns taskId)
- `edge:task:complete` - Task completed (returns result)
- `edge:chat:message` - Send chat message
- `edge:chat:token` - Receive streaming chat tokens
```

**D1 Storage**:

```markdown
### D1 Persistent Task Storage

All tasks are stored in Cloudflare D1 (SQLite) database.

**Schema**: `tasks` table with columns: id, instruction, status, result, error, created_at, updated_at, completed_at, metadata

**Query Endpoint**: `GET /api/cloudflare/history?limit=20`
```

**CLI Commands**:

````markdown
### CLI Edge Commands

```bash
brunella edge status              # Health check
brunella edge chat "message"      # Chat with Edge LLM
brunella edge task "instruction"  # Submit task
brunella edge query <taskId>      # Query task status
brunella edge history --limit 10  # List recent tasks
```
````

```

**Success Criteria**:
- 3 new sections added
- Examples provided
- No markdown lint errors (critical)

---

## Testing Strategy

### Unit Tests (20 tests planned)

| Test Suite          | Tests | Coverage Target |
| ------------------- | ----- | --------------- |
| websocket.test.ts   | 5     | WebSocket setup |
| d1_queries.test.ts  | 5     | D1 INSERT/SELECT |
| cli_edge.test.ts    | 4     | CLI commands    |
| edge_routes.test.ts | 6     | New API routes  |

**Total**: 20 new tests (target: 90% coverage for new code)

### Manual Testing Checklist

- [ ] WebSocket connection from Dashboard
- [ ] Task submit via WebSocket → real-time update
- [ ] D1 task insert verified (wrangler d1 execute)
- [ ] CLI commands execute without errors
- [ ] README examples work (copy-paste test)

---

## Rollback Plan

If critical issues arise:

1. **WebSocket Issues**: Disable WEBSOCKET_ENABLED flag → fall back to HTTP polling
2. **D1 Issues**: Return 503 from history endpoint → frontend graceful degradation
3. **CLI Issues**: CLI optional (backend/dashboard still work)
4. **Durable Objects Issues**: Use HTTP long-polling instead of WebSocket

**Mitigation**: Feature-flags ensure system remains functional without new components

---

## Success Metrics (Iteration 2 Complete)

| Metric                     | Target  | Achieved | Status     |
| -------------------------- | ------- | -------- | ---------- |
| WebSocket Server Working   | Yes     | ⏳       | ⏳ PENDING |
| Worker Durable Objects     | Deployed | ⏳       | ⏳ PENDING |
| D1 Database Schema Created | Yes     | ⏳       | ⏳ PENDING |
| D1 Tasks Insert/Select     | Working | ⏳       | ⏳ PENDING |
| History Endpoint           | Working | ⏳       | ⏳ PENDING |
| CLI Commands (5)           | All working | ⏳    | ⏳ PENDING |
| Tests Pass Rate            | 95%+    | ⏳       | ⏳ PENDING |
| Build Errors               | 0       | ⏳       | ⏳ PENDING |
| Documentation Updated      | Yes     | ⏳       | ⏳ PENDING |

**Overall Progress**: **0%** → Target: **100%**

---

## Next Actions (After Approval)

1. **User reviews plan** → approves or requests changes
2. **Track status** → `active`, `spec_status` → `approved`
3. **Start Phase 1** → Install socket.io, create websocket.ts
4. **Daily sync** → Update progress in meta.json
5. **After completion** → Update tracks.md → `completed`

---

**Status**: ⏳ **PENDING_APPROVAL**
**Ready to Start**: Awaiting user confirmation
```
