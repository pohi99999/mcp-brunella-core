/**
 * Tool Composition Tests — Track #6 Phase 2-3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { z } from 'zod';
import { DynamicToolRegistry, type ToolManifest } from '../../src/core/dynamicToolRegistry.js';

// We need to mock getDynamicToolRegistry to return our test instance
let testRegistry: DynamicToolRegistry;

vi.mock('../../src/core/dynamicToolRegistry.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/core/dynamicToolRegistry.js')>('../../src/core/dynamicToolRegistry.js');
  return {
    ...actual,
    getDynamicToolRegistry: () => testRegistry,
  };
});

import { validateChain, executeChain, createChain, type ToolChain } from '../../src/core/toolComposition.js';

function createTestManifest(id: string, name: string): ToolManifest {
  return {
    id,
    name,
    version: '1.0.0',
    description: `Test tool ${name}`,
    inputSchema: z.object({ task: z.string() }),
    publishedBy: 'TestAgent',
    tags: ['test'],
  };
}

describe('Tool Composition', () => {
  beforeEach(() => {
    testRegistry = new DynamicToolRegistry();
  });

  describe('validateChain', () => {
    it('validates a chain where all tools exist', () => {
      testRegistry.registerTool(createTestManifest('read-file', 'read_file'));
      testRegistry.registerTool(createTestManifest('analyze', 'analyze_code'));

      const chain = createChain({
        id: 'test-chain',
        name: 'Test Chain',
        description: 'test',
        steps: [{ toolId: 'read-file' }, { toolId: 'analyze' }],
        createdBy: 'test',
      });

      const result = validateChain(chain);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports missing tools', () => {
      const chain = createChain({
        id: 'broken-chain',
        name: 'Broken',
        description: 'missing tools',
        steps: [{ toolId: 'nonexistent' }],
        createdBy: 'test',
      });

      const result = validateChain(chain);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('nonexistent');
    });
  });

  describe('executeChain', () => {
    it('executes steps sequentially passing output to next input', async () => {
      testRegistry.registerTool(
        createTestManifest('step1', 'step_1'),
        async (args) => ({ result: `processed-${(args as Record<string, string>).task}` }),
      );
      testRegistry.registerTool(
        createTestManifest('step2', 'step_2'),
        async (args) => ({ final: `done-${JSON.stringify(args)}` }),
      );

      const chain = createChain({
        id: 'exec-chain',
        name: 'Exec',
        description: 'test execution',
        steps: [{ toolId: 'step1' }, { toolId: 'step2' }],
        createdBy: 'test',
      });

      const result = await executeChain(chain, { task: 'hello' });
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(true);
    });

    it('stops chain on error and returns partial results', async () => {
      testRegistry.registerTool(
        createTestManifest('good', 'good_tool'),
        async () => ({ data: 'ok' }),
      );
      testRegistry.registerTool(
        createTestManifest('bad', 'bad_tool'),
        async () => { throw new Error('tool broke'); },
      );
      testRegistry.registerTool(
        createTestManifest('never', 'never_reached'),
        async () => ({ data: 'should not run' }),
      );

      const chain = createChain({
        id: 'error-chain',
        name: 'Error',
        description: 'test error',
        steps: [{ toolId: 'good' }, { toolId: 'bad' }, { toolId: 'never' }],
        createdBy: 'test',
      });

      const result = await executeChain(chain, 'start');
      expect(result.success).toBe(false);
      expect(result.stepResults).toHaveLength(2); // good + bad, never not reached
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(false);
      expect(result.stepResults[1].error).toContain('tool broke');
    });

    it('applies transform between steps', async () => {
      testRegistry.registerTool(
        createTestManifest('producer', 'producer'),
        async () => ({ items: [1, 2, 3] }),
      );
      testRegistry.registerTool(
        createTestManifest('consumer', 'consumer'),
        async (args) => ({ count: Object.keys(args).length }),
      );

      const chain = createChain({
        id: 'transform-chain',
        name: 'Transform',
        description: 'test transform',
        steps: [
          {
            toolId: 'producer',
            transform: (output) => {
              const items = (output as { items: number[] }).items;
              return { task: `process ${items.length} items` };
            },
          },
          { toolId: 'consumer' },
        ],
        createdBy: 'test',
      });

      const result = await executeChain(chain, 'start');
      expect(result.success).toBe(true);
    });

    it('fails when tool has no handler', async () => {
      testRegistry.registerTool(createTestManifest('no-handler', 'no_handler'));

      const chain = createChain({
        id: 'nohandler-chain',
        name: 'NoHandler',
        description: 'missing handler',
        steps: [{ toolId: 'no-handler' }],
        createdBy: 'test',
      });

      const result = await executeChain(chain, 'input');
      expect(result.success).toBe(false);
      expect(result.stepResults[0].error).toContain('no handler');
    });
  });

  describe('createChain', () => {
    it('creates a chain with defaults', () => {
      const chain = createChain({
        id: 'ch1',
        name: 'My Chain',
        description: 'desc',
        steps: [{ toolId: 't1' }],
        createdBy: 'agent',
      });

      expect(chain.tags).toEqual([]);
      expect(chain.steps).toHaveLength(1);
    });
  });
});
