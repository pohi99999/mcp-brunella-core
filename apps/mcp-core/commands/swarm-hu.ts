import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { globalSwarmChatManager } from "../../core/SwarmChatManager.js";

export async function swarmMenu() {
  console.log(
    boxen(chalk.bold.cyan("🐝 BRUNELLA SWARM ORCHESTRATOR 🐝"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "cyan",
    })
  );

  const sessions = globalSwarmChatManager.listSessions();

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Válassz raj-műveletet:",
      choices: [
        { name: "Új Raj Munkamenet Indítása (ClawSwarm)", value: "create" },
        { name: `Aktív munkamenetek listázása (${sessions.length})`, value: "list" },
        { name: "Raj Intelligencia Demo Futtatása", value: "demo" },
        { name: "Vissza a főmenübe", value: "exit" },
      ],
    },
  ]);

  if (action === "create") {
    const { objective, agents } = await inquirer.prompt([
      {
        type: "input",
        name: "objective",
        message: "Mi a raj közös célja?",
        default: "Tervezd meg és implementálj egy új API-t dokumentációval.",
      },
      {
        type: "checkbox",
        name: "agents",
        message: "Válaszd ki a résztvevő ügynököket:",
        choices: ["Developer", "Researcher", "Architect", "QA", "TechnicalWriter"],
        default: ["Developer", "Researcher"],
      }
    ]);

    const spinner = ora("Raj munkamenet létrehozása...").start();
    try {
      const session = globalSwarmChatManager.createSession(objective, agents);
      spinner.succeed(`Munkamenet létrehozva: ${session.id}`);
      console.log(chalk.dim("\nAz ügynökök mostantól közös kontextusban (ClawSwarm) dolgoznak a cél elérésén."));
      console.log(chalk.dim("A folyamat a Dashboard-on az AgentGraph-on követhető."));
    } catch (e) {
      spinner.fail("Nem sikerült létrehozni a munkamenetet.");
    }
    return swarmMenu();
  }

  if (action === "list") {
    if (sessions.length === 0) {
      console.log(chalk.yellow("\nNincs aktív raj munkamenet."));
    } else {
      console.log(chalk.cyan("\nAktív munkamenetek:"));
      sessions.forEach(s => {
        console.log(chalk.white(`- ${chalk.bold(s.id)}: ${s.objective}`));
        console.log(chalk.dim(`  Résztvevők: ${s.participants.join(', ')} | Státusz: ${s.status}`));
      });
    }
    console.log("");
    return swarmMenu();
  }

  if (action === "demo") {
    console.log(chalk.yellow("\nRaj Intelligencia Demo (Minta folyamat):"));
    console.log(chalk.dim("1. Researcher: Adatgyűjtés a témában..."));
    console.log(chalk.dim("2. Architect: Struktúra tervezése a Researcher adatai alapján..."));
    console.log(chalk.dim("3. Developer: Implementáció a terv szerint..."));
    console.log(chalk.green("\nA valós implementációhoz használd az 'Új Raj Munkamenet' opciót."));
    console.log("");
    return swarmMenu();
  }
}
