import { N8nClient } from "@packages/utils/n8nClient.js";
import {
  captureValidationResult,
  requireString,
  type SkillParams,
} from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

async function triggerN8nWorkflow(
  workflowId: string,
  data: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const n8nClient = new N8nClient();
  const result = await n8nClient.triggerWorkflowAsync(workflowId, data);
  return { taskId: result.executionId };
}

function validateWorkflowTriggerSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "workflowId", "workflowId");
  });
}

export const WorkflowTriggerSkill: BrunellaSkill = {
  name: "workflow-trigger",
  description:
    "n8n munkafolyamatokat indít események alapján (aszinkron).",
  version: "1.1.0", // Version bump
  category: "devops",
  tools: ["n8n_trigger_workflow"],
  agents: ["ops", "DevOps"],
  validate(params: SkillParams): boolean {
    return validateWorkflowTriggerSkill(params).valid;
  },
  getValidationResult: validateWorkflowTriggerSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const workflowId = requireString(params, "workflowId", "workflowId");
      const data = params.data && typeof params.data === "object" && !Array.isArray(params.data)
        ? (params.data as Record<string, unknown>)
        : undefined;

      const workflowResult = await triggerN8nWorkflow(workflowId, data);

      return {
        success: true,
        skill: this.name,
        workflowId,
        ...workflowResult,
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


