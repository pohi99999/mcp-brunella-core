import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmCoordinator } from './swarmCoordinator.js';

describe('SwarmCoordinator Durable Object', () => {
  let state: any;
  let coordinator: SwarmCoordinator;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = new Map();
    const storage = {
      get: vi.fn(async (key) => mockStorage.get(key)),
      put: vi.fn(async (key, value) => { mockStorage.set(key, value); }),
    };

    state = {
      storage,
      blockConcurrencyWhile: vi.fn(async (callback) => await callback()),
      acceptWebSocket: vi.fn(),
    };

    coordinator = new SwarmCoordinator(state, {});
  });

  it('should create a swarm session', async () => {
    const request = new Request('http://localhost/swarm/create', {
      method: 'POST',
      body: JSON.stringify({ initialAgent: 'test-agent', context: { foo: 'bar' } })
    });

    const response = await coordinator.fetch(request);
    const result = await response.json() as any;

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.session.activeAgent).toBe('test-agent');
    expect(result.session.artifacts.foo).toBe('bar');
  });

  it('should handle handoffs', async () => {
    // First create a session
    const createReq = new Request('http://localhost/swarm/create', {
      method: 'POST',
      body: JSON.stringify({ initialAgent: 'agent-a' })
    });
    const createRes = await coordinator.fetch(createReq);
    const { sessionId } = await createRes.json() as any;

    // Perform handoff
    const handoffReq = new Request(`http://localhost/swarm/${sessionId}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ 
        targetAgent: 'agent-b', 
        reason: 'need calculation',
        message: 'Passing to B',
        contextUpdates: { calc: 123 }
      })
    });

    const handoffRes = await coordinator.fetch(handoffReq);
    const handoffResult = await handoffRes.json() as any;

    expect(handoffRes.status).toBe(200);
    expect(handoffResult.session.activeAgent).toBe('agent-b');
    expect(handoffResult.session.artifacts.calc).toBe(123);
    expect(handoffResult.handoff.from).toBe('agent-a');
  });

  it('should store artifacts', async () => {
    const createRes = await coordinator.fetch(new Request('http://localhost/swarm/create', { method: 'POST', body: JSON.stringify({}) }));
    const { sessionId } = await createRes.json() as any;

    const artifactReq = new Request(`http://localhost/swarm/${sessionId}/artifact`, {
      method: 'POST',
      body: JSON.stringify({ key: 'result-file', value: 'data...', agent: 'agent-b' })
    });

    const artifactRes = await coordinator.fetch(artifactReq);
    const artifactResult = await artifactRes.json() as any;

    expect(artifactRes.status).toBe(200);
    expect(artifactResult.session.artifacts['result-file']).toBe('data...');
  });

  it('should return 404 for non-existent sessions', async () => {
    const response = await coordinator.fetch(new Request('http://localhost/swarm/non-existent'));
    expect(response.status).toBe(404);
  });
});
