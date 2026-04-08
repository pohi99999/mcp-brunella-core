import type { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";

import { writeLine } from "../utils/cliOutput.js";
import type { DocsConfigHealthResponse, DocsConfigSotSnapshot } from "../dashboard/lib/apiService.js";

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

async function fetchDocsConfigSnapshot(): Promise<DocsConfigSotSnapshot> {
  const response = await fetch(`${API_BASE}/api/docs-config/snapshot`);
  if (!response.ok) {
    throw new Error(`Docs/config snapshot: HTTP ${response.status}`);
  }

  return response.json() as Promise<DocsConfigSotSnapshot>;
}

async function fetchDocsConfigHealth(): Promise<DocsConfigHealthResponse> {
  const response = await fetch(`${API_BASE}/api/docs-config/health`);
  if (!response.ok) {
    throw new Error(`Docs/config health: HTTP ${response.status}`);
  }

  return response.json() as Promise<DocsConfigHealthResponse>;
}

function printSnapshot(snapshot: DocsConfigSotSnapshot): void {
  writeLine(
    boxen(chalk.blue("Docs / Config SOT"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  writeLine(`Checked at: ${snapshot.checkedAt}`);
  writeLine(`Score: ${snapshot.summary.score}/100`);
  writeLine(`Status: ${snapshot.summary.status}`);
  writeLine(
    `Docs: ${snapshot.documents.presentRequiredCount}/${snapshot.documents.requiredCount} required · Managed: ${snapshot.documents.managedHealthyCount}/${snapshot.documents.managedCount} healthy`,
  );
  writeLine(
    `Config: docs=${snapshot.config.docsKeyCoveragePercent}% example=${snapshot.config.exampleKeyCoveragePercent}% runtimeKeys=${snapshot.config.runtimeKeys.length}`,
  );
}

function printHealth(snapshot: DocsConfigHealthResponse): void {
  writeLine(
    boxen(chalk.blue("Docs / Config Health"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  writeLine(`Checked at: ${snapshot.snapshot.checkedAt}`);
  writeLine(`Overall: ${snapshot.snapshot.summary.status} (${snapshot.snapshot.summary.score}/100)`);
  writeLine(`Docs: ${snapshot.docs.summary.status} (${snapshot.docs.summary.score}/100)`);
  writeLine(`Config: ${snapshot.config.summary.status} (${snapshot.config.summary.score}/100)`);

  if (snapshot.snapshot.warnings.length > 0) {
    writeLine(chalk.cyan("\nWarnings:"));
    snapshot.snapshot.warnings.forEach((warning) => writeLine(`  • ${warning}`));
  }

  writeLine(chalk.cyan("\nTop recommendations:"));
  const recommendations = [
    ...snapshot.docs.recommendations.map((item) => ({ title: item.title, priority: item.priority })),
    ...snapshot.config.recommendations.map((item) => ({ title: item.title, priority: item.priority })),
  ].slice(0, 6);

  if (recommendations.length === 0) {
    writeLine("  (none)");
    return;
  }

  recommendations.forEach((recommendation) => {
    writeLine(`  • [${recommendation.priority}] ${recommendation.title}`);
  });
}

export function registerDocsConfigCommands(program: Command): void {
  const docsConfig = program
    .command("docs-config")
    .description("Documentation and config single-source-of-truth utilities");

  docsConfig
    .command("snapshot")
    .description("Print the canonical docs/config snapshot")
    .option("--json", "Print raw JSON snapshot")
    .action(async (options: { json?: boolean }) => {
      try {
        const snapshot = await fetchDocsConfigSnapshot();
        if (options.json) {
          writeLine(JSON.stringify(snapshot, null, 2));
          return;
        }

        printSnapshot(snapshot);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  docsConfig
    .command("health")
    .description("Print the combined docs/config health report")
    .option("--json", "Print raw JSON health report")
    .action(async (options: { json?: boolean }) => {
      try {
        const snapshot = await fetchDocsConfigHealth();
        if (options.json) {
          writeLine(JSON.stringify(snapshot, null, 2));
          return;
        }

        printHealth(snapshot);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}

