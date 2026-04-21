/**
 * Integration Tests — Reflection Engine + Continual Learning
 *
 * Track: brunella_reflection_continual_learning_20260402
 *
 * Verified functionality:
 *   1. reflect() — qualityScore, lessons, improvements computed correctly
 *   2. detectPainPoints() — recurring failure detection with threshold logic
 *   3. runNightlyCycle() — MetaReasoner + SelfModel + GraphRAG integration
 *   4. getStats() — aggregate stats shape
 *   5. createReflectionRouter() exposes correct HTTP endpoints
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

const storeLessonMock = vi.fn();
vi.mock('../src/core/graphRagEngine.js', () => ({
  GraphRagEngine: {
    getInstance: vi.fn().mockReturnValue({
      storeLesson: storeLessonMock,
      getLessonsForContext: vi.fn().mockReturnValue([]),
    }),
  },
}));

// Decision array accessible to tests
let _decisions: Array<{ outcome: string; decisionMaker: string; outcomeDetails?: string }> = [];

vi.mock('../src/core/selfModel.js', () => ({
  SelfModel: vi.fn().mockImplementation(() => ({
    reflect: vi.fn(),
    ingestSignal: vi.fn().mockReturnValue({ signalId: 'mock-sig', timestamp: '', source: '', category: 'performance', value: 0, context: {} }),
    setConstraint: vi.fn(),
    getState: vi.fn().mockReturnValue({
      health: 'healthy',
      coherence: 0.85,
      blindSpots: [],
      capabilities: ['coding', 'analysis'],
      lastUpdated: Date.now(),
    }),
  })),
}));

vi.mock('../src/core/metaReasoner.js', () => ({
  MetaReasoner: vi.fn().mockImplementation(() => ({
    reason: vi.fn().mockReturnValue([]),
    getInsights: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockReturnValue({ decisionsAnalyzed: 0, insightsProduced: 0 }),
    recordDecision: vi.fn(),
    getDecisions: vi.fn().mockImplementation((limit = 50) => _decisions.slice(-limit)),
  })),
}));

// ─── Helper: get singleton ───────────────────────────────────────────────────
async function getEngine() {
  const { ReflectionEngine } = await import('../src/core/reflectionEngine.js');
  return ReflectionEngine.getInstance();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[Integration] ReflectionEngine — brunella_reflection_continual_learning_20260402', () => {
  beforeEach(() => {
    _decisions = [];
    storeLessonMock.mockClear();
    vi.clearAllMocks();
  });

  // ── 1. reflect() ──────────────────────────────────────────────────────────

  describe('reflect()', () => {
    it('computes qualityScore in [0,1] for a successful task', async () => {
      const engine = await getEngine();
      const result = await engine.reflect({
        taskId: 't-001',
        agent: 'DeveloperAgent',
        task: 'implement feature X',
        result: 'success',
        output: 'Feature implemented with tests.',
        durationMs: 1200,
      });

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
      expect(result.taskId).toBe('t-001');
      expect(Array.isArray(result.lessons)).toBe(true);
      expect(Array.isArray(result.improvements)).toBe(true);
    });

    it('scores failed tasks lower than successful ones', async () => {
      const engine = await getEngine();
      const successResult = await engine.reflect({
        taskId: 't-002',
        agent: 'DeveloperAgent',
        task: 'build API',
        result: 'success',
        output: 'API working.',
        durationMs: 800,
      });
      const failResult = await engine.reflect({
        taskId: 't-003',
        agent: 'DeveloperAgent',
        task: 'build API',
        result: 'failure',
        output: '',
        errorMessage: 'Compilation error',
        durationMs: 100,
      });

      expect(failResult.qualityScore).toBeLessThan(successResult.qualityScore);
    });

    it('stores lesson to GraphRAG after reflection', async () => {
      storeLessonMock.mockClear();
      const engine = await getEngine();
      await engine.reflect({
        taskId: 't-004',
        agent: 'ResearcherAgent',
        task: 'gather research',
        result: 'success',
        output: 'Comprehensive research done.',
        durationMs: 500,
      });

      expect(storeLessonMock).toHaveBeenCalled();
    });
  });

  // ── 2. detectPainPoints() ─────────────────────────────────────────────────

  describe('detectPainPoints()', () => {
    it('returns empty array when no failures recorded', async () => {
      _decisions = [
        { outcome: 'success', decisionMaker: 'AgentA' },
        { outcome: 'success', decisionMaker: 'AgentB' },
      ];
      const engine = await getEngine();
      expect(engine.detectPainPoints()).toHaveLength(0);
    });

    it('detects agent with >=2 failures', async () => {
      _decisions = [
        { outcome: 'failure', decisionMaker: 'EvaluatorAgent', outcomeDetails: 'Timeout' },
        { outcome: 'failure', decisionMaker: 'EvaluatorAgent', outcomeDetails: 'Timeout' },
        { outcome: 'failure', decisionMaker: 'EvaluatorAgent', outcomeDetails: 'OOM' },
        { outcome: 'success', decisionMaker: 'DeveloperAgent' },
      ];
      const engine = await getEngine();
      const painPoints = engine.detectPainPoints();

      expect(painPoints.length).toBeGreaterThanOrEqual(1);
      const pp = painPoints.find(p => p.agent === 'EvaluatorAgent');
      expect(pp).toBeDefined();
      expect(pp!.failureCount).toBe(3);
      expect(['low', 'medium', 'high']).toContain(pp!.severity);
      expect(pp!.recommendation.length).toBeGreaterThan(0);
    });

    it('sorts pain points by failureCount descending', async () => {
      _decisions = [
        { outcome: 'failure', decisionMaker: 'AgentA' },
        { outcome: 'failure', decisionMaker: 'AgentB' },
        { outcome: 'failure', decisionMaker: 'AgentB' },
        { outcome: 'failure', decisionMaker: 'AgentA' },
        { outcome: 'failure', decisionMaker: 'AgentB' },
      ];
      const engine = await getEngine();
      const painPoints = engine.detectPainPoints();

      expect(painPoints.length).toBeGreaterThanOrEqual(2);
      expect(painPoints[0]!.failureCount).toBeGreaterThanOrEqual(painPoints[1]!.failureCount);
    });

    it('ignores agents with fewer than 2 failures', async () => {
      _decisions = [
        { outcome: 'failure', decisionMaker: 'OneShot' },
        { outcome: 'success', decisionMaker: 'OneShot' },
      ];
      const engine = await getEngine();
      expect(engine.detectPainPoints().find(p => p.agent === 'OneShot')).toBeUndefined();
    });
  });

  // ── 3. runNightlyCycle() ──────────────────────────────────────────────────

  describe('runNightlyCycle()', () => {
    it('returns NightlyCycleResult with required fields', async () => {
      const engine = await getEngine();
      const result = await engine.runNightlyCycle();

      expect(typeof result.ranAt).toBe('string');
      expect(new Date(result.ranAt).getTime()).not.toBeNaN();
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.painPoints)).toBe(true);
      expect(typeof result.selfModelHealth).toBe('string');
      expect(typeof result.coherence).toBe('number');
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalReflections).toBe('number');
    });

    it('stores GraphRAG lesson when pain points detected', async () => {
      _decisions = [
        { outcome: 'failure', decisionMaker: 'PainAgent' },
        { outcome: 'failure', decisionMaker: 'PainAgent' },
        { outcome: 'failure', decisionMaker: 'PainAgent' },
      ];
      storeLessonMock.mockClear();

      const engine = await getEngine();
      const result = await engine.runNightlyCycle();

      expect(result.painPoints.length).toBeGreaterThan(0);
      expect(storeLessonMock).toHaveBeenCalledWith(
        expect.stringContaining('nightly-cycle-'),
        'ReflectionEngine',
        'nightly_learning_cycle',
        expect.stringContaining('PainAgent'),
        expect.any(Number),
      );
    });

    it('returns cycle result even when no pain points', async () => {
      _decisions = [];
      const engine = await getEngine();
      const result = await engine.runNightlyCycle();

      expect(result.painPoints).toHaveLength(0);
      expect(typeof result.ranAt).toBe('string');
    });
  });

  // ── 4. getStats() ─────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('returns valid ReflectionStats structure', async () => {
      const engine = await getEngine();
      const stats = engine.getStats();

      expect(typeof stats.totalReflections).toBe('number');
      expect(typeof stats.avgQualityScore).toBe('number');
      expect(typeof stats.totalLessons).toBe('number');
      expect(typeof stats.selfModelHealth).toBe('string');
    });
  });

  // ── 5. HTTP route factory ─────────────────────────────────────────────────

  describe('createReflectionRouter()', () => {
    it('exposes all required endpoint paths', async () => {
      const { createReflectionRouter } = await import('../src/server/routes/reflection.js');
      const router = createReflectionRouter();

      const paths = (router as any).stack
        ?.map((layer: any) => layer.route?.path)
        .filter(Boolean) as string[];

      expect(paths).toContain('/stats');
      expect(paths).toContain('/pain-points');
      expect(paths).toContain('/context');
      expect(paths).toContain('/insights');
      expect(paths).toContain('/nightly-cycle');
      expect(paths).toContain('/reflect');
    });
  });
});

