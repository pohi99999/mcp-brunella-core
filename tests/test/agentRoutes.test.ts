import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  delegate: vi.fn(),
  queueTask: vi.fn(),
  listAgentDefinitions: vi.fn(),
  listAgentStatuses: vi.fn(),
  getAgentDiagnostics: vi.fn(),
  getRegistry: vi.fn(),
  getEdgeStatus: vi.fn(),
  createAgent: vi.fn(),
  governanceSnapshot: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@packages/agents/AgentManager.js", () => ({
  agentManager: {
    delegate: routeMocks.delegate,
    queueTask: routeMocks.queueTask,
    listAgentDefinitions: routeMocks.listAgentDefinitions,
    listAgentStatuses: routeMocks.listAgentStatuses,
    getAgentDiagnostics: routeMocks.getAgentDiagnostics,
    getRegistry: routeMocks.getRegistry,
    getEdgeStatus: routeMocks.getEdgeStatus,
  },
}));

vi.mock("@packages/agents/AgentArchitect.js", () => ({
  AgentArchitect: {
    createAgent: routeMocks.createAgent,
  },
}));

vi.mock("@apps/mcp-core/server/agentRegistryGovernance.js", () => ({
  buildAgentRegistryGovernanceSnapshot: routeMocks.governanceSnapshot,
}));

vi.mock("@packages/utils/logger.js", () => ({
  logEmitter: {
    on: vi.fn(),
    off: vi.fn(),
  },
  logError: routeMocks.logError,
}));

import { createAgentRoutes } from "@apps/mcp-core/server/routes/agents.js";

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/agents", createAgentRoutes());
  return app;
}

describe("Agent routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.listAgentDefinitions.mockReturnValue([
      { name: "Orchestrator", description: "Main orchestrator", role: "orchestrator" },
      { name: "Developer", description: "Developer", role: "coder" },
    ]);
    routeMocks.listAgentStatuses.mockReturnValue([]);
    routeMocks.getAgentDiagnostics.mockReturnValue({ agents: [] });
    routeMocks.getRegistry.mockReturnValue({ agents: [] });
    routeMocks.getEdgeStatus.mockReturnValue({ enabled: false, healthy: false, tunnelConnected: false });
    routeMocks.governanceSnapshot.mockResolvedValue({ summary: { total: 0 } });
    routeMocks.queueTask.mockResolvedValue(42);
    routeMocks.delegate.mockResolvedValue({ status: "success", message: "Rendben.", taskId: 42, steps: ["done"] });
  });

  it("normalizes orchestrator delegate responses without loose result casts", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/agents/orchestrate")
      .send({ task: "  Ellenorizd a rendszert  ", context: { source: "test" } });

    expect(res.status).toBe(200);
    expect(routeMocks.delegate).toHaveBeenCalledWith("Orchestrator", "Ellenorizd a rendszert", {
      source: "test",
      chatMode: "orchestrator",
    });
    expect(res.body).toEqual({
      success: true,
      message: "Rendben.",
      taskId: 42,
      steps: ["done"],
      executedBy: "Orchestrator",
    });
  });

  it("rejects missing or blank orchestration tasks", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/agents/orchestrate")
      .send({ task: "   " });

    expect(res.status).toBe(400);
    expect(routeMocks.delegate).not.toHaveBeenCalled();
  });

  it("logs background execution failures through the repository logger", async () => {
    routeMocks.delegate.mockRejectedValueOnce(new Error("agent failed"));
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/agents/developer/execute")
      .send({ task: "Run diagnostics", context: "ignored" });

    expect(res.status).toBe(200);
    expect(routeMocks.queueTask).toHaveBeenCalledWith("Run diagnostics", "Developer", undefined);
    expect(routeMocks.delegate).toHaveBeenCalledWith("Developer", "Run diagnostics", { taskId: 42 });

    await vi.waitFor(() => {
      expect(routeMocks.logError).toHaveBeenCalledWith(
        "AgentRoutes",
        "Execution error for task 42: agent failed",
      );
    });
  });
});
