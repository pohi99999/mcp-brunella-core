import { describe, expect, it } from "vitest";

import { validateAndNormalizeRegistry } from "@packages/agents/registryValidation.js";

describe("validateAndNormalizeRegistry", () => {
  it("normalizes metadata and reports missing default agent as warning", () => {
    const result = validateAndNormalizeRegistry({
      version: "1.0.0",
      defaultAgent: "MissingAgent",
      agents: [
        {
          name: "Developer",
          class: "DeveloperAgent",
          module: "./agents/DeveloperAgent.js",
          description: "Writes code",
          capabilities: ["code generation", "debugging"],
          triggers: ["fix bug"],
          priority: 7,
        },
      ],
      routingRules: [],
    });

    expect(result.report.valid).toBe(true);
    expect(result.report.warnings).toContain("Default agent 'MissingAgent' is not present in registry agents.");
    expect(result.registry.agents[0]?.metadataStandard).toMatchObject({
      priority: 7,
      executionMode: "local",
      costTier: "low",
      capabilities: ["code generation", "debugging"],
      triggers: ["fix bug"],
    });
  });

  it("reports duplicate names as errors", () => {
    const result = validateAndNormalizeRegistry({
      agents: [
        { name: "Dup", class: "A", module: "./a.js", description: "" },
        { name: "Dup", class: "B", module: "./b.js", description: "" },
      ],
    });

    expect(result.report.valid).toBe(false);
    expect(result.report.errors).toContain("Duplicate agent name in registry: Dup");
  });
});
