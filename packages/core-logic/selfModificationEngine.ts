import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import toml from 'toml';
import { approvalRouter } from './approvalRouter.js';
import { ReflectionEngine } from './reflectionEngine.js';
import { generateResponse } from './llm_client.js';
import {
  agentPerformanceTracker,
  type AgentPerformanceOverview,
  type AgentPerformanceStats,
  type WeakAgentCandidate,
} from './agentPerformanceTracker.js';
import {
  sandboxManager,
  type SandboxEvaluationResult,
} from './sandboxManager.js';
import { trackStateManager } from '@packages/core-logic/trackStateManager.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { getGlobalDb } from '@packages/utils/globalDb.js';
import { normalizeTrackDod } from '@packages/utils/trackDod.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import type Database from 'better-sqlite3';
import type { EventEnvelope } from './eventFabric.js';

const DEFAULT_SUCCESS_THRESHOLD = 0.7;
const DEFAULT_DURATION_THRESHOLD_MS = 30_000;
const DEFAULT_MIN_RUNS = 3;
const DEFAULT_APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;
const PROPOSAL_ACTIVE_STATUSES = [
  'pending_review',
  'approved',
  'applying',
] as const;

export type SelfModificationProposalStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'failed'
  | 'applying';

export const PROTECTED_AGENTS = [
  'Orchestrator',
  'OrchestratorAgent',
  'Evaluator',
  'EvaluatorAgent',
  'Developer',
  'DeveloperAgent',
];

export interface SelfModificationProposal {
  id: string;
  agentName: string;
  tomlPath: string;
  status: SelfModificationProposalStatus;
  weaknessSummary: string;
  weaknessReasons: string[];
  rationale: string;
  originalToml: string;
  proposedToml: string;
  diff: string;
  testInputs: string[];
  improvement: SandboxEvaluationResult;
  approvalWorkflowId?: string;
  approvalRequestId?: string;
  reviewer?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  appliedAt?: string;
  trackId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelfModificationOverview {
  summary: AgentPerformanceOverview;
  weakAgents: WeakAgentCandidate[];
  proposals: SelfModificationProposal[];
  activeProposal?: SelfModificationProposal;
  protectedAgents: string[];
}

export interface SelfModificationCycleResult {
  triggeredAt: string;
  weakAgents: WeakAgentCandidate[];
  skippedReason?: string;
  createdProposalId?: string;
  targetAgent?: string;
}

interface ImproveAgentOptions {
  days?: number;
  successThreshold?: number;
  durationThresholdMs?: number;
  minRuns?: number;
  timeoutMs?: number;
  force?: boolean;
  triggeredBy?: string;
}

interface ProposalReviewInput {
  reviewer?: string;
  notes?: string;
}

interface RetestProposalInput extends ProposalReviewInput {
  proposedToml?: string;
  timeoutMs?: number;
}

interface GeneratedImprovement {
  rationale: string;
  proposedToml: string;
  generatedBy: string;
}

interface DynamicRegistryEntry {
  name: string;
  class?: string;
  module?: string;
  config?: {
    tomlPath?: string;
  };
}

interface AnalyzedAgent {
  agentName: string;
  tomlPath: string;
  currentToml: string;
  stats: AgentPerformanceStats;
  weaknessSummary: string;
  weaknessReasons: string[];
  testInputs: string[];
}

interface ProposalRow {
  id: string;
  agent_name: string;
  toml_path: string;
  status: SelfModificationProposalStatus;
  weakness_summary: string;
  weakness_reasons_json: string;
  rationale: string;
  original_toml: string;
  proposed_toml: string;
  diff: string;
  test_inputs_json: string;
  sandbox_result_json: string;
  approval_workflow_id: string | null;
  approval_request_id: string | null;
  reviewer: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  track_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

function isActiveProposalStatus(status: SelfModificationProposalStatus): boolean {
  return (PROPOSAL_ACTIVE_STATUSES as readonly string[]).includes(status);
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    return [];
  }

  return [];
}

function parseSandboxResult(value: string): SandboxEvaluationResult {
  return JSON.parse(value) as SandboxEvaluationResult;
}

function extractTomlFence(value: string): string | null {
  const fenced = value.match(/```toml\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return null;
}

function extractRationale(value: string): string {
  const rationaleMatch = value.match(/RATIONALE:\s*([\s\S]*?)(```toml|$)/i);
  if (rationaleMatch?.[1]) {
    return rationaleMatch[1].trim();
  }

  return value.trim();
}

function extractJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    const fenced = value.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return extractJsonStringArray(fenced[1]);
    }
  }

  return [];
}

