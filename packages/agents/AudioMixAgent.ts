import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { generateAudioPlan } from '@packages/utils/audioPlanTool.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class AudioMixAgent extends BaseAgent {
  name = 'AudioMix';
  role = 'Studio audio planner';
  description = 'Creates beat-aware audio mix and ducking plans for promo timelines.';
  capabilities = ['audio-plan', 'ducking', 'music-cue-planning'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const musicTrackPath = typeof payload.musicTrackPath === 'string' ? payload.musicTrackPath : undefined;
    const timelinePlanPath = typeof payload.timelinePlanPath === 'string' ? payload.timelinePlanPath : undefined;
    if (!musicTrackPath || !timelinePlanPath) {
      throw new Error('AudioMixAgent: musicTrackPath es timelinePlanPath kotelezo.');
    }

    const result = await generateAudioPlan({
      timelinePlanPath,
      projectName: typeof payload.projectName === 'string' ? payload.projectName : undefined,
      musicTrackPath,
      style: payload.style as never,
      targetLufs: typeof payload.targetLufs === 'number' ? payload.targetLufs : undefined,
      outputPath: typeof payload.outputPath === 'string' ? payload.outputPath : undefined,
    });
    return {
      success: true,
      message: `Audio terv kesz: ${result.outputPath}`,
      data: result,
      metadata: { cueCount: result.audioPlan.cues.length, duckingWindows: result.audioPlan.ducking.length },
    };
  }
}

export default AudioMixAgent;

