import { z } from 'zod';
import { ensureError } from '@packages/utils/ensureError.js';
import { kkvCrmService } from '@packages/core-logic/services/kkvCrmService.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveLeadPayload(params: Record<string, unknown>): Record<string, unknown> {
  return isRecord(params.payload) ? params.payload : params;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export const crmCreateLeadTool = {
  name: 'crm_create_lead',
  description: 'Create a KKV CRM lead, persist it, and optionally create a follow-up plan.',
  inputSchema: {
    payload: z.record(z.string(), z.unknown()).optional(),
    workflowId: z.string().optional(),
    createFollowUpPlan: z.boolean().optional(),
  },
};

export async function crmCreateLeadHandler(params: Record<string, unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const result = await kkvCrmService.createLead(resolveLeadPayload(params), {
      workflowId: parseOptionalString(params.workflowId),
      createFollowUpPlan: parseOptionalBoolean(params.createFollowUpPlan),
    });

    if (!result.success) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: result.error,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ok: true,
              inserted: result.inserted,
              eventType: result.eventType,
              createdAt: result.createdAt,
              lead: result.lead,
              followUpCreated: result.followUpCreated,
              followUpPlan: result.followUpPlan,
              followUpActions: result.followUpActions,
              snapshot: result.snapshot,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: unknown) {
    const normalized = ensureError(error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `CRM lead creation failed: ${normalized.message}`,
        },
      ],
    };
  }
}

