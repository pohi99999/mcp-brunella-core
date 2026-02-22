// FILE: test/phase2_integration.test.ts
import { describe, it, expect } from "vitest";
import { PropertyAnalystAgent } from "../src/agents/PropertyAnalystAgent.js";
import { LogisticsDispatcher } from "../src/agents/LogisticsDispatcher.js";

describe("Phase 2 Integration Tests (Python Workers)", () => {
  
  it("PropertyAnalystAgent should call CMA worker", async () => {
    const agent = new PropertyAnalystAgent();
    const result = await agent.execute("CMA piacelemzés: Budapest, 50m2 mock");
    
    // We need at least one analyzed asset for CMA to work in the current impl
    // Let's mock an analyzed asset first
    (agent as any)._analyzed.push({
      id: "test-123",
      hrsz: "12345/A/1",
      address: { city: "Budapest" },
      area_sqm: 50,
      property_type: "apartment"
    });

    const cmaResult = await agent.execute("értékeld cma mock");
    
    expect(cmaResult.status).toBe("success");
    expect(cmaResult.message).toContain("CMA Piacelemzés kész");
    expect(cmaResult.data).toHaveProperty("investment_score");
    expect(cmaResult.data.estimate.value_eur).toBeGreaterThan(0);
    }, 30000);

  it("LogisticsDispatcher should call Supply Matcher", async () => {
    const agent = new LogisticsDispatcher();
    const result = await agent.execute("match mock", { region: "Budapest", mock: true });
    
    expect(result.status).toBe("success");
    expect(result.message).toContain("Párosítás kész");
    expect(result.data).toHaveProperty("matches");
    expect(Array.isArray(result.data.matches)).toBe(true);
    }, 30000);

});
