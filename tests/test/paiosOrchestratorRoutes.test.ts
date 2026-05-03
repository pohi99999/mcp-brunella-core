import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  broadcastDebug: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("@packages/core-logic/universalOrchestratorService.js", () => ({
  getUniversalOrchestratorService: () => ({
    process: mocks.process,
  }),
}));

vi.mock("@packages/agents/SocketService.js", () => ({
  socketService: {
    broadcastDebug: mocks.broadcastDebug,
    emit: mocks.emit,
  },
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

async function buildApp() {
  const { default: router } = await import("@apps/mcp-core/server/routes/paiosOrchestrator.js");
  const app = express();
  app.use(express.json());
  app.use("/api/paios", router);
  return app;
}

describe("PAIOS orchestrator route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.process.mockResolvedValue({
      reply: "Nova kész.",
      actionsTriggered: [],
      provider: "github",
      model: "gpt-4.1",
      role: "orchestrator",
      thinkingMs: 25,
      sessionId: "session-1",
      suggestions: ["Folytassuk"],
      missionTimeline: [],
    });
  });

  it("rejects missing or blank messages before calling the orchestrator", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/paios/chat")
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("normalizes chat input for the universal orchestrator", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/paios/chat")
      .send({
        message: "  Irányítsd a rendszert  ",
        model: "gpt-4.1",
        provider: "github",
        sessionId: "  nova-session  ",
        conversationHistory: [
          { role: "user", content: "  előzmény  " },
          { role: "assistant", content: "" },
          { role: "system", content: "drop" },
        ],
      });

    expect(res.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith({
      message: "Irányítsd a rendszert",
      provider: "github",
      model: "gpt-4.1",
      conversationHistory: [{ role: "user", content: "előzmény" }],
      sessionId: "nova-session",
    });
    expect(res.body.reply).toBe("Nova kész.");
  });

  it("uses model-as-provider compatibility and emits created tasks", async () => {
    mocks.process.mockResolvedValue({
      reply: "Feladat indult.",
      actionsTriggered: [{ agent: "Orchestrator", task: "Run", taskId: 42, status: "started" }],
      provider: "ollama",
      role: "orchestrator",
      thinkingMs: 10,
      sessionId: "session-2",
      missionTimeline: [],
    });

    const app = await buildApp();
    const res = await request(app)
      .post("/api/paios/chat")
      .send({ message: "Futtasd", model: "ollama" });

    expect(res.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.objectContaining({
      provider: "ollama",
      model: undefined,
    }));
    expect(mocks.emit).toHaveBeenCalledWith("paios:tasks_created", expect.objectContaining({
      taskIds: [42],
    }));
  });
});
