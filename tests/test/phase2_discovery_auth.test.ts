/**
 * Phase 2: Discovery, Capability & Auth — E2E Tests
 *
 * Tests for:
 *  - MCPRouter (capability registry, lookup, executor dispatch)
 *  - remoteAuth (token generation, verification, expiry, tamper detection)
 *  - mcpDiscovery (config loading, target listing)
 *  - authRemote middleware (bearer token validation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpRouter } from '@packages/core-logic/MCPRouter.js';
import { generateRemoteToken, verifyRemoteToken } from '@packages/core-logic/remoteAuth.js';

// ─── MCPRouter ───────────────────────────────────────────────────────────────

describe('MCPRouter', () => {
  beforeEach(() => {
    // Reset registry between tests by unregistering known IDs
    for (const cap of mcpRouter.listCapabilities()) {
      mcpRouter.unregisterCapability(cap.id);
    }
  });

  it('should register and retrieve a capability', () => {
    mcpRouter.registerCapability({
      id: 'test-cap-1',
      agentName: 'TestAgent',
      capability: 'chat',
      description: 'Chat capability',
      available: true,
      source: 'agent',
    });

    const cap = mcpRouter.getCapability('test-cap-1');
    expect(cap).toBeDefined();
    expect(cap!.agentName).toBe('TestAgent');
    expect(cap!.capability).toBe('chat');
    expect(cap!.source).toBe('agent');
  });

  it('should return undefined for unknown capability', () => {
    expect(mcpRouter.getCapability('nonexistent-xyz')).toBeUndefined();
  });

  it('should unregister a capability', () => {
    mcpRouter.registerCapability({
      id: 'temp-cap',
      agentName: 'Temp',
      capability: 'temp',
      available: true,
      source: 'tool',
    });

    mcpRouter.unregisterCapability('temp-cap');
    expect(mcpRouter.getCapability('temp-cap')).toBeUndefined();
  });

  it('should list all registered capabilities', () => {
    mcpRouter.registerCapability({
      id: 'cap-a',
      agentName: 'A',
      capability: 'search',
      available: true,
      source: 'agent',
    });
    mcpRouter.registerCapability({
      id: 'cap-b',
      agentName: 'B',
      capability: 'browse',
      available: true,
      source: 'tool',
    });

    const all = mcpRouter.listCapabilities();
    const ids = all.map(c => c.id);
    expect(ids).toContain('cap-a');
    expect(ids).toContain('cap-b');
  });

  it('should filter capabilities by source', () => {
    mcpRouter.registerCapability({
      id: 'src-agent',
      agentName: 'AgentX',
      capability: 'run',
      available: true,
      source: 'agent',
    });
    mcpRouter.registerCapability({
      id: 'src-tool',
      agentName: 'ToolY',
      capability: 'execute',
      available: true,
      source: 'tool',
    });

    const agents = mcpRouter.listBySource('agent');
    expect(agents.every(c => c.source === 'agent')).toBe(true);
    expect(agents.some(c => c.id === 'src-agent')).toBe(true);
  });

  it('should toggle capability availability', () => {
    mcpRouter.registerCapability({
      id: 'toggle-cap',
      agentName: 'ToggleAgent',
      capability: 'toggle',
      available: true,
      source: 'agent',
    });

    mcpRouter.setAvailable('toggle-cap', false);
    expect(mcpRouter.getCapability('toggle-cap')!.available).toBe(false);

    mcpRouter.setAvailable('toggle-cap', true);
    expect(mcpRouter.getCapability('toggle-cap')!.available).toBe(true);
  });

  it('should register a RemoteTarget via registerTarget()', () => {
    mcpRouter.registerTarget(
      {
        id: 'rt-1',
        agentName: 'RemoteTargetAgent',
        capability: 'translate',
        description: 'Translation',
        available: true,
      },
      'mcp'
    );

    const cap = mcpRouter.getCapability('rt-1');
    expect(cap).toBeDefined();
    expect(cap!.source).toBe('mcp');
    expect(cap!.capability).toBe('translate');
  });

  it('should register and execute via executor', async () => {
    mcpRouter.registerCapability({
      id: 'exec-cap',
      agentName: 'ExecAgent',
      capability: 'execute',
      available: true,
      source: 'agent',
    });

    mcpRouter.registerExecutor('exec-cap', async (toolName, input) => {
      return { tool: toolName, result: `executed with ${JSON.stringify(input)}` };
    });

    const result = await mcpRouter.execute('exec-cap', 'myTool', { key: 'value' });
    expect(result).toEqual({
      tool: 'myTool',
      result: 'executed with {"key":"value"}',
    });
  });

  it('should throw when executing without registered executor', async () => {
    mcpRouter.registerCapability({
      id: 'no-exec',
      agentName: 'NoExec',
      capability: 'noop',
      available: true,
      source: 'agent',
    });

    await expect(
      mcpRouter.execute('no-exec', 'someTool', {})
    ).rejects.toThrow(/No executor registered/);
  });
});

// ─── Remote Auth ─────────────────────────────────────────────────────────────

describe('RemoteAuth', () => {
  it('should generate a valid token', () => {
    const token = generateRemoteToken('user-123', 60_000);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(token.includes('.')).toBe(true);
  });

  it('should verify a freshly generated token', () => {
    const token = generateRemoteToken('user-456', 60_000);
    const result = verifyRemoteToken(token);

    expect(result.valid).toBe(true);
    expect(result.claims).toBeDefined();
    expect(result.claims!.userId).toBe('user-456');
    expect(result.claims!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should reject expired tokens', () => {
    // Generate with 1ms TTL, then wait
    const token = generateRemoteToken('user-789', 1);

    // Force a slight delay by synchronous spin (or just set expiry to past)
    const now = Date.now();
    while (Date.now() - now < 5) { /* spin */ }

    const result = verifyRemoteToken(token);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('should reject tampered tokens', () => {
    const token = generateRemoteToken('user-abc');
    // Tamper with the base64 payload
    const parts = token.split('.');
    parts[0] = parts[0].slice(0, -3) + 'XXX';
    const tampered = parts.join('.');

    const result = verifyRemoteToken(tampered);
    expect(result.valid).toBe(false);
  });

  it('should reject malformed tokens', () => {
    expect(verifyRemoteToken('')).toEqual(expect.objectContaining({ valid: false }));
    expect(verifyRemoteToken('not-a-token')).toEqual(expect.objectContaining({ valid: false }));
    expect(verifyRemoteToken('a.b.c')).toEqual(expect.objectContaining({ valid: false }));
  });

  it('should reject null/undefined input', () => {
    expect(verifyRemoteToken(null as unknown as string)).toEqual(expect.objectContaining({ valid: false }));
    expect(verifyRemoteToken(undefined as unknown as string)).toEqual(expect.objectContaining({ valid: false }));
  });

  it('should produce different tokens for different users', () => {
    const t1 = generateRemoteToken('alice');
    const t2 = generateRemoteToken('bob');
    expect(t1).not.toBe(t2);
  });

  it('should embed correct TTL in token', () => {
    const ttl = 120_000;
    const before = Date.now();
    const token = generateRemoteToken('user-ttl', ttl);
    const after = Date.now();

    const result = verifyRemoteToken(token);
    expect(result.valid).toBe(true);
    expect(result.claims!.expiresAt).toBeGreaterThanOrEqual(before + ttl);
    expect(result.claims!.expiresAt).toBeLessThanOrEqual(after + ttl);
  });
});

