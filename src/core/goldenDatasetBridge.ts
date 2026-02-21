// FILE: src/core/goldenDatasetBridge.ts
// PURPOSE: G4.1 — Node.js → D1 golden dataset bridge (Phase 3: D1 Integration)
// RULES: RULE-GD1 (success+LLM→save), RULE-GD2 (quality threshold), RULE-GD3 (dedup SHA256)

import { logInfo, logError } from '../utils/logger.js';
import { vectorizeClient } from '../utils/vectorize.js';
import { getD1Adapter } from '../utils/globalDb.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GoldenSample {
  prompt: string;
  completion: string;
  source: string;
  quality: number;      // 0.0 - 1.0
}

export interface GoldenSaveResult {
  success: boolean;
  message?: string;
  stats?: Record<string, unknown>;
}

export interface GoldenDatasetStats {
  totalSamples: number;
  newSinceLastTraining: number;
  lastTrainingAt?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://localhost:8000';
const MIN_PROMPT_LENGTH = 10;       // RULE-GD2: minimum task length
const MIN_QUALITY_SCORE = 0.5;      // From goldConfig spec
const SAVE_TIMEOUT_MS = 5000;

// ============================================================================
// DEDUPLICATION (RULE-GD3)
// ============================================================================

const recentHashes = new Set<string>();
const MAX_HASH_CACHE = 500;

/**
 * Simple hash for deduplication — SHA256 not available in all envs,
 * so we use a FNV-1a-like fast hash.
 */
function quickHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function isDuplicate(prompt: string, completion: string): boolean {
  const hash = quickHash(prompt + '|||' + completion);
  if (recentHashes.has(hash)) return true;
  
  recentHashes.add(hash);
  if (recentHashes.size > MAX_HASH_CACHE) {
    // Remove oldest entries (Set iteration order = insertion order)
    const iter = recentHashes.values();
    for (let i = 0; i < 100; i++) iter.next();
    const toKeep = new Set<string>();
    for (const v of recentHashes) {
      if (toKeep.size >= MAX_HASH_CACHE - 100) break;
      toKeep.add(v);
    }
    recentHashes.clear();
    for (const v of toKeep) recentHashes.add(v);
  }
  
  return false;
}

// ============================================================================
// QUALITY SCORING (RULE-GD2)
// ============================================================================

/**
 * Heuristic quality score based on prompt/completion characteristics.
 */
export function calculateQuality(prompt: string, completion: string): number {
  let score = 0.5; // Base

  // Longer prompts tend to be more specific
  if (prompt.length > 50) score += 0.1;
  if (prompt.length > 200) score += 0.1;

  // Longer completions tend to be more complete
  if (completion.length > 100) score += 0.1;
  if (completion.length > 500) score += 0.1;

  // Code-like completions are more valuable
  if (/function|class|export|import|const|let|def |async/.test(completion)) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

// ============================================================================
// CORE BRIDGE
// ============================================================================

/**
 * Save a golden sample to D1 database (Phase 3: Cloud-first storage).
 * Applies RULE-GD1 (success check), RULE-GD2 (quality threshold), RULE-GD3 (dedup).
 */
export async function saveGoldenSample(sample: GoldenSample): Promise<GoldenSaveResult> {
  try {
    // RULE-GD2: quality threshold
    if (sample.prompt.length < MIN_PROMPT_LENGTH) {
      return { success: false, message: 'Prompt too short (RULE-GD2)' };
    }
    if (!sample.completion || sample.completion.trim().length === 0) {
      return { success: false, message: 'Empty completion (RULE-GD2)' };
    }
    if (sample.quality < MIN_QUALITY_SCORE) {
      return { success: false, message: `Quality ${sample.quality} below threshold ${MIN_QUALITY_SCORE} (RULE-GD2)` };
    }

    // RULE-GD3: deduplication
    if (isDuplicate(sample.prompt, sample.completion)) {
      return { success: false, message: 'Duplicate sample (RULE-GD3)' };
    }

    // Save to D1 (cloud-first strategy)
    const d1Adapter = getD1Adapter();
    if (d1Adapter) {
      try {
        await d1Adapter.insertGoldenSample({
          id: `golden_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          instruction: sample.prompt,
          output: sample.completion,
          source: sample.source,
        });
        
        logInfo('GoldenBridge', `Sample saved to D1 from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
        return { 
          success: true, 
          message: 'Saved to D1 cloud storage',
          stats: { storage: 'd1', quality: sample.quality }
        };
      } catch (d1Error: unknown) {
        const msg = d1Error instanceof Error ? d1Error.message : String(d1Error);
        logError('GoldenBridge', `D1 save failed, falling back to Python: ${msg}`);
        // Fall through to Python backup
      }
    }

    // Fallback: Python backend (legacy support)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    try {
      const response = await fetch(`${PYTHON_BASE_URL}/incubator/gold-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: sample.prompt,
          completion: sample.completion,
          source: sample.source,
          quality: sample.quality
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Python API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      logInfo('GoldenBridge', `Sample saved to Python backup from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
      return { success: true, message: data.message, stats: data.stats };
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('GoldenBridge', `Save failed: ${msg}`);
    return { success: false, message: msg };
  }
}

/**
 * Get golden dataset statistics from D1 (cloud-first) or Python backup.
 */
export async function getGoldenStats(): Promise<GoldenDatasetStats | null> {
  try {
    // Try D1 first
    const d1Adapter = getD1Adapter();
    if (d1Adapter) {
      try {
        const samplesResult = await d1Adapter.getAllGoldenSamples(1000);
        const samples = samplesResult.results || [];
        return {
          totalSamples: samples.length,
          newSinceLastTraining: samples.filter(s => {
            const created = new Date(s.created_at);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return created > weekAgo;
          }).length,
          lastTrainingAt: undefined // TODO: track training runs in D1
        };
      } catch (d1Error: unknown) {
        const msg = d1Error instanceof Error ? d1Error.message : String(d1Error);
        logError('GoldenBridge', `D1 stats failed, trying Python backup: ${msg}`);
      }
    }

    // Fallback: Python backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    const response = await fetch(`${PYTHON_BASE_URL}/incubator/stats`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    return data.stats as GoldenDatasetStats;
  } catch {
    logError('GoldenBridge', 'Failed to get golden dataset stats from both D1 and Python');
    return null;
  }
}

/**
 * Auto-save hook for AgentManager — called after successful agent execution.
 * Implements RULE-GD1: success + LLM call → save.
 */
export async function autoSaveGoldenSample(
  agentName: string,
  task: string,
  result: string | Record<string, unknown> | object
): Promise<void> {
  const completion = typeof result === 'string' ? result : JSON.stringify(result);
  const quality = calculateQuality(task, completion);

  if (quality < MIN_QUALITY_SCORE) {
    return; // Skip low-quality samples silently
  }

  // Fire-and-forget (non-blocking, RULE: audit write async)
  saveGoldenSample({
    prompt: task,
    completion,
    source: agentName,
    quality
  }).catch(() => { /* non-critical */ });

  // Vectorize upsert
  if (process.env.CF_VECTORIZE_ENABLED === 'true' || vectorizeClient.getStatus().enabled) {
    vectorizeClient.upsertText(
      `golden-${Date.now()}`,
      `${task}\n${completion}`,
      { source: agentName, type: 'golden_sample', quality }
    ).catch(e => logError('GoldenBridge', `Vectorize upsert failed: ${e.message}`));
  }
}
