/**
 * Guardrails Phase 2: Confidence Scoring Framework
 * Track: guardrails_evaluation_20260323
 *
 * Heurisztika-alapú confidence kalkulátor: agent eredmény minőségbecslés.
 * BaseAgent.execute() integrálja automatikusan.
 */
import type { AgentResult } from '../BaseAgent.js';

const CONFIDENCE_THRESHOLD = () =>
  parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6');

export interface ConfidenceReport {
  score: number;
  factors: Record<string, number>;
  belowThreshold: boolean;
}

/**
 * Automatikus confidence kalkuláció heurisztikák alapján.
 *
 * Faktorok:
 * - baseline: 0.5
 * - hasData: +0.15 ha van data mező
 * - detailedMessage: +0.10 ha message > 50 karakter
 * - hasSources: +0.15 ha vannak források (contextUsed / metadata.sources)
 * - hasThoughts: +0.05 ha van gondolkodási lánc
 * - isError: -0.30 ha success=false
 */
export function calculateConfidence(result: AgentResult): ConfidenceReport {
  const factors: Record<string, number> = {};

  let score = 0.5;
  factors['baseline'] = 0.5;

  if (result.data !== undefined && result.data !== null) {
    score += 0.15;
    factors['hasData'] = 0.15;
  }

  if (result.message && result.message.length > 50) {
    score += 0.10;
    factors['detailedMessage'] = 0.10;
  }

  if (result.contextUsed && result.contextUsed.length > 0) {
    score += 0.15;
    factors['hasSources'] = 0.15;
  } else if (result.metadata?.sources && Array.isArray(result.metadata.sources) && result.metadata.sources.length > 0) {
    score += 0.15;
    factors['hasSources'] = 0.15;
  }

  if (result.thoughts && result.thoughts.length > 20) {
    score += 0.05;
    factors['hasThoughts'] = 0.05;
  }

  if (!result.success) {
    score -= 0.30;
    factors['errorPenalty'] = -0.30;
  }

  score = Math.max(0, Math.min(1, score));
  const threshold = CONFIDENCE_THRESHOLD();

  return {
    score: Math.round(score * 100) / 100,
    factors,
    belowThreshold: score < threshold,
  };
}
