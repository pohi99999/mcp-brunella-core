// src/agents/LeadMiningAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { globalPythonShell } from '../utils/pythonShell.js';
import { logInfo, logError } from '../utils/logger.js';
import { validateEmail } from '../services/emailValidator.js';
import { saveBusinessLead, saveBusinessJob } from '../utils/db.js';
import crypto from 'crypto';

export class LeadMiningAgent extends BaseAgent {
    name = "lead_mining";
    role = "Lead Mining Service";
    description = "Generates targeted B2B lead lists with icebreakers and email validation.";
    capabilities = ["lead_generation", "web_scraping", "icebreaker_generation", "email_validation"];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const query = context.task || "fogorvos Budapest";
        logInfo(this.name, `Starting lead mining for: ${query}`);

        try {
            const jobId = crypto.randomUUID();
            await saveBusinessJob({ id: jobId, type: 'lead_mining', query });

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

            // 2. Process and enrich each lead
            const enrichedLeads = [];
            for (const lead of leads) {
                // Icebreaker generation
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

                // Email validation (if email exists)
                let emailStatus = 'unknown';
                if (lead.email) {
                    emailStatus = await validateEmail(lead.email);
                }

                const leadData = {
                    id: crypto.randomUUID(),
                    job_id: jobId,
                    company_name: lead.name,
                    contact_email: lead.email,
                    email_status: emailStatus,
                    icebreaker_text: icebreaker,
                    metadata: JSON.stringify(lead)
                };

                await saveBusinessLead(leadData);
                enrichedLeads.push({ ...lead, icebreaker, emailStatus });
            }

            logInfo(this.name, `Generated and saved ${enrichedLeads.length} leads.`);

            return {
                success: true,
                message: `Sikeresen legeneráltam és validáltam ${enrichedLeads.length} leadet.`,
                data: { jobId, leads: enrichedLeads }
            };

        } catch (error) {
            logError(this.name, `Lead mining failed: ${error}`);
            return { success: false, message: `Hiba a lead mining során: ${error}` };
        }
    }
}

