import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRegistryHealthPanel } from "./AgentRegistryHealthPanel";
import * as apiService from "@/lib/apiService";

vi.mock("@/lib/apiService", () => ({
  getAgentRegistryGovernanceSnapshot: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("AgentRegistryHealthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(apiService.getAgentRegistryGovernanceSnapshot).mockResolvedValue({
      checkedAt: "2026-04-08T12:00:00.000Z",
      registry: {
        version: "1.0.0",
        agents: [],
        defaultAgent: "AgentA",
        routingRules: [],
      },
      diagnostics: {
        validation: {
          valid: true,
          errors: [],
          warnings: [],
          checkedAt: "2026-04-08T12:00:00.000Z",
          summary: {
            totalAgents: 2,
            activeAgents: 2,
            invalidAgents: 0,
            defaultAgent: "AgentA",
          },
        },
        agents: [],
      },
      governanceDocuments: [
        {
          name: "BRUNELLA_MASTER_CONTEXT.md",
          path: "F:/mcp-brunella-core/BRUNELLA_MASTER_CONTEXT.md",
          present: true,
          characters: 120,
        },
      ],
      audit: {
        checkedAt: "2026-04-08T12:00:00.000Z",
        summary: {
          totalAgents: 2,
          activeAgents: 2,
          loadedAgents: 2,
          loadErrorCount: 1,
          duplicateNameCount: 1,
          duplicateCapabilityGroupCount: 0,
          staleAgentCount: 1,
          undocumentedAgentCount: 1,
          warningCount: 4,
          score: 72,
          overallStatus: "attention",
        },
        duplicateNames: [
          {
            name: "DupAgent",
            count: 2,
            agents: ["DupAgent", "DupAgent"],
          },
        ],
        duplicateCapabilityOverlapGroups: [],
        staleAgents: [
          {
            name: "StaleAgent",
            usageStatus: "never-used",
            successCount: 0,
            errorCount: 0,
            reason: "Agent has never been used in the current runtime window.",
          },
        ],
        undocumentedAgents: [
          {
            name: "BrokenAgent",
            mentions: [],
          },
        ],
        loadErrors: [
          {
            name: "BrokenAgent",
            module: "./agents/BrokenAgent.js",
            configuredClass: "BrokenAgentClass",
            loadStatus: "error",
            error: "Module not found",
          },
        ],
        perAgentHealth: [
          {
            name: "AgentA",
            title: "Agent A",
            category: "general",
            health: "healthy",
            score: 96,
            loadStatus: "loaded",
            runtimeStatus: "idle",
            usageStatus: "active",
            documented: true,
            duplicateName: false,
            duplicateCapabilityGroupIds: [],
            issues: [],
            successCount: 2,
            errorCount: 0,
            lastTaskAt: "2026-04-08T11:30:00.000Z",
          },
          {
            name: "BrokenAgent",
            title: "Broken Agent",
            category: "general",
            health: "critical",
            score: 24,
            loadStatus: "error",
            runtimeStatus: "unloaded",
            usageStatus: "never-used",
            documented: false,
            duplicateName: false,
            duplicateCapabilityGroupIds: [],
            issues: ["Load error: Module not found", "Missing documentation references."],
            successCount: 0,
            errorCount: 0,
            lastTaskAt: undefined,
          },
        ],
        documentCoverage: {
          documents: [
            {
              name: "BRUNELLA_MASTER_CONTEXT.md",
              path: "F:/mcp-brunella-core/BRUNELLA_MASTER_CONTEXT.md",
              present: true,
              agentMentions: 1,
            },
          ],
          agentsReferenced: 1,
          agentsMissingReferences: ["BrokenAgent"],
          coveragePercent: 50,
        },
        warnings: ["Load error: BrokenAgent — Module not found"],
      },
      recommendations: [
        {
          id: "merge:dupagent",
          type: "merge",
          priority: "critical",
          title: "Merge duplicate agent name: DupAgent",
          rationale: "Duplicate name detected.",
          targets: ["DupAgent"],
          evidence: ["Duplicate name count: 2"],
        },
        {
          id: "fix:brokenagent",
          type: "fix",
          priority: "critical",
          title: "Fix load error for BrokenAgent",
          rationale: "The agent failed to load.",
          targets: ["BrokenAgent"],
          evidence: ["Module not found"],
        },
      ],
    });
  });

  it("renders governance score, issue counts, and registry explorer rows", async () => {
    render(<AgentRegistryHealthPanel />);

    await waitFor(() => {
      expect(apiService.getAgentRegistryGovernanceSnapshot).toHaveBeenCalled();
    });

    expect(screen.getByText("Agent Registry Health")).toBeInTheDocument();
    expect(screen.getByTestId("registry-governance-score")).toHaveTextContent("72");
    expect(screen.getByTestId("registry-governance-duplicate-names")).toHaveTextContent("1");
    expect(screen.getByTestId("registry-governance-stale-agents")).toHaveTextContent("1");
    expect(screen.getByTestId("registry-governance-load-errors")).toHaveTextContent("1");
    expect(screen.getByText("Merge duplicate agent name: DupAgent")).toBeInTheDocument();
    expect(screen.getByText("StaleAgent")).toBeInTheDocument();
    expect(screen.getByTestId("registry-agent-BrokenAgent-0")).toBeInTheDocument();
    expect(screen.getByTestId("registry-agent-AgentA-1")).toBeInTheDocument();
  });
});

