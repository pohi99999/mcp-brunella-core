#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { configManager } from "@packages/utils/cliConfig.js";
import { BrunellaClient } from "@packages/utils/mcpClient.js";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import inquirer from "inquirer";
import ora from "ora";
import {
  initTelemetryFromConfig,
  recordSessionStart,
  flushTelemetry,
  recordToolCall,
  isTelemetryEnabled,
} from "@packages/utils/telemetry.js";
import { getMemory } from "@packages/utils/memoryContext.js";
import { discoverSkills } from "@packages/utils/skillsLoader.js";
import { listHooks } from "@packages/utils/hooks.js";
import { registerHookCommands } from "./hooksCommands.js";
import { logDebug } from "@packages/utils/logger.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { startInteractiveMenu } from "./interactive.js";
import { cloudflareClient } from "@packages/utils/cloudflareClient.js";
import { registerGoldCommands } from "./goldCommands.js";
import { registerDevCommands } from "./devCommands.js";
import { registerTracksCommands } from "./tracksCommands.js";
import { registerTaskDecomposerCommands } from "./taskDecomposerCommands.js";
import { registerProgressCommands } from "./progressCommands.js";
import { registerEdgeCommands } from "./edgeCommands.js";
import { registerSuggestedTasksCommands } from "./suggestedTasksCommands.js";
import { registerRobotkezCommands } from "./robotkezCommands.js";
import { registerConductorCommands } from "./conductorCommands.js";
import { registerInvoiceCommands } from "./invoiceCommands.js";
import { registerLeadCommands } from "./leadCommands.js";
import { registerMarketCommands } from "./marketCommands.js";
import { registerWorkspaceCommands } from "./workspaceCommands.js";
import { dashboardCommand } from "./dashboardCommands.js";
import { registerSdlcCommands } from "./sdlcCommands.js";
import { registerTaskCommands } from "./taskCommands.js";
import { registerBrowserCopilotCommands } from "./browserCopilotCommands.js";
import { registerCrawl4aiCommands } from "./crawl4aiCommands.js";
import { registerBookkeepingCommands } from "./bookkeepingCommands.js";
import { registerPalyazatCommands } from "./palyazatCommands.js";
import { registerHROnboardingCommands } from "./hrOnboardingCommands.js";
import { registerPropertySalesCommands } from "./propertySalesCommands.js";
import { registerGuardrailsCommands, registerTelemetryCommands } from "./guardrailsCommands.js";
import { registerMemoriaCommands } from "./memoriaCommands.js";
import { registerMemoryCommands } from "./memoryCommands.js";
import { registerIntelligenceCommands } from "./intelligenceCommands.js";
import { registerPredictiveDecisionCommands } from "./predictiveDecisionCommands.js";
import { registerLearningLoopCommands } from "./learningLoopCommands.js";
import { registerSelfModificationCommands } from "./selfModificationCommands.js";
import { registerWorldPerceptionCommands } from "./worldPerceptionCommands.js";
import { registerObservabilityCommands } from "./observabilityCommands.js";
import { registerDevExCommands } from "./devexCommands.js";
import { registerAgentGovernanceCommands } from "./agentGovernanceCommands.js";
import { registerDocsConfigCommands } from "./docsConfigCommands.js";
import { registerFederationCommands } from "./federationCommands.js";
import { registerInventoryCommands } from "./inventoryCommands.js";
import { registerKkvPackCommands } from "./kkvPackCommands.js";
import { registerKkvFinanceCommands } from "./kkvFinanceCommands.js";
import { registerProjectMaintainerCommands } from "./projectMaintainerCommands.js";
import { registerBriefingCommands } from "./briefingCommands.js";
import { registerExternalKnowledgeCommands } from "./externalKnowledgeCommands.js";
import { registerHeygenCommands } from "./heygenCommands.js";
import { registerStudioCommands } from "./studioCommands.js";
import { registerChaosCommands } from "./chaosCommands.js";
import { registerWorkflowCommands } from "./workflowCommands.js";
import { registerSwarmCommands } from "./swarmCommands.js";
import { registerToolDiscoveryCommands } from "./toolDiscoveryCommands.js";
import { registerSecurityCommands } from "./securityCommands.js";
import { registerChromeAcpCommands } from "./chromeAcpCommands.js";
import { registerReadinessCommands } from "./readinessCommands.js";
import { createOpenClawCliHandlers, formatOpenClawCliPayload } from "./openclawCommands.js";
import { validateAndNormalizeRegistry } from "@packages/agents/registryValidation.js";
import { getAssistantBlueprint, type AssistantBlueprint, type AssistantReadinessStatus } from "@packages/core-logic/assistantBlueprint.js";
import { getPrebuiltToolCatalog, mergeToolLists, type ToolLike } from "@packages/utils/prebuiltTools.js";
import { writeLine } from '@packages/utils/cliOutput.js';

marked.setOptions({ renderer: new TerminalRenderer() });

const program = new Command();
const openClawHandlers = createOpenClawCliHandlers();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_MCP_CONNECT_TIMEOUT_MS = Number(process.env.BRUNELLA_MCP_CONNECT_TIMEOUT_MS || "30000");

type WorkflowRunRecord = {
  status?: string;
  conclusion?: string;
  updated_at?: string;
  created_at?: string;
  run_number?: number | string;
  id?: string;
  duration?: string | number;
  passed?: number;
  failed?: number;
  startedAt: string | number;
};

// Try to read package.json version
let version = "0.0.0";
try {
  // Try relative to build location first, then src
  let pkgPath = join(__dirname, "../package.json");
  if (!existsSync(pkgPath)) pkgPath = join(__dirname, "../../package.json");

  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    version = pkg.version;
  }
} catch (error: unknown) { /* non-critical */ }

const rawArgs = process.argv.slice(2);
const showBanner =
  !rawArgs.some(
    (a) => a === "--version" || a === "-V" || a === "--help" || a === "-h",
  ) && !(configManager.get("ui.hideBanner") as boolean);

if (showBanner && rawArgs.length > 0) {
  writeLine(
    boxen(chalk.blue("Brunella CLI") + ` v${version}`, {
      padding: 1,
      borderStyle: "round",
    }),
  );
}

// Telemetry from config (nested settings.telemetry)
try {
  const all = configManager.getAll() as {
    telemetry?: { enabled?: boolean; target?: string };
    serverUrl?: string;
  };
  initTelemetryFromConfig(all);
  if (all?.telemetry?.enabled) {
    recordSessionStart({
      cli_version: version,
      server_url: String(all.serverUrl ?? configManager.get("serverUrl") ?? ""),
    });
  }
} catch (error: unknown) { /* non-critical */ }
process.on("beforeExit", () => {
  flushTelemetry();
});

function assistantStatusColor(status: AssistantReadinessStatus) {
  if (status === "ready") return chalk.green;
  if (status === "partial") return chalk.yellow;
  return chalk.gray;
}

function assistantStatusLabel(status: AssistantReadinessStatus): string {
  if (status === "ready") return "KÉSZ";
  if (status === "partial") return "RÉSZBEN KÉSZ";
  return "TERVEZETT";
}

function printAssistantSummary(blueprint: AssistantBlueprint): void {
  writeLine(
    boxen(chalk.cyan("Brunella Personal Assistant"), {
      padding: 1,
      borderStyle: "round",
      borderColor: "cyan",
    }),
  );

  writeLine(chalk.bold("Célplatform:"), blueprint.targetPlatform);
  writeLine(chalk.bold("MVP readiness:"), `${blueprint.overallReadiness.score}% · ${blueprint.overallReadiness.label}`);
  writeLine(chalk.bold("Ajánlott működés:"), `${blueprint.recommendedMode.primaryCloudProvider} → ${blueprint.recommendedMode.localFallbackProvider}`);
  writeLine(chalk.bold("Desktop shell:"), blueprint.recommendedMode.desktopShell);
  writeLine(`\n${blueprint.overallReadiness.summary}`);

  writeLine(chalk.cyan("\nKépesség állapotok:"));
  blueprint.capabilities.forEach((capability) => {
    const color = assistantStatusColor(capability.status);
    writeLine(`  - ${chalk.bold(capability.title)} :: ${color(assistantStatusLabel(capability.status))} (${capability.score}%)`);
  });

  if (blueprint.providerHealth.length > 0) {
    writeLine(chalk.cyan("\nProvider health:"));
    blueprint.providerHealth.forEach((provider) => {
      const state = provider.available ? chalk.green("online") : chalk.red("offline");
      const latency = typeof provider.response_time_ms === "number" ? ` · ${provider.response_time_ms} ms` : "";
      writeLine(`  - ${provider.provider}: ${state}${latency}`);
    });
  }

  writeLine(chalk.cyan("\nAzonnali következő lépések:"));
  blueprint.nextActions.forEach((step) => writeLine(`  • ${step}`));
}

function printAssistantArchitecture(blueprint: AssistantBlueprint): void {
  writeLine(chalk.cyan("\nAjánlott architektúra:"));
  blueprint.architecture.forEach((layer, index) => {
    writeLine(`\n${chalk.bold(`${index + 1}. ${layer.title}`)}`);
    writeLine(`   ${layer.summary}`);
    writeLine(`   Cél: ${layer.purpose}`);
    writeLine(`   Modulok: ${layer.modules.join(", ")}`);
    if (layer.nextUpgrade) {
      writeLine(chalk.dim(`   Következő upgrade: ${layer.nextUpgrade}`));
    }
  });
}

