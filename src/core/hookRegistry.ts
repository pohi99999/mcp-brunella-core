import { randomUUID } from 'crypto';

import { getGlobalDb } from '../utils/globalDb.js';
import { ensureError } from '../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

export type HookName = string;

export type HookCategory =
  | 'lifecycle'
  | 'business'
  | 'security'
  | 'infra'
  | 'learning'
  | 'cron'
  | 'other';

export type HookExecutionStatus =
  | 'fired'
  | 'skipped'
  | 'failed'
  | 'blocked'
  | 'dead_letter';

export type HookRunStatus =
  | 'fired'
  | 'partial'
  | 'failed'
  | 'skipped'
  | 'blocked';

export interface HookRegistrationOptions {
  priority?: number;
  timeout?: number;
  timeoutMs?: number;
  retryOnFail?: boolean;
  category?: HookCategory;
  description?: string;
  enabled?: boolean;
  handlerName?: string;
  metadata?: Record<string, unknown>;
}

export interface HookRegistration {
  id: string;
  event: HookName;
  handlerName: string;
  handler: HookHandler;
  priority: number;
  timeoutMs: number;
  retryOnFail: boolean;
  category: HookCategory;
  description: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  registeredAt: string;
  order: number;
}

export interface HookSnapshot {
  event: HookName;
  category: HookCategory;
  description: string;
  priority: number;
  timeoutMs: number;
  retryOnFail: boolean;
  enabled: boolean;
  handlerCount: number;
  enabledHandlerCount: number;
  disabledHandlerCount: number;
  handlers: Array<HookRegistrationSummary>;
  circuit: HookCircuitSnapshot;
  catalogued: boolean;
}

export interface HookRegistrationSummary {
  id: string;
  handlerName: string;
  priority: number;
  timeoutMs: number;
  retryOnFail: boolean;
  category: HookCategory;
  description: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface HookDispatchContext {
  event: HookName;
  payload: unknown;
  attempt: number;
  timestamp: string;
  registration: HookRegistrationSummary;
  definition: HookSnapshot;
  metadata: Record<string, unknown>;
}

export type HookHandler = (context: HookDispatchContext) => void | Promise<void>;

export interface HookFireOptions {
  force?: boolean;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SafeHookFireOptions extends HookFireOptions {
  logContext?: string;
}

export interface SafeHookFireOptions extends HookFireOptions {
  logContext?: string;
}

export interface HookFireSummary {
  event: HookName;
  status: HookRunStatus;
  durationMs: number;
  handlerCount: number;
  firedCount: number;
  failedCount: number;
  skippedCount: number;
  blockedCount: number;
  deadLetterCount: number;
  retriedCount: number;
  errors: string[];
  timestamp: string;
  circuit: HookCircuitSnapshot;
}

export interface HookSummary {
  windowHours: number;
  registrySize: number;
  registeredHandlers: number;
  enabledHandlers: number;
  disabledEvents: number;
  audit: {
    windowHours: number;
    total: number;
    fired: number;
    failed: number;
    skipped: number;
    blocked: number;
    deadLetter: number;
    failureRate: number;
  };
  circuitOpenCount: number;
  dlqCount: number;
}

export interface HookExecutionRecordInput {
  event: HookName;
  handlerName: string;
  category: HookCategory;
  priority: number;
  status: HookExecutionStatus;
  attempt: number;
  durationMs: number;
  error?: string;
  context?: unknown;
  metadata?: Record<string, unknown>;
}

export interface HookExecutionRecord {
  id: number;
  event: HookName;
  handlerName: string;
  category: HookCategory;
  priority: number;
  status: HookExecutionStatus;
  attempt: number;
  durationMs: number;
  error?: string;
  context?: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type HookDlqStatus = 'pending' | 'retrying' | 'resolved' | 'failed';

export interface HookDlqEntryInput {
  event: HookName;
  context: unknown;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface HookDlqEntry {
  id: number;
  event: HookName;
  context: unknown;
  metadata: Record<string, unknown>;
  reason: string;
  attempts: number;
  nextRetryAt: string;
  status: HookDlqStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HookCircuitSnapshot {
  event: HookName;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  threshold: number;
  coolDownMs: number;
  openedAt?: string;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  nextTrialAt?: string;
}

export interface HookCatalogEntry {
  event: HookName;
  category: HookCategory;
  description: string;
  priority: number;
  timeoutMs: number;
  retryOnFail: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PRIORITY = 5;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOL_DOWN_MS = 60_000;

const DEFAULT_HOOK_CATALOG: HookCatalogEntry[] = [
  {
    event: 'BeforeAgent',
    category: 'lifecycle',
    description: 'Agent futasa elott futo hook',
    priority: 10,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'AfterAgent',
    category: 'lifecycle',
    description: 'Agent futasa utan futo hook',
    priority: 9,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'BeforeTool',
    category: 'lifecycle',
    description: 'Eszkozhasznalat elotti hook',
    priority: 9,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'AfterTool',
    category: 'lifecycle',
    description: 'Eszkozhasznalat utani hook',
    priority: 9,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'BeforeModel',
    category: 'lifecycle',
    description: 'Modelhivas elotti hook',
    priority: 8,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'AfterModel',
    category: 'lifecycle',
    description: 'Modelhivas utani hook',
    priority: 8,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'SessionStart',
    category: 'lifecycle',
    description: 'Munkamenet inditasi hook',
    priority: 7,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'SessionEnd',
    category: 'lifecycle',
    description: 'Munkamenet zarasi hook',
    priority: 7,
    timeoutMs: 5_000,
    retryOnFail: false,
  },
  {
    event: 'event.fabric.published',
    category: 'business',
    description: 'Event Fabric publikalas utani hook',
    priority: 6,
    timeoutMs: 10_000,
    retryOnFail: true,
  },
  {
    event: 'github.push',
    category: 'business',
    description: 'GitHub push webhook hook',
    priority: 6,
    timeoutMs: 10_000,
    retryOnFail: true,
  },
  {
    event: 'webhook.received',
    category: 'business',
    description: 'Altalanos webhook erkezes hook',
    priority: 6,
    timeoutMs: 10_000,
    retryOnFail: true,
  },
  {
    event: 'scheduler.task.failed',
    category: 'cron',
    description: 'Utemezett feladat hibaja utani hook',
    priority: 8,
    timeoutMs: 10_000,
    retryOnFail: true,
  },
];

const hookRegistrations = new Map<HookName, HookRegistration[]>();
const hookDisabledEvents = new Set<HookName>();
const hookCatalog = new Map<HookName, HookCatalogEntry>();
let registrationOrder = 0;
let schemaEnsured = false;
let dlqProcessor: ReturnType<typeof setInterval> | null = null;

function ensureRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeSerialize(value: unknown): string | null {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === 'function') {
        return `[Function ${current.name || 'anonymous'}]`;
      }

      if (typeof current === 'object' && current !== null) {
        if (seen.has(current as object)) {
          return '[Circular]';
        }

        seen.add(current as object);
      }

      return current;
    });
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logWarn('HookRegistry', `Failed to serialize hook payload: ${normalized.message}`);
    return null;
  }
}

function parseSerializedRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return ensureRecord(parsed);
  } catch {
    return {};
  }
}

