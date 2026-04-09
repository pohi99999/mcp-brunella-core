import type { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import inquirer from "inquirer";

import { writeLine } from "../utils/cliOutput.js";
import {
  isMissionSurface,
  isTestCadenceTier,
  missionSurfaceLabels,
  missionSurfaceValues,
  testCadenceTierLabels,
  testCadenceTierValues,
  type DevExPlannerResponse,
  type MissionSurface,
  type TestCadenceTier,
} from "../tools/devExTypes.js";
import { renderMissionMarkdown } from "../tools/missionPlanner.js";
import { renderTestPlanMarkdown } from "../tools/testCadenceAdvisor.js";

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

async function fetchDevExPlanner(templateId?: string, surface?: MissionSurface, tier?: TestCadenceTier): Promise<DevExPlannerResponse> {
  const params = new URLSearchParams();
  if (templateId) params.set("templateId", templateId);
  if (surface) params.set("surface", surface);
  if (tier) params.set("tier", tier);

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/v1/devex/planner${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`DevEx planner: HTTP ${response.status}`);
  }

  return response.json() as Promise<DevExPlannerResponse>;
}

async function chooseSurface(defaultSurface: MissionSurface): Promise<MissionSurface> {
  const answer = await inquirer.prompt<{ surface: MissionSurface }>([
    {
      type: "list",
      name: "surface",
      message: "Melyik felületre szeretnéd a cadence javaslatot?",
      choices: missionSurfaceValues.map((surface) => ({
        name: `${missionSurfaceLabels[surface]} (${surface})`,
        value: surface,
      })),
      default: defaultSurface,
    },
  ]);

  return answer.surface;
}

async function chooseTier(defaultTier: TestCadenceTier): Promise<TestCadenceTier> {
  const answer = await inquirer.prompt<{ tier: TestCadenceTier }>([
    {
      type: "list",
      name: "tier",
      message: "Melyik teszt szintet szeretnéd kiemelni?",
      choices: testCadenceTierValues.map((tier) => ({
        name: `${testCadenceTierLabels[tier]} (${tier})`,
        value: tier,
      })),
      default: defaultTier,
    },
  ]);

  return answer.tier;
}

function printTemplates(response: DevExPlannerResponse): void {
  writeLine(boxen(chalk.cyan("Brunella DevEx — Mission Templates"), { padding: 1, borderStyle: "round", borderColor: "cyan" }));
  writeLine(`Checked at: ${response.snapshot.checkedAt}`);
  writeLine(`Templates: ${response.snapshot.templates.length}`);
  writeLine();

  for (const template of response.snapshot.templates) {
    writeLine(`- ${chalk.bold(template.title)} (${chalk.dim(template.id)})`);
    writeLine(`  ${template.description}`);
    writeLine(`  Surface: ${missionSurfaceLabels[template.surface]} · Category: ${template.category}`);
  }
}

function printMission(response: DevExPlannerResponse): void {
  writeLine(renderMissionMarkdown(response.snapshot));
}

function printTestPlan(response: DevExPlannerResponse): void {
  writeLine(renderTestPlanMarkdown(response.snapshot));
}

export function registerDevExCommands(program: Command): void {
  const devex = program
    .command("devex")
    .description("Mission templates and test cadence DevEx tools");

  devex
    .command("templates")
    .description("List the available mission templates")
    .option("-j, --json", "Print raw JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const response = await fetchDevExPlanner();
        if (opts.json) {
          writeLine(JSON.stringify(response, null, 2));
          return;
        }

        printTemplates(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  devex
    .command("mission [templateId]")
    .description("Render a mission plan from a template")
    .option("--surface <surface>", "Override the mission surface")
    .option("--tier <tier>", "Override the cadence tier")
    .option("-j, --json", "Print raw JSON")
    .option("--markdown", "Print markdown output")
    .action(async (templateId: string | undefined, opts: { surface?: string; tier?: string; json?: boolean; markdown?: boolean }) => {
      try {
        const surface = opts.surface && isMissionSurface(opts.surface) ? opts.surface : undefined;
        const tier = opts.tier && isTestCadenceTier(opts.tier) ? opts.tier : undefined;
        const response = await fetchDevExPlanner(templateId, surface, tier);

        if (opts.json) {
          writeLine(JSON.stringify(response, null, 2));
          return;
        }

        if (opts.markdown) {
          writeLine(renderMissionMarkdown(response.snapshot));
          return;
        }

        printMission(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  devex
    .command("test-plan [templateId]")
    .description("Render the test cadence advice for a template")
    .option("--surface <surface>", "Override the mission surface")
    .option("--tier <tier>", "Override the cadence tier")
    .option("-j, --json", "Print raw JSON")
    .option("--markdown", "Print markdown output")
    .action(async (templateId: string | undefined, opts: { surface?: string; tier?: string; json?: boolean; markdown?: boolean }) => {
      try {
        const surface = opts.surface && isMissionSurface(opts.surface) ? opts.surface : undefined;
        const tier = opts.tier && isTestCadenceTier(opts.tier) ? opts.tier : undefined;
        const response = await fetchDevExPlanner(templateId, surface, tier);

        if (opts.json) {
          writeLine(JSON.stringify(response, null, 2));
          return;
        }

        if (opts.markdown) {
          writeLine(renderTestPlanMarkdown(response.snapshot));
          return;
        }

        printTestPlan(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  devex
    .command("choose")
    .description("Interactively choose a mission surface and cadence tier")
    .action(async () => {
      try {
        const surface = await chooseSurface("dashboard");
        const tier = await chooseTier("recommended");
        const response = await fetchDevExPlanner(undefined, surface, tier);
        printMission(response);
        writeLine();
        printTestPlan(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeLine(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
