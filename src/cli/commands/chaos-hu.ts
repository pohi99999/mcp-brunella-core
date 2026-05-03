import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import * as api from "../../dashboard/lib/apiService.js";
import type { AgentResponse } from "../../agents/types.js";

function isAgentResponse(value: unknown): value is AgentResponse {
  return typeof value === "object" && value !== null && "status" in value;
}

export async function chaosMenu() {
  console.log(
    boxen(chalk.bold.red("☣ BRUNELLA CHAOS ENGINE ☣"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "red",
    })
  );

  const spinner = ora("Státusz lekérése...").start();
  let status;
  try {
    // Note: Since we are in CLI, we might need to point to the local API
    // apiService uses relative paths by default, which works in browser.
    // In CLI we use direct env vars or internal calls.
    // However, for consistency with EPP v2, we'll try to use the process.env directly here
    // or a shared utility.
    status = {
      enabled: process.env.CHAOS_MODE === "true",
      probability: parseFloat(process.env.CHAOS_PROBABILITY || "0.1"),
      types: (process.env.CHAOS_TYPES || "timeout,rate_limit,corruption").split(","),
    };
    spinner.succeed("Chaos Engine állapota beolvasva.");
  } catch (e) {
    spinner.fail("Nem sikerült lekérni a státuszt.");
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Mit szeretnél tenni?",
      choices: [
        { name: `Állapot: ${status.enabled ? chalk.green("AKTÍV") : chalk.gray("KIKAPCSOLVA")}`, value: "toggle" },
        { name: "Konfiguráció módosítása", value: "config" },
        { name: "Chaos Teszt Suite futtatása (EvaluatorAgent)", value: "run_suite" },
        { name: "Vissza a főmenübe", value: "exit" },
      ],
    },
  ]);

  if (action === "toggle") {
    process.env.CHAOS_MODE = status.enabled ? "false" : "true";
    console.log(chalk.yellow(`\nChaos Mode mostantól: ${process.env.CHAOS_MODE === "true" ? chalk.red("AKTÍV") : chalk.green("KIKAPCSOLVA")}`));
    return chaosMenu();
  }

  if (action === "config") {
    const answers = await inquirer.prompt([
      {
        type: "number",
        name: "probability",
        message: "Hiba valószínűsége (0.0 - 1.0):",
        default: status.probability,
      },
      {
        type: "checkbox",
        name: "types",
        message: "Engedélyezett hiba típusok:",
        choices: ["timeout", "rate_limit", "corruption"],
        default: status.types,
      },
    ]);

    process.env.CHAOS_PROBABILITY = String(answers.probability);
    process.env.CHAOS_TYPES = answers.types.join(",");
    console.log(chalk.green("\nKonfiguráció mentve (az aktuális folyamatban)."));
    return chaosMenu();
  }

  if (action === "run_suite") {
    const { count } = await inquirer.prompt([
      {
        type: "number",
        name: "count",
        message: "Hány tesztesetet futtassunk?",
        default: 5,
      },
    ]);

    const testSpinner = ora("Chaos tesztek futtatása az EvaluatorAgent-tel...").start();
    try {
      // Direct call to AgentManager for implementation
      const { agentManager } = await import("../../agents/AgentManager.js");
      const evaluator = agentManager.getAgent("evaluator");
      if (evaluator) {
        const result = await evaluator.execute(`Futtass le ${count} chaos tesztesetet a run_chaos_test_suite eszközzel.`);
        testSpinner.succeed("Teszt sorozat befejeződött.");
        console.log(chalk.cyan("\nEredmények:"));
        const output = isAgentResponse(result) ? result.data ?? result.message ?? result.status : result;
        console.log(typeof output === "string" ? output : JSON.stringify(output, null, 2));
      } else {
        testSpinner.fail("EvaluatorAgent nem található.");
      }
    } catch (e) {
      testSpinner.fail("Hiba a teszt futtatása közben.");
      console.error(e);
    }
    return chaosMenu();
  }
}
