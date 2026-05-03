import { validateAgentResult, validateAgentResponse } from '../agents/middleware/validateOutput.js';
import type { AgentResult } from '../agents/BaseAgent.js';
import type { AgentResponse } from '../agents/types.js';
import { redactObject } from '../security/redactor.js';
import { recordRedaction, recordValidation } from '../server/guardrailsRoutes.js';
import { quickReviewOutput } from './criticQuickReview.js';
import { logWarn } from '../utils/logger.js';

export interface OutputGuardReview {
  validationPassed: boolean;
  criticApproved: boolean;
  criticScore: number;
  criticReason?: string;
  redactionsTriggered: number;
}

function attachGuardrailMetadata<T extends { metadata?: Record<string, unknown> }>(
  payload: T,
  review: OutputGuardReview,
): T {
  return {
    ...payload,
    metadata: {
      ...(payload.metadata ?? {}),
      guardrails: review,
    },
  };
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, candidate) => {
      if (typeof candidate === 'bigint') {
        return `${candidate.toString()}n`;
      }

      if (typeof candidate === 'object' && candidate !== null) {
        if (seen.has(candidate)) {
          return '[Circular]';
        }
        seen.add(candidate);
      }

      return candidate;
    }) ?? '[Unserializable payload]';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `[Unserializable payload: ${message}]`;
  }
}

function safeRecordValidation(valid: boolean, confidence?: number): void {
  try {
    recordValidation(valid, confidence);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(`[OutputGuard] Validation telemetry skipped: ${message}`);
  }
}

function safeRecordRedaction(): void {
  try {
    recordRedaction();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(`[OutputGuard] Redaction telemetry skipped: ${message}`);
  }
}

function buildCriticInput(payload: { message?: string; error?: string; data?: unknown }): string {
  const parts: string[] = [];
  if (payload.message) {
    parts.push(payload.message);
  }
  if (payload.error) {
    parts.push(payload.error);
  }
  if (payload.data !== undefined) {
    parts.push(safeStringify(payload.data).slice(0, 1200));
  }
  return parts.join('\n');
}

export function guardAgentResultOutput(result: AgentResult, agentName: string): AgentResult {
  const validation = (() => {
    try {
      return validateAgentResult(result, agentName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Result validation failed open for ${agentName}: ${message}`);
      return { valid: true, errors: [] };
    }
  })();
  const critic = (() => {
    try {
      return quickReviewOutput(buildCriticInput(result));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Critic failed open for ${agentName}: ${message}`);
      return { ok: true, score: 0, reason: `critic_failed_open: ${message}` };
    }
  })();
  const redacted = (() => {
    try {
      return redactObject(attachGuardrailMetadata(result, {
        validationPassed: validation.valid,
        criticApproved: critic.ok,
        criticScore: critic.score,
        criticReason: critic.reason,
        redactionsTriggered: 0,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Redaction failed open for ${agentName}: ${message}`);
      return { redacted: attachGuardrailMetadata(result, {
        validationPassed: validation.valid,
        criticApproved: critic.ok,
        criticScore: critic.score,
        criticReason: critic.reason,
        redactionsTriggered: 0,
      }), allFindings: [] };
    }
  })();

  if (redacted.allFindings.length > 0) {
    safeRecordRedaction();
  }
  safeRecordValidation(validation.valid, typeof result.metadata?.confidence === 'number' ? result.metadata.confidence : undefined);

  return attachGuardrailMetadata(redacted.redacted, {
    validationPassed: validation.valid,
    criticApproved: critic.ok,
    criticScore: critic.score,
    criticReason: critic.reason,
    redactionsTriggered: redacted.allFindings.length,
  });
}

export function guardAgentResponseOutput(response: AgentResponse, agentName: string): AgentResponse {
  const validation = (() => {
    try {
      return validateAgentResponse(response, agentName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Response validation failed open for ${agentName}: ${message}`);
      return { valid: true, errors: [] };
    }
  })();
  const critic = (() => {
    try {
      return quickReviewOutput(buildCriticInput(response));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Response critic failed open for ${agentName}: ${message}`);
      return { ok: true, score: 0, reason: `critic_failed_open: ${message}` };
    }
  })();
  const redacted = (() => {
    try {
      return redactObject(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`[OutputGuard] Response redaction failed open for ${agentName}: ${message}`);
      return { redacted: response, allFindings: [] };
    }
  })();

  if (redacted.allFindings.length > 0) {
    safeRecordRedaction();
  }
  safeRecordValidation(validation.valid, typeof response.metadata?.confidence === 'number' ? response.metadata.confidence : undefined);

  return {
    ...redacted.redacted,
    metadata: {
      ...(redacted.redacted.metadata ?? {}),
      guardrails: {
        validationPassed: validation.valid,
        criticApproved: critic.ok,
        criticScore: critic.score,
        criticReason: critic.reason,
        redactionsTriggered: redacted.allFindings.length,
      },
    },
  };
}