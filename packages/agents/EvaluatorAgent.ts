import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { Logger, logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import { checkOllamaHealth, checkAnythingLLMHealth } from "@packages/utils/health.js";
import { getBifrostGateway, type GenerateResponse, type OpenAIToolDefinition } from "@packages/core-logic/bifrost_gateway.js";
import { socketService } from "./SocketService.js";
import { executeLocalTool } from "@apps/mcp-core/server/toolRegistry.js";
import { execSync } from "child_process";
import fs from "fs/promises";
import { ensureError } from "@packages/utils/ensureError.js";

export interface HallucinationCheckResult {
  confident: boolean;
  confidenceScore: number;
  flags: string[];
  recommendations: string[];
}

const EVALUATOR_TOOLS: OpenAIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "run_shell_command",
      description: "Futtat egy shell parancsot (pl. 'npm test', 'npm run lint') a rendszer teszteléséhez.",
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
      name: "get_system_health",
      description: "Lekéri az Ollama és az AnythingLLM státuszát.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_chaos_test_suite",
      description: "Futtat egy chaos teszt sorozatot a rendszer megbízhatóságának ellenőrzésére (időtúllépés, rate limit, korrupció).",
      parameters: {
        type: "object",
        properties: {
          testCount: { type: "number", description: "Hány tesztesetet futtasson le (alapértelmezett: 5)." }
        }
      }
    }
  }
];

type EvaluatorToolCall = NonNullable<GenerateResponse["toolCalls"]>[number];

