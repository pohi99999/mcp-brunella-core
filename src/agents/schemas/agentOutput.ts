/**
 * Guardrails: Zod schemák agent output validáláshoz.
 * Track: guardrails_evaluation_20260323 — Phase 1
 */
import { z } from 'zod';

/** Validált AgentResponse schema — minden agent válasza ezen megy át */
export const AgentResponseSchema = z.object({
  success: z.boolean().optional(),
  status: z.enum(['success', 'error', 'delegated', 'handoff']),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  nextStep: z.string().optional(),
  delegatedTo: z.string().optional(),
  handoff: z.object({
    type: z.literal('handoff'),
    targetAgent: z.string(),
    reason: z.string(),
    instruction: z.string(),
    contextUpdates: z.record(z.unknown()).optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/** BaseAgent.executeTask() visszatérési érték schema */
export const AgentResultSchema = z.object({
  success: z.boolean(),
  message: z.string().min(1),
  status: z.string().optional(),
  data: z.unknown().optional(),
  handoff: z.object({
    type: z.literal('handoff'),
    targetAgent: z.string(),
    reason: z.string(),
    instruction: z.string(),
    contextUpdates: z.record(z.unknown()).optional(),
  }).optional(),
  thoughts: z.string().optional(),
  contextUsed: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ValidatedAgentResponse = z.infer<typeof AgentResponseSchema>;
export type ValidatedAgentResult = z.infer<typeof AgentResultSchema>;
