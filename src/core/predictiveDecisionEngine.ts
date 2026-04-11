import { randomUUID } from 'crypto';

import { goalEngine } from './autonomousInfraRuntime.js';
import { executeDecisionAction, rollbackDecisionAction } from './decisionExecutor.js';
import type {
  DecisionCandidate,
  DecisionScenario,
  DecisionResult,
  DecisionStats,
  DecisionActionType,
  MonteCarloConfig,
  PredictiveDecisionContext,
} from './decisionTypes.js';
import { listReviewQueue } from './intelligenceMonitor.js';
import { PredictiveIntelligence } from './predictiveIntelligence.js';
import { fireHookSafely } from './hookRegistry.js';
import { listWorldSignals } from './worldPerceptionLayer.js';
import { getGlobalDb } from '../utils/globalDb.js';
import { logError, logInfo } from '../utils/logger.js';

const DEFAULT_CONFIG: MonteCarloConfig = {
  scenarioCount: 48,
  riskWeight: 0.3,
  impactWeight: 0.4,
  alignmentWeight: 0.3,
  selectionThreshold: 0.58,
};

interface DecisionRunRow {
  id: string;
  triggered_by: string;
  scenario_count: number;
  selected_score: number | null;
  action_type: DecisionActionType | null;
  selected_scenario_json: string | null;
  scenarios_json: string;
  executed_action_json: string | null;
  rollback_data_json: string | null;
  rollback_capable: number;
  outcome: DecisionResult['outcome'];
  metadata_json: string;
  created_at: string;
  rolled_back_at: string | null;
}

