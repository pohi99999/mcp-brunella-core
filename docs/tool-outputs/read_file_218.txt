import { ChatProvider, ChatMode, ChatSendInput, ChatSendOutput } from "../types";
import { analyzeIntent } from "@/../../src/core/intentAnalyzer"; // Adjust path if needed
import * as api from "@/lib/apiService";

/**
 * Master Orchestrator Provider
 * Routes requests between Local Orchestrator and Cloudflare Edge Orchestrator
 * based on intent analysis.
 */
export class MasterOrchestratorProvider implements ChatProvider {
  readonly mode: ChatMode = "master_orchestrator";

  async send(args: ChatSendInput): Promise<ChatSendOutput> {
    const { text } = args;
    
    // 1. Analyze Intent
    const analysis = analyzeIntent(text);
    
    // 2. Delegate to correct target
    if (analysis.target === "edge") {
      try {
        const result = await api.submitCloudflareTask(text, { source: "master_orchestrator" });
        return {
          message: `[Edge] Feladat beküldve a Cloudflare orkesztrátornak (ID: ${result.taskId}).\n\nIndoklás: ${analysis.reasoning}`,
          executedBy: "CEAN Orchestrator",
          thoughts: analysis.reasoning,
          contextUsed: ["Cloudflare Edge Network"]
        };
      } catch (e: any) {
        return {
          message: `⚠️ Hiba az Edge delegálás során: ${e.message}. Megpróbálom helyben végrehajtani...`,
          executedBy: "System Fallback"
        };
      }
    }

    // 3. Default to Local Orchestrator
    try {
      const response = await api.executeAgent("orchestrator", text);
      return {
        message: response.data?.message || "A helyi orkesztrátor megkezdte a feladat végrehajtását.",
        executedBy: "Local Orchestrator",
        thoughts: analysis.reasoning,
        contextUsed: ["Local Workspace"]
      };
    } catch (e: any) {
      throw new Error(`Helyi orkesztrációs hiba: ${e.message}`);
    }
  }
}
