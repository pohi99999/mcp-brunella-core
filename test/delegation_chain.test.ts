import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentManager } from "../src/agents/AgentManager.js";
import { OrchestratorAgent } from "../src/agents/OrchestratorAgent.js";
import * as bifrostGateway from '../src/core/bifrost_gateway.js';

// Mock the gateway
vi.mock('../src/core/bifrost_gateway.js', () => {
    const mockGenerate = vi.fn();
    return {
        getBifrostGateway: () => ({
            generate: mockGenerate
        })
    };
});
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
  let mockGenerate: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    orchestrator = new OrchestratorAgent();
    mockGenerate = bifrostGateway.getBifrostGateway().generate;

    // Mock Orchestrator's LLM response
    mockGenerate.mockResolvedValue({
        success: true,
        content: "Feladatok delegálva",
        toolCalls: [{
            id: "call_1",
            function: {
                name: "delegate_task",
                arguments: JSON.stringify({ agent_name: "Developer", instruction: "Write a unit test for delegation" })
            }
        }]
    });

    // Manually register Orchestrator
    agentManager.registerAgent(orchestrator as any);
  });

  it("Orchestrator should successfully generate a multi-step plan", async () => {
    const task = "Fix the build and report status";

    // Mock a 2-step plan via tool calls
    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "",
        toolCalls: [
            { id: "call_1", function: { name: "delegate_task", arguments: JSON.stringify({ agent_name: "Developer", instruction: "Fix build errors" }) } },
            { id: "call_2", function: { name: "delegate_task", arguments: JSON.stringify({ agent_name: "Evaluator", instruction: "Verify build status" }) } }
        ]
    });
    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "2 feladat kiosztva.",
        toolCalls: undefined
    });

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

    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "",
        toolCalls: [
            { id: "call_1", function: { name: "delegate_task", arguments: JSON.stringify({ agent_name: "Developer", instruction: "help" }) } }
        ]
    });
    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "Delegálva.",
        toolCalls: undefined
    });

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

    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "",
        toolCalls: [
            { id: "call_1", function: { name: "delegate_task", arguments: JSON.stringify({ agent_name: "Developer", instruction: "fail" }) } }
        ]
    });
    mockGenerate.mockResolvedValueOnce({
        success: true,
        content: "Delegálva.",
        toolCalls: undefined
    });

    const plan = await agentManager.createPlan("Do something that fails");
    const resultText = await agentManager.executePlan(plan, () => {});

    expect(resultText).toContain("Operation failed");
  });
});
