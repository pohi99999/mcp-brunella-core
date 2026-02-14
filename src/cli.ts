#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { configManager } from "./utils/cliConfig.js";
import { BrunellaClient } from "./utils/mcpClient.js";
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
} from "./utils/telemetry.js";
import { getMemory } from "./utils/memoryContext.js";
import { discoverSkills } from "./utils/skillsLoader.js";
import { listHooks } from "./utils/hooks.js";
import { startInteractiveMenu } from "./interactive.js";
import { cloudflareClient } from "./utils/cloudflareClient.js";
import { registerGoldCommands } from "./cli/goldCommands.js";
import { registerDevCommands } from "./cli/devCommands.js";
import { registerTracksCommands } from "./cli/tracksCommands.js";
import { registerTaskDecomposerCommands } from "./cli/taskDecomposerCommands.js";
import { registerProgressCommands } from "./cli/progressCommands.js";
import { registerEdgeCommands } from "./cli/edgeCommands.js";

marked.setOptions({ renderer: new TerminalRenderer() as any });

const program = new Command();

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
} catch (e) {
  // ignore
}

const rawArgs = process.argv.slice(2);
const showBanner =
  !rawArgs.some(
    (a) => a === "--version" || a === "-V" || a === "--help" || a === "-h",
  ) && !(configManager.get("ui.hideBanner") as boolean);

if (showBanner && rawArgs.length > 0) {
  console.log(
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
  initTelemetryFromConfig(all as any);
  if (all?.telemetry?.enabled) {
    recordSessionStart({
      cli_version: version,
      server_url: String(all.serverUrl ?? configManager.get("serverUrl") ?? ""),
    });
  }
} catch (_) {}
process.on("beforeExit", () => {
  flushTelemetry();
});

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
    console.log(chalk.bold("Brunella CLI"));
    console.log("  Version:", version);
    console.log("  Config:  ", configManager.userSettingsPath);
    if (configManager.projectSettingsPath)
      console.log("  Project: ", configManager.projectSettingsPath);
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
      console.log(chalk.green("API key saved."));
      return;
    }
    console.log(
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
    console.log(chalk.bold("🩺 Brunella Doctor"));

    // Check Node
    console.log(`✔ Node: ${process.version}`);

    // Check Server Connection
    const client = new BrunellaClient();
    try {
      await client.connect();
      console.log(chalk.green("✔ Server: Connected"));

      // Check Agents
      const agents = await client.callTool("agent_list", {});
      // @ts-ignore
      if (agents.content[0].text) {
        console.log(chalk.green("✔ Agents: Active"));
      }
    } catch (e: any) {
      console.log(chalk.red(`✖ Server: Connection failed (${e.message})`));
    } finally {
      await client.close();
    }
  });

