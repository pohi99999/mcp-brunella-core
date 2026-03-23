import { beforeEach, describe, expect, it } from "vitest";
import { getGlobalDb } from "../../src/utils/globalDb.js";
import { initMemoryDb, purgeExpired, queryMemory, saveMemory } from "../../src/core/structuredMemory.js";

const TEST_AGENT = "StructuredMemoryTestAgent";

function cleanup(): void {
  const db = getGlobalDb();
  db.prepare("DELETE FROM agent_memories WHERE agent_name = ?").run(TEST_AGENT);
}

describe("structuredMemory", () => {
  beforeEach(() => {
    initMemoryDb();
    cleanup();
  });

  it("saves and queries a memory round-trip", () => {
    saveMemory({
      agentName: TEST_AGENT,
      task: "Írj egy összegzést a rendszer állapotáról",
      result: { success: true, message: "Mentett eredmény" },
      confidence: 0.91,
      ttlDays: 30,
    });

    const matches = queryMemory({
      agentName: TEST_AGENT,
      task: "rendszer állapot összegzés",
      limit: 3,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBeCloseTo(0.91, 5);
    expect((matches[0]?.result as { message: string }).message).toBe("Mentett eredmény");
  });

  it("handles duplicate task hashes via upsert", () => {
    saveMemory({
      agentName: TEST_AGENT,
      task: "Készíts riportot a pipeline-ról",
      result: { success: true, message: "Első" },
      confidence: 0.72,
    });

    saveMemory({
      agentName: TEST_AGENT,
      task: "Készíts riportot a pipeline-ról",
      result: { success: true, message: "Második" },
      confidence: 0.88,
    });

    const matches = queryMemory({
      agentName: TEST_AGENT,
      task: "Készíts riportot a pipeline-ról",
      limit: 5,
    });

    expect(matches).toHaveLength(1);
    expect((matches[0]?.result as { message: string }).message).toBe("Második");
    expect(matches[0]?.confidence).toBeCloseTo(0.88, 5);
  });

  it("purges low-confidence entries via threshold", () => {
    saveMemory({
      agentName: TEST_AGENT,
      task: "Alacsony confidence feladat",
      result: { success: true, message: "Gyenge" },
      confidence: 0.21,
    });

    const removed = purgeExpired(0.5);
    const matches = queryMemory({
      agentName: TEST_AGENT,
      task: "Alacsony confidence feladat",
      limit: 5,
      includeExpired: true,
    });

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(matches).toHaveLength(0);
  });
});
