import { agentManager } from '@packages/agents/AgentManager.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { captureToolRunCandidates } from '../goldenDatasetBridge.js';
import {
  fireHook,
  registerHook,
  registerHookCatalogEntries,
  startHookDlqProcessor,
  stopHookDlqProcessor,
  type HookDispatchContext,
} from '../hookRegistry.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import { BUILTIN_HOOK_CATALOG } from './builtinHookCatalog.js';

import { registerAdvancedHooks } from '../advancedHooks.js';

type HookPayloadRecord = Record<string, unknown>;

let initialized = false;

function asRecord(value: unknown): HookPayloadRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as HookPayloadRecord
    : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function firstAvailableAgent(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (agentManager.getAgent(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function delegateToAvailableAgent(
  candidates: string[],
  instruction: string,
  context: HookPayloadRecord,
): Promise<string | null> {
  const agentName = firstAvailableAgent(candidates);
  if (!agentName) {
    logWarn('BuiltinHooks', `No registered agent for hook delegation: ${candidates.join(', ')}`);
    return null;
  }

  await agentManager.delegate(agentName, instruction, context);
  return agentName;
}

function payloadSummary(payload: HookPayloadRecord): string {
  return asText(payload.subject)
    || asText(payload.task)
    || asText(payload.title)
    || asText(payload.company)
    || asText(payload.id)
    || 'ismeretlen payload';
}

function emitPhoenixDegraded(message: string, service: string): void {
  phoenixEventBus.publish('phoenix:degraded', {
    level: 'partial',
    services: [service],
    message,
    timestamp: new Date().toISOString(),
  });
}

async function onToolAfter(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  if (payload.success === false) {
    return;
  }

  captureToolRunCandidates(1);
}

async function onEmailClassified(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  const triage = asRecord(payload.triage);
  const classification = asText(payload.classification) || asText(triage.classification);
  const subject = asText(payload.subject) || asText(triage.subject);
  const from = asText(payload.from) || asText(triage.from);
  const hookContext = {
    hookEvent: context.event,
    hookSource: 'builtin-hooks',
    emailClassification: classification,
    payload,
  };

  if (classification === 'invoice') {
    await fireHook('invoice:received', payload, {
      source: 'builtin-hooks',
      metadata: { triggeredBy: context.event, emailFrom: from || 'unknown' },
    });
    return;
  }

  if (classification === 'meeting_request') {
    await delegateToAvailableAgent(
      ['ProjectMaintainer', 'Orchestrator'],
      `Koordinalj valaszt a kovetkezo meeting keresre: ${subject || payloadSummary(payload)}`,
      hookContext,
    );
    return;
  }

  if (classification === 'urgent') {
    const summary = subject || payloadSummary(payload);
    await delegateToAvailableAgent(
      ['Orchestrator', 'ProjectMaintainer'],
      `Kezeld priorizaltan a kovetkezo surgos emailt: ${summary}`,
      hookContext,
    );

    const combinedText = `${subject} ${asText(payload.emailBody)}`.toLowerCase();
    if (combinedText.includes('complaint') || combinedText.includes('panasz')) {
      await fireHook('email:sentiment:negative', payload, {
        source: 'builtin-hooks',
        metadata: { triggeredBy: context.event },
      });
    }
  }
}

async function onInvoiceReceived(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  const summary = payloadSummary(payload);

  await delegateToAvailableAgent(
    ['InvoiceAutomation', 'OCRAgent'],
    `Dolgozd fel az uj szamla bejovetelt: ${summary}`,
    {
      hookEvent: context.event,
      hookSource: 'builtin-hooks',
      payload,
    },
  );
}

async function onCrmLeadCreated(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  if (payload.eventType === 'deduped') {
    return;
  }

  const lead = asRecord(payload.lead);
  const leadSummary = asText(lead.company) || asText(lead.id) || payloadSummary(payload);

  await delegateToAvailableAgent(
    ['SalesHunter', 'sales_hunter'],
    `Pontozd es keszits kovetesi tervet a kovetkezo leadhez: ${leadSummary}`,
    {
      hookEvent: context.event,
      hookSource: 'builtin-hooks',
      payload,
    },
  );
}

async function onHrLeaveRequested(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  const summary = asText(payload.jobId) || payloadSummary(payload);

  await delegateToAvailableAgent(
    ['DigitalHeadhunter'],
    `Vizsgald meg a szabadsagigenyt es keszits kovetesi lepest: ${summary}`,
    {
      hookEvent: context.event,
      hookSource: 'builtin-hooks',
      payload,
    },
  );
}

async function onLlmProviderFailed(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  emitPhoenixDegraded(
    `LLM provider kiesett: ${asText(payload.provider) || 'ismeretlen provider'}`,
    'llm',
  );
}

async function onLlmProviderRestored(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  phoenixEventBus.publish('phoenix:recovery', {
    type: 'failover',
    agent: asText(payload.provider) || 'unknown-llm-provider',
    details: `LLM provider helyreallt: ${asText(payload.provider) || 'unknown'}`,
    timestamp: new Date().toISOString(),
  });
}

async function onSecurityPermissionDenied(context: HookDispatchContext): Promise<void> {
  const payload = asRecord(context.payload);
  const agentName = asText(payload.agentName) || 'unknown-agent';
  const target = asText(payload.toolName) || asText(payload.filePath) || asText(payload.operation) || 'unknown-operation';
  emitPhoenixDegraded(`Tiltott muvelet: ${agentName} -> ${target}`, 'security');
}

export function initializeBuiltinHooks(): void {
  if (initialized) {
    return;
  }

  registerHookCatalogEntries(BUILTIN_HOOK_CATALOG);
  registerAdvancedHooks();
  startHookDlqProcessor();

  registerHook('tool:after', onToolAfter, {
    category: 'learning',
    description: 'Sikeres tool futasok curated golden capture hookja',
    handlerName: 'builtin-tool-after-capture',
    priority: 8,
    timeoutMs: 10_000,
    retryOnFail: true,
  });

  registerHook('email:classified', onEmailClassified, {
    category: 'business',
    description: 'Email triage utani automatikus routing',
    handlerName: 'builtin-email-router',
    priority: 9,
    timeoutMs: 10_000,
    retryOnFail: true,
  });

  registerHook('invoice:received', onInvoiceReceived, {
    category: 'business',
    description: 'Bejovo szamla tovabbitasa az invoice pipeline fele',
    handlerName: 'builtin-invoice-router',
    priority: 10,
    timeoutMs: 15_000,
    retryOnFail: true,
  });

  registerHook('crm:lead:created', onCrmLeadCreated, {
    category: 'business',
    description: 'UJ leadek tovabbitasa sales scoring es follow-up fele',
    handlerName: 'builtin-crm-lead-router',
    priority: 9,
    timeoutMs: 10_000,
    retryOnFail: true,
  });

  registerHook('hr:leave:requested', onHrLeaveRequested, {
    category: 'business',
    description: 'HR szabadsagigenyek tovabbitasa DigitalHeadhunter fele',
    handlerName: 'builtin-hr-leave-router',
    priority: 8,
    timeoutMs: 10_000,
    retryOnFail: true,
  });

  registerHook('llm:provider:failed', onLlmProviderFailed, {
    category: 'infra',
    description: 'Phoenix degraded jelzes LLM provider kieseskor',
    handlerName: 'builtin-llm-provider-failed',
    priority: 9,
    timeoutMs: 5_000,
    retryOnFail: false,
  });

  registerHook('llm:provider:restored', onLlmProviderRestored, {
    category: 'infra',
    description: 'Phoenix recovery jelzes LLM provider helyreallaskor',
    handlerName: 'builtin-llm-provider-restored',
    priority: 7,
    timeoutMs: 5_000,
    retryOnFail: false,
  });

  registerHook('security:permission:denied', onSecurityPermissionDenied, {
    category: 'security',
    description: 'RBAC tiltott muveletek Phoenix degraded jelzese',
    handlerName: 'builtin-security-permission-denied',
    priority: 10,
    timeoutMs: 5_000,
    retryOnFail: false,
  });

  initialized = true;
  logInfo('BuiltinHooks', `Initialized ${BUILTIN_HOOK_CATALOG.length} hook catalog entries`);
}

export function resetBuiltinHooksForTests(): void {
  initialized = false;
  stopHookDlqProcessor();
}
