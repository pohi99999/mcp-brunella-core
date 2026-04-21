/**
 * ReflectionEngine — Self-reflection loop for agent learning
 * 
 * After task completion, evaluates performance, extracts lessons,
 * and persists them to GraphRAG + SelfModel for continuous improvement.
 * 
 * Architecture:
 *   Task completed → evaluate(outcome) → extract lessons → persist to GraphRAG
 *   → update SelfModel signals → inform future decisions
 * 
 * Wraps: SelfModel (capability tracking) + MetaReasoner (decision analysis)
 */

import { SelfModel, type SelfModelSignal } from './selfModel.js';
import { MetaReasoner, type DecisionRecord, type MetaInsight } from './metaReasoner.js';
import { GraphRagEngine } from './graphRagEngine.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaskOutcome {
  taskId: string | number;
  agent: string;
  task: string;
  result: 'success' | 'failure' | 'partial';
  output: string;
  durationMs: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface ReflectionResult {
  taskId: string | number;
  qualityScore: number;      // 0-1
  lessons: string[];
  improvements: string[];
  selfModelUpdated: boolean;
  metaInsights: MetaInsight[];
}

export interface ReflectionStats {
  totalReflections: number;
  avgQualityScore: number;
  totalLessons: number;
  selfModelHealth: string;
  metaReasonerStats: { decisions: number; insights: number; sessions: number };
}

// ─── Reflection Engine ───────────────────────────────────────────────────────

export class ReflectionEngine {
  private static instance: ReflectionEngine | null = null;
  private selfModel: SelfModel;
  private metaReasoner: MetaReasoner;
  private reflectionCount = 0;
  private totalQuality = 0;
  private totalLessons = 0;

  private constructor() {
    this.selfModel = new SelfModel('Brunella Orchestrator');
    this.metaReasoner = new MetaReasoner();

    // Set core constraints
    this.selfModel.setConstraint('Mindig magyarul válaszolj');
    this.selfModel.setConstraint('Ne hajtsd végre valódi műveletet jóváhagyás nélkül magas kockázat esetén');
    this.selfModel.setConstraint('Logolj mindent, de ne tedd ki titkokat');
  }

  static getInstance(): ReflectionEngine {
    if (!ReflectionEngine.instance) {
      ReflectionEngine.instance = new ReflectionEngine();
    }
    return ReflectionEngine.instance;
  }

  /**
   * Reflect on a completed task — evaluate quality, extract lessons, update models.
   * Called after each agent task completion.
   */
  async reflect(outcome: TaskOutcome): Promise<ReflectionResult> {
    this.reflectionCount++;
    const qualityScore = this.evaluateQuality(outcome);
    const lessons = this.extractLessons(outcome, qualityScore);
    const improvements = this.suggestImprovements(outcome, qualityScore);

    // 1. Record decision in MetaReasoner
    this.metaReasoner.recordDecision({
      decisionMaker: outcome.agent,
      action: outcome.task,
      context: {
        taskId: outcome.taskId,
        durationMs: outcome.durationMs,
        outputLength: outcome.output.length,
        ...outcome.metadata,
      },
      outcome: outcome.result,
      outcomeDetails: outcome.errorMessage || outcome.output.slice(0, 200),
      metrics: {
        quality: qualityScore,
        durationMs: outcome.durationMs,
        outputLength: outcome.output.length,
      },
    });

    // 2. Update SelfModel with performance signal
    this.selfModel.ingestSignal({
      source: outcome.agent,
      category: outcome.result === 'failure' ? 'risk' : 'performance',
      confidence: qualityScore,
      payload: {
        capability: outcome.agent,
        area: outcome.task.slice(0, 50),
        quality: qualityScore,
        result: outcome.result,
        severity: qualityScore < 0.3 ? 'high' : qualityScore < 0.6 ? 'medium' : 'low',
        description: outcome.result === 'failure'
          ? `Hiba: ${outcome.errorMessage || 'ismeretlen'}`
          : `Sikeres végrehajtás (minőség: ${(qualityScore * 100).toFixed(0)}%)`,
      },
    });

    // 3. Persist lessons to GraphRAG
    const graphRag = GraphRagEngine.getInstance();
    for (const lesson of lessons) {
      graphRag.storeLesson(
        `reflection-${outcome.taskId}`,
        outcome.agent,
        outcome.task,
        lesson,
        qualityScore,
      );
    }

    // 4. Run MetaReasoner periodically (every 10 reflections)
    let metaInsights: MetaInsight[] = [];
    if (this.reflectionCount % 10 === 0) {
      metaInsights = this.metaReasoner.reason();
      if (metaInsights.length > 0) {
        logInfo('ReflectionEngine', `MetaReasoner: ${metaInsights.length} insight(s) — ${metaInsights.map(i => i.description.slice(0, 40)).join('; ')}`);
      }
    }

    // 5. Self-reflect periodically (every 20 reflections)
    let selfModelUpdated = false;
    if (this.reflectionCount % 20 === 0) {
      this.selfModel.reflect();
      selfModelUpdated = true;
      const state = this.selfModel.getState();
      logInfo('ReflectionEngine', `SelfModel reflection: health=${state.health}, coherence=${state.coherence.toFixed(2)}, blindSpots=${state.blindSpots.length}`);
    }

    this.totalQuality += qualityScore;
    this.totalLessons += lessons.length;

    logInfo('ReflectionEngine', `Reflected on [${outcome.agent}] ${outcome.task.slice(0, 40)}: quality=${(qualityScore * 100).toFixed(0)}%, lessons=${lessons.length}`);

    return {
      taskId: outcome.taskId,
      qualityScore,
      lessons,
      improvements,
      selfModelUpdated,
      metaInsights,
    };
  }

