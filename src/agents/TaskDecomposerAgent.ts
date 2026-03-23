import { BaseAgent, type AgentContext, type AgentResult } from "./BaseAgent.js";
import { decomposePreview, decomposeToChain, decomposeToDAG } from "./taskDecomposerCore.js";
import { kahnSort } from "../utils/dagSort.js";
import { logError, setAgentStatus } from "../utils/logger.js";

export class TaskDecomposerAgent extends BaseAgent {
  name = "task_decomposer";
  role = "Task Decomposer";
  description =
    "Komplex feladatok dekompozíciója mikro-taskokra (preview-only, DAG).";
  capabilities = ["task_decomposition", "dag", "preview"];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = String(context.task || "").trim();
    const defaultAgent =
      typeof context.defaultAgent === "string" && context.defaultAgent.trim()
        ? context.defaultAgent.trim()
        : "Developer";
    // preview=false → ChainStep[] visszaadása az OrchestratorAgent számára
    const preview = context.preview !== false;
    const outputFormat = typeof context.outputFormat === 'string' ? context.outputFormat : 'preview';

    setAgentStatus(this.name, "working", task.slice(0, 60) || "decompose");

    try {
      if (!task) {
        return {
          success: false,
          message: "Hiányzó feladat szöveg (task)",
          data: null,
        };
      }

      if (outputFormat === 'dag') {
        const workflow = decomposeToDAG(task, { defaultAgent });
        return {
          success: true,
          message: `DAG workflow elkészült (${workflow.nodes.length} node).`,
          data: workflow,
        };
      }

      if (!preview) {
        // Execution mode: Kahn-rendezett ChainStep[] visszaadása
        const chainSteps = decomposeToChain(task, kahnSort, { defaultAgent });
        return {
          success: true,
          message: `Lánc dekompozíció kész (${chainSteps.length} lépés, Kahn-rendezett).`,
          data: { chainSteps, count: chainSteps.length },
        };
      }

      // Preview mode (default): DecompositionResult visszaadása
      const result = decomposePreview(task, { defaultAgent });
      return {
        success: true,
        message: `Dekompozíció elkészült (${result.tasks.length} mikro-task).`,
        data: result,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return {
        success: false,
        message: `TaskDecomposer hiba: ${msg}`,
        data: null,
      };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }
}

export default TaskDecomposerAgent;
