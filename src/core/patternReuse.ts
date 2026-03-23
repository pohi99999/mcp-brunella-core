import { recordMemoryCacheHit, recordMemoryCacheMiss } from "../utils/metrics.js";
import { hashTask } from "./hashUtils.js";
import { incrementReuseCount, queryMemory, type StoredAgentMemory } from "./structuredMemory.js";

export interface PatternReuseResult<T = unknown> {
  matched: boolean;
  threshold: number;
  memory?: StoredAgentMemory<T>;
}

export function getPatternReuseThreshold(): number {
  const raw = Number(process.env.BAS_MEMORY_CACHE_THRESHOLD ?? "0.7");
  if (!Number.isFinite(raw)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, raw));
}

export function checkPattern<T = unknown>(agentName: string, task: string): PatternReuseResult<T> {
  const threshold = getPatternReuseThreshold();
  const match = queryMemory({ agentName, task, limit: 1 })[0] as StoredAgentMemory<T> | undefined;

  if (!match || match.confidence < threshold) {
    recordMemoryCacheMiss(agentName);
    return { matched: false, threshold };
  }

  incrementReuseCount(agentName, match.taskHash);
  recordMemoryCacheHit(agentName);
  const { taskHash } = hashTask(task);

  return {
    matched: true,
    threshold,
    memory: {
      ...match,
      taskHash,
      reuseCount: match.reuseCount + 1,
      lastReusedAt: new Date().toISOString(),
    },
  };
}
