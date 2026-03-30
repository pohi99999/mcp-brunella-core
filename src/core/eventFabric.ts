import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo, logWarn } from '../utils/logger.js';
import type { ApprovalWorkflow } from './approvalRouter.js';

export type EventFabricPriority = 'critical' | 'high' | 'medium' | 'low';
export type EventFabricRiskHint = 'safe' | 'guarded' | 'dangerous';
export type EventFabricSource = 'github' | 'health' | 'scheduler' | 'manual' | string;

export interface EventEnvelope<TPayload = unknown> {
  id: string;
  source: EventFabricSource;
  type: string;
  priority: EventFabricPriority;
  riskHint?: EventFabricRiskHint;
  dedupKey: string;
  payload: TPayload;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EventSourceAdapter<TInput = unknown> {
  readonly source: EventFabricSource;
  toEnvelope(input: TInput): EventEnvelope | null;
}

export interface EventHistoryQuery {
  source?: string;
  type?: string;
  limit?: number;
}

export interface EventPublishResult {
  accepted: boolean;
  envelope: EventEnvelope;
  reason?: 'duplicate';
}

export interface EventReplayResult {
  replayed: number;
  events: EventEnvelope[];
}

export interface EventFabricStats {
  totalEvents: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<EventFabricPriority, number>;
  uniqueDedupKeys: number;
}

export interface SchedulerTaskEventInput {
  id: string;
  title: string;
  handler: string;
  cron_expression: string;
}

export interface SchedulerTaskOutcomeOptions {
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string;
}

export interface HealthStatusEventInput {
  kind: 'degraded' | 'recovery' | 'edge_health';
  timestamp?: string;
  status?: 'healthy' | 'degraded' | 'offline';
  previousStatus?: 'healthy' | 'degraded' | 'offline';
  serviceName?: string;
  services?: string[];
  latencyMs?: number;
  level?: 'full' | 'partial' | 'minimal' | 'offline';
  message?: string;
  details?: string;
}

const MAX_EVENT_HISTORY = 500;
const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_STORE_PATH = path.join(process.cwd(), 'data', 'event_fabric_history.jsonl');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getNumberString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return getString(value);
}

function coerceRepositoryName(payload: unknown): string {
  if (!isRecord(payload)) {
    return 'unknown';
  }

  const repository = isRecord(payload.repository) ? payload.repository : undefined;
  return getString(repository?.name) ?? 'unknown';
}

export function createEnvelope<TPayload>(params: {
  source: EventFabricSource;
  type: string;
  priority: EventFabricPriority;
  riskHint?: EventFabricRiskHint;
  dedupKey: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}): EventEnvelope<TPayload> {
  return {
    id: uuidv4(),
    source: params.source,
    type: params.type,
    priority: params.priority,
    riskHint: params.riskHint,
    dedupKey: params.dedupKey,
    payload: params.payload,
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  };
}

export function createGithubPushEventEnvelope(payload: unknown): EventEnvelope<Record<string, unknown>> {
  const body = isRecord(payload) ? payload : {};
  const repositoryName = coerceRepositoryName(body);
  const ref = getString(body.ref) ?? 'unknown';
  const headCommit = isRecord(body.head_commit) ? body.head_commit : undefined;
  const commitId = getString(headCommit?.id) ?? 'unknown';
  const pusher = isRecord(body.pusher) ? body.pusher : undefined;
  const pusherName = getString(pusher?.name) ?? getString(pusher?.email) ?? 'unknown';

  return createEnvelope({
    source: 'github',
    type: 'github.push',
    priority: 'low',
    riskHint: 'safe',
    dedupKey: `github:push:${repositoryName}:${ref}:${commitId}`,
    payload: {
      repositoryName,
      ref,
      commitId,
      pusher: pusherName,
    },
    metadata: {
      provider: 'github',
      category: 'push',
    },
  });
}

