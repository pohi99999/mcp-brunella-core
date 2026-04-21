import { randomUUID } from 'crypto';
import { Logger } from '@packages/utils/logger.js';
import {
  OpenClawApprovalDecision,
  OpenClawApprovalRequest,
  OpenClawApprovalState,
  OpenClawConfig,
  OpenClawDispatchResult,
  OpenClawDispatchResultSchema,
  OpenClawEvidencePacket,
  OpenClawEvidencePacketSchema,
  OpenClawTaskRequest,
  OpenClawGatewayResponse,
  OpenClawLogEntry,
  OpenClawPolicyDecision,
  OpenClawSource,
  OpenClawArtifact,
  OpenClawDiff,
  OpenClawTestResult,
} from './contracts.js';
import { normalizeOpenClawError } from './errors.js';
import { buildOpenClawApprovalRequest, classifyOpenClawPolicy, redactOpenClawPayload, type OpenClawPolicyRequest } from './policyTranslator.js';
import { OpenClawGatewayAdapter } from './gatewayAdapter.js';

export interface OpenClawApprovalService {
  requestApproval(request: OpenClawApprovalRequest): Promise<OpenClawApprovalDecision>;
}

export interface OpenClawTaskDispatcherOptions {
  config: OpenClawConfig;
  gateway: OpenClawGatewayAdapter;
  approvalService?: OpenClawApprovalService;
  logger?: Logger;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeSources(value: unknown, fallbackPrefix: string): OpenClawSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sources: OpenClawSource[] = [];

  value.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      sources.push({ id: `${fallbackPrefix}:source:${index}:${randomUUID()}`, url: entry.trim() });
      return;
    }

    if (isRecord(entry) && typeof entry.url === 'string') {
      sources.push({
        id: typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `${fallbackPrefix}:source:${index}:${randomUUID()}`,
        url: entry.url,
        label: typeof entry.label === 'string' ? entry.label : undefined,
        note: typeof entry.note === 'string' ? entry.note : undefined,
      });
    }

  });

  return sources;
}

function normalizeArtifacts(value: unknown, fallbackPrefix: string): OpenClawArtifact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const artifacts: OpenClawArtifact[] = [];

  value.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      artifacts.push({
        id: `${fallbackPrefix}:artifact:${index}:${randomUUID()}`,
        path: entry.trim(),
      });
      return;
    }

    if (isRecord(entry) && typeof entry.path === 'string') {
      artifacts.push({
        id: typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `${fallbackPrefix}:artifact:${index}:${randomUUID()}`,
        path: entry.path,
        kind: typeof entry.kind === 'string' ? entry.kind : undefined,
        checksum: typeof entry.checksum === 'string' ? entry.checksum : undefined,
        note: typeof entry.note === 'string' ? entry.note : undefined,
      });
    }

  });

  return artifacts;
}

function normalizeLogs(value: unknown, fallbackPrefix: string, timestamp: string): OpenClawLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const logs: OpenClawLogEntry[] = [];

  value.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      logs.push({
        id: `${fallbackPrefix}:log:${index}:${randomUUID()}`,
        level: 'info',
        message: entry.trim(),
        timestamp,
      });
      return;
    }

    if (isRecord(entry) && typeof entry.message === 'string') {
      logs.push({
        id: typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `${fallbackPrefix}:log:${index}:${randomUUID()}`,
        level: entry.level === 'error' || entry.level === 'warn' || entry.level === 'debug' ? entry.level : 'info',
        message: entry.message,
        timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : timestamp,
        source: typeof entry.source === 'string' ? entry.source : undefined,
        metadata: isRecord(entry.metadata) ? entry.metadata : undefined,
      });
    }

  });

  return logs;
}

function normalizeDiffs(value: unknown, fallbackPrefix: string): OpenClawDiff[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const diffs: OpenClawDiff[] = [];

  value.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      diffs.push({
        id: `${fallbackPrefix}:diff:${index}:${randomUUID()}`,
        path: entry.trim(),
        changeType: 'unknown',
      });
      return;
    }

    if (isRecord(entry) && typeof entry.path === 'string') {
      diffs.push({
        id: typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `${fallbackPrefix}:diff:${index}:${randomUUID()}`,
        path: entry.path,
        changeType: typeof entry.changeType === 'string' ? entry.changeType : 'unknown',
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        patch: typeof entry.patch === 'string' ? entry.patch : undefined,
      });
    }

  });

  return diffs;
}

