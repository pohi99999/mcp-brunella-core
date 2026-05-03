import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { reviewStudioRun, studioPipelineReportPath } from '../cli/studioRuntime.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class StudioReviewerAgent extends BaseAgent {
  name = 'StudioReviewer';
  role = 'Brunella Studio review analyst';
  description = 'Reviews studio pipeline reports, scores delivery quality, interprets music intelligence, and emits rerun guidance.';
  capabilities = ['studio-review', 'render-feedback', 'rerun-decision', 'webhook-review', 'music-intelligence'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const pipelineReportPath = typeof payload.pipelineReportPath === 'string'
      ? payload.pipelineReportPath
      : typeof payload.reportPath === 'string'
        ? payload.reportPath
        : typeof payload.projectName === 'string'
          ? studioPipelineReportPath(payload.projectName)
          : undefined;

    if (!pipelineReportPath) {
      throw new Error('StudioReviewerAgent: pipelineReportPath vagy projectName kotelezo.');
    }

    const review = await reviewStudioRun({
      pipelineReportPath,
      rerunCommand: typeof payload.rerunCommand === 'string' ? payload.rerunCommand : undefined,
      callbackUrl: typeof payload.callbackUrl === 'string' ? payload.callbackUrl : undefined,
    });

    return {
      success: true,
      status: review.review.status,
      message: `Studio review kesz: ${review.review.status}.`,
      data: review,
      metadata: {
        reviewId: review.review.reviewId,
        score: review.review.score,
        status: review.review.status,
        findings: review.review.findings.length,
        callbackStatus: review.callbackDelivery ? 'sent' : 'skipped',
      },
    };
  }
}

export default StudioReviewerAgent;