export function createGithubWebhookEventEnvelope(
  eventName: string | undefined,
  payload: unknown,
): EventEnvelope<Record<string, unknown>> {
  const normalizedEventName = eventName && eventName.trim().length > 0 ? eventName.trim() : 'unknown';

  if (normalizedEventName === 'push') {
    return createGithubPushEventEnvelope(payload);
  }

  const body = isRecord(payload) ? payload : {};
  const repositoryName = coerceRepositoryName(body);

  if (normalizedEventName === 'workflow_run') {
    const workflowRun = isRecord(body.workflow_run) ? body.workflow_run : undefined;
    const action = getString(body.action) ?? 'unknown';
    const conclusion = getString(workflowRun?.conclusion) ?? 'unknown';
    const runId = getNumberString(workflowRun?.id) ?? 'unknown';
    const workflowName =
      getString(workflowRun?.name) ??
      getString(workflowRun?.display_title) ??
      'workflow_run';
    const isFailure = action === 'completed' && conclusion === 'failure';

    return createEnvelope({
      source: 'github',
      type: isFailure ? 'github.workflow_run.failure' : `github.workflow_run.${action}`,
      priority: isFailure ? 'high' : 'medium',
      riskHint: isFailure ? 'guarded' : 'safe',
      dedupKey: `github:workflow_run:${repositoryName}:${runId}:${action}:${conclusion}`,
      payload: {
        repositoryName,
        action,
        conclusion,
        workflowRunId: runId,
        workflowName,
        htmlUrl: getString(workflowRun?.html_url),
        headBranch: getString(workflowRun?.head_branch),
      },
      metadata: {
        provider: 'github',
        category: 'workflow_run',
      },
    });
  }

  return createEnvelope({
    source: 'github',
    type: `github.${normalizedEventName}`,
    priority: 'medium',
    riskHint: 'safe',
    dedupKey: `github:${normalizedEventName}:${repositoryName}:${getString(body.action) ?? 'unknown'}`,
    payload: {
      repositoryName,
      action: getString(body.action),
      sender: isRecord(body.sender) ? getString(body.sender.login) : undefined,
    },
    metadata: {
      provider: 'github',
      category: normalizedEventName,
    },
  });
}

export interface GithubIssueEventPayload {
  repositoryName: string;
  issueNumber: number;
  title: string;
  state: string;
  labels: string[];
  author: string;
  updatedAt: string;
  createdAt: string;
  isNew: boolean;
  eventType: 'opened' | 'updated' | 'closed';
}

export function createGithubIssueEventEnvelope(
  payload: GithubIssueEventPayload,
): EventEnvelope<GithubIssueEventPayload> {
  return createEnvelope({
    source: 'github',
    type: `github.issue.${payload.eventType}`,
    priority: 'medium',
    riskHint: 'safe',
    dedupKey: `github:issue:${payload.repositoryName}:${payload.issueNumber}:${payload.eventType}:${payload.updatedAt}`,
    payload,
    metadata: { provider: 'github', category: 'issue' },
  });
}

export interface GithubPREventPayload {
  repositoryName: string;
  prNumber: number;
  title: string;
  state: string;
  branch: string;
  baseBranch: string;
  sha: string;
  author: string;
  draft: boolean;
  updatedAt: string;
  createdAt: string;
  isNew: boolean;
  eventType: 'opened' | 'synchronized' | 'closed';
}

export function createGithubPREventEnvelope(
  payload: GithubPREventPayload,
): EventEnvelope<GithubPREventPayload> {
  return createEnvelope({
    source: 'github',
    type: `github.pr.${payload.eventType}`,
    priority: payload.draft ? 'low' : 'medium',
    riskHint: 'safe',
    dedupKey: `github:pr:${payload.repositoryName}:${payload.prNumber}:${payload.eventType}:${payload.updatedAt}`,
    payload,
    metadata: { provider: 'github', category: 'pull_request' },
  });
}

export function createCustomWebhookEventEnvelope(
  provider: string,
  payload: unknown,
): EventEnvelope<Record<string, unknown>> {
  const normalizedProvider = provider.trim().length > 0 ? provider.trim() : 'custom';
  const body = isRecord(payload) ? payload : {};
  const eventType = getString(body.type) ?? `${normalizedProvider}.custom`;

  return createEnvelope({
    source: normalizedProvider,
    type: eventType,
    priority: 'medium',
    riskHint: 'safe',
    dedupKey: `${normalizedProvider}:${eventType}:${JSON.stringify(body)}`,
    payload: body,
    metadata: {
      provider: normalizedProvider,
      category: 'custom',
    },
  });
}

export function createSchedulerTaskOutcomeEnvelope(
  task: SchedulerTaskEventInput,
  options: SchedulerTaskOutcomeOptions,
): EventEnvelope<Record<string, unknown>> {
  const isFailure = options.status === 'failed';

  return createEnvelope({
    source: 'scheduler',
    type: `scheduler.task.${options.status}`,
    priority: isFailure ? 'high' : 'low',
    riskHint: isFailure ? 'guarded' : 'safe',
    dedupKey: `scheduler:${task.id}:${options.status}:${options.startedAt}`,
    payload: {
      taskId: task.id,
      title: task.title,
      handler: task.handler,
      cronExpression: task.cron_expression,
      status: options.status,
      startedAt: options.startedAt,
      finishedAt: options.finishedAt,
      durationMs: options.durationMs,
      error: options.error,
    },
    metadata: {
      category: 'task_outcome',
      handler: task.handler,
    },
  });
}

