import type { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";

import { writeLine } from "../utils/cliOutput.js";
import type { AgentRegistryGovernanceSnapshot } from "../dashboard/lib/apiService.js";

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

async function fetchGovernanceSnapshot(): Promise<AgentRegistryGovernanceSnapshot> {
  const response = await fetch(`${API_BASE}/api/agents/registry-governance`);
  if (!response.ok) {
    throw new Error(`Agent registry governance: HTTP ${response.status}`);
  }

  return response.json() as Promise<AgentRegistryGovernanceSnapshot>;
}

function printAuditReport(snapshot: AgentRegistryGovernanceSnapshot): void {
  const { audit } = snapshot;

  writeLine(
    boxen(chalk.blue("Agent Registry Governance"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  writeLine(`Checked at: ${audit.checkedAt}`);
  writeLine(`Score: ${audit.summary.score}/100`);
  writeLine(`Status: ${audit.summary.overallStatus}`);
  writeLine(
    `Counts: agents=${audit.summary.totalAgents} active=${audit.summary.activeAgents} loaded=${audit.summary.loadedAgents} duplicates=${audit.summary.duplicateNameCount} overlaps=${audit.summary.duplicateCapabilityGroupCount} stale=${audit.summary.staleAgentCount} undocumented=${audit.summary.undocumentedAgentCount} loadErrors=${audit.summary.loadErrorCount}`,
  );

  if (audit.duplicateNames.length > 0) {
    writeLine(chalk.cyan("\nDuplicate names:"));
    audit.duplicateNames.forEach((group) => {
      writeLine(`  • ${chalk.bold(group.name)} → ${group.agents.join(", ")}`);
    });
  }

  if (audit.staleAgents.length > 0) {
    writeLine(chalk.cyan("\nStale agents:"));
    audit.staleAgents.forEach((agent) => {
      writeLine(`  • ${chalk.bold(agent.name)} (${agent.usageStatus}) — ${agent.reason}`);
    });
  }

  if (audit.loadErrors.length > 0) {
    writeLine(chalk.red("\nLoad errors:"));
    audit.loadErrors.forEach((entry) => {
      writeLine(`  • ${chalk.bold(entry.name)} — ${entry.error}`);
    });
  }

  writeLine(chalk.cyan("\nRecommendations:"));
  const topRecommendations = snapshot.recommendations.slice(0, 5);
  if (topRecommendations.length === 0) {
    writeLine("  (none)");
  } else {
    topRecommendations.forEach((recommendation) => {
      writeLine(`  • [${recommendation.priority}] ${recommendation.title}`);
    });
  }
}

function printRecommendations(snapshot: AgentRegistryGovernanceSnapshot): void {
  writeLine(
    boxen(chalk.blue("Agent Registry Recommendations"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  if (snapshot.recommendations.length === 0) {
    writeLine(chalk.green("No recommendations generated."));
    return;
  }

  snapshot.recommendations.forEach((recommendation) => {
    writeLine(
      `${chalk.bold(`[${recommendation.priority}]`)} ${recommendation.title} ${chalk.dim(`(${recommendation.type})`)}`,
    );
    writeLine(`  ${recommendation.rationale}`);
    if (recommendation.targets.length > 0) {
      writeLine(`  Targets: ${recommendation.targets.join(", ")}`);
    }
    writeLine("");
  });
}

export function registerAgentGovernanceCommands(program: Command): void {
  const governance = program
    .command("agent-governance")
    .description("Agent registry governance and consolidation snapshot");

  governance
    .command("audit")
    .description("Print the canonical registry governance audit")
    .option("--json", "Print raw JSON snapshot")
    .action(async (options: { json?: boolean }) => {
      try {
        const snapshot = await fetchGovernanceSnapshot();
        if (options.json) {
          writeLine(JSON.stringify(snapshot, null, 2));
          return;
        }

        printAuditReport(snapshot);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  governance
    .command("recommendations")
    .description("Print governance recommendations")
    .option("--json", "Print raw JSON recommendations")
    .action(async (options: { json?: boolean }) => {
      try {
        const snapshot = await fetchGovernanceSnapshot();
        if (options.json) {
          writeLine(JSON.stringify({ checkedAt: snapshot.checkedAt, recommendations: snapshot.recommendations }, null, 2));
          return;
        }

        printRecommendations(snapshot);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}

