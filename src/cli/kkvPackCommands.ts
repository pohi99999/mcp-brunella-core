import { Command } from "commander";

import chalk from "chalk";
import boxen from "boxen";
import { marked } from "marked";

import { configManager } from "../utils/cliConfig.js";
import { ensureError } from "../utils/ensureError.js";
import { writeLine } from "../utils/cliOutput.js";
import {
  kkvPackDomainLabels,
  kkvPackStatusLabels,
  type KkvPackResponse,
} from "../tools/kkvPack.js";

function getServerUrl(): string {
  const configured = configManager.get("serverUrl");
  return typeof configured === "string" && configured.trim().length > 0
    ? configured
    : "http://localhost:3000";
}

function buildPackUrl(packId: string | undefined, path: "snapshot" | "brief"): string {
  const url = new URL(`/api/v1/kkv-pack/${path}`, getServerUrl());
  if (packId) {
    url.searchParams.set("pack", packId);
  }
  return url.toString();
}

async function fetchKkvPackResponse(packId?: string, path: "snapshot" | "brief" = "snapshot"): Promise<KkvPackResponse> {
  const response = await fetch(buildPackUrl(packId, path), {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `KKV pack request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<KkvPackResponse>;
}

function printPackSummary(response: KkvPackResponse): void {
  const { snapshot } = response;

  writeLine(
    boxen(chalk.cyan("KKV Pack Productization"), {
      padding: 1,
      borderStyle: "round",
      borderColor: snapshot.summary.status === "critical" ? "red" : "cyan",
    }),
  );

  writeLine(chalk.bold("Overall score:"), `${snapshot.summary.score} / 100`);
  writeLine(chalk.bold("Overall status:"), snapshot.summary.status);
  writeLine(chalk.bold("Selected pack:"), snapshot.selectedPack.title);
  writeLine(chalk.bold("Domain:"), kkvPackDomainLabels[snapshot.selectedPack.domain]);
  writeLine(chalk.bold("Pack status:"), kkvPackStatusLabels[snapshot.selectedPack.status]);
  writeLine(chalk.bold("Boundary:"), snapshot.selectedPack.boundary);

  writeLine(chalk.cyan("\nWarnings:"));
  snapshot.warnings.forEach((warning) => writeLine(`  - ${warning}`));

  writeLine(chalk.cyan("\nRecommendations:"));
  snapshot.recommendations.forEach((recommendation) => {
    writeLine(`  - ${recommendation.title}: ${recommendation.rationale}`);
  });
}

async function renderBrief(packId?: string, json = false): Promise<void> {
  const response = await fetchKkvPackResponse(packId, "brief");
  if (json) {
    writeLine(JSON.stringify(response, null, 2));
    return;
  }

  writeLine(marked(response.briefMarkdown));
}

export function registerKkvPackCommands(program: Command): void {
  const kkvPack = program
    .command("kkv-pack")
    .description("KKV pack productization cockpit and brief runner");

  kkvPack
    .command("status [packId]")
    .description("Show the KKV pack snapshot and readiness summary")
    .option("--json", "Raw JSON output")
    .action(async (packId: string | undefined, cmd?: { opts: () => { json?: boolean } }) => {
      try {
        const response = await fetchKkvPackResponse(packId, "snapshot");
        if (cmd?.opts().json) {
          writeLine(JSON.stringify(response, null, 2));
          return;
        }

        printPackSummary(response);
      } catch (error: unknown) {
        console.error(chalk.red("Error fetching KKV pack status:"), ensureError(error).message);
        process.exitCode = 1;
      }
    });

  kkvPack
    .command("brief [packId]")
    .description("Render the selected pack brief")
    .option("--json", "Raw JSON output")
    .action(async (packId: string | undefined, cmd?: { opts: () => { json?: boolean } }) => {
      try {
        await renderBrief(packId, cmd?.opts().json ?? false);
      } catch (error: unknown) {
        console.error(chalk.red("Error fetching KKV pack brief:"), ensureError(error).message);
        process.exitCode = 1;
      }
    });
}
