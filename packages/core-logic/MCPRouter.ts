/**
 * MCP Router — Capability Registry
 * Phase 1 (skeleton) + Phase 2 (capability registration & lookup)
 *
 * Maintains a registry of available capabilities from:
 *  - Statically configured local MCP servers (mcpDiscovery)
 *  - Dynamically registered agents and tools via registerCapability()
 */

import { logInfo, logWarn } from '@packages/utils/logger.js';
import { getDiscoveredTargets } from './mcpDiscovery.js';
import type { RemoteTarget } from './types/remote.js';

export interface RegisteredCapability {
  id: string;
  agentName: string;
  capability: string;
  description?: string;
  available: boolean;
  source: 'mcp' | 'agent' | 'tool' | 'device';
  registeredAt: number;
  metadata?: Record<string, unknown>;
}

export type CapabilityExecutor = (toolName: string, input: Record<string, unknown>) => Promise<unknown>;

class McpRouter {
  private registry = new Map<string, RegisteredCapability>();
  private executors = new Map<string, CapabilityExecutor>();

  /**
   * Register a capability explicitly (agent, tool, device)
   */
  registerCapability(entry: Omit<RegisteredCapability, 'registeredAt'>): void {
    const capability: RegisteredCapability = {
      ...entry,
      registeredAt: Date.now(),
    };
    this.registry.set(entry.id, capability);
    logInfo('McpRouter', `Registered capability: ${entry.id} (${entry.capability}) from ${entry.source}`);
  }

  /**
   * De-register a capability
   */
  unregisterCapability(id: string): void {
    if (this.registry.delete(id)) {
      logInfo('McpRouter', `Unregistered capability: ${id}`);
    }
  }

  /**
   * Look up a capability by ID
   */
  getCapability(id: string): RegisteredCapability | undefined {
    // Check explicit registry first
    const explicit = this.registry.get(id);
    if (explicit) return explicit;

    // Fall back to discovered MCP targets
    const discovered = getDiscoveredTargets().find(t => t.id === id);
    if (discovered) {
      return {
        ...discovered,
        source: 'mcp',
        registeredAt: 0,
      };
    }
    return undefined;
  }

  /**
   * List all capabilities (registry + discovered MCP targets merged, deduplicated)
   */
  listCapabilities(): RegisteredCapability[] {
    const discovered = getDiscoveredTargets().map<RegisteredCapability>(t => ({
      ...t,
      source: 'mcp' as const,
      registeredAt: 0,
    }));

    const result = new Map<string, RegisteredCapability>();

    // Discovered are base layer
    for (const d of discovered) {
      result.set(d.id, d);
    }

    // Explicit registrations override
    for (const [id, cap] of this.registry.entries()) {
      result.set(id, cap);
    }

    return Array.from(result.values());
  }

  /**
   * List capabilities filtered by source type
   */
  listBySource(source: RegisteredCapability['source']): RegisteredCapability[] {
    return this.listCapabilities().filter(c => c.source === source);
  }

  /**
   * Update availability of a capability
   */
  setAvailable(id: string, available: boolean): void {
    const cap = this.registry.get(id);
    if (cap) {
      cap.available = available;
      logInfo('McpRouter', `Capability ${id} availability: ${available}`);
    } else {
      logWarn('McpRouter', `setAvailable: capability ${id} not in registry`);
    }
  }

  /**
   * Convert a RemoteTarget to a RegisteredCapability and register it
   */
  registerTarget(target: RemoteTarget, source: RegisteredCapability['source'] = 'mcp'): void {
    this.registerCapability({
      id: target.id,
      agentName: target.agentName,
      capability: target.capability,
      description: target.description,
      available: target.available,
      source,
    });
  }
  /**
   * Register an executor function for a capability so it can dispatch tool calls
   */
  registerExecutor(id: string, executor: CapabilityExecutor): void {
    this.executors.set(id, executor);
    logInfo('McpRouter', `Executor registered for capability: ${id}`);
  }

  /**
   * Dispatch a tool call to the registered executor for the given capability ID
   */
  async execute(id: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const executor = this.executors.get(id);
    if (!executor) {
      throw new Error(`No executor registered for capability '${id}'. Register one via mcpRouter.registerExecutor().`);
    }
    return executor(toolName, input);
  }
}

export const mcpRouter = new McpRouter();