  /**
   * Evaluate quality of a task outcome (0-1 score).
   */
  private evaluateQuality(outcome: TaskOutcome): number {
    let score = 0.5; // baseline

    // Result factor
    if (outcome.result === 'success') score += 0.3;
    else if (outcome.result === 'partial') score += 0.1;
    else score -= 0.3;

    // Duration factor (faster is better, up to a point)
    if (outcome.durationMs < 5000) score += 0.1;
    else if (outcome.durationMs > 60000) score -= 0.1;

    // Output factor (non-empty output is good)
    if (outcome.output.length > 50) score += 0.05;
    if (outcome.output.length > 500) score += 0.05;

    // Error penalty
    if (outcome.errorMessage) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Extract actionable lessons from outcome.
   */
  private extractLessons(outcome: TaskOutcome, qualityScore: number): string[] {
    const lessons: string[] = [];

    if (outcome.result === 'failure') {
      lessons.push(
        `${outcome.agent} nem tudta elvégezni: "${outcome.task.slice(0, 80)}" — ok: ${outcome.errorMessage || 'ismeretlen'}`,
      );
      if (outcome.durationMs > 30000) {
        lessons.push(`${outcome.agent} túl sokáig futott (${(outcome.durationMs / 1000).toFixed(1)}s) mielőtt hibázott — időkorlát csökkentés javasolt`);
      }
    }

    if (outcome.result === 'success' && qualityScore > 0.8) {
      lessons.push(
        `${outcome.agent} kiválóan teljesített ("${outcome.task.slice(0, 60)}") — ez a feladattípus jól passzol hozzá`,
      );
    }

    if (outcome.result === 'partial') {
      lessons.push(
        `${outcome.agent} csak részben végezte el: "${outcome.task.slice(0, 60)}" — érdemes lehet más ágenssel kiegészíteni`,
      );
    }

    return lessons;
  }

  /**
   * Suggest improvements based on outcome patterns.
   */
  private suggestImprovements(outcome: TaskOutcome, qualityScore: number): string[] {
    const improvements: string[] = [];

    if (qualityScore < 0.4) {
      improvements.push(`Fontold meg más ágens használatát a "${outcome.task.slice(0, 40)}" típusú feladatokra`);
    }

    if (outcome.durationMs > 30000 && outcome.result === 'success') {
      improvements.push('A feladat sikeres de lassú — párhuzamos feldolgozás javíthatná a sebességet');
    }

    if (outcome.result === 'failure' && outcome.errorMessage?.includes('timeout')) {
      improvements.push('Timeout hiba — növeld a limitet vagy bontsd kisebb részekre a feladatot');
    }

    return improvements;
  }

  /**
   * Get context summary for system prompt enrichment.
   * Provides recent insights and blind spots to help the orchestrator make better decisions.
   */
  getReflectionContext(): string {
    const selfState = this.selfModel.getState();
    const recentInsights = this.metaReasoner.getInsights().slice(-5);
    const parts: string[] = [];

    if (selfState.blindSpots.length > 0) {
      const blindSpotsSummary = selfState.blindSpots
        .slice(0, 3)
        .map(b => `${b.area} (${b.severity})`)
        .join(', ');
      parts.push(`⚠️ Ismert gyengeségek: ${blindSpotsSummary}`);
    }

    if (selfState.capabilities.length > 0) {
      const topCapabilities = selfState.capabilities
        .filter(c => c.state === 'confident')
        .slice(0, 3)
        .map(c => c.capability)
        .join(', ');
      if (topCapabilities) {
        parts.push(`✅ Erősségek: ${topCapabilities}`);
      }
    }

    if (recentInsights.length > 0) {
      const insightsSummary = recentInsights
        .map(i => `[${i.category}] ${i.description.slice(0, 60)}`)
        .join('; ');
      parts.push(`🧠 Meta-insight-ok: ${insightsSummary}`);
    }

    parts.push(`📈 Rendszer koherencia: ${(selfState.coherence * 100).toFixed(0)}% (${selfState.health})`);

    return parts.length > 0
      ? `\n🔄 Reflexiós kontextus:\n${parts.join('\n')}`
      : '';
  }

  /** Get stats */
  getStats(): ReflectionStats {
    return {
      totalReflections: this.reflectionCount,
      avgQualityScore: this.reflectionCount > 0 ? this.totalQuality / this.reflectionCount : 0,
      totalLessons: this.totalLessons,
      selfModelHealth: this.selfModel.getState().health,
      metaReasonerStats: this.metaReasoner.getStats(),
    };
  }

  /** Get SelfModel state for monitoring */
  getSelfModelState() { return this.selfModel.getState(); }

  /** Get MetaReasoner insights */
  getMetaInsights(category?: 'pattern' | 'anomaly' | 'recommendation' | 'warning') {
    return this.metaReasoner.getInsights(category);
  }

  /**
   * Detect recurring pain points — agents or task categories that repeatedly fail.
   * Returns patterns sorted by severity (most problematic first).
   */
  detectPainPoints(): PainPoint[] {
    const decisions = this.metaReasoner.getDecisions();
    const failureMap = new Map<string, { agent: string; count: number; errors: string[] }>();

    for (const d of decisions) {
      if (d.outcome === 'failure') {
        const key = d.decisionMaker;
        const entry = failureMap.get(key) ?? { agent: key, count: 0, errors: [] };
        entry.count++;
        if (d.outcomeDetails) entry.errors.push(d.outcomeDetails.slice(0, 80));
        failureMap.set(key, entry);
      }
    }

    const total = decisions.length;
    const painPoints: PainPoint[] = [];

    for (const [, entry] of failureMap) {
      const failureRate = total > 0 ? entry.count / total : 0;
      if (entry.count >= 2) {
        const topErrors = [...new Set(entry.errors)].slice(0, 3);
        painPoints.push({
          agent: entry.agent,
          failureCount: entry.count,
          failureRate,
          severity: failureRate > 0.5 ? 'high' : failureRate > 0.25 ? 'medium' : 'low',
          topErrors,
          recommendation: `Fontold meg ${entry.agent} helyett alternatív ágens használatát, vagy növeld a retry limitet.`,
        });
      }
    }

    return painPoints.sort((a, b) => b.failureCount - a.failureCount);
  }

  /**
   * Run nightly learning cycle — forced MetaReasoner reasoning, SelfModel full reflection,
   * pain point detection, and consolidated log.
   * Should be called by ScheduledTasksRunner at 02:00 daily.
   */
  async runNightlyCycle(): Promise<NightlyCycleResult> {
    logInfo('ReflectionEngine', 'Nightly learning cycle started...');

    // 1. Force MetaReasoner reasoning
    const insights = this.metaReasoner.reason();

    // 2. Force SelfModel full reflection
    this.selfModel.reflect();
    const selfState = this.selfModel.getState();

    // 3. Detect pain points
    const painPoints = this.detectPainPoints();

    // 4. Persist consolidated lesson to GraphRAG
    const graphRag = GraphRagEngine.getInstance();
    if (painPoints.length > 0) {
      graphRag.storeLesson(
        `nightly-cycle-${Date.now()}`,
        'ReflectionEngine',
        'nightly_learning_cycle',
        `Visszatérő problémák (${painPoints.length} pattern): ${painPoints.map(p => `${p.agent} (${p.failureCount}x, ${p.severity})`).join('; ')}`,
        0.7,
      );
    }

    const stats = this.getStats();
    logInfo(
      'ReflectionEngine',
      `Nightly cycle done: ${insights.length} insights, ${painPoints.length} pain points, health=${selfState.health}, reflections=${stats.totalReflections}`,
    );

    return {
      insights,
      painPoints,
      selfModelHealth: selfState.health,
      coherence: selfState.coherence,
      stats,
      ranAt: new Date().toISOString(),
    };
  }

  ingestProjectMaintainerReport(report: unknown): void {
    // Store the maintainer report as a TaskOutcome reflection
    try {
      if (report && typeof report === 'object') {
        const r = report as Record<string, unknown>;
        this.reflect({
          taskId: `pm-report-${Date.now()}`,
          agent: 'ProjectMaintainerAgent',
          task: String(r['action'] ?? 'maintainer-report'),
          result: r['status'] === 'error' ? 'failure' : 'success',
          output: String(r['message'] ?? ''),
          durationMs: 0,
          errorMessage: r['status'] === 'error' ? String(r['message'] ?? 'unknown') : undefined,
          metadata: r,
        }).catch(() => undefined);
      }
    } catch {
      // Non-critical: ingestion failure should not break the route
    }
  }
}

// ─── Exported types ───────────────────────────────────────────────────────────

export interface PainPoint {
  agent: string;
  failureCount: number;
  failureRate: number;
  severity: 'low' | 'medium' | 'high';
  topErrors: string[];
  recommendation: string;
}

export interface NightlyCycleResult {
  insights: MetaInsight[];
  painPoints: PainPoint[];
  selfModelHealth: string;
  coherence: number;
  stats: ReflectionStats;
  ranAt: string;
}

