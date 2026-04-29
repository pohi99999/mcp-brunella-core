import { describe, expect, it } from 'vitest';
import {
  buildRuntimeDriftSummary,
  didNodeRestart,
  didPythonRestart,
  parsePythonHealthTelemetry,
  type RuntimeDriftSample,
} from '@packages/utils/runtimeDriftMonitor.js';
import type {
  RuntimeBudgetTelemetry,
  RuntimeMemoryTelemetry,
  RuntimeTelemetry,
} from '@packages/utils/runtimeTelemetry.js';

type SampleOverrides = {
  timestamp: string;
  node?: Partial<RuntimeTelemetry> & {
    memory?: Partial<RuntimeMemoryTelemetry>;
    budget?: Partial<RuntimeBudgetTelemetry>;
  };
  python?: Partial<RuntimeDriftSample['python']>;
};

type LastSampleOverrides = Omit<SampleOverrides, 'timestamp'>;

/**
 * Creates an array of `count` samples spanning `minuteSpan` minutes.
 * The last sample optionally receives `lastOverride` to simulate pressure/drift.
 */
function makeObservationWindow(
  count: number,
  minuteSpan: number,
  lastOverride?: LastSampleOverrides,
): RuntimeDriftSample[] {
  const startMs = Date.parse('2026-04-02T10:00:00.000Z');
  const intervalMs = count > 1 ? (minuteSpan * 60_000) / (count - 1) : 0;
  return Array.from({ length: count }, (_unused, index) => {
    const ts = new Date(startMs + index * intervalMs).toISOString();
    const isLast = index === count - 1;
    return createSample(isLast && lastOverride ? { ...lastOverride, timestamp: ts } : { timestamp: ts });
  });
}

const baseNodeTelemetry: RuntimeTelemetry = {
  pid: 100,
  uptimeSeconds: 120,
  memory: {
    rssMb: 600,
    heapTotalMb: 400,
    heapUsedMb: 300,
    externalMb: 40,
    arrayBuffersMb: 10,
    heapLimitMb: 1536,
    heapUtilizationPercent: 45,
    state: 'healthy',
  },
  budget: {
    configuredHeapMb: 1536,
    runtimeMemoryLimitMb: 2048,
    restartThresholdMb: 1792,
    effectiveHeapLimitMb: 1536,
    heapDriftMb: 0,
    headroomMb: 512,
    source: 'env',
    state: 'aligned',
  },
};

const basePythonTelemetry: RuntimeDriftSample['python'] = {
  status: 'healthy',
  pid: 200,
  uptimeSeconds: 120,
  memoryRssMb: 256,
  memoryLimitMb: 1024,
  memoryState: 'healthy',
};

function createSample(overrides: SampleOverrides): RuntimeDriftSample {
  return {
    timestamp: overrides.timestamp,
    node: {
      ...baseNodeTelemetry,
      ...overrides.node,
      memory: {
        ...baseNodeTelemetry.memory,
        ...overrides.node?.memory,
      },
      budget: {
        ...baseNodeTelemetry.budget,
        ...overrides.node?.budget,
      },
    },
    python: {
      ...basePythonTelemetry,
      ...overrides.python,
    },
  };
}

