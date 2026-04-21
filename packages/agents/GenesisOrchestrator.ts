import { BaseAgent, type AgentContext, type AgentResult } from "./BaseAgent.js";
import { logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import type { SpecDocument, AgentTaskQueueItem } from "@packages/types/blueprint.js";
import { agentManager } from "@packages/agents/AgentManager.js";
import { ensureError } from "@packages/utils/ensureError.js";

type SpecMetadataCarrier = {
  spec?: SpecDocument;
};

function readSpecDocument(context: AgentContext): SpecDocument | undefined {
  const metadata = context.metadata;
  if ((typeof metadata !== "object" || metadata === null) && typeof metadata !== "function") {
    return undefined;
  }

  return (metadata as SpecMetadataCarrier).spec;
}

/**
 * GenesisOrchestrator - Szoftver-Genesis Karmester
 * 
 * Feladata: A SpecWriterAgent által generált SpecDocument belső task-sorának 
 * (agent_task_queue) automatikus végrehajtása. Koordinálja a fejlesztőket (DeveloperAgent), 
 * tesztelőket (EvaluatorAgent) és más ügynököket a projekt felépítéséhez.
 */
export class GenesisOrchestrator extends BaseAgent {
  name = "GenesisOrchestrator";
  role = "Software Genesis Orchestrator";
  description = "A SpecDocument alapján automatikusan végrehajtja a szoftverfejlesztési taskokat.";
  capabilities = ["task_orchestration", "parallel_execution", "progress_tracking", "genesis_protocol"];

  private _activeExecutions: Map<string, string> = new Map(); // taskId -> status
  private _completedTasks: string[] = [];
  private _failedTasks: string[] = [];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || "").toLowerCase();

    try {
      if (task.includes("genesis") || task.includes("futtasd") || task.includes("run")) {
        const spec = readSpecDocument(context);
        if (!spec) {
          return { success: false, message: "Hiányzó SpecDocument (metadata.spec). Először generálj egyet a SpecWriterAgent-tel." };
        }
        return await this.orchestrateGenesis(spec);
      }

      if (task.includes("status") || task.includes("státusz")) {
        return {
          success: true,
          message: `📊 Genesis Státusz: ${this._completedTasks.length} kész, ${this._activeExecutions.size} folyamatban, ${this._failedTasks.length} hiba.`,
          data: {
            active: Array.from(this._activeExecutions.keys()),
            completed: this._completedTasks,
            failed: this._failedTasks
          }
        };
      }

      return {
        success: false,
        message: "Ismeretlen feladat. Próbáld: 'futtasd a genesis protokolt a specifikáció alapján'.",
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, err.message);
      return { success: false, message: `Hiba: ${err.message}` };
    }
  }

  /**
   * Orchestrate Genesis Protocol execution
   * Drives the task queue sequentially or in parallel based on dependencies
   */
  private async orchestrateGenesis(spec: SpecDocument): Promise<AgentResult> {
    logInfo(this.name, `🚀 Genesis indítása: ${spec.app_name}`);
    logInfo(this.name, `   Összesen ${spec.total_tasks} task vár végrehajtásra.`);

    const queue = spec.agent_task_queue;

    for (const item of queue) {
      logInfo(this.name, `⚡ Task delegálása: ${item.task_id} [${item.agent}]`);
      this._activeExecutions.set(item.task_id, "working");

      try {
        const targetAgent = agentManager.getAgent(item.agent);
        if (!targetAgent) {
          throw new Error(`Ágens nem található: ${item.agent}`);
        }

        // Real execution happens here
        logInfo(this.name, `   -> ${item.agent}: ${item.prompt.slice(0, 60)}...`);
        
        // Simulating result for now (Phase 3 is the orchestrator implementation)
        // In next phases, we would actually call execute() here.
        // const result = await targetAgent.execute(item.prompt, { task_id: item.task_id });
        const result: { status: string; message: string; error?: string } = { status: 'success', message: `${item.task_id} szimuláltan végrehajtva.` };

        if (result.status === "success") {
          this._completedTasks.push(item.task_id);
          this._activeExecutions.delete(item.task_id);
          logInfo(this.name, `   ✅ ${item.task_id} kész.`);
        } else {
          throw new Error(result.error || "Ismeretlen hiba");
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logError(this.name, `   ❌ ${item.task_id} hiba: ${errorMsg}`);
        this._failedTasks.push(item.task_id);
        this._activeExecutions.set(item.task_id, "failed");
        // Ha P0/kritikus task, akkor álljunk le?
        // EPP v2 Rule #7: 0-Hiba Stratégia.
        return { 
          success: false, 
          message: `Genesis leállítva: Hiba a(z) ${item.task_id} tasknál.`,
          data: { failed_task: item.task_id, error: errorMsg }
        };
      }
    }

    return {
      success: true,
      message: `✨ Genesis protokoll befejezve: ${spec.app_name} | ${this._completedTasks.length}/${spec.total_tasks} task kész.`,
      data: {
        app_name: spec.app_name,
        total: spec.total_tasks,
        completed: this._completedTasks.length,
      }
    };
  }
}

export default GenesisOrchestrator;

