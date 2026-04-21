import { describe, expect, it } from "vitest";

import { selectAgentForInstruction } from "../src/agents/agentRouting.js";
import { normalizeRegistryConfig } from "../src/agents/registryStandard.js";

describe("selectAgentForInstruction", () => {
  it("prefers capability-rich healthy agent over weaker matches", () => {
    const registry = normalizeRegistryConfig({
      defaultAgent: "Orchestrator",
      agents: [
        {
          name: "Developer",
          class: "DeveloperAgent",
          module: "./agents/DeveloperAgent.js",
          description: "",
          capabilities: ["typescript refactoring", "bug fixing", "linting"],
          triggers: ["refactor", "fix"],
          priority: 8,
        },
        {
          name: "Researcher",
          class: "ResearcherAgent",
          module: "./agents/ResearcherAgent.js",
          description: "",
          capabilities: ["web research", "documentation"],
          priority: 3,
        },
      ],
      routingRules: [],
    });

    const decision = selectAgentForInstruction(
      "Please refactor this TypeScript module and fix the bug",
      registry,
      new Map([
        ["Developer", { status: "idle", successCount: 10, errorCount: 0 }],
        ["Researcher", { status: "idle", successCount: 5, errorCount: 0 }],
      ]),
    );

    expect(decision.agentName).toBe("Developer");
    expect(decision.strategy).toBe("trigger");
  });

  it("avoids agents currently in error when scores are similar", () => {
    const registry = normalizeRegistryConfig({
      defaultAgent: "Orchestrator",
      agents: [
        {
          name: "Python",
          class: "PythonAgent",
          module: "./agents/PythonAgent.js",
          description: "",
          capabilities: ["python scripting"],
          priority: 4,
        },
        {
          name: "Developer",
          class: "DeveloperAgent",
          module: "./agents/DeveloperAgent.js",
          description: "",
          capabilities: ["python scripting"],
          priority: 4,
        },
      ],
      routingRules: [],
    });

    const decision = selectAgentForInstruction(
      "Need python scripting help",
      registry,
      new Map([
        ["Python", { status: "error", successCount: 2, errorCount: 5 }],
        ["Developer", { status: "idle", successCount: 6, errorCount: 0 }],
      ]),
    );

    expect(decision.agentName).toBe("Developer");
    expect(decision.strategy).toBe("capability");
  });
});