export function createHealthStatusEventEnvelope(
  input: HealthStatusEventInput,
): EventEnvelope<Record<string, unknown>> {
  if (input.kind === 'edge_health') {
    const status = input.status ?? 'healthy';
    return {
      id: uuidv4(),
      source: 'health',
      type: `health.edge.${status}`,
      priority: status === 'offline' ? 'high' : status === 'degraded' ? 'medium' : 'low',
      riskHint: 'safe',
      dedupKey: `health:edge:${status}:${input.previousStatus ?? 'unknown'}`,
      payload: {
        status,
        previousStatus: input.previousStatus,
        latencyMs: input.latencyMs,
      },
      timestamp: input.timestamp ?? new Date().toISOString(),
      metadata: {
        category: 'health',
      },
    };
  }

  if (input.kind === 'recovery') {
    const serviceName = input.serviceName ?? 'unknown';
    return {
      id: uuidv4(),
      source: 'health',
      type: 'health.recovery',
      priority: 'low',
      riskHint: 'safe',
      dedupKey: `health:recovery:${serviceName}`,
      payload: {
        serviceName,
        details: input.details,
        status: 'healthy',
      },
      timestamp: input.timestamp ?? new Date().toISOString(),
      metadata: {
        category: 'health',
      },
    };
  }

  const affectedServices = input.services ?? (input.serviceName ? [input.serviceName] : []);
  return {
    id: uuidv4(),
    source: 'health',
    type: 'health.degraded',
    priority: 'high',
    riskHint: 'safe',
    dedupKey: `health:degraded:${affectedServices.join(',') || 'unknown'}:${input.level ?? 'partial'}`,
    payload: {
      services: affectedServices,
      level: input.level,
      message: input.message,
    },
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: {
      category: 'health',
    },
  };
}

export function createApprovalResumeEnvelope(
  workflow: Pick<ApprovalWorkflow, 'workflowId' | 'approvalRequestId' | 'eventId' | 'eventType' | 'source' | 'resource' | 'agentName' | 'decision' | 'response' | 'eventPayload' | 'eventMetadata' | 'status'>,
): EventEnvelope<Record<string, unknown>> {
  return {
    id: uuidv4(),
    source: 'manual',
    type: 'approval.workflow.approved',
    priority: 'medium',
    riskHint: 'safe',
    dedupKey: `approval:resume:${workflow.workflowId}:${workflow.approvalRequestId}:${workflow.status}`,
    payload: {
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      originalEventId: workflow.eventId,
      originalEventType: workflow.eventType,
      originalSource: workflow.source,
      originalPayload: workflow.eventPayload,
      originalMetadata: workflow.eventMetadata,
      resource: workflow.resource,
      agentName: workflow.agentName,
      decision: workflow.decision,
      approvalResponse: workflow.response,
    },
    timestamp: new Date().toISOString(),
    metadata: {
      category: 'approval_resume',
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      resource: workflow.resource,
    },
  };
}

class EventFabric {
  private readonly eventHistory: EventEnvelope[] = [];
  private readonly dedupCache = new Map<string, number>();
  private readonly storePath: string;

  constructor(
    private readonly maxHistory = MAX_EVENT_HISTORY,
    private readonly dedupWindowMs = DEFAULT_DEDUP_WINDOW_MS,
    storePath = process.env.EVENT_FABRIC_STORE_PATH || DEFAULT_STORE_PATH,
  ) {
    this.storePath = storePath;
    this.loadPersistedHistory();
  }