class SeededRandom {
  constructor(private seed: number) {}

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

function ensureDecisionTables(): void {
  const db = getGlobalDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictive_decision_runs (
      id TEXT PRIMARY KEY,
      triggered_by TEXT NOT NULL,
      scenario_count INTEGER NOT NULL,
      selected_score REAL,
      action_type TEXT,
      selected_scenario_json TEXT,
      scenarios_json TEXT NOT NULL,
      executed_action_json TEXT,
      rollback_data_json TEXT,
      rollback_capable INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      rolled_back_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_predictive_decision_runs_created_at
      ON predictive_decision_runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_predictive_decision_runs_outcome
      ON predictive_decision_runs(outcome);
  `);
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function mapAlertCategory(type: string): 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth' {
  if (type === 'error_spike' || type === 'churn_risk') return 'resilience';
  if (type === 'performance_drop') return 'efficiency';
  if (type === 'recommendation') return 'alignment';
  return 'growth';
}

function mapWorldSignalCategory(domain: string): 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth' {
  if (domain === 'financial') return 'efficiency';
  if (domain === 'technology') return 'autonomy';
  if (domain === 'political' || domain === 'social') return 'alignment';
  return 'growth';
}

function mapRunRow(row: DecisionRunRow): DecisionResult {
  return {
    id: row.id,
    triggeredBy: row.triggered_by,
    scenarios: JSON.parse(row.scenarios_json) as DecisionScenario[],
    selectedScenario: row.selected_scenario_json ? JSON.parse(row.selected_scenario_json) as DecisionScenario : null,
    executedAction: row.executed_action_json ? JSON.parse(row.executed_action_json) as DecisionResult['executedAction'] : null,
    rollbackCapability: Boolean(row.rollback_capable),
    outcome: row.outcome,
    createdAt: row.created_at,
    rolledBackAt: row.rolled_back_at,
    metadata: JSON.parse(row.metadata_json) as DecisionResult['metadata'],
  };
}

export class PredictiveDecisionEngine {
  private schemaReady = false;

  private ensureSchema(): void {
    if (this.schemaReady) {
      return;
    }
    ensureDecisionTables();
    this.schemaReady = true;
  }

  async analyzeDecisionPoint(
    triggeredBy = 'manual',
    config: Partial<MonteCarloConfig> = {},
  ): Promise<DecisionResult> {
    this.ensureSchema();
    const fullConfig: MonteCarloConfig = { ...DEFAULT_CONFIG, ...config };
    const createdAt = nowIso();
    const decisionId = `pdr_${randomUUID()}`;

    await fireHookSafely('decision.analysis.started', {
      decisionId,
      triggeredBy,
      scenarioCount: fullConfig.scenarioCount,
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, triggeredBy },
      logContext: 'PredictiveDecisionEngine',
    });

    const context = this.gatherDecisionContext();
    const candidates = this.buildCandidates(context);
    const metadata: DecisionResult['metadata'] = {
      activeAlerts: context.alerts.length,
      signalCount: context.worldSignals.length,
      reviewQueueCount: context.reviewQueue.length,
      activeGoals: context.activeGoals.length,
      config: fullConfig,
    };

    if (candidates.length === 0) {
      const emptyResult: DecisionResult = {
        id: decisionId,
        triggeredBy,
        scenarios: [],
        selectedScenario: null,
        executedAction: null,
        rollbackCapability: false,
        outcome: 'no_action',
        createdAt,
        rolledBackAt: null,
        metadata,
      };
      this.persistDecisionRun(emptyResult, null);
      await fireHookSafely('decision.cycle.completed', {
        decisionId,
        outcome: emptyResult.outcome,
        scenarioCount: 0,
      }, {
        source: 'predictive-decision',
        metadata: { decisionId, outcome: emptyResult.outcome },
        logContext: 'PredictiveDecisionEngine',
      });
      return emptyResult;
    }

    const scenarios = this.generateScenarios(candidates, fullConfig);
    await fireHookSafely('decision.scenarios.generated', {
      decisionId,
      scenarioCount: scenarios.length,
      averageScore: Number(
        (scenarios.reduce((sum, scenario) => sum + scenario.totalScore, 0) / scenarios.length).toFixed(3),
      ),
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, scenarioCount: scenarios.length },
      logContext: 'PredictiveDecisionEngine',
    });

    const selectedScenario = this.selectScenario(scenarios, fullConfig.selectionThreshold);
    if (!selectedScenario) {
      const noActionResult: DecisionResult = {
        id: decisionId,
        triggeredBy,
        scenarios,
        selectedScenario: null,
        executedAction: null,
        rollbackCapability: false,
        outcome: 'no_action',
        createdAt,
        rolledBackAt: null,
        metadata,
      };
      this.persistDecisionRun(noActionResult, null);
      await fireHookSafely('decision.cycle.completed', {
        decisionId,
        outcome: noActionResult.outcome,
        scenarioCount: scenarios.length,
      }, {
        source: 'predictive-decision',
        metadata: { decisionId, outcome: noActionResult.outcome },
        logContext: 'PredictiveDecisionEngine',
      });
      return noActionResult;
    }

    await fireHookSafely('decision.action.selected', {
      decisionId,
      actionType: selectedScenario.action.type,
      sourceType: selectedScenario.candidate.sourceType,
      totalScore: selectedScenario.totalScore,
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, actionType: selectedScenario.action.type },
      logContext: 'PredictiveDecisionEngine',
    });

    const executedAction = await executeDecisionAction(selectedScenario.action);
    const result: DecisionResult = {
      id: decisionId,
      triggeredBy,
      scenarios,
      selectedScenario,
      executedAction,
      rollbackCapability: Boolean(selectedScenario.action.reversible && executedAction.success && executedAction.rollbackData),
      outcome: executedAction.success ? 'executed' : 'failed',
      createdAt,
      rolledBackAt: null,
      metadata,
    };

    this.persistDecisionRun(result, executedAction.rollbackData ?? null);

    await fireHookSafely('decision.action.executed', {
      decisionId,
      actionType: selectedScenario.action.type,
      outcome: result.outcome,
      success: executedAction.success,
      error: executedAction.error ?? null,
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, actionType: selectedScenario.action.type, outcome: result.outcome },
      logContext: 'PredictiveDecisionEngine',
    });

    await fireHookSafely('decision.cycle.completed', {
      decisionId,
      outcome: result.outcome,
      scenarioCount: scenarios.length,
      actionType: selectedScenario.action.type,
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, outcome: result.outcome, actionType: selectedScenario.action.type },
      logContext: 'PredictiveDecisionEngine',
    });

    return result;
  }

  async rollbackDecision(decisionId: string): Promise<DecisionResult> {
    this.ensureSchema();
    const db = getGlobalDb();
    const row = db.prepare(`
      SELECT *
      FROM predictive_decision_runs
      WHERE id = ?
    `).get(decisionId) as DecisionRunRow | undefined;

    if (!row) {
      throw new Error(`Predictive decision not found: ${decisionId}`);
    }

    if (!row.rollback_capable || !row.action_type || !row.rollback_data_json) {
      throw new Error(`Predictive decision cannot be rolled back: ${decisionId}`);
    }

    if (row.rolled_back_at) {
      throw new Error(`Predictive decision already rolled back: ${decisionId}`);
    }

    const rollbackResult = await rollbackDecisionAction(
      row.action_type,
      JSON.parse(row.rollback_data_json) as Record<string, unknown>,
    );

    if (!rollbackResult.success) {
      throw new Error(rollbackResult.error ?? `Rollback failed for ${decisionId}`);
    }

    const rolledBackAt = rollbackResult.rolledBackAt;
    db.prepare(`
      UPDATE predictive_decision_runs
      SET outcome = 'rolled_back',
          rolled_back_at = ?
      WHERE id = ?
    `).run(rolledBackAt, decisionId);

    await fireHookSafely('decision.action.rolled_back', {
      decisionId,
      actionType: row.action_type,
      rolledBackAt,
    }, {
      source: 'predictive-decision',
      metadata: { decisionId, actionType: row.action_type },
      logContext: 'PredictiveDecisionEngine',
    });

    return this.getDecisionResult(decisionId);
  }

  getDecisionResult(decisionId: string): DecisionResult {
    this.ensureSchema();
    const db = getGlobalDb();
    const row = db.prepare(`
      SELECT *
      FROM predictive_decision_runs
      WHERE id = ?
    `).get(decisionId) as DecisionRunRow | undefined;

    if (!row) {
      throw new Error(`Predictive decision not found: ${decisionId}`);
    }

    return mapRunRow(row);
  }

  getDecisionHistory(limit = 25): DecisionResult[] {
    this.ensureSchema();
    const db = getGlobalDb();
    const normalizedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = db.prepare(`
      SELECT *
      FROM predictive_decision_runs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(normalizedLimit) as DecisionRunRow[];
    return rows.map(mapRunRow);
  }

  getDecisionStats(daysBack = 30): DecisionStats {
    this.ensureSchema();
    const db = getGlobalDb();
    const from = new Date(Date.now() - Math.max(1, daysBack) * 24 * 60 * 60 * 1000).toISOString();
    const to = nowIso();
    const rows = db.prepare(`
      SELECT *
      FROM predictive_decision_runs
      WHERE created_at >= ?
      ORDER BY created_at DESC
    `).all(from) as DecisionRunRow[];

    const totalDecisions = rows.length;
    const actionsExecuted = rows.filter((row) => row.outcome === 'executed').length;
    const noActionDecisions = rows.filter((row) => row.outcome === 'no_action').length;
    const failedActions = rows.filter((row) => row.outcome === 'failed').length;
    const rolledBackActions = rows.filter((row) => row.outcome === 'rolled_back').length;
    const averageScenarioCount = totalDecisions === 0
      ? 0
      : rows.reduce((sum, row) => sum + Number(row.scenario_count ?? 0), 0) / totalDecisions;
    const scoredRows = rows.filter((row) => typeof row.selected_score === 'number');
    const averageSelectedScore = scoredRows.length === 0
      ? 0
      : scoredRows.reduce((sum, row) => sum + Number(row.selected_score ?? 0), 0) / scoredRows.length;
    const actionCounter = new Map<DecisionActionType, number>();

    for (const row of rows) {
      if (!row.action_type) continue;
      actionCounter.set(row.action_type, (actionCounter.get(row.action_type) ?? 0) + 1);
    }

    return {
      totalDecisions,
      actionsExecuted,
      noActionDecisions,
      failedActions,
      rolledBackActions,
      successRate: totalDecisions === 0 ? 0 : actionsExecuted / totalDecisions,
      averageScenarioCount,
      averageSelectedScore,
      actionBreakdown: Array.from(actionCounter.entries()).map(([actionType, count]) => ({ actionType, count })),
      dateRange: { from, to },
    };
  }

  private gatherDecisionContext(): PredictiveDecisionContext {
    const intelligence = PredictiveIntelligence.getInstance();
    const alerts = intelligence.listAlerts({ acknowledged: false, limit: 8 });
    const worldSignals = listWorldSignals({ status: 'detected', limit: 8 });
    const reviewQueue = listReviewQueue(6);
    const activeGoals = goalEngine
      .getGoals()
      .filter((goal) => goal.status === 'active' || goal.status === 'proposed');

    return {
      alerts,
      worldSignals,
      reviewQueue,
      activeGoals,
    };
  }

  private buildCandidates(context: PredictiveDecisionContext): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];
    const openMetrics = new Set(context.activeGoals.map((goal) => goal.metric));

