import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  getRecentSteps: vi.fn(),
  getSession: vi.fn(),
  startSession: vi.fn(),
  completeSession: vi.fn(),
  failSession: vi.fn(),
  addStep: vi.fn(),
  updateStep: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@packages/core-logic/copilotOrchestratorBridge.js", () => ({
  copilotOrchestratorBridge: {
    getStats: routeMocks.getStats,
    getRecentSteps: routeMocks.getRecentSteps,
    getSession: routeMocks.getSession,
    startSession: routeMocks.startSession,
    completeSession: routeMocks.completeSession,
    failSession: routeMocks.failSession,
    addStep: routeMocks.addStep,
    updateStep: routeMocks.updateStep,
  },
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: routeMocks.logInfo,
  logError: routeMocks.logError,
}));

import { createCopilotOrchestratorRoutes } from "@apps/mcp-core/server/routes/copilotOrchestratorRoute.js";

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/copilot-orchestrator", createCopilotOrchestratorRoutes());
  return app;
}

describe("Copilot Orchestrator route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getStats.mockReturnValue({
      totalSessions: 0,
      activeSessions: 0,
      totalSteps: 0,
      successSteps: 0,
      errorSteps: 0,
      recentSessions: [],
    });
    routeMocks.getRecentSteps.mockReturnValue([]);
    routeMocks.startSession.mockReturnValue({ id: "session-1", startedAt: 1, steps: [], status: "active" });
    routeMocks.completeSession.mockReturnValue({ id: "session-1", startedAt: 1, steps: [], status: "completed" });
    routeMocks.failSession.mockReturnValue({ id: "session-1", startedAt: 1, steps: [], status: "failed" });
    routeMocks.addStep.mockReturnValue({ id: "step-1", step: "Plan", status: "running", startedAt: 1 });
    routeMocks.updateStep.mockReturnValue({ id: "step-1", step: "Plan", status: "success", startedAt: 1, completedAt: 2 });
  });

  it("clamps recent step limits to the supported range", async () => {
    const app = createApp();

    const high = await request(app).get("/api/v1/copilot-orchestrator/steps?limit=9999");
    const low = await request(app).get("/api/v1/copilot-orchestrator/steps?limit=-3");

    expect(high.status).toBe(200);
    expect(low.status).toBe(200);
    expect(routeMocks.getRecentSteps).toHaveBeenNthCalledWith(1, 200);
    expect(routeMocks.getRecentSteps).toHaveBeenNthCalledWith(2, 1);
  });

  it("logs valid orchestration steps with normalized optional fields", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/copilot-orchestrator/log")
      .send({
        sessionId: " session-1 ",
        step: " Plan next work ",
        status: "success",
        detail: " done ",
        delegateTo: " brunella-implementer ",
        confidence: 0.82,
        model: " gpt-5.5 ",
      });

    expect(res.status).toBe(201);
    expect(routeMocks.addStep).toHaveBeenCalledWith({
      sessionId: "session-1",
      step: "Plan next work",
      status: "success",
      detail: "done",
      delegateTo: "brunella-implementer",
      confidence: 0.82,
      model: "gpt-5.5",
    });
  });

  it("rejects invalid step statuses and confidence scores", async () => {
    const app = createApp();

    const invalidStatus = await request(app)
      .post("/api/v1/copilot-orchestrator/log")
      .send({ step: "Plan", status: "finished" });
    const invalidConfidence = await request(app)
      .post("/api/v1/copilot-orchestrator/log")
      .send({ step: "Plan", confidence: 1.5 });

    expect(invalidStatus.status).toBe(400);
    expect(invalidConfidence.status).toBe(400);
    expect(routeMocks.addStep).not.toHaveBeenCalled();
  });

  it("rejects invalid step update statuses before mutating the bridge", async () => {
    const app = createApp();

    const res = await request(app)
      .patch("/api/v1/copilot-orchestrator/steps/session-1/step-1")
      .send({ status: "done" });

    expect(res.status).toBe(400);
    expect(routeMocks.updateStep).not.toHaveBeenCalled();
  });

  it("updates steps with typed status and completion timestamp for terminal states", async () => {
    const app = createApp();

    const res = await request(app)
      .patch("/api/v1/copilot-orchestrator/steps/session-1/step-1")
      .send({ status: "success", detail: " completed ", model: " gpt-5.5 " });

    expect(res.status).toBe(200);
    expect(routeMocks.updateStep).toHaveBeenCalledWith(
      "session-1",
      "step-1",
      expect.objectContaining({
        status: "success",
        detail: "completed",
        model: "gpt-5.5",
        completedAt: expect.any(Number),
      }),
    );
  });
});
