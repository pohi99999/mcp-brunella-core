import {
  OpenClawApprovalState,
  OpenClawDecisionVerdict,
  OpenClawExecPacket,
  OpenClawGoalPacket,
  OpenClawPolicyDecision,
  OpenClawTrustZone,
  OpenClawConfig,
} from './contracts.js';

export interface OpenClawPolicyRequest {
  goal: OpenClawGoalPacket;
  execution: OpenClawExecPacket;
}

const READ_ONLY_HINTS = ['read', 'list', 'get', 'show', 'view', 'inspect', 'status', 'health', 'preview', 'query'];
const WRITE_HINTS = ['write', 'save', 'update', 'create', 'patch', 'append', 'sync', 'export', 'import', 'commit'];
const DESTRUCTIVE_HINTS = ['delete', 'remove', 'destroy', 'drop', 'truncate', 'purge', 'wipe', 'overwrite'];
const EXEC_HINTS = ['shell', 'exec', 'command', 'run', 'terminal', 'process'];
const EXTERNAL_HINTS = ['network', 'http', 'fetch', 'webhook', 'email', 'message', 'slack', 'discord', 'sms', 'deploy', 'publish', 'billing', 'payment', 'credential', 'secret', 'token'];

function normalizeTokens(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0);
}

function includesHint(values: string[], hints: string[]): boolean {
  const tokens = normalizeTokens(values);
  return tokens.some((token) => hints.some((hint) => token.includes(hint)));
}

function hasDangerousCombination(executionMode: string, toolScope: string[], allowedConnectors: string[]): boolean {
  const normalizedTools = normalizeTokens(toolScope);
  const normalizedConnectors = normalizeTokens(allowedConnectors);
  const hasExec = executionMode === 'exec' || includesHint(normalizedTools, EXEC_HINTS);
  const hasWrite = executionMode === 'constrained_write' || includesHint(normalizedTools, WRITE_HINTS);
  const hasExternal = executionMode === 'external_action' || normalizedConnectors.length > 0 || includesHint(normalizedTools, EXTERNAL_HINTS);
  return hasExec && hasWrite && hasExternal;
}

function hasHardDestructiveSignal(executionMode: string, toolScope: string[], allowedConnectors: string[]): boolean {
  const normalizedTools = normalizeTokens(toolScope);
  const normalizedConnectors = normalizeTokens(allowedConnectors);
  const externalRedSignals = ['production', 'billing', 'payment', 'credential', 'secret', 'token', 'message_send', 'email_send'];
  return (
    includesHint(normalizedTools, DESTRUCTIVE_HINTS)
    || normalizedConnectors.some((connector) => externalRedSignals.some((hint) => connector.includes(hint)))
    || normalizedTools.some((tool) => externalRedSignals.some((hint) => tool.includes(hint)))
    || executionMode === 'external_action' && normalizedConnectors.some((connector) => ['production', 'billing', 'payment'].some((hint) => connector.includes(hint)))
  );
}

function classifyTrustZone(executionMode: string, toolScope: string[], allowedConnectors: string[]): OpenClawTrustZone {
  if (hasHardDestructiveSignal(executionMode, toolScope, allowedConnectors) || hasDangerousCombination(executionMode, toolScope, allowedConnectors)) {
    return 'red';
  }

  const normalizedTools = normalizeTokens(toolScope);
  const normalizedConnectors = normalizeTokens(allowedConnectors);
  const readOnly = executionMode === 'read' && normalizedConnectors.length === 0 && normalizedTools.length > 0 && normalizedTools.every((tool) => READ_ONLY_HINTS.some((hint) => tool.includes(hint)));
  if (readOnly) {
    return 'green';
  }

  if (executionMode === 'read') {
    return 'green';
  }

  return 'amber';
}

function severityRank(zone: OpenClawTrustZone): number {
  switch (zone) {
    case 'green':
      return 1;
    case 'amber':
      return 2;
    case 'red':
      return 3;
    default:
      return 3;
  }
}

function shouldEscalateForApproval(trustZone: OpenClawTrustZone, threshold: OpenClawTrustZone): boolean {
  return severityRank(trustZone) >= severityRank(threshold);
}

function valueLooksSensitive(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return /bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value)
    || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(value)
    || /\b\d{3}[-. ]?\d{2}[-. ]?\d{4}\b/.test(value);
}