    for (const alert of context.alerts) {
      const alertMetric = `predictive:${alert.type}:${normalizeText(alert.title)}`;
      const severityBoost = alert.severity === 'high' ? 0.14 : alert.severity === 'medium' ? 0.08 : 0.03;
      const confidenceBoost = clamp(alert.confidence) * 0.12;

      if (!openMetrics.has(alertMetric)) {
        candidates.push({
          sourceType: 'predictive_alert',
          sourceId: alert.id,
          title: alert.title,
          summary: alert.description,
          action: {
            type: 'create_goal',
            description: `Create follow-up goal for alert: ${alert.title}`,
            payload: {
              title: `Respond to ${alert.title}`,
              category: mapAlertCategory(alert.type),
              metric: alertMetric,
              direction: alert.type === 'opportunity' ? 'increase' : 'decrease',
              targetValue: alert.type === 'opportunity' ? 1 : 0,
              currentValue: alert.type === 'opportunity' ? 0.4 : 1,
              priority: alert.severity === 'high' ? 88 : alert.severity === 'medium' ? 74 : 62,
              rationale: `${alert.description} • Suggested action: ${alert.suggestedAction}`,
            },
            reversible: true,
          },
          riskBase: clamp(0.36 - severityBoost),
          impactBase: clamp(0.54 + confidenceBoost + severityBoost),
          alignmentBase: clamp(0.6 + confidenceBoost),
        });
      }

      candidates.push({
        sourceType: 'predictive_alert',
        sourceId: alert.id,
        title: alert.title,
        summary: alert.description,
        action: {
          type: 'acknowledge_alert',
          description: `Acknowledge alert after decision review: ${alert.title}`,
          payload: {
            alertId: alert.id,
            note: alert.suggestedAction,
          },
          reversible: true,
        },
        riskBase: clamp(0.18 + severityBoost),
        impactBase: clamp(0.42 + confidenceBoost - severityBoost),
        alignmentBase: clamp(0.52 + confidenceBoost),
      });

      if (alert.severity === 'high' || alert.confidence < 0.55) {
        candidates.push({
          sourceType: 'predictive_alert',
          sourceId: alert.id,
          title: alert.title,
          summary: alert.description,
          action: {
            type: 'escalate_review',
            description: `Escalate high-risk predictive alert for human review: ${alert.title}`,
            payload: {
              sourceId: alert.id,
              sourceType: 'predictive_alert',
              reason: alert.suggestedAction,
            },
            reversible: false,
          },
          riskBase: 0.08,
          impactBase: clamp(0.4 + severityBoost),
          alignmentBase: 0.5,
        });
      }
    }

