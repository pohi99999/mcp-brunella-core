import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createWorkflowRoutes } from "@apps/mcp-core/server/routes/workflow.js";

const mocks = vi.hoisted(() => ({
  listWorkflowExecutions: vi.fn(),
  executeWorkflow: vi.fn(),
  decomposeToDAGAsync: vi.fn(),
}));

vi.mock("@packages/agents/AgentManager.js", () => ({
  agentManager: {
    listWorkflowExecutions: mocks.listWorkflowExecutions,
    executeWorkflow: mocks.executeWorkflow,
  },
}));

vi.mock("@packages/agents/taskDecomposerCore.js", () => ({
  decomposeToDAGAsync: mocks.decomposeToDAGAsync,
}));

describe("Workflow routes", () => {
  let app: express.Express;

  const workflow = {
    id: "wf-test",
    name: "Test workflow",
    nodes: [
      {
        id: "node-1",
        label: "Run test agent",
        type: "agent",
        agentName: "TestAgent",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkflowExecutions.mockReturnValue([]);
    mocks.executeWorkflow.mockResolvedValue({
      workflowId: "wf-test",
      status: "success",
      nodeResults: {},
      totalTokens: 0,
      totalCostUSD: 0,
      durationMs: 12,
      warnings: [],
      completedNodeIds: ["node-1"],
    });
    mocks.decomposeToDAGAsync.mockResolvedValue(workflow);

    app = express();
    app.use(express.json());
    app.use("/api/workflow", createWorkflowRoutes());
  });

  it("returns a truthful workflow catalog with recent execution summaries", async () => {
    mocks.listWorkflowExecutions.mockReturnValue([{ id: "recent", name: "Recent", status: "success" }]);

    const res = await request(app).get("/api/workflow/list");

    expect(res.status).toBe(200);
    expect(res.body.catalog).toEqual([
      expect.objectContaining({
        id: "auto-dag",
        source: "taskDecomposerCore",
      }),
    ]);
    expect(res.body.recent).toEqual([{ id: "recent", name: "Recent", status: "success" }]);
  });

  it("decomposes a task and executes the generated workflow", async () => {
    const res = await request(app)
      .post("/api/workflow/run")
      .send({ task: "Build the readiness dashboard", defaultAgent: "Planner", initialContext: { priority: "high" } });

    expect(res.status).toBe(200);
    expect(mocks.decomposeToDAGAsync).toHaveBeenCalledWith("Build the readiness dashboard", { defaultAgent: "Planner" });
    expect(mocks.executeWorkflow).toHaveBeenCalledWith(workflow, { priority: "high" });
    expect(res.body.result.status).toBe("success");
  });

  it("executes a provided DAG workflow without decomposing a task", async () => {
    const res = await request(app)
      .post("/api/workflow/run")
      .send({ workflow });

    expect(res.status).toBe(200);
    expect(mocks.decomposeToDAGAsync).not.toHaveBeenCalled();
    expect(mocks.executeWorkflow).toHaveBeenCalledWith(workflow, undefined);
  });

  it("rejects invalid workflow and context payloads", async () => {
    const invalidWorkflow = await request(app)
      .post("/api/workflow/run")
      .send({ workflow: { id: "bad", name: "Bad", nodes: [] } });
    expect(invalidWorkflow.status).toBe(400);
    expect(invalidWorkflow.body.error).toMatch(/workflow/i);

    const invalidContext = await request(app)
      .post("/api/workflow/run")
      .send({ task: "Build", initialContext: ["bad"] });
    expect(invalidContext.status).toBe(400);
    expect(invalidContext.body.error).toMatch(/initialContext/i);
  });
});
