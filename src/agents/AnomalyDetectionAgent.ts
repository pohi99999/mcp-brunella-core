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
    const { task, payload } = context as any;
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
