/**
 * Guardrails API Routes
 * Track: guardrails_evaluation_20260323 Phase 4
 *
 * Endpoints:
 *   GET /api/v1/guardrails/stats   → Guardrails statisztikák
 *   POST /api/v1/guardrails/redact → Szöveg redakció tesztelés
 */

import { Router } from 'express';
import { redactText } from '../security/redactor.js';
import { ensureError } from '../utils/ensureError.js';

// In-memory counters (reset on restart — later: persist to SQLite)
const guardrailsCounters = {
  validationsPassed: 0,
  validationsFailed: 0,
  redactionsTriggered: 0,
  confidenceSum: 0,
  confidenceCount: 0,
};

/**
 * Növeli a validáció számlálót (BaseAgent middleware hívja).
 */
export function recordValidation(passed: boolean, confidence?: number): void {
  if (passed) {
    guardrailsCounters.validationsPassed++;
  } else {
    guardrailsCounters.validationsFailed++;
  }
  if (confidence !== undefined) {
    guardrailsCounters.confidenceSum += confidence;
    guardrailsCounters.confidenceCount++;
  }
}

/**
 * Növeli a redakció számlálót.
 */
export function recordRedaction(): void {
  guardrailsCounters.redactionsTriggered++;
}

export function createGuardrailsRouter(): Router {
  const router = Router();

  router.get('/stats', (_req, res) => {
    try {
      const avgConfidence = guardrailsCounters.confidenceCount > 0
        ? guardrailsCounters.confidenceSum / guardrailsCounters.confidenceCount
        : 0;

      res.json({
        validationsPassed: guardrailsCounters.validationsPassed,
        validationsFailed: guardrailsCounters.validationsFailed,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        redactionsTriggered: guardrailsCounters.redactionsTriggered,
        strictMode: process.env.GUARDRAILS_STRICT === 'true',
        confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6'),
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/redact', (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text mező szükséges (string)' });
        return;
      }
      const result = redactText(text);
      res.json(result);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
