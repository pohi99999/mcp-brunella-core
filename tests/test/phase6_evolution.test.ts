/**
 * Phase 6: Evolutionary Collective Intelligence — Unit Tests
 *
 * Tests: EvolutionaryAgent, EvolutionManager, GeneticFlow,
 *        TopologyAI, CollectiveMind, MetaReasoner, UnifiedRuntime
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionaryAgent } from '../src/agents/evolution/EvolutionaryAgent.js';
import { EvolutionManager } from '../src/agents/evolution/EvolutionManager.js';
import { GeneticFlow } from '../src/core/geneticFlow.js';
import { TopologyAI } from '../src/mesh/topologyAI.js';
import { CollectiveMind } from '../src/core/collectiveMind.js';
import { MetaReasoner } from '../src/core/metaReasoner.js';
import { UnifiedRuntime } from '../src/core/unifiedRuntime.js';

// ─── EvolutionaryAgent ──────────────────────────────────────────────────────

describe('EvolutionaryAgent', () => {
  let evo: EvolutionaryAgent;

  beforeEach(() => {
    evo = new EvolutionaryAgent();
  });

  it('should create a genome', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'Hello', tools: ['t1'], parameters: { temp: 0.5 } });
    expect(g.agentId).toBe('a1');
    expect(g.generation).toBe(0);
    expect(g.fitness).toBe(0);
    expect(g.tools).toEqual(['t1']);
  });

  it('should mutate with prompt_tweak', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'Base', tools: ['t1'] });
    const result = evo.mutate(g.id, 'prompt_tweak');
    expect(result).not.toBeNull();
    expect(result!.mutated.systemPrompt).not.toBe('Base');
    expect(result!.mutated.generation).toBe(1);
    expect(result!.mutated.parentId).toBe(g.id);
  });

  it('should mutate with tool_add', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: ['t1'] });
    const result = evo.mutate(g.id, 'tool_add');
    expect(result!.mutated.tools.length).toBe(2);
  });

  it('should mutate with tool_remove', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: ['t1', 't2'] });
    const result = evo.mutate(g.id, 'tool_remove');
    expect(result!.mutated.tools.length).toBe(1);
  });

  it('should mutate with param_adjust', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: [], parameters: { temp: 0.5 } });
    const result = evo.mutate(g.id, 'param_adjust');
    expect(result).not.toBeNull();
    expect(result!.mutated.parameters.temp).not.toBe(0.5);
  });

  it('should crossover two genomes', () => {
    const a = evo.createGenome({ agentId: 'a1', systemPrompt: 'A', tools: ['t1', 't2'], parameters: { temp: 0.3 } });
    const b = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: ['t3', 't4'], parameters: { temp: 0.7 } });
    const child = evo.crossover(a.id, b.id);
    expect(child).not.toBeNull();
    expect(child!.generation).toBe(1);
    expect(child!.parameters.temp).toBeCloseTo(0.5, 1);
  });

  it('should set and get fitness', () => {
    const g = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: [] });
    evo.setFitness(g.id, 0.85);
    expect(evo.getGenome(g.id)!.fitness).toBe(0.85);
  });

  it('should get best genome for an agent', () => {
    const g1 = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: [] });
    const g2 = evo.createGenome({ agentId: 'a1', systemPrompt: 'B', tools: [] });
    evo.setFitness(g1.id, 0.3);
    evo.setFitness(g2.id, 0.9);
    expect(evo.getBest('a1')!.id).toBe(g2.id);
  });

  it('should return null for invalid mutation', () => {
    expect(evo.mutate('nonexistent', 'prompt_tweak')).toBeNull();
  });
});

// ─── EvolutionManager ───────────────────────────────────────────────────────

describe('EvolutionManager', () => {
  let mgr: EvolutionManager;
  let evo: EvolutionaryAgent;

  beforeEach(() => {
    evo = new EvolutionaryAgent();
    mgr = new EvolutionManager(evo, { populationSize: 6, mutationRate: 0.5, maxGenerations: 5, fitnessThreshold: 0.95 });
  });

  it('should init population', () => {
    const pop = mgr.initPopulation('a1', 'system prompt', ['t1', 't2'], { temp: 0.5 });
    expect(pop.length).toBeGreaterThanOrEqual(2); // at least base + some mutations
  });

  it('should evolve a generation', () => {
    mgr.initPopulation('a1', 'prompt', ['t1']);
    // Set some fitness values
    const genomes = evo.getGenomesForAgent('a1');
    genomes.forEach((g, i) => evo.setFitness(g.id, 0.1 + i * 0.1));

    const result = mgr.evolveGeneration('a1');
    expect(result.generation).toBe(1);
    expect(result.populationSize).toBeGreaterThan(0);
  });

  it('should track generation history', () => {
    mgr.initPopulation('a1', 'prompt', ['t1']);
    evo.getGenomesForAgent('a1').forEach((g, i) => evo.setFitness(g.id, 0.1 + i * 0.05));
    mgr.evolveGeneration('a1');
    expect(mgr.getHistory().length).toBe(1);
  });

  it('should detect stop from fitness threshold', () => {
    mgr.initPopulation('a1', 'prompt', ['t1']);
    const best = evo.getBest('a1');
    evo.setFitness(best!.id, 0.96);
    expect(mgr.shouldStop('a1')).toBe(true);
  });

  it('should detect stop from max generations', () => {
    mgr.initPopulation('a1', 'prompt', ['t1']);
    for (let i = 0; i < 5; i++) {
      evo.getGenomesForAgent('a1').forEach((g, j) => evo.setFitness(g.id, 0.1 + j * 0.02));
      mgr.evolveGeneration('a1');
    }
    expect(mgr.shouldStop('a1')).toBe(true);
  });

  it('should get best genome', () => {
    mgr.initPopulation('a1', 'prompt', ['t1']);
    const all = evo.getGenomesForAgent('a1');
    evo.setFitness(all[all.length - 1].id, 0.99);
    const best = mgr.getBest('a1');
    expect(best!.fitness).toBe(0.99);
  });
});

// ─── GeneticFlow ────────────────────────────────────────────────────────────

describe('GeneticFlow', () => {
  let gf: GeneticFlow;

  beforeEach(() => {
    gf = new GeneticFlow({ populationSize: 5, fitnessGoal: 0.85 });
  });

  it('should seed a population', () => {
    const pop = gf.seedPopulation('flow-1', ['s1', 's2', 's3'], { p1: 0.5 });
    expect(pop.length).toBe(5);
    expect(pop[0].flowId).toBe('flow-1');
  });

  it('should evaluate a variant', () => {
    const pop = gf.seedPopulation('flow-1', ['s1', 's2']);
    const ev = gf.evaluate(pop[0].id, { durationMs: 500, successRate: 0.9, outputQuality: 0.8 });
    expect(ev.fitness).toBeGreaterThan(0);
  });

  it('should evolve to next generation', () => {
    const pop = gf.seedPopulation('flow-1', ['s1', 's2']);
    pop.forEach((v, i) => gf.evaluate(v.id, { durationMs: 300 + i * 100, successRate: 0.8 + i * 0.02, outputQuality: 0.7 + i * 0.05 }));

    const nextGen = gf.evolve('flow-1');
    expect(nextGen.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect goal reached', () => {
    const pop = gf.seedPopulation('flow-1', ['s1']);
    gf.evaluate(pop[0].id, { durationMs: 100, successRate: 0.95, outputQuality: 0.9 });
    expect(gf.goalReached('flow-1')).toBe(true);
  });

  it('should get best variant', () => {
    const pop = gf.seedPopulation('flow-1', ['s1']);
    gf.evaluate(pop[0].id, { durationMs: 200, successRate: 0.8, outputQuality: 0.7 });
    const best = gf.getBest('flow-1');
    expect(best).toBeDefined();
    expect(best!.fitness).toBeGreaterThan(0);
  });

  it('should return evaluations', () => {
    const pop = gf.seedPopulation('flow-1', ['s1']);
    gf.evaluate(pop[0].id, { durationMs: 200, successRate: 0.8, outputQuality: 0.7 });
    expect(gf.getEvaluations().length).toBe(1);
  });
});

// ─── TopologyAI ─────────────────────────────────────────────────────────────

describe('TopologyAI', () => {
  let topo: TopologyAI;

  beforeEach(() => {
    topo = new TopologyAI();
  });

  it('should upsert and list nodes', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: ['chat'], connections: ['n2'], load: 0.3, latencyMs: 50, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: ['search'], connections: ['n1'], load: 0.5, latencyMs: 60, uptime: 0.95 });
    expect(topo.listNodes().length).toBe(2);
  });

  it('should detect isolated nodes', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: [], connections: [], load: 0.1, latencyMs: 30, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: [], connections: ['n1'], load: 0.2, latencyMs: 40, uptime: 0.95 });
    const analysis = topo.analyze();
    expect(analysis.isolatedNodes).toContain('n1');
  });

  it('should detect bottlenecks', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: [], connections: ['n2', 'n3'], load: 0.9, latencyMs: 200, uptime: 0.8 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: [], connections: ['n1'], load: 0.2, latencyMs: 30, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n3', region: 'eu', capabilities: [], connections: ['n1'], load: 0.2, latencyMs: 30, uptime: 0.99 });
    const analysis = topo.analyze();
    expect(analysis.bottlenecks).toContain('n1');
  });

  it('should create proposals for isolated nodes', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: [], connections: [], load: 0.1, latencyMs: 30, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: [], connections: [], load: 0.2, latencyMs: 40, uptime: 0.95 });
    const analysis = topo.analyze();
    expect(analysis.proposals.length).toBeGreaterThan(0);
    expect(analysis.proposals[0].type).toBe('add_link');
  });

  it('should apply add_link proposal', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: [], connections: [], load: 0.1, latencyMs: 30, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: [], connections: [], load: 0.2, latencyMs: 40, uptime: 0.95 });
    const analysis = topo.analyze();
    const proposal = analysis.proposals.find(p => p.type === 'add_link');
    expect(proposal).toBeDefined();

    topo.applyProposal(proposal!.id);
    const n1 = topo.getNode('n1')!;
    const n2 = topo.getNode('n2')!;
    // One of them should now have a connection
    expect(n1.connections.length + n2.connections.length).toBeGreaterThan(0);
  });

  it('should remove a node and its connections', () => {
    topo.upsertNode({ nodeId: 'n1', region: 'eu', capabilities: [], connections: ['n2'], load: 0.1, latencyMs: 30, uptime: 0.99 });
    topo.upsertNode({ nodeId: 'n2', region: 'eu', capabilities: [], connections: ['n1'], load: 0.2, latencyMs: 40, uptime: 0.95 });
    topo.removeNode('n1');
    expect(topo.listNodes().length).toBe(1);
    expect(topo.getNode('n2')!.connections).not.toContain('n1');
  });

  it('should handle empty topology', () => {
    const analysis = topo.analyze();
    expect(analysis.totalNodes).toBe(0);
    expect(analysis.proposals.length).toBe(0);
  });
});

// ─── CollectiveMind ─────────────────────────────────────────────────────────

describe('CollectiveMind', () => {
  let cm: CollectiveMind;

  beforeEach(() => {
    cm = new CollectiveMind();
  });

  it('should submit perspectives', () => {
    const p = cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 'optimization', stance: 'Use caching', confidence: 0.8, evidence: ['benchmark'], tags: ['perf'] });
    expect(p.id).toBeDefined();
    expect(p.createdAt).toBeGreaterThan(0);
  });

  it('should build consensus with agreement', () => {
    cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 'caching', stance: 'Enable redis caching', confidence: 0.9, evidence: [], tags: ['cache'] });
    cm.submit({ sourceId: 'a2', sourceType: 'agent', topic: 'caching', stance: 'Enable redis caching', confidence: 0.85, evidence: [], tags: ['cache'] });

    const result = cm.buildConsensus({ topic: 'caching' });
    expect(result.consensusReached).toBe(true);
    expect(result.perspectives.length).toBe(2);
    expect(result.avgConfidence).toBeGreaterThan(0.8);
  });

  it('should detect conflicting views', () => {
    cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 'database', stance: 'Use SQL for everything', confidence: 0.8, evidence: [], tags: ['db'] });
    cm.submit({ sourceId: 'a2', sourceType: 'agent', topic: 'database', stance: 'Use NoSQL for flexibility', confidence: 0.7, evidence: [], tags: ['db'] });

    const result = cm.buildConsensus({ topic: 'database' });
    expect(result.conflictingViews.length).toBeGreaterThan(0);
  });

  it('should filter by min confidence', () => {
    cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 'perf', stance: 'A', confidence: 0.3, evidence: [], tags: ['perf'] });
    cm.submit({ sourceId: 'a2', sourceType: 'agent', topic: 'perf', stance: 'B', confidence: 0.9, evidence: [], tags: ['perf'] });

    const result = cm.buildConsensus({ topic: 'perf', minConfidence: 0.5 });
    expect(result.perspectives.length).toBe(1);
  });

  it('should get by source and topic', () => {
    cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 'test', stance: 'A', confidence: 0.8, evidence: [], tags: [] });
    cm.submit({ sourceId: 'a2', sourceType: 'swarm', topic: 'test', stance: 'B', confidence: 0.7, evidence: [], tags: [] });

    expect(cm.getBySource('a1').length).toBe(1);
    expect(cm.getByTopic('test').length).toBe(2);
  });

  it('should return stats', () => {
    cm.submit({ sourceId: 'a1', sourceType: 'agent', topic: 't1', stance: 'A', confidence: 0.8, evidence: [], tags: [] });
    const stats = cm.getStats();
    expect(stats.total).toBe(1);
    expect(stats.topics).toBe(1);
  });
});

// ─── MetaReasoner ───────────────────────────────────────────────────────────

describe('MetaReasoner', () => {
  let mr: MetaReasoner;

  beforeEach(() => {
    mr = new MetaReasoner();
  });

  it('should record decisions', () => {
    const d = mr.recordDecision({ decisionMaker: 'agent-1', action: 'route_to_node_2', context: {}, outcome: 'success', metrics: { durationMs: 100 } });
    expect(d.id).toBeDefined();
    expect(d.timestamp).toBeGreaterThan(0);
  });

  it('should produce no insights with empty decisions', () => {
    const insights = mr.reason();
    expect(insights.length).toBe(0);
  });

  it('should detect repeated failure pattern', () => {
    for (let i = 0; i < 4; i++) {
      mr.recordDecision({ decisionMaker: 'bad-agent', action: `action-${i}`, context: {}, outcome: 'failure', metrics: {} });
    }
    const insights = mr.reason(600_000);
    expect(insights.some(i => i.category === 'pattern')).toBe(true);
    expect(insights[0].description).toContain('bad-agent');
  });

  it('should generate recommendation for high success rate', () => {
    for (let i = 0; i < 10; i++) {
      mr.recordDecision({ decisionMaker: 'good-agent', action: `a-${i}`, context: {}, outcome: 'success', metrics: { quality: 0.9 } });
    }
    const insights = mr.reason(600_000);
    expect(insights.some(i => i.category === 'recommendation')).toBe(true);
  });

  it('should track sessions', () => {
    mr.recordDecision({ decisionMaker: 'a', action: 'b', context: {}, outcome: 'success', metrics: {} });
    mr.reason();
    expect(mr.getSessions().length).toBe(1);
  });

  it('should get decisions with limit', () => {
    for (let i = 0; i < 5; i++) {
      mr.recordDecision({ decisionMaker: 'a', action: `action-${i}`, context: {}, outcome: 'success', metrics: {} });
    }
    expect(mr.getDecisions(3).length).toBe(3);
  });

  it('should return stats', () => {
    mr.recordDecision({ decisionMaker: 'a', action: 'b', context: {}, outcome: 'success', metrics: {} });
    mr.reason();
    const stats = mr.getStats();
    expect(stats.decisions).toBe(1);
    expect(stats.sessions).toBe(1);
  });
});

// ─── UnifiedRuntime ─────────────────────────────────────────────────────────

describe('UnifiedRuntime', () => {
  let rt: UnifiedRuntime;

  beforeEach(() => {
    rt = new UnifiedRuntime();
  });

  it('should set and get context', () => {
    rt.setContext('brunella', 'user.name', 'Péter', 'kernel');
    const ctx = rt.getContext('user.name');
    expect(ctx).toBeDefined();
    expect(ctx!.value).toBe('Péter');
    expect(ctx!.version).toBe(1);
  });

  it('should version context updates', () => {
    rt.setContext('brunella', 'key', 'v1', 'a');
    rt.setContext('paios', 'key', 'v2', 'b');
    const ctx = rt.getContext('key');
    expect(ctx!.version).toBe(2);
    expect(ctx!.value).toBe('v2');
    expect(ctx!.source).toBe('paios');
  });

  it('should register and start workflow', () => {
    rt.registerWorkflow({
      workflowId: 'wf-1',
      name: 'Shared Flow',
      owner: 'shared',
      steps: [
        { stepId: 's1', executor: 'brunella', action: 'analyze' },
        { stepId: 's2', executor: 'paios', action: 'execute' },
      ],
    });
    expect(rt.getWorkflow('wf-1')!.status).toBe('draft');

    rt.startWorkflow('wf-1');
    expect(rt.getWorkflow('wf-1')!.status).toBe('active');
  });

  it('should complete workflow', () => {
    rt.registerWorkflow({ workflowId: 'wf-1', name: 'W', owner: 'brunella', steps: [] });
    rt.startWorkflow('wf-1');
    rt.completeWorkflow('wf-1');
    expect(rt.getWorkflow('wf-1')!.status).toBe('completed');
  });

  it('should list workflows by status', () => {
    rt.registerWorkflow({ workflowId: 'wf-1', name: 'A', owner: 'brunella', steps: [] });
    rt.registerWorkflow({ workflowId: 'wf-2', name: 'B', owner: 'paios', steps: [] });
    rt.startWorkflow('wf-1');

    expect(rt.listWorkflows('active').length).toBe(1);
    expect(rt.listWorkflows('draft').length).toBe(1);
  });

  it('should handle sync request/response', () => {
    const events: unknown[] = [];
    rt.on('sync:requested', (e) => events.push(e));
    rt.on('sync:responded', (e) => events.push(e));

    rt.requestSync('brunella', { keys: ['user.name'] });
    rt.respondSync('paios', { user: { name: 'Péter' } });

    expect(events.length).toBe(2);
  });

  it('should track events', () => {
    rt.setContext('brunella', 'k', 'v', 'a');
    rt.requestSync('paios');
    expect(rt.getEvents().length).toBe(2);
  });

  it('should return all contexts', () => {
    rt.setContext('brunella', 'a', 1, 'x');
    rt.setContext('paios', 'b', 2, 'y');
    expect(rt.getAllContexts().length).toBe(2);
  });

  it('should return stats', () => {
    rt.setContext('brunella', 'k', 'v', 'a');
    rt.registerWorkflow({ workflowId: 'wf-1', name: 'A', owner: 'shared', steps: [] });
    rt.startWorkflow('wf-1');

    const stats = rt.getStats();
    expect(stats.contexts).toBe(1);
    expect(stats.workflows).toBe(1);
    expect(stats.activeWorkflows).toBe(1);
  });

  it('should not complete a non-active workflow', () => {
    rt.registerWorkflow({ workflowId: 'wf-1', name: 'A', owner: 'shared', steps: [] });
    expect(rt.completeWorkflow('wf-1')).toBe(false);
  });
});