function normalizeTestResults(value: unknown, fallbackPrefix: string): OpenClawTestResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const testResults: OpenClawTestResult[] = [];

  value.forEach((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      testResults.push({
        id: `${fallbackPrefix}:test:${index}:${randomUUID()}`,
        name: entry.trim(),
        passed: true,
      });
      return;
    }

    if (isRecord(entry) && typeof entry.name === 'string') {
      testResults.push({
        id: typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `${fallbackPrefix}:test:${index}:${randomUUID()}`,
        name: entry.name,
        passed: typeof entry.passed === 'boolean' ? entry.passed : false,
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        details: typeof entry.details === 'string' ? entry.details : undefined,
        durationMs: typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) ? entry.durationMs : undefined,
      });
    }

  });

  return testResults;
}

function buildEvidenceFromGatewayResponse(
  request: OpenClawTaskRequest,
  response: OpenClawGatewayResponse,
  redactionApplied: boolean,
): OpenClawEvidencePacket {
  const capturedAt = response.receivedAt;
  const fallbackPrefix = `${request.execution.id}:evidence`;

  if (response.evidence) {
    return OpenClawEvidencePacketSchema.parse({
      ...response.evidence,
      capturedAt: response.evidence.capturedAt,
      redactionApplied: redactionApplied || response.evidence.redactionApplied,
      metadata: {
        ...(response.evidence.metadata ?? {}),
        gatewayStatus: response.status,
        correlationId: response.correlationId ?? request.execution.correlationId,
      },
    });
  }

  const { output } = response;
  const outputRecord = isRecord(output) ? output : undefined;
  const message = typeof output === 'string' ? output : undefined;
  const summary = outputRecord && typeof outputRecord.message === 'string' ? outputRecord.message : undefined;
  const logMessage = message ?? summary;

  const evidence = {
    id: fallbackPrefix,
    goalId: request.goal.id,
    executionId: request.execution.id,
    sources: normalizeSources(outputRecord?.sources ?? outputRecord?.sourceUrls ?? outputRecord?.urls, fallbackPrefix),
    artifacts: normalizeArtifacts(outputRecord?.artifacts ?? outputRecord?.files ?? outputRecord?.artifactsWritten, fallbackPrefix),
    logs: normalizeLogs(outputRecord?.logs, fallbackPrefix, capturedAt),
    diffs: normalizeDiffs(outputRecord?.diffs ?? outputRecord?.patches, fallbackPrefix),
    testResults: normalizeTestResults(outputRecord?.testResults ?? outputRecord?.tests, fallbackPrefix),
    confidence: typeof outputRecord?.confidence === 'number' && Number.isFinite(outputRecord.confidence)
      ? outputRecord.confidence
      : undefined,
    capturedAt,
    redactionApplied,
    metadata: {
      gatewayStatus: response.status,
      summary,
      correlationId: response.correlationId ?? request.execution.correlationId,
      ...(isRecord(outputRecord?.metadata) ? outputRecord.metadata : {}),
    },
  };

  if (logMessage) {
    evidence.logs = [
      ...evidence.logs,
      {
        id: `${fallbackPrefix}:log:${randomUUID()}`,
        level: 'info',
        message: logMessage,
        timestamp: capturedAt,
      },
    ];
  }

  if (evidence.logs.length === 0 && output !== undefined) {
    evidence.logs = [{
      id: `${fallbackPrefix}:log:${randomUUID()}`,
      level: 'info',
      message: stringifyUnknown(output),
      timestamp: capturedAt,
    }];
  }

  return OpenClawEvidencePacketSchema.parse(evidence);
}

function buildBlockedResult(
  request: OpenClawTaskRequest,
  policy: OpenClawPolicyDecision,
  approvalState: OpenClawApprovalState,
  message: string,
  durationMs: number,
  redactionApplied: boolean,
): OpenClawDispatchResult {
  return OpenClawDispatchResultSchema.parse({
    requestId: request.execution.id,
    goalId: request.goal.id,
    status: 'blocked',
    approvalState,
    policy,
    durationMs,
    message,
    error: undefined,
    redactionApplied,
    correlationId: request.execution.correlationId || request.goal.correlationId,
    trackId: request.execution.trackId ?? request.goal.trackId,
    metadata: {
      blocked: true,
      dryRun: Boolean(request.dryRun),
    },
  });
}

