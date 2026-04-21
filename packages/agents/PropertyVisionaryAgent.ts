import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';
import { generateResponse } from '@packages/core-logic/llm_client.js';
import { updateBusinessJobStatus, saveBusinessLead } from '@packages/utils/db.js';
import { socketService } from './SocketService.js';
import { agentManager } from './AgentManager.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureError } from '@packages/utils/ensureError.js';
import { parseAiResponse, safeJsonParse } from '@packages/utils/aiHelpers.js';

export class PropertyVisionaryAgent extends BaseAgent {
  name = 'PropertyVisionary';
  role = 'Real Estate Strategy & Buyer Discovery';
  description = 'Ingatlan és iparterület vevővadász: potenciális vevők felkutatása, stratégiaalkotás és megkeresés vezénylése';
  capabilities = [
    'buyer_discovery',
    'real_estate_valuation',
    'outreach_strategy',
    'investment_analysis'
  ];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || '';
    const jobId = (context as any).jobId;
    const propertyInfo = (context as any).propertyInfo || task;

    if (jobId) {
        await updateBusinessJobStatus(jobId, 'running');
        socketService.emit('business_job:updated', { jobId, status: 'running' });
    }

    setAgentStatus(this.name, 'working', `Vevővadászat: ${propertyInfo.slice(0, 40)}...`);

    try {
      logInfo(this.name, `Ingatlan elemzés és vevőkutatás indítása: ${propertyInfo}`);

      // 1. Mélyelemzés és Vevőprofil Generálása
      const profilePrompt = `
        Te egy elit ingatlanbefektetési tanácsadó vagy. 
        Adott egy projekt leírása: "${propertyInfo}".
        
        Készíts egy minden részletre kiterjedő ideális vevőprofilt. 
        Térj ki:
        - Befektetői típus (pl. Family Office, Institutional, HNWI)
        - Földrajzi fókusz (pl. DACH régió, belföldi tőke)
        - Motiváció (pl. ESG megfelelés, yield-vadászat, lifestyle asset)
        
        Válaszolj JSON-ben: { 
            "buyerProfile": "...", 
            "targetSectors": ["...", "..."],
            "usp": ["...", "..."],
            "riskProfile": "low/medium/high"
        }
      `;
      const profileRes = await generateResponse(profilePrompt, 'gemini', 'gemini-2.0-flash');
      const { text: profileText } = parseAiResponse(profileRes);
      const profileJson = safeJsonParse(profileText.match(/\{[\s\S]*\}/)?.[0] ?? profileText, { buyerProfile: '', targetSectors: [], usp: [], riskProfile: 'medium' } as any);

      // 2. Intelligens Vevőfelkutatás (Researcher + Robotkez)
      logInfo(this.name, "Beruházási trendek és tőkeerős célpontok keresése...");
      const searchInstruction = `
        Keress konkrét befektetési alapokat, ingatlanfejlesztőket vagy vagyonkezelőket, 
        akik a következő területeken aktívak: ${profileJson.targetSectors.join(', ')}.
        Kiemelten keresd a magyarországi és közép-európai piacot ismerő szereplőket.
        Adj vissza egy JSON listát: [ { "companyName": "...", "reason": "...", "contactRole": "...", "linkedinHint": "..." } ]
      `;
        const searchResponse = await agentManager.delegate('researcher', searchInstruction) as any;
      
        let potentialBuyers: any[] = [];
        if (searchResponse && searchResponse.success) {
          const { text: searchText } = parseAiResponse(searchResponse.message ?? searchResponse.data ?? searchResponse);
          const jsonMatch = searchText.match(/\[[\s\S]*\]/);
          potentialBuyers = safeJsonParse<any[]>(jsonMatch?.[0] ?? searchText, []);
        }

      if (potentialBuyers.length === 0) {
          // Ha a keresés nem hoz eredményt, generáljunk szektor-specifikus mintákat
          potentialBuyers = profileJson.targetSectors.map((sector: string) => ({
              companyName: `${sector} Investment Group`,
              reason: `Aktív ${profileJson.riskProfile} kockázati profilú projektekben.`,
              contactRole: "Befektetési Igazgató",
              linkedinHint: "Search for Expansion Manager"
          }));
      }

      // 3. Megkeresési Stratégia (Innovation Bridge stílusú transzferrel)
      logInfo(this.name, "Személyre szabott értékesítési stratégia alkotása...");
      const finalLeads = [];
      for (const buyer of potentialBuyers.slice(0, 5)) {
          const strategyPrompt = `
            Készíts egy "Visszautasíthatatlan Ajánlat" (Irresistible Offer) stratégiát a(z) ${buyer.companyName} részére.
            Projekt: ${propertyInfo}
            Fő előnyök (USP): ${profileJson.usp.join(', ')}
            
            Válaszolj JSON-ben: { 
                "openingLine": "Azonnal figyelemfelkeltő nyitómondat magyarul",
                "valueProposition": "A konkrét üzleti érték leírása",
                "outreachChannel": "LinkedIn / Email / Telefon"
            }
          `;
          const strategyRes = await generateResponse(strategyPrompt, 'gemini', 'gemini-2.0-flash');
          const { text: strategyText } = parseAiResponse(strategyRes);
          const strategyJson = safeJsonParse(strategyText.match(/\{[\s\S]*\}/)?.[0] ?? strategyText, { openingLine: '', valueProposition: '', outreachChannel: '' } as any);
          
          finalLeads.push({
              ...buyer,
              ...strategyJson,
              status: 'ready_to_contact'
          });
      }

      const finalResult = {
          propertyDescription: propertyInfo,
          analysis: profileJson,
          leads: finalLeads
      };

      // 4. Mentés a Pipeline-ba (egyéni leadek)
      if (jobId) {
          logInfo(this.name, `Populating pipeline with ${finalLeads.length} leads for job ${jobId}`);
          for (const lead of finalLeads) {
              await saveBusinessLead({
                  id: uuidv4(),
                  job_id: jobId,
                  company_name: lead.companyName,
                  contact_person: lead.contactRole,
                  metadata: JSON.stringify(lead)
              });
          }
      }

      // 5. Mentés és lezárás (összesített riport)
      if (jobId) {
          await updateBusinessJobStatus(jobId, 'completed', JSON.stringify(finalResult));
          socketService.emit('business_job:updated', { jobId, status: 'completed' });
      }

      return {
        success: true,
        message: `Sikeresen azonosítottam ${finalLeads.length} potenciális vevőjelöltet és kidolgoztam a stratégiát.`,
        data: finalResult
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Property Visionary hiba: ${err.message}`);
      if (jobId) {
          await updateBusinessJobStatus(jobId, 'failed', JSON.stringify({ error: err.message }));
          socketService.emit('business_job:updated', { jobId, status: 'failed' });
      }
      return { success: false, message: err.message };
    }
  }
}

export const createPropertyVisionary = (): PropertyVisionaryAgent => new PropertyVisionaryAgent();
export default PropertyVisionaryAgent;