function printAssistantRoadmap(blueprint: AssistantBlueprint): void {
  writeLine(chalk.cyan("\nRoadmap:"));
  blueprint.roadmap.forEach((phase) => {
    writeLine(`\n${chalk.bold(`${phase.id} — ${phase.title}`)}`);
    writeLine(`   Cél: ${phase.goal}`);
    phase.deliverables.forEach((deliverable) => writeLine(`   • ${deliverable}`));
  });
}

async function getCloudflareClient() {
  const { cloudflareClient } = await import("@packages/utils/cloudflareClient.js");
  return cloudflareClient;
}

function printFusionCard( blueprint: AssistantBlueprint ): void {
  const card = blueprint.fusionCard;
  if ( !card ) {
    writeLine( chalk.dim( "\nFúziós kontextus adat nem elérhető." ) );
    return;
  }
  writeLine(
    boxen( chalk.magenta( "Fúziós Kontextus Összefoglaló" ), {
      padding: 1,
      borderStyle: "round",
      borderColor: "magenta",
    } ),
  );
  if ( card.graphRag ) {
    writeLine(
      chalk.bold( "📊 GraphRAG:" ),
      `${card.graphRag.nodes} entitás, ${card.graphRag.edges} kapcsolat, ${card.graphRag.lessons} tanulság`,
    );
  }
  if ( card.reflection ) {
    const qualityPct = ( card.reflection.avgQualityScore * 100 ).toFixed( 0 );
    writeLine(
      chalk.bold( "🔄 Reflexió:" ),
      `${card.reflection.totalReflections} ciklus, átlag minőség ${qualityPct}%, self-model: ${card.reflection.selfModelHealth}`,
    );
  }
  if ( card.memory ) {
    writeLine(
      chalk.bold( "💾 Memória:" ),
      `${card.memory.indexedDocuments} indexelt dokumentum (LanceDB)`,
    );
  }
  if ( card.fusionPrompt ) {
    writeLine( chalk.cyan( "\nFúziós prompt snippet:" ) );
    writeLine( chalk.dim( card.fusionPrompt.slice( 0, 400 ) ) );
  }
}

program
  .name("brunella")
  .description("Official CLI for Brunella Core")
  .version(version)
  .option(
    "--approval-mode <mode>",
    "Approval mode: default | auto_edit | plan | yolo",
    "default",
  )
  .option(
    "-s, --sandbox",
    "Enable sandbox mode (see tools.sandbox / BRUNELLA_SANDBOX)",
  );

// --- about (Gemini parity)
program
  .command("about")
  .description("Show version and runtime info")
  .action(() => {
    writeLine(chalk.bold("Brunella CLI"));
    writeLine("  Version:", version);
    writeLine("  Config:  ", configManager.userSettingsPath);
    if (configManager.projectSettingsPath)
      writeLine("  Project: ", configManager.projectSettingsPath);
  });

// --- auth
const authCmd = program.command("auth").description("Manage authentication");
authCmd
  .command("login")
  .description("Log in or change auth method")
  .option("--api-key <key>", "Set API key")
  .action((cmd?: { opts: () => { apiKey?: string } }) => {
    const opts = cmd?.opts?.() ?? {};
    if (opts.apiKey) {
      configManager.set("apiKey", opts.apiKey);
      configManager.set("security.auth.selectedType", "api_key");
      writeLine(chalk.green("API key saved."));
      return;
    }
    writeLine(
      chalk.dim(
        "Auth: use --api-key <key> or set BRUNELLA_API_KEY. For OAuth, use backend login.",
      ),
    );
  });

// --- doctor
program
  .command("doctor")
  .description("Run system diagnostics")
  .action(async () => {
    writeLine(chalk.bold("🩺 Brunella Doctor"));

    // Check Node
    writeLine(`✔ Node: ${process.version}`);

    // Check Server Connection
    const client = new BrunellaClient();
    try {
      await client.connect({ coreOnly: true, timeoutMs: 1200 });
      writeLine(chalk.green("✔ Server: Connected"));
      writeLine(chalk.green("✔ MCP: Core transport reachable"));
    } catch (error: unknown) {
      writeLine(chalk.red(`✖ Server: Connection failed (${ensureError(error).message})`));
    } finally {
      await client.close();
    }
  });

// --- connect (MCP)
program
  .command("connect <serverName>")
  .description("Connect to an external MCP server (github, chrome, docker)")
  .action(async (serverName: string) => {
    writeLine(chalk.cyan(`Connecting to ${serverName}...`));
    writeLine(chalk.dim("Feature coming soon: Dynamic MCP config update."));
    writeLine(
      chalk.dim(
        `Please add '${serverName}' manually to mcp_servers.json for now.`,
      ),
    );
  });

