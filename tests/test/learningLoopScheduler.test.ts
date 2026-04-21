import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const schedulerHarness = vi.hoisted(() => ({
  db: null as unknown,
  executeLearningLoopCycle: vi.fn(),
  publish: vi.fn(),
  createSchedulerTaskOutcomeEnvelope: vi.fn((_task: unknown, payload: unknown) => payload),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => schedulerHarness.db,
}));

vi.mock('../src/core/learningLoopService.js', () => ({
  executeLearningLoopCycle: schedulerHarness.executeLearningLoopCycle,
}));

vi.mock('../src/core/eventFabric.js', () => ({
  eventFabric: {
    publish: schedulerHarness.publish,
  },
  createSchedulerTaskOutcomeEnvelope: schedulerHarness.createSchedulerTaskOutcomeEnvelope,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn(),
    delegateTask: vi.fn(),
  },
}));

import { ScheduledTasksRunner } from '../src/server/schedulers/scheduledTasksRunner.js';

describe('ScheduledTasksRunner — Learning Loop integration', () => {
  let db: Database.Database;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `learning_loop_scheduler_${Date.now()}.db`);
    db = new Database(tempDbPath);
    schedulerHarness.db = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        handler TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT DEFAULT 'pending',
        last_result TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.prepare(`
      INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, enabled, metadata)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
      'learning-loop-nightly-cycle',
      'Learning Loop — Nightly Cycle',
      'Nightly curated snapshot, trainer and eval cycle for reflex models',
      '30 2 * * *',
      'learning_loop_cycle',
      JSON.stringify({ dryRun: false, promotePassed: true, baselineModel: 'qwen2.5-coder:7b' }),
    );

    schedulerHarness.executeLearningLoopCycle.mockResolvedValue({
      snapshot: { snapshotId: 'snapshot-1' },
      training: { trainingRun: { runId: 'train-1' } },
      evaluation: { evalResult: { resultId: 'eval-1', gateStatus: 'passed' } },
      promotedModel: { modelId: 'reflex-1' },
    });
    schedulerHarness.publish.mockReset();
    schedulerHarness.createSchedulerTaskOutcomeEnvelope.mockClear();
  });

  afterEach(async () => {
    db.close();
    schedulerHarness.db = null;
    vi.clearAllMocks();
    try {
      await fs.unlink(tempDbPath);
    } catch {
      // ignore temp cleanup errors
    }
  });

  it('executes the learning loop cycle handler and stores success', async () => {
    const runner = new ScheduledTasksRunner();

    await runner.executeTask({
      id: 'learning-loop-nightly-cycle',
      title: 'Learning Loop — Nightly Cycle',
      prompt: 'Nightly curated snapshot, trainer and eval cycle for reflex models',
      cron_expression: '30 2 * * *',
      handler: 'learning_loop_cycle',
      enabled: true,
      metadata: JSON.stringify({
        dryRun: false,
        promotePassed: true,
        baselineModel: 'qwen2.5-coder:7b',
      }),
    });

    expect(schedulerHarness.executeLearningLoopCycle).toHaveBeenCalledWith({
      dryRun: false,
      promotePassed: true,
      baselineModel: 'qwen2.5-coder:7b',
    });

    const row = db.prepare('SELECT last_status, last_result FROM scheduled_tasks WHERE id = ?').get('learning-loop-nightly-cycle') as {
      last_status: string;
      last_result: string;
    };

    expect(row.last_status).toBe('success');
    expect(row.last_result).toContain('snapshot-1');
    expect(schedulerHarness.publish).toHaveBeenCalledOnce();
  });
});
