/**
 * HyperKernel — Autonomous coordination kernel for Phase 7
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '../utils/logger.js';
import { BrunellaKernel, type SystemSnapshot } from './BrunellaKernel.js';
import { SelfReplication } from '../mesh/selfReplication.js';
import { InfraAI } from '../infra/infraAI.js';
import { GlobalOptimizer } from '../core/globalOptimizer.js';
import { EvoEcosystem } from '../agents/evolution/EvoEcosystem.js';
import { SelfModel } from '../core/selfModel.js';
import { GoalEngine } from '../core/goalEngine.js';

export interface HyperKernelDependencies {
  kernel: BrunellaKernel;
  selfReplication: SelfReplication;
  infraAI: InfraAI;
  globalOptimizer: GlobalOptimizer;
  ecosystem: EvoEcosystem;
  selfModel: SelfModel;
  goalEngine: GoalEngine;
}

export interface HyperCycleResult {
  cycleId: string;
  reason: string;
  snapshotHealth: SystemSnapshot['health'] | 'unknown';
  kernelDirectives: number;
  infraRecommendations: number;
  optimizationDirectives: number;
  goalsCreated: number;
  goalDecisions: number;
  replicationTriggered: boolean;
  replicationPlanId?: string;
  timestamp: number;
}

export interface HyperKernelState {
  latestCycle: HyperCycleResult | null;
  cycles: HyperCycleResult[];
  stats: {
    kernel: ReturnType<BrunellaKernel['getStats']>;
    replication: ReturnType<SelfReplication['getStats']>;
    infra: ReturnType<InfraAI['getStats']>;
    optimizer: ReturnType<GlobalOptimizer['getStats']>;
    ecosystem: ReturnType<EvoEcosystem['getStats']>;
    selfModel: { coherence: number; health: string; blindSpots: number };
    goals: ReturnType<GoalEngine['getStats']>;
  };
}

export class HyperKernel extends EventEmitter {
  private readonly deps: HyperKernelDependencies;
  private readonly cycles: HyperCycleResult[] = [];
  private cycleCounter = 0;

  constructor(dependencies: HyperKernelDependencies) {
    super();
    this.deps = dependencies;
  }

  runCycle(reason = 'manual'): HyperCycleResult {
    const cycleId = `hk-${++this.cycleCounter}-${Date.now()}`;
    const snapshot = this.deps.kernel.takeSnapshot();
    const kernelDirectives = snapshot ? this.deps.kernel.evaluate(snapshot).length : 0;
    const infraAnalysis = this.deps.infraAI.analyze();
    const optimization = this.deps.globalOptimizer.optimize();

    this.deps.selfModel.ingestSignal({
      source: 'HyperKernel',
      category: 'behavior',
      confidence: 0.8,
      payload: {
        capability: 'autonomous-coordination',
        description: `Hyper cycle ${cycleId} evaluated ${optimization.directives.length} optimizer directives`,
      },
    });

    if (infraAnalysis.criticalResources.length > 0) {
      this.deps.selfModel.ingestSignal({
        source: 'InfraAI',
        category: 'risk',
        confidence: 0.82,
        payload: {
          area: infraAnalysis.criticalResources[0],
          description: `Critical infrastructure pressure detected on ${infraAnalysis.criticalResources.join(', ')}`,
          severity: 'high',
        },
      });
    }

    const model = this.deps.selfModel.reflect();
    const goalsCreated = this.deps.goalEngine.synthesizeGoals(model, optimization.forecast).length;
    const goalDecisions = this.deps.goalEngine.evaluateGoals().length;

    let replicationTriggered = false;
    let replicationPlanId: string | undefined;
    const sourceNode = this.deps.selfReplication.getNodes('active')[0];

    if (sourceNode && (snapshot?.health === 'degraded' || snapshot?.health === 'critical' || infraAnalysis.criticalResources.length > 0)) {
      const targetRegion = sourceNode.region === 'eu-central' ? 'us-east' : 'eu-central';
      const plan = this.deps.selfReplication.requestReplication(
        sourceNode.nodeId,
        targetRegion,
        `HyperKernel resilience response (${snapshot?.health ?? 'unknown'})`,
        'hyperkernel',
      );

      if (plan) {
        this.deps.selfReplication.approvePlan(plan.planId, 'hyperkernel');
        this.deps.selfReplication.executePlan(plan.planId);
        replicationTriggered = true;
        replicationPlanId = plan.planId;
      }
    }

    const result: HyperCycleResult = {
      cycleId,
      reason,
      snapshotHealth: snapshot?.health ?? 'unknown',
      kernelDirectives,
      infraRecommendations: infraAnalysis.recommendations.length,
      optimizationDirectives: optimization.directives.length,
      goalsCreated,
      goalDecisions,
      replicationTriggered,
      replicationPlanId,
      timestamp: Date.now(),
    };

    this.cycles.push(result);
    if (this.cycles.length > 100) {
      this.cycles.splice(0, this.cycles.length - 100);
    }

    this.emit('cycle', result);
    logInfo('HyperKernel', `Cycle ${cycleId} complete: goals=${goalsCreated}, directives=${optimization.directives.length}, replication=${replicationTriggered}`);
    return result;
  }

  getCycles(limit = 20): HyperCycleResult[] {
    return this.cycles.slice(-limit);
  }

  getState(): HyperKernelState {
    const selfState = this.deps.selfModel.getState();
    return {
      latestCycle: this.cycles.length > 0 ? this.cycles[this.cycles.length - 1] : null,
      cycles: this.getCycles(),
      stats: {
        kernel: this.deps.kernel.getStats(),
        replication: this.deps.selfReplication.getStats(),
        infra: this.deps.infraAI.getStats(),
        optimizer: this.deps.globalOptimizer.getStats(),
        ecosystem: this.deps.ecosystem.getStats(),
        selfModel: {
          coherence: selfState.coherence,
          health: selfState.health,
          blindSpots: selfState.blindSpots.length,
        },
        goals: this.deps.goalEngine.getStats(),
      },
    };
  }
}
