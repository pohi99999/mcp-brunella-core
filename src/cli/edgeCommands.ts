import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { cloudflareClient } from "../utils/cloudflareClient.js";

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
            `URL: ${cloudflareClient.getResolvedBaseUrl()}`,
          ),
        );
      } catch (error: unknown) {
        spinner.fail(chalk.red("Edge Worker is Offline or Unreachable"));
        console.error(chalk.red(getErrorMessage(error)));
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
      } catch (error: unknown) {
        spinner.fail(chalk.red("Task Failed"));
        console.error(chalk.red(getErrorMessage(error)));
      }
    });

  edgeGroup
    .command("submit-worker <workerId> <instruction>")
    .description("Submit a task to a specific Cloudflare worker")
    .option("-c, --context <json>", "Context JSON string")
    .action(
      async (
        workerId: string,
        instruction: string,
        options: { context?: string },
      ) => {
        const spinner = ora(`Submitting task to worker '${workerId}'...`).start();

        try {
          let context = {};
          if (options.context) {
            try {
              context = JSON.parse(options.context);
            } catch {
              console.warn(chalk.yellow("Invalid JSON context, ignoring."));
            }
          }

          const response = await fetch(
            `${API_BASE}/api/cloudflare/agents/${encodeURIComponent(workerId)}/task`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ instruction, context }),
            },
          );

          const data = (await response.json()) as {
            success: boolean;
            workerId: string;
            workerName: string;
            endpoint?: string;
            result?: unknown;
            error?: string;
          };

          if (!response.ok || !data.success) {
            throw new Error(data.error || `HTTP ${response.status}`);
          }

          spinner.succeed(
            chalk.green(`Task dispatched to ${data.workerName} (${data.workerId})`),
          );

          if (data.endpoint) {
            console.log(chalk.dim(`Endpoint: ${data.endpoint}`));
          }
          if (typeof data.result === "string") {
            console.log(chalk.bold("\nResult:"));
            console.log(data.result);
          } else if (typeof data.result !== "undefined") {
            console.log(chalk.bold("\nResult:"));
            console.log(JSON.stringify(data.result, null, 2));
          }
        } catch (error: unknown) {
          spinner.fail(chalk.red("Worker task dispatch failed"));
          console.error(chalk.red(getErrorMessage(error)));
        }
      },
    );

  edgeGroup
    .command("history")
    .description("View task history")
    .option("-l, --limit <number>", "Number of tasks to show", "10")
    .action(async (options: { limit: string }) => {
      const limit = parseInt(options.limit, 10);
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
      } catch (error: unknown) {
        spinner.fail(chalk.red("Failed to fetch history"));
        console.error(chalk.red(getErrorMessage(error)));
      }
    });

  edgeGroup
    .command("audit")
    .description("Audit all configured Cloudflare workers")
    .action(async () => {
      const spinner = ora("Running Cloudflare workers audit...").start();

      try {
        const response = await fetch(`${API_BASE}/api/cloudflare/agents`);
        const data = (await response.json()) as {
          status: "connected" | "degraded" | "error";
          summary: { total: number; online: number; offline: number; unknown: number };
          workers: Array<{
            id: string;
            name: string;
            url?: string;
            kind: "public" | "internal";
            status: "online" | "offline" | "unknown";
            latencyMs?: number;
            statusCode?: number;
            error?: string;
          }>;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        spinner.succeed(chalk.green(`Audit completed: ${data.status.toUpperCase()}`));

        console.log(
          chalk.dim(
            `\nSummary: total=${data.summary.total}, online=${data.summary.online}, offline=${data.summary.offline}, unknown=${data.summary.unknown}`,
          ),
        );

        for (const worker of data.workers) {
          const statusColor =
            worker.status === "online"
              ? chalk.green
              : worker.status === "offline"
                ? chalk.red
                : chalk.yellow;
          const latencyText =
            typeof worker.latencyMs === "number" ? ` (${worker.latencyMs}ms)` : "";
          const kindText = worker.kind === "public" ? "public" : "internal";

          console.log(
            `${statusColor(worker.status.toUpperCase())} ${chalk.bold(worker.name)} [${kindText}]${latencyText}`,
          );
          console.log(chalk.dim(`  url: ${worker.url || "(not configured)"}`));
          if (typeof worker.statusCode === "number") {
            console.log(chalk.dim(`  http: ${worker.statusCode}`));
          }
          if (worker.error) {
            console.log(chalk.dim(`  note: ${worker.error}`));
          }
        }
      } catch (error: unknown) {
        spinner.fail(chalk.red("Cloudflare workers audit failed"));
        console.error(chalk.red(getErrorMessage(error)));
      }
    });

  edgeGroup
    .command("tunnel")
    .description("Show tunnel and Cloudflare runtime configuration")
    .action(async () => {
      const spinner = ora("Loading Cloudflare tunnel config...").start();

      try {
        const response = await fetch(`${API_BASE}/api/cloudflare/config`);
        const data = (await response.json()) as {
          edge: { enabled: boolean; workerUrl: string };
          chat: { url: string };
          tunnel: {
            enabled: boolean;
            apiUrl: string | null;
            n8nUrl: string | null;
            browserUrl: string | null;
            browserEndpoint: string;
            dashboardUrl: string | null;
          };
          auth: {
            hasCloudflareApiToken: boolean;
            hasCeanApiKey: boolean;
          };
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        spinner.succeed(chalk.green("Cloudflare runtime config loaded"));

        console.log(chalk.bold("\nEdge"));
        console.log(chalk.dim(`  enabled: ${data.edge.enabled}`));
        console.log(chalk.dim(`  worker:  ${data.edge.workerUrl}`));

        console.log(chalk.bold("\nChat"));
        console.log(chalk.dim(`  url:     ${data.chat.url}`));

        console.log(chalk.bold("\nTunnel"));
        console.log(chalk.dim(`  enabled: ${data.tunnel.enabled}`));
        console.log(chalk.dim(`  api:     ${data.tunnel.apiUrl || "(not set)"}`));
        console.log(chalk.dim(`  n8n:     ${data.tunnel.n8nUrl || "(not set)"}`));
        console.log(chalk.dim(`  browser: ${data.tunnel.browserUrl || "(not set)"}`));
        console.log(chalk.dim(`  browser endpoint: ${data.tunnel.browserEndpoint}`));
        console.log(chalk.dim(`  dashboard: ${data.tunnel.dashboardUrl || "(not set)"}`));

        console.log(chalk.bold("\nAuth"));
        console.log(
          chalk.dim(
            `  cloudflare token: ${data.auth.hasCloudflareApiToken ? "configured" : "missing"}`,
          ),
        );
        console.log(
          chalk.dim(
            `  CEAN api key:      ${data.auth.hasCeanApiKey ? "configured" : "missing"}`,
          ),
        );
      } catch (error: unknown) {
        spinner.fail(chalk.red("Failed to load tunnel config"));
        console.error(chalk.red(getErrorMessage(error)));
      }
    });
}