function redactRecursive<T>(value: T, sensitiveKeys: string[], mask: string, applied: { value: boolean }): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactRecursive(item, sensitiveKeys, mask, applied)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      const normalizedKey = key.trim().toLowerCase();
      const shouldRedact = sensitiveKeys.some((item) => normalizedKey.includes(item)) || valueLooksSensitive(child);
      if (shouldRedact) {
        applied.value = true;
        return [key, mask] as const;
      }
      return [key, redactRecursive(child, sensitiveKeys, mask, applied)] as const;
    });
    return Object.fromEntries(entries) as T;
  }

  if (typeof value === 'string' && valueLooksSensitive(value)) {
    applied.value = true;
    return mask as T;
  }

  return value;
}

function detectSensitiveData(value: unknown, sensitiveKeys: string[]): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => detectSensitiveData(item, sensitiveKeys));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalizedKey = key.trim().toLowerCase();
      return sensitiveKeys.some((item) => normalizedKey.includes(item)) || detectSensitiveData(child, sensitiveKeys);
    });
  }

  return valueLooksSensitive(value);
}

function collectReasonCodes(trustZone: OpenClawTrustZone, executionMode: string, toolScope: string[], allowedConnectors: string[]): string[] {
  const reasonCodes: string[] = [];
  if (trustZone === 'green') {
    reasonCodes.push('READ_ONLY_SCOPE');
  }
  if (executionMode === 'constrained_write') {
    reasonCodes.push('CONSTRAINED_WRITE_SCOPE');
  }
  if (executionMode === 'exec') {
    reasonCodes.push('EXECUTION_REQUIRED');
  }
  if (executionMode === 'external_action') {
    reasonCodes.push('EXTERNAL_ACTION_REQUIRED');
  }
  if (includesHint(toolScope, WRITE_HINTS)) {
    reasonCodes.push('WRITE_TOOL_SCOPE');
  }
  if (includesHint(toolScope, EXEC_HINTS)) {
    reasonCodes.push('EXEC_TOOL_SCOPE');
  }
  if (includesHint(toolScope, EXTERNAL_HINTS) || allowedConnectors.length > 0) {
    reasonCodes.push('EXTERNAL_CONNECTOR_SCOPE');
  }
  if (hasDangerousCombination(executionMode, toolScope, allowedConnectors)) {
    reasonCodes.push('BROAD_EXECUTION_SURFACE');
  }
  if (hasHardDestructiveSignal(executionMode, toolScope, allowedConnectors)) {
    reasonCodes.push('DESTRUCTIVE_OR_CREDENTIAL_TOUCHING_SCOPE');
  }
  return [...new Set(reasonCodes)];
}

export function redactOpenClawPayload<T>(value: T, config: OpenClawConfig): { value: T; applied: boolean } {
  const applied = { value: false };
  const redacted = redactRecursive(value, config.redaction.sensitiveKeys, config.redaction.mask, applied);
  return { value: redacted, applied: applied.value };
}

