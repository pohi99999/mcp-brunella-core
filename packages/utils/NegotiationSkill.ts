import {
  captureValidationResult,
  callAnthropicText,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireNumber,
  requireString,
  type SkillParams,
} from "./skill-helpers.js";
import { memoryContextHandler, memoryStoreHandler } from "@packages/utils/memoryTool.js";
import { negotiationEngineHandler } from "@packages/utils/negotiationEngine.js";
import type { BrunellaSkill } from "./skill.interface.js";

function validateNegotiationSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "productId", "productId");
    requireString(params, "productName", "productName");
    requireString(params, "sellerName", "sellerName");
    requireString(params, "buyerName", "buyerName");
    requireNumber(params, "currentPrice", "currentPrice");
    requireNumber(params, "targetPrice", "targetPrice");
    requireString(params, "urgencyLevel", "urgencyLevel");
    requireString(params, "dealStage", "dealStage");
  });
}

export const NegotiationSkill: BrunellaSkill = {
  name: "negotiation",
  description:
    "Ártárgyalási stratégiát és email-tervezetet készít, memória-kontextussal és Claude-elemzéssel.",
  version: "1.0.0",
  category: "sales",
  tools: ["negotiation_engine", "claude_message", "memory_store"],
  agents: ["sales_hunter", "finance_guardian"],
  validate(params: SkillParams): boolean {
    return validateNegotiationSkill(params).valid;
  },
  getValidationResult: validateNegotiationSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const userId = optionalString(params, "user_id") ?? "negotiation";
      const memoryKey = optionalString(params, "memory_key") ?? `negotiation:${requireString(params, "productId", "productId")}`;
      const includeCoaching = optionalBoolean(params, "include_coaching") ?? true;
      const memoryContext = await memoryContextHandler({ user_id: userId });

      const engineResult = await negotiationEngineHandler({
        productId: requireString(params, "productId", "productId"),
        productName: requireString(params, "productName", "productName"),
        sellerName: requireString(params, "sellerName", "sellerName"),
        buyerName: requireString(params, "buyerName", "buyerName"),
        currentPrice: requireNumber(params, "currentPrice", "currentPrice"),
        targetPrice: requireNumber(params, "targetPrice", "targetPrice"),
        historicalDealPrice: optionalNumber(params, "historicalDealPrice"),
        marketAvgPrice: optionalNumber(params, "marketAvgPrice"),
        urgencyLevel: requireString(params, "urgencyLevel", "urgencyLevel") as "low" | "medium" | "high",
        dealStage: requireString(params, "dealStage", "dealStage") as "initial_contact" | "offer_sent" | "counteroffer" | "final",
      });

      if (!engineResult.success || !engineResult.data) {
        throw new Error(engineResult.error || "Az ártárgyalási motor nem adott eredményt.");
      }

      let coachingNotes: string | undefined;
      if (includeCoaching) {
        coachingNotes = await callAnthropicText([
          {
            role: "system",
            content:
              "Te egy senior sales negotiation coach vagy. Rövid, világos, akcióorientált magyar összegzést adj.",
          },
          {
            role: "user",
            content: [
              `Memória kontextus: ${JSON.stringify(memoryContext)}`,
              `Engine eredmény: ${JSON.stringify(engineResult.data)}`,
              "Adj 3 tárgyalási megfigyelést, 3 ellenérvet és 1 következő lépést.",
            ].join("\n\n"),
          },
        ]);
      }

      await memoryStoreHandler({
        user_id: userId,
        key: memoryKey,
        value: JSON.stringify({
          engineResult,
          coachingNotes,
        }),
        memory_type: "episodic",
        ttl_days: 30,
      });

      return {
        success: true,
        skill: this.name,
        userId,
        memoryKey,
        memoryContext,
        engineResult,
        coachingNotes,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        skill: this.name,
        error: message,
      };
    }
  },
};

export default NegotiationSkill;


