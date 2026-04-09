import { describe, expect, it } from "vitest";

import { auditAgentRegistry } from "../src/tools/agentRegistryAudit.js";
import { generateAgentRegistryRecommendations } from "../src/tools/agentRegistryRecommendations.js";

const checkedAt = "2026-04-08T12:00:00.000Z";

const registry = {
  version: "1.0.0",
  defaultAgent: "AgentA",
  routingRules: [{ pattern: "*", agent: "AgentA" }],
  agents: [
    {
      name: "AgentA",
      class: "AgentAClass",
      module: "./agents/AgentA.js",
      description: "Primary agent",
      capabilities: ["shared-alpha", "shared-beta"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
    {
      name: "AgentB",
      class: "AgentBClass",
      module: "./agents/AgentB.js",
      description: "Overlap partner",
      capabilities: ["shared-alpha", "shared-beta", "shared-gamma"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
    {
      name: "DupAgent",
      class: "DupOne",
      module: "./agents/DupOne.js",
      description: "Duplicate one",
      capabilities: ["dup-capability"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
    {
      name: "DupAgent",
      class: "DupTwo",
      module: "./agents/DupTwo.js",
      description: "Duplicate two",
      capabilities: ["dup-capability"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
    {
      name: "StaleAgent",
      class: "StaleAgentClass",
      module: "./agents/StaleAgent.js",
      description: "Needs attention",
      capabilities: ["stale-capability"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
    {
      name: "BrokenAgent",
      class: "BrokenAgentClass",
      module: "./agents/BrokenAgent.js",
      description: "Broken module",
      capabilities: ["broken-capability"],
      status: "active",
      priority: 1,
      autoStart: false,
    },
  ],
};

const diagnostics = {
  validation: {
    valid: true,
    errors: [],
    warnings: [],
    checkedAt,
    summary: {
      totalAgents: 6,
      activeAgents: 6,
      invalidAgents: 0,
      defaultAgent: "AgentA",
    },
  },
  agents: [
    {
      name: "AgentA",
      module: "./agents/AgentA.js",
      configuredClass: "AgentAClass",
      loadStatus: "loaded",
      availableExports: ["AgentAClass"],
      metadata: {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: [],
        capabilities: ["shared-alpha", "shared-beta"],
        priority: 1,
        autoStart: false,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: {
        status: "idle",
        lastTaskAt: "2026-04-08T11:30:00.000Z",
        lastTask: "Audit",
        successCount: 3,
        errorCount: 0,
      },
    },
    {
      name: "AgentB",
      module: "./agents/AgentB.js",
      configuredClass: "AgentBClass",
      loadStatus: "loaded",
      availableExports: ["AgentBClass"],
      metadata: {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: [],
        capabilities: ["shared-alpha", "shared-beta", "shared-gamma"],
        priority: 1,
        autoStart: false,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: {
        status: "idle",
        lastTaskAt: "2026-04-08T11:45:00.000Z",
        lastTask: "Overlap",
        successCount: 2,
        errorCount: 0,
      },
    },
    {
      name: "DupAgent",
      module: "./agents/DupOne.js",
      configuredClass: "DupOne",
      loadStatus: "loaded",
      availableExports: ["DupOne"],
      metadata: {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: [],
        capabilities: ["dup-capability"],
        priority: 1,
        autoStart: false,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: {
        status: "idle",
        lastTaskAt: "2026-04-08T11:50:00.000Z",
        lastTask: "Duplicate",
        successCount: 1,
        errorCount: 0,
      },
    },
    {
      name: "StaleAgent",
      module: "./agents/StaleAgent.js",
      configuredClass: "StaleAgentClass",
      loadStatus: "loaded",
      availableExports: ["StaleAgentClass"],
      metadata: {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: [],
        capabilities: ["stale-capability"],
        priority: 1,
        autoStart: false,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: {
        status: "idle",
        successCount: 0,
        errorCount: 0,
      },
    },
    {
      name: "BrokenAgent",
      module: "./agents/BrokenAgent.js",
      configuredClass: "BrokenAgentClass",
      loadStatus: "error",
      availableExports: [],
      error: "Module not found",
      metadata: {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: [],
        capabilities: ["broken-capability"],
        priority: 1,
        autoStart: false,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: {
        status: "unloaded",
        successCount: 0,
        errorCount: 0,
      },
    },
  ],
};

const documents = [
  {
    name: "BRUNELLA_MASTER_CONTEXT.md",
    content: "AgentA is the canonical primary agent for governance audits.",
  },
  {
    name: "RENDSZER.md",
    content: "The registry governance report should keep the agent system auditable.",
  },
];

describe("agent registry governance audit", () => {
  it("detects governance issues and produces actionable recommendations", () => {
    const report = auditAgentRegistry(registry, diagnostics, documents, checkedAt);
    const recommendations = generateAgentRegistryRecommendations(report);

    expect(report.checkedAt).toBe(checkedAt);
    expect(report.summary.duplicateNameCount).toBe(1);
    expect(report.summary.duplicateCapabilityGroupCount).toBe(1);
    expect(report.summary.loadErrorCount).toBe(1);
    expect(report.summary.staleAgentCount).toBe(1);
    expect(report.summary.undocumentedAgentCount).toBeGreaterThan(0);
    expect(report.documentCoverage.coveragePercent).toBeLessThan(100);
    expect(report.duplicateNames[0]).toMatchObject({ name: "DupAgent", count: 2 });
    expect(report.duplicateCapabilityOverlapGroups[0].agents).toEqual(["AgentA", "AgentB"]);
    expect(report.staleAgents[0].name).toBe("StaleAgent");
    expect(report.loadErrors[0].name).toBe("BrokenAgent");
    expect(report.warnings.some((warning) => warning.includes("Duplicate agent name"))).toBe(true);

    expect(recommendations.some((item) => item.type === "merge")).toBe(true);
    expect(recommendations.some((item) => item.type === "consolidate")).toBe(true);
    expect(recommendations.some((item) => item.type === "archive")).toBe(true);
    expect(recommendations.some((item) => item.type === "document")).toBe(true);
    expect(recommendations.some((item) => item.type === "fix")).toBe(true);
    expect(report.perAgentHealth.find((agent) => agent.name === "BrokenAgent")?.health).toBe("critical");
  });
});