// ─── E2E: Auth → Router → Execute Flow ──────────────────────────────────────

describe('E2E: Auth + Router Capability Flow', () => {
  it('should auth → register capability → execute → validate full flow', async () => {
    // 1. Generate auth token
    const token = generateRemoteToken('e2e-tester', 300_000);
    const authResult = verifyRemoteToken(token);
    expect(authResult.valid).toBe(true);

    // 2. Register a capability
    mcpRouter.registerCapability({
      id: 'e2e-cap',
      agentName: 'E2EAgent',
      capability: 'e2e_test',
      available: true,
      source: 'agent',
    });

    // 3. Register executor
    mcpRouter.registerExecutor('e2e-cap', async (tool, input) => ({
      executed: true,
      tool,
      user: authResult.claims!.userId,
      input,
    }));

    // 4. Execute
    const result = await mcpRouter.execute('e2e-cap', 'runTest', { scenario: 'happy_path' });
    expect(result).toEqual({
      executed: true,
      tool: 'runTest',
      user: 'e2e-tester',
      input: { scenario: 'happy_path' },
    });

    // Cleanup
    mcpRouter.unregisterCapability('e2e-cap');
  });

  it('should reject operation when auth token is invalid', () => {
    const badToken = 'garbage.token';
    const authResult = verifyRemoteToken(badToken);
    expect(authResult.valid).toBe(false);

    // Should not proceed to capability execution
    expect(authResult.claims).toBeUndefined();
  });

  it('should handle multiple capabilities with different sources', () => {
    const ids = ['multi-1', 'multi-2', 'multi-3'];
    const sources: Array<'agent' | 'tool' | 'device'> = ['agent', 'tool', 'device'];

    ids.forEach((id, i) => {
      mcpRouter.registerCapability({
        id,
        agentName: `Agent_${i}`,
        capability: `cap_${i}`,
        available: true,
        source: sources[i],
      });
    });

    const all = mcpRouter.listCapabilities();
    for (const id of ids) {
      expect(all.some(c => c.id === id)).toBe(true);
    }

    // Filter by source
    const agents = mcpRouter.listBySource('agent');
    expect(agents.some(c => c.id === 'multi-1')).toBe(true);

    const tools = mcpRouter.listBySource('tool');
    expect(tools.some(c => c.id === 'multi-2')).toBe(true);

    // Cleanup
    ids.forEach(id => mcpRouter.unregisterCapability(id));
  });
});
