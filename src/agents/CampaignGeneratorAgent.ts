import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { agentManager } from './AgentManager.js';
import { logInfo, logError } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';

export class CampaignGeneratorAgent extends BaseAgent {
  name = 'CampaignGenerator';
  description = 'Teljes marketing kampányt generál dokumentumokból: posztok, videó, weboldal, akcióterv.';
  role = 'Marketing Kampány Főrendező';

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const { task, fullContext } = context;
    logInfo(this.name, `Kampány generálása indult: ${task}`);

    try {
      // 1. Lead generálás (mock)
      const leadResultRaw = await agentManager.delegate('LeadMiningAgent', `Keress 10 leadet a következő témában: ${task}`);
      // Safe result handling
      const leadResult = typeof leadResultRaw === 'object' && leadResultRaw !== null ? leadResultRaw as Record<string, unknown> : {};
      const leadSuccess = Boolean(leadResult['success']);
      if (!leadSuccess) throw new Error('Lead generálás sikertelen.');
      let leads: unknown[] = [];
      const leadData = leadResult['data'];
      if (Array.isArray(leadData)) leads = leadData as unknown[];
      else if (leadData && typeof leadData === 'object' && Array.isArray((leadData as Record<string, unknown>)['leads'])) {
        leads = (leadData as Record<string, unknown>)['leads'] as unknown[];
      }
      logInfo(this.name, `Lead generálás kész: ${leads.length} lead.`);

      // 2. Tartalom generálás (mock)
      const copyResultRaw = await agentManager.delegate('CopywriterAgent', `Írj 3 social media posztot a következő témában: ${task}`);
      const copyResult = typeof copyResultRaw === 'object' && copyResultRaw !== null ? copyResultRaw as Record<string, unknown> : {};
      if (!Boolean(copyResult['success'])) throw new Error('Tartalom generálás sikertelen.');
      logInfo(this.name, 'Social media posztok elkészültek.');

      // 3. Weboldal terv generálás (mock)
      const webResultRaw = await agentManager.delegate('UXDesignerAgent', `Tervezz egy egyoldalas landing oldalt a következőnek: ${task}`);
      const webResult = typeof webResultRaw === 'object' && webResultRaw !== null ? webResultRaw as Record<string, unknown> : {};
      if (!Boolean(webResult['success'])) throw new Error('Weboldal tervezés sikertelen.');
      logInfo(this.name, 'Landing oldal terv elkészült.');
      
      // Build final report
      const finalReport = `
# Kampány Generálva: "${task}"

## 1. Lead-ek (10 db)
${JSON.stringify(leadResult.data, null, 2)}

## 2. Social Media Posztok
${typeof copyResult['message'] === 'string' ? copyResult['message'] : JSON.stringify(copyResult['data'] ?? '')}

## 3. Landing Page Terv
${typeof webResult['message'] === 'string' ? webResult['message'] : JSON.stringify(webResult['data'] ?? '')}

## 4. Akcióterv
- Hétfő: Poszt 1 live
- Kedd: Email kampány a leadekre
- Szerda: Poszt 2 live
`;

      return {
        success: true,
        message: 'A kampány sikeresen legenerálva.',
        data: {
          report: finalReport,
        }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Kampány generálás hiba: ${err.message}`);
      return { success: false, message: err.message };
    }
  }
}

export default CampaignGeneratorAgent;
