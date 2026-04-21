import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { loadRenderJobs, prepareResolveTimelineImportFlow, probeResolveBridge } from '@packages/utils/resolveBridgeTool.js';
import { loadTimelinePlan } from '@packages/utils/timelinePlanTool.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class ColorPrepAgent extends BaseAgent {
  name = 'ColorPrep';
  role = 'Resolve color prep and finishing handoff';
  description = 'Prepares DaVinci Resolve import, markers, and finishing instructions.';
  capabilities = ['resolve-prep', 'color-finishing-handoff', 'render-queue-planning'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const projectName = typeof payload.projectName === 'string' ? payload.projectName : 'BrunellaStudio';
    const timelinePlanPath = typeof payload.timelinePlanPath === 'string' ? payload.timelinePlanPath : undefined;
    if (!timelinePlanPath) {
      throw new Error('ColorPrepAgent: timelinePlanPath kotelezo.');
    }

    const [timelinePlan, resolveProbe, renderJobs] = await Promise.all([
      loadTimelinePlan(timelinePlanPath),
      probeResolveBridge(),
      typeof payload.renderJobsPath === 'string' ? loadRenderJobs(payload.renderJobsPath) : Promise.resolve(undefined),
    ]);
    const flow = prepareResolveTimelineImportFlow({ projectName, timelinePlan, renderJobs });
    return {
      success: true,
      message: 'Resolve finishing handoff elokeszitve.',
      data: { flow, resolveProbe },
      metadata: { operationCount: flow.operations.length },
    };
  }
}

export default ColorPrepAgent;

