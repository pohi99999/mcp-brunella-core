// src/agents/LeadMiningAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { globalPythonShell } from '../utils/pythonShell.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { validateEmail } from '../services/emailValidator.js';
import { saveBusinessLead, saveBusinessJob } from '../utils/db.js';
import { agentManager } from './AgentManager.js';
import crypto from 'crypto';

export class LeadMiningAgent extends BaseAgent {
    name = "lead_mining";
    role = "Lead Mining Service";
    description = "Generates targeted B2B lead lists with icebreakers and email validation.";
    capabilities = ["lead_generation", "web_scraping", "icebreaker_generation", "email_validation", "sheets_sync"];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const query = context.task || "ügyvezető Zala megye 10-100 fő";
        const leadType = (context.data as any)?.leadType || 'KKV';
        logInfo(this.name, `Starting lead mining for: ${query} (Type: ${leadType})`);

        try {
            const jobId = crypto.randomUUID();
            await saveBusinessJob({ id: jobId, type: 'lead_mining', query });

            let leads: any[] = [];

            // 1. Scrape leads (LinkedIn via Apify or Google Maps via local worker)
            if (query.toLowerCase().includes('linkedin') || leadType === 'Brand') {
                logInfo(this.name, "Delegating to ApifyScrapingAgent for social/B2B leads");
                const scrapeResult = (await agentManager.delegate('ApifyScraping', `scrape ${query}`, { limit: 10 })) as AgentResponse;
                if (scrapeResult.status === 'success' && Array.isArray(scrapeResult.data)) {
                    leads = scrapeResult.data;
                }
            } else {
                // Local Google Maps scraper fallback
                logInfo(this.name, "Using local Google Maps scraper");
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
                leads = JSON.parse(scrapeOutput);
            }

            if (!leads || leads.length === 0) {
                return { success: false, message: "No leads found." };
            }

            // 2. Process and enrich each lead
            const enrichedLeads = [];
            for (const lead of leads) {
                // Icebreaker generation (using copywriter agent for better quality)
                let icebreaker = "";
                let webContext = "";
                try {
                    // Deep analysis of the website if URL exists
                    const targetUrl = (lead as any).website || (lead as any).url;
                    if (targetUrl && targetUrl.startsWith('http')) {
                        logInfo(this.name, `Analyzing website: ${targetUrl}`);
                        const analysisResult = (await agentManager.delegate('Researcher', `Elemezd ezt a weboldalt: ${targetUrl}. Mi a fő értékajánlatuk és van-e friss hírük?`)) as any;
                        webContext = analysisResult.status === 'success' ? String(analysisResult.data) : "";
                    }

                    const ibResult = (await agentManager.delegate('copywriter', `Készíts egy rövid, személyes megnyitó üzenetet (icebreaker) ehhez a céghez: ${(lead as any).name || (lead as any).company || 'Névtelen'}. Weboldal kontextus: ${webContext}. Relevancia: KKV automatizáció.`)) as any;
                    icebreaker = ibResult.status === 'success' ? String(ibResult.data) : "";
                } catch (e) {
                    logWarn(this.name, "Icebreaker delegation failed, skipping.");
                }


                // Email validation (if email exists)
                let emailStatus = 'unknown';
                const contactEmail = (lead as any).email || (lead as any).contact_email;
                if (contactEmail) {
                    emailStatus = await validateEmail(contactEmail);
                }

                const leadData = {
                    id: crypto.randomUUID(),
                    job_id: jobId,
                    company_name: (lead as any).name || (lead as any).company || 'Névtelen',
                    contact_email: contactEmail,
                    email_status: emailStatus,
                    icebreaker_text: icebreaker,
                    metadata: JSON.stringify(lead)
                };

                await saveBusinessLead(leadData);
                enrichedLeads.push({ ...lead, ...leadData });
            }

            // 3. Sync to Google Sheets
            logInfo(this.name, `Syncing ${enrichedLeads.length} leads to Google Sheets`);
            const syncCode = `
from myai.clients.crm_sheets_client import CRMSheetsClient
import json

leads_data = ${JSON.stringify(enrichedLeads)}
client = CRMSheetsClient()
count = client.append_leads(leads_data, "${leadType}")
print(count)
            `;
            const syncOutput = await globalPythonShell.run(syncCode);
            const syncCount = parseInt(syncOutput.trim());

            logInfo(this.name, `Generated, saved and synced ${enrichedLeads.length} leads (Sheets: ${syncCount}).`);

            return {
                success: true,
                message: `Sikeresen legeneráltam, validáltam és Google Sheets-be szinkronizáltam ${enrichedLeads.length} leadet.`,
                data: { jobId, leads: enrichedLeads, syncCount }
            };

        } catch (error) {
            logError(this.name, `Lead mining failed: ${error}`);
            return { success: false, message: `Hiba a lead mining során: ${error}` };
        }
    }
}


