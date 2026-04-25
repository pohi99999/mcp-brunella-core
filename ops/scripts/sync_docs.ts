#!/usr/bin/env npx tsx
import path from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import boxen from "boxen";

import { syncDocStats } from "./sync_doc_stats.js";
import { updateMasterContext } from "./update_master_context.js";
import { buildDocsConfigSotSnapshot, renderDocsConfigSotMarkdown } from "../../packages/utils/docsConfigSot.js";
import { buildDocsUnifierReport } from "../../packages/utils/docUnifier.js";
import { buildConfigGuardianReport } from "../../packages/utils/configGuardian.js";

function printHumanSummary(
  stats: ReturnType<typeof syncDocStats>["stats"],
  changedFiles: string[],
  masterContextChanged: boolean,
  snapshot: ReturnType<typeof buildDocsConfigSotSnapshot>,
): void {
  const docsReport = buildDocsUnifierReport(snapshot);
  const configReport = buildConfigGuardianReport(snapshot);

  console.log(
    boxen(chalk.blue("Brunella Docs / Config Sync"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  console.log(`[sync:docs] Agent registry entries: ${stats.agentCount}`);
  console.log(`[sync:docs] Route modules: ${stats.routeModuleCount} · Tool files: ${stats.toolFileCount}`);
  console.log(`[sync:docs] Docs health: ${docsReport.summary.status} (${docsReport.summary.score}/100)`);
  console.log(`[sync:docs] Config health: ${configReport.summary.status} (${configReport.summary.score}/100)`);

  if (changedFiles.length === 0 && !masterContextChanged) {
    console.log("[sync:docs] No documentation drift detected.");
  } else {
    const changes = [...changedFiles];
    if (masterContextChanged) {
      changes.push("BRUNELLA_MASTER_CONTEXT.md");
    }
    console.log(`[sync:docs] Drift detected in ${changes.length} file(s): ${changes.join(", ")}`);
  }

  if (snapshot.warnings.length > 0) {
    console.log(chalk.cyan("\nWarnings:"));
    for (const warning of snapshot.warnings) {
      console.log(`  • ${warning}`);
    }
  }

  console.log(chalk.dim("\nSnapshot summary:"));
  console.log(renderDocsConfigSotMarkdown(snapshot));
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const json = args.has("--json");
  const failOnDrift = args.has("--fail-on-drift");

  const { stats, results } = syncDocStats(process.cwd(), dryRun);
  const changedFiles = results.filter((result) => result.changed).map((result) => path.relative(process.cwd(), result.filePath));
  const masterContextResult = await updateMasterContext(dryRun);
  const snapshot = buildDocsConfigSotSnapshot(process.cwd());
  const docsReport = buildDocsUnifierReport(snapshot);
  const configReport = buildConfigGuardianReport(snapshot);

  if (json) {
    console.log(JSON.stringify({
      stats,
      changedFiles: changedFiles.concat(masterContextResult.changed ? ["BRUNELLA_MASTER_CONTEXT.md"] : []),
      masterContextChanged: masterContextResult.changed,
      snapshot,
      docs: docsReport,
      config: configReport,
    }, null, 2));
  } else {
    printHumanSummary(stats, changedFiles, masterContextResult.changed, snapshot);
  }

  if ((dryRun || failOnDrift) && (changedFiles.length > 0 || masterContextResult.changed || snapshot.warnings.length > 0)) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  void main();
}

