/**
 * MCP Discovery Module
 * Phase 2: Discovery, Capability & Auth
 *
 * Reads configured MCP servers from mcp_servers.json and registers them
 * as discoverable RemoteTargets with capability metadata.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { logInfo, logWarn, logError } from '@packages/utils/logger.js';
import type { RemoteTarget } from './types/remote.js';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  description?: string;
  disabled?: boolean;
}

export interface DiscoveredCapability {
  serverId: string;
  serverName: string;
  toolName: string;
  description?: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'mcp_servers.json');

let _discovered: McpServerConfig[] = [];
let _lastDiscovery = 0;
const CACHE_TTL_MS = 60_000; // re-read config every minute

/**
 * Load and parse mcp_servers.json
 */
function loadServerConfigs(): McpServerConfig[] {
  if (!existsSync(CONFIG_PATH)) {
    logWarn('McpDiscovery', `mcp_servers.json not found at ${CONFIG_PATH}`);
    return [];
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const configs: McpServerConfig[] = JSON.parse(raw);
    return configs.filter(c => !c.disabled);
  } catch (e: unknown) {
    logError('McpDiscovery', `Failed to parse mcp_servers.json: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/**
 * Run discovery and refresh cache if stale
 */
export function discoverMcpServers(): McpServerConfig[] {
  const now = Date.now();
  if (now - _lastDiscovery > CACHE_TTL_MS || _discovered.length === 0) {
    _discovered = loadServerConfigs();
    _lastDiscovery = now;
    logInfo('McpDiscovery', `Discovered ${_discovered.length} local MCP server(s)`);
  }
  return _discovered;
}

/**
 * Map discovered MCP servers to RemoteTarget descriptors
 */
export function getDiscoveredTargets(): RemoteTarget[] {
  const servers = discoverMcpServers();
  return servers.map(s => ({
    id: `mcp:${s.name}`,
    agentName: s.name,
    // Each discovered server exposes a generic "invoke" capability
    capability: 'mcp.invoke',
    description: s.description ?? `MCP server: ${s.name}`,
    available: true,
  }));
}

/**
 * Get a single target by serverId (mcp:<name>)
 */
export function getTargetById(targetId: string): RemoteTarget | undefined {
  return getDiscoveredTargets().find(t => t.id === targetId);
}

/**
 * List raw server configs (for admin / capability endpoint)
 */
export function listServerConfigs(): McpServerConfig[] {
  return discoverMcpServers();
}

