/**
 * Autonomous Infrastructure Runtime — shared singletons and seed state for Phase 7
 */

import { BrunellaKernel, type SystemSnapshot } from '@packages/core-logic/BrunellaKernel.js';
import { HyperKernel } from '@packages/core-logic/HyperKernel.js';
import { SelfReplication } from '@packages/core-logic/selfReplication.js';
import { InfraAI } from '@packages/core-logic/infraAI.js';
import { GlobalOptimizer } from './globalOptimizer.js';
import { EvoEcosystem } from '@packages/agents/evolution/EvoEcosystem.js';
import { SelfModel } from './selfModel.js';
import { GoalEngine } from './goalEngine.js';
import { CopilotFeedbackChannel } from './copilotFeedbackChannel.js';

export const autonomousKernel = new BrunellaKernel({ autoOptimize: false, snapshotIntervalMs: 60_000 });
export const selfReplication = new SelfReplication({ requireApproval: false, maxReplicasPerSource: 4 });
export const infraAI = new InfraAI();
export const globalOptimizer = new GlobalOptimizer();
export const evoEcosystem = new EvoEcosystem();
export const selfModel = new SelfModel('Brunella Autonomous Infrastructure');
export const goalEngine = new GoalEngine();
export const copilotFeedbackChannel = new CopilotFeedbackChannel(selfModel);
export const hyperKernel = new HyperKernel({
  kernel: autonomousKernel,
  selfReplication,
  infraAI,
  globalOptimizer,
  ecosystem: evoEcosystem,
  selfModel,
  goalEngine,
});

let seeded = false;

export function ensureAutonomousInfraSeed(): void {
  if (seeded) return;
  seeded = true;

  selfReplication.setCapacityProvider(() => [
    { region: 'eu-central', availableSlots: 3, maxNodes: 8, latencyBudgetMs: 80 },
    { region: 'us-east', availableSlots: 2, maxNodes: 6, latencyBudgetMs: 120 },
    { region: 'ap-southeast', availableSlots: 1, maxNodes: 4, latencyBudgetMs: 190 },
  ]);

  selfReplication.registerNode({
    nodeId: 'node-alpha',
    region: 'eu-central',
    capabilities: ['chat', 'orchestration', 'resilience'],
    status: 'active',
    load: 0.76,
    resources: { cpu: 12, memoryGb: 32, storageGb: 256 },
  });
  selfReplication.registerNode({
    nodeId: 'node-beta',
    region: 'us-east',
    capabilities: ['sync', 'vector-search'],
    status: 'active',
    load: 0.41,
    resources: { cpu: 8, memoryGb: 24, storageGb: 128 },
  });

  infraAI.upsertResource({
    resourceId: 'compute-core-eu',
    kind: 'compute',
    region: 'eu-central',
    utilization: 0.91,
    costPerHour: 1.8,
    health: 'degraded',
    redundancy: 1,
  });
  infraAI.upsertResource({
    resourceId: 'queue-sync-us',
    kind: 'queue',
    region: 'us-east',
    utilization: 0.48,
    costPerHour: 0.35,
    health: 'healthy',
    redundancy: 2,
  });
  infraAI.upsertResource({
    resourceId: 'model-cache-eu',
    kind: 'storage',
    region: 'eu-central',
    utilization: 0.18,
    costPerHour: 0.7,
    health: 'healthy',
    redundancy: 2,
  });
  infraAI.reportIncident({
    incidentId: 'incident-latency-eu',
    resourceId: 'compute-core-eu',
    type: 'latency',
    severity: 'high',
    summary: 'Latency spike on primary compute core during autonomy loop',
    status: 'open',
  });

  globalOptimizer.recordSnapshot({
    throughput: 330,
    latencyMs: 180,
    errorRate: 0.02,
    costPerHour: 3.4,
    resilienceScore: 0.76,
    autonomyScore: 0.68,
    timestamp: Date.now() - 120_000,
  });
  globalOptimizer.recordSnapshot({
    throughput: 305,
    latencyMs: 240,
    errorRate: 0.035,
    costPerHour: 4.1,
    resilienceScore: 0.7,
    autonomyScore: 0.66,
    timestamp: Date.now() - 60_000,
  });
  globalOptimizer.recordSnapshot({
    throughput: 290,
    latencyMs: 265,
    errorRate: 0.058,
    costPerHour: 4.4,
    resilienceScore: 0.63,
    autonomyScore: 0.62,
  });

  evoEcosystem.registerMember({
    agentId: 'orchestrator-prime',
    niche: 'coordination',
    generation: 7,
    fitness: 0.89,
    energy: 0.77,
    status: 'active',
    lineage: ['root-orchestrator'],
  });
  evoEcosystem.registerMember({
    agentId: 'resilience-swarm',
    niche: 'resilience',
    generation: 4,
    fitness: 0.71,
    energy: 0.64,
    status: 'active',
    lineage: ['resilience-root'],
  });
  evoEcosystem.registerMember({
    agentId: 'legacy-evaluator',
    niche: 'coordination',
    generation: 2,
    fitness: 0.28,
    energy: 0.19,
    status: 'active',
    lineage: ['root-orchestrator'],
  });
  evoEcosystem.runSelection();

  selfModel.setConstraint('No destructive infrastructure mutation without explicit approval.');
  selfModel.setConstraint('Replication remains simulated unless deployment adapters are present.');
  selfModel.ingestSignal({
    source: 'GlobalOptimizer',
    category: 'performance',
    confidence: 0.78,
    payload: {
      capability: 'latency-management',
      description: 'Latency remains above target under load',
      severity: 'high',
    },
  });
  selfModel.ingestSignal({
    source: 'EvoEcosystem',
    category: 'capability',
    confidence: 0.88,
    payload: {
      capability: 'adaptive-coordination',
      description: 'Selection cycles show strong coordination fitness',
    },
  });
  selfModel.reflect();

  autonomousKernel.setSnapshotProvider((): SystemSnapshot => {
    const replication = selfReplication.analyze();
    const infraStats = infraAI.getStats();
    const optimizerForecast = globalOptimizer.forecast();
    const ecosystemStats = evoEcosystem.getStats();
    const modelState = selfModel.getState();

    const health: SystemSnapshot['health'] = infraStats.openIncidents > 0 || optimizerForecast.errorRate > 0.05
      ? 'degraded'
      : optimizerForecast.autonomyScore > 0.8
        ? 'optimal'
        : 'good';

    return {
      timestamp: Date.now(),
      agents: {
        total: ecosystemStats.members,
        active: ecosystemStats.active,
        idle: Math.max(0, ecosystemStats.active - 1),
      },
      mesh: {
        nodes: replication.activeNodes + replication.bootstrappingNodes,
        healthyNodes: replication.activeNodes,
      },
      swarms: {
        colonies: ecosystemStats.members,
        activeColonies: ecosystemStats.active,
      },
      flows: {
        registered: goalEngine.getStats().goals + globalOptimizer.getStats().directives,
        avgDurationMs: optimizerForecast.latencyMs,
      },
      cognition: {
        entries: selfModel.getSignals(100).length,
        avgConfidence: modelState.capabilities.length === 0
          ? 0.5
          : modelState.capabilities.reduce((sum, item) => sum + item.confidence, 0) / modelState.capabilities.length,
      },
      health,
    };
  });
}

