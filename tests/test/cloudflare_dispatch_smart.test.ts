import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

vi.mock("mustache", () => ({
  default: {
    render: vi.fn(),
  },
  render: vi.fn(),
}), { virtual: true });

vi.mock("@cloudflare/ai", () => ({
  Ai: vi.fn().mockImplementation(() => ({
    run: vi.fn(async (_model: string, input: { prompt?: string }) => ({
      model: _model,
      output: `AI:${input.prompt ?? ""}`,
    })),
  })),
}));

vi.mock("../bas-cloudflare-orchestrator/src/queueHandler.js", () => ({
  enqueueTask: vi.fn(async (queue: { send: (task: unknown, options: unknown) => Promise<void> }, task: unknown) => {
    await queue.send(task, { contentType: "json" });
  }),
  handleQueueBatch: vi.fn(),
}));

vi.mock("../bas-cloudflare-orchestrator/src/r2Artifacts.js", () => ({
  R2ArtifactManager: class MockR2ArtifactManager {},
}));

vi.mock("../bas-cloudflare-orchestrator/src/analyticsEngine.js", () => ({
  BASAnalytics: class MockBASAnalytics {
    recordSystemMetric(): void {}
  },
}));

import worker from "../bas-cloudflare-orchestrator/src/index.js";

interface MockD1Statement {
  bind: (...params: unknown[]) => MockD1Statement;
  first: <T = Record<string, unknown>>() => T | null;
  get: <T = Record<string, unknown>>() => T | undefined;
  all: <T = Record<string, unknown>>() => { results: T[] };
  run: () => { success: boolean; meta: unknown };
}

interface MockD1Database {
  db: Database.Database;
  prepare: (sql: string) => MockD1Statement;
  close: () => void;
}

