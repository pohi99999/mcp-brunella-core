import { describe, it, expect, beforeEach } from 'vitest';
import { SelfReplication } from '../src/mesh/selfReplication.js';
import { InfraAI } from '../src/infra/infraAI.js';
import { GlobalOptimizer } from '../src/core/globalOptimizer.js';
import { EvoEcosystem } from '../src/agents/evolution/EvoEcosystem.js';
import { SelfModel } from '../src/core/selfModel.js';
import { GoalEngine } from '../src/core/goalEngine.js';
import { BrunellaKernel } from '../src/kernel/BrunellaKernel.js';
import { HyperKernel } from '../src/kernel/HyperKernel.js';

describe('SelfReplication', () => {
  let replication: SelfReplication;

  beforeEach(() => {
    replication = new SelfReplication({ requireApproval: false, maxReplicasPerSource: 2 });
    replication.setCapacityProvider(() => [
      { region: 'eu-central', availableSlots: 2, maxNodes: 4, latencyBudgetMs: 80 },
      { region: 'us-east', availableSlots: 2, maxNodes: 4, latencyBudgetMs: 120 },
    ]);
    replication.registerNode({
      nodeId: 'node-1',
      region: 'eu-central',
      capabilities: ['chat'],
      status: 'active',
      load: 0.45,
      resources: { cpu: 8, memoryGb: 16, storageGb: 128 },
    });
  });

  it('creates a replication plan and bootstrap lifecycle', () => {
    const plan = replication.requestReplication('node-1', 'us-east', 'resilience test');
    expect(plan).not.toBeNull();

    const node = replication.executePlan(plan!.planId);
    expect(node).not.toBeNull();
    expect(node!.status).toBe('bootstrapping');

    const completed = replication.completeBootstrap(plan!.planId, true);
    expect(completed).toBe(true);
    expect(replication.getNode(node!.nodeId)?.status).toBe('active');
  });

  it('rejects replication when source is missing', () => {
    expect(replication.requestReplication('missing', 'us-east', 'test')).toBeNull();
  });

  it('tracks analysis stats', () => {
    replication.requestReplication('node-1', 'us-east', 'analysis');
    const analysis = replication.analyze();
    expect(analysis.activeNodes).toBe(1);
    expect(analysis.plansPendingApproval).toBe(1);
  });
});

describe('InfraAI', () => {
  let infra: InfraAI;

  beforeEach(() => {
    infra = new InfraAI();
    infra.upsertResource({
      resourceId: 'core',
      kind: 'compute',
      region: 'eu-central',
      utilization: 0.92,
      costPerHour: 1.2,
      health: 'degraded',
      redundancy: 1,
    });
  });

  it('generates recommendations from stressed resources', () => {
    const analysis = infra.analyze();
    expect(analysis.recommendations.length).toBeGreaterThan(0);
    expect(analysis.criticalResources).toContain('core');
  });

  it('creates recovery actions for incidents', () => {
    const incident = infra.reportIncident({
      incidentId: 'inc-1',
      resourceId: 'core',
      type: 'outage',
      severity: 'critical',
      summary: 'core outage',
      status: 'open',
    });
    const actions = infra.mitigateIncident(incident.incidentId);
    expect(actions.length).toBe(2);
    expect(actions.some(action => action.type === 'failover')).toBe(true);
  });
});

describe('GlobalOptimizer', () => {
  let optimizer: GlobalOptimizer;

  beforeEach(() => {
    optimizer = new GlobalOptimizer();
    optimizer.recordSnapshot({ throughput: 300, latencyMs: 180, errorRate: 0.02, costPerHour: 3.4, resilienceScore: 0.8, autonomyScore: 0.72, timestamp: Date.now() - 3_000 });
    optimizer.recordSnapshot({ throughput: 280, latencyMs: 240, errorRate: 0.04, costPerHour: 3.9, resilienceScore: 0.72, autonomyScore: 0.68, timestamp: Date.now() - 2_000 });
    optimizer.recordSnapshot({ throughput: 260, latencyMs: 280, errorRate: 0.06, costPerHour: 4.3, resilienceScore: 0.64, autonomyScore: 0.62 });
  });

  it('forecasts degrading trend', () => {
    const forecast = optimizer.forecast();
    expect(forecast.trend).toBe('degrading');
    expect(forecast.latencyMs).toBeGreaterThan(200);
  });

  it('emits optimization directives', () => {
    const result = optimizer.optimize();
    expect(result.directives.length).toBeGreaterThan(0);
    expect(result.directives.some(directive => directive.type === 'performance')).toBe(true);
  });
});

describe('EvoEcosystem', () => {
  let ecosystem: EvoEcosystem;

  beforeEach(() => {
    ecosystem = new EvoEcosystem();
    ecosystem.registerMember({ agentId: 'a', niche: 'coordination', generation: 3, fitness: 0.91, energy: 0.7, status: 'active', lineage: [] });
    ecosystem.registerMember({ agentId: 'b', niche: 'coordination', generation: 1, fitness: 0.2, energy: 0.1, status: 'active', lineage: [] });
    ecosystem.registerMember({ agentId: 'c', niche: 'resilience', generation: 2, fitness: 0.73, energy: 0.6, status: 'active', lineage: [] });
  });

  it('keeps champions and retires weak members', () => {
    const decision = ecosystem.runSelection();
    expect(decision.promoted).toContain('a');
    expect(decision.retired).toContain('b');
  });
});

