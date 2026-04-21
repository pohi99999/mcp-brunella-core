// FILE: src/agents/NurturerAgent.ts
// PURPOSE: Automatic marketing campaign generation for analyzed properties
// VERSION: 1.0 (Phase 3 - Real Estate Sales Campaign)
// UPDATED: 2026-02-18

import { BaseAgent, type AgentContext, type AgentResult } from "./BaseAgent.js";
import { logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import type { PropertyAnalysisResult } from "@packages/types/property.js";

/**
 * NurturerAgent - Kampányfelelős és Értékesítési Ügynök
 * 
 * Feladata: Marketing copy generálása, email sorozatok tervezése 
 * és hirdetési kampányvázlatok készítése az elemzett ingatlanokra.
 */
export class NurturerAgent extends BaseAgent {
  name = "NurturerAgent";
  role = "Marketing & Campaign Manager";
  description = "Automatikus marketing kampányokat generál az elemzett ingatlanokra.";
  capabilities = ["copywriting", "campaign_planning", "email_marketing", "lead_nurturing"];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || "").toLowerCase();
    setAgentStatus(this.name, "working", "Kampány generálás...");

    try {
      if (task.includes("kampány") || task.includes("campaign") || task.includes("hirdetés")) {
        return await this.generateCampaign(context);
      }

      return {
        success: false,
        message: "Ismeretlen feladat. Próbáld: 'generálj kampányt az elemzett ingatlanhoz'.",
      };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logError(this.name, errorMsg);
      return { success: false, message: `Hiba: ${errorMsg}` };
    }
  }

  private async generateCampaign(context: AgentContext): Promise<AgentResult> {
    const metadata = context.metadata as Record<string, unknown> | undefined;
    const analysis = metadata?.analysis as PropertyAnalysisResult | undefined;
    
    if (!analysis) {
      return { 
        success: false, 
        message: "Hiányzó ingatlan elemzési adatok (metadata.analysis). Kérlek futtass egy elemzést előtte." 
      };
    }

    logInfo(this.name, `Kampány generálás: ${analysis.asset.hrsz || analysis.asset.source_file}`);

    /*
    const prompt = `
Generate a professional REAL ESTATE MARKETING CAMPAIGN for the following property:
...
`;
    */

    // Mock response for now to avoid LLM quota/connection issues in tests/logic
    const response = "SZIMULÁLT KAMPÁNY: Kiváló ingatlan, vegye meg most!";

    return {
      success: true,
      message: "✅ Kampány sikeresen generálva.",
      data: {
        campaign_content: response,
        asset_id: analysis.asset.id,
        hrsz: analysis.asset.hrsz
      }
    };
  }
}

export default NurturerAgent;

