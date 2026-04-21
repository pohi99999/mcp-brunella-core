import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const edgeAgentMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  submitTask: vi.fn(),
  getTaskStatus: vi.fn(),
  isEdgeHealthy: vi.fn(),
  getHealth: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock("../src/agents/EdgeProxyAgent.js", () => ({
  EdgeProxyAgent: vi.fn().mockImplementation(() => edgeAgentMocks),
}));

vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/utils/ensureError.js", () => ({
  ensureError: (error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
}));

import { cloudflareClient } from "../src/agents/cloudflare/CloudflareClient.js";

describe("CloudflareClient wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    edgeAgentMocks.initialize.mockResolvedValue(undefined);
    edgeAgentMocks.isEdgeHealthy.mockReturnValue(true);
    edgeAgentMocks.getHealth.mockReturnValue({
      edge: "healthy",
      tunnel: "connected",
      latency: 12,
      lastCheck: "2026-04-06T00:00:00.000Z",
    });
  });

  afterEach(async () => {
    await cloudflareClient.shutdown();
    vi.restoreAllMocks();
  });

  it("preserves task IDs from nested edge task payloads", async () => {
    edgeAgentMocks.submitTask.mockResolvedValueOnce({
      success: true,
      message: "Task queued",
      data: {
        task: {
          taskId: "task-123",
          result: { accepted: true },
        },
      },
    });

    const result = await cloudflareClient.submitTask("Generate code");

    expect(edgeAgentMocks.initialize).toHaveBeenCalledTimes(1);
    expect(edgeAgentMocks.submitTask).toHaveBeenCalledWith({
      task: "Generate code",
      context: {},
    });
    expect(result).toEqual({
      taskId: "task-123",
      status: "pending",
    });
  });

  it("generates a fallback task ID when the worker response is incomplete", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    edgeAgentMocks.submitTask.mockResolvedValueOnce({
      success: true,
      message: "Task queued",
      data: {
        task: {
          result: { accepted: true },
        },
      },
    });

    const result = await cloudflareClient.submitTask("Generate code");

    expect(result.taskId).toMatch(/^task_1700000000000_[a-z0-9]{7}$/);
    expect(result.status).toBe("pending");
  });

  it("normalizes task status fields without changing the wrapper shape", async () => {
    edgeAgentMocks.getTaskStatus.mockResolvedValueOnce({
      status: "dispatched",
      result: {
        progress: 50,
      },
    });

    const result = await cloudflareClient.checkStatus("task-123");

    expect(result).toEqual({
      status: "dispatched",
      result: {
        progress: 50,
      },
      progress: 50,
      currentStep: "Processing...",
    });
  });

  it("prefers nested chat results and falls back to the worker message", async () => {
    edgeAgentMocks.submitTask.mockResolvedValueOnce({
      success: true,
      message: "Fallback worker message",
      data: {
        task: {
          result: "Szia!",
        },
      },
    });

    const result = await cloudflareClient.chat("Hello");

    expect(result).toEqual({
      response: "Szia!",
      model: "cloudflare-worker-ai",
    });
  });
});