// --- connect (MCP)
program
  .command("connect <serverName>")
  .description("Connect to an external MCP server (github, chrome, docker)")
  .action(async (serverName: string) => {
    console.log(chalk.cyan(`Connecting to ${serverName}...`));
    console.log(chalk.dim("Feature coming soon: Dynamic MCP config update."));
    console.log(
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
    try {
      await client.connect();
      const result = await client.listTools();
      const tools = result.tools;

      console.log(chalk.bold(`Available Tools (${tools.length}):`));
      for (const tool of tools) {
        console.log(
          chalk.green("• " + tool.name) +
            (tool.description ? ": " + chalk.dim(tool.description) : ""),
        );
      }
    } catch (error: any) {
      console.error(chalk.red("Error fetching tools:"), error.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- agents (list)
program
  .command("agents")
  .description("List all registered AI agents")
  .action(async () => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      // Use the agent_list tool
      const result = await client.callTool("agent_list", {});
      // @ts-ignore
      const text = result.content?.[0]?.text;
      if (text) {
        console.log(chalk.bold("Registered Agents:"));
        console.log(text);
      } else {
        console.log(
          chalk.yellow("No agents found or tool returned empty result."),
        );
      }
    } catch (error: any) {
      console.error(chalk.red("Error fetching agents:"), error.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- agent (execute specific agent)
program
  .command("agent <agentName> <task>")
  .description("Execute a specific agent with a task")
  .option("--context <json>", "Context as JSON string")
  .option("--json", "Output raw JSON response")
  .action(
    async (
      agentName: string,
      task: string,
      cmd?: { opts: () => { context?: string; json?: boolean } },
    ) => {
      const opts = cmd?.opts?.() ?? {};
      let context: any = {};

      if (opts.context) {
        try {
          context = JSON.parse(opts.context);
        } catch (e) {
          console.error(chalk.red("Invalid JSON in --context"));
          process.exit(1);
        }
      }

      const spinner = ora(`Executing ${chalk.cyan(agentName)}...`).start();
      const client = new BrunellaClient();

      try {
        await client.connect();

        // Call agent_execute tool
        const result = await client.callTool("agent_execute", {
          agentName,
          task,
          context: JSON.stringify(context),
        });

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          // @ts-ignore
          const text = result.content?.[0]?.text;
          if (text) {
            console.log(chalk.bold(`\n✅ ${agentName} Response:`));
            console.log(text);
          } else {
            console.log(chalk.yellow("Agent returned empty response"));
          }
        }
      } catch (error: any) {
        spinner.fail(chalk.red(`${agentName} failed`));
        console.error(chalk.red("Error:"), error.message);
        process.exit(1);
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
            Object.assign(parsedArgs, JSON.parse(arg));
          } catch {}
        }
      }

      const client = new BrunellaClient();
      try {
        await client.connect();
        const result = await client.callTool(toolName, parsedArgs);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          // @ts-ignore
          const text = result.content?.[0]?.text;
          if (text) console.log(text);
          else console.log(JSON.stringify(result, null, 2));
        }
      } catch (error: any) {
        console.error(chalk.red("Tool execution failed:"), error.message);
        process.exit(1);
      } finally {
        await client.close();
        process.exit(0);
      }
    },
  );

// --- chat
program
  .command("chat")
  .description("Interactive chat with Brunella")
  .action(async () => {
    marked.setOptions({ renderer: new TerminalRenderer() as any });

    console.log(chalk.cyan("Starting chat..."));
    console.log(chalk.dim("Type 'exit' to quit"));
    console.log(chalk.dim("Commands:"));
    console.log(
      chalk.dim("  /switch  - Change AI Model (GPT-4.1, Gemini, Ollama)"),
    );
    console.log(chalk.dim("  /edge    - Toggle Edge Mode (Cloudflare)"));
    console.log(chalk.dim("  /jules   - Jules AI delegálás (new/sync/status)"));
    console.log(
      chalk.dim(
        "  /conductor <action> - Run Conductor tasks (status, sync, track)",
      ),
    );
    console.log(chalk.dim("  /tools   - List available tools"));
    console.log(chalk.dim("  /ls [path] - List files (Coding Agent)"));
    console.log(chalk.dim("  /read <path> - Read file (Coding Agent)"));
    console.log(chalk.dim("  /eval <code> - Run Python code directly"));
    console.log(chalk.dim("  /clear   - Clear conversation history"));

    const client = new BrunellaClient();
    try {
      await client.connect();

      // Session State
      let history: Array<{ role: "user" | "assistant"; content: string }> = [];
      let activeProvider: "ollama" | "gemini" | "github" = "github";
      let activeModel: string = "gpt-4o"; // Updated to valid model

      let edgeMode = false;

      console.log(
        chalk.green(
          `\n✔ Active Model: ${chalk.bold(activeModel)} (${activeProvider})\n`,
        ),
      );

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
          console.log(chalk.yellow("Conversation history cleared."));
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/jules")) {
          const parts = trimmed.toLowerCase().split(" ");
          const action = parts[1];

          if (!action || action === "help") {
            console.log(chalk.cyan("\n🤖 Jules Commands:"));
            console.log(
              chalk.dim("  /jules new     - Új Jules task létrehozás"),
            );
            console.log(
              chalk.dim("  /jules sync    - GitHub Jules branch-ek pullolása"),
            );
            console.log(
              chalk.dim("  /jules status  - Sessions + branch-ek státusza"),
            );
            console.log(
              chalk.dim("  /jules menu    - Interaktív menü indítás\n"),
            );
            continue;
          }

          if (action === "menu") {
            console.log(chalk.cyan("Launching Jules interactive menu..."));
            // Import and run interactive menu
            try {
              const { execSync } = await import("child_process");
              execSync("node build/cli-jules-interactive.js", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (e: any) {
              console.log(chalk.red(`Error launching menu: ${e.message}`));
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
              console.log(
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
              } catch (e: any) {
                console.log(chalk.red(`Error: ${e.message}`));
              }
            }
            continue;
          }

          if (action === "sync") {
            console.log(chalk.cyan("\n🔄 Jules sync indítás...\n"));
            try {
              const { execSync } = await import("child_process");
              execSync("python scripts/jules_sync_watchdog.py --once", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (e: any) {
              console.log(chalk.red(`Error: ${e.message}`));
            }
            continue;
          }

          if (action === "status") {
            console.log(chalk.cyan("\n📊 Jules status...\n"));
            try {
              const { execSync } = await import("child_process");
              execSync("python scripts/jules_api_client.py list 5", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
              console.log("");
              execSync("python scripts/jules_sync_watchdog.py --check", {
                stdio: "inherit",
                cwd: process.cwd(),
              });
            } catch (e: any) {
              console.log(chalk.red(`Error: ${e.message}`));
            }
            continue;
          }

          console.log(chalk.red("Unknown Jules command. Use /jules help"));
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/edge")) {
          edgeMode = !edgeMode;
          console.log(
            edgeMode
              ? chalk.cyan("Edge mode enabled (Cloudflare).")
              : chalk.yellow("Edge mode disabled (Local/API)."),
          );
          continue;
        }

        if (trimmed.toLowerCase().startsWith("/switch")) {
          const parts = trimmed.split(" ");
          // Interactive selection if just '/switch'
          if (parts.length === 1) {
            const { provider } = await inquirer.prompt([
              {
                type: "list",
                name: "provider",
                message: "Select AI Provider:",
                choices: ["github", "gemini", "ollama"],
              },
            ]);

            let modelChoices: string[] = [];
            if (provider === "github")
              modelChoices = ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini"];

            if (provider === "gemini")
              modelChoices = [
                "gemini-2.5-flash",
                "gemini-2.0-flash",
                "gemini-flash-latest",
                "gemini-2.5-pro",
              ];
            if (provider === "ollama")
              modelChoices = ["llama3.1:8b", "deepseek-r1:8b", "qwen2.5-coder"];

            const { model } = await inquirer.prompt([
              {
                type: "list",
                name: "model",
                message: "Select Model:",
                choices: modelChoices,
              },
            ]);

            activeProvider = provider;
            activeModel = model;
          } else {
            // Quick switch: /switch gemini
            const target = parts[1].toLowerCase();
            if (target === "github") {
              activeProvider = "github";
              activeModel = "gpt-4o";
            } else if (target === "gemini") {
              activeProvider = "gemini";
              activeModel = "gemini-2.5-flash";
            } else if (target === "ollama") {
              activeProvider = "ollama";
              activeModel = "llama3.1:8b";
            } else {
              console.log(
                chalk.red(
                  "Unknown provider. Use interactive mode (just /switch) or github/gemini/ollama.",
                ),
              );
              continue;
            }
          }

          console.log(chalk.green(`✔ Switched to: ${chalk.bold(activeModel)}`));
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
            const edgeResult = await cloudflareClient.submitTask(prompt, {
              history,
            });
            responseText =
              typeof edgeResult.result === "string"
                ? edgeResult.result
                : edgeResult.result?.response ||
                  edgeResult.message ||
                  JSON.stringify(edgeResult);
          } else {
            // Local / API Providers via Tools
            let result: any;

            if (activeProvider === "github") {
              result = await client.callTool("github_models_generate", {
                prompt,
                model: activeModel,
                system: "You are Brunella, a helpful AI assistant.",
              });
            } else if (activeProvider === "gemini") {
              result = await client.callTool("gemini_generate", {
                prompt,
                model: activeModel,
              });
            } else if (activeProvider === "ollama") {
              result = await client.callTool("ollama_generate", {
                prompt,
                model: activeModel,
              });
            } else {
              // Fallback Agent
              result = await client.callTool("agent_delegate", {
                agent_name: "Orchestrator",
                task: prompt,
                context: { history, provider: activeProvider },
              });
            }

            // Parse Tool Result safely
            if (
              result &&
              result.content &&
              Array.isArray(result.content) &&
              result.content.length > 0
            ) {
              responseText = result.content[0].text;
            } else if (result && result.message) {
              responseText = result.message;
            } else {
              responseText = JSON.stringify(result, null, 2);
            }
          }

          spinner.stop();

          // Render Markdown
          console.log(marked(responseText));
          history.push({ role: "assistant", content: responseText });
        } catch (err: any) {
          spinner.stop();
          console.error(chalk.red("\nError:"), err.message);
        }
      }
    } catch (e: any) {
      console.error(chalk.red("\nConnection failed:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// --- interpreter
program
  .command("interpreter")
  .description("Interactive Python Interpreter")
  .action(async () => {
    console.log(
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
        // @ts-ignore
        console.log(result.content[0].text);
      }
    } catch (e: any) {
      console.log(chalk.red(e.message));
    } finally {
      await client.close();
      process.exit(0);
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
      await client.connect();
      const result = await client.callTool("agent_delegate", {
        agent_name: "ProjectConductor",
        task: "status",
      });
      spinner.stop();
      // @ts-ignore
      const text = result.content?.[0]?.text || "No response";

      try {
        const json = JSON.parse(text);
        if (json.data && json.data.report) {
          console.log(marked(json.data.report));
        } else if (json.message) {
          console.log(marked(json.message));
        } else {
          console.log(marked(text));
        }
      } catch (e) {
        console.log(marked(text));
      }
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

conductorCmd
  .command("chat")
  .description("Interactive chat with Project Conductor")
  .action(async () => {
    process.env.BRUNELLA_QUIET_LOGS = "true";
    console.log(
      chalk.blue(
        boxen("Project Conductor Chat", { padding: 1, borderStyle: "round" }),
      ),
    );
    console.log(chalk.dim("Type 'exit' to quit."));

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

          const text =
            (result as any).content?.[0]?.text ||
            (result as any).message ||
            "No response";

          let responseText = text;
          try {
            const json = JSON.parse(text);
            responseText =
              json.message || json.data?.text || JSON.stringify(json, null, 2);
          } catch {}

          console.log(marked(responseText));

          history.push({ role: "user", content: message });
          history.push({ role: "assistant", content: responseText });
        } catch (e: any) {
          spinner.stop();
          console.error(chalk.red("Error:"), e.message);
        }
      }
    } catch (e: any) {
      console.error(chalk.red("Connection error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
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
        task: "sync",
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || "Sync completed";
      console.log(chalk.green("✓"), response);
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
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
        task: "health",
      });
      spinner.stop();
      // @ts-ignore
      const response = result.content?.[0]?.text || "Health check completed";
      console.log(marked(response));
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
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
      // @ts-ignore
      const response = result.content?.[0]?.text || "Done";
      console.log(marked(response));
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

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
          const data = (await res.json()) as any;
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

          const runs = (data?.runs || []) as Array<any>;
          if (runs.length === 0) {
            console.log(
              chalk.yellow(
                "Nincs futás (vagy hiányzik a GITHUB_TOKEN a szerveren).",
              ),
            );
            return;
          }

          console.log(
            chalk.bold(`\nWorkflow: ${workflow} (top ${runs.length})\n`),
          );

          // Trend Analysis
          const successCount = runs.filter((r: any) => r.conclusion === "success").length;
          const failureCount = runs.filter((r: any) => r.conclusion === "failure").length;
          const passRate = runs.length > 0 ? Math.round((successCount / runs.length) * 100) : 0;

          console.log(chalk.cyan("📊 Trend Analysis (last " + runs.length + " runs):"));
          console.log(
            `  ✅ Success: ${chalk.green(successCount)} | ❌ Failure: ${chalk.red(failureCount)} | ⚡ Pass Rate: ${passRate >= 90 ? chalk.green(passRate + "%") : passRate >= 70 ? chalk.yellow(passRate + "%") : chalk.red(passRate + "%")}\n`,
          );

          // ASCII Chart (simple bar)
          const barLength = 40;
          const successBar = "█".repeat(Math.round((successCount / runs.length) * barLength));
          const failureBar = "█".repeat(Math.round((failureCount / runs.length) * barLength));
          console.log(chalk.green("  Success: " + successBar));
          console.log(chalk.red("  Failure: " + failureBar) + "\n");

          // List runs
          for (const r of runs) {
            const status = String(r.status || "unknown");
            const concl = r.conclusion == null ? "-" : String(r.conclusion);
            const when = String(r.updated_at || r.created_at || "")
              .slice(0, 19)
              .replace("T", " ");
            const icon = concl === "success" ? chalk.green("✅") : concl === "failure" ? chalk.red("❌") : "⏸️";
            console.log(
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
          const data = (await res.json()) as any;
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          console.log(
            chalk.green(
              `✅ Workflow indítva: ${data.workflow} (ref=${data.ref})`,
            ),
          );
        }
      } catch (e: any) {
        console.error(chalk.red("Hiba:"), e?.message || String(e));
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
    } catch (e: any) {
      console.error(chalk.red("Error launching menu:"), e.message);
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
      console.log(chalk.cyan(`\n🚀 Jules task: "${prompt.slice(0, 60)}..."\n`));
      try {
        const { execSync } = await import("child_process");
        execSync(`python scripts/jules_api_client.py create "${prompt}"`, {
          stdio: "inherit",
          cwd: process.cwd(),
        });
      } catch (e: any) {
        console.error(chalk.red("Error:"), e.message);
        process.exit(1);
      }
    }
  });

julesCmd
  .command("sync")
  .description("Sync Jules GitHub branches (pull latest)")
  .action(async () => {
    console.log(chalk.cyan("\n🔄 Jules sync...\n"));
    try {
      const { execSync } = await import("child_process");
      execSync("python scripts/jules_sync_watchdog.py --once", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (e: any) {
      console.error(chalk.red("Error:"), e.message);
      process.exit(1);
    }
  });

julesCmd
  .command("status")
  .description("Show Jules sessions and branch status")
  .action(async () => {
    console.log(chalk.cyan("\n📊 Jules status...\n"));
    try {
      const { execSync } = await import("child_process");
      execSync("python scripts/jules_api_client.py list 5", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      console.log("");
      execSync("python scripts/jules_sync_watchdog.py --check", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (e: any) {
      console.error(chalk.red("Error:"), e.message);
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
    const { AgentArchitect } = await import("./agents/AgentArchitect.js");

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
      console.log(chalk.red("\n❌ Description too short. Please provide at least 10 characters.\n"));
      return;
    }

    console.log(chalk.cyan(`\n🏗️  Agent Architect - Creating agent...\n`));
    console.log(chalk.dim(`Description: ${desc}\n`));

    const spinner = ora("Analyzing description...").start();

    try {
      // Extract name, role, capabilities from description using LLM
      const { generateResponse } = await import("./core/llm_client.js");

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
        console.log(chalk.dim(`\nAgent name: ${chalk.white(agentConfig.name)}`));
        console.log(chalk.dim(`Role: ${chalk.white(agentConfig.role)}`));
        console.log(chalk.dim(`Capabilities: ${chalk.white(agentConfig.capabilities.join(", "))}`));
        console.log(chalk.dim(`\n📁 Files created:`));
        console.log(chalk.dim(`  - myai/agents/${agentConfig.name}.toml`));
        console.log(chalk.dim(`  - registry.json (updated)`));
        console.log(chalk.cyan(`\n🚀 Run: ${chalk.white(`brunella agents`)}\n`));
      } else {
        spinner.fail(chalk.red(`❌ ${result.message}`));
      }
    } catch (e: any) {
      spinner.fail(chalk.red(`❌ Error: ${e.message}`));
      console.error(chalk.dim(e.stack));
      process.exit(1);
    }
  });

// Register Gold Protocol commands (G7.7)
registerGoldCommands(program);

// Register Developer Agent commands (P2)
registerDevCommands(program);

// Register Tracks commands (EPP v2)
registerTracksCommands(program);

// Register Task Decomposer commands (TaskAgents)
registerTaskDecomposerCommands(program);

// Register Track progress / TODO commands (Dashboard TODO Widget)
registerProgressCommands(program);

// Register Edge commands (Cloudflare)
registerEdgeCommands(program);

// ════════════════════════════════════════════════════════════════════════════
// TESTS COMMAND (Test Scheduler)
// ════════════════════════════════════════════════════════════════════════════

const testsCmd = program
  .command("tests")
  .description("Manage test scheduling and results")
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
      console.log(chalk.gray("Visszavonva."));
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
        console.log(chalk.dim(`  Fájl: ${specPath}`));
      } catch (e: any) {
        spinner.fail("Hiba: " + e.message);
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
      console.log(chalk.green("✅ Szerver elindítva!"));
      console.log(chalk.cyan("📱 Nyisd meg: http://localhost:3000"));
      console.log(chalk.dim("Kilépéshez: Ctrl+C\n"));
      proc.on("exit", (code) => process.exit(code || 0));
    } else if (action === "push") {
      // Git push
      const spinner = ora("Git push (origin/main)...").start();
      const { execSync } = await import("child_process");
      try {
        execSync("git push origin main", { cwd: process.cwd(), stdio: "pipe" });
        spinner.succeed("✅ Git push sikeres!");
      } catch (e: any) {
        spinner.fail("Hiba: " + e.message);
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
        console.log(chalk.dim(`  Fájl: ${readmePath}`));
      } catch (e: any) {
        spinner.fail("Hiba: " + e.message);
      }
      process.exit(0);
    }
  });

testsCmd
  .command("status")
  .description("Show test scheduler status and statistics")
  .action(async () => {
    const client = new BrunellaClient();
    const spinner = ora("Fetching test scheduler status...").start();
    try {
      await client.connect();
      const result = await client.callTool("test-scheduler-status", {
        includeDetails: true,
      });
      spinner.stop();
      // @ts-ignore
      const text = result.content?.[0]?.text || JSON.stringify(result);
      const data = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));

      console.log(chalk.bold("\n📊 Test Scheduler Status\n"));
      console.log(`Schedule: ${chalk.cyan(data.schedule)}`);
      console.log(`Enabled:  ${data.enabled ? chalk.green("✓") : chalk.red("✗")}`);
      console.log(`Active:   ${data.active ? chalk.green("✓") : chalk.red("✗")}`);
      
      if (data.stats) {
        console.log(chalk.bold("\n📈 Statistics (7 days)\n"));
        console.log(`  Pass Rate:       ${chalk.green(data.stats.sevenDayPassRate)}`);
        console.log(`  Total Runs:      ${chalk.cyan(data.stats.totalRuns)}`);
        console.log(`  Avg Duration:    ${chalk.cyan(data.stats.averageDuration)}`);
        console.log(`  Last Run Status: ${data.stats.lastRunStatus === "passed" ? chalk.green("✓ Passed") : chalk.red("✗ Failed")}`);
        console.log(`  Last Run Time:   ${chalk.dim(data.stats.lastRunTime)}`);
      }

      if (data.recentRuns && data.recentRuns.length > 0) {
        console.log(chalk.bold("\n📋 Recent Runs (Last 5)\n"));
        data.recentRuns.forEach((run: any, i: number) => {
          const status = run.status === "passed" ? chalk.green("✓") : chalk.red("✗");
          console.log(`  ${i + 1}. ${status} (${run.passed}✓ / ${run.failed}✗) @ ${run.startedAt}`);
        });
      }
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

testsCmd
  .command("run")
  .description("Trigger a manual test run immediately")
  .option("--reason <reason>", "Reason for triggering", "Manual CLI trigger")
  .action(async (options) => {
    const client = new BrunellaClient();
    const spinner = ora("Triggering test run...").start();
    try {
      await client.connect();
      const result = await client.callTool("test-scheduler-run", {
        triggerReason: options.reason,
      });
      spinner.stop();
      // @ts-ignore
      const text = result.content?.[0]?.text || JSON.stringify(result);
      const data = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));

      if (data.success) {
        console.log(chalk.bold("\n✅ Test Run Triggered\n"));
        console.log(`Run ID:  ${chalk.cyan(data.runId)}`);
        console.log(`Status:  ${chalk.green(data.status)}`);
        console.log(chalk.dim("\nMonitor progress in browser or use 'brunella tests status'"));
      } else {
        console.error(chalk.red("Failed to trigger test run:"), data.error);
      }
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

testsCmd
  .command("results [count]")
  .description("Show recent test run results")
  .action(async (count: string) => {
    const client = new BrunellaClient();
    const limit = parseInt(count || "10");
    const spinner = ora("Fetching test results...").start();
    try {
      await client.connect();
      
      // Fetch results via HTTP (CLI-friendly)
      const response = await fetch("http://localhost:3000/api/tests/results?limit=" + limit);
      spinner.stop();
      
      if (!response.ok) throw new Error("Failed to fetch results");
      
      const data = (await response.json()) as { runs: any[] };
      console.log(chalk.bold(`\n🧪 Recent Test Runs (Last ${limit})\n`));

      if (data.runs.length === 0) {
        console.log(chalk.dim("No test runs found"));
      } else {
        data.runs.forEach((run: any, i: number) => {
          const status = run.status === "passed" ? chalk.green("✓") : chalk.red("✗");
          const duration = run.duration || "N/A";
          console.log(`${i + 1}. ${status} ID: ${chalk.cyan(run.id)} | ${run.passed}✓ ${run.failed}✗ | ${duration}`);
          console.log(`   Started: ${chalk.dim(new Date(run.startedAt).toLocaleString("hu-HU"))}`);
        });
      }
    } catch (e: any) {
      spinner.stop();
      console.error(chalk.red("Error:"), e.message);
    } finally {
      await client.close();
      process.exit(0);
    }
  });

// ════════════════════════════════════════════════════════════════════════════
// HARVEST COMMAND (Tech-Harvester Pipeline)
// ════════════════════════════════════════════════════════════════════════════

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

    console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════╗"));
    console.log(chalk.blue("║") + chalk.bold("           TECH-HARVESTER PIPELINE                          ") + chalk.blue("║"));
    console.log(chalk.blue("╚════════════════════════════════════════════════════════════════╝\n"));

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

    } catch (error: any) {
      spinner.fail(chalk.red("Harvest pipeline error"));
      console.error(chalk.red(`Error: ${error.message}`));
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
        console.log(chalk.blue("\n" + "═".repeat(80)));
        console.log(chalk.bold("LAST HARVEST SUMMARY"));
        console.log(chalk.blue("═".repeat(80)));
        summaryLines.reverse().forEach((line) => console.log(line));
        console.log(chalk.blue("═".repeat(80) + "\n"));
      } else {
        console.log(chalk.yellow("No harvest summary found. Run 'brunella harvest run' first."));
      }

    } catch (error: any) {
      console.error(chalk.red(`Error reading harvest log: ${error.message}`));
    }
  });

// Interactive Menu (Default)
if (!process.argv.slice(2).length) {
  startInteractiveMenu();
} else {
  program.parse(process.argv);
}
