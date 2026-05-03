import { createOpenClawRuntime, OpenClawTaskRequestSchema } from '../integrations/openclaw/index.js';
import { ensureError } from '../utils/ensureError.js';

function printJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export interface OpenClawCliPayload {
  ok: boolean;
  snapshot?: unknown;
  health?: unknown;
  result?: unknown;
  error?: string;
}

export interface OpenClawCliHandlers {
  status(): Promise<OpenClawCliPayload>;
  preview(requestJson: string): Promise<OpenClawCliPayload>;
}

export function createOpenClawCliHandlers() : OpenClawCliHandlers {
  return {
    async status(): Promise<OpenClawCliPayload> {
      try {
        const runtime = createOpenClawRuntime();
        const [health, snapshot] = await Promise.all([
          runtime.gateway.healthCheck(),
          Promise.resolve(runtime.snapshot()),
        ]);
        return {
          ok: true,
          snapshot,
          health,
        };
      } catch (error: unknown) {
        return {
          ok: false,
          error: ensureError(error).message,
        };
      }
    },

    async preview(requestJson: string): Promise<OpenClawCliPayload> {
      try {
        const parsed = JSON.parse(requestJson) as unknown;
        const request = OpenClawTaskRequestSchema.parse(parsed);
        const runtime = createOpenClawRuntime();
        const result = await runtime.dispatcher.preview(request);
        return {
          ok: true,
          result,
        };
      } catch (error: unknown) {
        return {
          ok: false,
          error: ensureError(error).message,
        };
      }
    },
  };
}

export function formatOpenClawCliPayload(payload: OpenClawCliPayload): string {
  return printJson(payload);
}