describe('runtime drift monitor', () => {
  it('parses python health payload with runtime details', () => {
    expect(
      parsePythonHealthTelemetry({
        status: 'ok',
        runtime: {
          pid: 123,
          uptimeSeconds: 45,
          memory: {
            rssMb: 321.5,
            limitMb: 1024,
            state: 'warn',
          },
        },
      }),
    ).toEqual({
      status: 'healthy',
      pid: 123,
      uptimeSeconds: 45,
      memoryRssMb: 321.5,
      memoryLimitMb: 1024,
      memoryState: 'warn',
      error: undefined,
    });
  });

  it('detects node and python restarts from pid or uptime rollback', () => {
    const first = createSample({ timestamp: '2026-04-02T10:00:00.000Z' });
    const nodeRestart = createSample({
      timestamp: '2026-04-02T10:01:00.000Z',
      node: { pid: 101, uptimeSeconds: 5 },
    });
    const pythonRestart = createSample({
      timestamp: '2026-04-02T10:01:00.000Z',
      python: { pid: 201, uptimeSeconds: 4 },
    });

    expect(didNodeRestart(first, nodeRestart)).toBe(true);
    expect(didPythonRestart(first, pythonRestart)).toBe(true);
  });

  it('builds a warning summary when drift and restarts accumulate', () => {
    const summary = buildRuntimeDriftSummary([
      createSample({ timestamp: '2026-04-02T10:00:00.000Z' }),
      createSample({
        timestamp: '2026-04-02T10:05:00.000Z',
        node: {
          pid: 101,
          uptimeSeconds: 8,
          memory: {
            heapUtilizationPercent: 82.4,
            heapUsedMb: 1267,
            state: 'warn',
          },
          budget: {
            state: 'drift',
            heapDriftMb: 512,
          },
        },
        python: {
          status: 'degraded',
          pid: 201,
          uptimeSeconds: 6,
          memoryRssMb: 790,
          memoryState: 'warn',
        },
      }),
    ]);

    expect(summary.overallState).toBe('warn');
    expect(summary.node.restartCount).toBe(1);
    expect(summary.node.driftCount).toBe(1);
    expect(summary.python.restartCount).toBe(1);
    expect(summary.python.status).toBe('degraded');
    expect(summary.python.maxMemoryRssMb).toBe(790);
    expect(summary.recommendation.overallAction).toBe('observe');
  });

  it('builds tuning recommendation when sustained pressure is visible across enough samples', () => {
    const summary = buildRuntimeDriftSummary([
      createSample({ timestamp: '2026-04-02T10:00:00.000Z' }),
      createSample({
        timestamp: '2026-04-02T10:05:00.000Z',
        node: {
          memory: {
            heapUsedMb: 1338,
            heapUtilizationPercent: 80.1,
            state: 'warn',
          },
        },
        python: {
          memoryRssMb: 844,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:10:00.000Z',
        node: {
          memory: {
            heapUsedMb: 1382,
            heapUtilizationPercent: 84.5,
            state: 'warn',
          },
        },
        python: {
          memoryRssMb: 872,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:15:00.000Z',
        node: {
          memory: {
            heapUtilizationPercent: 88.2,
            heapUsedMb: 1410,
            state: 'warn',
          },
        },
        python: {
          memoryRssMb: 910,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:20:00.000Z',
        node: {
          memory: {
            heapUtilizationPercent: 89.8,
            heapUsedMb: 1452,
            state: 'warn',
          },
        },
        python: {
          memoryRssMb: 930,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:25:00.000Z',
        node: {
          memory: {
            heapUtilizationPercent: 90.2,
            heapUsedMb: 1468,
            state: 'critical',
          },
        },
        python: {
          memoryRssMb: 940,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:30:00.000Z',
        node: {
          pid: 101,
          uptimeSeconds: 12,
          memory: {
            heapUtilizationPercent: 90.8,
            heapUsedMb: 1479,
            state: 'critical',
          },
        },
        python: {
          memoryRssMb: 946,
          memoryState: 'warn',
        },
      }),
      createSample({
        timestamp: '2026-04-02T10:35:00.000Z',
        node: {
          pid: 101,
          uptimeSeconds: 9,
          memory: {
            heapUtilizationPercent: 91.6,
            heapUsedMb: 1488,
            state: 'critical',
          },
        },
        python: {
          memoryRssMb: 948,
          memoryState: 'warn',
        },
      }),
    ]);

    expect(summary.recommendation.overallAction).toBe('tune');
    expect(summary.recommendation.node.action).toBe('tune');
    expect(summary.recommendation.node.suggested.heapMb).toBeGreaterThan(1536);
    expect(summary.recommendation.python.action).toBe('tune');
    expect(summary.recommendation.python.suggested.memoryLimitMb).toBeGreaterThan(1024);
  });
});

// ---------------------------------------------------------------------------
// Recommendation engine — threshold tuning heuristics
// Uses makeObservationWindow to build realistic, timestamp-spaced sample windows.
// ---------------------------------------------------------------------------
describe('recommendation engine — threshold tuning heuristics', () => {
  it('returns observe when sample count is below minimum threshold', () => {
    const summary = buildRuntimeDriftSummary(makeObservationWindow(4, 10));

    expect(summary.recommendation.overallAction).toBe('observe');
    expect(summary.recommendation.confidence).toBe('low');
    expect(summary.recommendation.signals).toContain('insufficient_observation_window');
  });

  it('returns observe when window duration is below minimum even with enough samples', () => {
    // 8 samples but only 5 minutes → insufficient window
    const summary = buildRuntimeDriftSummary(makeObservationWindow(8, 5));

    expect(summary.recommendation.overallAction).toBe('observe');
    expect(summary.recommendation.confidence).toBe('low');
  });

  it('returns align when last sample has contract drift state', () => {
    const summary = buildRuntimeDriftSummary(
      makeObservationWindow(10, 25, { node: { budget: { state: 'drift', heapDriftMb: 400 } } }),
    );

    expect(summary.recommendation.overallAction).toBe('align');
    expect(summary.recommendation.node.action).toBe('align');
    expect(summary.recommendation.confidence).toBe('high');
    expect(summary.recommendation.signals).toContain('node_contract_misaligned');
  });

  it('returns align when last sample has invalid budget state', () => {
    const summary = buildRuntimeDriftSummary(
      makeObservationWindow(10, 25, { node: { budget: { state: 'invalid' } } }),
    );

    expect(summary.recommendation.overallAction).toBe('align');
    expect(summary.recommendation.node.action).toBe('align');
  });

  it('returns tune with node heap pressure signal when heap utilization exceeds 82%', () => {
    const summary = buildRuntimeDriftSummary(
      makeObservationWindow(10, 25, {
        node: { memory: { heapUtilizationPercent: 86, heapUsedMb: 1320, state: 'warn' } },
      }),
    );

    expect(summary.recommendation.overallAction).toBe('tune');
    expect(summary.recommendation.node.action).toBe('tune');
    expect(summary.recommendation.signals).toContain('node_heap_pressure');
    // suggested heap should be rounded up above current max
    expect(summary.recommendation.node.suggested.heapMb).toBeGreaterThan(
      baseNodeTelemetry.budget!.configuredHeapMb!,
    );
  });

  it('returns tune for python when python memory utilization ratio exceeds 0.82', () => {
    // memoryRssMb (870) / memoryLimitMb (1024) ≈ 0.85 → memory pressure
    const summary = buildRuntimeDriftSummary(
      makeObservationWindow(10, 25, {
        python: { memoryRssMb: 870, memoryLimitMb: 1024, memoryState: 'warn' },
      }),
    );

    expect(summary.recommendation.python.action).toBe('tune');
    expect(summary.recommendation.signals).toContain('python_memory_pressure');
    expect(summary.recommendation.python.suggested.memoryLimitMb).toBeGreaterThan(1024);
  });

  it('returns keep with high confidence when stable over an extended window', () => {
    // 10 samples, all baseline (healthy, no pressure, no restarts), 35 min window
    const summary = buildRuntimeDriftSummary(makeObservationWindow(10, 35));

    expect(summary.recommendation.overallAction).toBe('keep');
    expect(summary.recommendation.node.action).toBe('keep');
    expect(summary.recommendation.python.action).toBe('keep');
    expect(summary.recommendation.confidence).toBe('high');
    expect(summary.recommendation.signals).toContain('stable_headroom');
  });

  it('returns keep with medium confidence when stable but window is under 30 minutes', () => {
    // 10 samples, all baseline, 20 min window (≥15 but <30)
    const summary = buildRuntimeDriftSummary(makeObservationWindow(10, 20));

    expect(summary.recommendation.overallAction).toBe('keep');
    expect(summary.recommendation.confidence).toBe('medium');
  });

  it('current budget values are preserved in node suggestion when action is keep', () => {
    const summary = buildRuntimeDriftSummary(makeObservationWindow(10, 35));

    expect(summary.recommendation.node.current.heapMb).toBe(1536);
    expect(summary.recommendation.node.suggested.heapMb).toBe(1536);
    expect(summary.recommendation.node.current.runtimeLimitMb).toBe(2048);
    expect(summary.recommendation.python.current.memoryLimitMb).toBe(1024);
  });
});
