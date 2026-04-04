import { beforeEach, describe, expect, it, vi } from 'vitest';

const discoveryHarness = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: discoveryHarness.existsSync,
  readFileSync: discoveryHarness.readFileSync,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: discoveryHarness.logInfo,
  logWarn: discoveryHarness.logWarn,
  logError: discoveryHarness.logError,
}));

describe('mcpDiscovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    discoveryHarness.existsSync.mockReset();
    discoveryHarness.readFileSync.mockReset();
    discoveryHarness.logInfo.mockReset();
    discoveryHarness.logWarn.mockReset();
    discoveryHarness.logError.mockReset();
  });

  it('should_return_empty_targets_when_config_file_is_missing_and_log_warning', async () => {
    discoveryHarness.existsSync.mockReturnValue(false);

    const { getDiscoveredTargets } = await import('../src/core/mcpDiscovery.js');

    expect(getDiscoveredTargets()).toEqual([]);
    expect(discoveryHarness.logWarn).toHaveBeenCalledWith(
      'McpDiscovery',
      expect.stringContaining('mcp_servers.json not found'),
    );
    expect(discoveryHarness.readFileSync).not.toHaveBeenCalled();
  });

  it('should_return_no_servers_when_config_is_malformed_and_log_parse_error', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue('{ invalid json');

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    expect(discoverMcpServers()).toEqual([]);
    expect(discoveryHarness.logError).toHaveBeenCalledWith(
      'McpDiscovery',
      expect.stringContaining('Failed to parse mcp_servers.json'),
    );
  });

  it('should_reuse_cached_results_when_called_again_before_ttl_expires', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync
      .mockReturnValueOnce(
        JSON.stringify([
          { name: 'alpha', command: 'node', args: ['alpha.js'], description: 'Alpha server' },
        ]),
      )
      .mockReturnValueOnce(
        JSON.stringify([{ name: 'beta', command: 'node', args: ['beta.js'], description: 'Beta server' }]),
      );

    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => 1_000);
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(1_000);

    const { discoverMcpServers, getDiscoveredTargets } = await import('../src/core/mcpDiscovery.js');

    const firstDiscovery = discoverMcpServers();
    const cachedTargets = getDiscoveredTargets();
    const secondDiscovery = discoverMcpServers();

    expect(firstDiscovery).toEqual([
      { name: 'alpha', command: 'node', args: ['alpha.js'], description: 'Alpha server' },
    ]);
    expect(cachedTargets).toEqual([
      {
        id: 'mcp:alpha',
        agentName: 'alpha',
        capability: 'mcp.invoke',
        description: 'Alpha server',
        available: true,
      },
    ]);
    expect(secondDiscovery).toEqual(firstDiscovery);
    expect(discoveryHarness.readFileSync).toHaveBeenCalledTimes(1);
    expect(discoveryHarness.logInfo).toHaveBeenCalledWith('McpDiscovery', 'Discovered 1 local MCP server(s)');

    nowSpy.mockRestore();
  });

  it('should_refresh_results_when_called_after_cache_ttl_expires', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync
      .mockReturnValueOnce(
        JSON.stringify([{ name: 'alpha', command: 'node', args: ['alpha.js'], description: 'Alpha server' }]),
      )
      .mockReturnValueOnce(
        JSON.stringify([{ name: 'beta', command: 'node', args: ['beta.js'], description: 'Beta server' }]),
      );

    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => 61_001);
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(61_001);

    const { discoverMcpServers, getTargetById } = await import('../src/core/mcpDiscovery.js');

    expect(discoverMcpServers()).toEqual([
      { name: 'alpha', command: 'node', args: ['alpha.js'], description: 'Alpha server' },
    ]);
    expect(discoverMcpServers()).toEqual([
      { name: 'beta', command: 'node', args: ['beta.js'], description: 'Beta server' },
    ]);
    expect(getTargetById('mcp:beta')).toEqual({
      id: 'mcp:beta',
      agentName: 'beta',
      capability: 'mcp.invoke',
      description: 'Beta server',
      available: true,
    });
    expect(discoveryHarness.readFileSync).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Additional coverage: non-array JSON, empty list, getTargetById edge cases
  // -------------------------------------------------------------------------

  it('should_return_empty_array_when_config_file_contains_json_object_not_array', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(JSON.stringify({ servers: [] }));

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    expect(discoverMcpServers()).toEqual([]);
    // JSON.parse does not throw; but .filter() on non-array throws → caught → logError
    expect(discoveryHarness.logError).toHaveBeenCalledWith(
      'McpDiscovery',
      expect.stringContaining('Failed to parse mcp_servers.json'),
    );
  });

  it('should_return_empty_array_when_config_file_contains_null_json', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue('null');

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    expect(discoverMcpServers()).toEqual([]);
    expect(discoveryHarness.logError).toHaveBeenCalledWith(
      'McpDiscovery',
      expect.stringContaining('Failed to parse mcp_servers.json'),
    );
  });

  it('should_return_empty_array_and_log_zero_when_config_is_valid_but_empty_array', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue('[]');

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    const result = discoverMcpServers();
    expect(result).toEqual([]);
    expect(discoveryHarness.logInfo).toHaveBeenCalledWith(
      'McpDiscovery',
      'Discovered 0 local MCP server(s)',
    );
  });

  it('should_re_read_config_on_second_call_when_first_returned_empty_array', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync
      .mockReturnValueOnce('[]')
      .mockReturnValueOnce(
        JSON.stringify([{ name: 'late-server', command: 'node', args: ['late.js'] }]),
      );

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    const first = discoverMcpServers();
    const second = discoverMcpServers();

    // _discovered.length === 0 after first call → cache NOT active → re-reads
    expect(discoveryHarness.readFileSync).toHaveBeenCalledTimes(2);
    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe('late-server');
  });

  it('should_not_re_read_file_within_ttl_when_servers_found_on_first_call', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([{ name: 'cached-server', command: 'node', args: ['s.js'] }]),
    );

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    discoverMcpServers(); // populates cache at t=1000

    nowSpy.mockReturnValue(1_000 + 30_000); // still within 60s TTL
    discoverMcpServers(); // should use cache

    expect(discoveryHarness.readFileSync).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it('should_return_undefined_when_getTargetById_called_with_nonexistent_id', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([{ name: 'my-server', command: 'node', args: ['s.js'], description: 'Test' }]),
    );

    const { getTargetById } = await import('../src/core/mcpDiscovery.js');

    expect(getTargetById('mcp:nonexistent')).toBeUndefined();
    expect(getTargetById('')).toBeUndefined();
    expect(getTargetById('my-server')).toBeUndefined(); // missing 'mcp:' prefix
  });

  it('should_return_correct_target_when_getTargetById_called_with_valid_mcp_prefixed_id', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([{ name: 'target-server', command: 'node', args: ['t.js'], description: 'My target server' }]),
    );

    const { getTargetById } = await import('../src/core/mcpDiscovery.js');

    const target = getTargetById('mcp:target-server');

    expect(target).toBeDefined();
    expect(target?.id).toBe('mcp:target-server');
    expect(target?.agentName).toBe('target-server');
    expect(target?.capability).toBe('mcp.invoke');
    expect(target?.description).toBe('My target server');
    expect(target?.available).toBe(true);
  });

  it('should_use_fallback_description_when_server_config_has_no_description_field', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([{ name: 'nodesc-server', command: 'node' }]),
    );

    const { getTargetById } = await import('../src/core/mcpDiscovery.js');

    const target = getTargetById('mcp:nodesc-server');

    expect(target?.description).toBe('MCP server: nodesc-server');
  });

  it('should_exclude_disabled_servers_from_getDiscoveredTargets_results', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([
        { name: 'active-server', command: 'node', args: ['a.js'] },
        { name: 'disabled-one',  command: 'node', disabled: true },
      ]),
    );

    const { getDiscoveredTargets } = await import('../src/core/mcpDiscovery.js');

    const targets = getDiscoveredTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('mcp:active-server');
    expect(targets.find(t => t.agentName === 'disabled-one')).toBeUndefined();
  });

  it('should_return_same_result_from_listServerConfigs_as_discoverMcpServers', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockReturnValue(
      JSON.stringify([
        { name: 'srv-a', command: 'node' },
        { name: 'srv-b', command: 'node', disabled: true },
      ]),
    );

    const { discoverMcpServers, listServerConfigs } = await import('../src/core/mcpDiscovery.js');

    const discovered = discoverMcpServers();
    const listed = listServerConfigs();

    // Both return identical filtered (non-disabled) configs from the same cache
    expect(listed).toEqual(discovered);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('srv-a');
  });

  it('should_not_crash_and_return_empty_when_readFileSync_throws_an_os_error', async () => {
    discoveryHarness.existsSync.mockReturnValue(true);
    discoveryHarness.readFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const { discoverMcpServers } = await import('../src/core/mcpDiscovery.js');

    let result: unknown;
    expect(() => { result = discoverMcpServers(); }).not.toThrow();
    expect(result).toEqual([]);
    expect(discoveryHarness.logError).toHaveBeenCalledWith(
      'McpDiscovery',
      expect.stringContaining('EACCES'),
    );
  });
});
