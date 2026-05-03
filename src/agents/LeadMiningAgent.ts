// src/agents/LeadMiningAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { globalPythonShell } from '../utils/pythonShell.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { validateEmail } from '../services/emailValidator.js';
import { saveBusinessLead, saveBusinessJob, updateBusinessJobStatus } from '../utils/db.js';
import { agentManager } from './AgentManager.js';
import crypto from 'crypto';
import { socketService } from '../server/SocketService.js';

export class LeadMiningAgent extends BaseAgent {
    name = "lead_mining";
    role = "Lead Mining Service";
    description = "Generates targeted B2B lead lists with icebreakers and email validation.";
    capabilities = ["lead_generation", "web_scraping", "icebreaker_generation", "email_validation", "sheets_sync"];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const contextRecord = context as Record<string, unknown>;
        const query = typeof context.task === 'string' && context.task.trim().length > 0 ? context.task.trim() : "ügyvezető Zala megye 10-100 fő";
        const metadata = contextRecord.metadata && typeof contextRecord.metadata === 'object' ? (contextRecord.metadata as Record<string, unknown>) : {};
        const leadType = String(metadata.leadType ?? contextRecord.leadType ?? 'KKV');
        const limitValue = Number(metadata.limit ?? contextRecord.limit ?? 10);
        const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : 10;
        const requestedJobId = typeof contextRecord.jobId === 'string' && contextRecord.jobId.trim().length > 0 ? contextRecord.jobId.trim() : '';
        const jobId = requestedJobId || crypto.randomUUID();
        logInfo(this.name, `Starting lead mining for: ${query} (Type: ${leadType})`);

        try {
            if (!requestedJobId) {
                await saveBusinessJob({ id: jobId, type: 'lead_mining', query, status: 'running', metadata: JSON.stringify({ leadType, limit }) });
            }

            await updateBusinessJobStatus(jobId, 'running');
            socketService.emit('business_job:updated', { jobId, type: 'lead_mining', status: 'running', query, leadType, limit });

            let leads: any[] = [];

            // 1. Scrape leads (LinkedIn via Apify or Google Maps via local worker)
            if (query.toLowerCase().includes('linkedin') || leadType.toLowerCase() === 'brand') {
                logInfo(this.name, "Delegating to ApifyScrapingAgent for social/B2B leads");
                const scrapeResult = (await agentManager.delegate('ApifyScraping', `LinkedIn lead scraping for ${query}`, { capability: 'linkedin', query, limit, leadType })) as AgentResponse;
                if (scrapeResult.status === 'success' && Array.isArray(scrapeResult.data)) {
                    leads = scrapeResult.data.slice(0, limit);
                }
            } else {
                // Local Google Maps scraper fallback
                logInfo(this.name, "Using local Google Maps scraper");
                const scrapeCode = `
from myai.workers.google_maps_scraper import scrape_businesses
import json
import asyncio

async def run():
    results = await scrape_businesses("${query}", limit=${limit})
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

            const resultPayload = { jobId, query, leadType, limit, leads: enrichedLeads, syncCount };
            await updateBusinessJobStatus(jobId, 'completed', JSON.stringify(resultPayload));
            socketService.emit('business_job:updated', { type: 'lead_mining', status: 'completed', ...resultPayload });

            return {
                success: true,
                message: `Sikeresen legeneráltam, validáltam és Google Sheets-be szinkronizáltam ${enrichedLeads.length} leadet.`,
                data: resultPayload
            };

        } catch (error) {
            logError(this.name, `Lead mining failed: ${error}`);
            if (jobId) {
                const failureMessage = error instanceof Error ? error.message : String(error);
                await updateBusinessJobStatus(jobId, 'failed', JSON.stringify({ jobId, query, leadType, limit, error: failureMessage }));
                socketService.emit('business_job:updated', { jobId, type: 'lead_mining', status: 'failed', error: failureMessage });
            }
            return { success: false, message: `Hiba a lead mining során: ${error}` };
        }
    }
}


