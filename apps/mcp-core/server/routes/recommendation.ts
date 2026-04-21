/**
 * 📡 AI Recommendation Routes
 * Track: ai_recommendation_system_20260216
 * Endpoint: POST /api/v1/brunella/recommend
 *
 * Glass Box: Ez az endpoint a HybridMemory (LanceDB) RAG keresést használja
 * releváns ajánlások generálásához. Ha az embedding nem elérhető,
 * statikus fallback ajánlásokat ad vissza.
 */
import { Router, type Request, type Response } from "express";
import { logInfo, logError } from "../../utils/logger.js";
import { HybridMemory } from "../../utils/rag.js";

const AGENT = "RecommendationRoute";
const RECOMMENDATION_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types (előre kell jönnie a konstansok előtt)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecommendationRequest {
  query: string;
  limit?: number;
  context?: string;
}

export interface RecommendationItem {
  text: string;
  score?: number;
  source: "rag" | "fallback";
  path?: string;
}

export interface RecommendationResponse {
  recommendations: RecommendationItem[];
  query: string;
  engine: "rag" | "fallback";
  timestamp: string;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statikus fallback ajánlások ha RAG nem elérhető
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_RECOMMENDATIONS: RecommendationItem[] = [
  {
    text: "Brunella Agent System: Intelligens multi-agent feladatdelegáció",
    score: 0.9,
    source: "fallback",
  },
  {
    text: "Marketing Swarm: AI-vezérelt kampánygenerálás trendanalízissel",
    score: 0.85,
    source: "fallback",
  },
  {
    text: "CEAN Edge Network: Felhő-peremhálózati AI ügynök rendszer",
    score: 0.8,
    source: "fallback",
  },
  {
    text: "RAG Pipeline: LanceDB vektoros keresés + Ollama embedding",
    score: 0.75,
    source: "fallback",
  },
];

export interface RecommendationResponse {
  recommendations: RecommendationItem[];
  query: string;
  engine: "rag" | "fallback";
  timestamp: string;
  durationMs: number;
}

/**
 * Fő ajánlás logika – RAG keresés timeout védelemmel
 */
async function getRecommendations(
  query: string,
  limit: number,
): Promise<{ items: RecommendationItem[]; engine: "rag" | "fallback" }> {
  const hybridMemory = new HybridMemory();

  const ragPromise = hybridMemory.search(query, limit).then((results) =>
    results.map((r) => ({
      text: r.text,
      score: r.score,
      source: "rag" as const,
      path: r.path,
    })),
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("RAG search timeout")),
      RECOMMENDATION_TIMEOUT_MS,
    ),
  );

  try {
    const ragResults = await Promise.race([ragPromise, timeoutPromise]);
    if (ragResults.length === 0) {
      logInfo(AGENT, `RAG 0 találat – fallback ajánlások`);
      return {
        items: FALLBACK_RECOMMENDATIONS.slice(0, limit),
        engine: "fallback",
      };
    }
    return { items: ragResults, engine: "rag" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logInfo(AGENT, `RAG hiba (${msg}) – fallback ajánlások`);
    return {
      items: FALLBACK_RECOMMENDATIONS.slice(0, limit),
      engine: "fallback",
    };
  }
}

export function createRecommendationRoutes(): Router {
  const router = Router();

  /**
   * POST /brunella/recommend
   * Ajánlásokat ad vissza egy lekérdezésre RAG + fallback alapon.
   *
   * @body { query: string, limit?: number, context?: string }
   */
  router.post("/recommend", async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { query, limit = 5, context } = req.body as RecommendationRequest;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        res.status(400).json({
          error: "A 'query' mező kötelező és nem lehet üres.",
          code: "MISSING_QUERY",
        });
        return;
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
      const enrichedQuery = context ? `${context}\n${query}` : query;

      logInfo(
        AGENT,
        `Ajánlás kérés: "${query.slice(0, 60)}" (limit: ${safeLimit})`,
      );

      const { items, engine } = await getRecommendations(
        enrichedQuery,
        safeLimit,
      );

      const response: RecommendationResponse = {
        recommendations: items,
        query,
        engine,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      res.json(response);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(AGENT, msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /brunella/recommend/health
   * Egyszerű health check az ajánlás végponthoz.
   */
  router.get("/recommend/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "ai-recommendation",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