    for (const signal of context.worldSignals) {
      const metric = `world:${signal.domain}:${normalizeText(signal.title)}`;
      if (!openMetrics.has(metric) && signal.score >= 0.72) {
        candidates.push({
          sourceType: 'world_signal',
          sourceId: signal.id,
          title: signal.title,
          summary: signal.summary,
          action: {
            type: 'create_goal',
            description: `Create world-perception follow-up goal: ${signal.title}`,
            payload: {
              title: `Investigate ${signal.title}`,
              category: mapWorldSignalCategory(signal.domain),
              metric,
              direction: 'increase',
              targetValue: 1,
              currentValue: 0.35,
              priority: Math.round(clamp(signal.score, 0.6, 0.95) * 100),
              rationale: `${signal.summary} • ${signal.provenance}`,
            },
            reversible: true,
          },
          riskBase: clamp(0.42 - signal.confidence * 0.12),
          impactBase: clamp(0.5 + signal.score * 0.22),
          alignmentBase: clamp(0.55 + signal.freshnessScore * 0.15),
        });
      } else {
        candidates.push({
          sourceType: 'world_signal',
          sourceId: signal.id,
          title: signal.title,
          summary: signal.summary,
          action: {
            type: 'escalate_review',
            description: `Escalate world signal for operator review: ${signal.title}`,
            payload: {
              sourceId: signal.id,
              sourceType: 'world_signal',
              reason: signal.provenance,
            },
            reversible: false,
          },
          riskBase: 0.1,
          impactBase: clamp(0.42 + signal.impactScore * 0.18),
          alignmentBase: clamp(0.46 + signal.freshnessScore * 0.1),
        });
      }
    }

    for (const signal of context.reviewQueue.slice(0, 4)) {
      candidates.push({
        sourceType: 'review_queue',
        sourceId: signal.id,
        title: signal.title,
        summary: signal.summary,
        action: {
          type: 'escalate_review',
          description: `Escalate intelligence review queue item: ${signal.title}`,
          payload: {
            sourceId: signal.id,
            sourceType: 'review_queue',
            reason: signal.reviewNote ?? signal.provenance,
          },
          reversible: false,
        },
        riskBase: 0.07,
        impactBase: clamp(0.38 + signal.score * 0.18),
        alignmentBase: 0.48,
      });
    }

