import { describe, it, expect, vi } from 'vitest';

// Mock AgentManager BEFORE importing swarmTools
vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { initialize: vi.fn() },
  swarmManager: {
    listColonies: vi.fn(() => [
      { swarmId: 'triad-default', name: 'Triad', status: 'active', agents: new Map(), leaderId: null,
        metrics: { tasksCompleted: 2, tasksFailed: 0, avgDurationMs: 50, throughput: 1, lastActivity: Date.now() } }
    ]),
    submitTask: vi.fn(async () => ({ status: 'success', result: 'done', durationMs: 100, agentId: 'researcher', taskId: 'task-1' })),
    nextTaskId: vi.fn(() => 'task-123'),
    getColony: vi.fn((id: string) => id === 'triad-default'
      ? { swarmId: id, name: 'Triad', status: 'active', agents: new Map(), leaderId: null }
      : undefined),
  }
}));

// Mock config/rag imports used by swarmTools
vi.mock('../src/config/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('../src/utils/rag.js', () => ({ addToIndex: vi.fn() }));

describe('swarmTools MCP registration', () => {
  it('registerSwarmTools registers swarm_dispatch, swarm_status, and swarm_ingest', async () => {
    const registeredTools: string[] = [];
    const mockServer = {
      tool: vi.fn((name: string) => { registeredTools.push(name); return mockServer; })
    };

    const { registerSwarmTools } = await import('../src/tools/swarmTools.js');
    registerSwarmTools(mockServer as any);

    expect(registeredTools).toContain('swarm_ingest');
    expect(registeredTools).toContain('swarm_dispatch');
    expect(registeredTools).toContain('swarm_status');
  });

  it('swarm_status returns colony list via handler', async () => {
    let statusHandler: (() => Promise<unknown>) | null = null;
    const mockServer = {
      tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: () => Promise<unknown>) => {
        if (name === 'swarm_status') statusHandler = handler;
        return mockServer;
      })
    };

    const { registerSwarmTools } = await import('../src/tools/swarmTools.js');
    registerSwarmTools(mockServer as any);

    expect(statusHandler).not.toBeNull();
    const result = await statusHandler!() as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(1);
    expect(parsed.colonies[0].name).toBe('Triad');
  });
});
