/**
 * intentRouter.ts — Kernel Intent Router
 * Consolidates intent recognition from universalOrchestratorService and voicePipeline.
 * Lightweight facade: keyword matching → IntentResult + TaskContract.
 */

import type { RunEnvelope, IntentResult, TaskContract, ModuleResponse } from './kernelTypes.js';
import { moduleOk, moduleErr } from './kernelTypes.js';
import { emitIntentResolved } from './kernelEventBus.js';
import { logInfo, logError } from '../utils/logger.js';

// ── Domain / intent classification ──────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high';

interface IntentProfile {
  intent: string;
  domain: string;
  requiredCapabilities: string[];
  definitionOfDone: string[];
  approvalRequired: boolean;
}

const KEYWORD_MAP: Array<{ patterns: string[]; profile: IntentProfile }> = [
  {
    patterns: ['napi', 'briefing', 'riport', 'összefoglaló'],
    profile: {
      intent: 'daily_briefing',
      domain: 'operations',
      requiredCapabilities: ['calendar_read', 'email_read', 'task_read'],
      definitionOfDone: [
        'Calendar events for today fetched',
        'Top open tasks summarised',
        'Email digest produced',
        'Briefing report drafted',
      ],
      approvalRequired: false,
    },
  },
  {
    patterns: ['kód', 'code', 'fejleszt', 'implement'],
    profile: {
      intent: 'code_task',
      domain: 'engineering',
      requiredCapabilities: ['code_write', 'test_run', 'git_commit'],
      definitionOfDone: [
        'Requirements understood',
        'Implementation complete',
        'Tests pass',
        'Code reviewed',
      ],
      approvalRequired: false,
    },
  },
  {
    patterns: ['kutat', 'research', 'keress', 'find'],
    profile: {
      intent: 'research_task',
      domain: 'research',
      requiredCapabilities: ['web_search', 'rag_retrieval'],
      definitionOfDone: [
        'Sources searched',
        'Findings summarised',
        'Key points extracted',
      ],
      approvalRequired: false,
    },
  },
  {
    patterns: ['email', 'levél', 'üzenet'],
    profile: {
      intent: 'communication_task',
      domain: 'communication',
      requiredCapabilities: ['email_write', 'guardrail_check'],
      definitionOfDone: [
        'Message drafted',
        'Tone reviewed',
        'Guardrail check passed',
        'Message sent or queued',
      ],
      approvalRequired: true,
    },
  },
  {
    patterns: ['feladat', 'task', 'linear', 'jira'],
    profile: {
      intent: 'task_management',
      domain: 'ops',
      requiredCapabilities: ['task_read', 'task_write'],
      definitionOfDone: [
        'Tasks fetched',
        'Status updated',
        'Assignees notified',
      ],
      approvalRequired: false,
    },
  },
];

const DEFAULT_PROFILE: IntentProfile = {
  intent: 'general_task',
  domain: 'general',
  requiredCapabilities: ['tool_executor'],
  definitionOfDone: ['Goal analysed', 'Primary action executed', 'Output reviewed'],
  approvalRequired: false,
};

function matchProfile(text: string): IntentProfile {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.profile;
    }
  }
  return DEFAULT_PROFILE;
}

function detectRisk(text: string, fallback: RiskLevel): RiskLevel {
  const lower = text.toLowerCase();
  const HIGH = ['töröl', 'delete', 'push', 'deploy', 'éles'];
  const MED  = ['külső', 'email', 'send', 'pénz', 'finance'];
  if (HIGH.some((k) => lower.includes(k))) return 'high';
  if (MED.some((k)  => lower.includes(k))) return 'medium';
  return fallback;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function routeIntent(
  envelope: RunEnvelope,
): Promise<ModuleResponse<IntentResult>> {
  const startMs = Date.now();
  try {
    const combined = `${envelope.goal} ${envelope.taskType}`;
    const profile  = matchProfile(combined);
    const risk     = detectRisk(combined, envelope.riskLevel);

    const taskContract: TaskContract = {
      definitionOfDone:     profile.definitionOfDone,
      approvalRequired:     profile.approvalRequired,
      requiredCapabilities: profile.requiredCapabilities,
    };

    const result: IntentResult = {
      intent:               profile.intent,
      domain:               profile.domain,
      riskLevel:            risk,
      requiredCapabilities: profile.requiredCapabilities,
      taskContract,
    };

    const latencyMs = Date.now() - startMs;
    emitIntentResolved(envelope.runId, result, latencyMs);
    logInfo('IntentRouter', `${envelope.runId} → intent=${result.intent} risk=${risk} (${latencyMs}ms)`);

    return moduleOk<IntentResult>('intent_router', envelope.runId, 'intent_routing', result, {
      nextActions: ['planner'],
      decisions:   [`Matched intent '${result.intent}' in domain '${result.domain}'`],
      metrics:     { latencyMs, tokensIn: 0, tokensOut: 0 },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('IntentRouter', msg);
    return moduleErr<IntentResult>('intent_router', envelope.runId, 'intent_routing', msg);
  }
}

export class IntentRouter {
  async route(envelope: RunEnvelope): Promise<ModuleResponse<IntentResult>> {
    return routeIntent(envelope);
  }
}