  private ensureStoreDirectory(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private appendToStore(envelope: EventEnvelope): void {
    try {
      this.ensureStoreDirectory();
      fs.appendFileSync(this.storePath, `${JSON.stringify(envelope)}\n`, 'utf8');
    } catch (error) {
      logWarn('EventFabric', `Failed to persist event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private loadPersistedHistory(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        return;
      }

      const raw = fs.readFileSync(this.storePath, 'utf8').trim();
      if (!raw) {
        return;
      }

      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines.slice(-this.maxHistory)) {
        const parsed = JSON.parse(line) as EventEnvelope;
        this.eventHistory.push(parsed);
        this.dedupCache.set(parsed.dedupKey, Date.parse(parsed.timestamp) || Date.now());
      }
    } catch (error) {
      logWarn('EventFabric', `Failed to load persisted event history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private rewriteStore(): void {
    try {
      this.ensureStoreDirectory();
      const serialized = this.eventHistory.map((entry) => JSON.stringify(entry)).join('\n');
      fs.writeFileSync(this.storePath, serialized ? `${serialized}\n` : '', 'utf8');
    } catch (error) {
      logWarn('EventFabric', `Failed to rewrite event history store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private pruneDedupCache(now: number): void {
    for (const [key, seenAt] of this.dedupCache.entries()) {
      if (now - seenAt > this.dedupWindowMs) {
        this.dedupCache.delete(key);
      }
    }
  }

  publish(
    envelope: EventEnvelope,
    options: { skipDedup?: boolean; skipPersist?: boolean } = {},
  ): EventPublishResult {
    const now = Date.now();
    this.pruneDedupCache(now);

    const previousSeenAt = this.dedupCache.get(envelope.dedupKey);
    if (!options.skipDedup && typeof previousSeenAt === 'number' && now - previousSeenAt < this.dedupWindowMs) {
      logInfo('EventFabric', `Duplicate event skipped: ${envelope.dedupKey}`);
      return {
        accepted: false,
        reason: 'duplicate',
        envelope,
      };
    }

    this.dedupCache.set(envelope.dedupKey, now);
    this.eventHistory.push(envelope);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.splice(0, this.eventHistory.length - this.maxHistory);
    }

    if (options.skipPersist) {
      this.rewriteStore();
    } else {
      this.appendToStore(envelope);
    }

    phoenixEventBus.publish('phoenix:event_fabric_signal', {
      envelope: {
        id: envelope.id,
        source: envelope.source,
        type: envelope.type,
        priority: envelope.priority,
        riskHint: envelope.riskHint,
        dedupKey: envelope.dedupKey,
        payload: envelope.payload,
        metadata: envelope.metadata,
        timestamp: envelope.timestamp,
      },
      source: envelope.source,
      eventType: envelope.type,
      priority: envelope.priority,
      riskHint: envelope.riskHint ?? 'safe',
      timestamp: envelope.timestamp,
    });

    logInfo('EventFabric', `Accepted event: ${envelope.type} (${envelope.source})`);
    return {
      accepted: true,
      envelope,
    };
  }

  ingest<TInput>(adapter: EventSourceAdapter<TInput>, input: TInput): EventPublishResult | null {
    const envelope = adapter.toEnvelope(input);
    if (!envelope) {
      return null;
    }

    return this.publish(envelope);
  }

  getHistory(query: EventHistoryQuery = {}): EventEnvelope[] {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), this.maxHistory);
    const filtered = this.eventHistory.filter((entry) => {
      if (query.source && entry.source !== query.source) {
        return false;
      }

      if (query.type && entry.type !== query.type) {
        return false;
      }

      return true;
    });

    return [...filtered].reverse().slice(0, limit);
  }

  replay(query: EventHistoryQuery = {}): EventReplayResult {
    const historicalEvents = this.getHistory(query).reverse();
    const replayedEvents: EventEnvelope[] = [];

    for (const historicalEvent of historicalEvents) {
      const replayEnvelope: EventEnvelope = {
        ...historicalEvent,
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        dedupKey: `${historicalEvent.dedupKey}:replay:${Date.now()}:${replayedEvents.length}`,
        metadata: {
          ...(historicalEvent.metadata ?? {}),
          replayed: true,
          replayedFromEventId: historicalEvent.id,
        },
      };

      this.publish(replayEnvelope, { skipDedup: true });
      replayedEvents.push(replayEnvelope);
    }

    return {
      replayed: replayedEvents.length,
      events: replayedEvents,
    };
  }

  getStats(): EventFabricStats {
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byPriority: Record<EventFabricPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const entry of this.eventHistory) {
      bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      byPriority[entry.priority] += 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      bySource,
      byType,
      byPriority,
      uniqueDedupKeys: this.dedupCache.size,
    };
  }

  clearHistory(): void {
    this.eventHistory.splice(0, this.eventHistory.length);
    this.dedupCache.clear();
    this.rewriteStore();
  }
}

export const eventFabric = new EventFabric();

export default eventFabric;