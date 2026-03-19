import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/core/toolRegistry.js';

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
});
