import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { runQcChecks } from '../tools/qcTool.js';
import { renderTimelinePlan } from '../tools/renderPresetTool.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class QcRenderAgent extends BaseAgent {
  name = 'QcRender';
  role = 'Render and QC executor';
  description = 'Builds baseline FFmpeg renders and validates them with studio QC heuristics.';
  capabilities = ['ffmpeg-render', 'studio-qc', 'delivery-validation'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    if (typeof payload.filePath === 'string') {
      const qc = await runQcChecks({
        filePath: payload.filePath,
        expectedDurationSec: typeof payload.expectedDurationSec === 'number' ? payload.expectedDurationSec : undefined,
        expectedWidth: typeof payload.expectedWidth === 'number' ? payload.expectedWidth : undefined,
        expectedHeight: typeof payload.expectedHeight === 'number' ? payload.expectedHeight : undefined,
        outputPath: typeof payload.outputPath === 'string' ? payload.outputPath : undefined,
      });
      return {
        success: qc.report.passed,
        message: qc.report.passed ? 'QC sikeres.' : 'QC figyelmeztetest vagy hibat talalt.',
        data: qc,
      };
    }

    const projectName = typeof payload.projectName === 'string' ? payload.projectName : undefined;
    const timelinePlanPath = typeof payload.timelinePlanPath === 'string' ? payload.timelinePlanPath : undefined;
    if (!projectName || !timelinePlanPath) {
      throw new Error('QcRenderAgent: renderhez projectName es timelinePlanPath kotelezo.');
    }

    const render = await renderTimelinePlan({
      projectName,
      timelinePlanPath,
      presets: Array.isArray(payload.presets) ? payload.presets as never : undefined,
      musicTrackPath: typeof payload.musicTrackPath === 'string' ? payload.musicTrackPath : undefined,
    });
    const qcReports = await Promise.all(render.renderJobs.map((job) => runQcChecks({ filePath: job.outputPath, expectedDurationSec: job.expectedDurationSec, expectedWidth: job.preset.width, expectedHeight: job.preset.height })));
    return {
      success: qcReports.every((item) => item.report.passed),
      message: `Render + QC kesz (${qcReports.length} fajl).`,
      data: { render, qcReports },
      metadata: { renderCount: render.renderJobs.length },
    };
  }
}

export default QcRenderAgent;
