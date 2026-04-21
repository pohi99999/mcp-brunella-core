import { addToIndex, searchRAG } from "@packages/utils/rag.js";
import { chatAnythingLLM, listAnythingLLMWorkspaces } from "@packages/utils/anythingllm.js";
import {
  captureValidationResult,
  collectWebSearchUrls,
  fetchPageSnapshot,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
  stringArrayParam,
  truncateText,
  type SkillParams,
} from "./skill-helpers.js";
import { memoryStoreHandler } from "@packages/utils/memoryTool.js";
import type { BrunellaSkill } from "./skill.interface.js";

type MarketFinding = {
  title: string;
  url: string;
  score: number;
  summary: string;
  signals: string[];
};

function validateMarketWatchSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "query", "query");
  });
}

function scoreMarketSnapshot(
  title: string,
  url: string,
  text: string,
  keywords: string[],
  industry?: string,
): MarketFinding {
  const content = text.toLowerCase();
  const matchedKeywords = keywords.filter((keyword) =>
    content.includes(keyword.toLowerCase()),
  );
  const signals: string[] = [];
  let score = 20;

  if (matchedKeywords.length > 0) {
    score += matchedKeywords.length * 10;
    signals.push(`Kulcsszavak: ${matchedKeywords.join(", ")}`);
  }

  if (industry && content.includes(industry.toLowerCase())) {
    score += 10;
    signals.push(`Iparág: ${industry}`);
  }

  if (content.includes("competitor") || content.includes("versenytárs")) {
    score += 8;
    signals.push("Versenytárs jelzés");
  }

  if (content.includes("pricing") || content.includes("price") || content.includes("ár")) {
    score += 8;
    signals.push("Árazási jelzés");
  }

  if (content.includes("market") || content.includes("trend") || content.includes("piac")) {
    score += 10;
    signals.push("Trend vagy piac jelzés");
  }

  return {
    title,
    url,
    score: Math.min(score, 100),
    summary: truncateText(text, 1000),
    signals,
  };
}

export const MarketWatchSkill: BrunellaSkill = {
  name: "market-watch",
  description:
    "Piaci és versenytársi jeleket figyel a weben, tudásbázisba indexel, és összehangolja AnythingLLM kontextussal.",
  version: "1.0.0",
  category: "research",
  tools: [
    "browser_navigate",
    "knowledge_semantic_search",
    "anythingllm_chat",
    "anythingllm_list_workspaces",
    "memory_store",
  ],
  agents: ["researcher", "market_intel"],
  validate(params: SkillParams): boolean {
    return validateMarketWatchSkill(params).valid;
  },
  getValidationResult: validateMarketWatchSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const query = requireString(params, "query", "query");
      const keywords = stringArrayParam(params, "keywords");
      const explicitUrls = stringArrayParam(params, "urls");
      const industry = optionalString(params, "industry");
      const workspace = optionalString(params, "workspace");
      const userId = optionalString(params, "user_id") ?? "market-watch";
      const limit = Math.max(1, Math.min(optionalNumber(params, "limit") ?? 5, 10));
      const saveToMemory = optionalBoolean(params, "save_to_memory") ?? true;
      const includeWorkspaceList = optionalBoolean(params, "include_workspace_list") ?? false;

      const searchQuery = [query, industry, ...keywords].filter(Boolean).join(" ").trim();
      const knowledgeContext = await searchRAG(searchQuery, Math.min(limit, 5));
      const urls =
        explicitUrls.length > 0
          ? explicitUrls
          : await collectWebSearchUrls(searchQuery || query, limit * 2);

      const snapshots = await Promise.allSettled(
        urls.slice(0, limit * 2).map((url) => fetchPageSnapshot(url, 15000)),
      );

      const findings: MarketFinding[] = snapshots
        .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchPageSnapshot>>> => entry.status === "fulfilled")
        .map((entry) =>
          scoreMarketSnapshot(
            entry.value.title,
            entry.value.url,
            [entry.value.description ?? "", entry.value.text].join("\n"),
            keywords,
            industry,
          ),
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

      if (findings.length > 0) {
        await addToIndex(
          `market-watch:${query}:${Date.now()}`,
          [
            `Query: ${query}`,
            industry ? `Industry: ${industry}` : undefined,
            ...findings.map(
              (finding, index) =>
                `${index + 1}. ${finding.title} | score=${finding.score} | ${finding.url}\n${finding.summary}`,
            ),
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
      }

      let anythingllmSummary: unknown = undefined;
      if (workspace) {
        anythingllmSummary = await chatAnythingLLM(
          [
            `Piaci monitoring összegzés az alábbi témára: ${query}`,
            `Iparág: ${industry ?? "nincs megadva"}`,
            `Kulcsszavak: ${keywords.join(", ") || "nincs"}`,
            `Top findingek: ${findings
              .slice(0, 3)
              .map((finding) => `${finding.title} (${finding.score})`)
              .join("; ") || "nincs"}`,
          ].join("\n"),
          workspace,
        );
      }

      const workspaceList = includeWorkspaceList ? await listAnythingLLMWorkspaces() : undefined;

      if (saveToMemory) {
        await memoryStoreHandler({
          user_id: userId,
          key: `market-watch:${query}`,
          value: JSON.stringify({
            query,
            industry,
            findings: findings.slice(0, 5),
          }),
          memory_type: "episodic",
          ttl_days: 14,
        });
      }

      return {
        success: true,
        skill: this.name,
        query,
        industry,
        keywords,
        searchedUrls: urls,
        knowledgeContext,
        findings,
        anythingllmSummary,
        workspaceList,
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

export default MarketWatchSkill;


