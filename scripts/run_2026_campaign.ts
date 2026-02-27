import { leadMiningAgent } from '../src/agents/LeadMiningAgent.js';
import { logInfo } from '../src/utils/logger.js';

/**
 * Script to run regionalized lead mining for the 2026 campaign.
 */
async function runRegionalCampaign() {
    const cities = ["Budapest", "Debrecen", "Győr", "Kecskemét"];
    const niches = ["gyártó üzem", "logisztikai központ", "könyvelőiroda"];

    logInfo("CampaignRunner", "🚀 Indul az országos AI kampány lead-bányászata...");

    for (const city of cities) {
        for (const niche of niches) {
            const query = `${niche} ${city}`;
            logInfo("CampaignRunner", `🔍 Bányászat: ${query}`);
            
            // In a real run, we would call the agent
            // await leadMiningAgent.execute(query);
            
            logInfo("CampaignRunner", `✅ ${query} kész. (Szimulálva)`);
        }
    }
}

// runRegionalCampaign();
