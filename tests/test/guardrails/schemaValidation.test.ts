/**
 * Guardrails Phase 1: Schema Validation Tests
 * Track: guardrails_evaluation_20260323
 */
import { describe, it, expect } from 'vitest';
import { AgentResponseSchema, AgentResultSchema } from '../../src/agents/schemas/agentOutput.js';
import {
  validateAgentResult,
  validateAgentResponse,
  validateWithSchema,
  GuardrailsValidationError,
} from '../../src/agents/middleware/validateOutput.js';

describe('AgentResponseSchema', () => {
  it('valid success response', () => {
    const response = {
      status: 'success',
      message: 'Feladat elvégezve',
      data: { key: 'value' },
    };
    const result = AgentResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('valid error response', () => {
    const response = {
      status: 'error',
      error: 'Something went wrong',
    };
    const result = AgentResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('valid handoff response', () => {
    const response = {
      status: 'handoff',
      handoff: {
        type: 'handoff' as const,
        targetAgent: 'Developer',
        reason: 'Needs code generation',
        instruction: 'Write tests',
      },
    };
    const result = AgentResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('invalid status rejected', () => {
    const response = {
      status: 'invalid_status',
      message: 'test',
    };
    const result = AgentResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('confidence must be 0-1', () => {
    const valid = AgentResponseSchema.safeParse({ status: 'success', confidence: 0.8 });
    expect(valid.success).toBe(true);

    const tooHigh = AgentResponseSchema.safeParse({ status: 'success', confidence: 1.5 });
    expect(tooHigh.success).toBe(false);

    const tooLow = AgentResponseSchema.safeParse({ status: 'success', confidence: -0.1 });
    expect(tooLow.success).toBe(false);
  });
});

describe('AgentResultSchema', () => {
  it('valid success result', () => {
    const result = {
      success: true,
      message: 'Kód generálva',
      data: { code: 'console.log("hello")' },
    };
    const parsed = AgentResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('valid error result', () => {
    const result = {
      success: false,
      message: 'Hiba történt',
    };
    const parsed = AgentResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('empty message rejected', () => {
    const result = { success: true, message: '' };
    const parsed = AgentResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it('missing success rejected', () => {
    const result = { message: 'test' };
    const parsed = AgentResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('validateAgentResult()', () => {
  it('returns valid for correct AgentResult', () => {
    const result = validateAgentResult(
      { success: true, message: 'OK', data: { x: 1 } },
      'TestAgent',
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('returns invalid for bad AgentResult (soft-fail)', () => {
    const result = validateAgentResult(
      { success: 'not_boolean', message: '' },
      'TestAgent',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});

describe('validateAgentResponse()', () => {
  it('returns valid for correct AgentResponse', () => {
    const result = validateAgentResponse(
      { status: 'success', message: 'Kész' },
      'TestAgent',
    );
    expect(result.valid).toBe(true);
  });

  it('detects invalid status', () => {
    const result = validateAgentResponse(
      { status: 'unknown_status' },
      'TestAgent',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('validateWithSchema() strict mode', () => {
  it('throws GuardrailsValidationError in strict mode', () => {
    const origEnv = process.env.GUARDRAILS_STRICT;
    process.env.GUARDRAILS_STRICT = 'true';
    try {
      expect(() =>
        validateWithSchema({ status: 'invalid' }, AgentResponseSchema, 'test'),
      ).toThrow(GuardrailsValidationError);
    } finally {
      process.env.GUARDRAILS_STRICT = origEnv;
    }
  });
});
