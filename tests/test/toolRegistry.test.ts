import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../src/core/toolRegistry.js';
import { executeLocalTool } from '../src/server/toolRegistry.js';
import { globalPermissionManager, Permission } from '../src/agents/permissions.js';
import { normalizeToolInputSchema } from '../src/server/registry.js';

describe('ToolRegistry', () => {
  it('should load tools from registry.json on init', async () => {
    const registry = new ToolRegistry();
    await registry.init();
    const tools = registry.getToolDefinitions();
    expect(tools.length).toBeGreaterThan(40); // 47+ agents
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('parameters');
    registry.destroy();
  });

  it('should include system tools', async () => {
    const registry = new ToolRegistry();
    await registry.init();
    const tools = registry.getToolDefinitions();
    const names = tools.map(t => t.name);
    expect(names).toContain('get_system_status');
    expect(names).toContain('run_full_test_suite');
    expect(names).toContain('list_active_tasks');
    expect(names).toContain('get_agent_logs');
    registry.destroy();
  });

  it('should prefix agent tools with delegate_', async () => {
    const registry = new ToolRegistry();
    await registry.init();
    const tools = registry.getToolDefinitions();
    const agentTools = tools.filter(t => t.name.startsWith('delegate_'));
    expect(agentTools.length).toBeGreaterThan(40);
    registry.destroy();
  });

  it('should fail fast when a local tool handler is missing', async () => {
    await expect(executeLocalTool('missing-tool', {})).rejects.toThrow('Tool handler not registered: missing-tool');
  });

  it('should deny unmapped tools for non-admin agent contexts', async () => {
    vi.resetModules();
    const toolRegistry = await import('../src/server/toolRegistry.js');

    toolRegistry.registerToolHandler('dangerous_unmapped_tool', async () => 'ok');
    globalPermissionManager.registerAgent('LimitedAgent', {
      permissions: [Permission.READ_FILE],
      pathRestrictions: { allowed: ['**/*'], denied: [] },
    });

    await expect(
      toolRegistry.executeLocalTool('dangerous_unmapped_tool', {}, { agentName: 'LimitedAgent' }),
    ).rejects.toThrow('not explicitly allowlisted');
  });

  it('should build registered tool metadata without recursively importing the registry', async () => {
    vi.resetModules();
    const toolRegistry = await import('../src/server/toolRegistry.js');

    toolRegistry.registerToolDefinition({
      name: 'health_probe',
      description: 'Monitor backend health',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          verbose: { type: 'boolean' },
        },
        required: ['target'],
      },
    });

    const tools = toolRegistry.getRegisteredToolsList();

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'health_probe',
          name: 'health_probe',
          category: 'monitoring',
          enabled: true,
          parameters: expect.arrayContaining([
            { name: 'target', type: 'string', required: true },
            { name: 'verbose', type: 'boolean', required: false },
          ]),
        }),
      ]),
    );
  });
 
  it('should normalize plain zod field maps into JSON schema', async () => {
    const { zodToJsonSchema } = await import('zod-to-json-schema');
    const schema = normalizeToolInputSchema({
      dir_path: z.string().describe('Workspace path'),
      verbose: z.boolean().optional(),
    }, zodToJsonSchema);

    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(schema.properties).toHaveProperty('dir_path');
    expect(schema.properties).toHaveProperty('verbose');
    expect(schema.required).toContain('dir_path');
    expect(schema.required).not.toContain('verbose');
  });
});
