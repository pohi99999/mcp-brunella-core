import { Env } from "../types.js";
import { StoredResult, markResultsSynced } from "./d1.js";
import { logError, logInfo, logWarn } from "../utils/logger.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 10;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

function buildEmbeddingText(result: StoredResult) {
  const tags = result.result.tags.length > 0 ? result.result.tags.join(", ") : "none";
  return [
    result.result.title,
    result.result.summary,
    result.result.description,
    `Source: ${result.result.source}`,
    `Tags: ${tags}`,
  ].join("\n");
}

async function fetchEmbeddings(inputs: string[], apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings error: ${response.status} ${body}`);
  }

  return (await response.json()) as OpenAIEmbeddingResponse;
}

export async function storeEmbeddings(
  env: Env,
  taskId: string,
  results: StoredResult[]
): Promise<void> {
  if (!env.VECTORIZE) {
    logWarn("Vectorize binding not available, skipping embedding sync");
    return;
  }

  if (!env.OPENAI_API_KEY) {
    logWarn("OPENAI_API_KEY missing, skipping embedding sync");
    return;
  }

  if (results.length === 0) {
    return;
  }

  try {
    for (let i = 0; i < results.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = results.slice(i, i + EMBEDDING_BATCH_SIZE);
      const inputs = batch.map(buildEmbeddingText);
      const embeddingResponse = await fetchEmbeddings(inputs, env.OPENAI_API_KEY);

      const vectors = batch.map((item, index) => ({
        id: item.id,
        values: embeddingResponse.data[index]?.embedding || [],
        metadata: {
          taskId,
          source: item.result.source,
          title: item.result.title,
          url: item.result.url,
          category: item.result.category,
          tags: item.result.tags,
        },
      }));

      const invalidVector = vectors.find((vector) => vector.values.length !== EMBEDDING_DIMENSIONS);
      if (invalidVector) {
        throw new Error(
          `Embedding dimension mismatch for ${invalidVector.id}: ${invalidVector.values.length}`
        );
      }

      await env.VECTORIZE.upsert(vectors);
      logInfo("Vectorize upsert batch completed", {
        batchSize: vectors.length,
      });
    }

    await markResultsSynced(env.DB, results, EMBEDDING_MODEL);
  } catch (error) {
    logError("Vectorize sync failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}