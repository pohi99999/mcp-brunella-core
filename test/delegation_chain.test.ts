import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentManager } from "../src/agents/AgentManager.js";
import { OrchestratorAgent } from "../src/agents/OrchestratorAgent.js";
import * as llmClient from "../src/core/llm_client.js";

// Mock all agent dependencies before import
vi.mock("../src/core/llm_client.js");
vi.mock("../src/utils/logger.js", () => {
  return {
    Logger: class {
      info = vi.fn();
      error = vi.fn();
      warn = vi.fn();
    },
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn(),
  };
});
vi.mock("../src/utils/tasksDb.js", () => ({
  saveTask: vi.fn(async () => Math.floor(Math.random() * 1000)),
  updateTaskStatus: vi.fn(async () => {}),
}));

describe("Delegation Chain Integration", () => {
  let orchestrator: OrchestratorAgent;

  beforeEach(async () => {
    vi.clearAllMocks();
    orchestrator = new OrchestratorAgent();

    // Mock Orchestrator's LLM response to return a valid JSON plan
    (llmClient.chatWithOllama as any).mockResolvedValue(
      JSON.stringify([
        {
          agent: "Developer",
          description: "Write a unit test for delegation",
          context: { target: "test" },
        },
      ]),
    );

    // Manually register Orchestrator
    agentManager.registerAgent(orchestrator as any);
  });

  it("Orchestrator should successfully generate a multi-step plan", async () => {
    const task = "Fix the build and report status";

    // Mock a 2-step plan
    (llmClient.chatWithOllama as any).mockResolvedValue(
      JSON.stringify([
        { agent: "Developer", description: "Fix build errors" },
        { agent: "Evaluator", description: "Verify build status" },
      ]),
    );

    const result = await orchestrator.execute(task);

    expect(result.status).toBe("success");
    if (result.taskIds) {
      expect(result.taskIds).toHaveLength(2);
    } else if (result.data && result.data.stepsCount) {
      expect(result.data.stepsCount).toBe(2);
    } else {
      throw new Error("Neither taskIds nor chain stepsCount found in result");
    }
  });

  it("AgentManager should route tasks through the delegation chain", async () => {
    const devExecute = vi
      .fn()
      .mockResolvedValue({ status: "success", message: "Build fixed" });

    agentManager.registerAgent({
      name: "Developer",
      execute: devExecute,
    } as any);

    // 1. Trigger delegation through manager
    // This will call Orchestrator.execute, which returns taskIds
    const plan = await agentManager.createPlan("I need a developer help");

    expect(plan.taskIds.length).toBeGreaterThan(0);

    // 2. Execute the queued tasks
    const resultText = await agentManager.executePlan(plan, () => {});

    expect(devExecute).toHaveBeenCalled();
    expect(resultText).toContain("Build fixed");
  });

  it("Should handle failed steps in the delegation chain gracefully", async () => {
    const failExecute = vi
      .fn()
      .mockResolvedValue({ status: "error", message: "Operation failed" });

    agentManager.registerAgent({
      name: "Developer",
      execute: failExecute,
    } as any);

    const plan = await agentManager.createPlan("Do something that fails");
    const resultText = await agentManager.executePlan(plan, () => {});

    expect(resultText).toContain("Operation failed");
  });
});