describe('SelfModel', () => {
  let model: SelfModel;

  beforeEach(() => {
    model = new SelfModel();
    model.setConstraint('No destructive actions without approval');
  });

  it('builds capabilities and blind spots from signals', () => {
    model.ingestSignal({ source: 'optimizer', category: 'capability', confidence: 0.9, payload: { capability: 'adaptive-coordination' } });
    model.ingestSignal({ source: 'infra', category: 'risk', confidence: 0.8, payload: { area: 'latency-management', description: 'Latency weakness', severity: 'high' } });
    const state = model.reflect();
    expect(state.capabilities.some(item => item.capability === 'adaptive-coordination')).toBe(true);
    expect(state.blindSpots.some(item => item.area === 'latency-management')).toBe(true);
  });
});

describe('GoalEngine', () => {
  let engine: GoalEngine;

  beforeEach(() => {
    engine = new GoalEngine();
  });

  it('synthesizes goals from self-model and forecast', () => {
    const goals = engine.synthesizeGoals(
      {
        identity: 'test',
        coherence: 0.6,
        health: 'learning',
        capabilities: [],
        blindSpots: [{ area: 'latency-management', severity: 'high', description: 'Need better latency handling' }],
        constraints: [],
      },
      {
        windowSize: 3,
        throughput: 280,
        latencyMs: 240,
        errorRate: 0.05,
        costPerHour: 4.2,
        resilienceScore: 0.7,
        autonomyScore: 0.64,
        trend: 'degrading',
      },
    );
    expect(goals.length).toBeGreaterThan(1);
    expect(goals.some(goal => goal.category === 'autonomy')).toBe(true);
  });

  it('marks goals completed when target is reached', () => {
    const goal = engine.createGoal({
      title: 'Raise resilience',
      category: 'resilience',
      metric: 'resilience-score',
      direction: 'increase',
      targetValue: 0.8,
      currentValue: 0.6,
      priority: 70,
      rationale: 'test',
    });
    engine.updateProgress(goal.goalId, 0.82);
    const decisions = engine.evaluateGoals();
    expect(decisions.some(decision => decision.type === 'completed')).toBe(true);
  });
});

describe('HyperKernel', () => {
  it('aggregates modules and can trigger a resilience cycle', () => {
    const kernel = new BrunellaKernel({ autoOptimize: false });
    const replication = new SelfReplication({ requireApproval: false });
    replication.setCapacityProvider(() => [
      { region: 'eu-central', availableSlots: 2, maxNodes: 4, latencyBudgetMs: 80 },
      { region: 'us-east', availableSlots: 2, maxNodes: 4, latencyBudgetMs: 120 },
    ]);
    replication.registerNode({
      nodeId: 'node-main',
      region: 'eu-central',
      capabilities: ['chat'],
      status: 'active',
      load: 0.7,
      resources: { cpu: 8, memoryGb: 16, storageGb: 128 },
    });

    const infra = new InfraAI();
    infra.upsertResource({ resourceId: 'core', kind: 'compute', region: 'eu-central', utilization: 0.95, costPerHour: 1.5, health: 'degraded', redundancy: 1 });
    infra.reportIncident({ incidentId: 'inc', resourceId: 'core', type: 'latency', severity: 'high', summary: 'latency spike', status: 'open' });

    const optimizer = new GlobalOptimizer();
    optimizer.recordSnapshot({ throughput: 280, latencyMs: 250, errorRate: 0.06, costPerHour: 4.1, resilienceScore: 0.65, autonomyScore: 0.61 });

    const ecosystem = new EvoEcosystem();
    ecosystem.registerMember({ agentId: 'orch', niche: 'coordination', generation: 4, fitness: 0.9, energy: 0.7, status: 'active', lineage: [] });

    const selfModel = new SelfModel();
    const goals = new GoalEngine();
    kernel.setSnapshotProvider(() => ({
      timestamp: Date.now(),
      agents: { total: 1, active: 1, idle: 0 },
      mesh: { nodes: 1, healthyNodes: 1 },
      swarms: { colonies: 1, activeColonies: 1 },
      flows: { registered: 2, avgDurationMs: 250 },
      cognition: { entries: 2, avgConfidence: 0.7 },
      health: 'degraded',
    }));

    const hyper = new HyperKernel({ kernel, selfReplication: replication, infraAI: infra, globalOptimizer: optimizer, ecosystem, selfModel, goalEngine: goals });
    const result = hyper.runCycle('test');
    expect(result.snapshotHealth).toBe('degraded');
    expect(result.goalsCreated).toBeGreaterThan(0);
    expect(hyper.getState().stats.replication.nodes).toBeGreaterThanOrEqual(1);
  });
});