function ensureSchema(): void {
  if (schemaEnsured) {
    return;
  }

  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS hook_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      handler_name TEXT NOT NULL,
      category TEXT NOT NULL,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      context_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hook_executions_event_created_at
      ON hook_executions(event, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_hook_executions_status_created_at
      ON hook_executions(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS hook_dlq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      context_json TEXT NOT NULL,
      metadata_json TEXT,
      reason TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hook_dlq_status_retry
      ON hook_dlq(status, next_retry_at);

    CREATE INDEX IF NOT EXISTS idx_hook_dlq_event_created_at
      ON hook_dlq(event, created_at DESC);
  `);

  schemaEnsured = true;
}

function normalizePriority(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_PRIORITY;
  }

  return Math.min(10, Math.max(1, Math.trunc(value)));
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.max(100, Math.trunc(value));
}

function getCatalogEntry(event: HookName): HookCatalogEntry {
  const existing = hookCatalog.get(event);
  if (existing) {
    return existing;
  }

  const fallback: HookCatalogEntry = {
    event,
    category: 'other',
    description: event,
    priority: DEFAULT_PRIORITY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retryOnFail: false,
  };

  hookCatalog.set(event, fallback);
  return fallback;
}

function ensureCatalogEntry(event: HookName, metadata: Partial<HookCatalogEntry>): HookCatalogEntry {
  const current = getCatalogEntry(event);
  const next: HookCatalogEntry = {
    event,
    category: metadata.category ?? current.category,
    description: metadata.description ?? current.description,
    priority: normalizePriority(metadata.priority ?? current.priority),
    timeoutMs: normalizeTimeoutMs(metadata.timeoutMs ?? current.timeoutMs),
    retryOnFail: metadata.retryOnFail ?? current.retryOnFail,
  };

  hookCatalog.set(event, next);
  return next;
}

function sortRegistrations(registrations: HookRegistration[]): HookRegistration[] {
  return [...registrations].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.order - right.order;
  });
}

function getRegistrations(event: HookName): HookRegistration[] {
  return sortRegistrations(hookRegistrations.get(event) ?? []);
}

function toSummary(registration: HookRegistration): HookRegistrationSummary {
  return {
    id: registration.id,
    handlerName: registration.handlerName,
    priority: registration.priority,
    timeoutMs: registration.timeoutMs,
    retryOnFail: registration.retryOnFail,
    category: registration.category,
    description: registration.description,
    enabled: registration.enabled,
    metadata: { ...registration.metadata },
  };
}

function getDefinitionSnapshot(event: HookName): HookSnapshot {
  const catalog = getCatalogEntry(event);
  const registrations = getRegistrations(event);
  const enabledHandlers = registrations.filter((registration) => registration.enabled);
  const disabledHandlers = registrations.length - enabledHandlers.length;
  const globallyDisabled = hookDisabledEvents.has(event);
  const circuit = hookCircuitBreaker.snapshot(event)[0] ?? {
    event,
    state: 'closed',
    failures: 0,
    threshold: CIRCUIT_THRESHOLD,
    coolDownMs: CIRCUIT_COOL_DOWN_MS,
  };

  return {
    event,
    category: catalog.category,
    description: catalog.description,
    priority: registrations[0]?.priority ?? catalog.priority,
    timeoutMs: registrations[0]?.timeoutMs ?? catalog.timeoutMs,
    retryOnFail: registrations.some((registration) => registration.retryOnFail) || catalog.retryOnFail,
    enabled: !globallyDisabled && enabledHandlers.length > 0,
    handlerCount: registrations.length,
    enabledHandlerCount: globallyDisabled ? 0 : enabledHandlers.length,
    disabledHandlerCount: globallyDisabled ? registrations.length : disabledHandlers,
    handlers: registrations.map(toSummary),
    circuit,
    catalogued: hookCatalog.has(event),
  };
}

function buildDispatchContext(
  event: HookName,
  payload: unknown,
  registration: HookRegistration,
  attempt: number,
  metadata: Record<string, unknown> = {},
): HookDispatchContext {
  return {
    event,
    payload,
    attempt,
    timestamp: new Date().toISOString(),
    registration: toSummary(registration),
    definition: getDefinitionSnapshot(event),
    metadata: { ...metadata },
  };
}

async function runWithTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promiseFactory(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Hook timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildDisabledSummary(event: HookName, durationMs: number, circuit: HookCircuitSnapshot): HookFireSummary {
  return {
    event,
    status: 'blocked',
    durationMs,
    handlerCount: 0,
    firedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    blockedCount: 1,
    deadLetterCount: 0,
    retriedCount: 0,
    errors: [],
    timestamp: new Date().toISOString(),
    circuit,
  };
}

function buildEmptySummary(event: HookName, durationMs: number, circuit: HookCircuitSnapshot): HookFireSummary {
  return {
    event,
    status: 'skipped',
    durationMs,
    handlerCount: 0,
    firedCount: 0,
    failedCount: 0,
    skippedCount: 1,
    blockedCount: 0,
    deadLetterCount: 0,
    retriedCount: 0,
    errors: [],
    timestamp: new Date().toISOString(),
    circuit,
  };
}

export class HookAuditTrail {
  record(input: HookExecutionRecordInput): void {
    ensureSchema();
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO hook_executions (
        event,
        handler_name,
        category,
        priority,
        status,
        attempt,
        duration_ms,
        error,
        context_json,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.event,
      input.handlerName,
      input.category,
      input.priority,
      input.status,
      input.attempt,
      input.durationMs,
      input.error ?? null,
      safeSerialize(input.context),
      safeSerialize(input.metadata ?? {}) ?? null,
    );
  }

  getLast(limit = 50, filter: { event?: HookName; status?: HookExecutionStatus } = {}): HookExecutionRecord[] {
    ensureSchema();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.event) {
      clauses.push('event = ?');
      params.push(filter.event);
    }

    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }

    params.push(limit);

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = getGlobalDb()
      .prepare(`
        SELECT id, event, handler_name, category, priority, status, attempt, duration_ms, error, context_json, metadata_json, created_at
        FROM hook_executions
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
      .all(...params) as Array<{
      id: number;
      event: HookName;
      handler_name: string;
      category: HookCategory;
      priority: number;
      status: HookExecutionStatus;
      attempt: number;
      duration_ms: number;
      error?: string | null;
      context_json?: string | null;
      metadata_json?: string | null;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      event: row.event,
      handlerName: row.handler_name,
      category: row.category,
      priority: row.priority,
      status: row.status,
      attempt: row.attempt,
      durationMs: row.duration_ms,
      error: row.error ?? undefined,
      context: parseSerializedRecord(row.context_json ?? null),
      metadata: parseSerializedRecord(row.metadata_json ?? null),
      createdAt: row.created_at,
    }));
  }

  getFailureRate(event: HookName, windowHours = 24): {
    event: HookName;
    windowHours: number;
    total: number;
    failures: number;
    failureRate: number;
  } {
    ensureSchema();
    const window = Math.max(1, Math.trunc(windowHours));
    const row = getGlobalDb()
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures
        FROM hook_executions
        WHERE event = ?
          AND created_at >= datetime('now', ?)
      `)
      .get(event, `-${window} hours`) as { total?: number; failures?: number } | undefined;

    const total = row?.total ?? 0;
    const failures = row?.failures ?? 0;

    return {
      event,
      windowHours: window,
      total,
      failures,
      failureRate: total > 0 ? failures / total : 0,
    };
  }

  getSummary(windowHours = 24): {
    windowHours: number;
    total: number;
    fired: number;
    failed: number;
    skipped: number;
    blocked: number;
    deadLetter: number;
    failureRate: number;
  } {
    ensureSchema();
    const window = Math.max(1, Math.trunc(windowHours));
    const row = getGlobalDb()
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'fired' THEN 1 ELSE 0 END) AS fired,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
          SUM(CASE WHEN status = 'dead_letter' THEN 1 ELSE 0 END) AS dead_letter
        FROM hook_executions
        WHERE created_at >= datetime('now', ?)
      `)
      .get(`-${window} hours`) as
      | {
          total?: number;
          fired?: number;
          failed?: number;
          skipped?: number;
          blocked?: number;
          dead_letter?: number;
        }
      | undefined;

    const total = row?.total ?? 0;
    const failed = row?.failed ?? 0;

    return {
      windowHours: window,
      total,
      fired: row?.fired ?? 0,
      failed,
      skipped: row?.skipped ?? 0,
      blocked: row?.blocked ?? 0,
      deadLetter: row?.dead_letter ?? 0,
      failureRate: total > 0 ? failed / total : 0,
    };
  }

  clear(): void {
    ensureSchema();
    const db = getGlobalDb();
    db.prepare('DELETE FROM hook_executions').run();
  }
}