interface EvaluatorMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: EvaluatorToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface EvaluatorRunData {
  testOutput?: string;
  testError?: string;
  health?: {
    ollama: unknown;
    anythingllm: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProperty(record: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberProperty(record: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function parseToolArguments(rawArguments: string): Record<string, unknown> {
  if (!rawArguments.trim()) {
    return {};
  }

  const parsed: unknown = JSON.parse(rawArguments);
  if (!isRecord(parsed)) {
    throw new Error("Tool arguments must be a JSON object.");
  }

  return parsed;
}

function getErrorInfo(error: unknown): { message: string; code?: string; status?: number; stdout?: string; stderr?: string } {
  const normalized = ensureError(error);
  const record = isRecord(error) ? error : undefined;

  return {
    message: normalized.message,
    code: getStringProperty(record, "code"),
    status: getNumberProperty(record, "status"),
    stdout: getStringProperty(record, "stdout"),
    stderr: getStringProperty(record, "stderr"),
  };
}

export class EvaluatorAgent extends BaseAgent {
  name = "Evaluator";
  role = "QA_Lead";
  description = "Performs system audits, runs tests, validates health, and checks dataset growth.";
  capabilities = ["audit_system", "run_tests", "check_health", "check_file_growth"];

  private llmProvider = process.env.LLM_PROVIDER || "github"; // GPT-4o default
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger("evaluator.log");
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || "";
    this.logger.info(`Processing task: ${task}`);

    // Fast-paths for specific programmatic integrations (Hallucination check is separate)
    if (task.includes("Verify if data/training/golden_dataset.jsonl has increased in size")) {
      const res = await this.verifyDatasetGrowth("data/training/golden_dataset.jsonl");
      return res;
    }

    try {
      // ReAct Loop for Evaluator
      const result = await this.runEvaluatorReActLoop(task, context);
      return result;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Task failed: ${error}`);
      return { success: false, message: "Hiba az Evaluator futása során", data: { error } };
    }
  }

  private async runEvaluatorReActLoop(task: string, context?: AgentContext): Promise<AgentResult> {
    logInfo(this.name, "Starting Evaluator ReAct Execution Loop");

    const systemPrompt = `Te vagy a Brunella Agent System "Evaluator" (QA Lead) ügynöke.
A feladatod a rendszerek auditálása, egészségügyi ellenőrzések és TESZTEK futtatása.

**Szabályok (Zero-Mock Protocol):**
1. **NINCS MOCK TESZTEREDMÉNY:** SOHA ne mondd, hogy a tesztek lefutottak vagy sikeresek, amíg nem használtad a 'run_shell_command' eszközt (pl. 'npm test' vagy 'npx vitest run ...') a tényleges ellenőrzéshez!
2. Ha egészségügyi auditot kérnek, használd a 'get_system_health' eszközt.
3. Miután megkaptad az eszközök kimenetét, adj egy professzionális, rövid, lényegretörő magyar nyelvű értékelést a felhasználónak. Ha a tesztek hibát jeleznek, írd le röviden a hiba okát.
`;

    const messages: EvaluatorMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];

    const gateway = getBifrostGateway();
    const MAX_ITERATIONS = 5;
    let finalMessage = "A kiértékelés befejeződött.";
    const finalData: EvaluatorRunData = {};
    const userId = typeof context?.userId === "string" ? context.userId : undefined;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      this.logger.info(`ReAct iteráció ${i + 1}/${MAX_ITERATIONS}`);

      const response = await gateway.generate({
        prompt: task,
        taskType: 'reasoning',
        model: this.llmProvider === 'github' ? 'gpt-4.1' : undefined,
        tools: EVALUATOR_TOOLS,
        messages: messages,
        userId,
      });

      if (!response.success) {
        logError(this.name, `LLM Gateway hiba: ${response.error}`);
        return { success: false, message: "Hiba az LLM kommunikációban." };
      }

      const replyContent = response.content || "";
      const toolCalls = response.toolCalls;

      const assistantMessage: EvaluatorMessage = { role: 'assistant', content: replyContent };
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
          let toolResult: string;

          logInfo(this.name, `Tool meghívva: ${name}`);

          try {
            const args = parseToolArguments(toolCall.function.arguments);
            if (name === 'run_shell_command') {
              const command = getStringProperty(args, 'command');
              if (!command) {
                throw new Error('Missing command argument for run_shell_command.');
              }

              socketService.broadcastChatter(this.name, `Teszt futtatása: ${command}`, 'system');
              try {
                const out = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
                toolResult = out || "Command succeeded with no output.";
                finalData.testOutput = toolResult;
              } catch (error: unknown) {
                const shellError = getErrorInfo(error);
                const output = [shellError.stdout, shellError.stderr]
                  .filter((value): value is string => typeof value === 'string' && value.length > 0)
                  .join(' ');
                toolResult = `Command failed. Exit code: ${shellError.status ?? 'unknown'}. Output: ${output || 'No output.'}`;
                finalData.testError = toolResult;
              }
            } else if (name === 'get_system_health') {
              const ollama = await checkOllamaHealth();
              const anything = await checkAnythingLLMHealth();
              toolResult = JSON.stringify({ ollama, anythingllm: anything });
              finalData.health = { ollama, anythingllm: anything };
            } else if (name === 'run_chaos_test_suite') {
              const testCount = getNumberProperty(args, 'testCount') || 5;
              socketService.broadcastChatter(this.name, `Chaos teszt sorozat indítása: ${testCount} kísérlet`, 'system');
              
              const originalChaosMode = process.env.CHAOS_MODE;
              process.env.CHAOS_MODE = 'true';
              
              const results = [];
              const testTools = ['ping', 'workspace_list_directory'];
              
              for (let i = 0; i < testCount; i++) {
                const targetTool = testTools[Math.floor(Math.random() * testTools.length)];
                try {
                  const res = await executeLocalTool(targetTool, targetTool === 'ping' ? {} : { directory: '.' });
                  results.push({ attempt: i + 1, tool: targetTool, status: 'success', data_preview: JSON.stringify(res).slice(0, 50) });
                } catch (e: unknown) {
                  const err = ensureError(e);
                  results.push({ attempt: i + 1, tool: targetTool, status: 'error_caught', message: err.message });
                }
              }
              
              process.env.CHAOS_MODE = originalChaosMode;
              toolResult = JSON.stringify({ summary: "Chaos teszt lefutott", results }, null, 2);
            } else {
              toolResult = `Ismeretlen eszköz: ${name}`;
            }
          } catch (error: unknown) {
            const toolError = ensureError(error);
            logError(this.name, `Tool error (${name}): ${toolError.message}`);
            toolResult = `Hiba az eszköz futtatása közben: ${toolError.message}`;
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
      success: !finalData.testError,
      message: finalMessage,
      data: finalData
    };
  }

  /**
   * Verifies if a given file has increased in size since the last check.
   */
  private async verifyDatasetGrowth(filePath: string): Promise<AgentResult> {
    const baselineBaseDir = new URL('./.gemini/evaluator_baselines/', import.meta.url);
    const baselineFilePath = new URL(`${filePath.replace(/[^a-zA-Z0-9]/g, '_')}.json`, baselineBaseDir);

    try {
      await fs.mkdir(baselineBaseDir, { recursive: true });

      let currentSize = 0;
      try {
        const stats = await fs.stat(filePath);
        currentSize = stats.size;
      } catch (error: unknown) {
        const fileError = ensureError(error);
        const code = getStringProperty(isRecord(error) ? error : undefined, 'code');
        if (code === 'ENOENT') {
          return {
            success: false,
            message: `File not found: ${filePath}. Cannot verify growth.`, 
            data: { filePath, error: fileError.message }
          };
        }
        throw fileError;
      }

      let baselineData: { size: number; timestamp: string } = { size: 0, timestamp: new Date(0).toISOString() };
      try {
        const baselineContent = await fs.readFile(baselineFilePath, 'utf-8');
        baselineData = JSON.parse(baselineContent);
      } catch (error: unknown) {
        const readError = ensureError(error);
        const code = getStringProperty(isRecord(error) ? error : undefined, 'code');
        if (code !== 'ENOENT') {
          this.logger.error(`Failed to read baseline for ${filePath}: ${readError.message}`);
        }
      }

      const hasGrown = currentSize > baselineData.size;
      const message = hasGrown 
        ? `Dataset growth verified for ${filePath}. Current size: ${currentSize} bytes, Previous size: ${baselineData.size} bytes.`
        : `No significant dataset growth detected for ${filePath}. Current size: ${currentSize} bytes, Previous size: ${baselineData.size} bytes.`;

      const newBaseline = { size: currentSize, timestamp: new Date().toISOString() };
      await fs.writeFile(baselineFilePath, JSON.stringify(newBaseline, null, 2), 'utf-8');

      this.logger.info(message);
      return {
        success: hasGrown,
        message,
        data: { filePath, currentSize, previousSize: baselineData.size, hasGrown, timestamp: newBaseline.timestamp }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      this.logger.error(`Error in verifyDatasetGrowth for ${filePath}: ${err.message}`);
      return {
        success: false,
        message: `Failed to verify dataset growth for ${filePath}: ${err.message}`,
        data: { filePath, error: err.message }
      };
    }
  }

  /**
   * Guardrails: LLM-as-Judge hallucination check (BAS Security Sandbox Phase 1)
   */
  async checkHallucination(
    agentResponse: string,
    context?: { agentName?: string; task?: string }
  ): Promise<HallucinationCheckResult> {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let confidenceScore = 0.8; // Default baseline

    try {
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

      const prompt = `You are a quality assurance checker. Analyze the following agent response and evaluate:

1. Does it make factual claims without citing sources?
2. Are there vague or uncertain statements?
3. Overall confidence level (0.0 - 1.0)?

Agent Response:
"""
${agentResponse}
"""

Respond with JSON:
{
  "factual_claims_without_source": boolean,
  "vague_statements": boolean,
  "confidence": number (0.0 - 1.0),
  "reasoning": string
}`;

      const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const llmOutput = isRecord(data) && typeof data.response === 'string' ? data.response : '';

        try {
          const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            confidenceScore = parsed.confidence || 0.8;

            if (parsed.factual_claims_without_source) {
              flags.push('RULE-G1: Factual claims without citation');
              recommendations.push('Add sources or references to factual statements');
            }

            if (parsed.vague_statements) {
              flags.push('Vague or uncertain statements detected');
              recommendations.push('Provide more specific details or caveats');
            }
          }
        } catch (parseError: unknown) {
          const error = ensureError(parseError);
          this.logger.warn(`Failed to parse LLM hallucination check output: ${error.message}`);
        }
      }

      if (confidenceScore < 0.6) {
        flags.push(`RULE-G2: Low confidence score (${confidenceScore.toFixed(2)})`);
        recommendations.push('Consider regenerating response or adding uncertainty caveats');
      }

      const urlRegex = /https?:\/\/[^\s)]+/g;
      const urls = agentResponse.match(urlRegex) || [];

      for (const url of urls.slice(0, 5)) {
        try {
          const headResponse = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
          });

          if (!headResponse.ok && headResponse.status >= 400) {
            flags.push(`RULE-G3: Invalid URL reference: ${url} (HTTP ${headResponse.status})`);
            recommendations.push(`Verify URL ${url} or remove it`);
          }
        } catch (urlError: unknown) {
          const error = ensureError(urlError);
          this.logger.warn(`URL check failed for ${url}: ${error.message}`);
          flags.push(`RULE-G3: Unreachable URL: ${url}`);
          recommendations.push(`Check connectivity or remove broken link: ${url}`);
        }
      }

      if (flags.length > 0) {
        this.logger.warn(`Hallucination check flags for ${context?.agentName || 'unknown'}: ${flags.join(', ')}`);
      }

      return {
        confident: confidenceScore >= 0.6 && flags.length === 0,
        confidenceScore,
        flags,
        recommendations
      };
    } catch (error: unknown) {
      const msg = ensureError(error).message;
      this.logger.error(`Hallucination check failed: ${msg}`);

      return {
        confident: true,
        confidenceScore: 0.5,
        flags: [`Hallucination check error: ${msg}`],
        recommendations: ['Manual review recommended']
      };
    }
  }
}

export default EvaluatorAgent;

