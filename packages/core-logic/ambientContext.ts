import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';

export interface BASContext {
  sessionId: string;
  userId: string;
  correlationId: string;
  traceId: string;
  startTime: number;
  permissions: string[];
}

export const ambientContext = new AsyncLocalStorage<BASContext>();

export function getContext(): BASContext | undefined {
  return ambientContext.getStore();
}

export function runWithContext<T>(context: Partial<BASContext>, fn: () => T): T {
  const current = getContext();
  const merged: BASContext = {
    sessionId: context.sessionId ?? current?.sessionId ?? 'unknown',
    userId: context.userId ?? current?.userId ?? 'system',
    correlationId: context.correlationId ?? current?.correlationId ?? crypto.randomUUID(),
    traceId: context.traceId ?? current?.traceId ?? crypto.randomUUID(),
    startTime: context.startTime ?? current?.startTime ?? Date.now(),
    permissions: context.permissions ?? current?.permissions ?? [],
  };
  return ambientContext.run(merged, fn);
}
