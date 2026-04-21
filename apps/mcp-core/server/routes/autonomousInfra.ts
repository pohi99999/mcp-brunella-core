/**
 * Autonomous Infrastructure API Routes
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { Router, type Request, type Response } from 'express';
import { logError, logInfo } from '../../utils/logger.js';
import {
  ensureAutonomousInfraSeed,
  hyperKernel,
  selfReplication,
  infraAI,
  globalOptimizer,
  selfModel,
  goalEngine,
  evoEcosystem,
} from '../../core/autonomousInfraRuntime.js';

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
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
        ? req.body.reason
        : 'api-trigger';
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
      const { sourceNodeId, targetRegion, reason } = req.body ?? {};
      if (typeof sourceNodeId !== 'string' || typeof targetRegion !== 'string' || typeof reason !== 'string') {
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
      const { planId } = req.params;
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
      const resource = infraAI.upsertResource(req.body);
      return res.json(resource);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/infra/incidents', (req: Request, res: Response) => {
    try {
      const incident = infraAI.reportIncident(req.body);
      return res.json(incident);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/optimizer/snapshots', (req: Request, res: Response) => {
    try {
      const snapshot = globalOptimizer.recordSnapshot(req.body);
      return res.json(snapshot);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/self-model/signals', (req: Request, res: Response) => {
    try {
      const signal = selfModel.ingestSignal(req.body);
      const state = selfModel.reflect();
      return res.json({ signal, state });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  router.post('/goals', (req: Request, res: Response) => {
    try {
      const goal = goalEngine.createGoal(req.body);
      return res.json(goal);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  return router;
}
