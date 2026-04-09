import { describe, expect, it } from "vitest";

import {
  buildDevExPlannerSnapshot,
  loadMissionTemplates,
  renderDevExPlannerMarkdown,
} from "../src/tools/missionPlanner.js";

describe("missionPlanner", () => {
  it("loads and sorts the mission templates", () => {
    const templates = loadMissionTemplates(process.cwd());

    expect(templates).toHaveLength(5);
    expect(templates.map((template) => template.id)).toEqual([
      "api-route",
      "docs-config",
      "cli-ops",
      "track-bootstrap",
      "dashboard-panel",
    ]);
  });

  it("builds a healthy snapshot for the dashboard mission", () => {
    const snapshot = buildDevExPlannerSnapshot({
      templateId: "dashboard-panel",
      surface: "dashboard",
      tier: "full",
    });

    expect(snapshot.selectedTemplate.id).toBe("dashboard-panel");
    expect(snapshot.summary.selectedSurface).toBe("dashboard");
    expect(snapshot.testCadence.selectedTier).toBe("full");
    expect(snapshot.summary.status).toBe("healthy");
    expect(snapshot.warnings).toHaveLength(0);
  });

  it("builds override warnings and recommendations when the selected surface differs", () => {
    const snapshot = buildDevExPlannerSnapshot({
      templateId: "api-route",
      surface: "docs",
      tier: "recommended",
    });

    expect(snapshot.summary.selectedSurface).toBe("docs");
    expect(snapshot.warnings.some((warning) => warning.includes("overrides the template's default"))).toBe(true);
    expect(snapshot.recommendations.some((recommendation) => recommendation.id === "api-route-surface-override")).toBe(true);
  });

  it("rejects unknown mission template ids", () => {
    expect(() => buildDevExPlannerSnapshot({ templateId: "missing-template" })).toThrow(
      "Unknown mission template: missing-template",
    );
  });

  it("renders the combined mission and cadence markdown", () => {
    const snapshot = buildDevExPlannerSnapshot({
      templateId: "docs-config",
      surface: "docs",
      tier: "recommended",
    });

    const markdown = renderDevExPlannerMarkdown(snapshot);

    expect(markdown).toContain("# Mission Planner");
    expect(markdown).toContain("# Test Cadence Advisor");
    expect(markdown).toContain("Docs and Config Mission");
    expect(markdown).toContain("python scripts/sync_foszal.py");
  });
});
