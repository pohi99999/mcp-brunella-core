import { addToIndex, searchRAG } from "../utils/rag.js";
import { evHunterHandler } from "../tools/evHunterTool.js";
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
  type PageSnapshot,
} from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

type LeadCandidate = {
  title: string;
  url: string;
  score: number;
  signals: string[];
  emails: string[];
  snippet: string;
};

function validateLeadHunterSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "query", "query");
  });
}

function scoreSnapshot(
  snapshot: PageSnapshot,
  query: string,
  keywords: string[],
  industry?: string,
): LeadCandidate {
  const combined = [
    snapshot.title,
    snapshot.description ?? "",
    snapshot.text,
    snapshot.emails.join(" "),
  ]
    .join("\n")
    .toLowerCase();

  const queryTerms = query
    .toLowerCase()
    .split(/[\s,;/|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  const signals: string[] = [];
  let score = 25;

  const matchedQueryTerms = queryTerms.filter((term) => combined.includes(term));
  if (matchedQueryTerms.length > 0) {
    score += matchedQueryTerms.length * 10;
    signals.push(`Lekérdezési egyezés: ${matchedQueryTerms.join(", ")}`);
  }

  const matchedKeywords = keywords.filter((keyword) =>
    combined.includes(keyword.toLowerCase()),
  );
  if (matchedKeywords.length > 0) {
    score += matchedKeywords.length * 8;
    signals.push(`Kulcsszó-egyezés: ${matchedKeywords.join(", ")}`);
  }

  if (industry && combined.includes(industry.toLowerCase())) {
    score += 12;
    signals.push(`Iparági egyezés: ${industry}`);
  }

  if (snapshot.emails.length > 0) {
    score += 12;
    signals.push(`Elérhetőség: ${snapshot.emails.join(", ")}`);
  }

  if (combined.includes("case study") || combined.includes("referenc")) {
    score += 6;
    signals.push("Referenciák vagy case study jelzés");
  }

  if (combined.includes("contact") || combined.includes("kapcsolat")) {
    score += 8;
    signals.push("Kapcsolati oldal vagy kapcsolatfelvételi jelzés");
  }

  if (combined.includes("pricing") || combined.includes("price") || combined.includes("ár")) {
    score += 4;
    signals.push("Árazási vagy ajánlati jelzés");
  }

  return {
    title: snapshot.title,
    url: snapshot.url,
    score: Math.min(score, 100),
    signals,
    emails: snapshot.emails,
    snippet: truncateText(snapshot.text, 900),
  };
}

export const LeadHunterSkill: BrunellaSkill = {
  name: "lead-hunter",
  description:
    "B2B lead-eket keres a weben, pontozza a jelölteket, és tudásbázis-kontektsus alapján rangsorol.",
  version: "1.0.0",
  category: "sales",
  tools: [
    "browser_navigate",
    "knowledge_semantic_search",
    "knowledge_index_file",
    "ev_hunter_search",
  ],
  agents: ["researcher", "sales_hunter"],
  validate(params: SkillParams): boolean {
    return validateLeadHunterSkill(params).valid;
  },
  getValidationResult: validateLeadHunterSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const query = requireString(params, "query", "query");
      const keywords = stringArrayParam(params, "keywords");
      const explicitUrls = stringArrayParam(params, "urls");
      const industry = optionalString(params, "industry");
      const limit = Math.max(1, Math.min(optionalNumber(params, "limit") ?? 5, 10));
      const saveToKnowledge = optionalBoolean(params, "save_to_knowledge") ?? true;
      const runEvBenchmark = optionalBoolean(params, "run_ev_benchmark") ?? false;

      const searchQuery = [query, industry, ...keywords].filter(Boolean).join(" ").trim();
      const knowledgeContext = await searchRAG(searchQuery, Math.min(limit, 5));

      const urls =
        explicitUrls.length > 0
          ? explicitUrls
          : await collectWebSearchUrls(searchQuery || query, limit * 2);

      const snapshots = await Promise.allSettled(
        urls.slice(0, limit * 2).map((url) => fetchPageSnapshot(url, 15000)),
      );

      const candidates: LeadCandidate[] = snapshots
        .filter((entry): entry is PromiseFulfilledResult<PageSnapshot> => entry.status === "fulfilled")
        .map((entry) => scoreSnapshot(entry.value, query, keywords, industry))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

      if (saveToKnowledge && candidates.length > 0) {
        const summary = candidates
          .map(
            (candidate, index) =>
              `${index + 1}. ${candidate.title} | score=${candidate.score} | ${candidate.url}`,
          )
          .join("\n");
        await addToIndex(
          `lead-hunter:${query}:${Date.now()}`,
          `${query}\n\n${summary}\n\n${candidates
            .map((candidate) => `${candidate.title}\n${candidate.snippet}`)
            .join("\n\n")}`,
        );
      }

      let evBenchmark: unknown = undefined;
      if (runEvBenchmark) {
        evBenchmark = await evHunterHandler({ mock: true, dryRun: true });
      }

      return {
        success: true,
        skill: this.name,
        query,
        industry,
        keywords,
        searchedUrls: urls,
        knowledgeContext,
        candidates,
        ...(evBenchmark ? { evBenchmark } : {}),
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

export default LeadHunterSkill;

