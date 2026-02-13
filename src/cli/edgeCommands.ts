import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { cloudflareClient } from "../utils/cloudflareClient.js";

export function registerEdgeCommands(program: Command) {
  const edgeGroup = program
    .command("edge")
    .description("Manage Cloudflare Edge integration (Tasks, Status)");

  edgeGroup
    .command("status")
    .description("Check Edge Worker status")
    .action(async () => {
      const spinner = ora("Checking Edge status...").start();
      try {
        // Perform a simple check by fetching history with limit 1
        await cloudflareClient.fetchHistory(1);
        spinner.succeed(chalk.green("Edge Worker is Online"));
        console.log(
          chalk.dim(
            `URL: ${
              process.env.CLOUDFLARE_WORKER_URL ||
              "https://bas-orchestrator.iam-dd1.workers.dev"
            }`,
          ),
        );
      } catch (error: any) {
        spinner.fail(chalk.red("Edge Worker is Offline or Unreachable"));
        console.error(chalk.red(error.message));
      }
    });

  edgeGroup
    .command("submit <instruction>")
    .description("Submit a task to the Edge")
    .option("-c, --context <json>", "Context JSON string")
    .action(async (instruction: string, options: { context?: string }) => {
      const spinner = ora("Submitting task to Edge...").start();
      try {
        let context = {};
        if (options.context) {
          try {
            context = JSON.parse(options.context);
          } catch {
            console.warn(chalk.yellow("Invalid JSON context, ignoring."));
          }
        }

        const result = await cloudflareClient.submitTask(instruction, context);
        spinner.succeed(chalk.green("Task Completed"));

        console.log(chalk.bold("\nResult:"));
        if (typeof result.result === "string") {
          console.log(result.result);
        } else {
          console.log(JSON.stringify(result.result, null, 2));
        }
        console.log(chalk.dim(`\nTask ID: ${result.taskId}`));
      } catch (error: any) {
        spinner.fail(chalk.red("Task Failed"));
        console.error(chalk.red(error.message));
      }
    });

  edgeGroup
    .command("history")
    .description("View task history")
    .option("-l, --limit <number>", "Number of tasks to show", "10")
    .action(async (options: { limit: string }) => {
      const limit = parseInt(options.limit);
      const spinner = ora(`Fetching last ${limit} tasks...`).start();
      try {
        const data = await cloudflareClient.fetchHistory(limit);
        spinner.stop();

        if (!data.tasks || data.tasks.length === 0) {
          console.log(chalk.yellow("No history found."));
          return;
        }

        console.log(chalk.bold(`\nEdge Task History (${data.tasks.length}):`));
        data.tasks.forEach((task: any) => {
          const date = new Date(task.created_at).toLocaleString();
          const statusColor =
            task.status === "completed"
              ? chalk.green
              : task.status === "failed"
                ? chalk.red
                : chalk.yellow;
          console.log(
            `${chalk.dim(task.id.slice(0, 8))} [${statusColor(
              task.status,
            )}] ${date} - ${task.instruction.slice(0, 50)}${
              task.instruction.length > 50 ? "..." : ""
            }`,
          );
        });
      } catch (error: any) {
        spinner.fail(chalk.red("Failed to fetch history"));
        console.error(chalk.red(error.message));
      }
    });
}
