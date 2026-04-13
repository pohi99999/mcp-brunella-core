import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { studioFullPipeline, studioProbe } from '../cli/studioRuntime.js';
import { AudioMixAgent } from './AudioMixAgent.js';
import { ColorPrepAgent } from './ColorPrepAgent.js';
import { MediaIngestAgent } from './MediaIngestAgent.js';
import { QcRenderAgent } from './QcRenderAgent.js';
import { StoryCutAgent } from './StoryCutAgent.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class StudioSupervisorAgent extends BaseAgent {
  name = 'StudioSupervisor';
  role = 'Brunella Studio orchestration supervisor';
  description = 'Coordinates ingest, story cut, audio planning, Resolve prep, render, and QC for fashion promo pipelines.';
  capabilities = ['studio-orchestration', 'promo-pipeline', 'resolve-handoff', 'qc-supervision'];

  private readonly mediaIngestAgent = new MediaIngestAgent();
  private readonly storyCutAgent = new StoryCutAgent();
  private readonly audioMixAgent = new AudioMixAgent();
  private readonly colorPrepAgent = new ColorPrepAgent();
  private readonly qcRenderAgent = new QcRenderAgent();

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const task = (context.task || '').toLowerCase();

    if (task.includes('probe') || payload.phase === 'probe') {
      const result = await studioProbe();
      return { success: true, message: 'Studio probe kesz.', data: result };
    }

    if (task.includes('ingest') || payload.phase === 'ingest') {
      return this.mediaIngestAgent.executeTask(context);
    }
    if (task.includes('rough') || payload.phase === 'rough-cut') {
      return this.storyCutAgent.executeTask(context);
    }
    if (task.includes('audio') || payload.phase === 'audio-plan') {
      return this.audioMixAgent.executeTask(context);
    }
    if (task.includes('color') || task.includes('resolve') || payload.phase === 'color-prep') {
      return this.colorPrepAgent.executeTask(context);
    }
    if (task.includes('qc') || task.includes('render') || payload.phase === 'delivery') {
      return this.qcRenderAgent.executeTask(context);
    }

    const inputDir = typeof payload.inputDir === 'string' ? payload.inputDir : undefined;
    if (!inputDir) {
      throw new Error('StudioSupervisorAgent: full pipeline futtatasahoz inputDir kotelezo.');
    }
    const result = await studioFullPipeline({
      inputDir,
      projectName: typeof payload.projectName === 'string' ? payload.projectName : undefined,
      style: payload.style as never,
      targetDurationSec: typeof payload.targetDurationSec === 'number' ? payload.targetDurationSec : undefined,
      musicTrackPath: typeof payload.musicTrackPath === 'string' ? payload.musicTrackPath : undefined,
      presets: Array.isArray(payload.presets) ? payload.presets as never : undefined,
      generateProxies: typeof payload.generateProxies === 'boolean' ? payload.generateProxies : undefined,
    });
    return {
      success: result.report.status !== 'failed',
      message: `Studio pipeline kesz: ${result.report.projectName}`,
      data: result,
      metadata: { renderCount: result.report.renderJobs.length, qcCount: result.report.qcReports.length },
    };
  }
}

export default StudioSupervisorAgent;
