import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { Logger } from "../utils/logger.js";
import { checkOllamaHealth, checkAnythingLLMHealth } from "../utils/health.js";
import { exec } from "child_process";
import util from "util";
import fs from "fs/promises"; // Import Node.js file system promises module

const execAsync = util.promisify(exec);

export interface HallucinationCheckResult {
  confident: boolean;
  confidenceScore: number;
  flags: string[];
  recommendations: string[];
}

export class EvaluatorAgent extends BaseAgent {
  name = "Evaluator";
  role = "QA_Lead";
  description = "Performs system audits, runs tests, validates health, and checks dataset growth.";
  capabilities = ["audit_system", "run_tests", "check_health", "check_file_growth"];

  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger("evaluator.log");
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || "";
    this.logger.info(`Processing task: ${task}`);

    if (task.includes("health") || task.includes("audit")) {
      return this.performAudit();
    }

    if (task.includes("test")) {
      return this.runTests();
    }

    if (task.includes("Verify if data/training/golden_dataset.jsonl has increased in size")) {
      return this.verifyDatasetGrowth("data/training/golden_dataset.jsonl");
    }

    return {
      success: false,
      message:
        "Unknown task for Evaluator. Supported tasks: health, audit, test.",
    };
  }

  private async performAudit(): Promise<AgentResult> {
    const ollama = await checkOllamaHealth();
    const anything = await checkAnythingLLMHealth();

    const isHealthy =
      ollama.status === "healthy" && anything.status === "healthy";
    const status = isHealthy ? "HEALTHY" : "DEGRADED";
    const recommendation = isHealthy
      ? "System is nominal."
      : "Check failing components.";

    return {
      success: isHealthy,
      message: `System Audit Complete: ${status}. ${recommendation}`,
      data: {
        status,
        components: {
          ollama,
          anythingllm: anything,
        },
        recommendation,
      },
    };
  }

  private async runTests(): Promise<AgentResult> {
    try {
      // Running tests via npm. Warning: this might be slow and capture a lot of output.
      // We use 'npm test' which now runs 'vitest run'
      const { stdout, stderr } = await execAsync("npm test", {
        timeout: 30000,
      });
      return {
        success: true,
        message: "Automated Tests Completed Successfully",
        data: {
          output: stdout.slice(0, 2000), // Limit output size
          errors: stderr ? stderr.slice(0, 500) : null,
        },
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Tests Failed: ${e.message}`,
        data: {
        error: e.message,
        output: e.stdout ? e.stdout.slice(0, 2000) : null,
        details: e.stderr ? e.stderr.slice(0, 500) : null,
        },
      };
    }
  }

  /**
   * Verifies if a given file has increased in size since the last check.
   * Stores and retrieves baseline size from a local JSON file.
   */
  private async verifyDatasetGrowth(filePath: string): Promise<AgentResult> {
    const baselineBaseDir = new URL('./.gemini/evaluator_baselines/', import.meta.url);
    const baselineFilePath = new URL(`${filePath.replace(/[^a-zA-Z0-9]/g, '_')}.json`, baselineBaseDir);

    try {
      // Ensure baseline directory exists
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
        // If baseline file doesn't exist, assume 0 for first run
      }

      const hasGrown = currentSize > baselineData.size;
      const message = hasGrown 
        ? `Dataset growth verified for ${filePath}. Current size: ${currentSize} bytes, Previous size: ${baselineData.size} bytes.`
        : `No significant dataset growth detected for ${filePath}. Current size: ${currentSize} bytes, Previous size: ${baselineData.size} bytes.`;

      // Update baseline
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
   * 
   * Uses Ollama (local LLM) to evaluate agent responses for:
   * - RULE-G1: Source-less fact assertions
   * - RULE-G2: Confidence below threshold (0.6)
   * - RULE-G3: Referenced URLs validation via HTTP HEAD
   * 
   * This is a soft check (non-blocking) used for audit/metrics only.
   */
  async checkHallucination(
    agentResponse: string,
    context?: { agentName?: string; task?: string }
  ): Promise<HallucinationCheckResult> {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let confidenceScore = 0.8; // Default baseline

    try {
      // RULE-G1 & G2: LLM hallucination check via Ollama
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

        // Parse LLM JSON response
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

      // RULE-G2: Confidence threshold
      if (confidenceScore < 0.6) {
        flags.push(`RULE-G2: Low confidence score (${confidenceScore.toFixed(2)})`);
        recommendations.push('Consider regenerating response or adding uncertainty caveats');
      }

      // RULE-G3: URL validation via HTTP HEAD
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const urls = agentResponse.match(urlRegex) || [];

      for (const url of urls.slice(0, 5)) { // Limit to 5 URLs
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

      // Log results (async, non-blocking)
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
        confident: true, // Fail-open (don't block on check failure)
        confidenceScore: 0.5,
        flags: [`Hallucination check error: ${msg}`],
        recommendations: ['Manual review recommended']
      };
    }
  }
}

export default EvaluatorAgent;
