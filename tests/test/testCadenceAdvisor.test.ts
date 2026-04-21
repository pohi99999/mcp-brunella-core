import { describe, expect, it } from "vitest";

import {
  buildDevExPlannerSnapshot,
} from "../src/tools/missionPlanner.js";
import { buildTestCadenceAdvice, renderTestPlanMarkdown } from "../src/tools/testCadenceAdvisor.js";

describe("testCadenceAdvisor", () => {
  it("uses the dashboard full cadence with UI validation commands", () => {
    const advice = buildTestCadenceAdvice({ surface: "dashboard" });

    expect(advice.defaultTier).toBe("full");
    expect(advice.selectedTier).toBe("full");
    expect(advice.status).toBe("healthy");
    expect(advice.recommendedCommands).toEqual([
      "npm run build",
      "npm run build:ui",
      "npm run test:ui",
      "npm run test:fast",
      "npm test",
    ]);
  });

  it("warns when minimal cadence is used for API work", () => {
    const advice = buildTestCadenceAdvice({ surface: "api", tier: "minimal" });

    expect(advice.selectedTier).toBe("minimal");
    expect(advice.warnings.some((warning) => warning.includes("Minimal cadence is best kept"))).toBe(true);
  });

  it("keeps the mixed surface on the full cadence path", () => {
    const advice = buildTestCadenceAdvice({ surface: "mixed", tier: "recommended" });

    expect(advice.selectedTier).toBe("recommended");
    expect(advice.warnings.some((warning) => warning.includes("Dashboard and mixed work usually need the full cadence."))).toBe(true);
  });

  it("includes the conductor rescan in the track cadence", () => {
    const advice = buildTestCadenceAdvice({ surface: "track" });

    expect(advice.defaultTier).toBe("recommended");
    expect(advice.recommendedCommands).toContain("node build/cli.js conductor rescan");
    expect(advice.status).toBe("healthy");
  });

  it("renders the cadence markdown from a planner snapshot", () => {
    const snapshot = buildDevExPlannerSnapshot({
      templateId: "dashboard-panel",
      surface: "dashboard",
      tier: "recommended",
    });

    const markdown = renderTestPlanMarkdown(snapshot);

    expect(markdown).toContain("# Test Cadence Advisor");
    expect(markdown).toContain("Selected tier: Recommended");
    expect(markdown).toContain("npm run build:ui");
    expect(markdown).toContain("Dashboard Panel Mission");
  });
});
