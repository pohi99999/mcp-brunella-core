import { IAgent, AgentResponse } from "./types.js";
import { logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import { globalPythonShell } from "@packages/utils/pythonShell.js";
import { getBifrostGateway } from "@packages/core-logic/bifrost_gateway.js";
import { getSpecStatus, requiresSpec } from "./specStatus.js";
import { socketService } from "./SocketService.js";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { ensureError } from "@packages/utils/ensureError.js";

type DeveloperHistoryEntry = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type DeveloperAgentContext = Record<string, unknown> & {
  task?: string;
  mode?: 'interpreter' | string;
  code?: string;
  model?: string;
  branchName?: string;
  commitMessage?: string;
  trackId?: string;
  userId?: string;
  history?: DeveloperHistoryEntry[];
};

type ReActToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ReActMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ReActToolCall[];
  tool_call_id?: string;
  name?: string;
};

type ToolArgs = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

function isHistoryEntry(value: unknown): value is DeveloperHistoryEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    typeof value.content === 'string'
  );
}

function parseToolArgs(raw: string): ToolArgs {
  const parsed: unknown = JSON.parse(raw);
  return isRecord(parsed) ? parsed : {};
}

function isExecSyncError(error: unknown): error is Error & {
  status?: number;
  stdout?: string;
  stderr?: string;
} {
  return isRecord(error) && (
    'status' in error ||
    'stdout' in error ||
    'stderr' in error
  );
}

const DEVELOPER_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Beolvassa egy adott fájl tartalmát.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "A fájl relatív elérési útja (pl. src/app.ts)." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Létrehoz egy új fájlt, vagy felülír egy meglévőt a megadott tartalommal.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "A fájl relatív elérési útja." },
          content: { type: "string", description: "A fájl teljes új tartalma." }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "replace_in_file",
      description: "Kicserél egy szövegrészt egy létező fájlban.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "A fájl relatív elérési útja." },
          old_string: { type: "string", description: "A cserélendő szöveg pontos mása." },
          new_string: { type: "string", description: "Az új szöveg." }
        },
        required: ["path", "old_string", "new_string"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_shell_command",
      description: "Futtat egy shell parancsot (pl. 'npm run test', 'npm run lint', 'npx tsc').",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "A futtatandó shell parancs." }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_status_message",
      description: "Élő státuszüzenet küldése a felhasználónak a Dashboard chaten (pl. 'Fájl mentve...').",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Az üzenet szövege." }
        },
        required: ["message"]
      }
    }
  }
];

/**
 * DeveloperAgent 2.0 - Self-Healing AI Developer
 *
 * Capabilities:
 * - Code generation (TypeScript, Python, JavaScript)
 * - Automatic test generation (Vitest)
 * - Build & Test loop with auto-fix
 * - Error analysis and resolution
 * - Git operations (commit, branch)
 *
 * Uses: GPT-4o (GitHub Models) by default
 */
export class DeveloperAgent implements IAgent {
  name = "Developer";
  role = "AI Developer & Self-Healer";
  description =
    "Generates code, writes tests, fixes errors, and commits changes. Uses GPT-4o for intelligent code generation.";
  capabilities = [
    "generate_code",
    "write_tests",
    "fix_errors",
    "run_python",
    "git_commit",
    "self_heal",
  ];

  private llmProvider = process.env.LLM_PROVIDER || "github"; // GPT-4o default

