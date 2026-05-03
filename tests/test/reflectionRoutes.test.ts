import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createReflectionRouter } from "@apps/mcp-core/server/routes/reflection.js";

const mocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  getSelfModelState: vi.fn(),
  detectPainPoints: vi.fn(),
  getMetaInsights: vi.fn(),
  getReflectionContext: vi.fn(),
  reflect: vi.fn(),
  runNightlyCycle: vi.fn(),
}));

vi.mock("@packages/core-logic/reflectionEngine.js", () => ({
  ReflectionEngine: {
    getInstance: () => mocks,
  },
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
}));

describe("Reflection routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStats.mockReturnValue({ totalReflections: 1 });
    mocks.getSelfModelState.mockReturnValue({});
    mocks.detectPainPoints.mockReturnValue([]);
    mocks.getMetaInsights.mockReturnValue([]);
    mocks.getReflectionContext.mockReturnValue("context");
    mocks.reflect.mockResolvedValue({ qualityScore: 0.9, lessons: [], improvements: [], selfModelUpdated: true, metaInsights: [] });
    mocks.runNightlyCycle.mockResolvedValue({ ok: true });

    app = express();
    app.use(express.json());
    app.use("/api/reflection", createReflectionRouter());
  });

  it("returns overview with memory scopes", async () => {
    const res = await request(app).get("/api/reflection/overview");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.overview.selfModel.memoryScopes.global).toBeDefined();
  });

  it("validates and normalizes manual reflection outcomes", async () => {
    const invalid = await request(app)
      .post("/api/reflection/reflect")
      .send({ agent: "Agent", task: "Task", result: "done" });
    expect(invalid.status).toBe(400);
    expect(mocks.reflect).not.toHaveBeenCalled();

    const res = await request(app)
      .post("/api/reflection/reflect")
      .send({
        taskId: " t1 ",
        agent: " Agent ",
        task: " Task ",
        result: "success",
        output: " Done ",
        durationMs: 12.7,
        errorMessage: " ",
        metadata: ["bad"],
      });

    expect(res.status).toBe(200);
    expect(mocks.reflect).toHaveBeenCalledWith({
      taskId: "t1",
      agent: "Agent",
      task: "Task",
      result: "success",
      output: "Done",
      durationMs: 13,
      errorMessage: undefined,
      metadata: undefined,
    });
  });
});
