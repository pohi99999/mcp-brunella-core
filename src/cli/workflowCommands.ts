 

import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";

const API_BASE = process.env.BRUNELLA_API_URL || process.env.API_BASE_URL || "http://localhost:3000";

async function fetchJson<T>(pathName: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${pathName}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data as T;
}

async function previewTask(task: string, defaultAgent = "Developer"): Promise<void> {
  const response = await fetchJson<{
    success: boolean;
    workflow: { id: string; name: string; nodes: Array<{ id: string; label: string; dependsOn?: string[]; agentName?: string }> };
  }>("/api/v1/tasks/workflow/preview", {
    method: "POST",
    body: JSON.stringify({ task, defaultAgent }),
  });

  console.log(chalk.bold.magenta(`\n🔷 Workflow Preview: ${response.workflow.name}\n`));
  response.workflow.nodes.forEach((node) => {
    console.log(`  ${chalk.white(node.id)} ${node.label}`);
    console.log(`    Agent: ${chalk.gray(node.agentName || "auto")} | DependsOn: ${chalk.gray((node.dependsOn || []).join(", ") || "—")}`);
  });
  console.log("");
}

/**
 * Optional Copilot orchestration stub: if enabled, this can notify Copilot CLI about workflow execution.
 */
import { copilotBridgeState } from "../core/copilotBridgeState.js";
let copilotOrchestrationEnabled = false;

async function runTask(task: string, defaultAgent = "Developer", copilotOrchestrate = false): Promise<void> {
  if (copilotOrchestrate) {
    copilotOrchestrationEnabled = true;
    // Dinamikus agent dispatch naplózása Copilot Bridge-be
    copilotBridgeState.addDispatch({
      agentName: defaultAgent,
      task,
      status: 'queued',
      result: undefined
    });
    console.log(chalk.cyan("[Copilot Orchestration] Workflow orchestration enabled. Dispatch naplózva."));
  }
  const response = await fetchJson<{
    success: boolean;
    result: { status: string; durationMs: number; completedNodeIds: string[]; warnings: string[] };
  }>("/api/v1/tasks/workflow/run", {
    method: "POST",
    body: JSON.stringify({ task, defaultAgent }),
  });

  console.log(chalk.bold.green("\n✅ Workflow futás kész\n"));
  console.log(`  Status:      ${response.result.status}`);
  console.log(`  Időtartam:   ${response.result.durationMs} ms`);
  console.log(`  Node-ok:     ${response.result.completedNodeIds.join(", ") || "—"}`);
  console.log(`  Warnings:    ${response.result.warnings.join(" | ") || "nincs"}\n`);
}

async function showStatus(): Promise<void> {
  const response = await fetchJson<{ workflows: Array<{ id: string; name: string; status: string; nodeCount: number; durationMs?: number; startedAt: string }> }>("/api/v1/tasks/workflow/status");
  console.log(chalk.bold.blue("\n📈 Workflow státuszok\n"));
  if (response.workflows.length === 0) {
    console.log(chalk.gray("  Még nincs workflow futás.\n"));
    return;
  }

  response.workflows.forEach((workflow) => {
    console.log(`  ${chalk.bold(workflow.name)} (${workflow.id})`);
    console.log(`    Status: ${workflow.status} | Node-ok: ${workflow.nodeCount} | Duration: ${workflow.durationMs ?? 0} ms`);
    console.log(`    Start:  ${workflow.startedAt}\n`);
  });
}

export function registerWorkflowCommands(program: Command): void {
  const workflow = program.command("workflow").description("DAG workflow orchestráció parancsok");

  workflow
    .command("preview")
    .description("Workflow preview generálása egy taskból")
    .argument("<task>", "Task szöveg")
    .option("--agent <agent>", "Default agent", "Developer")
    .option("--copilot-orchestrate", "Enable Copilot CLI orchestration")
    .action(async (task: string, options: { agent: string; copilotOrchestrate?: boolean }) => {
      await previewTask(task, options.agent);
      if (options.copilotOrchestrate) {
        console.log(chalk.cyan("[Copilot Orchestration] Preview mode: Copilot orchestration would be triggered here."));
      }
    });

  workflow
    .command("run")
    .description("Workflow futtatása egy taskból")
    .argument("<task>", "Task szöveg")
    .option("--agent <agent>", "Default agent", "Developer")
    .option("--copilot-orchestrate", "Enable Copilot CLI orchestration")
    .action(async (task: string, options: { agent: string; copilotOrchestrate?: boolean }) => {
      await runTask(task, options.agent, options.copilotOrchestrate);
    });

  workflow
    .command("status")
    .description("Workflow futási állapotok listája")
    .action(async () => {
      await showStatus();
    });

  workflow.action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Workflow menü:",
        choices: [
          { name: "🔍 Preview task → DAG", value: "preview" },
          { name: "▶ Workflow futtatás", value: "run" },
          { name: "📈 Futási állapotok", value: "status" },
          { name: "❌ Kilépés", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") return;
    if (action === "status") {
      await showStatus();
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "task",
        message: "Task leírás:",
        validate: (value: string) => value.trim().length > 0 || "Adj meg egy feladatot.",
      },
      {
        type: "input",
        name: "agent",
        message: "Default agent:",
        default: "Developer",
      },
    ]);

    if (action === "preview") await previewTask(answers.task, answers.agent);
    if (action === "run") await runTask(answers.task, answers.agent);
  });
}
