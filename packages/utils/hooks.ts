import {
  clearHookAuditTrail,
  clearHookDlq,
  clearHooks,
  disableHook,
  enableHook,
  fireHook,
  getHookCircuitSnapshot,
  getHookDlqEntries,
  getHookExecutions,
  getHookRegistrySnapshot,
  getHookSummary as getHookSummaryFromRegistry,
  isHookEnabled,
  listHooks,
  registerHook,
  retryAllHookDlqEntries,
  retryHookDlqEntry,
  runHooks,
  type HookCategory,
  type HookCircuitSnapshot,
  type HookDlqEntry,
  type HookDlqEntryInput,
  type HookDlqStatus,
  type HookDispatchContext,
  type HookExecutionRecord,
  type HookExecutionRecordInput,
  type HookExecutionStatus,
  type HookFireOptions,
  type HookFireSummary,
  type HookHandler,
  type HookName,
  type HookRegistration,
  type HookRegistrationOptions,
  type HookRegistrationSummary,
  type HookRunStatus,
  type HookSnapshot,
  type HookSummary,
} from '@packages/core-logic/hookRegistry.js';

export interface HookDefinitionSummary {
  name: HookName;
  index: number;
  priority: number;
  timeout: number;
  category: HookCategory;
  description: string;
  enabled: boolean;
  retryOnFail: boolean;
  handlerName: string;
  metadata: Record<string, unknown>;
}

export function listHookDefinitions(): HookDefinitionSummary[] {
  return getHookRegistrySnapshot().flatMap((snapshot) => {
    if (snapshot.handlers.length === 0) {
      return [{
        name: snapshot.event,
        index: 1,
        priority: snapshot.priority,
        timeout: snapshot.timeoutMs,
        category: snapshot.category,
        description: snapshot.description,
        enabled: snapshot.enabled,
        retryOnFail: snapshot.retryOnFail,
        handlerName: snapshot.event,
        metadata: {},
      }];
    }

    return snapshot.handlers.map((handler, index) => ({
      name: snapshot.event,
      index: index + 1,
      priority: handler.priority,
      timeout: handler.timeoutMs,
      category: handler.category,
      description: handler.description,
      enabled: handler.enabled,
      retryOnFail: handler.retryOnFail,
      handlerName: handler.handlerName,
      metadata: handler.metadata,
    }));
  });
}

export {
  clearHookAuditTrail,
  clearHookDlq,
  clearHooks,
  disableHook,
  enableHook,
  fireHook,
  getHookCircuitSnapshot,
  getHookDlqEntries,
  getHookExecutions,
  getHookRegistrySnapshot,
  getHookSummaryFromRegistry as getHookSummary,
  isHookEnabled,
  listHooks,
  registerHook,
  retryAllHookDlqEntries,
  retryHookDlqEntry,
  runHooks,
  type HookCategory,
  type HookCircuitSnapshot,
  type HookDlqEntry,
  type HookDlqEntryInput,
  type HookDlqStatus,
  type HookDispatchContext,
  type HookExecutionRecord,
  type HookExecutionRecordInput,
  type HookExecutionStatus,
  type HookFireOptions,
  type HookFireSummary,
  type HookHandler,
  type HookName,
  type HookRegistration,
  type HookRegistrationOptions,
  type HookRegistrationSummary,
  type HookRunStatus,
  type HookSnapshot,
  type HookSummary,
};

