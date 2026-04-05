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
      const leadResult = await agentManager.delegate('LeadMiningAgent', `Keress 10 leadet a következő témában: ${task}`) as any;
      if (!leadResult.success) throw new Error('Lead generálás sikertelen.');
      const leads = (leadResult.data as any)?.leads || [];
      logInfo(this.name, `Lead generálás kész: ${leads.length} lead.`);

      // 2. Tartalom generálás (mock)
      const copyResult = await agentManager.delegate('CopywriterAgent', `Írj 3 social media posztot a következő témában: ${task}`) as any;
      if (!copyResult.success) throw new Error('Tartalom generálás sikertelen.');
      logInfo(this.name, 'Social media posztok elkészültek.');

      // 3. Weboldal terv generálás (mock)
      const webResult = await agentManager.delegate('UXDesignerAgent', `Tervezz egy egyoldalas landing oldalt a következőnek: ${task}`) as any;
      if (!webResult.success) throw new Error('Weboldal tervezés sikertelen.');
      logInfo(this.name, 'Landing oldal terv elkészült.');
      
      const finalReport = `
# Kampány Generálva: "${task}"

## 1. Lead-ek (10 db)
${JSON.stringify(leadResult.data, null, 2)}

## 2. Social Media Posztok
${copyResult.message}

## 3. Landing Page Terv
${webResult.message}

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
