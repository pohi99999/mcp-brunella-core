import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { registerPredictiveDecisionCommands } from '../src/cli/predictiveDecisionCommands.js';

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('Predictive decision CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the decision command group with expected subcommands', () => {
    const program = new Command();
    registerPredictiveDecisionCommands(program);

    const decision = program.commands.find((command) => command.name() === 'decision');
    expect(decision).toBeDefined();
    expect(decision?.aliases()).toContain('predictive-decision');
    expect(decision?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['history', 'status', 'trigger', 'show', 'rollback']),
    );
  });

  it('renders overview output for decision status', async () => {
    const program = new Command();
    registerPredictiveDecisionCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          totalDecisions: 8,
          actionsExecuted: 5,
          noActionDecisions: 2,
          failedActions: 1,
          rolledBackActions: 1,
          successRate: 0.625,
          averageScenarioCount: 9,
          averageSelectedScore: 0.731,
          actionBreakdown: [{ actionType: 'create_goal', count: 4 }],
          dateRange: {
            from: '2026-03-12T00:00:00.000Z',
            to: '2026-04-11T00:00:00.000Z',
          },
        },
      }),
    );
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'decision', 'status', '--days', '14']);

    const output = infoSpy.mock.calls.map(([chunk]) => String(chunk)).join('\n');
    expect(output).toContain('Predictive decision stats');
    expect(output).toContain('Total:         8');
    expect(output).toContain('Success rate:  62.5%');
  });

  it('posts trigger command payload with config flags', async () => {
    const program = new Command();
    registerPredictiveDecisionCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          id: 'pdr-1',
          triggeredBy: 'manual_cli',
          scenarios: [],
          selectedScenario: null,
          executedAction: null,
          rollbackCapability: false,
          outcome: 'no_action',
          createdAt: '2026-04-11T10:00:00.000Z',
          rolledBackAt: null,
          metadata: {
            activeAlerts: 0,
            signalCount: 0,
            reviewQueueCount: 0,
            activeGoals: 0,
            config: {
              scenarioCount: 24,
              riskWeight: 0.3,
              impactWeight: 0.4,
              alignmentWeight: 0.3,
              selectionThreshold: 0.6,
              seed: 99,
            },
          },
        },
      }),
    );
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'test',
      'decision',
      'trigger',
      '--scenarios',
      '24',
      '--seed',
      '99',
      '--threshold',
      '0.6',
    ]);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/predictive-decision/trigger'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          triggeredBy: 'manual_cli',
          config: {
            scenarioCount: 24,
            seed: 99,
            selectionThreshold: 0.6,
          },
        }),
      }),
    );
  });

  it('posts rollback requests to the rollback endpoint', async () => {
    const program = new Command();
    registerPredictiveDecisionCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          id: 'pdr-7',
          triggeredBy: 'manual_cli',
          scenarios: [],
          selectedScenario: null,
          executedAction: null,
          rollbackCapability: false,
          outcome: 'rolled_back',
          createdAt: '2026-04-11T10:00:00.000Z',
          rolledBackAt: '2026-04-11T10:05:00.000Z',
          metadata: {
            activeAlerts: 0,
            signalCount: 0,
            reviewQueueCount: 0,
            activeGoals: 0,
            config: {
              scenarioCount: 12,
              riskWeight: 0.3,
              impactWeight: 0.4,
              alignmentWeight: 0.3,
              selectionThreshold: 0.58,
            },
          },
        },
      }),
    );
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'decision', 'rollback', 'pdr-7']);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/predictive-decision/pdr-7/rollback'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
