/**
 * Autonomous Infrastructure API Routes
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { Router, type Request, type Response } from 'express';
import { logError, logInfo } from '@packages/utils/logger.js';
import {
  ensureAutonomousInfraSeed,
  hyperKernel,
  selfReplication,
  infraAI,
  globalOptimizer,
  selfModel,
  goalEngine,
  evoEcosystem,
} from '@packages/core-logic/autonomousInfraRuntime.js';
import type { InfraIncident, InfraResource } from '@packages/core-logic/infraAI.js';
import type { OptimizationSnapshot } from '@packages/core-logic/globalOptimizer.js';
import type { SelfModelSignal } from '@packages/core-logic/selfModel.js';
import type { AutonomousGoal } from '@packages/core-logic/goalEngine.js';

type InfraResourceInput = Omit<InfraResource, 'metadata'> & { metadata?: Record<string, unknown> };
type InfraIncidentInput = Omit<InfraIncident, 'createdAt' | 'updatedAt'>;
type OptimizationSnapshotInput = Omit<OptimizationSnapshot, 'snapshotId' | 'timestamp'> & Partial<Pick<OptimizationSnapshot, 'snapshotId' | 'timestamp'>>;
type SelfModelSignalInput = Omit<SelfModelSignal, 'signalId' | 'timestamp'> & Partial<Pick<SelfModelSignal, 'signalId' | 'timestamp'>>;
type AutonomousGoalInput = Omit<AutonomousGoal, 'goalId' | 'createdAt' | 'status'> & Partial<Pick<AutonomousGoal, 'status'>>;

const RESOURCE_KINDS = new Set<InfraResource['kind']>(['compute', 'storage', 'network', 'queue', 'model']);
const RESOURCE_HEALTH = new Set<InfraResource['health']>(['healthy', 'degraded', 'failed']);
const INCIDENT_TYPES = new Set<InfraIncident['type']>(['latency', 'outage', 'capacity', 'cost_spike', 'drift']);
const INCIDENT_SEVERITIES = new Set<InfraIncident['severity']>(['low', 'medium', 'high', 'critical']);
const INCIDENT_STATUSES = new Set<InfraIncident['status']>(['open', 'mitigating', 'resolved']);
const SIGNAL_CATEGORIES = new Set<SelfModelSignal['category']>(['performance', 'behavior', 'capability', 'risk', 'goal']);
const GOAL_CATEGORIES = new Set<AutonomousGoal['category']>(['resilience', 'efficiency', 'autonomy', 'alignment', 'growth']);
const GOAL_DIRECTIONS = new Set<AutonomousGoal['direction']>(['increase', 'decrease']);
const GOAL_STATUSES = new Set<AutonomousGoal['status']>(['proposed', 'active', 'blocked', 'completed', 'abandoned']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readNonNegativeNumber(value: unknown): number | undefined {
  const parsed = readNumber(value);
  return parsed === undefined ? undefined : Math.max(0, parsed);
}

function readRatio(value: unknown): number | undefined {
  const parsed = readNumber(value);
  return parsed === undefined ? undefined : Math.min(Math.max(parsed, 0), 1);
}

function readPriority(value: unknown): number | undefined {
  const parsed = readNumber(value);
  return parsed === undefined ? undefined : Math.min(Math.max(Math.round(parsed), 0), 100);
}

function readEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  const text = readString(value);
  return text && allowed.has(text as T) ? text as T : undefined;
}

function parseResource(value: unknown): InfraResourceInput | null {
  if (!isRecord(value)) return null;
  const resourceId = readString(value.resourceId);
  const kind = readEnum(value.kind, RESOURCE_KINDS);
  const region = readString(value.region);
  const utilization = readRatio(value.utilization);
  const costPerHour = readNonNegativeNumber(value.costPerHour);
  const health = readEnum(value.health, RESOURCE_HEALTH);
  const redundancy = readNonNegativeNumber(value.redundancy);
  if (!resourceId || !kind || !region || utilization === undefined || costPerHour === undefined || !health || redundancy === undefined) {
    return null;
  }
  return {
    resourceId,
    kind,
    region,
    utilization,
    costPerHour,
    health,
    redundancy,
    metadata: isRecord(value.metadata) ? { ...value.metadata } : undefined,
  };
}

function parseIncident(value: unknown): InfraIncidentInput | null {
  if (!isRecord(value)) return null;
  const incidentId = readString(value.incidentId);
  const resourceId = readString(value.resourceId);
  const type = readEnum(value.type, INCIDENT_TYPES);
  const severity = readEnum(value.severity, INCIDENT_SEVERITIES);
  const summary = readString(value.summary);
  const status = readEnum(value.status, INCIDENT_STATUSES) ?? 'open';
  if (!incidentId || !resourceId || !type || !severity || !summary) return null;
  return { incidentId, resourceId, type, severity, summary, status };
}

function parseSnapshot(value: unknown): OptimizationSnapshotInput | null {
  if (!isRecord(value)) return null;
  const throughput = readNonNegativeNumber(value.throughput);
  const latencyMs = readNonNegativeNumber(value.latencyMs);
  const errorRate = readRatio(value.errorRate);
  const costPerHour = readNonNegativeNumber(value.costPerHour);
  const resilienceScore = readRatio(value.resilienceScore);
  const autonomyScore = readRatio(value.autonomyScore);
  if (throughput === undefined || latencyMs === undefined || errorRate === undefined || costPerHour === undefined || resilienceScore === undefined || autonomyScore === undefined) {
    return null;
  }
  return {
    snapshotId: readString(value.snapshotId),
    timestamp: readNonNegativeNumber(value.timestamp),
    throughput,
    latencyMs,
    errorRate,
    costPerHour,
    resilienceScore,
    autonomyScore,
  };
}

function parseSignal(value: unknown): SelfModelSignalInput | null {
  if (!isRecord(value)) return null;
  const source = readString(value.source);
  const category = readEnum(value.category, SIGNAL_CATEGORIES);
  const confidence = readRatio(value.confidence);
  const payload = isRecord(value.payload) ? { ...value.payload } : undefined;
  if (!source || !category || confidence === undefined || !payload) return null;
  return {
    signalId: readString(value.signalId),
    timestamp: readNonNegativeNumber(value.timestamp),
    source,
    category,
    confidence,
    payload,
  };
}

function parseGoal(value: unknown): AutonomousGoalInput | null {
  if (!isRecord(value)) return null;
  const title = readString(value.title);
  const category = readEnum(value.category, GOAL_CATEGORIES);
  const metric = readString(value.metric);
  const direction = readEnum(value.direction, GOAL_DIRECTIONS);
  const targetValue = readNumber(value.targetValue);
  const currentValue = readNumber(value.currentValue);
  const priority = readPriority(value.priority);
  const rationale = readString(value.rationale);
  const status = readEnum(value.status, GOAL_STATUSES);
  if (!title || !category || !metric || !direction || targetValue === undefined || currentValue === undefined || priority === undefined || !rationale) {
    return null;
  }
  return { title, category, metric, direction, targetValue, currentValue, priority, rationale, status };
}

export function createAutonomousInfraRouter(): Router {
  const router = Router();

  router.use((_req, _res, next) => {
    ensureAutonomousInfraSeed();
    next();
  });

  router.get('/state', (_req: Request, res: Response) => {
    try {
      return res.json({
        hyperKernel: hyperKernel.getState(),
        replication: {
          analysis: selfReplication.analyze(),
          nodes: selfReplication.getNodes(),
          plans: selfReplication.getPlans(),
        },
        infra: infraAI.analyze(),
        optimizer: {
          forecast: globalOptimizer.forecast(),
          snapshots: globalOptimizer.getSnapshots(),
          directives: globalOptimizer.getDirectives(),
        },
        ecosystem: {
          members: evoEcosystem.getMembers(),
          decisions: evoEcosystem.getDecisions(),
          stats: evoEcosystem.getStats(),
        },
        selfModel: {
          state: selfModel.getState(),
          recentSignals: selfModel.getSignals(),
        },
        goals: {
          items: goalEngine.getGoals(),
          decisions: goalEngine.getDecisions(),
          stats: goalEngine.getStats(),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('AutonomousInfraAPI', `State retrieval failed: ${message}`);
      return res.status(500).json({ error: message });
    }
  });

  router.post('/hyperkernel/cycle', (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const reason = readString(body.reason) ?? 'api-trigger';
      const result = hyperKernel.runCycle(reason);
      logInfo('AutonomousInfraAPI', `Hyper cycle executed: ${result.cycleId}`);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  router.post('/self-replication/plan', (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const sourceNodeId = readString(body.sourceNodeId);
      const targetRegion = readString(body.targetRegion);
      const reason = readString(body.reason);
      if (!sourceNodeId || !targetRegion || !reason) {
        return res.status(400).json({ error: 'sourceNodeId, targetRegion and reason are required' });
      }
      const plan = selfReplication.requestReplication(sourceNodeId, targetRegion, reason, 'api');
      if (!plan) {
        return res.status(409).json({ error: 'Replication plan could not be created under current policy' });
      }
      return res.json(plan);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  router.post('/self-replication/plan/:planId/execute', (req: Request<{ planId: string }>, res: Response) => {
    try {
      const planId = readString(req.params.planId);
      if (!planId) {
        return res.status(400).json({ error: 'planId is required' });
      }
      selfReplication.approvePlan(planId, 'api');
      const node = selfReplication.executePlan(planId);
      if (!node) {
        return res.status(409).json({ error: 'Plan execution failed or plan is not executable' });
      }
      selfReplication.completeBootstrap(planId, true, 'API bootstrap simulation succeeded');
      return res.json({ plan: selfReplication.getPlan(planId), node: selfReplication.getNode(node.nodeId) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  });

  router.post('/infra/resources', (req: Request, res: Response) => {
    try {
      const input = parseResource(req.body);
      if (!input) {
        return res.status(400).json({ error: 'Invalid resource payload' });
      }
      const resource = infraAI.upsertResource(input);
      return res.json(resource);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/infra/incidents', (req: Request, res: Response) => {
    try {
      const input = parseIncident(req.body);
      if (!input) {
        return res.status(400).json({ error: 'Invalid incident payload' });
      }
      const incident = infraAI.reportIncident(input);
      return res.json(incident);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/optimizer/snapshots', (req: Request, res: Response) => {
    try {
      const input = parseSnapshot(req.body);
      if (!input) {
        return res.status(400).json({ error: 'Invalid optimizer snapshot payload' });
      }
      const snapshot = globalOptimizer.recordSnapshot(input);
      return res.json(snapshot);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/self-model/signals', (req: Request, res: Response) => {
    try {
      const input = parseSignal(req.body);
      if (!input) {
        return res.status(400).json({ error: 'Invalid self-model signal payload' });
      }
      const signal = selfModel.ingestSignal(input);
      const state = selfModel.reflect();
      return res.json({ signal, state });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/goals', (req: Request, res: Response) => {
    try {
      const input = parseGoal(req.body);
      if (!input) {
        return res.status(400).json({ error: 'Invalid autonomous goal payload' });
      }
      const goal = goalEngine.createGoal(input);
      return res.json(goal);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  return router;
}
