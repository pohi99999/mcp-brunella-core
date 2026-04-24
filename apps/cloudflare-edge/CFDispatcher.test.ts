import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@packages/core-logic/cloudflare/cloudflareHelpers.js", () => {
  const inventory = [
    { id: "cean-orchestrator", name: "cean-orchestrator", url: "https://cean.example", kind: "public" },
    { id: "agents-api", name: "agents-api", url: "https://agents.example", kind: "internal" },
    { id: "llm-chat-app-template", name: "llm-chat-app-template", url: "https://llm.example", kind: "public" },
    { id: "brunella-cf", name: "brunella-cf", url: "https://brunella.example", kind: "public" },
  ];

  return {
    getCloudflareWorkersInventory: vi.fn(() => inventory),
    postTaskToWorker: vi.fn(async () => ({
      success: true,
      workerId: "agents-api",
      workerName: "agents-api",
      endpoint: "/task",
      result: { ok: true },
    })),
  };
});

import { buildBrunellaTaskMeta, shouldDelegate } from "@packages/core-logic/cloudflare/CFDispatcher.js";
import { withCFDispatch } from "@packages/core-logic/cloudflare/CFDispatchMiddleware.js";
import { postTaskToWorker } from "@packages/core-logic/cloudflare/cloudflareHelpers.js";

const mockedPostTaskToWorker = vi.mocked(postTaskToWorker);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CFDispatcher", () => {
  it("routes local model tasks to local execution", () => {
    const task = buildBrunellaTaskMeta("builder-agent", "Implement the feature", {
      taskMeta: { requiresLocalModel: true },
    });

    const decision = shouldDelegate(task);

    expect(decision.delegate).toBe(false);
    expect(decision.target).toBe("local");
  });

  it("routes vector search tasks to cf_vectorize", () => {
    const decision = shouldDelegate(
      buildBrunellaTaskMeta("knowledge-agent", "Find similar items", {
        taskMeta: { isVectorSearch: true },
      }),
    );

    expect(decision.delegate).toBe(true);
    expect(decision.target).toBe("cf_vectorize");
  });

  it("routes LLM tasks to cf_ai_gateway", () => {
    const decision = shouldDelegate(
      buildBrunellaTaskMeta("research-agent", "Generate a response", {
        taskMeta: { involvesLLM: true },
      }),
    );

    expect(decision.delegate).toBe(true);
    expect(decision.target).toBe("cf_ai_gateway");
  });

  it("routes fast lookups to cf_kv and slower ones to cf_d1", () => {
    const kvDecision = shouldDelegate(
      buildBrunellaTaskMeta("lookup-agent", "Read the key", {
        taskMeta: { isDataLookup: true, estimatedDurationMs: 50 },
      }),
    );

    const d1Decision = shouldDelegate(
      buildBrunellaTaskMeta("lookup-agent", "Read the row", {
        taskMeta: { isDataLookup: true, estimatedDurationMs: 250 },
      }),
    );

    expect(kvDecision.target).toBe("cf_kv");
    expect(d1Decision.target).toBe("cf_d1");
  });

  it("routes async and long-running work to cf_queue", () => {
    const asyncDecision = shouldDelegate(
      buildBrunellaTaskMeta("pipeline-agent", "Run background work", {
        taskMeta: { isAsync: true },
      }),
    );

    const longDecision = shouldDelegate(
      buildBrunellaTaskMeta("pipeline-agent", "Run background work", {
        taskMeta: { estimatedDurationMs: 9000 },
      }),
    );

    expect(asyncDecision.target).toBe("cf_queue");
    expect(longDecision.target).toBe("cf_queue");
  });

  it("routes external API work to cf_worker", () => {
    const decision = shouldDelegate(
      buildBrunellaTaskMeta("research-agent", "Call the external API", {
        taskMeta: { requiresExternalAPI: true },
      }),
    );

    expect(decision.delegate).toBe(true);
    expect(decision.target).toBe("cf_worker");
    expect(decision.workerId).toBe("agents-api");
  });

  it("defaults to local when no rule matches", () => {
    const decision = shouldDelegate(buildBrunellaTaskMeta("general-agent", "Simple work"));

    expect(decision.delegate).toBe(false);
    expect(decision.target).toBe("local");
  });

  it("falls back locally when Cloudflare dispatch fails", async () => {
    mockedPostTaskToWorker.mockRejectedValueOnce(new Error("simulated CF failure"));

    const result = await withCFDispatch(
      buildBrunellaTaskMeta("research-agent", "Call the external API", {
        taskMeta: { requiresExternalAPI: true },
      }),
      async () => ({ success: true, message: "local fallback" }),
    );

    expect(result).toEqual({ success: true, message: "local fallback" });
    expect(mockedPostTaskToWorker).toHaveBeenCalled();
  });

  it("prefers local model requests over other cloudflare signals", () => {
    const decision = shouldDelegate(
      buildBrunellaTaskMeta("builder-agent", "Draft the implementation", {
        taskMeta: {
          requiresLocalModel: true,
          involvesLLM: true,
          requiresExternalAPI: true,
        },
      }),
    );

    expect(decision.delegate).toBe(false);
    expect(decision.target).toBe("local");
  });

  it("selects the best matching worker for external API work", () => {
    const orchestratorDecision = shouldDelegate({
      type: "Call the external API",
      agentName: "cean-orchestrator",
      requiresExternalAPI: true,
    });
    const llmDecision = shouldDelegate({
      type: "Call the external API",
      agentName: "llm-agent",
      requiresExternalAPI: true,
    });

    expect(orchestratorDecision.delegate).toBe(true);
    expect(orchestratorDecision.target).toBe("cf_worker");
    expect(orchestratorDecision.workerId).toBe("cean-orchestrator");
    expect(llmDecision.delegate).toBe(true);
    expect(llmDecision.target).toBe("cf_ai_gateway");
    expect(llmDecision.workerId).toBe("llm-chat-app-template");
  });

  it("prefers cf_worker over lookup routing when external API is also required", () => {
    const decision = shouldDelegate(
      buildBrunellaTaskMeta("research-agent", "Lookup external records", {
        taskMeta: {
          isDataLookup: true,
          requiresExternalAPI: true,
          estimatedDurationMs: 50,
        },
      }),
    );

    expect(decision.target).toBe("cf_worker");
    expect(decision.workerId).toBe("agents-api");
  });
});
