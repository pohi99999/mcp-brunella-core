import { IAgent, AgentResponse, ISwarmContext } from "./types.js";
import { logInfo, logError, setAgentStatus } from "../utils/logger.js";
import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";
import { getE2BSandboxManager } from "../security/e2b_sandbox_manager.js";

interface RefineResult {
  clean_content?: string;
  metadata?: {
    timestamps?: string;
    detected_topics?: string[];
    is_actionable?: boolean;
  };
  source?: string;
  status?: string;
  error?: string;
}

export default class DataScientistAgent implements IAgent {
  name = "DataScientist";
  description =
    "Adatok elemzésére, tisztítására és Python refiner futtatására specializálódott ügynök.";
  role = "scientist";
  capabilities = [
    "data_analysis",
    "data_refine",
    "entity_extraction",
    "python_execution",
  ];

  private apiUrl: string;
  private useE2B: boolean;

  constructor() {
    this.apiUrl =
      process.env.BRUNELLA_PYTHON_API_URL ?? "http://127.0.0.1:8000";

    // Enable E2B if API key is configured
    this.useE2B = !!(
      process.env.E2B_API_KEY &&
      process.env.E2B_API_KEY !== '' &&
      process.env.E2B_API_KEY !== 'your-e2b-api-key-here'
    );

    if (this.useE2B) {
      logInfo(this.name, 'E2B sandbox mode enabled (secure isolation)');
    } else {
      logInfo(this.name, 'E2B disabled - using subprocess (less secure)');
    }
  }

  async execute(
    task: string,
    context?: { swarm?: ISwarmContext },
  ): Promise<AgentResponse> {
    const taskLower = task.toLowerCase();
    logInfo(this.name, `Task received: ${task.slice(0, 100)}`);
    setAgentStatus(this.name, "working", task.slice(0, 80));

    // Collect input data from swarm context or task itself
    let inputContent = task;
    if (context?.swarm?.artifacts["searchResults"]) {
      const results = context.swarm.artifacts["searchResults"];
      inputContent =
        typeof results === "string" ? results : JSON.stringify(results);
      logInfo(
        this.name,
        `Using swarm searchResults (${inputContent.length} chars)`,
      );
    } else if (context?.swarm?.artifacts["rawData"]) {
      const raw = context.swarm.artifacts["rawData"];
      inputContent = typeof raw === "string" ? raw : JSON.stringify(raw);
      logInfo(this.name, `Using swarm rawData (${inputContent.length} chars)`);
    }

    try {
      // Route to appropriate operation
      if (
        taskLower.includes("tisztít") ||
        taskLower.includes("clean") ||
        taskLower.includes("refine")
      ) {
        return await this.refineData(inputContent, context);
      }
      if (
        taskLower.includes("entitás") ||
        taskLower.includes("entity") ||
        taskLower.includes("extract")
      ) {
        return await this.extractEntities(inputContent, context);
      }
      if (
        taskLower.includes("elemz") ||
        taskLower.includes("analyze") ||
        taskLower.includes("analyz")
      ) {
        return await this.analyzeData(inputContent, context);
      }

      // Default: full pipeline (refine + analyze)
      return await this.analyzeData(inputContent, context);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Execution failed: ${msg}`);
      return { status: "error", error: msg };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }

  /** Full analysis: refine + extract entities + summary */
  private async analyzeData(
    content: string,
    context?: { swarm?: ISwarmContext },
  ): Promise<AgentResponse> {
    logInfo(this.name, "Running full analysis pipeline...");
    const refined = await this.callRefiner(content);

    if (!refined || refined.status === "REJECTED") {
      logInfo(this.name, "Data rejected by refiner (low relevance)");
      return {
        status: "success",
        data: {
          result: "REJECTED",
          reason: "Low relevance - no priority topics detected",
          timestamp: new Date().toISOString(),
        },
      };
    }

    const analysis = {
      clean_content: refined.clean_content,
      topics: refined.metadata?.detected_topics ?? [],
      is_actionable: refined.metadata?.is_actionable ?? false,
      source: refined.source,
      clean_length: refined.clean_content?.length ?? 0,
      timestamp: new Date().toISOString(),
    };

    if (context?.swarm) {
      context.swarm.artifacts["analysisResult"] = analysis;
      context.swarm.history.push({
        role: "assistant",
        agent: this.name,
        content: `Analysis complete: ${analysis.topics.length} topics found, actionable: ${analysis.is_actionable}`,
      });
    }

    logInfo(
      this.name,
      `Analysis done: ${analysis.topics.length} topics, actionable=${analysis.is_actionable}`,
    );
    return { status: "success", data: analysis };
  }

  /** Data cleaning via Python refiner */
  private async refineData(
    content: string,
    context?: { swarm?: ISwarmContext },
  ): Promise<AgentResponse> {
    logInfo(this.name, "Running data refinement...");
    const refined = await this.callRefiner(content);

    if (!refined || refined.status === "REJECTED") {
      return {
        status: "success",
        data: {
          result: "REJECTED",
          reason: "Content filtered out by relevance check",
        },
      };
    }

    if (context?.swarm) {
      context.swarm.artifacts["refinedData"] = refined;
    }

    return { status: "success", data: refined };
  }

  /** Entity extraction via Python refiner */
  private async extractEntities(
    content: string,
    context?: { swarm?: ISwarmContext },
  ): Promise<AgentResponse> {
    logInfo(this.name, "Extracting entities...");
    const refined = await this.callRefiner(content);

    if (!refined?.metadata) {
      return {
        status: "success",
        data: { entities: [], is_actionable: false },
      };
    }

    const entities = {
      detected_topics: refined.metadata.detected_topics ?? [],
      is_actionable: refined.metadata.is_actionable ?? false,
      timestamp: refined.metadata.timestamps ?? new Date().toISOString(),
    };

    if (context?.swarm) {
      context.swarm.artifacts["entities"] = entities;
    }

    return { status: "success", data: entities };
  }

  /** Call Python refiner — API first, E2B second, subprocess fallback */
  private async callRefiner(
    content: string,
    source = "DataScientistAgent",
  ): Promise<RefineResult | null> {
    // Priority 1: FastAPI (fastest, already running)
    if (this.apiUrl && this.apiUrl !== "" && this.apiUrl !== "disabled") {
      try {
        return await this.callRefinerApi(content, source);
      } catch {
        logInfo(this.name, "API unavailable, trying E2B sandbox...");
      }
    }

    // Priority 2: E2B Sandbox (secure, isolated)
    if (this.useE2B) {
      try {
        return await this.callRefinerE2B(content, source);
      } catch {
        logInfo(this.name, "E2B sandbox failed, falling back to subprocess");
      }
    }

    // Priority 3: Subprocess (legacy, less secure)
    return this.callRefinerSubprocess(content, source);
  }

  /** HTTP call to FastAPI /refine endpoint */
  private async callRefinerApi(
    content: string,
    source: string,
  ): Promise<RefineResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.apiUrl}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Refiner API returned ${response.status}`);
      }

