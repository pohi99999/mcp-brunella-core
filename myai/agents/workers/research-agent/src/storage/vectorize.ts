import { Env, StoredResult, AnalyzedResult } from "../types.js";
import { logError, logInfo, logWarn } from "../utils/logger.js";

export interface VectorizeInsertResult {
  storedResultId: string;
  vectorId: string;
  model: string;
  syncedAt: string;
}

const VECTORIZE_MODEL = "text-embedding-3-small";

export async function upsertResultsToVectorize(
  taskId: string,
  results: StoredResult[],
  env: Env,
): Promise<VectorizeInsertResult[]> {
  const vectorizeIndex = env.VECTORIZE;
  const apiKey = env.OPENAI_API_KEY;
  const inserts: VectorizeInsertResult[] = [];

  if (!vectorizeIndex) {
    logWarn("ResearchAgent", "Vectorize binding missing; skipping embeddings.");
    return inserts;
  }

  if (!apiKey) {
    logWarn("ResearchAgent", "OPENAI_API_KEY missing; skipping embeddings.");
    return inserts;
  }

  for (const storedResult of results) {
    try {
      const embedding = await createEmbedding(storedResult.result, apiKey);
      const vectorId = `vec-${storedResult.id}`;
      const syncedAt = new Date().toISOString();

      await vectorizeIndex.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata: {
            task_id: taskId,
            title: storedResult.result.title,
            source: storedResult.result.source,
            url: storedResult.result.url,
            category: storedResult.result.category,
            tags: storedResult.result.tags.join(","),
            relevance_score: storedResult.result.relevance_score,
          },
        },
      ]);

      inserts.push({
        storedResultId: storedResult.id,
        vectorId,
        model: VECTORIZE_MODEL,
        syncedAt,
      });

      logInfo("ResearchAgent", "Vectorize upsert complete", {
        vectorId,
        resultId: storedResult.id,
      });
    } catch (error) {
      logError("ResearchAgent", "Vectorize upsert failed", {
        resultId: storedResult.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return inserts;
}

async function createEmbedding(
  result: AnalyzedResult,
  apiKey: string,
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VECTORIZE_MODEL,
      input: `${result.title}\n${result.summary}\n${result.description}`.trim(),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  const embedding = data.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Embedding response empty");
  }

  return embedding;
}