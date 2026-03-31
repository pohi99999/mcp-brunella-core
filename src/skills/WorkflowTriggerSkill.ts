import os from "os";
import { memoryContextHandler, memoryStoreHandler } from "../tools/memoryTool.js";
import {
  captureValidationResult,
  optionalBoolean,
  optionalString,
  requireString,
  type SkillParams,
} from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

async function triggerN8nWorkflow(
  workflowId: string,
  data: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const baseUrl = (process.env.N8N_BASE_URL || "https://n8n-latest-fulv.onrender.com").trim().replace(/\/$/, "");
  const apiKey = process.env.N8N_API_KEY;

  if (!apiKey) {
    throw new Error("N8N_API_KEY nincs beállítva a környezeti változók között.");
  }

  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/run`, {
    method: "POST",
    headers: {
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data ?? {}),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n hiba: ${response.status} - ${text}`);
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function captureMonitorSnapshot(): Record<string, unknown> {
  const uptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();

  return {
    uptime,
    uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usage_percent: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)),
    },
    cpu: {
      load_avg_1m: loadAvg[0],
      load_avg_5m: loadAvg[1],
      load_avg_15m: loadAvg[2],
    },
    timestamp: new Date().toISOString(),
  };
}

function validateWorkflowTriggerSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "workflowId", "workflowId");
  });
}

export const WorkflowTriggerSkill: BrunellaSkill = {
  name: "workflow-trigger",
  description:
    "n8n munkafolyamatokat indít események alapján, monitor snapshotot rögzít, és eredményt memóriába ment.",
  version: "1.0.0",
  category: "devops",
  tools: ["n8n_trigger_workflow", "monitor_get_metrics", "monitor_tail_logs", "memory_store"],
  agents: ["ops", "DevOps"],
  validate(params: SkillParams): boolean {
    return validateWorkflowTriggerSkill(params).valid;
  },
  getValidationResult: validateWorkflowTriggerSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const workflowId = requireString(params, "workflowId", "workflowId");
      const userId = optionalString(params, "user_id") ?? "workflow-trigger";
      const remember = optionalBoolean(params, "remember") ?? true;
      const data = params.data && typeof params.data === "object" && !Array.isArray(params.data)
        ? (params.data as Record<string, unknown>)
        : undefined;

      const memoryContext = await memoryContextHandler({ user_id: userId });
      const monitorSnapshot = captureMonitorSnapshot();
      const workflowResult = await triggerN8nWorkflow(workflowId, data);

      if (remember) {
        await memoryStoreHandler({
          user_id: userId,
          key: `workflow:${workflowId}`,
          value: JSON.stringify({
            workflowId,
            data,
            workflowResult,
            monitorSnapshot,
          }),
          memory_type: "episodic",
          ttl_days: 30,
        });
      }

      return {
        success: true,
        skill: this.name,
        workflowId,
        data,
        monitorSnapshot,
        memoryContext,
        workflowResult,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        skill: this.name,
        error: message,
      };
    }
  },
};

export default WorkflowTriggerSkill;

