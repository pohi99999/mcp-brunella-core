import { describe, expect, it } from "vitest";
import { executeDAG, topologicalSort, type DAGContext, type DAGNode, type DAGWorkflow } from "../../src/core/dagEngine.js";

function createExecutor(log: string[]) {
  return {
    async executeAgent(node: DAGNode, _context: DAGContext): Promise<unknown> {
      log.push(node.id);
      if (node.id === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return { ok: true, nodeId: node.id };
    },
  };
}

describe("dagEngine", () => {
  it("sorts a linear DAG", () => {
    const sorted = topologicalSort([
      { id: "c", label: "C", type: "agent", dependsOn: ["b"] },
      { id: "a", label: "A", type: "agent" },
      { id: "b", label: "B", type: "agent", dependsOn: ["a"] },
    ]);

    expect(sorted.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("executes a diamond DAG and records all node results", async () => {
    const log: string[] = [];
    const workflow: DAGWorkflow = {
      id: "diamond",
      name: "Diamond",
      nodes: [
        { id: "a", label: "A", type: "agent" },
        { id: "b", label: "B", type: "agent", dependsOn: ["a"] },
        { id: "c", label: "C", type: "agent", dependsOn: ["a"] },
        { id: "d", label: "D", type: "agent", dependsOn: ["b", "c"] },
      ],
    };

    const result = await executeDAG(workflow, { values: {} }, createExecutor(log));

    expect(result.status).toBe("success");
    expect(result.completedNodeIds).toEqual(["a", "b", "c", "d"]);
    expect(result.nodeResults.d?.status).toBe("success");
    expect(log[0]).toBe("a");
    expect(log.at(-1)).toBe("d");
  });

  it("honors workflow maxConcurrency over the global orchestration limit", async () => {
    const started: string[] = [];
    let active = 0;
    let peak = 0;

    const workflow: DAGWorkflow = {
      id: "bounded",
      name: "Bounded",
      maxConcurrency: 2,
      nodes: [
        { id: "a", label: "A", type: "agent" },
        { id: "b", label: "B", type: "agent" },
        { id: "c", label: "C", type: "agent" },
        { id: "d", label: "D", type: "agent" },
      ],
    };

    const result = await executeDAG(workflow, { values: {} }, {
      async executeAgent(node: DAGNode): Promise<unknown> {
        started.push(node.id);
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return { ok: true, nodeId: node.id };
      },
    });

    expect(result.status).toBe("success");
    expect(started).toHaveLength(4);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("throws on cycle detection", () => {
    expect(() => topologicalSort([
      { id: "a", label: "A", type: "agent", dependsOn: ["b"] },
      { id: "b", label: "B", type: "agent", dependsOn: ["a"] },
    ])).toThrow(/Cycle detected/);
  });

  it("supports conditional branch selection", async () => {
    const workflow: DAGWorkflow = {
      id: "conditional",
      name: "Conditional",
      nodes: [
        {
          id: "check",
          label: "Check",
          type: "condition",
          predicate: async () => true,
        },
        {
          id: "true-node",
          label: "True branch",
          type: "agent",
          dependsOn: ["check"],
          conditionSourceId: "check",
          expectedCondition: true,
        },
        {
          id: "false-node",
          label: "False branch",
          type: "agent",
          dependsOn: ["check"],
          conditionSourceId: "check",
          expectedCondition: false,
        },
      ],
    };

    const result = await executeDAG(workflow, { values: {} }, createExecutor([]));
    expect(result.nodeResults["true-node"]?.status).toBe("success");
    expect(result.nodeResults["false-node"]?.status).toBe("skipped");
  });

  it("returns timeout status for timed out nodes", async () => {
    const workflow: DAGWorkflow = {
      id: "timeout",
      name: "Timeout",
      nodes: [
        { id: "slow", label: "Slow", type: "agent", timeoutMs: 5 },
      ],
    };

    const result = await executeDAG(workflow, { values: {} }, createExecutor([]));
    expect(result.status).toBe("timeout");
    expect(result.nodeResults.slow?.status).toBe("timeout");
  });

  it("stops when budget is exceeded", async () => {
    const workflow: DAGWorkflow = {
      id: "budget",
      name: "Budget",
      budget: { maxTokens: 1 },
      nodes: [
        { id: "a", label: "A", type: "agent" },
        { id: "b", label: "B", type: "agent", dependsOn: ["a"] },
      ],
    };

    const result = await executeDAG(workflow, { values: {} }, {
      async executeAgent(node: DAGNode): Promise<unknown> {
        return { metadata: { tokensUsed: node.id === "a" ? 2 : 1 } };
      },
    });

    expect(result.status).toBe("budget_exceeded");
    expect(result.completedNodeIds).toContain("a");
  });
});
