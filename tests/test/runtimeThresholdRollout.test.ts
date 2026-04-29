import { describe, expect, it, vi } from 'vitest';
vi.unmock('@packages/utils/runtimeThresholdRollout.js');
import {
  buildThresholdRolloutPlan,
  renderThresholdRolloutPlan,
  type RuntimeDriftThresholdSummary,
} from '@packages/utils/runtimeThresholdRollout.js';

function createSummary(
  action: 'align' | 'tune' | 'observe' | 'keep',
): RuntimeDriftThresholdSummary {
  return {
    overallState: 'warn',
    sampleCount: 18,
    windowMinutes: 30,
    lastSampleAt: '2026-04-02T10:11:12.000Z',
    recommendation: {
      overallAction: action,
      confidence: 'high',
      rationale: 'Operator approval required before any env rollout.',
      signals: ['node_heap_pressure', 'python_memory_pressure'],
      node: {
        action,
        rationale: 'Node envelope should be aligned carefully.',
        current: {
          heapMb: 1536,
          runtimeLimitMb: 2048,
          restartThresholdMb: 1792,
        },
        suggested: {
          heapMb: 1792,
          runtimeLimitMb: 2304,
          restartThresholdMb: 2048,
        },
      },
      python: {
        action: action === 'observe' || action === 'keep' ? 'observe' : 'tune',
        rationale: 'Python limit remains stability-first.',
        current: {
          memoryLimitMb: 1024,
        },
        suggested: {
          memoryLimitMb: 1152,
        },
      },
    },
    node: {
      restartCount: 2,
      driftCount: 4,
    },
    python: {
      status: 'degraded',
      restartCount: 1,
      unavailableCount: 0,
    },
  };
}

describe('renderThresholdRolloutPlan', () => {
  it('blocks rollout rendering when approval metadata is incomplete', () => {
    const result = renderThresholdRolloutPlan(createSummary('tune'), {
      approvedBy: 'Ops Lead',
    });

    expect(result.approved).toBe(false);
    expect(result.canRenderRollout).toBe(true);
    expect(result.missingApprovalFields).toEqual([
      '--approval-ticket',
      '--approved-at',
      '--change-window',
    ]);
    expect(result.renderedPlan).toContain('No rollout plan rendered until explicit operator approval metadata is complete.');
    expect(result.renderedPlan).not.toContain('Windows services (read-only operator plan)');
  });

  it('renders platform-specific read-only rollout snippets after explicit approval', () => {
    const result = renderThresholdRolloutPlan(createSummary('align'), {
      approvedBy: 'Ops Lead',
      approvalTicket: 'CHG-2026-041',
      approvedAt: '2026-04-02T11:00:00Z',
      changeWindow: '2026-04-02 12:00-13:00 UTC',
      notes: 'Stability-first canary, no Cloudflare dependency.',
    });

    expect(result.approved).toBe(true);
    expect(result.renderedPlan).toContain('Target stable env contract');
    expect(result.renderedPlan).toContain('BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792');
    expect(result.renderedPlan).toContain('Windows services (read-only operator plan)');
    expect(result.renderedPlan).toContain('npm run services:install:windows');
    expect(result.renderedPlan).toContain('systemd contract rollout (read-only operator plan)');
    expect(result.renderedPlan).toContain('npm run services:install:linux');
    expect(result.renderedPlan).toContain('Docker Compose snippet (docker-compose.prod.yml)');
    expect(result.renderedPlan).toContain('docker compose --env-file ./config/runtime-threshold-contract.env -f docker-compose.prod.yml up -d --force-recreate');
    expect(result.renderedPlan).toContain('PM2 env/update plan');
    expect(result.renderedPlan).toContain('Rollback instructions');
    expect(result.renderedPlan).toContain('Keep Cloudflare external to local liveness and rollback decisions.');
  });

  it('refuses to render rollout steps when recommendation is observe', () => {
    const result = renderThresholdRolloutPlan(createSummary('observe'), {
      approvedBy: 'Ops Lead',
      approvalTicket: 'CHG-2026-042',
      approvedAt: '2026-04-02T11:00:00Z',
      changeWindow: '2026-04-02 12:00-13:00 UTC',
    });

    expect(result.canRenderRollout).toBe(false);
    expect(result.renderedPlan).toContain('No rollout plan rendered because the current recommendation is not align/tune.');
    expect(result.renderedPlan).not.toContain('Docker Compose snippet (docker-compose.prod.yml)');
  });
});

describe('managed threshold rollout plan', () => {
  it('builds an approval-gated guarded increase plan', () => {
    const plan = buildThresholdRolloutPlan(
      {
        overallAction: 'tune',
        confidence: 'high',
        rationale: 'Guarded increase',
        signals: ['node_pressure'],
        node: {
          action: 'tune',
          rationale: 'Node pressure',
          current: {
            heapMb: 1536,
            runtimeLimitMb: 2048,
            restartThresholdMb: 1792,
          },
          suggested: {
            heapMb: 1792,
            runtimeLimitMb: 2304,
            restartThresholdMb: 2048,
          },
        },
        python: {
          action: 'observe',
          rationale: 'Hold python',
          current: {
            memoryLimitMb: 1024,
          },
          suggested: {
            memoryLimitMb: 1024,
          },
        },
      },
      {
        configuredHeapMb: 1536,
        runtimeMemoryLimitMb: 2048,
        restartThresholdMb: 1792,
        pythonMemoryLimitMb: 1024,
        contractFile: '/repo/config/runtime-threshold-contract.env',
      },
    );

    expect(plan.canApply).toBe(true);
    expect(plan.approvalRequired).toBe(true);
    expect(plan.changes).toContain('Node heap 1536MB -> 1792MB');
    expect(plan.managedFiles).toContain('config\\runtime-threshold-contract.env');
  });

  it('marks decreases as read-only even when the recommendation is tune', () => {
    const plan = buildThresholdRolloutPlan(
      {
        overallAction: 'tune',
        confidence: 'high',
        rationale: 'Decrease would be risky',
        signals: ['low_activity'],
        node: {
          action: 'tune',
          rationale: 'Decrease heap',
          current: {
            heapMb: 1792,
            runtimeLimitMb: 2304,
            restartThresholdMb: 2048,
          },
          suggested: {
            heapMb: 1536,
            runtimeLimitMb: 2048,
            restartThresholdMb: 1792,
          },
        },
        python: {
          action: 'observe',
          rationale: 'Hold python',
          current: {
            memoryLimitMb: 1152,
          },
          suggested: {
            memoryLimitMb: 1152,
          },
        },
      },
      {
        configuredHeapMb: 1792,
        runtimeMemoryLimitMb: 2304,
        restartThresholdMb: 2048,
        pythonMemoryLimitMb: 1152,
        contractFile: 'config/runtime-threshold-contract.env',
      },
    );

    expect(plan.canApply).toBe(false);
    expect(plan.applyReadOnlyReason).toContain('decreases require manual review');
  });
});
