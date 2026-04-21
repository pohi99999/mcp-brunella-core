import type { AutonomousGoal } from './goalEngine.js';
import type { IntelligenceSignalRecord } from './intelligenceMonitor.js';
import type { PredictiveAlert } from './predictiveIntelligence.js';
import type { WorldPerceptionSignalRecord } from './worldPerceptionLayer.js';

export type DecisionActionType =
  | 'create_goal'
  | 'acknowledge_alert'
  | 'escalate_review';

export type DecisionSourceType =
  | 'predictive_alert'
  | 'world_signal'
  | 'review_queue';

export interface MonteCarloConfig {
  scenarioCount: number;
  riskWeight: number;
  impactWeight: number;
  alignmentWeight: number;
  selectionThreshold: number;
  seed?: number;
}

export interface DecisionAction {
  type: DecisionActionType;
  description: string;
  payload: Record<string, unknown>;
  reversible: boolean;
}

export interface DecisionCandidate {
  sourceType: DecisionSourceType;
  sourceId: string;
  title: string;
  summary: string;
  action: DecisionAction;
  riskBase: number;
  impactBase: number;
  alignmentBase: number;
}

export interface DecisionScenario {
  id: string;
  iteration: number;
  candidate: DecisionCandidate;
  action: DecisionAction;
  riskScore: number;
  impactScore: number;
  alignmentScore: number;
  totalScore: number;
  rationale: string;
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  actionType: DecisionActionType;
  description: string;
  resultData?: Record<string, unknown>;
  rollbackData?: Record<string, unknown> | null;
  error?: string;
  executedAt: string;
}

export interface RollbackResult {
  success: boolean;
  actionType: DecisionActionType;
  rollbackData?: Record<string, unknown>;
  error?: string;
  rolledBackAt: string;
}

export interface PredictiveDecisionContext {
  alerts: PredictiveAlert[];
  worldSignals: WorldPerceptionSignalRecord[];
  reviewQueue: IntelligenceSignalRecord[];
  activeGoals: AutonomousGoal[];
}

export interface DecisionMetadata {
  activeAlerts: number;
  signalCount: number;
  reviewQueueCount: number;
  activeGoals: number;
  config: MonteCarloConfig;
}

export interface DecisionResult {
  id: string;
  triggeredBy: string;
  scenarios: DecisionScenario[];
  selectedScenario: DecisionScenario | null;
  executedAction: ActionResult | null;
  rollbackCapability: boolean;
  outcome: 'executed' | 'no_action' | 'failed' | 'rolled_back';
  createdAt: string;
  rolledBackAt: string | null;
  metadata: DecisionMetadata;
}

export interface DecisionStats {
  totalDecisions: number;
  actionsExecuted: number;
  noActionDecisions: number;
  failedActions: number;
  rolledBackActions: number;
  successRate: number;
  averageScenarioCount: number;
  averageSelectedScore: number;
  actionBreakdown: Array<{
    actionType: DecisionActionType;
    count: number;
  }>;
  dateRange: {
    from: string;
    to: string;
  };
}
