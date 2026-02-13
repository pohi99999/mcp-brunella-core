import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { Logger } from "../utils/logger.js";
import { checkOllamaHealth, checkAnythingLLMHealth } from "../utils/health.js";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export class EvaluatorAgent extends BaseAgent {
  name = "Evaluator";
  role = "QA_Lead";
  description = "Performs system audits, runs tests, and validates health.";
  capabilities = ["audit_system", "run_tests", "check_health"];

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
}

export default EvaluatorAgent;
