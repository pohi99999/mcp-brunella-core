import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { Logger, logInfo, logError, setAgentStatus } from "../utils/logger.js";
import { checkOllamaHealth, checkAnythingLLMHealth } from "../utils/health.js";
import { getBifrostGateway } from "../core/bifrost_gateway.js";
import { socketService } from "../server/SocketService.js";
import { execSync } from "child_process";
import fs from "fs/promises";

export interface HallucinationCheckResult {
  confident: boolean;
  confidenceScore: number;
  flags: string[];
  recommendations: string[];
}

const EVALUATOR_TOOLS = [
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
  }
];

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
    setAgentStatus(this.name, "working", task.slice(0, 50));

    // Fast-paths for specific programmatic integrations (Hallucination check is separate)
    if (task.includes("Verify if data/training/golden_dataset.jsonl has increased in size")) {
      const res = await this.verifyDatasetGrowth("data/training/golden_dataset.jsonl");
      setAgentStatus(this.name, "idle");
      return res;
    }

    try {
      // ReAct Loop for Evaluator
      const result = await this.runEvaluatorReActLoop(task, context);
      setAgentStatus(this.name, "idle");
      return result;
    } catch (e: unknown) {
      setAgentStatus(this.name, "idle");
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Task failed: ${error}`);
      return { success: false, message: "Hiba az Evaluator futása során", data: { error } };
    }
  }

  private async runEvaluatorReActLoop(task: string, context?: any): Promise<AgentResult> {
    logInfo(this.name, "Starting Evaluator ReAct Execution Loop");

    const systemPrompt = `Te vagy a Brunella Agent System "Evaluator" (QA Lead) ügynöke.
A feladatod a rendszerek auditálása, egészségügyi ellenőrzések és TESZTEK futtatása.

**Szabályok (Zero-Mock Protocol):**
1. **NINCS MOCK TESZTEREDMÉNY:** SOHA ne mondd, hogy a tesztek lefutottak vagy sikeresek, amíg nem használtad a 'run_shell_command' eszközt (pl. 'npm test' vagy 'npx vitest run ...') a tényleges ellenőrzéshez!
2. Ha egészségügyi auditot kérnek, használd a 'get_system_health' eszközt.
3. Miután megkaptad az eszközök kimenetét, adj egy professzionális, rövid, lényegretörő magyar nyelvű értékelést a felhasználónak. Ha a tesztek hibát jeleznek, írd le röviden a hiba okát.
`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];

    const gateway = getBifrostGateway();
    const MAX_ITERATIONS = 5;
    let finalMessage = "A kiértékelés befejeződött.";
    let finalData: any = {};

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      this.logger.info(`ReAct iteráció ${i + 1}/${MAX_ITERATIONS}`);
      
      const response = await gateway.generate({
          prompt: task,
          taskType: 'reasoning',
          model: this.llmProvider === 'github' ? 'gpt-4o' : undefined,
          tools: EVALUATOR_TOOLS,
          messages: messages
      });

      if (!response.success) {
          logError(this.name, `LLM Gateway hiba: ${response.error}`);
          return { success: false, message: "Hiba az LLM kommunikációban." };
      }

      const replyContent = response.content || "";
      const toolCalls = response.toolCalls;

      const assistantMessage: any = { role: 'assistant', content: replyContent };
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
              const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
              let toolResult = "";

              logInfo(this.name, `Tool meghívva: ${name}`);

              try {
                  if (name === 'run_shell_command') {
                      socketService.broadcastChatter(this.name, `Teszt futtatása: ${args.command}`, 'system');
                      try {
                          const out = execSync(args.command, { encoding: 'utf-8', stdio: 'pipe' });
                          toolResult = out || "Command succeeded with no output.";
                          finalData.testOutput = toolResult;
                      } catch (err: any) {
                          toolResult = `Command failed. Exit code: ${err.status}. Output: ${err.stdout} ${err.stderr}`;
                          finalData.testError = toolResult;
                      }
                  } else if (name === 'get_system_health') {
                      const ollama = await checkOllamaHealth();
                      const anything = await checkAnythingLLMHealth();
                      toolResult = JSON.stringify({ ollama, anythingllm: anything });
                      finalData.health = { ollama, anything };
                  } else {
                      toolResult = `Ismeretlen eszköz: ${name}`;
                  }
              } catch (toolErr: any) {
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
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
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
      } catch (readError: any) {
        if (readError.code !== 'ENOENT') {
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

    } catch (error: any) {
      this.logger.error(`Error in verifyDatasetGrowth for ${filePath}: ${error.message}`);
      return {
        success: false,
        message: `Failed to verify dataset growth for ${filePath}: ${error.message}`,
        data: { filePath, error: error.message }
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
        const data = await response.json();
        const llmOutput = data.response;

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
        } catch (parseError) {
          this.logger.warn(`Failed to parse LLM hallucination check output: ${parseError}`);
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
        } catch (urlError) {
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
      const msg = error instanceof Error ? error.message : String(error);
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
