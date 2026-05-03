/**
 * 🤖 get_ai_recommendation MCP Tool
 * Track: ai_recommendation_system_20260216
 *
 * Glass Box: Ez az MCP tool a HybridMemory (LanceDB) RAG keresést
 * kéri le Claude/Cursor/MCP kliensekből. Azonos logikát használ
 * mint a REST endpoint, de MCP protokollon keresztül.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logDebug, logInfo, logError } from "../utils/logger.js";
import { HybridMemory } from "../utils/rag.js";

const AGENT = "AiRecommendationTool";
const TIMEOUT_MS = 30_000;

const FALLBACK_RECS = [
  "Brunella Agent System: Intelligens multi-agent feladatdelegáció",
  "Marketing Swarm: AI-vezérelt kampánygenerálás trendanalízissel",
  "CEAN Edge Network: Felhő-peremhálózati AI ügynök rendszer",
  "RAG Pipeline: LanceDB vektoros keresés + Ollama embedding",
];

async function fetchRecommendations(
  query: string,
  limit: number,
): Promise<{ results: string[]; engine: string }> {
  const hybridMemory = new HybridMemory();

  const ragSearch = hybridMemory.search(query, limit);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("RAG search timeout")), TIMEOUT_MS),
  );

  try {
    const ragResults = await Promise.race([ragSearch, timeout]);
    if (ragResults.length > 0) {
      return {
        results: ragResults.map(
          (r) =>
            `${r.text}${r.path ? ` [Forrás: ${r.path}]` : ""}${r.score !== undefined ? ` (relevancia: ${r.score.toFixed(3)})` : ""}`,
        ),
        engine: "rag",
      };
    }
    return { results: FALLBACK_RECS.slice(0, limit), engine: "fallback" };
  } catch (error: unknown) {
    logDebug(AGENT, "RAG search failed, using fallback", error);
    return { results: FALLBACK_RECS.slice(0, limit), engine: "fallback" };
  }
}

export function registerAiRecommendationTool(server: McpServer) {
  server.tool(
    "get_ai_recommendation",
    "AI-alapú ajánlásokat ad vissza egy lekérdezésre LanceDB RAG keresés segítségével. Ha a vektoros keresés nem elérhető, statikus fallback ajánlásokat ad.",
    {
      query: z
        .string()
        .min(1)
        .describe("A keresési lekérdezés vagy téma amelyre ajánlásokat kérsz"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Maximum ajánlások száma (1-20, alapértelmezett: 5)"),
      context: z
        .string()
        .optional()
        .describe("Opcionális kontextus a pontosabb ajánláshoz"),
    },
    async ({ query, limit, context }) => {
      logInfo(AGENT, `MCP kérés: "${query.slice(0, 60)}" (limit: ${limit})`);

      try {
        const enrichedQuery = context ? `${context}\n${query}` : query;
        const { results, engine } = await fetchRecommendations(
          enrichedQuery,
          limit ?? 5,
        );

        const outputText = [
          `🎯 **AI Ajánlások** (motor: ${engine})`,
          `📌 Lekérdezés: "${query}"`,
          "",
          ...results.map((r, i) => `${i + 1}. ${r}`),
          "",
          `_Generálva: ${new Date().toISOString()}_`,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text: outputText }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError(AGENT, msg);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `❌ Hiba az ajánlások lekérésekor: ${msg}`,
            },
          ],
        };
      }
    },
  );

  logInfo(AGENT, "✅ get_ai_recommendation MCP tool regisztrálva");
}