export class HookDLQ {
  push(input: HookDlqEntryInput): HookDlqEntry {
    ensureSchema();
    const db = getGlobalDb();
    const nextRetryAt = new Date(Date.now() + 60_000).toISOString();
    const result = db
      .prepare(`
        INSERT INTO hook_dlq (
          event,
          context_json,
          metadata_json,
          reason,
          attempts,
          next_retry_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.event,
        safeSerialize(input.context) ?? '{}',
        safeSerialize(input.metadata ?? {}) ?? '{}',
        input.reason,
        0,
        nextRetryAt,
        'pending',
      );

    logInfo('HookDLQ', `Queued hook event: ${input.event}`);
    return this.getById(Number(result.lastInsertRowid)) as HookDlqEntry;
  }

  list(limit = 50, status?: HookDlqStatus): HookDlqEntry[] {
    ensureSchema();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }

    params.push(limit);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = getGlobalDb()
      .prepare(`
        SELECT id, event, context_json, metadata_json, reason, attempts, next_retry_at, status, created_at, updated_at
        FROM hook_dlq
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `)
      .all(...params) as Array<{
      id: number;
      event: HookName;
      context_json: string;
      metadata_json?: string | null;
      reason: string;
      attempts: number;
      next_retry_at: string;
      status: HookDlqStatus;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      event: row.event,
      context: parseSerializedRecord(row.context_json),
      metadata: parseSerializedRecord(row.metadata_json ?? null),
      reason: row.reason,
      attempts: row.attempts,
      nextRetryAt: row.next_retry_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getById(id: number): HookDlqEntry | null {
    ensureSchema();
    const row = getGlobalDb()
      .prepare(`
        SELECT id, event, context_json, metadata_json, reason, attempts, next_retry_at, status, created_at, updated_at
        FROM hook_dlq
        WHERE id = ?
      `)
      .get(id) as
      | {
          id: number;
          event: HookName;
          context_json: string;
          metadata_json?: string | null;
          reason: string;
          attempts: number;
          next_retry_at: string;
          status: HookDlqStatus;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      event: row.event,
      context: parseSerializedRecord(row.context_json),
      metadata: parseSerializedRecord(row.metadata_json ?? null),
      reason: row.reason,
      attempts: row.attempts,
      nextRetryAt: row.next_retry_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  delete(id: number): void {
    ensureSchema();
    getGlobalDb().prepare('DELETE FROM hook_dlq WHERE id = ?').run(id);
  }

  clear(): void {
    ensureSchema();
    getGlobalDb().prepare('DELETE FROM hook_dlq').run();
  }

  update(entry: HookDlqEntry): void {
    ensureSchema();
    getGlobalDb()
      .prepare(`
        UPDATE hook_dlq
        SET attempts = ?,
            next_retry_at = ?,
            status = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .run(entry.attempts, entry.nextRetryAt, entry.status, entry.id);
  }
}

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  openedAt?: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
}

