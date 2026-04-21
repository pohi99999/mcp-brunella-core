import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ScheduledTasksEngine } from "../src/core/scheduledTasksEngine.js";
import { createScheduledTasksRoutes } from "../src/server/routes/scheduledTasks.js";

// Mock dependencies
vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

const executeTaskMock = vi.hoisted(() => vi.fn(async () => ({ success: true, message: "ok" })));
vi.mock("../src/server/schedulers/scheduledTasksRunner.js", () => ({
  scheduledTasksRunner: {
    executeTask: executeTaskMock,
  },
}));

// Mock node-cron
vi.mock("node-cron", () => ({
  default: {
    validate: vi.fn((pattern) => pattern !== "invalid pattern"),
    schedule: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  },
  validate: vi.fn((pattern) => pattern !== "invalid pattern"),
  schedule: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock better-sqlite3
const mockPrepare = vi.fn();
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockExec = vi.fn();

vi.mock("better-sqlite3", () => {
  return {
    default: class MockDatabase {
      constructor() {
        // Return the mock object structure
        // In JS/TS constructors can return an object to override 'this'
        return {
          prepare: mockPrepare,
          exec: mockExec,
          close: vi.fn(),
        };
      }
    }
  };
});

describe("ScheduledTasksEngine Integráció", () => {
  let db: any;
  let engine: ScheduledTasksEngine;
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Configure mocks
    mockPrepare.mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    });
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);

    // Initialize Engine with mocked DB
    const Database = (await import("better-sqlite3")).default;
    // @ts-expect-error
    db = new Database(":memory:");
    engine = new ScheduledTasksEngine(db as any);

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).scheduledTasksEngine = engine;
      next();
    });
    app.use("/api/v1/scheduled-tasks", createScheduledTasksRoutes(db as any));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Engine Logic", () => {
    it("should schedule a valid task", () => {
      const task = {
        id: "task_1",
        task_name: "Test Task",
        cron_pattern: "* * * * *",
        api_endpoint: "/test",
        method: "GET" as const,
        enabled: true,
        created_at: new Date().toISOString()
      };

      const result = engine.scheduleTask(task);
      expect(result.success).toBe(true);
      expect(result.message).toContain("scheduled");
    });

    it("should update next_run based on cron pattern execution", async () => {
      const task = {
        id: "task_exec",
        task_name: "Exec Task",
        cron_pattern: "*/15 * * * *", // Every 15 minutes
        api_endpoint: "/test-endpoint",
        method: "GET" as const,
        enabled: true,
        created_at: new Date().toISOString()
      };

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      // Execute
      await (engine as any).executeTask(task);

      // Verify DB update call
      const runCalls = mockRun.mock.calls;
      const lastRunCall = runCalls[runCalls.length - 1];

      expect(lastRunCall).toBeDefined();
      expect(lastRunCall).toHaveLength(2);
      expect(lastRunCall[1]).toBe(task.id);

      const nextRunArg = lastRunCall[0];

      // Check that it is NOT '3600' (the current hardcoded value)
      expect(nextRunArg).not.toBe('3600');

      // Check that it is a valid date string
      const date = new Date(nextRunArg);
      expect(date.toString()).not.toBe('Invalid Date');

      // Check that the date is in the future
      expect(date.getTime()).toBeGreaterThan(Date.now());
    });

    it("should execute non-scan handlers through the scheduler runner", async () => {
      mockPrepare.mockReturnValueOnce({
        get: vi.fn().mockReturnValue({
          id: "agent-task",
          title: "Agent Task",
          prompt: "prompt",
          cron_expression: "0 * * * *",
          handler: "agent",
          enabled: 1,
          metadata: null,
        }),
      });

      const response = await request(app).post("/api/v1/scheduled-tasks/agent-task/trigger");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(executeTaskMock).toHaveBeenCalledTimes(1);
      expect(executeTaskMock).toHaveBeenCalledWith(expect.objectContaining({
        id: "agent-task",
        handler: "agent",
        title: "Agent Task",
      }));
    });

    it("should reject unsupported handlers on manual trigger", async () => {
      mockPrepare.mockReturnValueOnce({
        get: vi.fn().mockReturnValue({
          id: "unsupported-task",
          title: "Unsupported Task",
          prompt: "prompt",
          cron_expression: "0 * * * *",
          handler: "brand_monitor",
          enabled: 1,
          metadata: null,
        }),
      });

      const response = await request(app).post("/api/v1/scheduled-tasks/unsupported-task/trigger");
      expect(response.status).toBe(422);
      expect(response.body.error).toContain("Unsupported handler");
      expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it("should return a non-success status when the runner reports failure", async () => {
      executeTaskMock.mockResolvedValueOnce({ success: false, error: "runner failed" });
      mockPrepare.mockReturnValueOnce({
        get: vi.fn().mockReturnValue({
          id: "failed-task",
          title: "Failed Task",
          prompt: "prompt",
          cron_expression: "0 * * * *",
          handler: "agent",
          enabled: 1,
          metadata: null,
        }),
      });

      const response = await request(app).post("/api/v1/scheduled-tasks/failed-task/trigger");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: "Task execution failed",
        result: { success: false, error: "runner failed" },
      });
    });
  });
});