function buildFailedResult(
  request: OpenClawTaskRequest,
  policy: OpenClawPolicyDecision,
  approvalState: OpenClawApprovalState,
  error: string,
  durationMs: number,
  redactionApplied: boolean,
): OpenClawDispatchResult {
  return OpenClawDispatchResultSchema.parse({
    requestId: request.execution.id,
    goalId: request.goal.id,
    status: 'failed',
    approvalState,
    policy,
    durationMs,
    message: 'OpenClaw dispatch failed',
    error,
    redactionApplied,
    correlationId: request.execution.correlationId || request.goal.correlationId,
    trackId: request.execution.trackId ?? request.goal.trackId,
    metadata: {
      failed: true,
      dryRun: Boolean(request.dryRun),
    },
  });
}

function buildDryRunResult(
  request: OpenClawTaskRequest,
  policy: OpenClawPolicyDecision,
  gatewayResponse: OpenClawGatewayResponse,
  evidence: OpenClawEvidencePacket,
  durationMs: number,
  redactionApplied: boolean,
  approvalState: OpenClawApprovalState,
): OpenClawDispatchResult {
  return OpenClawDispatchResultSchema.parse({
    requestId: request.execution.id,
    goalId: request.goal.id,
    runId: gatewayResponse.runId,
    status: 'dry_run',
    approvalState,
    policy,
    gatewayResponse,
    evidence,
    durationMs,
    message: gatewayResponse.warnings.length > 0 ? gatewayResponse.warnings.join(' | ') : 'Dry run completed',
    redactionApplied,
    correlationId: request.execution.correlationId || request.goal.correlationId,
    trackId: request.execution.trackId ?? request.goal.trackId,
    metadata: {
      dryRun: true,
      blocked: false,
    },
  });
}

function buildSuccessResult(
  request: OpenClawTaskRequest,
  policy: OpenClawPolicyDecision,
  gatewayResponse: OpenClawGatewayResponse,
  evidence: OpenClawEvidencePacket,
  durationMs: number,
  redactionApplied: boolean,
  approvalState: OpenClawApprovalState,
  approvedBy?: string,
): OpenClawDispatchResult {
  return OpenClawDispatchResultSchema.parse({
    requestId: request.execution.id,
    goalId: request.goal.id,
    runId: gatewayResponse.runId,
    status: 'success',
    approvalState,
    policy,
    gatewayResponse,
    evidence,
    durationMs,
    message: gatewayResponse.warnings.length > 0 ? gatewayResponse.warnings.join(' | ') : 'OpenClaw dispatch completed',
    redactionApplied,
    correlationId: request.execution.correlationId || request.goal.correlationId,
    trackId: request.execution.trackId ?? request.goal.trackId,
    approvedBy,
    metadata: {
      status: gatewayResponse.status,
      dryRun: false,
    },
  });
}

export class OpenClawTaskDispatcher {
  private readonly config: OpenClawConfig;
  private readonly gateway: OpenClawGatewayAdapter;
  private readonly approvalService?: OpenClawApprovalService;
  private readonly logger: Logger;

  constructor(options: OpenClawTaskDispatcherOptions) {
    this.config = options.config;
    this.gateway = options.gateway;
    this.approvalService = options.approvalService;
    this.logger = options.logger ?? new Logger('OpenClawDispatcher');
  }

  evaluate(request: OpenClawTaskRequest): OpenClawPolicyDecision {
    const policyRequest: OpenClawPolicyRequest = {
      goal: request.goal,
      execution: request.execution,
    };
    return classifyOpenClawPolicy(policyRequest, this.config);
  }

  async preview(request: OpenClawTaskRequest): Promise<OpenClawDispatchResult> {
    return this.dispatch({ ...request, dryRun: true });
  }

