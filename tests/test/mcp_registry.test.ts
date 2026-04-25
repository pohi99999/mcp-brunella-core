import { describe, it, expect } from 'vitest';
import { resolveMcpPaths } from '../../src/server/McpProcessManager.js';

describe('MCP Path Resolution', () => {
  it('should replace {{PROJECT_ROOT}} token with actual root', () => {
    // Szimulált konfiguráció helyőrzővel
    const config = { 
      command: 'node', 
      args: ['{{PROJECT_ROOT}}/test.js'],
      env: { PATH: '{{PROJECT_ROOT}}/bin' }
    };
    
    const resolved = resolveMcpPaths(config);
    
    // Ellenőrizzük, hogy a helyőrző le lett-e cserélve
    expect(resolved.args[0]).not.toContain('{{PROJECT_ROOT}}');
    expect(resolved.env.PATH).not.toContain('{{PROJECT_ROOT}}');
    
    // Ellenőrizzük, hogy tartalmazza-e a projekt gyökerét (mcp-brunella-core)
    expect(resolved.args[0]).toContain('mcp-brunella-core');
    expect(resolved.env.PATH).toContain('mcp-brunella-core');
  });
});