export class HookCircuitBreaker {
  private readonly states = new Map<HookName, CircuitState>();

  constructor(
    private readonly threshold = CIRCUIT_THRESHOLD,
    private readonly coolDownMs = CIRCUIT_COOL_DOWN_MS,
  ) {}

  private now(): number {
    return Date.now();
  }

  private normalize(event: HookName): CircuitState {
    const current = this.states.get(event) ?? { state: 'closed', failures: 0 };
    if (current.state === 'open' && typeof current.lastFailureAt === 'number') {
      if (this.now() - current.lastFailureAt >= this.coolDownMs) {
        current.state = 'half-open';
      }
    }

    this.states.set(event, current);
    return current;
  }

  isBlocked(event: HookName): boolean {
    const current = this.normalize(event);
    return current.state === 'open';
  }

  canTrial(event: HookName): boolean {
    const current = this.normalize(event);
    return current.state !== 'open';
  }

  recordSuccess(event: HookName): void {
    this.states.set(event, {
      state: 'closed',
      failures: 0,
      lastSuccessAt: this.now(),
    });
  }

  recordFailure(event: HookName): void {
    const current = this.normalize(event);
    const nextFailures = current.failures + 1;
    const now = this.now();
    const nextState: CircuitState =
      nextFailures >= this.threshold
        ? {
            state: 'open',
            failures: nextFailures,
            openedAt: current.openedAt ?? now,
            lastFailureAt: now,
            lastSuccessAt: current.lastSuccessAt,
          }
        : {
            state: current.state === 'half-open' ? 'open' : 'closed',
            failures: nextFailures,
            openedAt: current.openedAt,
            lastFailureAt: now,
            lastSuccessAt: current.lastSuccessAt,
          };

    this.states.set(event, nextState);
  }

