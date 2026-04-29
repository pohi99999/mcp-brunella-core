import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { agentManager } from "@packages/agents/AgentManager.js";
import { PythonShell } from "@packages/utils/pythonShell.js";
import { saveCheckpoint, loadCheckpoint } from "@packages/core-logic/checkpoint.js";

// Mocking core modules
vi.mock("@packages/utils/logger.js", () => ({
  Logger: class {
    info = vi.fn();
    error = vi.fn();
    warn = vi.fn();
  },
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

vi.mock("@packages/core-logic/gitRecovery.js", () => ({
  gitAutoCheckpoint: vi.fn().mockResolvedValue({ success: true }),
  logRecoveryEvent: vi.fn(),
  getRecoveryLog: vi.fn().mockReturnValue([]),
  clearRecoveryLog: vi.fn(),
}));

vi.mock("@packages/core-logic/retryStrategy.js", () => ({
  withRetry: vi.fn().mockImplementation(async (fn, label, config) => {
    let lastError;
    // Simulate retries without actual delay
    for (let i = 0; i <= (config?.maxRetries || 2); i++) {
      try {
        if (i > 0 && config?.onRetry) {
          config.onRetry(i, 0, lastError || new Error("Initial"));
        }
        return await fn();
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }),
  calculateDelay: vi.fn().mockReturnValue(0),
  DEFAULT_RETRY_CONFIG: {
    maxRetries: 3,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
  },
}));

interface TaskResult {
  success: boolean;
  message: string;
  data: unknown;
}

describe("Phoenix Protocol: Recovery & Resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentManager.stopWorkerLoop();
    // Reset singleton state
    (agentManager as any).agents.clear();
    (agentManager as any).circuitBreakers.clear();
    (agentManager as any).agentRuntime.clear();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("AgentManager Circuit Breaker & Retry", () => {
    it("should trip circuit breaker after multiple failures", async () => {
      const failingAgent = {
        name: "FailingAgent",
        execute: vi.fn().mockRejectedValue(new Error("Persistent failure")),
      };

      agentManager.registerAgent(
        failingAgent as unknown as {
          name: string;
          execute: (
            task: string,
            context?: Record<string, unknown>,
          ) => Promise<unknown>;
        },
      );

      // 1st call: failures goes to 2 (Attempt 0 fail, Attempt 1 onRetry, Attempt 2 onRetry)
      await agentManager.delegate("FailingAgent", "crash test");

      // 2nd call: next fail makes failures = 3 -> trips CB
      await agentManager.delegate("FailingAgent", "crash test 2");

      // 3rd call: Should now be blocked by Circuit Breaker immediately
      const result = (await agentManager.delegate(
        "FailingAgent",
        "block test",
      )) as TaskResult;

      expect(result.success).toBe(false);
      expect(result.message).toContain("Circuit Breaker");
    });
  });

  describe("PythonShell Fallback Recovery", () => {
    it("should fallback to legacy shell if API fails", async () => {
      vi.useFakeTimers();

      // Mock fetch to simulate API failure
      global.fetch = vi
        .fn()
        .mockImplementation(() =>
          Promise.reject(new Error("Connection refused")),
        );

      const shell = new PythonShell("test.py");
      const runLegacySpy = vi
        .spyOn(shell as any, "runLegacy")
        .mockResolvedValue("legacy output");

      const runPromise = shell.run("print('hello')");

      // Advance past the 1500ms delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await runPromise;

      expect(runLegacySpy).toHaveBeenCalled();
      expect(result).toBe("legacy output");
    }, 15000);
  });

  describe("Checkpoint Persistence", () => {
    it("should save and load checkpoints correctly", async () => {
      const taskId = "test-task-" + Date.now();
      const step = 2;
      const state = { counter: 42, lastFile: "index.ts" };

      await saveCheckpoint(taskId, step, "working", state);

      const loaded = await loadCheckpoint(taskId);

      expect(loaded).toBeDefined();
      expect(loaded?.taskId).toBe(taskId);
      expect(loaded?.stepIndex).toBe(step);
      expect(JSON.parse(loaded?.stateJson as string)).toEqual(state);
    });
  });
});
