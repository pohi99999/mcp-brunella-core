import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { agentManager } from "../../agents/AgentManager.js";

export async function innovateCommand() {
  console.log(
    boxen(chalk.cyan.bold("🌉 Brunella Innovation Bridge"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "cyan",
    })
  );

  const { problem } = await inquirer.prompt([
    {
      type: "input",
      name: "problem",
      message: "Írd le a technikai problémát, amit meg szeretnél oldani:",
      validate: (input) => (input.trim() ? true : "A leírás nem lehet üres!"),
    },
  ]);

  const spinner = ora("TRIZ elemzés és kereszt-iparági kutatás folyamatban...").start();

  try {
    const result = await agentManager.delegate("InnovationBridge", problem);
    spinner.stop();

    if (typeof result === "object" && result !== null) {
      const res = result as any;
      
      if (res.success) {
        console.log(chalk.green.bold("\n✅ Innovációs riport elkészült!\n"));
        
        if (res.data?.trizAnalysis) {
          console.log(chalk.yellow.bold("--- Technikai Ellentmondás ---"));
          console.log(`Javítandó: ${chalk.green(res.data.trizAnalysis.improvedParam)}`);
          console.log(`Romló:     ${chalk.red(res.data.trizAnalysis.worsenedParam)}`);
          console.log(`Indoklás:  ${res.data.trizAnalysis.reasoning}\n`);
        }

        if (res.data?.suggestedPrinciples) {
          console.log(chalk.blue.bold("--- Javasolt TRIZ Alapelvek ---"));
          res.data.suggestedPrinciples.forEach((p: any) => {
            console.log(`${chalk.cyan(p.id + ". " + p.name)}: ${p.description}`);
          });
          console.log("");
        }

        if (res.data?.swarmResults) {
          console.log(chalk.magenta.bold("--- Kereszt-iparági Analógiák ---"));
          res.data.swarmResults.forEach((r: any, i: number) => {
            console.log(chalk.gray(`[Analógia #${i + 1}]`));
            console.log(`${typeof r === 'string' ? r : r.message}\n`);
          });
        }
      } else {
        console.log(chalk.red.bold("\n❌ Hiba történt: ") + res.message);
      }
    }
  } catch (error) {
    spinner.fail("Hiba az innovációs folyamat során.");
    console.error(chalk.red(error));
  }
}
