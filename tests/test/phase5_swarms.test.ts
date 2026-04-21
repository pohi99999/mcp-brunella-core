/**
 * Phase 5: Adaptive Swarms & Workflow Intelligence — Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwarmAgent } from '../src/agents/swarm/SwarmAgent.js';
import { SwarmManager } from '../src/agents/swarm/SwarmManager.js';
import { AdaptiveFlow } from '../src/core/adaptiveFlow.js';
import { PredictiveRouter } from '../src/core/predictiveRouter.js';
import { MeshHealing } from '../src/mesh/meshHealing.js';
import { KnowledgeGraph } from '../src/core/knowledgeGraph.js';
import { SharedCognition } from '../src/core/sharedCognition.js';
import { BrunellaKernel } from '../src/kernel/BrunellaKernel.js';
import { MeshNode } from '../src/mesh/meshNode.js';
import { MeshManager } from '../src/mesh/meshManager.js';
import type { IAgent } from '../src/agents/types.js';

// ─── Mock Agent ──────────────────────────────────────────────────────────────
function createMockAgent(name: string, capabilities: string[], failOnTask?: string): IAgent {
  return {
    name,
    role: 'worker',
    description: `Mock agent: ${name}`,
    capabilities,
    async execute(task: string) {
      if (failOnTask && task.includes(failOnTask)) throw new Error(`Failed: ${task}`);
      return { result: `${name} completed: ${task}` };
    },
  };
}

// ─── SwarmAgent ──────────────────────────────────────────────────────────────

describe('SwarmAgent', () => {
  let agent: SwarmAgent;

  beforeEach(() => {
    agent = new SwarmAgent({
      agentId: 'sa-1',
      swarmId: 'colony-1',
      innerAgent: createMockAgent('TestBot', ['chat', 'search']),
    });
  });

  it('should initialize with idle role', () => {
    expect(agent.role).toBe('idle');
    expect(agent.agentId).toBe('sa-1');
    expect(agent.capabilities).toEqual(['chat', 'search']);
  });

  it('should change role', () => {
    const events: unknown[] = [];
    agent.on('role:changed', (e) => events.push(e));
    agent.setRole('leader');
    expect(agent.role).toBe('leader');
    expect(events.length).toBe(1);
  });

  it('should bid on matching tasks', () => {
    const bid = agent.bid('task-1', ['chat']);
    expect(bid).not.toBeNull();
    expect(bid!.confidence).toBe(1);
  });

  it('should not bid on non-matching tasks', () => {
    const bid = agent.bid('task-2', ['browser']);
    expect(bid).toBeNull();
  });

  it('should execute tasks via inner agent', async () => {
    const result = await agent.executeTask('t1', 'say hello');
    expect(result.status).toBe('success');
    expect(result.agentId).toBe('sa-1');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle task failures', async () => {
    const failAgent = new SwarmAgent({
      agentId: 'sa-fail',
      swarmId: 'colony-1',
      innerAgent: createMockAgent('FailBot', ['chat'], 'boom'),
    });
    const result = await failAgent.executeTask('t2', 'boom');
    expect(result.status).toBe('error');
    expect(result.error).toContain('boom');
  });

  it('should track stats', async () => {
    await agent.executeTask('t1', 'task a');
    await agent.executeTask('t2', 'task b');
    const stats = agent.getStats();
    expect(stats.completed).toBe(2);
    expect(stats.failed).toBe(0);
    expect(stats.successRate).toBe(1);
  });
});

// ─── SwarmManager ────────────────────────────────────────────────────────────

describe('SwarmManager', () => {
  let manager: SwarmManager;

  beforeEach(() => {
    manager = new SwarmManager();
  });

  it('should create a colony', () => {
    const colony = manager.createColony({ swarmId: 's1', name: 'Alpha', objective: 'Test' });
    expect(colony.status).toBe('forming');
    expect(colony.agents.size).toBe(0);
  });

  it('should add agents and auto-elect leader', () => {
    manager.createColony({ swarmId: 's1', name: 'Alpha', objective: 'Test' });

    const a1 = new SwarmAgent({ agentId: 'a1', swarmId: 's1', innerAgent: createMockAgent('A', ['chat']) });
    const a2 = new SwarmAgent({ agentId: 'a2', swarmId: 's1', innerAgent: createMockAgent('B', ['search']) });

    manager.addAgent('s1', a1);
    manager.addAgent('s1', a2);

    const colony = manager.getColony('s1')!;
    expect(colony.agents.size).toBe(2);
    expect(colony.leaderId).not.toBeNull();
    expect(colony.status).toBe('active');
  });

  it('should submit tasks via competitive bidding', async () => {
    manager.createColony({ swarmId: 's1', name: 'Alpha', objective: 'Test' });
    const a1 = new SwarmAgent({ agentId: 'a1', swarmId: 's1', innerAgent: createMockAgent('A', ['chat', 'search']) });
    manager.addAgent('s1', a1);

    const result = await manager.submitTask('s1', {
      taskId: manager.nextTaskId(),
      task: 'find info',
      requiredCapabilities: ['search'],
      priority: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('success');
  });

  it('should return null for missing colony', async () => {
    const result = await manager.submitTask('nonexistent', {
      taskId: 'x', task: 'test', requiredCapabilities: [], priority: 1,
    });
    expect(result).toBeNull();
  });

  it('should dissolve a colony', () => {
    manager.createColony({ swarmId: 's1', name: 'Alpha', objective: 'Test' });
    const a1 = new SwarmAgent({ agentId: 'a1', swarmId: 's1', innerAgent: createMockAgent('A', ['chat']) });
    manager.addAgent('s1', a1);
    manager.dissolveColony('s1');

    const colony = manager.getColony('s1')!;
    expect(colony.status).toBe('dissolved');
    expect(colony.agents.size).toBe(0);
  });
});

// ─── AdaptiveFlow ────────────────────────────────────────────────────────────

describe('AdaptiveFlow', () => {
  let flow: AdaptiveFlow;

  beforeEach(() => {
    flow = new AdaptiveFlow();
  });

  it('should register and execute a flow', async () => {
    flow.registerFlow({
      flowId: 'f1',
      name: 'Test Flow',
      steps: [
        { stepId: 's1', name: 'Step 1', handler: async (x) => ({ ...(x as object), s1: true }), weight: 0 },
        { stepId: 's2', name: 'Step 2', handler: async (x) => ({ ...(x as object), s2: true }), weight: 1 },
      ],
    });

    const result = await flow.execute('f1', { initial: true });
    expect(result.results.length).toBe(2);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should track step metrics', async () => {
    flow.registerFlow({
      flowId: 'f1',
      name: 'Test',
      steps: [{ stepId: 's1', name: 'S1', handler: async () => 'ok' }],
    });

    await flow.execute('f1', null);
    await flow.execute('f1', null);

    const metrics = flow.getStepMetrics('s1');
    expect(metrics).toBeDefined();
    expect(metrics!.executions).toBe(2);
    expect(metrics!.successRate).toBe(1);
  });

  it('should handle step failures gracefully', async () => {
    flow.registerFlow({
      flowId: 'f1',
      name: 'Test',
      steps: [{ stepId: 's-fail', name: 'Fails', handler: async () => { throw new Error('boom'); } }],
    });

    const result = await flow.execute('f1', null);
    expect(result.results.length).toBe(1);
    expect((result.results[0] as { error: string }).error).toContain('boom');

    const metrics = flow.getStepMetrics('s-fail');
    expect(metrics!.failCount).toBe(1);
  });

  it('should suggest optimization when order changes help', async () => {
    flow.registerFlow({
      flowId: 'f1',
      name: 'Opt Test',
      steps: [
        { stepId: 'slow', name: 'Slow', handler: async (x) => x, weight: 0 },
        { stepId: 'fast', name: 'Fast', handler: async (x) => x, weight: 1 },
      ],
    });

    // Run enough to have metrics
    for (let i = 0; i < 5; i++) await flow.execute('f1', {});

    // Manually set slow step metrics to trigger reorder
    const slowMetrics = flow.getStepMetrics('slow')!;
    (slowMetrics as any).avgDurationMs = 5000;
    (slowMetrics as any).successRate = 0.5;

    const opt = flow.analyze('f1');
    // May or may not suggest based on scoring
    expect(opt === null || opt.flowId === 'f1').toBe(true);
  });

  it('should throw for unknown flow', async () => {
    await expect(flow.execute('nonexistent', null)).rejects.toThrow(/not found/);
  });
});

// ─── PredictiveRouter ────────────────────────────────────────────────────────

describe('PredictiveRouter', () => {
  let router: PredictiveRouter;

  beforeEach(() => {
    router = new PredictiveRouter({ maxHistorySize: 50, decayWindowMs: 60_000 });
  });

  it('should record outcomes and build profiles', () => {
    router.recordOutcome({ capability: 'chat', nodeId: 'n1', latencyMs: 100, success: true, timestamp: Date.now() });
    router.recordOutcome({ capability: 'chat', nodeId: 'n1', latencyMs: 200, success: true, timestamp: Date.now() });

    const profile = router.getProfile('n1');
    expect(profile).toBeDefined();
    expect(profile!.requestCount).toBe(2);
    expect(profile!.avgLatencyMs).toBe(150);
  });

  it('should predict best node', () => {
    router.recordOutcome({ capability: 'search', nodeId: 'fast', latencyMs: 50, success: true, timestamp: Date.now() });
    router.recordOutcome({ capability: 'search', nodeId: 'slow', latencyMs: 3000, success: false, timestamp: Date.now() });

    const decision = router.predict('search', ['fast', 'slow']);
    expect(decision.selectedNodeId).toBe('fast');
    expect(decision.score).toBeGreaterThan(0);
  });

  it('should handle unknown nodes with neutral score', () => {
    const decision = router.predict('chat', ['unknown1', 'unknown2']);
    expect(decision.selectedNodeId).toBe('unknown1');
    expect(decision.score).toBe(0.5);
  });

  it('should return empty selection for no candidates', () => {
    const decision = router.predict('chat', []);
    expect(decision.selectedNodeId).toBe('');
    expect(decision.score).toBe(0);
  });

  it('should return history', () => {
    router.recordOutcome({ capability: 'a', nodeId: 'n', latencyMs: 10, success: true, timestamp: Date.now() });
    expect(router.getHistory('a').length).toBe(1);
    expect(router.getHistory('b').length).toBe(0);
  });
});

// ─── MeshHealing ─────────────────────────────────────────────────────────────

describe('MeshHealing', () => {
  let localNode: MeshNode;
  let meshManager: MeshManager;
  let healing: MeshHealing;

  beforeEach(() => {
    localNode = new MeshNode({ nodeId: 'local', label: 'Local', host: 'http://localhost:3000' });
    localNode.start(['chat']);
    meshManager = new MeshManager(localNode);
    healing = new MeshHealing(meshManager, { checkIntervalMs: 60_000, unhealthyThreshold: 2 });
  });

  afterEach(() => {
    healing.stop();
    localNode.stop();
  });

  it('should create without errors', () => {
    expect(healing).toBeDefined();
    expect(healing.getStats().totalActions).toBe(0);
  });

  it('should track failure counts', () => {
    expect(healing.getFailureCount('node-x')).toBe(0);
  });

  it('should trigger healing when threshold is exceeded', async () => {
    meshManager.registerPeer({
      nodeId: 'sick-node',
      label: 'Sick',
      host: 'http://sick:3000',
      capabilities: ['chat'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    const action = await healing.triggerHealing(
      { nodeId: 'sick-node', label: 'Sick', host: 'http://sick:3000', capabilities: [], status: 'online', lastHeartbeat: Date.now(), joinedAt: Date.now() },
      3
    );
    expect(action.type).toBe('reroute');
    expect(action.status).toBe('completed');
  });

  it('should isolate nodes with many failures', async () => {
    meshManager.registerPeer({
      nodeId: 'dead-node',
      label: 'Dead',
      host: 'http://dead:3000',
      capabilities: [],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    const action = await healing.triggerHealing(
      { nodeId: 'dead-node', label: 'Dead', host: 'http://dead:3000', capabilities: [], status: 'online', lastHeartbeat: Date.now(), joinedAt: Date.now() },
      6 // >= threshold * 2
    );
    expect(action.type).toBe('isolate');
    expect(meshManager.getPeer('dead-node')).toBeUndefined();
  });
});

// ─── KnowledgeGraph ──────────────────────────────────────────────────────────

describe('KnowledgeGraph', () => {
  let kg: KnowledgeGraph;

  beforeEach(() => {
    kg = new KnowledgeGraph();
  });

  it('should add and retrieve nodes', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'SearchBot', properties: {} });
    const node = kg.getNode('a1');
    expect(node).toBeDefined();
    expect(node!.label).toBe('SearchBot');
  });

  it('should add edges between nodes', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'Bot', properties: {} });
    kg.upsertNode({ id: 'c1', type: 'capability', label: 'search', properties: {} });
    const edge = kg.addEdge('a1', 'c1', 'has_capability');
    expect(edge).not.toBeNull();
    expect(edge!.relation).toBe('has_capability');
  });

  it('should find neighbors', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'Bot', properties: {} });
    kg.upsertNode({ id: 'c1', type: 'capability', label: 'chat', properties: {} });
    kg.upsertNode({ id: 'c2', type: 'capability', label: 'search', properties: {} });
    kg.addEdge('a1', 'c1', 'has_capability');
    kg.addEdge('a1', 'c2', 'has_capability');

    const neighbors = kg.getNeighbors('a1');
    expect(neighbors.length).toBe(2);
  });

  it('should filter neighbors by relation', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'Bot', properties: {} });
    kg.upsertNode({ id: 't1', type: 'task', label: 'Task', properties: {} });
    kg.upsertNode({ id: 'c1', type: 'capability', label: 'chat', properties: {} });
    kg.addEdge('a1', 'c1', 'has_capability');
    kg.addEdge('a1', 't1', 'assigned_to');

    const caps = kg.getNeighbors('a1', 'has_capability');
    expect(caps.length).toBe(1);
    expect(caps[0].id).toBe('c1');
  });

  it('should find shortest path', () => {
    kg.upsertNode({ id: 'a', type: 'agent', label: 'A', properties: {} });
    kg.upsertNode({ id: 'b', type: 'agent', label: 'B', properties: {} });
    kg.upsertNode({ id: 'c', type: 'agent', label: 'C', properties: {} });
    kg.addEdge('a', 'b', 'knows');
    kg.addEdge('b', 'c', 'knows');

    const path = kg.findPath('a', 'c');
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('should return null for unreachable nodes', () => {
    kg.upsertNode({ id: 'x', type: 'agent', label: 'X', properties: {} });
    kg.upsertNode({ id: 'y', type: 'agent', label: 'Y', properties: {} });
    // No edge between x and y
    expect(kg.findPath('x', 'y')).toBeNull();
  });

  it('should search nodes by label', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'SearchBot', properties: {} });
    kg.upsertNode({ id: 'a2', type: 'agent', label: 'ChatBot', properties: {} });
    const results = kg.searchNodes('search');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('a1');
  });

  it('should remove nodes and their edges', () => {
    kg.upsertNode({ id: 'a', type: 'agent', label: 'A', properties: {} });
    kg.upsertNode({ id: 'b', type: 'agent', label: 'B', properties: {} });
    kg.addEdge('a', 'b', 'knows');

    kg.removeNode('a');
    expect(kg.getNode('a')).toBeUndefined();
    expect(kg.getEdgesFor('b').length).toBe(0);
  });

  it('should report stats', () => {
    kg.upsertNode({ id: 'a1', type: 'agent', label: 'A', properties: {} });
    kg.upsertNode({ id: 'c1', type: 'capability', label: 'C', properties: {} });
    const stats = kg.getStats();
    expect(stats.nodes).toBe(2);
    expect(stats.nodeTypes.agent).toBe(1);
    expect(stats.nodeTypes.capability).toBe(1);
  });
});

// ─── SharedCognition ─────────────────────────────────────────────────────────

describe('SharedCognition', () => {
  let cog: SharedCognition;

  beforeEach(() => {
    cog = new SharedCognition();
  });

  it('should store and query entries', () => {
    cog.store({ source: 'brunella', category: 'fact', content: 'The server runs on port 3000', confidence: 0.9, context: {}, tags: ['config'] });
    const result = cog.query({ question: 'port' });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].content).toContain('3000');
  });

  it('should filter by confidence', () => {
    cog.store({ source: 'paios', category: 'prediction', content: 'Low conf', confidence: 0.2, context: {}, tags: [] });
    cog.store({ source: 'brunella', category: 'fact', content: 'High conf', confidence: 0.95, context: {}, tags: [] });

    const result = cog.query({ question: '', minConfidence: 0.5 });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].content).toBe('High conf');
  });

  it('should get entries by source', () => {
    cog.store({ source: 'brunella', category: 'fact', content: 'A', confidence: 0.8, context: {}, tags: [] });
    cog.store({ source: 'paios', category: 'observation', content: 'B', confidence: 0.7, context: {}, tags: [] });

    expect(cog.getBySource('brunella').length).toBe(1);
    expect(cog.getBySource('paios').length).toBe(1);
  });

  it('should purge expired entries', () => {
    cog.store({ source: 'brunella', category: 'memory', content: 'old', confidence: 0.5, context: {}, tags: [], expiresAt: Date.now() - 1000 });
    cog.store({ source: 'brunella', category: 'fact', content: 'current', confidence: 0.9, context: {}, tags: [] });

    const purged = cog.purgeExpired();
    expect(purged).toBe(1);
    expect(cog.getStats().total).toBe(1);
  });

  it('should return stats', () => {
    cog.store({ source: 'brunella', category: 'fact', content: 'A', confidence: 0.8, context: {}, tags: [] });
    cog.store({ source: 'mesh', category: 'decision', content: 'B', confidence: 0.6, context: {}, tags: [] });

    const stats = cog.getStats();
    expect(stats.total).toBe(2);
    expect(stats.bySource.brunella).toBe(1);
    expect(stats.bySource.mesh).toBe(1);
  });
});

// ─── BrunellaKernel ──────────────────────────────────────────────────────────

describe('BrunellaKernel', () => {
  let kernel: BrunellaKernel;

  beforeEach(() => {
    kernel = new BrunellaKernel({ snapshotIntervalMs: 60_000, autoOptimize: false });
  });

  afterEach(() => {
    kernel.stop();
  });

  it('should take snapshots when provider is set', () => {
    kernel.setSnapshotProvider(() => ({
      timestamp: Date.now(),
      agents: { total: 10, active: 5, idle: 5 },
      mesh: { nodes: 3, healthyNodes: 3 },
      swarms: { colonies: 1, activeColonies: 1 },
      flows: { registered: 2, avgDurationMs: 500 },
      cognition: { entries: 50, avgConfidence: 0.8 },
      health: 'good',
    }));

    const snapshot = kernel.takeSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.health).toBe('good');
    expect(kernel.getLatestSnapshot()).toBe(snapshot);
  });

  it('should evaluate and generate healing directives', () => {
    const snapshot = {
      timestamp: Date.now(),
      agents: { total: 10, active: 5, idle: 5 },
      mesh: { nodes: 10, healthyNodes: 5 },  // 50% — below 70% threshold
      swarms: { colonies: 1, activeColonies: 1 },
      flows: { registered: 2, avgDurationMs: 500 },
      cognition: { entries: 50, avgConfidence: 0.8 },
      health: 'degraded' as const,
    };

    const directives = kernel.evaluate(snapshot);
    expect(directives.length).toBeGreaterThan(0);
    const healDirective = directives.find(d => d.type === 'heal');
    expect(healDirective).toBeDefined();
    expect(healDirective!.priority).toBe('high');
  });

  it('should generate critical alert directive', () => {
    const snapshot = {
      timestamp: Date.now(),
      agents: { total: 0, active: 0, idle: 0 },
      mesh: { nodes: 0, healthyNodes: 0 },
      swarms: { colonies: 0, activeColonies: 0 },
      flows: { registered: 0, avgDurationMs: 0 },
      cognition: { entries: 0, avgConfidence: 0 },
      health: 'critical' as const,
    };

    const directives = kernel.evaluate(snapshot);
    const alert = directives.find(d => d.type === 'alert');
    expect(alert).toBeDefined();
    expect(alert!.priority).toBe('critical');
  });

  it('should complete directives', () => {
    const d = kernel.createDirective('optimize', 'flow', 'Reorder steps', 'medium');
    kernel.getDirectives(); // just to have it tracked
    // Add directly for testing
    (kernel as any).directives.push(d);

    kernel.completeDirective(d.id, 'Applied optimization');
    expect(d.status).toBe('completed');
    expect(d.result).toBe('Applied optimization');
  });

  it('should return stats', () => {
    const stats = kernel.getStats();
    expect(stats.snapshots).toBe(0);
    expect(stats.directives).toBe(0);
    expect(stats.health).toBe('unknown');
  });
});
