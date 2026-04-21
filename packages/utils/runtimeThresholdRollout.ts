import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  NodeRuntimeRecommendationBudget,
  PythonRuntimeRecommendationBudget,
  RuntimeRecommendationAction,
  RuntimeRecommendationConfidence,
  RuntimeTuningRecommendation,
} from './runtimeDriftMonitor.js';
import type { RuntimeThresholdRolloutJournalSummary } from './globalDb.js';

export interface RuntimeDriftThresholdSummary {
  overallState?: string;
  sampleCount?: number;
  windowMinutes?: number;
  lastSampleAt?: string | null;
  recommendation?: {
    overallAction?: RuntimeRecommendationAction | string;
    confidence?: string;
    rationale?: string;
    signals?: string[];
    node?: {
      action?: RuntimeRecommendationAction | string;
      rationale?: string;
      current?: {
        heapMb?: number | null;
        runtimeLimitMb?: number | null;
        restartThresholdMb?: number | null;
      };
      suggested?: {
        heapMb?: number | null;
        runtimeLimitMb?: number | null;
        restartThresholdMb?: number | null;
      };
    };
    python?: {
      action?: RuntimeRecommendationAction | string;
      rationale?: string;
      current?: {
        memoryLimitMb?: number | null;
      };
      suggested?: {
        memoryLimitMb?: number | null;
      };
    };
  };
  node?: {
    restartCount?: number;
    driftCount?: number;
  };
  python?: {
    status?: string;
    restartCount?: number;
    unavailableCount?: number;
  };
}

export interface ThresholdRolloutApprovalMetadata {
  approvedBy?: string;
  approvalTicket?: string;
  approvedAt?: string;
  changeWindow?: string;
  notes?: string;
}

export interface ThresholdRolloutRenderResult {
  renderedPlan: string;
  approved: boolean;
  canRenderRollout: boolean;
  missingApprovalFields: string[];
}

export interface RuntimeThresholdRolloutHealthPayload {
  summary: RuntimeDriftThresholdSummary;
  rollout: ThresholdRolloutPlan | null;
  latestJournalEntry: RuntimeThresholdRolloutJournalSummary | null;
}

export interface ManagedRuntimeContract {
  configuredHeapMb: number;
  runtimeMemoryLimitMb: number;
  restartThresholdMb: number;
  pythonMemoryLimitMb: number;
  contractFile?: string;
}

export interface ThresholdRolloutPlan {
  overallAction: RuntimeRecommendationAction;
  confidence: RuntimeRecommendationConfidence | 'unknown';
  rationale: string;
  current: ManagedRuntimeContract;
  proposed: ManagedRuntimeContract;
  approvalRequired: boolean;
  canApply: boolean;
  applyReadOnlyReason: string | null;
  changes: string[];
  warnings: string[];
  managedFiles: string[];
}

const DEFAULT_CONTRACT_RELATIVE_PATH = path.join('config', 'runtime-threshold-contract.env');
const DEFAULT_NODE_STEP_LIMIT_MB = 512;
const DEFAULT_PYTHON_STEP_LIMIT_MB = 256;

function formatMaybe(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'n/a';
  }

  return String(value);
}

