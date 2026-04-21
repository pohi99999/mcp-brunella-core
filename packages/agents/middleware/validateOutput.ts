/**
 * Guardrails Middleware: Agent output validáció Zod schemákkal.
 * Track: guardrails_evaluation_20260323 — Phase 1
 *
 * Soft-fail by default: validáció hiba → logWarn + eredeti eredmény továbbítás.
 * GUARDRAILS_STRICT=true → error ha validáció nem sikerül.
 */
import { ZodSchema, ZodError } from 'zod';
import { logWarn, logInfo } from '@packages/utils/logger.js';
import { AgentResponseSchema, AgentResultSchema } from '../schemas/agentOutput.js';
import type { AgentResponse } from '../types.js';
import type { AgentResult } from '../BaseAgent.js';

export interface ValidationResult<T> {
  valid: boolean;
  data: T;
  errors?: string[];
}

const STRICT_MODE = () => process.env.GUARDRAILS_STRICT === 'true';

/**
 * Validálja az agent eredményét a megadott Zod schema ellen.
 * Soft-fail: logol és visszaadja az eredetit. Strict: Error-t dob.
 */
export function validateWithSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context: string,
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = formatZodErrors(result.error);
  logWarn('Guardrails', `[${context}] Validáció hiba: ${errors.join('; ')}`);

  if (STRICT_MODE()) {
    throw new GuardrailsValidationError(context, errors);
  }

  return { valid: false, data: data as T, errors };
}

/** AgentResult validáció (BaseAgent.executeTask() output) */
export function validateAgentResult(result: unknown, agentName: string): ValidationResult<AgentResult> {
  return validateWithSchema(result, AgentResultSchema, `${agentName}:AgentResult`);
}

/** AgentResponse validáció (BaseAgent.execute() output) */
export function validateAgentResponse(response: unknown, agentName: string): ValidationResult<AgentResponse> {
  return validateWithSchema(response, AgentResponseSchema, `${agentName}:AgentResponse`);
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
}

export class GuardrailsValidationError extends Error {
  public readonly context: string;
  public readonly validationErrors: string[];

  constructor(context: string, errors: string[]) {
    super(`Guardrails validáció hiba [${context}]: ${errors.join('; ')}`);
    this.name = 'GuardrailsValidationError';
    this.context = context;
    this.validationErrors = errors;
  }
}