function buildUnifiedDiff(originalToml: string, proposedToml: string): string {
  if (originalToml === proposedToml) {
    return '--- current\n+++ proposed\n';
  }

  const originalLines = originalToml.split(/\r?\n/);
  const proposedLines = proposedToml.split(/\r?\n/);
  const sharedLineCount = Math.min(originalLines.length, proposedLines.length);
  let firstDiff = 0;

  while (firstDiff < sharedLineCount && originalLines[firstDiff] === proposedLines[firstDiff]) {
    firstDiff += 1;
  }

  let originalTail = originalLines.length - 1;
  let proposedTail = proposedLines.length - 1;
  while (
    originalTail >= firstDiff
    && proposedTail >= firstDiff
    && originalLines[originalTail] === proposedLines[proposedTail]
  ) {
    originalTail -= 1;
    proposedTail -= 1;
  }

  const contextStart = Math.max(0, firstDiff - 2);
  const contextEnd = Math.min(originalLines.length, originalTail + 3);
  const header = `--- current\n+++ proposed\n@@ -${firstDiff + 1},${Math.max(0, originalTail - firstDiff + 1)} +${firstDiff + 1},${Math.max(0, proposedTail - firstDiff + 1)} @@`;
  const body: string[] = [];

  for (let index = contextStart; index < firstDiff; index += 1) {
    body.push(` ${originalLines[index]}`);
  }

  for (let index = firstDiff; index <= originalTail; index += 1) {
    body.push(`-${originalLines[index]}`);
  }

  for (let index = firstDiff; index <= proposedTail; index += 1) {
    body.push(`+${proposedLines[index]}`);
  }

  for (let index = originalTail + 1; index < contextEnd; index += 1) {
    body.push(` ${originalLines[index]}`);
  }

  return `${header}\n${body.join('\n')}`;
}