export function classifyOpenClawPolicy(request: OpenClawPolicyRequest, config: OpenClawConfig): OpenClawPolicyDecision {
  const { goal, execution } = request;
  const targetAgent = execution.targetAgent.trim();
  const normalizedToolScope = execution.toolScope.map((value) => value.trim()).filter((value) => value.length > 0);
  const normalizedConnectors = execution.allowedConnectors.map((value) => value.trim()).filter((value) => value.length > 0);

  const redactionApplied =
    detectSensitiveData(goal.metadata, config.redaction.sensitiveKeys)
    || detectSensitiveData(execution.metadata, config.redaction.sensitiveKeys)
    || detectSensitiveData(execution.input, config.redaction.sensitiveKeys);

  if (!goal.id || !goal.goal || !targetAgent || normalizedToolScope.length === 0) {
    return {
      id: `${execution.id}:policy`,
      goalId: goal.id,
      targetAgent,
      trustZone: 'red',
      executionMode: execution.executionMode,
      verdict: 'fail',
      canDispatch: false,
      requiresApproval: false,
      approvalEligible: false,
      reasonCodes: ['MISSING_REQUIRED_FIELDS'],
      blockedReasons: ['Goal, agent, or tool scope is missing.'],
      isDestructive: true,
      redactionApplied,
      createdAt: new Date().toISOString(),
      correlationId: execution.correlationId || goal.correlationId,
      trackId: execution.trackId ?? goal.trackId,
      metadata: {
        goalRequester: goal.requester,
      },
    };
  }

  const configuredAgentAllowlist = config.agentAllowlists[targetAgent] ?? [];
  if (config.allowedAgents.length > 0 && !config.allowedAgents.includes(targetAgent)) {
    return {
      id: `${execution.id}:policy`,
      goalId: goal.id,
      targetAgent,
      trustZone: 'red',
      executionMode: execution.executionMode,
      verdict: 'fail',
      canDispatch: false,
      requiresApproval: false,
      approvalEligible: false,
      reasonCodes: ['AGENT_NOT_ALLOWED'],
      blockedReasons: [`Agent "${targetAgent}" is not on the global allowlist.`],
      isDestructive: false,
      redactionApplied,
      createdAt: new Date().toISOString(),
      correlationId: execution.correlationId || goal.correlationId,
      trackId: execution.trackId ?? goal.trackId,
    };
  }

  if (configuredAgentAllowlist.length > 0) {
    const toolScopeAllowed = normalizedToolScope.every((tool) => configuredAgentAllowlist.some((allow) => tool.includes(allow) || allow.includes(tool)));
    if (!toolScopeAllowed) {
      return {
        id: `${execution.id}:policy`,
        goalId: goal.id,
        targetAgent,
        trustZone: 'red',
        executionMode: execution.executionMode,
        verdict: 'fail',
        canDispatch: false,
        requiresApproval: false,
        approvalEligible: false,
        reasonCodes: ['AGENT_TOOL_SCOPE_NOT_ALLOWED'],
        blockedReasons: [`Agent "${targetAgent}" is not permitted to use the requested tool scope.`],
        isDestructive: false,
        redactionApplied,
        createdAt: new Date().toISOString(),
        correlationId: execution.correlationId || goal.correlationId,
        trackId: execution.trackId ?? goal.trackId,
      };
    }
  }

  const trustZone = classifyTrustZone(execution.executionMode, normalizedToolScope, normalizedConnectors);
  const { approvalThreshold } = config;
  const approvalRequired = trustZone === 'red' || shouldEscalateForApproval(trustZone, approvalThreshold) || execution.requiresApproval;
  const isDestructive = trustZone === 'red';
  const approvalEligible = approvalRequired;
  const reasonCodes = collectReasonCodes(trustZone, execution.executionMode, normalizedToolScope, normalizedConnectors);

  let verdict: OpenClawDecisionVerdict = 'pass';
  if (approvalRequired) {
    verdict = 'needs_review';
  }

  const canDispatch = !approvalRequired;
  const blockedReasons = canDispatch ? [] : [
    trustZone === 'red'
      ? 'Red-zone execution requires explicit approval before dispatch.'
      : trustZone === 'green'
        ? 'OpenClaw approval threshold requires review before dispatch.'
        : 'Amber-zone execution requires human review before dispatch.',
  ];

  return {
    id: `${execution.id}:policy`,
    goalId: goal.id,
    targetAgent,
    trustZone,
    executionMode: execution.executionMode,
    verdict,
    canDispatch,
    requiresApproval: approvalRequired,
    approvalEligible,
    reasonCodes,
    blockedReasons,
    isDestructive,
    redactionApplied,
    createdAt: new Date().toISOString(),
    correlationId: execution.correlationId || goal.correlationId,
    trackId: execution.trackId ?? goal.trackId,
    metadata: {
      requester: goal.requester,
    },
  };
}

export function buildOpenClawApprovalRequest(request: OpenClawPolicyRequest, decision: OpenClawPolicyDecision): { id: string; goalId: string; executionId: string; agentName: string; trustZone: OpenClawTrustZone; reasonCodes: string[]; summary: string; correlationId: string; trackId?: string; metadata?: Record<string, unknown>; } {
  return {
    id: `${request.execution.id}:approval`,
    goalId: request.goal.id,
    executionId: request.execution.id,
    agentName: request.execution.targetAgent,
    trustZone: decision.trustZone,
    reasonCodes: decision.reasonCodes,
    summary: `OpenClaw ${decision.trustZone} task for ${request.execution.targetAgent} requires approval.`,
    correlationId: request.execution.correlationId || request.goal.correlationId,
    trackId: request.execution.trackId ?? request.goal.trackId,
    metadata: {
      requester: request.goal.requester,
      executionMode: request.execution.executionMode,
    },
  };
}

export function mapApprovalStateToDispatchStatus(approvalState: OpenClawApprovalState, didDispatch: boolean): 'success' | 'blocked' | 'dry_run' | 'failed' {
  if (approvalState === 'approved' && didDispatch) {
    return 'success';
  }
  if (approvalState === 'skipped' && didDispatch) {
    return 'dry_run';
  }
  if (approvalState === 'denied' || approvalState === 'pending') {
    return 'blocked';
  }
  return didDispatch ? 'success' : 'failed';
}