  async execute(task: string, context?: DeveloperAgentContext): Promise<AgentResponse> {
    const taskDesc = task.length > 80 ? task.slice(0, 77) + "..." : task;
    setAgentStatus(this.name, "working", taskDesc);
    logInfo(this.name, `Processing: ${task}`);

    try {
      // ── SPEC GATE (RULE-SF1) ────────────────────────────────────
      const trackId = typeof context?.trackId === 'string' ? context.trackId : undefined;
      if (
        trackId &&
        requiresSpec(this.name) &&
        process.env.SKIP_SPEC_CHECK !== "true"
      ) {
        const specStatus = await getSpecStatus(trackId);
        if (specStatus !== "approved") {
          logInfo(
            this.name,
            `BLOCKED: Spec not approved for track '${trackId}' (status: ${specStatus})`,
          );
          return {
            status: "error",
            error: `SPEC_NOT_APPROVED: Track '${trackId}' spec is '${specStatus}'. Run SpecWriterAgent first.`,
            message: `Blocked by Spec Gate: spec status is '${specStatus}' for track '${trackId}'`,
          };
        }
        logInfo(this.name, `Spec gate PASSED for track '${trackId}'`);
      }
      // ── END SPEC GATE ───────────────────────────────────────────

      if (context?.mode === 'interpreter') {
        return await this.handleInterpreterTask(task, context);
      }

      if (this.isPythonTask(task, context)) {
        return await this.handlePythonExecution(task, context);
      }

      if (this.isGitTask(task)) {
        return await this.handleGitOperation(task, context);
      }

      // ReAct Loop for Developer (Replaces generic, code, test, and fix tasks)
      return await this.runDeveloperReActLoop(task, context);

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Task failed: ${error}`);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }

  private async runDeveloperReActLoop(task: string, context?: DeveloperAgentContext): Promise<AgentResponse> {
    logInfo(this.name, "Starting Developer ReAct Execution Loop");

    const systemPrompt = `Te vagy a Brunella Agent System "Developer" ügynöke (Senior Szoftvermérnök).
A feladatod a fejlesztési kérések (kódolás, tesztelés, hibajavítás) VÉGREHAJTÁSA a fájlrendszerben, nem csupán tervek vagy kódrészletek generálása a chatben.

**Szabályok (Zero-Mock Protocol):**
1. **NINCS MOCK KÓD:** Soha ne adj vissza kódot csak szövegként (Markdown blokkban) válaszként. MINDIG használd a 'write_file' vagy 'replace_in_file' eszközöket a valós módosításhoz.
2. **Élő Kódolás:** Használd a 'send_status_message' eszközt, hogy értesítsd a felhasználót, éppen melyik fájlt írod vagy teszteled.
3. **Azonnali Tesztelés:** A kódmódosítások után hívd meg a 'run_shell_command'-ot a tesztek futtatására (pl. 'npm run build', 'npx vitest run ...').
4. **Öngyógyítás:** Ha a shell parancs (teszt/build) hibát ad vissza, ne állj meg! Olvasd el a hibát, javítsd a fájlt a 'replace_in_file' vagy 'write_file' eszközzel, és próbáld újra (maximum 3 iteráción át).
5. Csak akkor fejezd be a munkát és térj vissza emberi nyelven ("Kész vagyok..."), ha a fájlok lemezre kerültek és a tesztek/buildek is lefutottak.

Kontextus a projektről: ESM modulokat használunk (imports with .js extensions), logger.ts a konzol logok helyett.
`;

    const messages: ReActMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];
    if (context) {
      messages.push({ role: 'user', content: `Kontextus: ${JSON.stringify(context)}` });
    }

    const gateway = getBifrostGateway();
    const MAX_ITERATIONS = 10;
    let finalMessage = "A feladatot feldolgoztam.";

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      logInfo(this.name, `ReAct iteráció ${i + 1}/${MAX_ITERATIONS}`);
      
      const response = await gateway.generate({
          prompt: task,
          taskType: 'code',
          model: this.llmProvider === 'github' ? 'gpt-4.1' : undefined,
          tools: DEVELOPER_TOOLS,
          messages: messages,
          userId: typeof context?.userId === 'string' ? context.userId : undefined,
      });

      if (!response.success) {
          logError(this.name, `LLM Gateway hiba: ${response.error}`);
          return { status: "error", error: "Hiba az LLM kommunikációban." };
      }

      const replyContent = response.content || "";
      const toolCalls = response.toolCalls;

      const assistantMessage: ReActMessage = { role: 'assistant', content: replyContent };
      if (toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
      }
      messages.push(assistantMessage);

      if (replyContent && (!toolCalls || toolCalls.length === 0)) {
          finalMessage = replyContent;
          socketService.broadcastChatter(this.name, finalMessage, 'assistant');
          break;
      }

      if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
              const name = toolCall.function.name;
              const args = parseToolArgs(toolCall.function.arguments);
              let toolResult: string;

              logInfo(this.name, `Tool meghívva: ${name}`);

              try {
                  if (name === 'read_file') {
                      const pathArg = getStringArg(args, 'path');
                      if (!pathArg) {
                        throw new Error('Hiányzó path paraméter.');
                      }
                      const content = await fs.readFile(pathArg, 'utf-8');
                      toolResult = content;
                  } else if (name === 'write_file') {
                      const pathArg = getStringArg(args, 'path');
                      const contentArg = getStringArg(args, 'content');
                      if (!pathArg || contentArg === undefined) {
                        throw new Error('Hiányzó path vagy content paraméter.');
                      }
                      await this.saveCode(pathArg, contentArg);
                      toolResult = "File written successfully.";
                      socketService.broadcastChatter(this.name, `Fájl mentve: ${pathArg}`, 'system');
                  } else if (name === 'replace_in_file') {
                      const pathArg = getStringArg(args, 'path');
                      const oldString = getStringArg(args, 'old_string');
                      const newString = getStringArg(args, 'new_string');
                      if (!pathArg || oldString === undefined || newString === undefined) {
                        throw new Error('Hiányzó path, old_string vagy new_string paraméter.');
                      }
                      let content = await fs.readFile(pathArg, 'utf-8');
                      if (content.includes(oldString)) {
                          content = content.replace(oldString, newString);
                          await this.saveCode(pathArg, content);
                          toolResult = "File modified successfully.";
                          socketService.broadcastChatter(this.name, `Fájl módosítva: ${pathArg}`, 'system');
                      } else {
                          toolResult = "Error: old_string not found in file.";
                      }
                  } else if (name === 'run_shell_command') {
                      const command = getStringArg(args, 'command');
                      if (!command) {
                        throw new Error('Hiányzó command paraméter.');
                      }
                      if (command.includes('rm -rf /') || command.includes('mkfs')) {
                          toolResult = "Error: Command blocked for safety reasons.";
                      } else {
                          socketService.broadcastChatter(this.name, `Parancs futtatása: ${command}`, 'system');
                          try {
                              const out = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
                              toolResult = out || "Command succeeded with no output.";
                          } catch (error: unknown) {
                              const err = isExecSyncError(error)
                                ? error
                                : { status: undefined, stdout: undefined, stderr: undefined };
                              toolResult = `Command failed. Exit code: ${err.status}. Output: ${err.stdout} ${err.stderr}`;
                          }
                      }
                  } else if (name === 'send_status_message') {
                      const message = getStringArg(args, 'message');
                      if (!message) {
                        throw new Error('Hiányzó message paraméter.');
                      }
                      socketService.broadcastChatter(this.name, message, 'assistant');
                      toolResult = "Status sent.";
                  } else {
                      toolResult = `Ismeretlen eszköz: ${name}`;
                  }
              } catch (error: unknown) {
                   const toolErr = ensureError(error);
                   logError(this.name, `Tool error (${name}): ${toolErr.message}`);
                   toolResult = `Hiba az eszköz futtatása közben: ${toolErr.message}`;
              }

              messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: name,
                  content: toolResult
              });
          }
      } else {
          break;
      }
    }

    return {
      status: "success",
      message: finalMessage
    };
  }

  // ==================== Task Type Detection ====================

  private isPythonTask(task: string, context?: DeveloperAgentContext): boolean {
    return !!(
      context?.code ||
      task.includes("print(") ||
      task.includes("import ")
    );
  }

  private isGitTask(task: string): boolean {
    return /git|commit|push|branch|merge/i.test(task);
  }

  // ==================== Python Execution ====================

  private async handleInterpreterTask(
    task: string,
    context?: DeveloperAgentContext,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🧠 AI-Interpreter mode");

    let historyText = "";
      if (context?.history && Array.isArray(context.history)) {
        const history = context.history.filter(isHistoryEntry);
        historyText = "\nELŐZMÉNYEK:\n" + history.map((h) => `${h.role === 'user' ? 'Mester' : 'Brunella'}: ${h.content}`).join('\n') + "\n";
      }

    const systemPrompt = `Te egy Python szakértő vagy, aki egy folyamatos (perzisztens) interpretert irányít.
- A Mester magyar nyelvű utasításait fordítsd valid, futtatható Python kódra.
- Az interpreter állapota MEGMARAD (változók, importok élnek a hívások között).
- Van hozzáférésed a Mester fájljaihoz az aktuális mappában.
- Fájlműveletekhez használd az 'os' és 'pathlib' modulokat.
- Ha az előzményekben a Mester korábbi kódmódosítást kért, vedd figyelembe.
- VÁLASZ: CSAK a tiszta Python kódot add vissza, markdown és magyarázat nélkül.`;

    const provider = context?.model === 'qwen2.5-coder' ? 'ollama' : this.llmProvider;
    const model = context?.model || (provider === 'ollama' ? 'qwen2.5-coder:7b' : 'gpt-4.1');

    const prompt = `${historyText}\nAKTUÁLIS UTASÍTÁS: ${task}\n\nGeneráld a Python kódot:`

    const { generateResponse } = await import("@packages/core-logic/llm_client.js");

    try {
      const code = await generateResponse(
        `System Prompt: ${systemPrompt}\n\nUser Prompt: ${prompt}`,
        provider,
        model,
      );

      logInfo(this.name, `🚀 Executing generated code via ${model}...`);
      const result = await globalPythonShell.run(code);

      return {
        status: "success",
        data: { output: result, code },
        message: "AI code executed successfully",
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `AI-Interpreter failed: ${err.message}`);
      return { status: "error", error: err.message };
    }
  }

  private async handlePythonExecution(
    task: string,
    context?: DeveloperAgentContext,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🐍 Python execution mode");

    const code = context?.code || task;

    try {
      const result = await globalPythonShell.run(code);
      return {
        status: "success",
        data: { output: result },
        message: "Python code executed successfully",
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Python execution failed: ${err.message}`);
      return { status: "error", error: err.message };
    }
  }

  // ==================== Git Operations ====================

  private async handleGitOperation(
    task: string,
    context?: DeveloperAgentContext,
  ): Promise<AgentResponse> {
    logInfo(this.name, "📦 Git operation mode");

    try {
      if (/commit/i.test(task)) {
        const message = context?.commitMessage || task;
        logInfo(this.name, `[AUTO-COMMIT] ${new Date().toISOString()} — "${message.slice(0, 80)}"`);
        execSync(`git add -A && git commit -m "${message}"`, {
          encoding: "utf-8",
        });
        return {
          status: "success",
          message: `Committed: ${message}`,
        };
      } else if (/branch/i.test(task)) {
        const branchName = context?.branchName || `feature/${Date.now()}`;
        execSync(`git checkout -b ${branchName}`, { encoding: "utf-8" });
        return {
          status: "success",
          message: `Branch created: ${branchName}`,
        };
      } else {
        return {
          status: "error",
          error: "Unsupported git operation. Use 'commit' or 'branch'.",
        };
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }

  // ==================== Utilities ====================

  private async saveCode(filePath: string, code: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, code, "utf-8");
  }
}

export default DeveloperAgent;

