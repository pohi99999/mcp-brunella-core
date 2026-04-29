import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

async function freshModules() {
  vi.resetModules();
  const eventFabricModule = await import('@packages/core-logic/eventFabric.js');
  const phoenixModule = await import('@packages/core-logic/phoenixEventBus.js');
  return {
    eventFabricModule,
    phoenixModule,
  };
}

describe('EventFabric', () => {
  const storePath = path.join(os.tmpdir(), 'event-fabric-test-history.jsonl');

  beforeEach(async () => {
    process.env.EVENT_FABRIC_STORE_PATH = storePath;
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }

    const { eventFabricModule } = await freshModules();
    eventFabricModule.eventFabric.clearHistory();
  });

  it('publishes unique events and stores newest-first history', async () => {
    const { eventFabricModule } = await freshModules();

    const first = eventFabricModule.createGithubPushEventEnvelope({
      repository: { name: 'pohi99999/mcp-brunella-core' },
      ref: 'refs/heads/main',
      head_commit: { id: 'abc123' },
      pusher: { name: 'Peti' },
    });

    const second = eventFabricModule.createSchedulerTaskOutcomeEnvelope(
      {
        id: 'scheduled-1',
        title: 'Daily Audit',
        handler: 'agent',
        cron_expression: '0 12 * * *',
      },
      {
        status: 'success',
        startedAt: '2026-03-29T10:00:00.000Z',
        finishedAt: '2026-03-29T10:00:10.000Z',
        durationMs: 10000,
      },
    );

    expect(eventFabricModule.eventFabric.publish(first).accepted).toBe(true);
    expect(eventFabricModule.eventFabric.publish(second).accepted).toBe(true);

    const history = eventFabricModule.eventFabric.getHistory({ limit: 10 });
    expect(history).toHaveLength(2);
    expect(history[0]?.type).toBe('scheduler.task.success');
    expect(history[1]?.type).toBe('github.push');
  });

  it('deduplicates events by dedupKey inside the dedup window', async () => {
    const { eventFabricModule } = await freshModules();

    const envelope = eventFabricModule.createGithubPushEventEnvelope({
      repository: { name: 'pohi99999/mcp-brunella-core' },
      ref: 'refs/heads/main',
      head_commit: { id: 'dup-123' },
    });

    const first = eventFabricModule.eventFabric.publish(envelope);
    const second = eventFabricModule.eventFabric.publish({
      ...envelope,
      id: 'manually-overridden-id',
      timestamp: '2026-03-29T12:00:00.000Z',
    });

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('duplicate');
    expect(eventFabricModule.eventFabric.getHistory({ limit: 10 })).toHaveLength(1);
  });

  it('maps GitHub workflow failure to guarded high-priority event', async () => {
    const { eventFabricModule } = await freshModules();

    const envelope = eventFabricModule.createGithubWebhookEventEnvelope('workflow_run', {
      action: 'completed',
      workflow_run: {
        id: 99,
        conclusion: 'failure',
        name: 'CI',
        head_branch: 'main',
      },
      repository: {
        full_name: 'pohi99999/mcp-brunella-core',
        name: 'mcp-brunella-core',
        owner: { login: 'pohi99999' },
      },
    });

    expect(envelope.type).toBe('github.workflow_run.failure');
    expect(envelope.priority).toBe('high');
    expect(envelope.riskHint).toBe('guarded');
    expect(envelope.payload.repositoryName).toBe('pohi99999/mcp-brunella-core');
    expect(envelope.payload.repositoryOwner).toBe('pohi99999');
    expect(envelope.payload.repositoryRepo).toBe('mcp-brunella-core');
  });

  it('emits phoenix event_fabric signal event on accepted publish', async () => {
    const { eventFabricModule, phoenixModule } = await freshModules();
    const handler = vi.fn();
    phoenixModule.phoenixEventBus.subscribe('phoenix:event_fabric_signal', handler);

    const envelope = eventFabricModule.createSchedulerTaskOutcomeEnvelope(
      {
        id: 'scheduled-2',
        title: 'Nightly Trainer',
        handler: 'python_script',
        cron_expression: '0 1 * * *',
      },
      {
        status: 'failed',
        startedAt: '2026-03-29T01:00:00.000Z',
        finishedAt: '2026-03-29T01:01:00.000Z',
        durationMs: 60000,
        error: 'Trainer crashed',
      },
    );

    const result = eventFabricModule.eventFabric.publish(envelope);

    expect(result.accepted).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'scheduler.task.failed',
        priority: 'high',
        riskHint: 'guarded',
      }),
    );
  });

  it('persists accepted events and reloads them on fresh module import', async () => {
    const { eventFabricModule } = await freshModules();

    const envelope = eventFabricModule.createGithubPushEventEnvelope({
      repository: { name: 'pohi99999/mcp-brunella-core' },
      ref: 'refs/heads/main',
      head_commit: { id: 'persist-1' },
    });

    eventFabricModule.eventFabric.publish(envelope);
    expect(fs.existsSync(storePath)).toBe(true);

    const reloaded = await freshModules();
    const history = reloaded.eventFabricModule.eventFabric.getHistory({ limit: 10 });
    expect(history.some((event) => event.dedupKey === envelope.dedupKey)).toBe(true);
  });

  it('replays matching historical events back into the Event Fabric', async () => {
    const { eventFabricModule } = await freshModules();

    const envelope = eventFabricModule.createGithubPushEventEnvelope({
      repository: { name: 'pohi99999/mcp-brunella-core' },
      ref: 'refs/heads/main',
      head_commit: { id: 'replay-1' },
    });

    eventFabricModule.eventFabric.publish(envelope);
    const replay = eventFabricModule.eventFabric.replay({ type: 'github.push', limit: 5 });

    expect(replay.replayed).toBe(1);
    expect(replay.events[0]?.metadata?.replayed).toBe(true);

    const history = eventFabricModule.eventFabric.getHistory({ limit: 10 });
    expect(history.some((event) => event.metadata?.replayed === true)).toBe(true);
  });
});
