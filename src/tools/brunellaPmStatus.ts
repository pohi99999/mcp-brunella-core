import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { agentManager } from '../agents/AgentManager.js';
import { logError, logInfo } from '../utils/logger.js';

export const brunellaPmStatusTool = {
  name: 'brunella-pm-status',
  description: 'Returns a Brunella project manager status snapshot via the BrunellaProjectManager agent.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
        description: 'Maximum number of recent FOSZAL entries to include.',
      },
      ragLimit: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
        description: 'Maximum number of RAG hits to include.',
      },
      ragQuery: {
        type: 'string',
        description: 'Optional custom RAG query.',
      },
      question: {
        type: 'string',
        description: 'Optional question or prompt for the agent.',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

function extractMessage(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'object' && result !== null) {
    const record = result as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return record.message;
    }
  }

  return JSON.stringify(result, null, 2);
}

function isFailedResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    (result as { success?: unknown }).success === false
  );
}

export async function brunellaPmStatusHandler(params: {
  limit?: number;
  ragLimit?: number;
  ragQuery?: string;
  question?: string;
} = {}): Promise<{ success: boolean; report?: string; error?: string }> {
  try {
    logInfo('BrunellaPmStatus', 'Status snapshot request received.');
    const question = params.question?.trim() || 'Generate a Brunella project manager status snapshot.';
    const result = await agentManager.delegate(
      'BrunellaProjectManager',
      question,
      {
        payload: {
          limit: params.limit,
          ragLimit: params.ragLimit,
          ragQuery: params.ragQuery?.trim() || question,
        },
      },
    );

    if (isFailedResult(result)) {
      return {
        success: false,
        error: extractMessage(result),
      };
    }

    return {
      success: true,
      report: extractMessage(result),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('BrunellaPmStatus', message);
    return {
      success: false,
      error: message,
    };
  }
}

export function registerBrunellaPmStatusTool(server: McpServer): void {
  server.tool(
    brunellaPmStatusTool.name,
    brunellaPmStatusTool.description,
    {
      limit: z.number().int().min(1).max(10).optional().default(5),
      ragLimit: z.number().int().min(1).max(10).optional().default(5),
      ragQuery: z.string().optional(),
      question: z.string().optional(),
    },
    async (args) => {
      const result = await brunellaPmStatusHandler(args);
      return {
        isError: !result.success,
        content: [
          {
            type: 'text' as const,
            text: result.success ? (result.report ?? '') : `Brunella PM status error: ${result.error ?? 'unknown'}`,
          },
        ],
      };
    },
  );
}
