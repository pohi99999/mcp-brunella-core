/**
 * Copilot Orchestrator Bridge
 *
 * Model-agnostic bridge that exposes the full BAS agent network to GitHub Copilot CLI.
 * Maintains an in-memory log of all orchestration steps so the dashboard panel can
 * display real-time activity without a separate database table.
 *
 * Architecture note: This module is intentionally side-effect-free on import.
 * The singleton `copilotOrchestratorBridge` is the only exported instance.
 */

import { logInfo, logError } from '../utils/logger.js';

const TAG = 'CopilotOrchestratorBridge';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrchestratorStepStatus = 'running' | 'success' | 'error' | 'skipped';

export interface OrchestratorStep {
  id: string;
  step: string;
  status: OrchestratorStepStatus;
  detail?: string;
  /** Target agent or API endpoint this step delegated to */
  delegateTo?: string;
  /** Estimated confidence score [0–1] for the delegation decision */
  confidence?: number;
  /** Active LLM model at time of step (informational only, not used for routing) */
  model?: string;
  startedAt: number;
  completedAt?: number;
}

export interface OrchestratorSession {
  id: string;
  startedAt: number;
  steps: OrchestratorStep[];
  status: 'active' | 'completed' | 'failed';
  summary?: string;
}

export interface OrchestratorStats {
  totalSessions: number;
  activeSessions: number;
  totalSteps: number;
  successSteps: number;
  errorSteps: number;
  recentSessions: OrchestratorSession[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Bridge class ──────────────────────────────────────────────────────────────

class CopilotOrchestratorBridge {
  /** Cap in-memory history to avoid unbounded growth */
  private static readonly MAX_SESSIONS = 100;

  private sessions: Map<string, OrchestratorSession> = new Map();

  // ── Session management ────────────────────────────────────────────

  startSession(): OrchestratorSession {
    const session: OrchestratorSession = {
      id: makeId('orch-sess'),
      startedAt: Date.now(),
      steps: [],
      status: 'active',
    };
    this.sessions.set(session.id, session);
    this.pruneOldSessions();
    logInfo(TAG, `Session started: ${session.id}`);
    return session;
  }

  completeSession(sessionId: string, summary?: string): OrchestratorSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'completed';
    session.summary = summary;
    logInfo(TAG, `Session completed: ${sessionId}`);
    return session;
  }

  failSession(sessionId: string, reason?: string): OrchestratorSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'failed';
    session.summary = reason;
    logError(TAG, `Session failed: ${sessionId} — ${reason ?? 'unknown reason'}`);
    return session;
  }

  getSession(sessionId: string): OrchestratorSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  // ── Step management ───────────────────────────────────────────────

  /**
   * Log a new orchestration step.
   *
   * Can either belong to an existing session (when sessionId is provided)
   * or create an ephemeral session automatically.
   */
  addStep(params: {
    sessionId?: string;
    step: string;
    status?: OrchestratorStepStatus;
    detail?: string;
    delegateTo?: string;
    confidence?: number;
    model?: string;
  }): OrchestratorStep {
    let session: OrchestratorSession;

    if (params.sessionId) {
      const existing = this.sessions.get(params.sessionId);
      if (!existing) {
        // Auto-create session under provided id
        session = { id: params.sessionId, startedAt: Date.now(), steps: [], status: 'active' };
        this.sessions.set(session.id, session);
      } else {
        session = existing;
      }
    } else {
      // Auto-create an anonymous session for one-off steps
      session = this.startSession();
    }

    const stepObj: OrchestratorStep = {
      id: makeId('step'),
      step: params.step,
      status: params.status ?? 'running',
      detail: params.detail,
      delegateTo: params.delegateTo,
      confidence: params.confidence,
      model: params.model,
      startedAt: Date.now(),
    };

    session.steps.push(stepObj);
    logInfo(TAG, `Step [${session.id}] ${params.step} → ${stepObj.status}`);
    return stepObj;
  }

  updateStep(
    sessionId: string,
    stepId: string,
    update: Partial<Pick<OrchestratorStep, 'status' | 'detail' | 'completedAt' | 'model'>>,
  ): OrchestratorStep | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const step = session.steps.find((s) => s.id === stepId);
    if (!step) return null;

    Object.assign(step, update);
    if (update.status && update.status !== 'running') {
      step.completedAt = step.completedAt ?? Date.now();
    }
    return step;
  }

  // ── Query ─────────────────────────────────────────────────────────

  getStats(): OrchestratorStats {
    const allSessions = Array.from(this.sessions.values());
    const allSteps = allSessions.flatMap((s) => s.steps);

    return {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter((s) => s.status === 'active').length,
      totalSteps: allSteps.length,
      successSteps: allSteps.filter((s) => s.status === 'success').length,
      errorSteps: allSteps.filter((s) => s.status === 'error').length,
      recentSessions: allSessions
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 20),
    };
  }

  getRecentSteps(limit = 50): OrchestratorStep[] {
    return Array.from(this.sessions.values())
      .flatMap((s) => s.steps)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, Math.min(limit, 200));
  }

  // ── Internal ──────────────────────────────────────────────────────

  private pruneOldSessions(): void {
    if (this.sessions.size <= CopilotOrchestratorBridge.MAX_SESSIONS) return;

    const sorted = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => a.startedAt - b.startedAt);

    const toRemove = sorted.slice(0, sorted.length - CopilotOrchestratorBridge.MAX_SESSIONS);
    for (const [id] of toRemove) {
      this.sessions.delete(id);
    }
  }
}

/** Singleton — do not instantiate a second CopilotOrchestratorBridge. */
export const copilotOrchestratorBridge = new CopilotOrchestratorBridge();