function createD1Mock(): MockD1Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE worker_routing (
      agent_name TEXT,
      worker_url TEXT,
      is_healthy INTEGER
    );

    CREATE TABLE worker_tasks (
      id TEXT PRIMARY KEY,
      agent_name TEXT,
      worker_url TEXT,
      task TEXT,
      context TEXT,
      status TEXT,
      result TEXT,
      error TEXT,
      completed_at TEXT
    );

    CREATE TABLE dispatch_log (
      id TEXT PRIMARY KEY,
      agent_name TEXT,
      task_type TEXT,
      target TEXT,
      reason TEXT,
      success INTEGER,
      latency_ms INTEGER,
      created_at TEXT
    );
  `);

  const makeStatement = (sql: string, params: unknown[] = []): MockD1Statement => ({
    bind: (...nextParams: unknown[]) => makeStatement(sql, nextParams),
    first: <T = Record<string, unknown>>() => (db.prepare(sql).bind(...params).get() as T | undefined) ?? null,
    get: <T = Record<string, unknown>>() => db.prepare(sql).bind(...params).get() as T | undefined,
    all: <T = Record<string, unknown>>() => ({ results: db.prepare(sql).bind(...params).all() as T[] }),
    run: () => ({ success: true, meta: db.prepare(sql).bind(...params).run() }),
  });

  return {
    db,
    prepare: (sql: string) => makeStatement(sql),
    close: () => db.close(),
  };
}

function createEnv(db: MockD1Database) {
  const kvStore = new Map<string, string>();
  const vectorizeCeanQuery = vi.fn(async (vector: number[], options: { topK: number }) => ({
    index: "cean",
    vector,
    options,
  }));
  const vectorizeMemoryQuery = vi.fn(async (vector: number[], options: { topK: number }) => ({
    index: "memory",
    vector,
    options,
  }));
  const queueSend = vi.fn(async () => undefined);

  return {
    AI: {
      run: vi.fn(async (_model: string, input: { prompt?: string }) => ({
        model: _model,
        output: `AI:${input.prompt ?? ""}`,
      })),
    },
    D1_METADATA: db,
    BAS_TASKS: {
      get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      }),
    },
    R2_KNOWLEDGE: {},
    SWARM_COORDINATOR: {
      idFromName: vi.fn(),
      get: vi.fn(),
    },
    ASSETS: {
      fetch: vi.fn(async () => new Response("not found", { status: 404 })),
    },
    TASK_QUEUE: {
      send: queueSend,
    },
    RESULT_QUEUE: {
      send: vi.fn(),
    },
    DLQ: {
      send: vi.fn(),
    },
    VECTORIZE_MEMORY: {
      query: vectorizeMemoryQuery,
    },
    VECTORIZE_CEAN: {
      query: vectorizeCeanQuery,
    },
    BAS_ANALYTICS: {
      writeDataPoint: vi.fn(),
    },
    DEFAULT_CODE_MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    FALLBACK_CODE_MODEL: "@cf/meta/llama-3.3-8b-instruct",
    REASONING_MODEL: "@cf/deepseek/deepseek-r1-distill-qwen-32b",
    FAST_MODEL: "@cf/microsoft/phi-4",
    R2_PREFIX: "Brunella-core",
    CLOUDFLARE_API_TOKEN: "secret-token",
    __helpers: {
      kvStore,
      vectorizeCeanQuery,
      vectorizeMemoryQuery,
      queueSend,
    },
  };
}

async function dispatchSmart(body: Record<string, unknown>, env: ReturnType<typeof createEnv>) {
  const request = new Request("https://worker.example/dispatch-smart", {
    method: "POST",
    headers: {
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return worker.fetch(request, env as never);
}

let db: MockD1Database;

beforeEach(() => {
  vi.clearAllMocks();
  db = createD1Mock();
});

afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

describe("Cloudflare smart dispatch worker", () => {
  it("logs and returns local decisions", async () => {
    const env = createEnv(db);

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "builder-task",
          agentName: "builder-agent",
          requiresLocalModel: true,
        },
        payload: {
          instruction: "Keep this local",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decision.target).toBe("local");
    expect(body.status).toBe("local");
    expect(body.result).toMatchObject({ delegated: false });

    const rows = env.D1_METADATA.prepare("SELECT * FROM dispatch_log").all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      agent_name: "builder-agent",
      task_type: "builder-task",
      target: "local",
      success: 1,
    });
  });

  it("queues async tasks and persists the queue decision", async () => {
    const env = createEnv(db);

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "pipeline-task",
          agentName: "pipeline-agent",
          isAsync: true,
        },
        payload: {
          instruction: "Run later",
          context: { batchId: 7 },
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decision.target).toBe("cf_queue");
    expect(body.queued).toBe(true);
    expect(body.taskId).toMatch(/^task_/);
    expect(body.result).toMatchObject({ status: "queued" });
    expect(env.__helpers.queueSend).toHaveBeenCalledTimes(1);

    const rows = env.D1_METADATA.prepare("SELECT * FROM dispatch_log WHERE target = 'cf_queue'").all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      agent_name: "pipeline-agent",
      task_type: "pipeline-task",
      success: 1,
    });
  });

  it("stores KV values when a lookup includes a value", async () => {
    const env = createEnv(db);

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "lookup-task",
          agentName: "lookup-agent",
          isDataLookup: true,
          estimatedDurationMs: 50,
        },
        payload: {
          key: "alpha",
          value: { score: 3 },
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decision.target).toBe("cf_kv");
    expect(body.result).toEqual({ key: "alpha", stored: true });
    expect(env.BAS_TASKS.put).toHaveBeenCalledWith("alpha", JSON.stringify({ score: 3 }));

    const rows = env.D1_METADATA.prepare("SELECT * FROM dispatch_log WHERE target = 'cf_kv'").all();
    expect(rows.results).toHaveLength(1);
  });

  it("reads KV values when a lookup has no value", async () => {
    const env = createEnv(db);
    env.__helpers.kvStore.set("alpha", "value-1");

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "lookup-task",
          agentName: "lookup-agent",
          isDataLookup: true,
          estimatedDurationMs: 50,
        },
        payload: {
          key: "alpha",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toEqual({ key: "alpha", value: "value-1" });
  });

  it("executes D1 select queries", async () => {
    const env = createEnv(db);
    env.D1_METADATA.db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);");
    env.D1_METADATA.db.prepare("INSERT INTO items (id, name) VALUES (?, ?)").run(1, "original");

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "lookup-task",
          agentName: "lookup-agent",
          isDataLookup: true,
          estimatedDurationMs: 250,
        },
        payload: {
          query: "SELECT * FROM items",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decision.target).toBe("cf_d1");
    expect(body.result.results).toHaveLength(1);
    expect(body.result.results[0]).toMatchObject({ name: "original" });
  });

  it("executes D1 mutation queries", async () => {
    const env = createEnv(db);
    env.D1_METADATA.db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);");
    env.D1_METADATA.db.prepare("INSERT INTO items (id, name) VALUES (?, ?)").run(1, "original");

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "lookup-task",
          agentName: "lookup-agent",
          isDataLookup: true,
          estimatedDurationMs: 250,
        },
        payload: {
          sql: "UPDATE items SET name = ? WHERE id = ?",
          params: ["updated", 1],
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.meta.changes).toBe(1);

    const row = env.D1_METADATA.db.prepare("SELECT name FROM items WHERE id = 1").get() as { name: string };
    expect(row.name).toBe("updated");
  });

  it("executes worker tasks and stores completion state", async () => {
    const env = createEnv(db);
    env.D1_METADATA.db.prepare(
      "INSERT INTO worker_routing (agent_name, worker_url, is_healthy) VALUES (?, ?, 1)",
    ).run("ResearcherAgent", "https://worker.example");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { handled: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "research-task",
          agentName: "research-agent",
          requiresExternalAPI: true,
        },
        payload: {
          instruction: "Process the external task",
          context: { source: "integration" },
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.decision.target).toBe("cf_worker");
    expect(body.status).toBe("completed");
    expect(body.workerUrl).toBe("https://worker.example");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://worker.example/execute",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-BAS-API-Key": "secret-token",
        }),
      }),
    );

    const task = env.D1_METADATA.prepare("SELECT * FROM worker_tasks WHERE id = ?").bind(body.requestId).get() as {
      status: string;
      result: string;
    };
    expect(task.status).toBe("completed");
    expect(JSON.parse(task.result)).toEqual({ success: true, result: { handled: true } });
  });

  it("persists worker failures when the remote execution throws", async () => {
    const env = createEnv(db);
    env.D1_METADATA.db.prepare(
      "INSERT INTO worker_routing (agent_name, worker_url, is_healthy) VALUES (?, ?, 1)",
    ).run("ResearcherAgent", "https://worker.example");

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("worker timeout"));

    const response = await dispatchSmart(
      {
        taskMeta: {
          type: "research-task",
          agentName: "research-agent",
          requiresExternalAPI: true,
        },
        payload: {
          instruction: "Process the external task",
          context: { source: "integration" },
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("failed");
    expect(body.error).toMatch(/worker timeout/i);

    const task = env.D1_METADATA.prepare("SELECT * FROM worker_tasks WHERE id = ?").bind(body.requestId).get() as {
      status: string;
      error: string;
    };
    expect(task.status).toBe("failed");
    expect(task.error).toMatch(/worker timeout/i);
  });

  it("executes AI gateway tasks and vector searches", async () => {
    const env = createEnv(db);
    const aiResponse = await dispatchSmart(
      {
        taskMeta: {
          type: "llm-task",
          agentName: "llm-agent",
          involvesLLM: true,
        },
        payload: {
          prompt: "Explain the answer",
        },
      },
      env,
    );

    expect(aiResponse.status).toBe(200);
    const aiBody = await aiResponse.json();
    expect(aiBody.decision.target).toBe("cf_ai_gateway");
    expect(aiBody.result.output).toBe("AI:Explain the answer");

    const vectorResponse = await dispatchSmart(
      {
        taskMeta: {
          type: "vector-task",
          agentName: "cean-memory",
          isVectorSearch: true,
        },
        payload: {
          vector: [1, 2, 3],
        },
      },
      env,
    );

    expect(vectorResponse.status).toBe(200);
    const vectorBody = await vectorResponse.json();
    expect(vectorBody.decision.target).toBe("cf_vectorize");
    expect(vectorBody.result.index).toBe("cean");
    expect(env.__helpers.vectorizeCeanQuery).toHaveBeenCalledWith([1, 2, 3], { topK: 5 });
    expect(env.__helpers.vectorizeMemoryQuery).not.toHaveBeenCalled();
  });
});