  snapshot(event?: HookName): HookCircuitSnapshot[] {
    const events = event ? [event] : Array.from(this.states.keys());
    return events.map((entry) => {
      const state = this.normalize(entry);
      const nextTrialAt =
        state.state === 'open' && typeof state.lastFailureAt === 'number'
          ? new Date(state.lastFailureAt + this.coolDownMs).toISOString()
          : undefined;

      return {
        event: entry,
        state: state.state,
        failures: state.failures,
        threshold: this.threshold,
        coolDownMs: this.coolDownMs,
        openedAt: typeof state.openedAt === 'number' ? new Date(state.openedAt).toISOString() : undefined,
        lastFailureAt: typeof state.lastFailureAt === 'number' ? new Date(state.lastFailureAt).toISOString() : undefined,
        lastSuccessAt: typeof state.lastSuccessAt === 'number' ? new Date(state.lastSuccessAt).toISOString() : undefined,
        nextTrialAt,
      };
    });
  }

  clear(event?: HookName): void {
    if (event) {
      this.states.delete(event);
      return;
    }

    this.states.clear();
  }
}

export const hookAuditTrail = new HookAuditTrail();
export const hookDlq = new HookDLQ();
export const hookCircuitBreaker = new HookCircuitBreaker();

for (const entry of DEFAULT_HOOK_CATALOG) {
  hookCatalog.set(entry.event, entry);
}

export function registerHook(
  event: HookName,
  handler: HookHandler,
  options: HookRegistrationOptions = {},
): HookRegistration {
  ensureCatalogEntry(event, {
    category: options.category,
    description: options.description,
    priority: options.priority,
    timeoutMs: options.timeoutMs ?? options.timeout,
    retryOnFail: options.retryOnFail,
  });

  const registration: HookRegistration = {
    id: randomUUID(),
    event,
    handlerName: options.handlerName ?? handler.name ?? `hook-${registrationOrder + 1}`,
    handler,
    priority: normalizePriority(options.priority),
    timeoutMs: normalizeTimeoutMs(options.timeoutMs ?? options.timeout),
    retryOnFail: options.retryOnFail ?? false,
    category: options.category ?? getCatalogEntry(event).category,
    description: options.description ?? getCatalogEntry(event).description,
    enabled: options.enabled ?? true,
    metadata: { ...(options.metadata ?? {}) },
    registeredAt: new Date().toISOString(),
    order: registrationOrder += 1,
  };

  const registrations = hookRegistrations.get(event) ?? [];
  registrations.push(registration);
  hookRegistrations.set(event, sortRegistrations(registrations));
  return registration;
}

export function registerHookCatalogEntries(entries: HookCatalogEntry[]): void {
  for (const entry of entries) {
    ensureCatalogEntry(entry.event, entry);
  }
}

export function listHooks(): Array<{ name: HookName; count: number }> {
  return Array.from(hookRegistrations.entries()).map(([name, registrations]) => ({
    name,
    count: registrations.length,
  }));
}