// --- tools
program
  .command("tools")
  .description("List available MCP tools")
  .action(async () => {
    const client = new BrunellaClient();
    const fallbackTools = getPrebuiltToolCatalog();
    try {
      await client.connect({ coreOnly: true });
      const result = await client.listTools();
      const tools = mergeToolLists(result.tools as ToolLike[], fallbackTools);

      writeLine(chalk.bold(`Available Tools (${tools.length}):`));
      for (const tool of tools) {
        writeLine(
          chalk.green("• " + tool.name) +
            (tool.description ? ": " + chalk.dim(tool.description) : ""),
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (fallbackTools.length > 0) {
        writeLine(chalk.yellow("MCP kapcsolat nem elérhető, helyi tools.json fallback használata."));
        writeLine(chalk.bold(`Available Tools (${fallbackTools.length}):`));
        for (const tool of fallbackTools) {
          writeLine(
            chalk.green("• " + tool.name) +
              (tool.description ? ": " + chalk.dim(tool.description) : ""),
          );
        }
      } else {
        console.error(chalk.red("Error fetching tools:"), message);
      }
    } finally {
      await client.close();
    }
  });

// --- agents (list)
program
  .command("agents")
  .description("List all registered AI agents")
  .action(async () => {
    const client = new BrunellaClient();
    try {
      await client.connect({ coreOnly: true, timeoutMs: CLI_MCP_CONNECT_TIMEOUT_MS });
      // Use the agent_list tool
      const result = await client.callTool("agent_list", {});
      // @ts-expect-error content might be missing The result from agent_list tool might not have 'content[0].text'.
      const text = result.content?.[0]?.text;
      if (text) {
        writeLine(chalk.bold("Registered Agents:"));
        writeLine(text);
      } else {
        writeLine(
          chalk.yellow("No agents found or tool returned empty result."),
        );
      }
    } catch (error: unknown) {
      console.error(chalk.red("Error fetching agents:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

program
  .command("agent-diagnostics")
  .description("Registry validáció és agent loader diagnosztika")
  .option("--json", "Nyers JSON kimenet")
  .action(async (cmd?: { json?: boolean }) => {
    const registryCandidates = [
      join(process.cwd(), "build", "agents", "registry.json"),
      join(process.cwd(), "src", "agents", "registry.json"),
    ];

    const registryPath = registryCandidates.find((candidate) => existsSync(candidate));
    if (!registryPath) {
      console.error(chalk.red("Nem található registry.json sem a build, sem a src mappában."));
      process.exit(1);
    }

    const rawRegistry = JSON.parse(readFileSync(registryPath, "utf-8")) as unknown;
    const localValidation = validateAndNormalizeRegistry(rawRegistry);

    let runtimeDiagnostics: unknown = null;
    try {
      const response = await fetch("http://localhost:3000/api/agents/diagnostics");
      if (response.ok) {
        runtimeDiagnostics = await response.json();
      }
    } catch (error: unknown) {
      logDebug("BrunellaCLI", `Diagnostics fetch skipped: ${ensureError(error).message}`);
      runtimeDiagnostics = null;
    }

    if (cmd?.json) {
      writeLine(JSON.stringify({ localValidation, runtimeDiagnostics }, null, 2));
      process.exit(0);
    }

    writeLine(boxen(chalk.blue("Agent diagnosztika"), {
      padding: 1,
      borderStyle: "round",
      borderColor: localValidation.report.valid ? "green" : "yellow",
    }));

    writeLine(chalk.bold("Registry forrás:"), registryPath);
    writeLine(chalk.bold("Agentek száma:"), localValidation.report.summary.totalAgents);
    writeLine(chalk.bold("Default agent:"), localValidation.report.summary.defaultAgent);
    writeLine(chalk.bold("Schema állapot:"), localValidation.report.valid ? chalk.green("VALID") : chalk.yellow("FIGYELMET KÉR"));

    if (localValidation.report.errors.length > 0) {
      writeLine(chalk.red("\nHibák:"));
      localValidation.report.errors.forEach((error) => writeLine(`  - ${error}`));
    }

    if (localValidation.report.warnings.length > 0) {
      writeLine(chalk.yellow("\nFigyelmeztetések:"));
      localValidation.report.warnings.forEach((warning) => writeLine(`  - ${warning}`));
    }

    if (runtimeDiagnostics && typeof runtimeDiagnostics === "object") {
      const diagnosticsRecord = runtimeDiagnostics as {
        agents?: Array<{
          name: string;
          loadStatus: string;
          runtime: { status: string };
          resolutionStrategy?: string;
        }>;
      };
      writeLine(chalk.cyan("\nÉlő loader állapot (http://localhost:3000):"));
      for (const agent of diagnosticsRecord.agents ?? []) {
        writeLine(
          `  - ${chalk.bold(agent.name)} :: load=${agent.loadStatus}, runtime=${agent.runtime.status}, strategy=${agent.resolutionStrategy ?? "-"}`,
        );
      }
    } else {
      writeLine(chalk.dim("\nÉlő backend diagnosztika nem volt elérhető a 3000-es porton."));
    }

    process.exit(0);
  });

program
  .command("assistant")
  .description("Windows személyi AI asszisztens blueprint és readiness áttekintése")
  .option("--json", "Nyers JSON kimenet")
  .action(async (cmd?: { json?: boolean }) => {
    const spinner = ora("Assistant blueprint elemzése...").start();
    try {
      const blueprint = await getAssistantBlueprint();
      spinner.stop();

      if (cmd?.json) {
        writeLine(JSON.stringify(blueprint, null, 2));
        return;
      }

      const { view } = await inquirer.prompt<{ view: "summary" | "architecture" | "roadmap" | "fusion" | "all" }>([
        {
          type: "list",
          name: "view",
          message: "Mit szeretnél megnézni az assistant tervből?",
          choices: [
            { name: "Összefoglaló és readiness", value: "summary" },
            { name: "Ajánlott architektúra", value: "architecture" },
            { name: "Roadmap", value: "roadmap" },
            { name: "Fúziós kontextus összefoglaló", value: "fusion" },
            { name: "Mindent", value: "all" },
          ],
        },
      ]);

      if (view === "summary" || view === "all") {
        printAssistantSummary(blueprint);
      }

      if (view === "architecture" || view === "all") {
        printAssistantArchitecture(blueprint);
      }

      if (view === "roadmap" || view === "all") {
        printAssistantRoadmap(blueprint);
      }

      if (view === "fusion" || view === "all") {
        printFusionCard(blueprint);
      }
    } catch (error: unknown) {
      spinner.fail("Assistant blueprint lekérése sikertelen");
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(message));
      process.exit(1);
    }
  });

// --- agent (execute specific agent)
program
  .command("agent <agentName> [task]") // Make task optional if --file is used
  .description("Execute a specific agent with a task")
  .option("--file <path>", "Read task from a file") // New option
  .option("--context <json>", "Context as JSON string")
  .option("--json", "Output raw JSON response")
  .action(
    async (
      agentName: string,
      task: string | undefined, // task can be undefined now
      cmd?: { opts: () => { file?: string; context?: string; json?: boolean } },
    ) => {
      const opts = cmd?.opts?.() ?? {};
      let finalTask: string;

      if (opts.file) {
        try {
          finalTask = readFileSync(opts.file, "utf-8");
        } catch (error: unknown) {
          console.error(chalk.red(`Error reading task file: ${ensureError(error).message}`));
          process.exit(1);
        }
      } else if (task) {
        finalTask = task;
      } else {
        console.error(chalk.red("Error: Task or --file option is required."));
        process.exit(1);
      }

      let context: Record<string, unknown> = {};

      if (opts.context) {
        try {
          context = JSON.parse(opts.context);
        } catch (error: unknown) {
          console.error(chalk.red("Invalid JSON in --context"));
          process.exit(1);
        }
      }

      const spinner = ora(`Executing ${chalk.cyan(agentName)}...`).start();
      const client = new BrunellaClient();

      try {
        await client.connect({ coreOnly: true, timeoutMs: CLI_MCP_CONNECT_TIMEOUT_MS });

        // Call agent_execute tool
        const result = await client.callTool("agent_execute", {
          agentName,
          task: finalTask, // Use finalTask here
          context: JSON.stringify(context),
        });

        spinner.stop();

        if (opts.json) {
          writeLine(JSON.stringify(result, null, 2));
        } else {
          // @ts-expect-error content might be missing The result.content might not be a valid array or might be missing.
          const text = result.content?.[0]?.text;
          if (text) {
            writeLine(chalk.bold(`\n✅ ${agentName} Response:`));
            writeLine(text);
          } else {
            writeLine(chalk.yellow("Agent returned empty response"));
          }
        }
      } catch (error: unknown) {
        spinner.fail(chalk.red(`${agentName} failed`));
        console.error(chalk.red("Error:"), ensureError(error).message);
        process.exitCode = 1;
      } finally {
        await client.close();
        process.exit(0);
      }
    },
  );

// --- run
program
  .command("run <toolName> [args...]")
  .description("Run an MCP tool")
  .option("--json", "Output raw JSON response")
  .action(
    async (
      toolName: string,
      args: string[] = [],
      cmd?: { opts: () => { json?: boolean } },
    ) => {
      const opts = cmd?.opts?.() ?? {};
      const parsedArgs: Record<string, string> = {};

      for (const arg of args || []) {
        const parts = arg.split("=");
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join("=");
          parsedArgs[key] = value;
          } else if (arg.startsWith("{")) {
          try {
            const jsonArg = JSON.parse(arg) as Record<string, unknown>;
            if (jsonArg && typeof jsonArg === "object" && !Array.isArray(jsonArg)) {
              for (const [key, value] of Object.entries(jsonArg)) {
                parsedArgs[key] = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
              }
            }
          } catch (error: unknown) {
            logDebug("BrunellaCLI", `JSON arg parse skipped: ${ensureError(error).message}`);
          }
        }
      }

      const client = new BrunellaClient();
      try {
        await client.connect();
        const result = await client.callTool(toolName, parsedArgs);

        if (opts.json) {
          writeLine(JSON.stringify(result, null, 2));
        } else {
          const response = result as { content?: Array<{ text?: string }> };
          const text = response.content?.[0]?.text;
          if (text) writeLine(text);
          else writeLine(JSON.stringify(result, null, 2));
        }
      } catch (error: unknown) {
        console.error(chalk.red("Tool execution failed:"), ensureError(error).message);
        process.exitCode = 1;
      } finally {
        await client.close();
      }
    },
  );

// --- chat
program
  .command("chat")
  .description("Interactive chat with Brunella")
  .option("-v, --verbose", "Show model/provider trace details")
  .option("--debug", "Show extended orchestration trace (includes Phoenix/fallback)")
  .action(async (cmd?: { opts: () => { verbose?: boolean; debug?: boolean } }) => {
    const terminalRenderer = new TerminalRenderer();
    marked.setOptions({
      renderer: terminalRenderer as unknown as NonNullable<Parameters<typeof marked.setOptions>[0]>['renderer'],
    });

    writeLine(chalk.cyan("Starting chat..."));
    writeLine(chalk.dim("Type 'exit' to quit"));
    writeLine(chalk.dim("Commands:"));
    writeLine(
      chalk.dim("  /switch  - Change AI Model (GPT-4.1, Gemini, Ollama)"),
    );
    writeLine(chalk.dim("  /edge    - Toggle Edge Mode (Cloudflare)"));
    writeLine(chalk.dim("  /jules   - Jules AI delegálás (new/sync/status)"));
    writeLine(
      chalk.dim(
        "  /conductor <action> - Run Conductor tasks (status, sync, track)",
      ),
    );
    writeLine(
      chalk.dim(
        "  /mode [orchestrator|direct] - Chat motor váltás (agent delegálás / nyers LLM)",
      ),
    );
    writeLine(chalk.dim("  /progress - Session feladatok aktuális állapota"));
    writeLine(chalk.dim("  /newsession - Új operátori session indítása"));
    writeLine(chalk.dim("  /approve <id> - High-risk checkpoint jóváhagyása"));
    writeLine(chalk.dim("  /tools   - List available tools"));
    writeLine(chalk.dim("  /ls [path] - List files (Coding Agent)"));
    writeLine(chalk.dim("  /read <path> - Read file (Coding Agent)"));
    writeLine(chalk.dim("  /eval <code> - Run Python code directly"));
    writeLine(chalk.dim("  /clear   - Clear conversation history"));

    const client = new BrunellaClient();
    try {
      await client.connect();
      const traceOptions = cmd?.opts?.() ?? {};
      const traceEnabled = Boolean(traceOptions.verbose || traceOptions.debug);

      type ChatProvider = "ollama" | "gemini" | "github" | "cloudflare" | "anthropic";
      type CatalogProvider = {
        id: ChatProvider;
        label: string;
        enabled: boolean;
        defaultModel: string;
        models: Array<{ id: string; name: string }>;
      };

      const serverUrl =
        (configManager.get("serverUrl") as string) || "http://localhost:3000";
      const fallbackCatalog: CatalogProvider[] = [
        {
          id: "github",
          label: "GitHub Models",
          enabled: true,
          defaultModel: "gpt-4.1",
          models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o3-mini", "o1-mini"].map((name) => ({ id: name, name })),
        },
        {
          id: "gemini",
          label: "Google Gemini",
          enabled: true,
          defaultModel: "gemini-2.5-flash",
          models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"].map((name) => ({ id: name, name })),
        },
        {
          id: "anthropic",
          label: "Anthropic Claude",
          enabled: true,
          defaultModel: "claude-3-5-sonnet-20241022",
          models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"].map((name) => ({ id: name, name })),
        },
        {
          id: "cloudflare",
          label: "Cloudflare AI",
          enabled: true,
          defaultModel: "@cf/meta/llama-3.3-70b-instruct",
          models: ["@cf/meta/llama-3.3-70b-instruct", "@cf/meta/llama-3.1-8b-instruct"].map((name) => ({ id: name, name })),
        },
        {
          id: "ollama",
          label: "Ollama Local",
          enabled: true,
          defaultModel: "qwen2.5-coder:7b",
          models: ["qwen2.5-coder:7b", "llama3.1:8b", "deepseek-r1:8b"].map((name) => ({ id: name, name })),
        },
      ];

      const getModelCatalog = async (): Promise<CatalogProvider[]> => {
        try {
          const response = await fetch(`${serverUrl}/api/llm/catalog`, {
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) {
            return fallbackCatalog;
          }

          const data = (await response.json()) as {
            providers?: Array<{
              id: string;
              label: string;
              enabled: boolean;
              defaultModel: string;
              models: Array<{ id: string; name: string }>;
            }>;
          };

          const providers = (data.providers || []).filter(
            (provider): provider is CatalogProvider =>
              ["github", "gemini", "anthropic", "cloudflare", "ollama"].includes(provider.id) &&
              (provider.enabled || provider.id === "ollama"),
          );

          return providers.length > 0 ? providers : fallbackCatalog;
          } catch (error: unknown) {
            logDebug("BrunellaCLI", `Provider catalog fallback used: ${ensureError(error).message}`);
            return fallbackCatalog;
          }
        };

      // Session State
      let history: Array<{ role: "user" | "assistant"; content: string }> = [];
      let activeProvider: ChatProvider = "github";
      let activeModel: string = "gpt-4.1";
      const createSessionId = () => `cli-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      let orchestratorSessionId = createSessionId();

      let edgeMode = false;
      let orchestrationMode = true;

      writeLine(
        chalk.green(
          `\n✔ Active Model: ${chalk.bold(activeModel)} (${activeProvider})\n`,
        ),
      );
      if (traceEnabled) {
        writeLine(chalk.dim(`TRACE: role=orchestrator provider=${activeProvider} model=${activeModel}`));
      }

      while (true) {
        const { prompt } = await inquirer.prompt([
          {
            type: "input",
            name: "prompt",
            message: edgeMode
              ? chalk.blue("Brunella (Edge) ❯")
              : chalk.magenta("Brunella ❯"),
          },
        ]);

        const trimmed = prompt.trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === "exit") break;

        // --- Commands ---

        if (trimmed === "/clear") {
          history = [];
          writeLine(chalk.yellow("Conversation history cleared."));
          continue;
        }

        if (trimmed.toLowerCase() === "/newsession") {
          orchestratorSessionId = createSessionId();
          history = [];
          writeLine(chalk.green(`✔ Új operátori session: ${chalk.bold(orchestratorSessionId)}`));
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/approve")) {
          const parts = trimmed.split(" ").filter(Boolean);
          if (parts.length < 2) {
            writeLine(chalk.yellow("Használat: /approve <approval-id>"));
            continue;
          }

          const approvalId = parts[1];
          history.push({ role: "user", content: `jóváhagyom ${approvalId}` });
          const spinner = ora("Approval végrehajtás...").start();
          try {
            const approveRes = await fetch(`${serverUrl}/api/orchestrator/universal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: `jóváhagyom ${approvalId}`,
                provider: activeProvider,
                model: activeModel,
                conversationHistory: history.slice(0, -1),
                sessionId: orchestratorSessionId,
              }),
            });

            if (!approveRes.ok) {
              throw new Error(`Approval API hiba: ${approveRes.status} ${approveRes.statusText}`);
            }

            const approveData = (await approveRes.json()) as {
              reply?: string;
              sessionId?: string;
              missionTimeline?: Array<{ phase: string; status: string; detail: string }>;
            };
            spinner.stop();

            if (approveData.sessionId) {
              orchestratorSessionId = approveData.sessionId;
            }

            const approveText = approveData.reply || "A jóváhagyás feldolgozva.";
            writeLine(marked(approveText));

            if (Array.isArray(approveData.missionTimeline) && approveData.missionTimeline.length > 0) {
              const compactTimeline = approveData.missionTimeline
                .slice(-5)
                .map((entry) => `${entry.phase}[${entry.status}]`)
                .join(" -> ");
              writeLine(chalk.dim(`Timeline: ${compactTimeline}`));
            }

            history.push({ role: "assistant", content: approveText });
          } catch (error: unknown) {
            spinner.stop();
            console.error(chalk.red("Approval hiba:"), ensureError(error).message);
          }
          continue;
        }

        if (trimmed.toLowerCase() === "/progress") {
          if (!orchestrationMode) {
            writeLine(chalk.yellow("A /progress az orchestrator módban működik. Használd: /mode orchestrator"));
            continue;
          }

          const spinner = ora("Progress lekérése...").start();
          try {
            const progressRes = await fetch(
              `${serverUrl}/api/orchestrator/universal`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: "Mutasd a session aktuális progresszét és a futó taskokat.",
                  provider: activeProvider,
                  model: activeModel,
                  conversationHistory: history,
                  sessionId: orchestratorSessionId,
                }),
              },
            );

            if (!progressRes.ok) {
              throw new Error(`Progress API hiba: ${progressRes.status} ${progressRes.statusText}`);
            }

            const progressData = (await progressRes.json()) as {
              reply?: string;
              sessionId?: string;
              suggestions?: string[];
            };

            spinner.stop();
            if (progressData.sessionId) {
              orchestratorSessionId = progressData.sessionId;
            }
            const progressText = progressData.reply || "Nincs elérhető progressz riport.";
            writeLine(marked(progressText));
            if (Array.isArray(progressData.suggestions) && progressData.suggestions.length > 0) {
              writeLine(chalk.dim(`Javaslatok: ${progressData.suggestions.join(" | ")}`));
            }
          } catch (error: unknown) {
            spinner.stop();
            console.error(chalk.red("Progress lekérdezési hiba:"), ensureError(error).message);
          }
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/jules")) {
          const parts = trimmed.toLowerCase().split(" ");
          const action = parts[1];

          if (!action || action === "help") {
            writeLine(chalk.cyan("\n🤖 Jules Commands:"));
            writeLine(
              chalk.dim("  /jules new     - Új Jules task létrehozás"),
            );
            writeLine(
              chalk.dim("  /jules sync    - GitHub Jules branch-ek pullolása"),
            );
            writeLine(
              chalk.dim("  /jules status  - Sessions + branch-ek státusza"),
            );
            writeLine(
              chalk.dim("  /jules menu    - Interaktív menü indítás\n"),
            );
            continue;
          }

          if (action === "menu") {
            writeLine(chalk.cyan("Launching Jules interactive menu..."));
            // Import and run interactive menu
            try {
              const { execSync } = await import("child_process");
              execSync("node build/cli-jules-interactive.js", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (error: unknown) {
              writeLine(chalk.red(`Error launching menu: ${ensureError(error).message}`));
            }
            continue;
          }

          if (action === "new") {
            const { taskPrompt } = await inquirer.prompt([
              {
                type: "input",
                name: "taskPrompt",
                message: "Jules task prompt:",
              },
            ]);

            if (taskPrompt) {
              writeLine(
                chalk.cyan(
                  `\n🚀 Jules task indítás: "${taskPrompt.slice(0, 60)}..."\n`,
                ),
              );
              try {
                const { execSync } = await import("child_process");
                execSync(
                  `python scripts/jules_api_client.py create "${taskPrompt}"`,
                  { stdio: "inherit", cwd: process.cwd() },
                );
              } catch (error: unknown) {
                writeLine(chalk.red(`Error: ${ensureError(error).message}`));
              }
            }
            continue;
          }

          if (action === "sync") {
            writeLine(chalk.cyan("\n🔄 Jules sync indítás...\n"));
            try {
              const { execSync } = await import("child_process");
              execSync("python scripts/jules_sync_watchdog.py --once", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (error: unknown) {
              writeLine(chalk.red(`Error: ${ensureError(error).message}`));
            }
            continue;
          }

          if (action === "status") {
            writeLine(chalk.cyan("\n📊 Jules status...\n"));
            try {
              const { execSync } = await import("child_process");
              execSync("python scripts/jules_api_client.py list 5", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
              writeLine("");
              execSync("python scripts/jules_sync_watchdog.py --check", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (error: unknown) {
              writeLine(chalk.red(`Error: ${ensureError(error).message}`));
            }
            continue;
          }

          writeLine(chalk.red("Unknown Jules command. Use /jules help"));
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/edge")) {
          edgeMode = !edgeMode;
          writeLine(
            edgeMode
              ? chalk.cyan("Edge mode enabled (Cloudflare).")
              : chalk.yellow("Edge mode disabled (Local/API)."),
          );
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/mode")) {
          const parts = trimmed
            .split(" ")
            .map((part: string) => part.trim().toLowerCase())
            .filter(Boolean);

          if (parts.length === 1) {
            orchestrationMode = !orchestrationMode;
          } else if (parts[1] === "orchestrator" || parts[1] === "agent") {
            orchestrationMode = true;
          } else if (parts[1] === "direct" || parts[1] === "llm") {
            orchestrationMode = false;
          } else {
            writeLine(chalk.red("Unknown mode. Use /mode orchestrator vagy /mode direct"));
            continue;
          }

          writeLine(
            orchestrationMode
              ? chalk.green("✔ Chat mode: Orchestrator (tool calling + agent delegálás)")
              : chalk.yellow("✔ Chat mode: Direct LLM (nyers provider válasz)"),
          );
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/switch")) {
          const parts = trimmed.split(" ");
          const catalog = await getModelCatalog();
          // Interactive selection if just '/switch'
          if (parts.length === 1) {
            const { provider } = await inquirer.prompt([
              {
                type: "list",
                name: "provider",
                message: "Select AI Provider:",
                choices: catalog.map((entry) => ({ name: entry.label, value: entry.id })),
              },
            ]);

            const providerEntry = catalog.find((entry) => entry.id === provider) || catalog[0];

            const { model } = await inquirer.prompt([
              {
                type: "list",
                name: "model",
                message: "Select Model:",
                choices: providerEntry.models.map((entry) => entry.name),
              },
            ]);

            activeProvider = provider;
            activeModel = model;
          } else {
            // Quick switch: /switch gemini
            const target = parts[1].toLowerCase();
            const normalizedTarget = target === "claude"
              ? "anthropic"
              : target === "cf"
                ? "cloudflare"
                : target;

            const providerEntry = catalog.find((entry) => entry.id === normalizedTarget);

            if (!providerEntry) {
              writeLine(
                chalk.red(
                  "Unknown provider. Use interactive mode (just /switch) or github/gemini/anthropic/cloudflare/ollama.",
                ),
              );
              continue;
            }

            activeProvider = providerEntry.id;
            activeModel = providerEntry.defaultModel || providerEntry.models[0]?.name || activeModel;
          }

          writeLine(chalk.green(`✔ Switched to: ${chalk.bold(activeModel)}`));
          history = []; // Optional: reset history on switch? Let's keep it for context continuity if compatible, but usually safer to clear or warn.
          // For now, let's NOT clear history implicitly to allow context carry-over, but warn user manually if needed.
          continue;
        }

        // --- Chat Loop ---

        history.push({ role: "user", content: prompt });
        const spinner = ora("Thinking...").start();

        try {
          let responseText = "";

          if (edgeMode) {
            const cloudflareClient = await getCloudflareClient();
            const edgeResult = await cloudflareClient.submitTask(prompt, {
              history,
            });
            responseText = `Task submitted. Task ID: ${edgeResult.taskId}`;
          } else {
            if (orchestrationMode) {
              const conversationHistory = history.slice(0, -1);
              const orchestratorRes = await fetch(
                `${serverUrl}/api/orchestrator/universal`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: prompt,
                    provider: activeProvider,
                    model: activeModel,
                    conversationHistory,
                    sessionId: orchestratorSessionId,
                  }),
                },
              );

              if (!orchestratorRes.ok) {
                throw new Error(
                  `Orchestrator API hiba: ${orchestratorRes.status} ${orchestratorRes.statusText}`,
                );
              }

              const orchestratorData = (await orchestratorRes.json()) as {
                reply?: string;
                actionsTriggered?: Array<{ agent: string; taskId: number }>;
                provider?: string;
                model?: string;
                role?: string;
                thinkingMs?: number;
                sessionId?: string;
                suggestions?: string[];
                missionTimeline?: Array<{ phase: string; status: string; detail: string }>;
                approvalRequired?: boolean;
                approvalId?: string;
                riskLevel?: "low" | "high";
                runbookHint?: string;
                fallbackUsed?: boolean;
                fallbackReason?: string;
                phoenixTriggered?: boolean;
              };

              if (orchestratorData.sessionId) {
                orchestratorSessionId = orchestratorData.sessionId;
              }

              responseText =
                orchestratorData.reply ||
                "A kérés feldolgozva, de nem érkezett részletes válasz.";

              if (
                Array.isArray(orchestratorData.actionsTriggered) &&
                orchestratorData.actionsTriggered.length > 0
              ) {
                const actionSummary = orchestratorData.actionsTriggered
                  .map((a) => `#${a.taskId} ${a.agent}`)
                  .join(", ");
                responseText += `\n\n🔧 Delegált feladatok: ${actionSummary}`;
              }

              if (orchestratorData.provider || typeof orchestratorData.thinkingMs === "number") {
                responseText += `\n\n_${orchestratorData.provider || activeProvider}${
                  typeof orchestratorData.thinkingMs === "number"
                    ? ` • ${orchestratorData.thinkingMs} ms`
                    : ""
                }_`;
              }

              if (traceEnabled) {
                const traceParts = [
                  `role=${orchestratorData.role || 'orchestrator'}`,
                  `provider=${orchestratorData.provider || activeProvider}`,
                  `model=${orchestratorData.model || activeModel}`,
                ];
                if (orchestratorData.fallbackUsed) {
                  traceParts.push(`fallback=${orchestratorData.fallbackReason || 'yes'}`);
                }
                if (orchestratorData.phoenixTriggered) {
                  traceParts.push('phoenix=triggered');
                }
                responseText += `\n\n🔍 TRACE: ${traceParts.join(' | ')}`;
              }

              if (Array.isArray(orchestratorData.suggestions) && orchestratorData.suggestions.length > 0) {
                responseText += `\n\n💡 Javaslatok: ${orchestratorData.suggestions.join(" | ")}`;
              }

              if (orchestratorData.runbookHint) {
                responseText += `\n\n📚 ${orchestratorData.runbookHint}`;
              }

              if (orchestratorData.approvalRequired && orchestratorData.approvalId) {
                responseText += `\n\n🛡️ Approval kell: /approve ${orchestratorData.approvalId}`;
              }

              if (Array.isArray(orchestratorData.missionTimeline) && orchestratorData.missionTimeline.length > 0) {
                const compactTimeline = orchestratorData.missionTimeline
                  .slice(-6)
                  .map((entry) => `${entry.phase}[${entry.status}]`)
                  .join(" -> ");
                responseText += `\n\n🧭 Timeline: ${compactTimeline}`;
              }
            } else {
              const llmRes = await fetch(`${serverUrl}/api/llm/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt,
                  provider: activeProvider,
                  model: activeModel,
                }),
              });

              if (!llmRes.ok) {
                throw new Error(`LLM API hiba: ${llmRes.status} ${llmRes.statusText}`);
              }

              const llmData = (await llmRes.json()) as {
                text?: string;
                error?: string;
                provider?: string;
                model?: string;
              };
              responseText =
                llmData.text || llmData.error || "A modell nem adott vissza választ.";

              if (traceEnabled) {
                responseText += `\n\n🔍 TRACE: role=direct_llm | provider=${llmData.provider || activeProvider} | model=${llmData.model || activeModel}`;
              }
            }
          }

          spinner.stop();

          // Render Markdown
          writeLine(marked(responseText));
          history.push({ role: "assistant", content: responseText });
        } catch (error: unknown) {
          spinner.stop();
          console.error(chalk.red("\nError:"), ensureError(error).message);
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red("\nConnection failed:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

// --- interpreter
program
  .command("interpreter")
  .description("Interactive Python Interpreter")
  .action(async () => {
    writeLine(
      chalk.blue(
        boxen("Brunella Python Interpreter", {
          padding: 1,
          borderStyle: "round",
        }),
      ),
    );
    const client = new BrunellaClient();
    try {
      await client.connect();

      while (true) {
        const { code } = await inquirer.prompt([
          {
            type: "input",
            name: "code",
            message: ">>>",
          },
        ]);

        if (code === "exit") break;

        const result = await client.callTool("interpreter_run_python", {
          code,
        });
        // @ts-expect-error content might be missing The result from interpreter_run_python might not have content[0].text.
        writeLine(result.content[0].text);
      }
    } catch (error: unknown) {
      writeLine(chalk.red(ensureError(error).message));
    } finally {
      await client.close();
    }
  });

// --- conductor (Project Management)
const conductorCmd = program
  .command("conductor")
  .description("Project management and documentation sync");

conductorCmd
  .command("status")
  .description("Show project status and active tracks")
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora("Fetching project status...").start();
    try {
      await client.connect({ coreOnly: true, timeoutMs: CLI_MCP_CONNECT_TIMEOUT_MS });
      const result = await client.callTool("agent_delegate", {
        agent_name: "ProjectConductor",
        task: "status",
      });
      spinner.stop();
      // @ts-expect-error content might be missing The result from agent_delegate tool might not have 'content[0].text'.
      const text = result.content?.[0]?.text || "No response";

      try {
        const json = JSON.parse(text);
        if (json.data && json.data.report) {
          writeLine(marked(json.data.report));
        } else if (json.message) {
          writeLine(marked(json.message));
        } else {
          writeLine(marked(text));
        }
      } catch (error: unknown) {
        writeLine(marked(text));
      }
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

conductorCmd
  .command("chat")
  .description("Interactive chat with Project Conductor")
  .action(async () => {
    process.env.BRUNELLA_QUIET_LOGS = "true";
    writeLine(
      chalk.blue(
        boxen("Project Conductor Chat", { padding: 1, borderStyle: "round" }),
      ),
    );
    writeLine(chalk.dim("Type 'exit' to quit."));

    const client = new BrunellaClient();
    try {
      await client.connect();

      const history: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      while (true) {
        const { message } = await inquirer.prompt([
          {
            type: "input",
            name: "message",
            message: chalk.magenta("Conductor ❯"),
          },
        ]);

        if (message.toLowerCase() === "exit") break;
        if (!message.trim()) continue;

        const spinner = ora("Thinking...").start();

        try {
          // Add basic context
          const context = {
            history: history.slice(-5), // Keep last 5 messages
            mode: "chat",
          };

          const result = await client.callTool("agent_delegate", {
            agent_name: "ProjectConductor",
            task: message,
            context,
          });

          spinner.stop();

          const toolResult = result as { content?: Array<{ text?: string }>; message?: string };
          const text =
            toolResult.content?.[0]?.text ||
            toolResult.message ||
            "No response";

          let responseText = text;
          try {
            const json = JSON.parse(text);
            responseText =
              json.message || json.data?.text || JSON.stringify(json, null, 2);
          } catch (error: unknown) {
            logDebug("BrunellaCLI", `Response JSON parse fallback used: ${ensureError(error).message}`);
          }

          writeLine(marked(responseText));

          history.push({ role: "user", content: message });
          history.push({ role: "assistant", content: responseText });
        } catch (error: unknown) {
          spinner.stop();
          console.error(chalk.red("Error:"), ensureError(error).message);
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red("Connection error:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

conductorCmd
  .command("sync")
  .description("Synchronize documentation files")
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora("Synchronizing documentation...").start();
    try {
      await client.connect();
      const result = await client.callTool("agent_delegate", {
        agent_name: "ProjectConductor",
        task: "sync documentation",
      });
      spinner.stop();
      writeLine(chalk.green("✓"), result);
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

conductorCmd
  .command("health")
  .description("Run project health check (build, tests, docs)")
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora("Running health check...").start();
    try {
      await client.connect();
      const result = await client.callTool("agent_delegate", {
        agent_name: "ProjectConductor",
      });
      spinner.stop();
      // @ts-expect-error content might be missing The response might not have content[0].text.
      const response = result.content?.[0]?.text || "Health check completed";
      writeLine(marked(response));
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

conductorCmd
  .command("track <action> [name]")
  .description("Manage development tracks (create, update, list)")
  .action(async (action: string, name?: string) => {
    const client = new BrunellaClient();
    let task = action;
    if (action === "create" && name) {
      task = `track create ${name}`;
    } else if (action === "update") {
      task = "track update";
    } else if (action === "list") {
      task = "status"; // Status shows track list
    }

    const spinner = ora(`Executing track ${action}...`).start();
    try {
      await client.connect();
      const result = await client.callTool("agent_delegate", {
        agent_name: "ProjectConductor",
        task,
      });
      spinner.stop();
      // @ts-expect-error content might be missing The response might not have content[0].text.
      const response = result.content?.[0]?.text || "Done";
      writeLine(marked(response));
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    } finally {
      await client.close();
    }
  });

// Register additional Conductor commands (Track State Manager v2)
registerConductorCommands(conductorCmd);

// --- jules (Jules AI Integration)
const julesCmd = program
  .command("jules")
  .description("Jules AI integration (task delegation, sync, status)");

// --- jules tests (GitHub Actions async tests)
julesCmd
  .command("tests")
  .description("Jules async tests (GitHub Actions) - runs / trigger")
  .option("--workflow <file>", "Workflow file name", "jules-async-tests.yml")
  .option("--limit <n>", "How many runs to list", "10")
  .action(
    async (cmd?: { opts: () => { workflow?: string; limit?: string } }) => {
      const opts = cmd?.opts?.() ?? {};
      const workflow = String(opts.workflow || "jules-async-tests.yml");
      const limit = Math.max(
        1,
        Math.min(50, parseInt(String(opts.limit || "10"), 10) || 10),
      );

      const baseUrl = String(
        configManager.get("serverUrl") || "http://localhost:3000",
      ).replace(/\/$/, "");

      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "Jules async tesztek:",
          choices: [
            { name: "🧪 Legutóbbi futások", value: "runs" },
            { name: "🚀 Workflow indítása (dispatch)", value: "trigger" },
            { name: "❌ Mégsem", value: "cancel" },
          ],
        },
      ]);

      if (action === "cancel") return;

      try {
        if (action === "runs") {
          const url = `${baseUrl}/api/v1/jules/workflow-runs?workflow=${encodeURIComponent(workflow)}&limit=${limit}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const data = (await res.json()) as { error?: string; runs?: Array<WorkflowRunRecord> };
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

          const runs = (data?.runs || []) as Array<WorkflowRunRecord>;
          if (runs.length === 0) {
            writeLine(
              chalk.yellow(
                "Nincs futás (vagy hiányzik a GITHUB_TOKEN a szerveren).",
              ),
            );
            return;
          }

          writeLine(
            chalk.bold(`\nWorkflow: ${workflow} (top ${runs.length})\n`),
          );

          // Trend Analysis
          const successCount = runs.filter((r) => r.conclusion === "success").length;
          const failureCount = runs.filter((r) => r.conclusion === "failure").length;
          const passRate = runs.length > 0 ? Math.round((successCount / runs.length) * 100) : 0;

          writeLine(chalk.cyan("📊 Trend Analysis (last " + runs.length + " runs):"));
          writeLine(
            `  ✅ Success: ${chalk.green(successCount)} | ❌ Failure: ${chalk.red(failureCount)} | ⚡ Pass Rate: ${passRate >= 90 ? chalk.green(passRate + "%") : passRate >= 70 ? chalk.yellow(passRate + "%") : chalk.red(passRate + "%")}\n`,
          );

          // ASCII Chart (simple bar)
          const barLength = 40;
          const successBar = "█".repeat(Math.round((successCount / runs.length) * barLength));
          const failureBar = "█".repeat(Math.round((failureCount / runs.length) * barLength));
          writeLine(chalk.green("  Success: " + successBar));
          writeLine(chalk.red("  Failure: " + failureBar) + "\n");

          // List runs
          for (const r of runs) {
            const status = String(r.status || "unknown");
            const concl = r.conclusion == null ? "-" : String(r.conclusion);
            const when = String(r.updated_at || r.created_at || "")
              .slice(0, 19)
              .replace("T", " ");
            const icon = concl === "success" ? chalk.green("✅") : concl === "failure" ? chalk.red("❌") : "⏸️";
            writeLine(
              `${icon} #${r.run_number ?? r.id}  ${status} / ${concl}  (${when})`,
            );
          }
        } else if (action === "trigger") {
          const url = `${baseUrl}/api/v1/jules/dispatch`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflow, ref: "main", inputs: {} }),
            signal: AbortSignal.timeout(15000),
          });
          const data = (await res.json()) as { error?: string; workflow?: string; ref?: string };
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          writeLine(
            chalk.green(
              `✅ Workflow indítva: ${data.workflow} (ref=${data.ref})`,
            ),
          );
        }
      } catch (error: unknown) {
        console.error(chalk.red("Hiba:"), ensureError(error).message || ensureError(error).message);
        process.exit(1);
      }
    },
  );

