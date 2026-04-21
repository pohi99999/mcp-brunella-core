 

import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { BrunellaClient } from "@packages/utils/mcpClient.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { logDebug } from "@packages/utils/logger.js";
import { writeLine } from '@packages/utils/cliOutput.js';

type AgentResponse = {
  status: "success" | "error" | "delegated";
  data?: unknown;
  error?: string;
};

type MicroTask = {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeoutMs: number;
};

type DecompositionResult = {
  originalTask: string;
  tasks: MicroTask[];
  dag: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string }>;
  };
};

type McpToolResponse = {
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isMcpToolResponse(v: unknown): v is McpToolResponse {
  if (!isRecord(v)) return false;
  if (v.content == null) return true;
  return Array.isArray(v.content);
}

function isMicroTask(v: unknown): v is MicroTask {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.agent === "string" &&
    typeof v.task === "string" &&
    Array.isArray(v.dependencies) &&
    typeof v.parallel === "boolean" &&
    typeof v.retries === "number" &&
    typeof v.timeoutMs === "number"
  );
}

function isDecompositionResult(v: unknown): v is DecompositionResult {
  if (!isRecord(v)) return false;
  if (typeof v.originalTask !== "string") return false;
  if (!Array.isArray(v.tasks) || !v.tasks.every(isMicroTask)) return false;
  if (!isRecord(v.dag)) return false;
  if (!Array.isArray(v.dag.nodes) || !Array.isArray(v.dag.edges)) return false;
  return true;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    logDebug("TaskDecomposer", `Task decomposition JSON parse failed: ${ensureError(error).message}`);
    return null;
  }
}

export function registerTaskDecomposerCommands(program: Command) {
  program
    .command("decompose [task]")
    .description("Task Decomposer (preview) - mikro-taskokra bontás")
    .option("--agent <name>", "Default agent name (label)", "Developer")
    .option("--json", "Raw JSON output")
    .action(
      async (
        taskArg?: string,
        cmdOpts?: { agent?: string; json?: boolean },
      ) => {
        const opts = cmdOpts ?? {};
        let task = String(taskArg || "").trim();

        if (!task) {
          const answer = await inquirer.prompt([
            {
              type: "input",
              name: "task",
              message: "Komplex feladat:",
            },
          ]);
          task = String(answer.task || "").trim();
        }

        if (!task) {
          console.error(chalk.red("Hiányzó feladat."));
          process.exit(1);
        }

        const client = new BrunellaClient();
        const spinner = ora("Dekomponálás...").start();

        try {
          await client.connect();

          const result = await client.callTool("agent_execute", {
            agentName: "task_decomposer",
            task,
            context: JSON.stringify({
              defaultAgent: String(opts.agent || "Developer"),
            }),
          });

          spinner.stop();

          const text = isMcpToolResponse(result)
            ? result.content?.[0]?.text
            : undefined;
          if (opts.json) {
            writeLine(text || JSON.stringify(result, null, 2));
            return;
          }

          if (!text) {
            writeLine(chalk.yellow("Üres válasz"));
            return;
          }

          const parsed = tryParseJson(text) as AgentResponse | null;
          const resp = parsed && typeof parsed === "object" ? (parsed as AgentResponse) : null;

          if (!resp || resp.status !== "success") {
            writeLine(chalk.red("Hiba:"), resp?.error || text);
            process.exit(1);
          }

          if (!isDecompositionResult(resp.data)) {
            writeLine(chalk.red("Hiba:"), "Érvénytelen dekompozíció válasz");
            process.exit(1);
          }

          const data = resp.data;
          const tasks = data.tasks;

          writeLine(chalk.bold(`\n🧩 Mikro-taskok (${tasks.length}):\n`));
          for (const t of tasks) {
            const deps = (t.dependencies || []).length ? ` ← [${t.dependencies.join(", ")}]` : "";
            const mode = t.parallel ? chalk.cyan("parallel") : chalk.gray("seq");
            writeLine(
              `${chalk.green(t.id)} ${mode} ${chalk.dim(`(${t.agent})`)} ${t.task}${chalk.dim(deps)}`,
            );
          }

          writeLine("");
        } catch (e: unknown) {
          spinner.fail("Sikertelen");
          const msg = e instanceof Error ? e.message : String(e);
          console.error(chalk.red("Error:"), msg);
          process.exit(1);
        } finally {
          await client.close();
          process.exit(0);
        }
      },
    );
}