export function getHookRegistrySnapshot(): HookSnapshot[] {
  const events = new Set<HookName>([
    ...hookCatalog.keys(),
    ...hookRegistrations.keys(),
    ...hookDisabledEvents.keys(),
  ]);

  return Array.from(events)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map((event) => getDefinitionSnapshot(event));
}

export function getHookSummary(windowHours = 24): HookSummary {
  const registry = getHookRegistrySnapshot();
  const audit = hookAuditTrail.getSummary(windowHours);
  const circuitSnapshots = hookCircuitBreaker.snapshot();

  return {
    windowHours,
    registrySize: registry.length,
    registeredHandlers: registry.reduce((total, entry) => total + entry.handlerCount, 0),
    enabledHandlers: registry.reduce((total, entry) => total + entry.enabledHandlerCount, 0),
    disabledEvents: registry.filter((entry) => !entry.enabled).length,
    audit,
    circuitOpenCount: circuitSnapshots.filter((entry) => entry.state === 'open').length,
    dlqCount: hookDlq.list(500).length,
  };
}

export async function fireHook(
  event: HookName,
  payload: unknown,
  options: HookFireOptions = {},
): Promise<HookFireSummary> {
  ensureSchema();
  const startedAt = Date.now();
  const registrations = getRegistrations(event);
  const catalog = getCatalogEntry(event);
  const circuit = hookCircuitBreaker.snapshot(event)[0] ?? {
    event,
    state: 'closed',
    failures: 0,
    threshold: CIRCUIT_THRESHOLD,
    coolDownMs: CIRCUIT_COOL_DOWN_MS,
  };
  const errors: string[] = [];

  if (!options.force && hookDisabledEvents.has(event)) {
    const summary = buildDisabledSummary(event, Date.now() - startedAt, circuit);
    hookAuditTrail.record({
      event,
      handlerName: '__disabled__',
      category: catalog.category,
      priority: catalog.priority,
      status: 'blocked',
      attempt: 0,
      durationMs: summary.durationMs,
      error: 'event-disabled',
      context: payload,
      metadata: { source: options.source ?? 'hook-engine', ...ensureRecord(options.metadata) },
    });
    return summary;
  }

  if (!options.force && hookCircuitBreaker.isBlocked(event)) {
    const summary = buildDisabledSummary(event, Date.now() - startedAt, circuit);
    hookAuditTrail.record({
      event,
      handlerName: '__circuit_breaker__',
      category: catalog.category,
      priority: catalog.priority,
      status: 'blocked',
      attempt: 0,
      durationMs: summary.durationMs,
      error: 'circuit-open',
      context: payload,
      metadata: { source: options.source ?? 'hook-engine', ...ensureRecord(options.metadata) },
    });
    return summary;
  }

  if (registrations.length === 0) {
    const summary = buildEmptySummary(event, Date.now() - startedAt, circuit);
    hookAuditTrail.record({
      event,
      handlerName: '__no_handlers__',
      category: catalog.category,
      priority: catalog.priority,
      status: 'skipped',
      attempt: 0,
      durationMs: summary.durationMs,
      context: payload,
      metadata: { source: options.source ?? 'hook-engine', ...ensureRecord(options.metadata) },
    });
    return summary;
  }

  let firedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const blockedCount = 0;
  let deadLetterCount = 0;
  let retriedCount = 0;
  let hadFailure = false;
  let hadSuccess = false;

  for (const registration of registrations) {
    if (!registration.enabled && !options.force) {
      skippedCount += 1;
      hookAuditTrail.record({
        event,
        handlerName: registration.handlerName,
        category: registration.category,
        priority: registration.priority,
        status: 'skipped',
        attempt: 0,
        durationMs: 0,
        context: payload,
        metadata: { source: options.source ?? 'hook-engine', ...ensureRecord(options.metadata) },
      });
      continue;
    }

    const dispatchBase = buildDispatchContext(
      event,
      payload,
      registration,
      1,
      { source: options.source ?? 'hook-engine', ...ensureRecord(options.metadata) },
    );

    const execute = async (attempt: number): Promise<void> => {
      const dispatchContext: HookDispatchContext = { ...dispatchBase, attempt };
      const attemptStart = Date.now();
      try {
        await runWithTimeout(
          () => Promise.resolve(registration.handler(dispatchContext)),
          registration.timeoutMs,
        );
        firedCount += 1;
        hadSuccess = true;
        hookAuditTrail.record({
          event,
          handlerName: registration.handlerName,
          category: registration.category,
          priority: registration.priority,
          status: 'fired',
          attempt,
          durationMs: Date.now() - attemptStart,
          context: payload,
          metadata: dispatchContext.metadata,
        });
      } catch (error: unknown) {
        const normalized = ensureError(error);
        hookAuditTrail.record({
          event,
          handlerName: registration.handlerName,
          category: registration.category,
          priority: registration.priority,
          status: 'failed',
          attempt,
          durationMs: Date.now() - attemptStart,
          error: normalized.message,
          context: payload,
          metadata: dispatchContext.metadata,
        });
        throw normalized;
      }
    };

    try {
      await execute(1);
    } catch (error1: unknown) {
      const normalized1 = ensureError(error1);
      errors.push(`${registration.handlerName}: ${normalized1.message}`);

      if (registration.retryOnFail) {
        retriedCount += 1;
        try {
          await execute(2);
          continue;
        } catch (error2: unknown) {
          const normalized2 = ensureError(error2);
          errors.push(`${registration.handlerName} retry: ${normalized2.message}`);
        }
      }

      hadFailure = true;
      failedCount += 1;
      deadLetterCount += 1;
      hookDlq.push({
        event,
        context: payload,
        reason: normalized1.message,
        metadata: {
          handlerName: registration.handlerName,
          category: registration.category,
          priority: registration.priority,
          source: options.source ?? 'hook-engine',
          ...ensureRecord(options.metadata),
        },
      });

      hookAuditTrail.record({
        event,
        handlerName: registration.handlerName,
        category: registration.category,
        priority: registration.priority,
        status: 'dead_letter',
        attempt: registration.retryOnFail ? 2 : 1,
        durationMs: 0,
        error: normalized1.message,
        context: payload,
        metadata: {
          handlerName: registration.handlerName,
          category: registration.category,
          priority: registration.priority,
          source: options.source ?? 'hook-engine',
          ...ensureRecord(options.metadata),
        },
      });
    }
  }

  if (hadFailure) {
    hookCircuitBreaker.recordFailure(event);
  } else {
    hookCircuitBreaker.recordSuccess(event);
  }

  const durationMs = Date.now() - startedAt;
  const summary: HookFireSummary = {
    event,
    status: hadFailure ? (hadSuccess ? 'partial' : 'failed') : firedCount > 0 ? 'fired' : 'skipped',
    durationMs,
    handlerCount: registrations.length,
    firedCount,
    failedCount,
    skippedCount,
    blockedCount,
    deadLetterCount,
    retriedCount,
    errors,
    timestamp: new Date().toISOString(),
    circuit: hookCircuitBreaker.snapshot(event)[0] ?? circuit,
  };

  if (summary.status === 'failed' && summary.deadLetterCount === 0) {
    logWarn('HookRegistry', `Hook failed without DLQ entry: ${event}`);
  }

  if (errors.length > 0) {
    logInfo('HookRegistry', `Hook completed with ${errors.length} error(s): ${event}`);
  }

  return summary;
}

