import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-level mocks must come before imports that use them
vi.mock('@packages/core-logic/copilotCognitiveBridge.js', () => ({
  reflect: vi.fn().mockResolvedValue({ stored: true, layers: [], lesson: '', qualityScore: 0.8 }),
}));

vi.mock('@packages/core-logic/structuredMemory.js', () => ({
  saveMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { CopilotFeedbackChannel } from '@packages/core-logic/copilotFeedbackChannel.js';
import type { CopilotReviewFeedback } from '@packages/core-logic/copilotFeedbackChannel.js';
import { reflect as mockReflect } from '@packages/core-logic/copilotCognitiveBridge.js';
import { saveMemory as mockSaveMemory } from '@packages/core-logic/structuredMemory.js';

// Minimal SelfModel stub
function makeSelfModelStub() {
  return {
    ingestSignal: vi.fn(),
    reflect: vi.fn().mockReturnValue({ capabilities: [], signals: [] }),
  };
}

function makeFeedback(overrides: Partial<CopilotReviewFeedback> = {}): CopilotReviewFeedback {
  return {
    trackId: 'test-track-001',
    phase: 'review',
    reviewedAt: new Date().toISOString(),
    qualityScore: 0.85,
    summary: 'Good overall but some type-safety gaps',
    findings: [
      {
        severity: 'HIGH',
        ruleId: 'no-any',
        message: 'Avoid `any` type in public API',
        filePath: 'src/core/foo.ts',
        line: 42,
      },
    ],
    ...overrides,
  };
}

describe('CopilotFeedbackChannel', () => {
  let selfModel: ReturnType<typeof makeSelfModelStub>;
  let channel: CopilotFeedbackChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    selfModel = makeSelfModelStub();
    channel = new CopilotFeedbackChannel(selfModel as never);
  });

  it('should emit finding + summary signals for qualifying feedback', async () => {
    const feedback = makeFeedback();
    const result = await channel.ingest(feedback);

    // 1 finding + 1 summary = 2 signals
    expect(result.signalsEmitted).toBe(2);
    expect(result.findingsProcessed).toBe(1);
    expect(selfModel.ingestSignal).toHaveBeenCalledTimes(2);
  });

  it('should call cognitiveReflect for any feedback (thin adapter pattern)', async () => {
    await channel.ingest(makeFeedback({ qualityScore: 0.85 }));
    expect(mockReflect).toHaveBeenCalledOnce();
    const call = vi.mocked(mockReflect).mock.calls[0]![0];
    expect(call.agentName).toBe('CopilotCLI/code-review');
    expect(call.success).toBe(true); // 0.85 >= 0.5
  });

  it('should call saveMemory for high-quality reviews (≥ 0.7)', async () => {
    await channel.ingest(makeFeedback({ qualityScore: 0.75 }));
    expect(mockSaveMemory).toHaveBeenCalledOnce();
    const call = vi.mocked(mockSaveMemory).mock.calls[0]![0];
    expect(call.ttlDays).toBe(90);
    expect(call.confidence).toBeCloseTo(0.75);
  });

  it('should NOT call saveMemory for low-quality reviews (< 0.7)', async () => {
    await channel.ingest(makeFeedback({ qualityScore: 0.65 }));
    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('should preserve copilotSeverity in finding signal payload', async () => {
    const feedback = makeFeedback({
      findings: [
        { severity: 'CRITICAL', ruleId: 'sec-injection', message: 'SQL injection risk', filePath: 'src/db.ts', line: 10 },
      ],
    });
    await channel.ingest(feedback);

    const firstCall = selfModel.ingestSignal.mock.calls[0]![0];
    // CRITICAL severity → payload.severity === 'high' AND payload.copilotSeverity === 'CRITICAL'
    expect(firstCall.payload.severity).toBe('high');
    expect(firstCall.payload.copilotSeverity).toBe('CRITICAL');
  });

  it('HIGH findings should map to payload.severity === "high" (not "medium")', async () => {
    const feedback = makeFeedback({
      findings: [
        { severity: 'HIGH', ruleId: 'no-any', message: 'any usage', filePath: 'src/x.ts', line: 1 },
      ],
    });
    await channel.ingest(feedback);

    const findingSignal = selfModel.ingestSignal.mock.calls[0]![0];
    expect(findingSignal.payload.severity).toBe('high');
    expect(findingSignal.payload.copilotSeverity).toBe('HIGH');
  });

  it('should skip INFO findings when default minSeverity is LOW', async () => {
    const feedback = makeFeedback({
      findings: [
        { severity: 'INFO', ruleId: 'style', message: 'Formatting nit', filePath: 'src/x.ts' },
        { severity: 'MEDIUM', ruleId: 'error-handling', message: 'Unhandled promise', filePath: 'src/y.ts' },
      ],
      qualityScore: 0.9,
    });
    const result = await channel.ingest(feedback);

    // INFO is excluded by default (minSeverity=LOW means: CRITICAL, HIGH, MEDIUM, LOW qualify; INFO does not)
    expect(result.findingsProcessed).toBe(1); // only MEDIUM
    expect(result.signalsEmitted).toBe(2);    // 1 finding + 1 summary
  });

  it('should report cognitiveReflectSucceeded in result', async () => {
    const result = await channel.ingest(makeFeedback());
    expect(result.cognitiveReflectSucceeded).toBe(true);
  });

  it('should still return a result if cognitiveReflect throws', async () => {
    vi.mocked(mockReflect).mockRejectedValueOnce(new Error('bridge unavailable'));
    const result = await channel.ingest(makeFeedback());
    expect(result.cognitiveReflectSucceeded).toBe(false);
    expect(result.signalsEmitted).toBeGreaterThan(0); // ingest still succeeded
  });
});
