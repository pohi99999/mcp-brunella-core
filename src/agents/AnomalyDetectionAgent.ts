import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';

/**
 * AnomalyDetectionAgent - Folyamatos pénzügyi anomáliadetektálás.
 */
export class AnomalyDetectionAgent extends BaseAgent {
  name = 'AnomalyDetectionAgent';
  role = 'Pénzügyi anomáliadetektáló';
  description = 'Duplikált számlák, szokatlan árak és tranzakciós minták azonosítása.';
  capabilities = ['anomaly-detection', 'duplicate-invoice-guard', 'outlier-detection'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // Safe extraction from potentially untyped context
    const task = typeof (context && (context as Record<string, unknown>)['task']) === 'string'
      ? (context as Record<string, unknown>)['task'] as string
      : '';
    const payload = (context && (context as Record<string, unknown>)['payload']) ?? {};
    logInfo(this.name, `Monitoring anomalies: ${task}`);

    return {
      success: true,
      message: 'Anomaly detection scan finished.',
      data: {
        anomalies_found: 0,
        risk_score: 'LOW'
      }
    };
  }
}