export async function fireHookSafely(
  event: HookName,
  payload: unknown,
  options: SafeHookFireOptions = {},
): Promise<HookFireSummary | null> {
  const { logContext = 'HookRegistry', ...fireOptions } = options;

  try {
    return await fireHook(event, payload, fireOptions);
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logWarn(`${logContext} non-blocking hook failure for ${event}: ${normalized.message}`);
    return null;
  }
}

export async function retryHookDlqEntry(id: number): Promise<HookFireSummary | null> {
  ensureSchema();
  const entry = hookDlq.getById(id);
  if (!entry) {
    return null;
  }

  const updated: HookDlqEntry = {
    ...entry,
    attempts: entry.attempts + 1,
    status: 'retrying',
    updatedAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + Math.pow(5, entry.attempts + 1) * 60_000).toISOString(),
  };
  hookDlq.update(updated);

  const metadata = ensureRecord(entry.metadata);
  const handlerName = typeof metadata.handlerName === 'string' ? metadata.handlerName : undefined;
  const registration = handlerName
    ? getRegistrations(entry.event).find((candidate) => candidate.handlerName === handlerName)
    : undefined;

  if (!registration) {
    updated.status = 'failed';
    hookDlq.update(updated);
    logError('HookRegistry', `DLQ replay target missing for ${entry.event}: ${handlerName ?? 'unknown-handler'}`);
    return null;
  }

  const definition = getDefinitionSnapshot(entry.event);
  const attempt = updated.attempts;
  const attemptStartedAt = Date.now();
  const dispatchContext: HookDispatchContext = {
    event: entry.event,
    payload: entry.context,
    attempt,
    timestamp: updated.updatedAt,
    registration: toSummary(registration),
    definition,
    metadata,
  };

  try {
    await registration.handler(dispatchContext);
    const durationMs = Date.now() - attemptStartedAt;
    hookCircuitBreaker.recordSuccess(entry.event);
    hookDlq.delete(id);
    hookAuditTrail.record({
      event: entry.event,
      handlerName: registration.handlerName,
      category: registration.category,
      priority: registration.priority,
      status: 'fired',
      attempt,
      durationMs,
      context: entry.context,
      metadata: {
        dlqId: id,
        replay: true,
        reason: entry.reason,
        ...metadata,
      },
    });

    return {
      event: entry.event,
      status: 'fired',
      durationMs,
      handlerCount: 1,
      firedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      blockedCount: 0,
      deadLetterCount: 0,
      retriedCount: 0,
      errors: [],
      timestamp: new Date().toISOString(),
      circuit: hookCircuitBreaker.snapshot(entry.event)[0] ?? {
        event: entry.event,
        state: 'closed',
        failures: 0,
        threshold: CIRCUIT_THRESHOLD,
        coolDownMs: CIRCUIT_COOL_DOWN_MS,
      },
    };
  } catch (error: unknown) {
    const normalized = ensureError(error);
    const durationMs = Date.now() - attemptStartedAt;
    hookCircuitBreaker.recordFailure(entry.event);
    updated.status = 'failed';
    hookDlq.update(updated);
    logError('HookRegistry', `DLQ replay failed for ${entry.event}: ${normalized.message}`);
    hookAuditTrail.record({
      event: entry.event,
      handlerName: registration.handlerName,
      category: registration.category,
      priority: registration.priority,
      status: 'failed',
      attempt,
      durationMs,
      error: normalized.message,
      context: entry.context,
      metadata: {
        dlqId: id,
        replay: true,
        reason: entry.reason,
        ...metadata,
      },
    });
    return null;
  }
}

