/**
 * CopilotFeedbackChannel — Bridge between Copilot CLI Code-review agent output
 * and Brunella's internal learning loop (SelfModel → ReflectionEngine).
 *
 * Implements the Gödel-agent feedback pattern: external Copilot CLI reviews
 * are translated into SelfModelSignals, closing the Data Flywheel cycle.
 */

import { logInfo, logError } from '../utils/logger.js';
import { SelfModel, type SelfModelSignal } from './selfModel.js';
import { reflect as cognitiveReflect } from './copilotCognitiveBridge.js';
import { saveMemory } from './structuredMemory.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReviewSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface CopilotReviewFinding {
  /** EPP v2 rule code or free-form category, e.g. "EPP-v2-1" or "type-safety" */
  ruleId: string;
  /** File path relative to workspace root */
  filePath: string;
  /** Optional 1-based line number */
  line?: number;
  /** Human-readable description of the finding */
  message: string;
  severity: ReviewSeverity;
}

export interface CopilotReviewFeedback {
  /** Conductor track ID that triggered this review, e.g. "copilot_self_improvement_loop_20260406" */
  trackId: string;
  /** Copilot CLI SDLC phase, e.g. "reviewer" */
  phase: string;
  /** ISO-8601 timestamp of when the review ran */
  reviewedAt: string;
  /** Summary paragraph from the Code-review agent */
  summary: string;
  findings: CopilotReviewFinding[];
  /** Overall quality score 0.0–1.0 assigned by the Code-review agent */
  qualityScore: number;
}

export interface FeedbackIngestionResult {
  /** Number of SelfModelSignals emitted */
  signalsEmitted: number;
  /** Number of findings that crossed the severity threshold */
  findingsProcessed: number;
  /** Whether reflectionEngine.ingestProjectMaintainerReport() was called */
  reflectionTriggered: boolean;
  /** Whether cognitive bridge (GoldenDataset/MetaReasoner/GraphRAG) was invoked */
  cognitiveReflectSucceeded: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Severity → SelfModel mapping
// ---------------------------------------------------------------------------

const SEVERITY_TO_CONFIDENCE: Record<ReviewSeverity, number> = {
  CRITICAL: 0.95,
  HIGH: 0.80,
  MEDIUM: 0.60,
  LOW: 0.40,
  INFO: 0.20,
};

const SEVERITY_TO_RISK: Record<ReviewSeverity, 'high' | 'medium' | 'low'> = {
  CRITICAL: 'high',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'low',
};

// ---------------------------------------------------------------------------
// CopilotFeedbackChannel
// ---------------------------------------------------------------------------

/**
 * CopilotFeedbackChannel receives structured feedback from the Copilot CLI
 * Code-review agent and translates it into SelfModelSignals for the internal
 * learning loop.
 *
 * Usage:
 * ```ts
 * import { copilotFeedbackChannel } from './autonomousInfraRuntime.js';
 * await copilotFeedbackChannel.ingest(reviewFeedback);
 * ```
 */
export class CopilotFeedbackChannel {
  private readonly selfModel: SelfModel;
  private readonly ingestionLog: FeedbackIngestionResult[] = [];

  /** Minimum severity level to emit a SelfModelSignal (inclusive) */
  private readonly minSeverity: ReviewSeverity;