  async dispatch(request: OpenClawTaskRequest): Promise<OpenClawDispatchResult> {
    const startedAt = Date.now();
    const policy = this.evaluate(request);
    const redaction = redactOpenClawPayload({ goal: request.goal, execution: request.execution }, this.config);

    this.logger.structured('info', 'OpenClaw dispatch evaluated', {
      correlationId: request.execution.correlationId || request.goal.correlationId,
      goalId: request.goal.id,
      trackId: request.execution.trackId ?? request.goal.trackId,
      executionId: request.execution.id,
      targetAgent: request.execution.targetAgent,
      riskLevel: policy.trustZone,
      executionMode: request.execution.executionMode,
      approvalState: policy.canDispatch ? 'not_required' : 'pending',
      status: 'evaluated',
      redactionApplied: redaction.applied,
    });

    if (request.dryRun) {
      if (policy.verdict === 'fail' && !policy.approvalEligible) {
        return buildBlockedResult(
          request,
          policy,
          policy.requiresApproval ? 'pending' : 'skipped',
          policy.blockedReasons[0] ?? 'OpenClaw dry-run blocked by policy.',
          Date.now() - startedAt,
          redaction.applied,
        );
      }

      try {
        const gatewayResponse = await this.gateway.dispatch({
          id: request.execution.id,
          correlationId: request.execution.correlationId || request.goal.correlationId,
          dryRun: true,
          packet: request.execution,
          policy,
          metadata: request.metadata,
        });
        const evidence = buildEvidenceFromGatewayResponse(request, gatewayResponse, redaction.applied);
        return buildDryRunResult(
          request,
          policy,
          gatewayResponse,
          evidence,
          Date.now() - startedAt,
          redaction.applied,
          policy.canDispatch ? 'not_required' : 'skipped',
        );
      } catch (error: unknown) {
        const normalized = normalizeOpenClawError(error);
        return buildFailedResult(request, policy, 'skipped', normalized.message, Date.now() - startedAt, redaction.applied);
      }
    }

    if (policy.canDispatch) {
      try {
        const gatewayResponse = await this.gateway.dispatch({
          id: request.execution.id,
          correlationId: request.execution.correlationId || request.goal.correlationId,
          dryRun: false,
          packet: request.execution,
          policy,
          metadata: request.metadata,
        });
        const evidence = buildEvidenceFromGatewayResponse(request, gatewayResponse, redaction.applied);
        return buildSuccessResult(request, policy, gatewayResponse, evidence, Date.now() - startedAt, redaction.applied, 'not_required');
      } catch (error: unknown) {
        const normalized = normalizeOpenClawError(error);
        return buildFailedResult(request, policy, 'not_required', normalized.message, Date.now() - startedAt, redaction.applied);
      }
    }

    if (!policy.approvalEligible) {
      return buildBlockedResult(
        request,
        policy,
        'skipped',
        policy.blockedReasons[0] ?? 'OpenClaw task is not approval eligible.',
        Date.now() - startedAt,
        redaction.applied,
      );
    }

    if (!this.approvalService) {
      return buildBlockedResult(
        request,
        policy,
        'pending',
        'OpenClaw approval service is not configured.',
        Date.now() - startedAt,
        redaction.applied,
      );
    }

    const approvalRequest = buildOpenClawApprovalRequest({ goal: request.goal, execution: request.execution }, policy);

    let approval: OpenClawApprovalDecision;
    try {
      approval = await this.approvalService.requestApproval(approvalRequest);
    } catch (error: unknown) {
      const normalized = normalizeOpenClawError(error);
      return buildFailedResult(request, policy, 'pending', normalized.message, Date.now() - startedAt, redaction.applied);
    }

    if (!approval.approved) {
      return buildBlockedResult(
        request,
        policy,
        'denied',
        approval.reason ?? 'OpenClaw approval denied.',
        Date.now() - startedAt,
        redaction.applied,
      );
    }

    try {
      const gatewayResponse = await this.gateway.dispatch({
        id: request.execution.id,
        correlationId: request.execution.correlationId || request.goal.correlationId,
        dryRun: false,
        packet: request.execution,
        policy,
        metadata: {
          ...(request.metadata ?? {}),
          approvedBy: approval.reviewer,
        },
      });
      const evidence = buildEvidenceFromGatewayResponse(request, gatewayResponse, redaction.applied);
      const result = buildSuccessResult(request, policy, gatewayResponse, evidence, Date.now() - startedAt, redaction.applied, 'approved', approval.reviewer);

      this.logger.structured('info', 'OpenClaw dispatch completed', {
        correlationId: result.correlationId,
        goalId: result.goalId,
        runId: result.runId,
        executionId: request.execution.id,
        targetAgent: request.execution.targetAgent,
        riskLevel: policy.trustZone,
        executionMode: request.execution.executionMode,
        approvalState: result.approvalState,
        status: result.status,
        durationMs: result.durationMs,
        redactionApplied: redaction.applied,
      });

      return result;
    } catch (error: unknown) {
      const normalized = normalizeOpenClawError(error);
      return buildFailedResult(request, policy, 'approved', normalized.message, Date.now() - startedAt, redaction.applied);
    }
  }
}

export { buildEvidenceFromGatewayResponse };