    return candidates;
  }

  private generateScenarios(
    candidates: DecisionCandidate[],
    config: MonteCarloConfig,
  ): DecisionScenario[] {
    const scenarios: DecisionScenario[] = [];
    const random = new SeededRandom(config.seed ?? 20260411);
    const iterationsPerCandidate = Math.max(1, Math.floor(config.scenarioCount / candidates.length));

    for (const candidate of candidates) {
      for (let iteration = 0; iteration < iterationsPerCandidate; iteration += 1) {
        const riskScore = clamp(candidate.riskBase + random.range(-0.06, 0.06));
        const impactScore = clamp(candidate.impactBase + random.range(-0.08, 0.08));
        const alignmentScore = clamp(candidate.alignmentBase + random.range(-0.05, 0.05));
        const totalScore = this.scoreScenario(riskScore, impactScore, alignmentScore, config);

        scenarios.push({
          id: `scenario_${randomUUID()}`,
          iteration,
          candidate,
          action: candidate.action,
          riskScore,
          impactScore,
          alignmentScore,
          totalScore,
          rationale: `${candidate.sourceType}:${candidate.sourceId}`,
        });
      }
    }

    while (scenarios.length < config.scenarioCount) {
      const fallbackCandidate = candidates[scenarios.length % candidates.length];
      const riskScore = clamp(fallbackCandidate.riskBase + random.range(-0.03, 0.03));
      const impactScore = clamp(fallbackCandidate.impactBase + random.range(-0.04, 0.04));
      const alignmentScore = clamp(fallbackCandidate.alignmentBase + random.range(-0.03, 0.03));
      scenarios.push({
        id: `scenario_${randomUUID()}`,
        iteration: scenarios.length,
        candidate: fallbackCandidate,
        action: fallbackCandidate.action,
        riskScore,
        impactScore,
        alignmentScore,
        totalScore: this.scoreScenario(riskScore, impactScore, alignmentScore, config),
        rationale: `${fallbackCandidate.sourceType}:${fallbackCandidate.sourceId}`,
      });
    }

    return scenarios;
  }

  private scoreScenario(
    riskScore: number,
    impactScore: number,
    alignmentScore: number,
    config: MonteCarloConfig,
  ): number {
    const safeRisk = (1 - riskScore) * config.riskWeight;
    const impact = impactScore * config.impactWeight;
    const alignment = alignmentScore * config.alignmentWeight;
    return clamp(Number((safeRisk + impact + alignment).toFixed(4)));
  }

  private selectScenario(
    scenarios: DecisionScenario[],
    selectionThreshold: number,
  ): DecisionScenario | null {
    const viable = scenarios
      .filter((scenario) => scenario.totalScore >= selectionThreshold)
      .sort((left, right) => right.totalScore - left.totalScore);
    return viable[0] ?? null;
  }

  private persistDecisionRun(
    result: DecisionResult,
    rollbackData: Record<string, unknown> | null,
  ): void {
    this.ensureSchema();
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO predictive_decision_runs (
        id,
        triggered_by,
        scenario_count,
        selected_score,
        action_type,
        selected_scenario_json,
        scenarios_json,
        executed_action_json,
        rollback_data_json,
        rollback_capable,
        outcome,
        metadata_json,
        created_at,
        rolled_back_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.id,
      result.triggeredBy,
      result.scenarios.length,
      result.selectedScenario?.totalScore ?? null,
      result.selectedScenario?.action.type ?? null,
      result.selectedScenario ? JSON.stringify(result.selectedScenario) : null,
      JSON.stringify(result.scenarios),
      result.executedAction ? JSON.stringify(result.executedAction) : null,
      rollbackData ? JSON.stringify(rollbackData) : null,
      result.rollbackCapability ? 1 : 0,
      result.outcome,
      JSON.stringify(result.metadata),
      result.createdAt,
      result.rolledBackAt,
    );

    logInfo('PredictiveDecisionEngine', `Persisted decision run ${result.id} (${result.outcome})`);
  }
}

export const predictiveDecisionEngine = new PredictiveDecisionEngine();

export async function runScheduledPredictiveDecisionCycle(
  config: Partial<MonteCarloConfig> = {},
): Promise<DecisionResult> {
  return predictiveDecisionEngine.analyzeDecisionPoint('scheduled_task', config);
}
