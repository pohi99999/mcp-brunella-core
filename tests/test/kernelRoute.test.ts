import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createKernelRoutes } from "@apps/mcp-core/server/routes/kernelRoute.js";

const mocks = vi.hoisted(() => ({
  executeKernelPipeline: vi.fn(),
  getAll: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@packages/core-logic/conductor.js", () => ({
  executeKernelPipeline: mocks.executeKernelPipeline,
  runLedger: {
    getAll: mocks.getAll,
    get: mocks.get,
  },
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe("Kernel route", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeKernelPipeline.mockResolvedValue({
      status: "success",
      module: "conductor",
      outputPayload: { ok: true },
    });
    mocks.getAll.mockReturnValue([]);
    mocks.get.mockReturnValue(null);

    app = express();
    app.use(express.json());
    app.use("/api/kernel", createKernelRoutes());
  });

  it("requires a non-empty goal", async () => {
    const res = await request(app)
      .post("/api/kernel/run")
      .send({ goal: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/goal/i);
    expect(mocks.executeKernelPipeline).not.toHaveBeenCalled();
  });

  it("normalizes run input before creating the kernel envelope", async () => {
    const res = await request(app)
      .post("/api/kernel/run")
      .send({
        goal: "  Align dashboard  ",
        taskType: "  governance  ",
        riskLevel: "critical",
        priority: "normal",
        threadId: "  thread-1  ",
        userId: "  operator  ",
        capabilities: ["mcp", "", 42, "kernel"],
        approvalRequired: "yes",
        terminationCondition: "  guardrail  ",
      });

    expect(res.status).toBe(200);
    const [envelope, options] = mocks.executeKernelPipeline.mock.calls[0];
    expect(envelope.goal).toBe("Align dashboard");
    expect(envelope.taskType).toBe("governance");
    expect(envelope.riskLevel).toBe("low");
    expect(envelope.priority).toBe("medium");
    expect(envelope.threadId).toBe("thread-1");
    expect(envelope.userContext.userId).toBe("operator");
    expect(envelope.stateRefs.knowledgeScope).toEqual(["mcp", "kernel"]);
    expect(envelope.constraints.approvalRequired).toBe(false);
    expect(options).toEqual({ terminationCondition: "guardrail" });
  });

  it("preserves valid risk and boolean approval values", async () => {
    await request(app)
      .post("/api/kernel/run")
      .send({
        goal: "Run high-risk action",
        riskLevel: "high",
        priority: "critical",
        approvalRequired: true,
      });

    const [envelope] = mocks.executeKernelPipeline.mock.calls[0];
    expect(envelope.riskLevel).toBe("high");
    expect(envelope.priority).toBe("critical");
    expect(envelope.constraints.approvalRequired).toBe(true);
  });

  it("lists recent runs from the ledger", async () => {
    mocks.getAll.mockReturnValue([
      {
        runId: "run-1",
        goal: "A very important governance run",
        status: "success",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        entries: [{ module: "conductor" }],
      },
    ]);

    const res = await request(app).get("/api/kernel/runs");

    expect(res.status).toBe(200);
    expect(res.body.runs).toEqual([
      expect.objectContaining({
        runId: "run-1",
        moduleCount: 1,
      }),
    ]);
  });
});