function formatMaybeMb(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value} MB` : 'n/a';
}

function formatSignals(signals: string[] | undefined): string {
  return signals && signals.length > 0 ? signals.join(', ') : 'n/a';
}

function selectNumber(
  preferred: number | null | undefined,
  fallback: number | null | undefined,
  defaultValue: number,
): number {
  if (typeof preferred === 'number') {
    return preferred;
  }

  if (typeof fallback === 'number') {
    return fallback;
  }

  return defaultValue;
}

function isRolloutAction(action: string | undefined): action is 'align' | 'tune' {
  return action === 'align' || action === 'tune';
}

function isRuntimeRecommendationActionValue(
  action: string | undefined,
): action is RuntimeRecommendationAction {
  return action === 'keep' || action === 'observe' || action === 'align' || action === 'tune';
}

function normalizeRecommendationConfidence(
  confidence: string | undefined,
): RuntimeRecommendationConfidence {
  return confidence === 'low' || confidence === 'medium' || confidence === 'high'
    ? confidence
    : 'low';
}

function normalizeNodeBudget(
  budget:
    | {
        heapMb?: number | null;
        runtimeLimitMb?: number | null;
        restartThresholdMb?: number | null;
      }
    | undefined,
): NodeRuntimeRecommendationBudget {
  return {
    heapMb: typeof budget?.heapMb === 'number' ? budget.heapMb : null,
    runtimeLimitMb: typeof budget?.runtimeLimitMb === 'number' ? budget.runtimeLimitMb : null,
    restartThresholdMb:
      typeof budget?.restartThresholdMb === 'number' ? budget.restartThresholdMb : null,
  };
}

function normalizePythonBudget(
  budget:
    | {
        memoryLimitMb?: number | null;
      }
    | undefined,
): PythonRuntimeRecommendationBudget {
  return {
    memoryLimitMb: typeof budget?.memoryLimitMb === 'number' ? budget.memoryLimitMb : null,
  };
}

function resolveApprovalGate(
  metadata: ThresholdRolloutApprovalMetadata,
): { approved: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!metadata.approvedBy?.trim()) {
    missingFields.push('--approved-by');
  }
  if (!metadata.approvalTicket?.trim()) {
    missingFields.push('--approval-ticket');
  }
  if (!metadata.approvedAt?.trim()) {
    missingFields.push('--approved-at');
  }
  if (!metadata.changeWindow?.trim()) {
    missingFields.push('--change-window');
  }

  return {
    approved: missingFields.length === 0,
    missingFields,
  };
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  }

  return result;
}

function resolveTargetContract(summary: RuntimeDriftThresholdSummary): ManagedRuntimeContract {
  return {
    configuredHeapMb: selectNumber(
      summary.recommendation?.node?.suggested?.heapMb,
      summary.recommendation?.node?.current?.heapMb,
      1536,
    ),
    runtimeMemoryLimitMb: selectNumber(
      summary.recommendation?.node?.suggested?.runtimeLimitMb,
      summary.recommendation?.node?.current?.runtimeLimitMb,
      2048,
    ),
    restartThresholdMb: selectNumber(
      summary.recommendation?.node?.suggested?.restartThresholdMb,
      summary.recommendation?.node?.current?.restartThresholdMb,
      1792,
    ),
    pythonMemoryLimitMb: selectNumber(
      summary.recommendation?.python?.suggested?.memoryLimitMb,
      summary.recommendation?.python?.current?.memoryLimitMb,
      1024,
    ),
    contractFile: DEFAULT_CONTRACT_RELATIVE_PATH,
  };
}

function resolveRollbackContract(summary: RuntimeDriftThresholdSummary): ManagedRuntimeContract {
  return {
    configuredHeapMb: selectNumber(summary.recommendation?.node?.current?.heapMb, undefined, 1536),
    runtimeMemoryLimitMb: selectNumber(
      summary.recommendation?.node?.current?.runtimeLimitMb,
      undefined,
      2048,
    ),
    restartThresholdMb: selectNumber(
      summary.recommendation?.node?.current?.restartThresholdMb,
      undefined,
      1792,
    ),
    pythonMemoryLimitMb: selectNumber(
      summary.recommendation?.python?.current?.memoryLimitMb,
      undefined,
      1024,
    ),
    contractFile: DEFAULT_CONTRACT_RELATIVE_PATH,
  };
}

function buildProposedContract(
  recommendation: RuntimeTuningRecommendation,
  current: ManagedRuntimeContract,
): ManagedRuntimeContract {
  return {
    configuredHeapMb:
      recommendation.node.action === 'align' || recommendation.node.action === 'tune'
        ? selectNumber(
            recommendation.node.suggested.heapMb,
            current.configuredHeapMb,
            current.configuredHeapMb,
          )
        : current.configuredHeapMb,
    runtimeMemoryLimitMb:
      recommendation.node.action === 'align' || recommendation.node.action === 'tune'
        ? selectNumber(
            recommendation.node.suggested.runtimeLimitMb,
            current.runtimeMemoryLimitMb,
            current.runtimeMemoryLimitMb,
          )
        : current.runtimeMemoryLimitMb,
    restartThresholdMb:
      recommendation.node.action === 'align' || recommendation.node.action === 'tune'
        ? selectNumber(
            recommendation.node.suggested.restartThresholdMb,
            current.restartThresholdMb,
            current.restartThresholdMb,
          )
        : current.restartThresholdMb,
    pythonMemoryLimitMb:
      recommendation.python.action === 'align' || recommendation.python.action === 'tune'
        ? selectNumber(
            recommendation.python.suggested.memoryLimitMb,
            current.pythonMemoryLimitMb,
            current.pythonMemoryLimitMb,
          )
        : current.pythonMemoryLimitMb,
    contractFile: current.contractFile ?? DEFAULT_CONTRACT_RELATIVE_PATH,
  };
}

function buildChanges(current: ManagedRuntimeContract, proposed: ManagedRuntimeContract): string[] {
  const changes: string[] = [];

  if (current.configuredHeapMb !== proposed.configuredHeapMb) {
    changes.push(`Node heap ${current.configuredHeapMb}MB -> ${proposed.configuredHeapMb}MB`);
  }
  if (current.runtimeMemoryLimitMb !== proposed.runtimeMemoryLimitMb) {
    changes.push(
      `Runtime limit ${current.runtimeMemoryLimitMb}MB -> ${proposed.runtimeMemoryLimitMb}MB`,
    );
  }
  if (current.restartThresholdMb !== proposed.restartThresholdMb) {
    changes.push(
      `Restart threshold ${current.restartThresholdMb}MB -> ${proposed.restartThresholdMb}MB`,
    );
  }
  if (current.pythonMemoryLimitMb !== proposed.pythonMemoryLimitMb) {
    changes.push(
      `Python limit ${current.pythonMemoryLimitMb}MB -> ${proposed.pythonMemoryLimitMb}MB`,
    );
  }

  return changes;
}

function renderEnvContract(title: string, contract: ManagedRuntimeContract): string[] {
  return [
    title,
    `  BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=${contract.configuredHeapMb}`,
    `  BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=${contract.runtimeMemoryLimitMb}`,
    `  BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=${contract.restartThresholdMb}`,
    `  BRUNELLA_PYTHON_MEMORY_LIMIT_MB=${contract.pythonMemoryLimitMb}`,
  ];
}

function renderWindowsPlan(_contract: ManagedRuntimeContract): string[] {
  return [
    'Windows services (read-only operator plan)',
    `  Update ${DEFAULT_CONTRACT_RELATIVE_PATH} with the approved values below, then reinstall the Windows services.`,
    '  npm run services:install:windows',
    '  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\supervisors\\windows\\status-windows-services.ps1',
  ];
}

function renderSystemdPlan(_contract: ManagedRuntimeContract): string[] {
  return [
    'systemd contract rollout (read-only operator plan)',
    `  Update ${DEFAULT_CONTRACT_RELATIVE_PATH} with the approved values below, then reinstall the systemd services.`,
    '  npm run services:install:linux',
    '  systemctl status brunella-python.service brunella-core.service --no-pager',
  ];
}

function renderComposePlan(_contract: ManagedRuntimeContract): string[] {
  const contractPath = `./${DEFAULT_CONTRACT_RELATIVE_PATH.replace(/\\/g, '/')}`;
  return [
    'Docker Compose snippet (docker-compose.prod.yml)',
    `  env_file: ${contractPath}`,
    `  docker compose --env-file ${contractPath} -f docker-compose.prod.yml up -d --force-recreate`,
  ];
}

function renderPm2Plan(_contract: ManagedRuntimeContract): string[] {
  return [
    'PM2 env/update plan',
    `  export BRUNELLA_RUNTIME_THRESHOLD_CONTRACT_FILE=${DEFAULT_CONTRACT_RELATIVE_PATH}`,
    '  pm2 start ecosystem.config.cjs --only brunella-backend --update-env',
  ];
}

function renderRollbackPlan(contract: ManagedRuntimeContract): string[] {
  return [
    'Rollback instructions',
    `  BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=${contract.configuredHeapMb}`,
    `  BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=${contract.runtimeMemoryLimitMb}`,
    `  BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=${contract.restartThresholdMb}`,
    `  BRUNELLA_PYTHON_MEMORY_LIMIT_MB=${contract.pythonMemoryLimitMb}`,
    '  Verify local /api/health/live and /api/health/runtime-drift before any external traffic changes.',
    '  Keep Cloudflare external to local liveness and rollback decisions.',
  ];
}

export function renderThresholdRolloutPlan(
  summary: RuntimeDriftThresholdSummary,
  metadata: ThresholdRolloutApprovalMetadata,
): ThresholdRolloutRenderResult {
  const approval = resolveApprovalGate(metadata);
  const overallAction = summary.recommendation?.overallAction;
  const canRenderRollout = isRolloutAction(overallAction);
  const target = resolveTargetContract(summary);
  const rollback = resolveRollbackContract(summary);

  const lines = [
    'Runtime threshold rollout planning (read-only)',
    `  Recommendation action: ${formatMaybe(overallAction)}`,
    `  Confidence:            ${formatMaybe(summary.recommendation?.confidence)}`,
    `  Runtime state:         ${formatMaybe(summary.overallState)}`,
    `  Samples:               ${formatMaybe(summary.sampleCount)}`,
    `  Window minutes:        ${formatMaybe(summary.windowMinutes)}`,
    `  Last sample:           ${formatMaybe(summary.lastSampleAt)}`,
    `  Signals:               ${formatSignals(summary.recommendation?.signals)}`,
    '',
    'Approval gate',
    `  Status:                ${approval.approved ? 'approved' : 'blocked'}`,
    `  Approved by:           ${formatMaybe(metadata.approvedBy)}`,
    `  Approval ticket:       ${formatMaybe(metadata.approvalTicket)}`,
    `  Approved at:           ${formatMaybe(metadata.approvedAt)}`,
    `  Change window:         ${formatMaybe(metadata.changeWindow)}`,
    `  Notes:                 ${formatMaybe(metadata.notes)}`,
  ];

  if (!approval.approved) {
    lines.push(`  Missing metadata:      ${approval.missingFields.join(', ')}`);
  }

  lines.push(
    '',
    'Recommendation snapshot',
    `  Node action:           ${formatMaybe(summary.recommendation?.node?.action)}`,
    `  Node rationale:        ${formatMaybe(summary.recommendation?.node?.rationale)}`,
    `  Node target heap:      ${formatMaybeMb(target.configuredHeapMb)}`,
    `  Node target runtime:   ${formatMaybeMb(target.runtimeMemoryLimitMb)}`,
    `  Node target restart:   ${formatMaybeMb(target.restartThresholdMb)}`,
    `  Python action:         ${formatMaybe(summary.recommendation?.python?.action)}`,
    `  Python rationale:      ${formatMaybe(summary.recommendation?.python?.rationale)}`,
    `  Python target limit:   ${formatMaybeMb(target.pythonMemoryLimitMb)}`,
    `  Overall rationale:     ${formatMaybe(summary.recommendation?.rationale)}`,
    '',
    'Safety notes',
    '  - This workflow is render-only. It does not edit configs, apply env changes, or restart services.',
    '  - Cloudflare remains external to local liveness, rollout approval, and rollback decisions.',
  );

  if (!canRenderRollout) {
    lines.push(
      '',
      'No rollout plan rendered because the current recommendation is not align/tune.',
      'Continue collecting stable samples before changing supervisor env contracts.',
    );
  } else if (!approval.approved) {
    lines.push(
      '',
      'No rollout plan rendered until explicit operator approval metadata is complete.',
      'Re-run this command with --approved-by, --approval-ticket, --approved-at, and --change-window.',
    );
  } else {
    lines.push(
      '',
      ...renderEnvContract('Target stable env contract', target),
      '',
      ...renderWindowsPlan(target),
      '',
      ...renderSystemdPlan(target),
      '',
      ...renderComposePlan(target),
      '',
      ...renderPm2Plan(target),
      '',
      ...renderRollbackPlan(rollback),
    );
  }

  return {
    renderedPlan: lines.join('\n'),
    approved: approval.approved,
    canRenderRollout,
    missingApprovalFields: approval.missingFields,
  };
}

export function extractRuntimeTuningRecommendation(
  summary: RuntimeDriftThresholdSummary,
): RuntimeTuningRecommendation | null {
  const recommendation = summary.recommendation;

  if (
    !recommendation ||
    !isRuntimeRecommendationActionValue(recommendation.overallAction) ||
    !isRuntimeRecommendationActionValue(recommendation.node?.action) ||
    !isRuntimeRecommendationActionValue(recommendation.python?.action)
  ) {
    return null;
  }

  return {
    overallAction: recommendation.overallAction,
    confidence: normalizeRecommendationConfidence(recommendation.confidence),
    rationale: recommendation.rationale ?? 'No rationale provided.',
    signals: recommendation.signals ?? [],
    node: {
      action: recommendation.node.action,
      rationale: recommendation.node.rationale ?? 'No node rationale provided.',
      current: normalizeNodeBudget(recommendation.node.current),
      suggested: normalizeNodeBudget(recommendation.node.suggested),
    },
    python: {
      action: recommendation.python.action,
      rationale: recommendation.python.rationale ?? 'No python rationale provided.',
      current: normalizePythonBudget(recommendation.python.current),
      suggested: normalizePythonBudget(recommendation.python.suggested),
    },
  };
}

export function readRepoRuntimeContract(repoRoot: string): ManagedRuntimeContract {
  const contractFile = path.join(repoRoot, DEFAULT_CONTRACT_RELATIVE_PATH);
  const raw = existsSync(contractFile) ? parseEnvFile(readFileSync(contractFile, 'utf8')) : {};

  return {
    configuredHeapMb: selectNumber(
      raw.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE ? Number(raw.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE) : null,
      undefined,
      1536,
    ),
    runtimeMemoryLimitMb: selectNumber(
      raw.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB ? Number(raw.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB) : null,
      undefined,
      2048,
    ),
    restartThresholdMb: selectNumber(
      raw.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB
        ? Number(raw.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB)
        : null,
      undefined,
      1792,
    ),
    pythonMemoryLimitMb: selectNumber(
      raw.BRUNELLA_PYTHON_MEMORY_LIMIT_MB ? Number(raw.BRUNELLA_PYTHON_MEMORY_LIMIT_MB) : null,
      undefined,
      1024,
    ),
    contractFile,
  };
}

export function buildThresholdRolloutPlan(
  recommendation: RuntimeTuningRecommendation,
  current: ManagedRuntimeContract,
): ThresholdRolloutPlan {
  const proposed = buildProposedContract(recommendation, current);
  const changes = buildChanges(current, proposed);
  const warnings: string[] = [];
  let canApply = changes.length > 0;
  let applyReadOnlyReason: string | null = null;

  const hasDecrease =
    proposed.configuredHeapMb < current.configuredHeapMb ||
    proposed.runtimeMemoryLimitMb < current.runtimeMemoryLimitMb ||
    proposed.restartThresholdMb < current.restartThresholdMb ||
    proposed.pythonMemoryLimitMb < current.pythonMemoryLimitMb;

  if (recommendation.overallAction === 'keep' || recommendation.overallAction === 'observe') {
    canApply = false;
    applyReadOnlyReason =
      'Only align/tune recommendations are eligible for explicit approval rollout.';
  }

  if (changes.length === 0) {
    canApply = false;
    applyReadOnlyReason = 'Managed contract already matches the recommended values.';
  }

  if (recommendation.confidence === 'low') {
    canApply = false;
    applyReadOnlyReason =
      'Low-confidence recommendations stay read-only until more stable samples are collected.';
  }

  if (hasDecrease) {
    canApply = false;
    applyReadOnlyReason =
      'Automatic rollout only supports budget increases or holds; decreases require manual review.';
    warnings.push(
      'The recommendation would reduce one or more budgets, so this workflow remains render-only.',
    );
  }

  if (proposed.configuredHeapMb - current.configuredHeapMb > DEFAULT_NODE_STEP_LIMIT_MB) {
    canApply = false;
    applyReadOnlyReason = 'Node heap increase exceeds the guarded 512MB rollout step limit.';
    warnings.push('Node heap increase is larger than the guarded rollout step limit.');
  }

  if (proposed.pythonMemoryLimitMb - current.pythonMemoryLimitMb > DEFAULT_PYTHON_STEP_LIMIT_MB) {
    canApply = false;
    applyReadOnlyReason = 'Python memory increase exceeds the guarded 256MB rollout step limit.';
    warnings.push('Python memory increase is larger than the guarded rollout step limit.');
  }

  return {
    overallAction: recommendation.overallAction,
    confidence: recommendation.confidence ?? 'unknown',
    rationale: recommendation.rationale,
    current,
    proposed,
    approvalRequired: changes.length > 0,
    canApply,
    applyReadOnlyReason,
    changes,
    warnings,
    managedFiles: [DEFAULT_CONTRACT_RELATIVE_PATH],
  };
}