julesCmd
  .command("menu")
  .description("Launch interactive Jules menu")
  .action(async () => {
    try {
      const { execSync } = await import("child_process");
      execSync("node build/cli-jules-interactive.js", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error: unknown) {
      console.error(chalk.red("Error launching menu:"), ensureError(error).message);
      process.exit(1);
    }
  });

julesCmd
  .command("new [prompt]")
  .description("Create new Jules task")
  .action(async (prompt?: string) => {
    if (!prompt) {
      const answer = await inquirer.prompt([
        {
          type: "input",
          name: "taskPrompt",
          message: "Jules task prompt:",
        },
      ]);
      prompt = answer.taskPrompt;
    }

    if (prompt) {
      writeLine(chalk.cyan(`\n🚀 Jules task: "${prompt.slice(0, 60)}..."\n`));
      try {
        const { execSync } = await import("child_process");
        execSync(`python scripts/jules_api_client.py create "${prompt}"`, {
          stdio: "inherit",
          cwd: process.cwd(),
        });
      } catch (error: unknown) {
        console.error(chalk.red("Error:"), ensureError(error).message);
        process.exit(1);
      }
    }
  });

julesCmd
  .command("sync")
  .description("Sync Jules GitHub branches (pull latest)")
  .action(async () => {
    writeLine(chalk.cyan("\n🔄 Jules sync...\n"));
    try {
      const { execSync } = await import("child_process");
      execSync("python scripts/jules_sync_watchdog.py --once", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error: unknown) {
      console.error(chalk.red("Error:"), ensureError(error).message);
      process.exit(1);
    }
  });

julesCmd
  .command("status")
  .description("Show Jules sessions and branch status")
  .action(async () => {
    writeLine(chalk.cyan("\n📊 Jules status...\n"));
    try {
      const { execSync } = await import("child_process");
      execSync("python scripts/jules_api_client.py list 5", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      writeLine("");
      execSync("python scripts/jules_sync_watchdog.py --check", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error: unknown) {
      console.error(chalk.red("Error:"), ensureError(error).message);
      process.exit(1);
    }
  });

// --- architect (Agent Architect 2.0)
const architectCmd = program
  .command("architect")
  .description("Agent Architect 2.0 - Create new agents dynamically");

architectCmd
  .command("create [description]")
  .description("Create a new agent from natural language description")
  .action(async (description?: string) => {
    const { AgentArchitect } = await import("@packages/agents/AgentArchitect.js");

    let desc = description;
    if (!desc) {
      const answer = await inquirer.prompt([
        {
          type: "input",
          name: "description",
          message: "Describe the agent (e.g. 'Monitor HackerNews top posts'):",
        },
      ]);
      desc = answer.description;
    }

    if (!desc || desc.trim().length < 10) {
      writeLine(chalk.red("\n❌ Description too short. Please provide at least 10 characters.\n"));
      return;
    }

    writeLine(chalk.cyan(`\n🏗️  Agent Architect - Creating agent...\n`));
    writeLine(chalk.dim(`Description: ${desc}\n`));

    const spinner = ora("Analyzing description...").start();

    try {
      // Extract name, role, capabilities from description using LLM
      const { generateResponse } = await import("@packages/core-logic/llm_client.js");

      spinner.text = "Generating agent configuration...";
      const analysisPrompt = `
You are an AI agent designer. Given a description, extract structured information.

Description: "${desc}"

Return ONLY a JSON object with this structure:
{
  "name": "short_snake_case_name",
  "role": "Short Role Title (2-4 words)",
  "capabilities": ["cap1", "cap2", "cap3"],
  "triggers": ["keyword1", "keyword2"]
}

Example for "Monitor HackerNews top posts":
{
  "name": "hackernews_monitor",
  "role": "HackerNews Monitor",
  "capabilities": ["web_scraping", "summarization", "monitoring"],
  "triggers": ["hackernews", "hn", "tech_news"]
}

Return ONLY valid JSON, no markdown, no explanation.
`;

      const analysisResult = await generateResponse(analysisPrompt);
      const agentConfig = JSON.parse(analysisResult.replace(/```json|```/g, "").trim());

      spinner.text = "Creating agent files...";

      const result = await AgentArchitect.createAgent({
        name: agentConfig.name,
        role: agentConfig.role,
        description: desc,
        capabilities: agentConfig.capabilities || ["general"],
        triggers: agentConfig.triggers || [agentConfig.name],
      });

      if (result.success) {
        spinner.succeed(chalk.green(`✅ ${result.message}`));
        writeLine(chalk.dim(`\nAgent name: ${chalk.white(agentConfig.name)}`));
        writeLine(chalk.dim(`Role: ${chalk.white(agentConfig.role)}`));
        writeLine(chalk.dim(`Capabilities: ${chalk.white(agentConfig.capabilities.join(", "))}`));
        writeLine(chalk.dim(`\n📁 Files created:`));
        writeLine(chalk.dim(`  - myai/agents/${agentConfig.name}.toml`));
        writeLine(chalk.dim(`  - registry.json (updated)`));
        writeLine(chalk.cyan(`\n🚀 Run: ${chalk.white(`brunella agents`)}\n`));
      } else {
        spinner.fail(chalk.red(`❌ ${result.message}`));
      }
    } catch (error: unknown) {
      spinner.fail(chalk.red(`❌ Error: ${ensureError(error).message}`));
      console.error(chalk.dim(ensureError(error).stack));
      process.exit(1);
    }
  });

// Register Gold Protocol commands (G7.7)
registerGoldCommands(program);

// Register Developer Agent commands (P2)
registerDevCommands(program);

// Register Tracks commands (EPP v2)
registerTracksCommands(program);

// Register SDLC pipeline commands
registerSdlcCommands(program);

// Register Task Decomposer commands (TaskAgents)
registerTaskDecomposerCommands(program);

// Register Track progress / TODO commands (Dashboard TODO Widget)
registerProgressCommands(program);

// Register Edge commands (Cloudflare)
registerEdgeCommands(program);

// Register Suggested Tasks commands (TODO/FIXME Scanner)
registerSuggestedTasksCommands(program);

// Register Robotkez commands (RobotkezV2 Agent)
registerRobotkezCommands(program);

// Register Task commands (Natural Language Task Routing)
registerTaskCommands(program);

// Register Invoice Automation commands (Master Track 2)
registerInvoiceCommands(program);

// Register Lead Mining commands (Master Track 1)
registerLeadCommands(program);

// Register Market Watcher commands (Master Track 3)
registerMarketCommands(program);

// Register Workspace commands (Google Workspace API)
registerWorkspaceCommands(program);
dashboardCommand(program);

const openClawCommand = program
  .command("openclaw")
  .description("Inspect and preview the OpenClaw integration");

openClawCommand
  .command("status")
  .description("Show the OpenClaw runtime status snapshot")
  .action(async () => {
    const payload = await openClawHandlers.status();
    writeLine(formatOpenClawCliPayload(payload));
    if (!payload.ok) {
      process.exitCode = 1;
    }
  });

openClawCommand
  .command("preview")
  .requiredOption("--request <json>", "OpenClaw task request JSON")
  .description("Preview an OpenClaw task request")
  .action(async (options: { request: string }) => {
    const payload = await openClawHandlers.preview(options.request);
    writeLine(formatOpenClawCliPayload(payload));
    if (!payload.ok) {
      process.exitCode = 1;
    }
  });

// Register Guardrails & Telemetry commands (Track #1 + #2)
registerGuardrailsCommands(program);
registerTelemetryCommands(program);
registerMemoryCommands(program);
registerWorkflowCommands(program);

// Register Swarm & Tool Discovery commands (Track #5 + #6)
registerSwarmCommands(program);
registerToolDiscoveryCommands(program);
registerSecurityCommands(program);
registerChromeAcpCommands(program);
registerReadinessCommands(program);
registerBrowserCopilotCommands(program);

// Register Crawl4AI & Memoria commands (Phase 3 — kutatas.md integráció)
registerCrawl4aiCommands(program);
registerBookkeepingCommands(program);
registerPalyazatCommands(program);
registerHROnboardingCommands(program);
registerPropertySalesCommands(program);
registerMemoriaCommands(program);
registerIntelligenceCommands(program);
registerPredictiveDecisionCommands(program);
registerLearningLoopCommands(program);
registerSelfModificationCommands(program);
registerWorldPerceptionCommands(program);
registerObservabilityCommands(program);
registerDevExCommands(program);
registerAgentGovernanceCommands(program);
registerDocsConfigCommands(program);
registerFederationCommands(program);
registerInventoryCommands(program);
registerKkvPackCommands(program);
registerKkvFinanceCommands(program);
registerProjectMaintainerCommands(program);
registerBriefingCommands(program);
registerExternalKnowledgeCommands(program);
registerHeygenCommands(program);
registerStudioCommands(program);
registerChaosCommands(program);
registerHookCommands(program);

// Register Conductor commands(Track State Management) - MOVED AFTER conductorCmd definition

// ════════════════════════════════════════════════════════════════════════════
// TESTS COMMAND (Test Scheduler)
// ════════════════════════════════════════════════════════════════════════════

const testsCmd = program
  .command("tests")
  .description("Manage test scheduling and results");



testsCmd
  .command("status")
  .description("Show test scheduler status and statistics")
  .action(async () => {
    const baseUrl = String(
      configManager.get("serverUrl") || "http://localhost:3000",
    ).replace(/\/$/, "");
    const spinner = ora("Fetching test scheduler status...").start();
    try {
      const [scheduleRes, statsRes, resultsRes] = await Promise.all([
        fetch(`${baseUrl}/api/tests/schedule`),
        fetch(`${baseUrl}/api/tests/stats`),
        fetch(`${baseUrl}/api/tests/results?limit=5`),
      ]);
      spinner.stop();

      if (!scheduleRes.ok) throw new Error(`Schedule API failed: HTTP ${scheduleRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats API failed: HTTP ${statsRes.status}`);
      if (!resultsRes.ok) throw new Error(`Results API failed: HTTP ${resultsRes.status}`);

      const schedulePayload = (await scheduleRes.json()) as {
        schedule?: string;
        enabled?: boolean;
        active?: boolean;
      };
      const statsPayload = (await statsRes.json()) as {
        data?: {
          totalRuns?: number;
          passRate?: number;
          averageDuration?: number;
          lastRunStatus?: string;
          lastRunTime?: string;
          sevenDayStats?: { passRate?: number };
        };
      };
      const resultsPayload = (await resultsRes.json()) as { data?: Array<{ status?: string; passed?: number; failed?: number; startedAt?: string; id?: string }> };
      const stats = statsPayload.data || {};
      const data = {
        schedule: schedulePayload.schedule,
        enabled: schedulePayload.enabled,
        active: schedulePayload.active,
        stats: {
          sevenDayPassRate: `${(((stats.sevenDayStats?.passRate ?? 0) as number) * 100).toFixed(2)}%`,
          totalRuns: stats.totalRuns ?? 0,
          averageDuration: `${Math.round(stats.averageDuration ?? 0)}ms`,
          lastRunStatus: stats.lastRunStatus ?? "unknown",
          lastRunTime: stats.lastRunTime ?? "n/a",
        },
        recentRuns: resultsPayload.data || [],
      };

      writeLine(chalk.bold("\n📊 Test Scheduler Status\n"));
      writeLine(`Schedule: ${chalk.cyan(data.schedule)}`);
      writeLine(`Enabled:  ${data.enabled ? chalk.green("✓") : chalk.red("✗")}`);
      writeLine(`Active:   ${data.active ? chalk.green("✓") : chalk.red("✗")}`);

      if (data.stats) {
        writeLine(chalk.bold("\n📈 Statistics (7 days)\n"));
        writeLine(`  Pass Rate:       ${chalk.green(data.stats.sevenDayPassRate)}`);
        writeLine(`  Total Runs:      ${chalk.cyan(data.stats.totalRuns)}`);
        writeLine(`  Avg Duration:    ${chalk.cyan(data.stats.averageDuration)}`);
        writeLine(`  Last Run Status: ${data.stats.lastRunStatus === "passed" ? chalk.green("✓ Passed") : chalk.red("✗ Failed")}`);
        writeLine(`  Last Run Time:   ${chalk.dim(data.stats.lastRunTime)}`);
      }

      if (data.recentRuns && data.recentRuns.length > 0) {
        writeLine(chalk.bold("\n📋 Recent Runs (Last 5)\n"));
        data.recentRuns.forEach((run, i: number) => {
          const status = run.status === "passed" ? chalk.green("✓") : chalk.red("✗");
          writeLine(`  ${i + 1}. ${status} (${run.passed}✓ / ${run.failed}✗) @ ${run.startedAt}`);
        });
      }
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    }
  });

testsCmd
  .command("run")
  .description("Trigger a manual test run immediately")
  .option("--reason <reason>", "Reason for triggering", "Manual CLI trigger")
  .action(async (options) => {
    const baseUrl = String(
      configManager.get("serverUrl") || "http://localhost:3000",
    ).replace(/\/$/, "");
    const spinner = ora("Triggering test run...").start();
    try {
      const response = await fetch(`${baseUrl}/api/tests/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerReason: options.reason }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        runId?: string;
        status?: string;
        error?: string;
      };
      spinner.stop();

      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      if (data.success) {
        writeLine(chalk.bold("\n✅ Test Run Triggered\n"));
        writeLine(`Run ID:  ${chalk.cyan(data.runId)}`);
        writeLine(`Status:  ${chalk.green(data.status)}`);
        writeLine(chalk.dim("\nMonitor progress in browser or use 'brunella tests status'"));
      } else {
        console.error(chalk.red("Failed to trigger test run:"), data.error);
      }
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    }
  });

testsCmd
  .command("results [count]")
  .description("Show recent test run results")
  .action(async (count: string) => {
    const limit = parseInt(count || "10", 10);
    const baseUrl = String(
      configManager.get("serverUrl") || "http://localhost:3000",
    ).replace(/\/$/, "");
    const spinner = ora("Fetching test results...").start();
    try {
      // Fetch results via HTTP (CLI-friendly)
      const response = await fetch(`${baseUrl}/api/tests/results?limit=${limit}`);
      spinner.stop();

      if (!response.ok) throw new Error("Failed to fetch results");

      const data = (await response.json()) as { data?: Array<WorkflowRunRecord> };
      writeLine(chalk.bold(`\n🧪 Recent Test Runs (Last ${limit})\n`));

      const runs = data.data || [];

      if (runs.length === 0) {
        writeLine(chalk.dim("No test runs found"));
      } else {
        runs.forEach((run, i: number) => {
          const status = run.status === "passed" ? chalk.green("✓") : chalk.red("✗");
          const duration = run.duration || "N/A";
          writeLine(`${i + 1}. ${status} ID: ${chalk.cyan(run.id)} | ${run.passed}✓ ${run.failed}✗ | ${duration}`);
          writeLine(`   Started: ${chalk.dim(new Date(run.startedAt).toLocaleString("hu-HU"))}`);
        });
      }
    } catch (error: unknown) {
      spinner.stop();
      console.error(chalk.red("Error:"), ensureError(error).message);
    }
  });

testsCmd
  .action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Local Test Scheduler - Mit szeretnél tenni?",
        choices: [
          { name: "📊 Scheduler státusza és eredmények", value: "status" },
          { name: "🚀 Manuális tesztfuttatás indítása", value: "run" },
          { name: "📋 Legutóbbi futások megjelenítése", value: "results" },
          { name: "✅ Track spec frissítése 'completed'-re", value: "track" },
          { name: "🖥️ Dashboard szerver indítása", value: "dashboard" },
          { name: "📤 Git push (origin/main)", value: "push" },
          { name: "📚 README dokumentáció frissítése", value: "docs" },
          { name: "❌ Mégsem", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") {
      writeLine(chalk.gray("Visszavonva."));
      process.exit(0);
    }

    // Delegate to sub-command or custom actions
    if (["status", "run", "results"].includes(action)) {
      // Use sub-commands for existing functionality
      process.argv[2] = "tests";
      process.argv[3] = action;
      if (action === "results") {
        process.argv[4] = "10"; // default limit
      }
      // Re-parse will happen below
    } else if (action === "track") {
      // Update track spec to completed
      const spinner = ora("Track spec frissítése...").start();
      try {
        const specPath = join(
          process.cwd(),
          "conductor/tracks/local_test_scheduler_20260215/spec.md",
        );
        const content = readFileSync(specPath, "utf-8");
        const updated = content
          .replace(/status:\s+pending|status:\s+active|status:\s+testing/i, "status: completed")
          .replace(/completedAt:.*$/m, `completedAt: ${new Date().toISOString()}`);
        writeFileSync(specPath, updated);
        spinner.succeed("✅ Track spec frissítve: completed");
        writeLine(chalk.dim(`  Fájl: ${specPath}`));
      } catch (error: unknown) {
        spinner.fail("Hiba: " + ensureError(error).message);
      }
      process.exit(0);
    } else if (action === "dashboard") {
      // Start development server
      const spinner = ora(
        "Dashboard szerver indítása (port 3000)...",
      ).start();
      const { spawn } = await import("child_process");
      const proc = spawn("npm", ["run", "dev"], {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      });
      spinner.stop();
      writeLine(chalk.green("✅ Szerver elindítva!"));
      writeLine(chalk.cyan("📱 Nyisd meg: http://localhost:3000"));
      writeLine(chalk.dim("Kilépéshez: Ctrl+C\n"));
      proc.on("exit", (code) => process.exit(code || 0));
    } else if (action === "push") {
      // Git push
      const spinner = ora("Git push (origin/main)...").start();
      const { execSync } = await import("child_process");
      try {
        execSync("git push origin main", { cwd: process.cwd(), stdio: "pipe" });
        spinner.succeed("✅ Git push sikeres!");
      } catch (error: unknown) {
        spinner.fail("Hiba: " + ensureError(error).message);
      }
      process.exit(0);
    } else if (action === "docs") {
      // Update README
      const spinner = ora("README dokumentáció frissítése...").start();
      try {
        const readmePath = join(process.cwd(), "README.md");
        const content = readFileSync(readmePath, "utf-8");

        // Add Local Test Scheduler section if not exists
        if (!content.includes("## Local Test Scheduler")) {
          const newSection = `\n## Local Test Scheduler\n\n**Status:** ✅ Production Ready\n\nA Brunella rendszer egy helyi, ütemezett tesztfuttatást végez, amely **független a GitHub Actions-tól**.\n\n### Jellemzők:\n- 📅 Napi futtatás 2:00 AM-kor (konfigurálható)\n- 🖥️ Dashboard integráció a Tests fülön\n- 🛠️ CLI parancsok: \`brunella tests\`\n- 🔧 MCP tools: test-scheduler-run, test-scheduler-status\n- 💾 Persistent SQLite results (better-sqlite3)\n\n### Használat:\n\`\`\`bash\n# Interaktív menü\nbrunella tests\n\n# Vagy közvetlenül:\nbrunella tests status      # Státusz megtekintése\nbrunella tests run         # Manuális futtatás\nbrunella tests results 5   # Legutóbbi 5 futás\n\`\`\`\n\n### Dashboard\n\nA Dashboard Tests fülén valós idejű statisztikákat látsz: pass rate, átlagos futtatási idő, trend chart (7 nap).\n`;

          const insertPos = content.indexOf("## Features");
          if (insertPos > 0) {
            const updated =
              content.slice(0, insertPos) +
              newSection +
              "\n" +
              content.slice(insertPos);
            writeFileSync(readmePath, updated);
          } else {
            // Append to end
            writeFileSync(readmePath, content + newSection);
          }
        }

        spinner.succeed("✅ README frissítve!");
        writeLine(chalk.dim(`  Fájl: ${readmePath}`));
      } catch (error: unknown) {
        spinner.fail("Hiba: " + ensureError(error).message);
      }
      process.exit(0);
    }
  });

const harvestCmd = program
  .command("harvest")
  .description("Run Tech-Harvester pipeline (scrape AI/Tech sources → LanceDB RAG)");

harvestCmd
  .command("run")
  .description("Run full harvest pipeline (harvest → refine → integrate)")
  .option("--mode <mode>", "Harvesting mode (playwright|browser-use)", "playwright")
  .option("--config <path>", "Sources config file", "myai/config/sources.json")
  .action(async (options) => {
    const ora = (await import("ora")).default;
    const chalk = (await import("chalk")).default;

    writeLine(chalk.blue("\n╔════════════════════════════════════════════════════════════════╗"));
    writeLine(chalk.blue("║") + chalk.bold("           TECH-HARVESTER PIPELINE                          ") + chalk.blue("║"));
    writeLine(chalk.blue("╚════════════════════════════════════════════════════════════════╝\n"));

    const spinner = ora("Starting harvest pipeline...").start();

    try {
      const { spawn } = await import("child_process");

      const pythonProcess = spawn("python", [
        "myai/tools/harvest_pipeline.py",
        "--mode", options.mode,
        "--config", options.config,
      ], {
        stdio: "inherit",
      });

      await new Promise((resolve, reject) => {
        pythonProcess.on("close", (code) => {
          if (code === 0) {
            spinner.succeed(chalk.green("Harvest pipeline completed successfully!"));
            resolve(undefined);
          } else {
            spinner.fail(chalk.red(`Harvest pipeline failed with exit code ${code}`));
            reject(new Error(`Exit code ${code}`));
          }
        });

        pythonProcess.on("error", (err) => {
          spinner.fail(chalk.red("Failed to start harvest pipeline"));
          reject(err);
        });
      });

    } catch (error: unknown) {
      spinner.fail(chalk.red("Harvest pipeline error"));
      console.error(chalk.red(`Error: ${ensureError(error).message}`));
      process.exit(1);
    }
  });

harvestCmd
  .command("status")
  .description("Show last harvest summary")
  .action(async () => {
    const chalk = (await import("chalk")).default;
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");

    try {
      const logPath = resolve("logs/harvest_pipeline.log");
      const logContent = readFileSync(logPath, "utf-8");

      // Extract last summary
      const lines = logContent.split("\n").reverse();
      const summaryLines: string[] = [];
      let foundSummary = false;

      for (const line of lines) {
        if (line.includes("HARVEST PIPELINE COMPLETED")) {
          foundSummary = true;
          summaryLines.push(line);
          continue;
        }

        if (foundSummary) {
          summaryLines.push(line);

          if (line.includes("HARVEST PIPELINE STARTING")) {
            break;
          }
        }
      }

      if (summaryLines.length > 0) {
        writeLine(chalk.blue("\n" + "═".repeat(80)));
        writeLine(chalk.bold("LAST HARVEST SUMMARY"));
        writeLine(chalk.blue("═".repeat(80)));
        summaryLines.reverse().forEach((line) => writeLine(line));
        writeLine(chalk.blue("═".repeat(80) + "\n"));
      } else {
        writeLine(chalk.yellow("No harvest summary found. Run 'brunella harvest run' first."));
      }

    } catch (error: unknown) {
      console.error(chalk.red(`Error reading harvest log: ${ensureError(error).message}`));
    }
  });

// Interactive Menu (Default)
if (!process.argv.slice(2).length) {
  startInteractiveMenu();
} else {
  program.parse(process.argv);
}



