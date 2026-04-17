import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/cloudflare/cloudflareHelpers.js", () => {
  const inventory = [
    { id: "cean-orchestrator", name: "cean-orchestrator", url: "https://cean.example", kind: "public" },
    { id: "agents-api", name: "agents-api", url: "https://agents.example", kind: "internal" },
    { id: "llm-chat-app-template", name: "llm-chat-app-template", url: "https://llm.example", kind: "public" },
  ];

  return {
    getCloudflareWorkersInventory: vi.fn(() => inventory),
    postTaskToWorker: vi.fn(),
  };
});

vi.mock("../src/utils/metrics.js", () => ({
  recordCloudflareDispatchOutcome: vi.fn(),
}));

vi.mock("../src/utils/logger.js", () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { withCFDispatch } from "../src/cloudflare/CFDispatchMiddleware.js";
import { getCloudflareWorkersInventory, postTaskToWorker } from "../src/cloudflare/cloudflareHelpers.js";
import { recordCloudflareDispatchOutcome } from "../src/utils/metrics.js";

const mockedWorkersInventory = vi.mocked(getCloudflareWorkersInventory);
const mockedPostTaskToWorker = vi.mocked(postTaskToWorker);
const mockedRecordOutcome = vi.mocked(recordCloudflareDispatchOutcome);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLOUDFLARE_D1_WORKER_URL", "https://edge.example");
  vi.stubEnv("CF_BAS_API_TOKEN", "bas-token");
  vi.stubEnv("CEAN_API_KEY", "cean-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("CFDispatchMiddleware", () => {
  it("keeps local execution when the task requires a local model", async () => {
    const localFallback = vi.fn(async () => ({ success: true, executed: "local" }));

    const result = await withCFDispatch(
      {
        type: "builder-task",
        agentName: "builder-agent",
        requiresLocalModel: true,
      },
      localFallback,
    );

    expect(result).toEqual({ success: true, executed: "local" });
    expect(localFallback).toHaveBeenCalledTimes(1);
    expect(mockedPostTaskToWorker).not.toHaveBeenCalled();
    expect(mockedRecordOutcome).toHaveBeenCalledWith("local", "local");
  });

  it("delegates external API work to the best matching Cloudflare worker", async () => {
    mockedPostTaskToWorker.mockResolvedValueOnce({
      success: true,
      workerId: "agents-api",
      workerName: "agents-api",
      endpoint: "/task",
      result: { handled: true },
    });
    const localFallback = vi.fn(async () => ({ success: true, executed: "local" }));

    const result = await withCFDispatch(
      {
        type: "research-task",
        agentName: "research-agent",
        requiresExternalAPI: true,
        payload: {
          instruction: "Process the external API task",
          context: { source: "integration" },
        },
      },
      localFallback,
    );

    expect(result).toEqual({ handled: true });
    expect(localFallback).not.toHaveBeenCalled();
    expect(mockedPostTaskToWorker).toHaveBeenCalledTimes(1);
    expect(mockedPostTaskToWorker).toHaveBeenCalledWith(
      expect.objectContaining({ id: "agents-api" }),
      "Process the external API task",
      expect.objectContaining({
        instruction: "Process the external API task",
        context: { source: "integration" },
      }),
    );
    expect(mockedRecordOutcome).toHaveBeenCalledWith("cf_worker", "cf", expect.any(Number));
  });

  it("normalizes queued dispatch-smart responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ queued: true, taskId: "task-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await withCFDispatch(
      {
        type: "async-task",
        agentName: "pipeline-agent",
        isAsync: true,
        payload: {
          instruction: "Run in the queue",
          context: { batchId: 12 },
        },
      },
      vi.fn(async () => ({ success: true, executed: "local" })),
    );

    expect(result).toMatchObject({
      success: true,
      status: "queued",
      message: "Cloudflare queue accepted (task-123)",
    });
    expect(mockedRecordOutcome).toHaveBeenCalledWith("cf_queue", "cf", expect.any(Number));
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://edge.example/dispatch-smart",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("falls back locally when the chosen worker cannot be resolved", async () => {
    mockedWorkersInventory.mockReturnValueOnce([]);
    const localFallback = vi.fn(async () => ({ success: true, executed: "local" }));

    const result = await withCFDispatch(
      {
        type: "api-task",
        agentName: "research-agent",
        requiresExternalAPI: true,
        payload: {
          instruction: "Process the external API task",
          context: { source: "integration" },
        },
      },
      localFallback,
    );

    expect(result).toEqual({ success: true, executed: "local" });
    expect(localFallback).toHaveBeenCalledTimes(1);
    expect(mockedRecordOutcome).toHaveBeenCalledWith("cf_worker", "fallback", expect.any(Number));
  });

  it("returns the remote result payload when dispatch-smart replies with a result object", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { answer: 42 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await withCFDispatch(
      {
        type: "llm-task",
        agentName: "llm-agent",
        involvesLLM: true,
        payload: {
          prompt: "Explain the answer",
        },
      },
      vi.fn(async () => ({ success: true, executed: "local" })),
    );

    expect(result).toEqual({ answer: 42 });
    expect(mockedRecordOutcome).toHaveBeenCalledWith("cf_ai_gateway", "cf", expect.any(Number));
  });
});
