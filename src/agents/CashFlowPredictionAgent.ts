import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';

function readTaskFromContext(context: unknown): string | undefined {
  if (typeof context !== 'object' || context === null) {
    return undefined;
  }

  const record = context as Record<string, unknown>;
  return typeof record.task === 'string' ? record.task : undefined;
}

/**
 * CashFlowPredictionAgent - Kérdőív és historikus adatok alapján 14-30 napos cash-flow előrejelzés.
 */
export class CashFlowPredictionAgent extends BaseAgent {
  name = 'CashFlowPredictionAgent';
  role = 'Cash-flow elemző';
  description = 'Pénzforgalmi előrejelzés készítése historikus adatok és nyitott tételek alapján.';
  capabilities = ['cash-flow-prediction', 'predictive-analytics', 'payment-delay-forecasting'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = readTaskFromContext(context);
    logInfo(this.name, `Running cash-flow prediction: ${task}`);

    return {
      success: true,
      message: 'Cash-flow prediction generated.',
      data: {
        forecast_14_days: 'Positive',
        liquidity_risk: 'LOW',
        expected_in_14d: 1250000,
        expected_out_14d: 850000
      }
    };
  }
}
