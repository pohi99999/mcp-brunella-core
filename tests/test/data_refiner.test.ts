import { describe, it, expect, vi, beforeEach } from "vitest";
import DataScientistAgent from "@packages/agents/DataScientistAgent.js";

// Mock callRefiner to avoid Python subprocess dependency in tests
const mockRefineResult = {
  clean_content: "cleaned test data",
  metadata: {
    timestamps: new Date().toISOString(),
    detected_topics: ["ai-agent", "mcp"],
    is_actionable: true,
  },
  source: "test",
};

describe("DataScientist Agent", () => {
  let agent: DataScientistAgent;

  beforeEach(() => {
    agent = new DataScientistAgent();
    // Mock private callRefiner to return deterministic results
    vi.spyOn(agent as never, "callRefiner" as never).mockResolvedValue(
      mockRefineResult as never,
    );
  });

  it('should analyze data when task contains "analyze"', async () => {
    const result = await agent.execute("analyze this data", {});

    expect(result.status).toBe("success");
    expect(result.data).toBeDefined();
    expect(result.data.clean_content).toBe("cleaned test data");
    expect(result.data.topics).toContain("ai-agent");
  });

  it("should handle any task without error (defaults to analysis)", async () => {
    const result = await agent.execute("do something else", {});

    expect(result.status).toBe("success");
    expect(result.data).toBeDefined();
  });

  it('should accept Hungarian "elemz" keyword', async () => {
    const result = await agent.execute("elemz az adatokat", {});

    expect(result.status).toBe("success");
    expect(result.data.clean_content).toBe("cleaned test data");
  });

  it('should route "clean" tasks to refineData', async () => {
    const result = await agent.execute("clean this text data");

    expect(result.status).toBe("success");
    expect(result.data.clean_content).toBe("cleaned test data");
  });

  it('should route "extract" tasks to entity extraction', async () => {
    const result = await agent.execute("extract entities from this");

    expect(result.status).toBe("success");
    expect(result.data.detected_topics).toContain("mcp");
    expect(result.data.is_actionable).toBe(true);
  });

  it("should return REJECTED when refiner returns null", async () => {
    vi.spyOn(agent as never, "callRefiner" as never).mockResolvedValue(
      null as never,
    );
    const result = await agent.execute("analyze empty data");

    expect(result.status).toBe("success");
    expect(result.data.result).toBe("REJECTED");
  });

  it("should use swarm context artifacts", async () => {
    const swarmContext = {
      swarm: {
        sessionId: "test-session",
        history: [] as {
          role: "user" | "assistant" | "system";
          content: string;
          agent?: string;
        }[],
        artifacts: { searchResults: ["item1", "item2"] } as Record<
          string,
          unknown
        >,
      },
    };

    const result = await agent.execute("analyze this", swarmContext);

    expect(result.status).toBe("success");
    // Verify swarm artifacts were written back
    expect(swarmContext.swarm.artifacts["analysisResult"]).toBeDefined();
    expect(swarmContext.swarm.history.length).toBeGreaterThan(0);
  });

  it("should have correct capabilities", () => {
    expect(agent.capabilities).toContain("data_analysis");
    expect(agent.capabilities).toContain("data_refine");
    expect(agent.capabilities).toContain("entity_extraction");
    expect(agent.capabilities).toContain("python_execution");
  });

  it("should return error on unexpected exception", async () => {
    vi.spyOn(agent as never, "callRefiner" as never).mockRejectedValue(
      new Error("test crash") as never,
    );
    const result = await agent.execute("analyze crash test");

    expect(result.status).toBe("error");
    expect(result.error).toContain("test crash");
  });
});