  constructor(selfModel: SelfModel, minSeverity: ReviewSeverity = 'MEDIUM') {
    this.selfModel = selfModel;
    this.minSeverity = minSeverity;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Ingest a CopilotReviewFeedback payload.
   *
   * 1. Translates each qualifying finding into a SelfModelSignal (direct → HyperKernel SelfModel)
   * 2. Emits an aggregate "code-review-summary" signal
   * 3. Delegates to copilotCognitiveBridge.reflect() for GoldenDataset/MetaReasoner/GraphRAG
   * 4. Persists high-quality reviews (≥0.7) in the structured memory pattern cache
   * 5. Triggers SelfModel reflection when systemic issues are detected
   */
  async ingest(feedback: CopilotReviewFeedback): Promise<FeedbackIngestionResult> {
    logInfo('CopilotFeedbackChannel', `Ingesting review for track=${feedback.trackId} phase=${feedback.phase} findings=${feedback.findings.length}`);

    let signalsEmitted = 0;
    let findingsProcessed = 0;

    const qualifyingSeverities = this.getQualifyingSeverities();

    for (const finding of feedback.findings) {
      if (!qualifyingSeverities.has(finding.severity)) continue;
      findingsProcessed++;

      const signal = this.buildFindingSignal(finding, feedback);
      this.selfModel.ingestSignal(signal);
      signalsEmitted++;
    }

    // Emit aggregate quality signal
    const summarySignal = this.buildSummarySignal(feedback);
    this.selfModel.ingestSignal(summarySignal);
    signalsEmitted++;

    // Thin adapter: delegate to cognitive bridge for GoldenDataset/MetaReasoner/GraphRAG/ReflectionEngine
    // This reuses the existing learning-loop hooks rather than duplicating them.
    let cognitiveReflectSucceeded = false;
    try {
      await cognitiveReflect({
        taskId: `copilot-review-${feedback.trackId}-${Date.parse(feedback.reviewedAt)}`,
        agentName: 'CopilotCLI/code-review',
        task: `Code review: track=${feedback.trackId} phase=${feedback.phase}`,
        result: feedback.summary,
        success: feedback.qualityScore >= 0.5,
        confidence: feedback.qualityScore,
      });
      cognitiveReflectSucceeded = true;
    } catch (err: unknown) {
      logError('CopilotFeedbackChannel', `Cognitive bridge delegation failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Persist pattern cache for high-quality successful reviews
    if (feedback.qualityScore >= 0.7) {
      try {
        saveMemory({
          agentName: 'CopilotCLI/code-review',
          task: `code-review:${feedback.trackId}:${feedback.phase}`,
          result: {
            summary: feedback.summary,
            qualityScore: feedback.qualityScore,
            findingCount: feedback.findings.length,
            trackId: feedback.trackId,
          },
          confidence: feedback.qualityScore,
          status: 'success',
          ttlDays: 90,
        });
      } catch (err: unknown) {
        logError('CopilotFeedbackChannel', `saveMemory failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Trigger SelfModel reflection when review indicates systemic issues
    let reflectionTriggered = false;
    if (feedback.qualityScore < 0.6 || findingsProcessed >= 3) {
      reflectionTriggered = this.triggerReflection(feedback);
    }

    const result: FeedbackIngestionResult = {
      signalsEmitted,
      findingsProcessed,
      reflectionTriggered,
      cognitiveReflectSucceeded,
      timestamp: Date.now(),
    };

    this.ingestionLog.push(result);
    if (this.ingestionLog.length > 50) {
      this.ingestionLog.splice(0, this.ingestionLog.length - 50);
    }

    logInfo('CopilotFeedbackChannel', `Ingestion complete: signals=${signalsEmitted} findings=${findingsProcessed} reflection=${reflectionTriggered} cognitiveReflect=${cognitiveReflectSucceeded}`);
    return result;
  }

  /** Returns a copy of recent ingestion results for diagnostics */
  getIngestionLog(limit = 10): FeedbackIngestionResult[] {
    return this.ingestionLog.slice(-limit).map(r => ({ ...r }));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getQualifyingSeverities(): Set<ReviewSeverity> {
    const order: ReviewSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const minIndex = order.indexOf(this.minSeverity);
    return new Set(order.slice(0, minIndex + 1));
  }

  private buildFindingSignal(
    finding: CopilotReviewFinding,
    feedback: CopilotReviewFeedback,
  ): Omit<SelfModelSignal, 'signalId' | 'timestamp'> {
    return {
      source: `CopilotCLI/code-review/${feedback.trackId}`,
      category: 'risk',
      confidence: SEVERITY_TO_CONFIDENCE[finding.severity],
      payload: {
        capability: this.ruleToCapability(finding.ruleId),
        description: finding.message,
        severity: SEVERITY_TO_RISK[finding.severity],
        ruleId: finding.ruleId,
        filePath: finding.filePath,
        line: finding.line ?? null,
        trackId: feedback.trackId,
        phase: feedback.phase,
        copilotSeverity: finding.severity,
      },
    };
  }

  private buildSummarySignal(
    feedback: CopilotReviewFeedback,
  ): Omit<SelfModelSignal, 'signalId' | 'timestamp'> {
    const category = feedback.qualityScore >= 0.8 ? 'capability' : 'performance';
    return {
      source: `CopilotCLI/code-review-summary/${feedback.trackId}`,
      category,
      confidence: feedback.qualityScore,
      payload: {
        capability: 'code-review-quality',
        description: feedback.summary,
        qualityScore: feedback.qualityScore,
        totalFindings: feedback.findings.length,
        trackId: feedback.trackId,
        phase: feedback.phase,
      },
    };
  }

  /**
   * Attempts to call reflectionEngine.ingestProjectMaintainerReport().
   * Uses dynamic import to avoid circular-dependency issues at module load time.
   */
  private triggerReflection(feedback: CopilotReviewFeedback): boolean {
    try {
      // Synchronous reflection via selfModel — always available
      const state = this.selfModel.reflect();
      logInfo(
        'CopilotFeedbackChannel',
        `Reflection triggered: health=${state.health} coherence=${state.coherence.toFixed(2)} ` +
        `blindSpots=${state.blindSpots.length} (trackId=${feedback.trackId})`,
      );
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logError('CopilotFeedbackChannel', `Reflection trigger failed: ${message}`);
      return false;
    }
  }

  /**
   * Maps a ruleId / category string to a human-readable capability name.
   * EPP v2 rules get descriptive names; free-form rules are normalised.
   */
  private ruleToCapability(ruleId: string): string {
    const epp: Record<string, string> = {
      'EPP-v2-1': 'type-safety',
      'EPP-v2-2': 'error-handling',
      'EPP-v2-3': 'agent-lifecycle',
      'EPP-v2-4': 'test-coverage',
      'EPP-v2-5': 'logging-standards',
      'EPP-v2-6': 'cli-dashboard-parity',
      'EPP-v2-7': 'documentation',
    };
    return epp[ruleId] ?? ruleId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
}
