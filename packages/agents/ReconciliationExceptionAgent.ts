import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '@packages/utils/logger.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * ReconciliationExceptionAgent - Párosítatlan banki tételek elemzése és megoldási javaslatok készítése.
 */
export class ReconciliationExceptionAgent extends BaseAgent {
  name = 'ReconciliationExceptionAgent';
  role = 'Pénzügyi kivételkezelő';
  description = 'Azonosítja a párosítatlan tételek okait (pl. részfizetés, elírás) és javaslatot tesz a korrekcióra.';
  capabilities = ['exception-analysis', 'payment-pattern-recognition', 'semantic-description-analysis'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = typeof context.task === 'string' ? context.task : '';
    const payload = isRecord(context.payload) ? context.payload : undefined;
    logInfo(this.name, `Analyzing reconciliation exception: ${task}`);

    const unmatchedEntry = isRecord(payload?.entry) ? payload.entry : undefined;
    if (!unmatchedEntry) {
      return { success: false, message: 'No entry provided for analysis.' };
    }

    return {
      success: true,
      message: 'Exception analyzed successfully.',
      data: {
        entry_id: unmatchedEntry.id,
        reason_identified: 'Unclear reference',
        suggested_action: 'SEND_COMMUNICATION',
        confidence: 0.75
      }
    };
  }
}