export async function retryAllHookDlqEntries(limit = 50): Promise<number> {
  const entries = hookDlq.list(limit, 'pending');
  let retried = 0;

  for (const entry of entries) {
    const summary = await retryHookDlqEntry(entry.id);
    if (summary) {
      retried += 1;
    }
  }

  return retried;
}

export function disableHook(event: HookName): void {
  hookDisabledEvents.add(event);
}

export function enableHook(event: HookName): void {
  hookDisabledEvents.delete(event);
}

export function isHookEnabled(event: HookName): boolean {
  const registrations = hookRegistrations.get(event) ?? [];
  return !hookDisabledEvents.has(event) && registrations.some((registration) => registration.enabled);
}

export function clearHooks(name?: HookName): void {
  if (name) {
    hookRegistrations.delete(name);
    hookDisabledEvents.delete(name);
    hookCircuitBreaker.clear(name);
    return;
  }

  hookRegistrations.clear();
  hookDisabledEvents.clear();
  hookCircuitBreaker.clear();
}

export async function processDueHookDlqEntries(limit = 25): Promise<number> {
  const now = Date.now();
  const dueEntries = hookDlq
    .list(Math.max(1, limit), 'pending')
    .filter((entry) => {
      const nextRetryAt = Date.parse(entry.nextRetryAt);
      return Number.isFinite(nextRetryAt) && nextRetryAt <= now;
    });

  let replayed = 0;
  for (const entry of dueEntries) {
    const summary = await retryHookDlqEntry(entry.id);
    if (summary) {
      replayed += 1;
    }
  }

  return replayed;
}

export function startHookDlqProcessor(intervalMs = 30_000): void {
  if (dlqProcessor) {
    return;
  }

  dlqProcessor = setInterval(() => {
    void processDueHookDlqEntries().catch((error: unknown) => {
      const normalized = ensureError(error);
      logError('HookDLQ', `Background replay failed: ${normalized.message}`);
    });
  }, Math.max(5_000, intervalMs));

  if (typeof dlqProcessor.unref === 'function') {
    dlqProcessor.unref();
  }
}

export function stopHookDlqProcessor(): void {
  if (!dlqProcessor) {
    return;
  }

  clearInterval(dlqProcessor);
  dlqProcessor = null;
}

export async function runHooks(
  name: HookName,
  context: unknown,
  options: { disabled?: string[]; enabled?: boolean; force?: boolean } = {},
): Promise<void> {
  if (options.enabled === false) {
    return;
  }

  if (options.disabled?.includes(name)) {
    return;
  }

  await fireHook(name, context, {
    source: 'run-hooks',
    force: options.force,
  });
}

export function getHookExecutions(
  limit = 50,
  filter: { event?: HookName; status?: HookExecutionStatus } = {},
): HookExecutionRecord[] {
  return hookAuditTrail.getLast(limit, filter);
}

export function getHookDlqEntries(limit = 50, status?: HookDlqStatus): HookDlqEntry[] {
  return hookDlq.list(limit, status);
}

export function getHookCircuitSnapshot(event?: HookName): HookCircuitSnapshot[] {
  return hookCircuitBreaker.snapshot(event);
}

export function clearHookAuditTrail(): void {
  hookAuditTrail.clear();
}

export function clearHookDlq(): void {
  hookDlq.clear();
}

