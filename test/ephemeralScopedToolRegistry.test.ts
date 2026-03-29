import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DynamicToolRegistry } from '../src/core/dynamicToolRegistry.js';
import { createScopedToolRegistryView } from '../src/core/ephemeralScopedToolRegistry.js';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../src/core/auditLog.js', () => ({
  record: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/security/safe_zone_validator.js', () => ({
  getSafeZoneValidator: () => ({ validate: vi.fn().mockReturnValue(true) }),
}));

describe('EphemeralScopedToolRegistry', () => {
  it('filters visible tools and executes only scoped handlers', async () => {
    const registry = new DynamicToolRegistry();

    registry.registerTool({
      id: 'tool-a',
      name: 'tool-a',
      version: '1.0.0',
      description: 'Tool A',
      inputSchema: z.object({}),
      publishedBy: 'tester',
      tags: ['test'],
    }, async () => ({ ok: 'a' }));

    registry.registerTool({
      id: 'tool-b',
      name: 'tool-b',
      version: '1.0.0',
      description: 'Tool B',
      inputSchema: z.object({}),
      publishedBy: 'tester',
      tags: ['test'],
    }, async () => ({ ok: 'b' }));

    const view = createScopedToolRegistryView({
      id: 'ephemeral-1',
      spec: {
        parentAgentName: 'ParentAgent',
        allowedTools: ['tool-a'],
      },
    }, registry);

    expect(view.listVisibleTools().map((tool) => tool.id)).toEqual(['tool-a']);
    await expect(view.callTool('tool-a', {})).resolves.toEqual({ ok: 'a' });
    await expect(view.callTool('tool-b', {})).rejects.toThrow(/not in the allowed tool list/i);
  });
});