function replaceOrAppendScalar(originalToml: string, key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}\\s*=\\s*.*$`, 'm');
  if (pattern.test(originalToml)) {
    return originalToml.replace(pattern, `${key} = ${value}`);
  }

  return `${originalToml.trimEnd()}\n${key} = ${value}\n`;
}

function replaceOrAppendMultilineValue(originalToml: string, key: string, value: string): string {
  const block = `${key} = """\n${value.trim()}\n"""`;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const multilinePattern = new RegExp(`${escapedKey}\\s*=\\s*"""[\\s\\S]*?"""`, 'm');
  if (multilinePattern.test(originalToml)) {
    return originalToml.replace(multilinePattern, block);
  }

  const singleLinePattern = new RegExp(`^${escapedKey}\\s*=\\s*".*"$`, 'm');
  if (singleLinePattern.test(originalToml)) {
    return originalToml.replace(singleLinePattern, block);
  }

  return `${originalToml.trimEnd()}\n${block}\n`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function createSelfModificationEvent(
  proposal: SelfModificationProposal,
): EventEnvelope<{
  proposalId: string;
  agentName: string;
  improvementPercent: number;
  status: SelfModificationProposalStatus;
}> {
  return {
    id: `self-mod-${proposal.id}`,
    source: 'manual',
    type: 'self_modification.proposal.created',
    priority: 'high',
    riskHint: 'guarded',
    dedupKey: `self-mod:${proposal.id}`,
    payload: {
      proposalId: proposal.id,
      agentName: proposal.agentName,
      improvementPercent: proposal.improvement.improvementPercent,
      status: proposal.status,
    },
    timestamp: nowIso(),
    metadata: {
      proposalId: proposal.id,
      agentName: proposal.agentName,
      tomlPath: proposal.tomlPath,
    },
  };
}

function buildWeaknessSummary(
  agentName: string,
  weaknessReasons: string[],
  stats: AgentPerformanceStats,
): string {
  const summary = weaknessReasons.length > 0
    ? weaknessReasons.join(' ')
    : `${agentName} 7 napos sikeraránya ${(stats.successRate * 100).toFixed(1)}%, átlagideje ${Math.round(stats.avgDurationMs)} ms.`;
  return `${agentName} fejlesztési jelzés: ${summary}`.trim();
}

function normalizeActiveProposalError(error: unknown): Error {
  const normalized = ensureError(error);
  const message = normalized.message.toLowerCase();
  if (
    message.includes('idx_self_modification_single_active')
    || message.includes('unique constraint failed')
  ) {
    return new Error('Már van folyamatban lévő self-mod javaslat. Egyszerre csak egy agent módosítható.');
  }

  return normalized;
}

class SelfModificationEngine {
  private initialized = false;

  private getDb(): Database.Database {
    const db = getGlobalDb();
    if (!this.initialized) {
      this.ensureSchema(db);
      this.initialized = true;
    }
    return db;
  }

  private ensureSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS self_modification_proposals (
        id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        toml_path TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending_review', 'approved', 'rejected', 'applied', 'failed', 'applying')),
        weakness_summary TEXT NOT NULL,
        weakness_reasons_json TEXT NOT NULL DEFAULT '[]',
        rationale TEXT NOT NULL DEFAULT '',
        original_toml TEXT NOT NULL,
        proposed_toml TEXT NOT NULL,
        diff TEXT NOT NULL,
        test_inputs_json TEXT NOT NULL DEFAULT '[]',
        sandbox_result_json TEXT NOT NULL DEFAULT '{}',
        improvement_percent REAL NOT NULL DEFAULT 0,
        approval_workflow_id TEXT,
        approval_request_id TEXT,
        reviewer TEXT,
        review_notes TEXT,
        reviewed_at TEXT,
        applied_at TEXT,
        track_id TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_self_modification_status
        ON self_modification_proposals(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_self_modification_agent
        ON self_modification_proposals(agent_name, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_self_modification_single_active
        ON self_modification_proposals((1))
        WHERE status IN ('pending_review', 'approved', 'applying');
    `);
  }

  private async readRegistry(): Promise<DynamicRegistryEntry[]> {
    const candidates = [
      path.join(process.cwd(), 'src', 'agents', 'registry.json'),
      path.join(process.cwd(), 'build', 'agents', 'registry.json'),
    ];

    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue;
      }

      const content = await readFile(candidate, 'utf-8');
      const parsed = JSON.parse(content) as { agents?: DynamicRegistryEntry[] };
      return Array.isArray(parsed.agents) ? parsed.agents : [];
    }

    return [];
  }

  private async resolveDynamicAgent(agentName: string): Promise<{ agentName: string; tomlPath: string }> {
    if (PROTECTED_AGENTS.some((protectedName) => protectedName.toLowerCase() === agentName.toLowerCase())) {
      throw new Error(`Agent ${agentName} védett, nem módosítható.`);
    }

    const registry = await this.readRegistry();
    const entry = registry.find((item) => item.name.toLowerCase() === agentName.toLowerCase());
    const tomlPath = entry?.config?.tomlPath;
    const isDynamicAgent = entry?.class === 'DynamicAgent' || entry?.module === './agents/DynamicAgent.js';

    if (!entry || !isDynamicAgent || typeof tomlPath !== 'string' || tomlPath.trim().length === 0) {
      throw new Error(`Agent ${agentName} nem támogatott self-mod célpont. Csak TOML alapú DynamicAgent ügynökök módosíthatók.`);
    }

    return {
      agentName: entry.name,
      tomlPath: path.resolve(process.cwd(), tomlPath),
    };
  }

  private ensureNoConcurrentModification(excludeProposalId?: string): void {
    const db = this.getDb();
    const placeholders = PROPOSAL_ACTIVE_STATUSES.map(() => '?').join(', ');
    const params: string[] = [...PROPOSAL_ACTIVE_STATUSES];
    let query = `
      SELECT id
      FROM self_modification_proposals
      WHERE status IN (${placeholders})
    `;

    if (excludeProposalId) {
      query += ' AND id != ?';
      params.push(excludeProposalId);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const active = db.prepare(query).get(...params) as { id: string } | undefined;
    if (active) {
      throw new Error(`Már van folyamatban lévő self-mod javaslat (${active.id}). Egyszerre csak egy agent módosítható.`);
    }
  }

  private mapRow(row: ProposalRow): SelfModificationProposal {
    return {
      id: row.id,
      agentName: row.agent_name,
      tomlPath: row.toml_path,
      status: row.status,
      weaknessSummary: row.weakness_summary,
      weaknessReasons: parseJsonArray(row.weakness_reasons_json),
      rationale: row.rationale,
      originalToml: row.original_toml,
      proposedToml: row.proposed_toml,
      diff: row.diff,
      testInputs: parseJsonArray(row.test_inputs_json),
      improvement: parseSandboxResult(row.sandbox_result_json),
      approvalWorkflowId: row.approval_workflow_id ?? undefined,
      approvalRequestId: row.approval_request_id ?? undefined,
      reviewer: row.reviewer ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      appliedAt: row.applied_at ?? undefined,
      trackId: row.track_id ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private insertProposal(proposal: SelfModificationProposal): void {
    const db = this.getDb();
    try {
      db.prepare(`
        INSERT INTO self_modification_proposals (
          id,
          agent_name,
          toml_path,
          status,
          weakness_summary,
          weakness_reasons_json,
          rationale,
          original_toml,
          proposed_toml,
          diff,
          test_inputs_json,
          sandbox_result_json,
          improvement_percent,
          approval_workflow_id,
          approval_request_id,
          reviewer,
          review_notes,
          reviewed_at,
          applied_at,
          track_id,
          failure_reason,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        proposal.id,
        proposal.agentName,
        proposal.tomlPath,
        proposal.status,
        proposal.weaknessSummary,
        serializeJson(proposal.weaknessReasons),
        proposal.rationale,
        proposal.originalToml,
        proposal.proposedToml,
        proposal.diff,
        serializeJson(proposal.testInputs),
        serializeJson(proposal.improvement),
        proposal.improvement.improvementPercent,
        proposal.approvalWorkflowId ?? null,
        proposal.approvalRequestId ?? null,
        proposal.reviewer ?? null,
        proposal.reviewNotes ?? null,
        proposal.reviewedAt ?? null,
        proposal.appliedAt ?? null,
        proposal.trackId ?? null,
        proposal.failureReason ?? null,
        proposal.createdAt,
        proposal.updatedAt,
      );
    } catch (error) {
      throw normalizeActiveProposalError(error);
    }
  }

  private updateProposal(proposal: SelfModificationProposal): void {
    const db = this.getDb();
    try {
      db.prepare(`
        UPDATE self_modification_proposals
        SET
          status = ?,
          weakness_summary = ?,
          weakness_reasons_json = ?,
          rationale = ?,
          original_toml = ?,
          proposed_toml = ?,
          diff = ?,
          test_inputs_json = ?,
          sandbox_result_json = ?,
          improvement_percent = ?,
          approval_workflow_id = ?,
          approval_request_id = ?,
          reviewer = ?,
          review_notes = ?,
          reviewed_at = ?,
          applied_at = ?,
          track_id = ?,
          failure_reason = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        proposal.status,
        proposal.weaknessSummary,
        serializeJson(proposal.weaknessReasons),
        proposal.rationale,
        proposal.originalToml,
        proposal.proposedToml,
        proposal.diff,
        serializeJson(proposal.testInputs),
        serializeJson(proposal.improvement),
        proposal.improvement.improvementPercent,
        proposal.approvalWorkflowId ?? null,
        proposal.approvalRequestId ?? null,
        proposal.reviewer ?? null,
        proposal.reviewNotes ?? null,
        proposal.reviewedAt ?? null,
        proposal.appliedAt ?? null,
        proposal.trackId ?? null,
        proposal.failureReason ?? null,
        proposal.updatedAt,
        proposal.id,
      );
    } catch (error) {
      throw normalizeActiveProposalError(error);
    }
  }

  private async buildTestInputs(agentName: string, stats: AgentPerformanceStats): Promise<string[]> {
    const representativeTasks = agentPerformanceTracker.getRepresentativeTasks(agentName, 5, 30);
    if (representativeTasks.length >= 3) {
      return representativeTasks;
    }

    try {
      const { agentManager } = await import('@packages/agents/AgentManager.js');
      const result = await agentManager.delegate(
        'evaluator',
        `Generálj 3 rövid, reprezentatív tesztfeladatot a(z) ${agentName} ügynöknek. Kimenet: JSON string array, magyarázat nélkül.`,
        {
          agentName,
          recentTasks: representativeTasks,
          averageDurationMs: stats.avgDurationMs,
          successRate: stats.successRate,
        },
      ) as Record<string, unknown>;

      const fromData = extractJsonStringArray(result.data);
      const fromMessage = extractJsonStringArray(result.message);
      const combined = [...representativeTasks, ...fromData, ...fromMessage]
        .map((task) => task.trim())
        .filter((task, index, array) => task.length > 0 && array.indexOf(task) === index);

      if (combined.length > 0) {
        return combined.slice(0, 5);
      }
    } catch (error) {
      logWarn('SelfModificationEngine', `EvaluatorAgent test-input fallback: ${ensureError(error).message}`);
    }

    if (representativeTasks.length > 0) {
      return representativeTasks;
    }

    return [`Vizsgáld meg és hajtsd végre ezt a feladatot a(z) ${agentName} ügynök tipikus működése szerint.`];
  }

  private async deterministicImprovement(analysis: AnalyzedAgent): Promise<GeneratedImprovement> {
    let proposedToml = analysis.currentToml;
    const promptAddition = [
      analysis.weaknessSummary,
      'Legyél tömör, determinisztikus, és mondj egyértelműen hibát, ha nem tudsz biztos választ adni.',
      'Csak a feladatra koncentrálj, ne adj felesleges körítést.',
    ].join('\n');

    proposedToml = replaceOrAppendMultilineValue(proposedToml, 'systemPrompt', promptAddition);

    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT) {
      proposedToml = replaceOrAppendScalar(proposedToml, 'provider', '"github"');
      proposedToml = replaceOrAppendScalar(proposedToml, 'model', '"gpt-4.1"');
    } else if (process.env.GEMINI_API_KEY) {
      proposedToml = replaceOrAppendScalar(proposedToml, 'provider', '"gemini"');
      proposedToml = replaceOrAppendScalar(proposedToml, 'model', '"gemini-2.0-flash"');
    }

    toml.parse(proposedToml);
    return {
      rationale: 'Deterministic fallback: a systemPromptot a gyenge pontokhoz igazítottam, és ahol lehetett, stabilabb modell-provider párt állítottam be.',
      proposedToml,
      generatedBy: 'deterministic-fallback',
    };
  }

  private async analyzeAgent(
    agentName: string,
    options?: ImproveAgentOptions,
  ): Promise<AnalyzedAgent> {
    const successThreshold = options?.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    const durationThresholdMs = options?.durationThresholdMs ?? DEFAULT_DURATION_THRESHOLD_MS;
    const minRuns = options?.minRuns ?? DEFAULT_MIN_RUNS;
    const resolved = await this.resolveDynamicAgent(agentName);
    const stats = agentPerformanceTracker.getStats(resolved.agentName, options?.days ?? 7);

    if (stats.totalRuns < minRuns && !options?.force) {
      throw new Error(`A(z) ${resolved.agentName} ügynökről még nincs elég futási adat (${stats.totalRuns}/${minRuns}).`);
    }

    const weakAgent = agentPerformanceTracker
      .getWeakAgents({
        days: options?.days ?? 7,
        successThreshold,
        durationThresholdMs,
        minRuns,
        limit: 50,
      })
      .find((candidate) => candidate.agentName.toLowerCase() === resolved.agentName.toLowerCase());
    const reflectionPainPoint = ReflectionEngine
      .getInstance()
      .detectPainPoints()
      .find((entry) => entry.agent.toLowerCase() === resolved.agentName.toLowerCase());

    const weaknessReasons = [
      ...(weakAgent?.weaknessReasons ?? []),
      ...(reflectionPainPoint?.topErrors.map((error) => `ReflectionEngine szerint visszatérő hiba: ${error}`) ?? []),
    ].filter((value, index, array) => array.indexOf(value) === index);

    if (weaknessReasons.length === 0 && !options?.force) {
      throw new Error(`A(z) ${resolved.agentName} nem minősül fejlesztendő jelöltnek a jelenlegi küszöbök alapján.`);
    }

    const currentToml = await readFile(resolved.tomlPath, 'utf-8');
    toml.parse(currentToml);

    return {
      agentName: resolved.agentName,
      tomlPath: resolved.tomlPath,
      currentToml,
      stats,
      weaknessSummary: buildWeaknessSummary(resolved.agentName, weaknessReasons, stats),
      weaknessReasons,
      testInputs: await this.buildTestInputs(resolved.agentName, stats),
    };
  }

  private async generateImprovement(analysis: AnalyzedAgent): Promise<GeneratedImprovement> {
    const provider = process.env.LLM_PROVIDER
      || (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT ? 'github' : undefined)
      || (process.env.GEMINI_API_KEY ? 'gemini' : undefined)
      || 'ollama';
    const model = provider === 'github'
      ? 'gpt-4.1'
      : provider === 'gemini'
        ? (process.env.GEMINI_MODEL || 'gemini-2.0-flash')
        : undefined;
    const prompt = [
      'Te a Brunella DeveloperAgent dry-run TOML optimalizáló profilja vagy.',
      `Célagent: ${analysis.agentName}`,
      `Gyenge pont összefoglaló: ${analysis.weaknessSummary}`,
      `7 napos statisztika: successRate=${(analysis.stats.successRate * 100).toFixed(1)}%, avgDurationMs=${Math.round(analysis.stats.avgDurationMs)}, failures=${analysis.stats.failureCount}`,
      '',
      'Korlátok:',
      '- Csak DynamicAgent-kompatibilis top-level TOML mezőket módosíts.',
      '- Ne írj nested [agent] struktúrát.',
      '- Őrizd meg az agent nevét és célját.',
      '- Adj vissza pontosan egy RATIONALE szekciót és egyetlen ```toml kódblokkot.',
      '',
      'Jelenlegi TOML:',
      '```toml',
      analysis.currentToml.trim(),
      '```',
    ].join('\n');

    try {
      const rawResponse = await generateResponse(prompt, provider, model);
      const proposedToml = extractTomlFence(rawResponse);
      if (!proposedToml) {
        throw new Error('Hiányzik a TOML kódblokk a modell válaszából.');
      }

      toml.parse(proposedToml);
      return {
        rationale: extractRationale(rawResponse),
        proposedToml,
        generatedBy: `developer-profile:${provider}`,
      };
    } catch (error) {
      logWarn('SelfModificationEngine', `LLM improvement fallback: ${ensureError(error).message}`);
      return await this.deterministicImprovement(analysis);
    }
  }

  private async createApprovalWorkflow(
    proposal: SelfModificationProposal,
  ): Promise<{ workflowId?: string; approvalRequestId?: string }> {
    const workflow = await approvalRouter.createWorkflowFromPolicy({
      actionClass: 'guarded',
      riskScore: 85,
      autonomyLevel: 'high',
      requiresApproval: true,
      reason: `Self-modification proposal vár jóváhagyásra: ${proposal.agentName}`,
      guardrails: [
        'Production módosítás csak emberi jóváhagyás után',
        'Egyszerre csak egy self-mod proposal lehet aktív',
        'A javaslat csak TOML alapú DynamicAgent konfigurációt írhat felül',
      ],
      auditResult: 'ALLOWED',
    }, {
      event: createSelfModificationEvent(proposal),
      agentName: proposal.agentName,
      resource: proposal.tomlPath,
      timeoutMs: DEFAULT_APPROVAL_TIMEOUT_MS,
    });

    if (!workflow) {
      return {};
    }

    return {
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
    };
  }

  async improveAgent(agentName: string, options?: ImproveAgentOptions): Promise<SelfModificationProposal> {
    this.ensureNoConcurrentModification();

    const analysis = await this.analyzeAgent(agentName, options);
    const generated = await this.generateImprovement(analysis);
    const improvement = await sandboxManager.testAgent(
      analysis.agentName,
      analysis.currentToml,
      generated.proposedToml,
      analysis.testInputs,
      { timeoutMs: options?.timeoutMs },
    );
    const createdAt = nowIso();
    const proposal: SelfModificationProposal = {
      id: randomUUID(),
      agentName: analysis.agentName,
      tomlPath: analysis.tomlPath,
      status: improvement.thresholdPassed ? 'pending_review' : 'failed',
      weaknessSummary: analysis.weaknessSummary,
      weaknessReasons: analysis.weaknessReasons,
      rationale: `${generated.rationale}\nTriggered by: ${options?.triggeredBy ?? 'manual'}`,
      originalToml: analysis.currentToml,
      proposedToml: generated.proposedToml,
      diff: buildUnifiedDiff(analysis.currentToml, generated.proposedToml),
      testInputs: analysis.testInputs,
      improvement,
      failureReason: improvement.thresholdPassed
        ? undefined
        : 'Sandbox threshold nem teljesult (+10% success vagy -20% duration).',
      createdAt,
      updatedAt: createdAt,
    };

    if (proposal.status === 'pending_review') {
      const workflow = await this.createApprovalWorkflow(proposal);
      proposal.approvalWorkflowId = workflow.workflowId;
      proposal.approvalRequestId = workflow.approvalRequestId;
    }

    this.insertProposal(proposal);
    logInfo('SelfModificationEngine', `Proposal ${proposal.id} created for ${proposal.agentName}`);
    return proposal;
  }

  private async createImprovementTrack(
    proposal: SelfModificationProposal,
  ): Promise<{ trackId: string; trackDir: string }> {
    const createdAt = nowIso();
    const dateSegment = createdAt.slice(0, 10).replace(/-/g, '');
    const trackId = `selfmod_${slugify(proposal.agentName)}_${dateSegment}`;
    const trackDir = path.join(process.cwd(), 'conductor', 'tracks', trackId);
    await mkdir(trackDir, { recursive: true });

    const meta = {
      id: trackId,
      title: `Self-mod rollout — ${proposal.agentName}`,
      description: `Approved self-modification rollout for ${proposal.agentName}.`,
      status: 'active',
      priority: 'medium',
      createdAt,
      updatedAt: createdAt,
      owner: 'Brunella',
      progress: 0,
      phase: 'architect',
      group: 'self-modification',
      roadmapPhase: 'phase-2',
      tags: ['self-modification', 'auto-generated', proposal.agentName.toLowerCase()],
      deliverables: [path.relative(process.cwd(), proposal.tomlPath).replace(/\\/g, '/')],
      sdlc: {
        enabled: true,
        phases: {
          architect: { status: 'pending' },
          devops: { status: 'pending' },
          coder: { status: 'pending' },
          qa: { status: 'pending' },
          reviewer: { status: 'pending' },
        },
      },
      dod: normalizeTrackDod(undefined),
    };

    const spec = `# Spec: Self-mod rollout — ${proposal.agentName}

## Approved proposal
- Proposal ID: \`${proposal.id}\`
- Agent: \`${proposal.agentName}\`
- Improvement percent: \`${proposal.improvement.improvementPercent.toFixed(1)}\`
- Source TOML: \`${path.relative(process.cwd(), proposal.tomlPath).replace(/\\/g, '/')}\`

## Weakness summary
${proposal.weaknessSummary}

## Expected rollout scope
- Apply the approved TOML configuration.
- Observe runtime metrics after deployment.
- Roll back if production behavior regresses.
`;

    const plan = `# Track: Self-mod rollout — ${proposal.agentName}

## Scope
- Approved self-modification proposal: \`${proposal.id}\`
- TOML path: \`${path.relative(process.cwd(), proposal.tomlPath).replace(/\\/g, '/')}\`

## Checklist
- [ ] Monitor post-rollout runtime metrics
- [ ] Review operator feedback
- [ ] Close or archive if the rollout remains stable
`;

    try {
      await Promise.all([
        writeFile(path.join(trackDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8'),
        writeFile(path.join(trackDir, 'spec.md'), spec, 'utf-8'),
        writeFile(path.join(trackDir, 'plan.md'), plan, 'utf-8'),
      ]);
    } catch (error) {
      await rm(trackDir, { recursive: true, force: true });
      throw ensureError(error);
    }

    try {
      await trackStateManager.fullSync();
    } catch (error) {
      logWarn('SelfModificationEngine', `Track sync warning: ${ensureError(error).message}`);
    }

    return { trackId, trackDir };
  }

  async approveProposal(
    proposalId: string,
    review?: ProposalReviewInput,
  ): Promise<SelfModificationProposal> {
    const proposal = this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} nem található.`);
    }

    if (proposal.status !== 'pending_review') {
      throw new Error(`Proposal ${proposalId} nem jóváhagyható (${proposal.status}).`);
    }

    proposal.reviewer = review?.reviewer;
    proposal.reviewNotes = review?.notes;
    proposal.reviewedAt = nowIso();
    proposal.status = 'approved';
    proposal.updatedAt = proposal.reviewedAt;

    if (proposal.approvalRequestId) {
      approvalRouter.respondToWorkflowByRequestId(proposal.approvalRequestId, 'approve', {
        reviewer: review?.reviewer,
        notes: review?.notes,
        source: 'self-modification',
      });
    }

    this.updateProposal(proposal);
    return await this.applyProposal(proposal.id, review);
  }

  async rejectProposal(
    proposalId: string,
    review?: ProposalReviewInput,
  ): Promise<SelfModificationProposal> {
    const proposal = this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} nem található.`);
    }

    if (proposal.status !== 'pending_review') {
      throw new Error(`Proposal ${proposalId} nem elutasítható (${proposal.status}).`);
    }

    const updatedAt = nowIso();
    proposal.status = 'rejected';
    proposal.reviewer = review?.reviewer;
    proposal.reviewNotes = review?.notes;
    proposal.reviewedAt = updatedAt;
    proposal.updatedAt = updatedAt;

    if (proposal.approvalRequestId) {
      approvalRouter.respondToWorkflowByRequestId(proposal.approvalRequestId, 'reject', {
        reviewer: review?.reviewer,
        notes: review?.notes,
        source: 'self-modification',
      });
    }

    this.updateProposal(proposal);
    return proposal;
  }

  async retestProposal(
    proposalId: string,
    update?: RetestProposalInput,
  ): Promise<SelfModificationProposal> {
    const proposal = this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} nem található.`);
    }

    if (proposal.status !== 'pending_review') {
      throw new Error(`Proposal ${proposalId} csak pending_review állapotból retesztelhető.`);
    }

    this.ensureNoConcurrentModification(proposalId);

    if (proposal.approvalRequestId) {
      approvalRouter.respondToWorkflowByRequestId(proposal.approvalRequestId, 'reject', {
        reviewer: update?.reviewer,
        notes: 'Superseded by proposal retest',
        source: 'self-modification:retest',
      });
      proposal.approvalRequestId = undefined;
      proposal.approvalWorkflowId = undefined;
    }

    const proposedToml = update?.proposedToml?.trim().length
      ? update.proposedToml
      : proposal.proposedToml;
    toml.parse(proposedToml);

    const improvement = await sandboxManager.testAgent(
      proposal.agentName,
      proposal.originalToml,
      proposedToml,
      proposal.testInputs,
      { timeoutMs: update?.timeoutMs },
    );
    proposal.proposedToml = proposedToml;
    proposal.diff = buildUnifiedDiff(proposal.originalToml, proposedToml);
    proposal.improvement = improvement;
    proposal.rationale = update?.notes?.trim().length
      ? update.notes
      : proposal.rationale;
    proposal.failureReason = improvement.thresholdPassed
      ? undefined
      : 'Sandbox threshold nem teljesult (+10% success vagy -20% duration).';
    proposal.status = improvement.thresholdPassed ? 'pending_review' : 'failed';
    proposal.updatedAt = nowIso();

    if (proposal.status === 'pending_review') {
      const workflow = await this.createApprovalWorkflow(proposal);
      proposal.approvalWorkflowId = workflow.workflowId;
      proposal.approvalRequestId = workflow.approvalRequestId;
    }

    this.updateProposal(proposal);
    return proposal;
  }

  async applyProposal(
    proposalId: string,
    context?: ProposalReviewInput,
  ): Promise<SelfModificationProposal> {
    const proposal = this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} nem található.`);
    }

    if (proposal.status !== 'approved' && proposal.status !== 'pending_review') {
      throw new Error(`Proposal ${proposalId} nem alkalmazható (${proposal.status}).`);
    }

    proposal.status = 'applying';
    proposal.updatedAt = nowIso();
    this.updateProposal(proposal);

    const originalTomlOnDisk = await readFile(proposal.tomlPath, 'utf-8').catch(() => proposal.originalToml);
    let createdTrack: { trackId: string; trackDir: string } | null = null;

    try {
      await writeFile(proposal.tomlPath, proposal.proposedToml, 'utf-8');
      createdTrack = await this.createImprovementTrack(proposal);
      proposal.trackId = createdTrack.trackId;
      proposal.appliedAt = nowIso();
      proposal.status = 'applied';
      proposal.reviewer = context?.reviewer ?? proposal.reviewer;
      proposal.reviewNotes = context?.notes ?? proposal.reviewNotes;
      proposal.updatedAt = proposal.appliedAt;
      this.updateProposal(proposal);
      return proposal;
    } catch (error) {
      const normalized = ensureError(error);

      try {
        await writeFile(proposal.tomlPath, originalTomlOnDisk, 'utf-8');
      } catch (restoreError) {
        logWarn('SelfModificationEngine', `Rollback warning: ${ensureError(restoreError).message}`);
      }

      if (createdTrack) {
        await rm(createdTrack.trackDir, { recursive: true, force: true });
        try {
          await trackStateManager.fullSync();
        } catch (syncError) {
          logWarn('SelfModificationEngine', `Track rollback sync warning: ${ensureError(syncError).message}`);
        }
      }

      proposal.status = 'failed';
      proposal.failureReason = normalized.message;
      proposal.updatedAt = nowIso();
      this.updateProposal(proposal);
      throw normalized;
    }
  }

  listProposals(status?: SelfModificationProposalStatus, limit = 20): SelfModificationProposal[] {
    const db = this.getDb();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = status
      ? db.prepare(`
          SELECT *
          FROM self_modification_proposals
          WHERE status = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(status, safeLimit)
      : db.prepare(`
          SELECT *
          FROM self_modification_proposals
          ORDER BY created_at DESC
          LIMIT ?
        `).all(safeLimit);

    return (rows as ProposalRow[]).map((row) => this.mapRow(row));
  }

  getProposal(proposalId: string): SelfModificationProposal | null {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT *
      FROM self_modification_proposals
      WHERE id = ?
      LIMIT 1
    `).get(proposalId) as ProposalRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  getOverview(): SelfModificationOverview {
    const summary = agentPerformanceTracker.getOverview(7);
    const weakAgents = agentPerformanceTracker.getWeakAgents({
      days: 7,
      successThreshold: DEFAULT_SUCCESS_THRESHOLD,
      durationThresholdMs: DEFAULT_DURATION_THRESHOLD_MS,
      minRuns: DEFAULT_MIN_RUNS,
      limit: 10,
    });
    const proposals = this.listProposals(undefined, 10);
    const activeProposal = proposals.find((proposal) => isActiveProposalStatus(proposal.status));

    return {
      summary,
      weakAgents,
      proposals,
      activeProposal,
      protectedAgents: [...PROTECTED_AGENTS],
    };
  }

  async runWeeklyCycle(options?: {
    successThreshold?: number;
    durationThresholdMs?: number;
    minRuns?: number;
  }): Promise<SelfModificationCycleResult> {
    const weakAgents = agentPerformanceTracker.getWeakAgents({
      days: 7,
      successThreshold: options?.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD,
      durationThresholdMs: options?.durationThresholdMs ?? DEFAULT_DURATION_THRESHOLD_MS,
      minRuns: options?.minRuns ?? DEFAULT_MIN_RUNS,
      limit: 10,
    });
    const triggeredAt = nowIso();

    if (this.listProposals(undefined, 20).some((proposal) => isActiveProposalStatus(proposal.status))) {
      return {
        triggeredAt,
        weakAgents,
        skippedReason: 'Már létezik aktív self-mod proposal.',
      };
    }

    const eligible: WeakAgentCandidate[] = [];
    for (const candidate of weakAgents) {
      try {
        await this.resolveDynamicAgent(candidate.agentName);
        eligible.push(candidate);
      } catch {
        continue;
      }
    }

    if (eligible.length === 0) {
      return {
        triggeredAt,
        weakAgents,
        skippedReason: 'Nincs módosítható gyenge DynamicAgent jelölt.',
      };
    }

    const proposal = await this.improveAgent(eligible[0].agentName, {
      successThreshold: options?.successThreshold,
      durationThresholdMs: options?.durationThresholdMs,
      minRuns: options?.minRuns,
      triggeredBy: 'cron:weekly:self-improve',
    });

    return {
      triggeredAt,
      weakAgents,
      createdProposalId: proposal.id,
      targetAgent: proposal.agentName,
    };
  }

  resetForTests(): void {
    const db = this.getDb();
    db.exec('DELETE FROM self_modification_proposals;');
  }
}

export const selfModificationEngine = new SelfModificationEngine();

export async function runWeeklySelfImprovementCycle(options?: {
  successThreshold?: number;
  durationThresholdMs?: number;
  minRuns?: number;
}): Promise<SelfModificationCycleResult> {
  return await selfModificationEngine.runWeeklyCycle(options);
}

