// src/agents/LeadMiningAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { globalPythonShell } from '../utils/pythonShell.js';
import { logInfo, logError } from '../utils/logger.js';

export class LeadMiningAgent extends BaseAgent {
    name = "lead_mining";
    role = "Lead Mining Service";
    description = "Generates targeted B2B lead lists with icebreakers.";
    capabilities = ["lead_generation", "web_scraping", "icebreaker_generation"];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const query = context.task || "fogorvos Budapest";
        logInfo(this.name, `Starting lead mining for: ${query}`);

        try {
            // 1. Scrape businesses from Google Maps
            const scrapeCode = `
from myai.workers.google_maps_scraper import scrape_businesses
import json
import asyncio

async def run():
    results = await scrape_businesses("${query}", limit=5)
    print(json.dumps(results))

asyncio.run(run())
            `;
            const scrapeOutput = await globalPythonShell.run(scrapeCode);
            const leads = JSON.parse(scrapeOutput);

            if (!leads || leads.length === 0) {
                return { success: false, message: "No leads found." };
            }

            // 2. Generate icebreakers for each lead
            const enrichedLeads = [];
            for (const lead of leads) {
                const icebreakerCode = `
from myai.workers.icebreaker_generator import generate_icebreaker
import asyncio
import json

async def run():
    ctx = "${lead.name} - ${lead.website}"
    ib = await generate_icebreaker(ctx)
    print(json.dumps(ib))

asyncio.run(run())
                `;
                const ibOutput = await globalPythonShell.run(icebreakerCode);
                const icebreaker = JSON.parse(ibOutput);
                enrichedLeads.push({ ...lead, icebreaker });
            }

            // 3. Export to Google Sheets (Mock/Simulated for now)
            // In a real scenario, we would call the sheets tool here.
            logInfo(this.name, `Generated ${enrichedLeads.length} leads with icebreakers.`);

            return {
                success: true,
                message: `Sikeresen legeneráltam ${enrichedLeads.length} leadet jégtörő mondatokkal.`,
                data: { leads: enrichedLeads }
            };

        } catch (error) {
            logError(this.name, `Lead mining failed: ${error}`);
            return { success: false, message: `Hiba a lead mining során: ${error}` };
        }
    }
}

