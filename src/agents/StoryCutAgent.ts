import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { generateTimelinePlan } from '../tools/timelinePlanTool.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class StoryCutAgent extends BaseAgent {
  name = 'StoryCut';
  role = 'Promo story cut planner';
  description = 'Builds deterministic rough-cut plans for fashion promo narratives.';
  capabilities = ['rough-cut-planning', 'segment-assembly', 'timeline-markers'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const result = await generateTimelinePlan({
      inputDir: typeof payload.inputDir === 'string' ? payload.inputDir : undefined,
      manifestPath: typeof payload.manifestPath === 'string' ? payload.manifestPath : undefined,
      projectName: typeof payload.projectName === 'string' ? payload.projectName : undefined,
      style: payload.style as never,
      targetDurationSec: typeof payload.targetDurationSec === 'number' ? payload.targetDurationSec : undefined,
      musicTrackPath: typeof payload.musicTrackPath === 'string' ? payload.musicTrackPath : undefined,
      outputPath: typeof payload.outputPath === 'string' ? payload.outputPath : undefined,
    });
    return {
      success: true,
      message: `Rough-cut terv kesz: ${result.outputPath}`,
      data: result,
      metadata: { segmentCount: result.timelinePlan.segments.length },
    };
  }
}

export default StoryCutAgent;