      return (await response.json()) as RefineResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** E2B Sandbox execution — secure isolated environment */
  private async callRefinerE2B(
    content: string,
    source: string
  ): Promise<RefineResult | null> {
    const manager = getE2BSandboxManager();

    // Python code to run refiner logic
    const pythonCode = `
import json
import sys

# Inline refiner logic (simplified for sandbox)
content = ${JSON.stringify(content)}
source = ${JSON.stringify(source)}

# Basic filtering
priority_keywords = [
  "AI", "machine learning", "LLM", "GPT", "Claude", "agent",
  "automation", "workflow", "integration", "API"
]

detected_topics = [kw for kw in priority_keywords if kw.lower() in content.lower()]
is_actionable = len(detected_topics) >= 2

if len(detected_topics) == 0:
  result = {"status": "REJECTED", "reason": "No priority topics"}
else:
  result = {
    "clean_content": content[:1000],  # Truncate for safety
    "metadata": {
      "detected_topics": detected_topics,
      "is_actionable": is_actionable,
      "timestamps": "2026-02-18"
    },
    "source": source,
    "status": "SUCCESS"
  }

print(json.dumps(result))
`;

    const executionResult = await manager.executeCode(pythonCode, {
      timeout_ms: 30000,
      export_artifacts: false  // No artifacts needed for refiner
    });

    if (!executionResult.success || !executionResult.output) {
      logError(this.name, `E2B execution failed: ${executionResult.error}`);
      return null;
    }

    try {
      const parsed = JSON.parse(executionResult.output) as RefineResult;
      logInfo(this.name, `E2B refiner: ${parsed.status}`);
      return parsed;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, `E2B output parse error: ${msg}`);
      return null;
    }
  }

  /** Subprocess fallback — spawn Python directly */
  private async callRefinerSubprocess(
    content: string,
    source: string,
  ): Promise<RefineResult | null> {
    const venvRel =
      process.platform === "win32"
        ? ".venv/Scripts/python.exe"
        : ".venv/bin/python";
    const pythonPath = path.resolve(config.workspaceRoot, venvRel);
    const root = config.workspaceRoot.replace(/\\/g, "/");
    const tempIn = path.join(config.systemLogDir, `ds_in_${Date.now()}.json`);
    const tempPy = path.join(config.systemLogDir, `ds_run_${Date.now()}.py`);

    try {
      await fs.mkdir(config.systemLogDir, { recursive: true });
      await fs.writeFile(tempIn, JSON.stringify({ content, source }), "utf-8");

      const pyCode = `
import sys, json, asyncio
sys.path.append('${root}')
from myai.refiner_logic import refiner
try:
    with open('${tempIn.replace(/\\/g, "/")}', 'r', encoding='utf-8') as f:
        payload = json.load(f)
    result = asyncio.run(refiner.process_data(payload))
    print(json.dumps(result) if result else json.dumps({"status": "REJECTED"}))
except Exception as e:
    print(json.dumps({"status": "ERROR", "error": str(e)}))
`;
      await fs.writeFile(tempPy, pyCode, "utf-8");

      return new Promise<RefineResult | null>((resolve) => {
        exec(
          `"${pythonPath}" "${tempPy}"`,
          { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
          async (error, stdout, stderr) => {
            await fs.unlink(tempIn).catch(() => {});
            await fs.unlink(tempPy).catch(() => {});
            try {
              const parsed = stdout.trim()
                ? (JSON.parse(stdout) as RefineResult)
                : null;
              resolve(parsed);
            } catch {
              logError(
                "DataScientist",
                `Subprocess parse error: ${stdout} | ${stderr}`,
              );
              resolve(null);
            }
          },
        );
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Subprocess IO error: ${msg}`);
      return null;
    }
  }
}
