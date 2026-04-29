/**
 * Dynamic Tool Registry Tests — Track #6 Phase 1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { z } from 'zod';
import {
  DynamicToolRegistry,
  manifestToMcpTool,
  type ToolManifest,
} from '@packages/core-logic/dynamicToolRegistry.js';

function createManifest(overrides: Partial<ToolManifest> = {}): ToolManifest {
  return {
    id: 'test-tool-1',
    name: 'test_tool',
    version: '1.0.0',
    description: 'A test tool',
    inputSchema: z.object({ task: z.string() }),
    publishedBy: 'TestAgent',
    tags: ['test', 'unit'],
    ...overrides,
  };
}

describe('DynamicToolRegistry', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    registry = new DynamicToolRegistry();
  });

  describe('registerTool', () => {
    it('registers a valid tool', () => {
      const result = registry.registerTool(createManifest());
      expect(result).toBe(true);
      expect(registry.getAll()).toHaveLength(1);
    });

    it('rejects manifest without id', () => {
      const result = registry.registerTool(createManifest({ id: '' }));
      expect(result).toBe(false);
    });

    it('rejects invalid semver', () => {
      const result = registry.registerTool(createManifest({ version: 'not-semver' }));
      expect(result).toBe(false);
    });

    it('allows version upgrade', () => {
      registry.registerTool(createManifest({ version: '1.0.0' }));
      const result = registry.registerTool(createManifest({ version: '1.1.0' }));
      expect(result).toBe(true);

      const tool = registry.getTool('test-tool-1');
      expect(tool!.manifest.version).toBe('1.1.0');
    });

    it('rejects version downgrade', () => {
      registry.registerTool(createManifest({ version: '2.0.0' }));
      const result = registry.registerTool(createManifest({ version: '1.0.0' }));
      expect(result).toBe(false);
    });

    it('emits tool:registered event', () => {
      const handler = vi.fn();
      registry.on('tool:registered', handler);
      registry.registerTool(createManifest());
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('deregisterTool', () => {
    it('removes an existing tool', () => {
      registry.registerTool(createManifest());
      expect(registry.deregisterTool('test-tool-1')).toBe(true);
      expect(registry.getAll()).toHaveLength(0);
    });

    it('returns false for non-existent tool', () => {
      expect(registry.deregisterTool('nonexistent')).toBe(false);
    });

    it('emits tool:deregistered event', () => {
      const handler = vi.fn();
      registry.on('tool:deregistered', handler);
      registry.registerTool(createManifest());
      registry.deregisterTool('test-tool-1');
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('discoverTools', () => {
    beforeEach(() => {
      registry.registerTool(createManifest({ id: 't1', name: 'code_review', tags: ['code', 'review'], publishedBy: 'CodeAgent' }));
      registry.registerTool(createManifest({ id: 't2', name: 'test_runner', tags: ['test', 'ci'], publishedBy: 'TestAgent' }));
      registry.registerTool(createManifest({ id: 't3', name: 'deploy_tool', tags: ['deploy'], publishedBy: 'CodeAgent', deprecated: true }));
    });

    it('returns all tools without filter', () => {
      expect(registry.discoverTools()).toHaveLength(3);
    });

    it('filters by tags', () => {
      const results = registry.discoverTools({ tags: ['code'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('code_review');
    });

    it('filters by publisher', () => {
      const results = registry.discoverTools({ publishedBy: 'CodeAgent' });
      expect(results).toHaveLength(2);
    });

    it('filters by name substring', () => {
      const results = registry.discoverTools({ name: 'deploy' });
      expect(results).toHaveLength(1);
    });

    it('filters by deprecated status', () => {
      const results = registry.discoverTools({ deprecated: true });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('deploy_tool');
    });
  });

  describe('resolveVersion', () => {
    beforeEach(() => {
      registry.registerTool(createManifest({ id: 'v100', name: 'my_tool', version: '1.0.0' }));
      registry.registerTool(createManifest({ id: 'v120', name: 'my_tool', version: '1.2.0' }));
      registry.registerTool(createManifest({ id: 'v200', name: 'my_tool', version: '2.0.0' }));
    });

    it('resolves ^1.0.0 to latest 1.x', () => {
      const result = registry.resolveVersion('my_tool', '^1.0.0');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.2.0');
    });

    it('resolves ~1.0.0 to latest 1.0.x', () => {
      const result = registry.resolveVersion('my_tool', '~1.0.0');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.0');
    });

    it('returns null for unsatisfiable range', () => {
      const result = registry.resolveVersion('my_tool', '^3.0.0');
      expect(result).toBeNull();
    });
  });

  describe('recordCall & metrics', () => {
    beforeEach(() => {
      registry.registerTool(createManifest());
    });

    it('tracks successful calls', () => {
      registry.recordCall('test-tool-1', true, 100);
      registry.recordCall('test-tool-1', true, 200);

      const metrics = registry.getMetrics('test-tool-1');
      expect(metrics!.totalCalls).toBe(2);
      expect(metrics!.successCalls).toBe(2);
      expect(metrics!.avgLatencyMs).toBe(150);
    });

    it('tracks errors', () => {
      registry.recordCall('test-tool-1', false, 50, 'timeout');

      const metrics = registry.getMetrics('test-tool-1');
      expect(metrics!.errorCalls).toBe(1);
      expect(metrics!.lastError).toBe('timeout');
    });

    it('calculates p95 latency', () => {
      for (let i = 0; i < 100; i++) {
        registry.recordCall('test-tool-1', true, i < 95 ? 100 : 1000);
      }

      const metrics = registry.getMetrics('test-tool-1');
      expect(metrics!.p95LatencyMs).toBeGreaterThan(500);
    });

    it('returns null metrics for unknown tool', () => {
      expect(registry.getMetrics('nonexistent')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns aggregate statistics', () => {
      registry.registerTool(createManifest({ id: 't1', publishedBy: 'A' }));
      registry.registerTool(createManifest({ id: 't2', publishedBy: 'B', deprecated: true }));
      registry.recordCall('t1', true, 100);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(2);
      expect(stats.deprecatedTools).toBe(1);
      expect(stats.totalCalls).toBe(1);
      expect(stats.publishers).toContain('A');
      expect(stats.publishers).toContain('B');
    });
  });

  describe('manifestToMcpTool', () => {
    it('converts manifest to MCP format', () => {
      const manifest = createManifest();
      const mcpTool = manifestToMcpTool(manifest);

      expect(mcpTool.name).toBe('test_tool');
      expect(mcpTool.description).toContain('v1.0.0');
      expect(mcpTool.description).toContain('TestAgent');
      expect(mcpTool.inputSchema).toHaveProperty('type', 'object');
    });

    it('marks deprecated tools in description', () => {
      const manifest = createManifest({ deprecated: true, deprecatedMessage: 'Use v2 instead' });
      const mcpTool = manifestToMcpTool(manifest);

      expect(mcpTool.description).toContain('[DEPRECATED');
      expect(mcpTool.description).toContain('Use v2 instead');
    });
  });
});
