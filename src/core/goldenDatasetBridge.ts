// FILE: src/core/goldenDatasetBridge.ts
// PURPOSE: G4.1 — Node.js → Python golden dataset bridge
// RULES: RULE-GD1 (success+LLM→save), RULE-GD2 (quality threshold), RULE-GD3 (dedup SHA256)

import { logInfo, logError } from '../utils/logger.js';

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
 * Save a golden sample to the Python backend.
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

    // Call Python backend
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
      logInfo('GoldenBridge', `Sample saved from ${sample.source} (quality: ${sample.quality.toFixed(2)})`);
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
 * Get golden dataset statistics from Python backend.
 */
export async function getGoldenStats(): Promise<GoldenDatasetStats | null> {
  try {
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
    logError('GoldenBridge', 'Failed to get golden dataset stats');
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
}
