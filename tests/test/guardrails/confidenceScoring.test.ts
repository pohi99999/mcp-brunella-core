/**
 * Phase 2 Tests: Confidence Scoring
 * Track: guardrails_evaluation_20260323
 */
import { describe, it, expect } from 'vitest';
import { calculateConfidence, type ConfidenceReport } from '@packages/agents/scoring/confidenceCalculator.js';

describe('calculateConfidence()', () => {
  it('baseline score for minimal success result', () => {
    const report = calculateConfidence({ success: true, message: 'OK' });
    expect(report.score).toBe(0.5);
    expect(report.factors['baseline']).toBe(0.5);
    expect(report.belowThreshold).toBe(true); // 0.5 < 0.6 default threshold
  });

  it('high confidence: data + detailed message + sources', () => {
    const report = calculateConfidence({
      success: true,
      message: 'Ez egy részletes üzenet ami több mint ötven karakter hosszú, tehát plusz pontot kap a scoring rendszerben.',
      data: { result: 'some value' },
      contextUsed: ['source1', 'source2'],
      thoughts: 'Részletes gondolkodási lánc a megoldásról...',
    });
    // baseline(0.5) + data(0.15) + detailed(0.10) + sources(0.15) + thoughts(0.05) = 0.95
    expect(report.score).toBe(0.95);
    expect(report.belowThreshold).toBe(false);
  });

  it('error penalty reduces score', () => {
    const report = calculateConfidence({
      success: false,
      message: 'Hiba történt a végrehajtás során',
    });
    // baseline(0.5) - error(0.30) = 0.20
    expect(report.score).toBe(0.2);
    expect(report.factors['errorPenalty']).toBe(-0.30);
    expect(report.belowThreshold).toBe(true);
  });

  it('metadata.sources counts as hasSources', () => {
    const report = calculateConfidence({
      success: true,
      message: 'OK',
      metadata: { sources: ['src1'] },
    });
    expect(report.factors['hasSources']).toBe(0.15);
    expect(report.score).toBe(0.65);
  });

  it('score is clamped to [0, 1]', () => {
    // Error with no other factors: 0.5 - 0.3 = 0.2 (no negative)
    const report = calculateConfidence({ success: false, message: 'x' });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
  });

  it('factors are tracked individually', () => {
    const report = calculateConfidence({
      success: true,
      message: 'Rövid',
      data: [1, 2, 3],
    });
    expect(report.factors).toEqual({
      baseline: 0.5,
      hasData: 0.15,
    });
    expect(report.score).toBe(0.65);
  });
});
