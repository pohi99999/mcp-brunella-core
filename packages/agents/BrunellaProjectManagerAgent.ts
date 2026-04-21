import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { logError, logInfo } from '@packages/utils/logger.js';
import {
  buildBrunellaProjectManagerSnapshot,
  renderBrunellaProjectManagerSnapshot,
} from '@packages/core-logic/brunellaProjectManagerStatus.js';

export class BrunellaProjectManagerAgent extends BaseAgent {
  name = 'BrunellaProjectManager';
  role = 'Project Manager Status Operator';
  description = 'Projekt állapot, FOSZAL összegzés és RAG alapú rövid project review.';
  capabilities = ['project_status', 'track_snapshot', 'foszal_summary', 'rag_summary'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    try {
      const task = typeof context.task === 'string' ? context.task.trim() : '';
      const payload = (context.payload ?? {}) as {
        limit?: number;
        ragQuery?: string;
        ragLimit?: number;
      };

      logInfo(this.name, 'Project manager status snapshot generation started.');
      const snapshot = await buildBrunellaProjectManagerSnapshot({
        limit: payload.limit,
        ragQuery: payload.ragQuery?.trim() || task || undefined,
        ragLimit: payload.ragLimit,
      });
      const report = renderBrunellaProjectManagerSnapshot(snapshot);

      return {
        success: true,
        message: report,
        data: snapshot,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError(this.name, `Project manager status failed: ${message}`);
      return {
        success: false,
        message: `BrunellaProjectManager hiba: ${message}`,
        data: null,
      };
    }
  }
}

export default BrunellaProjectManagerAgent;

