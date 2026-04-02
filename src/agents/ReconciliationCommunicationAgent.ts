import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';

/**
 * ReconciliationCommunicationAgent - Kommunikáció a partnerekkel párosítatlannak tűnő tételek ügyében.
 */
export class ReconciliationCommunicationAgent extends BaseAgent {
  name = 'ReconciliationCommunicationAgent';
  role = 'Pénzügyi kommunikátor';
  description = 'E-mail tervezetek készítése partnereknek tisztázandó banki tételek ügyében.';
  capabilities = ['email-drafting', 'professional-communication', 'accounting-context-aware-llm'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const { task, payload } = context as any;
    logInfo(this.name, `Drafting communication: ${task}`);

    const partner = payload?.partner || 'Valued Partner';
    const reference = payload?.reference || 'Unknown';
    const amount = payload?.amount || 0;

    const draft = `Tisztelt ${partner}!\n\nA(z) ${reference} hivatkozású, ${amount} HUF összegű banki tételünk egyeztetése során eltérést tapasztaltunk. Kérjük, szíveskedjenek visszajelezni.\n\nÜdvözlettel:\nBrunella Pénzügyi Asszisztens`;

    return {
      success: true,
      message: 'Email draft generated.',
      data: {
        to: payload?.email || 'N/A',
        subject: `Pénzügyi egyeztetés - ${reference}`,
        body: draft
      }
    };
  }
}
