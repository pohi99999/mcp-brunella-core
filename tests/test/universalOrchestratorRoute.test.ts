import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createUniversalOrchestratorRouter } from "@apps/mcp-core/server/routes/universalOrchestrator.js";

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  getAgent: vi.fn(),
}));

vi.mock("@packages/core-logic/universalOrchestratorService.js", () => ({
  getUniversalOrchestratorService: () => ({
    process: mocks.process,
  }),
}));

vi.mock("@packages/agents/AgentManager.js", () => ({
  agentManager: {
    getAgent: mocks.getAgent,
  },
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe("Universal orchestrator route", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.process.mockResolvedValue({
      reply: "Universal response",
      actionsTriggered: [],
      provider: "github",
      role: "orchestrator",
      thinkingMs: 12,
      sessionId: "route-session",
      missionTimeline: [],
    });
    mocks.getAgent.mockReturnValue({ getCurrentState: () => "IDLE" });

    app = express();
    app.use(express.json());
    app.use("/api/orchestrator", createUniversalOrchestratorRouter());
  });

  it("rejects blank messages", async () => {
    const res = await request(app)
      .post("/api/orchestrator/universal")
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("normalizes provider, model, session, user, and conversation history", async () => {
    const res = await request(app)
      .post("/api/orchestrator/universal")
      .send({
        message: "  Nézd meg a readiness állapotot  ",
        provider: "  github  ",
        model: "  gpt-4.1  ",
        sessionId: "  session-a  ",
        userId: "  user-a  ",
        conversationHistory: [
          { role: "assistant", content: "  előző válasz  " },
          { role: "tool", content: "drop" },
          { role: "user", content: "" },
        ],
      });

    expect(res.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith({
      message: "Nézd meg a readiness állapotot",
      provider: "github",
      model: "gpt-4.1",
      conversationHistory: [{ role: "assistant", content: "előző válasz" }],
      sessionId: "session-a",
      userId: "user-a",
    });
    expect(res.body.reply).toBe("Universal response");
  });

  it("uses the sanitized session id in error responses", async () => {
    mocks.process.mockRejectedValue(new Error("model unavailable"));

    const res = await request(app)
      .post("/api/orchestrator/universal")
      .send({ message: "Futtasd", sessionId: "  session-error  " });

    expect(res.status).toBe(500);
    expect(res.body.sessionId).toBe("session-error");
    expect(res.body.missionTimeline[0].status).toBe("blocked");
  });

  it("reports orchestrator state from AgentManager", async () => {
    const res = await request(app).get("/api/orchestrator/state");

    expect(res.status).toBe(200);
    expect(res.body.state).toBe("IDLE");
    expect(res.body.timestamp).toBeDefined();
  });
});
