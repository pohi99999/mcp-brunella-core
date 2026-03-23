/**
 * Dynamic Tool Registry — Runtime tool publication, versioning, and metrics
 * Track #6: MCP Tool Discovery & Composability — Phase 1
 *
 * Enables agents to dynamically register/deregister MCP tools at runtime.
 * Tracks per-tool metrics (call count, latency, error rate) and supports
 * semver versioning with deprecation.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';
import { z, type ZodTypeAny } from 'zod';

// --- Interfaces ---

export interface ToolManifest {
  id: string;
  name: string;
  version: string;                  // semver: "1.0.0"
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  publishedBy: string;              // agent name
  tags: string[];
  deprecated?: boolean;
  deprecatedMessage?: string;
  timeout?: number;                 // ms
  retryConfig?: {
    maxRetries: number;
    backoff: 'linear' | 'exponential';
  };
  composable?: {
    chainable: boolean;
    outputType: string;             // 'code' | 'text' | 'json' | 'file'
  };
}

export interface ToolMetrics {
  toolId: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastUsed: number;                 // timestamp
  lastError?: string;
  latencyHistory: number[];         // last 100 latencies for p95 calculation
}

export interface ToolRegistryEntry {
  manifest: ToolManifest;
  metrics: ToolMetrics;
  registeredAt: number;
  handler?: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolFilter {
  tags?: string[];
  publishedBy?: string;
  name?: string;
  deprecated?: boolean;
  version?: string;                 // semver range (simple prefix match for now)
}

// --- Semver Utilities ---

function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function semverSatisfies(version: string, range: string): boolean {
  const ver = parseSemver(version);
  if (!ver) return false;

  // Exact match
  if (!range.startsWith('^') && !range.startsWith('~')) {
    const rangeVer = parseSemver(range);
    return rangeVer !== null && ver[0] === rangeVer[0] && ver[1] === rangeVer[1] && ver[2] === rangeVer[2];
  }

  const rangeVer = parseSemver(range.substring(1));
  if (!rangeVer) return false;

  if (range.startsWith('^')) {
    // ^1.2.3 → >=1.2.3 <2.0.0 (same major)
    if (ver[0] !== rangeVer[0]) return false;
    if (ver[1] > rangeVer[1]) return true;
    if (ver[1] === rangeVer[1] && ver[2] >= rangeVer[2]) return true;
    return false;
  }

  if (range.startsWith('~')) {
    // ~1.2.3 → >=1.2.3 <1.3.0 (same major.minor)
    if (ver[0] !== rangeVer[0] || ver[1] !== rangeVer[1]) return false;
    return ver[2] >= rangeVer[2];
  }

  return false;
}

function semverCompare(a: string, b: string): number {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

// --- Dynamic Tool Registry ---

export class DynamicToolRegistry extends EventEmitter {
  private tools = new Map<string, ToolRegistryEntry>();
  private static _instance: DynamicToolRegistry | null = null;

  static getInstance(): DynamicToolRegistry {
    if (!DynamicToolRegistry._instance) {
      DynamicToolRegistry._instance = new DynamicToolRegistry();
    }
    return DynamicToolRegistry._instance;
  }

  /**
   * Register a tool with the dynamic registry
   */
  registerTool(manifest: ToolManifest, handler?: (args: Record<string, unknown>) => Promise<unknown>): boolean {
    // Validate manifest
    if (!manifest.id || !manifest.name || !manifest.version) {
      logWarn('DynamicToolRegistry', `Invalid manifest: missing required fields (id=${manifest.id})`);
      return false;
    }
    if (!parseSemver(manifest.version)) {
      logWarn('DynamicToolRegistry', `Invalid semver for tool ${manifest.id}: ${manifest.version}`);
      return false;
    }

    const existing = this.tools.get(manifest.id);
    if (existing) {
      // Version upgrade: only allow same or higher version
      if (semverCompare(manifest.version, existing.manifest.version) < 0) {
        logWarn('DynamicToolRegistry', `Cannot downgrade tool ${manifest.id} from ${existing.manifest.version} to ${manifest.version}`);
        return false;
      }
    }

    const entry: ToolRegistryEntry = {
      manifest,
      metrics: existing?.metrics ?? {
        toolId: manifest.id,
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        lastUsed: 0,
        latencyHistory: [],
      },
      registeredAt: Date.now(),
      handler,
    };

    this.tools.set(manifest.id, entry);
    logInfo('DynamicToolRegistry', `Tool registered: ${manifest.name}@${manifest.version} by ${manifest.publishedBy} [${manifest.tags.join(',')}]`);
    this.emit('tool:registered', manifest);

    if (manifest.deprecated) {
      logWarn('DynamicToolRegistry', `Tool ${manifest.id} is deprecated: ${manifest.deprecatedMessage ?? 'no reason given'}`);
    }

    return true;
  }

  /**
   * Deregister a tool
   */
  deregisterTool(toolId: string): boolean {
    const entry = this.tools.get(toolId);
    if (!entry) return false;

    this.tools.delete(toolId);
    logInfo('DynamicToolRegistry', `Tool deregistered: ${entry.manifest.name}@${entry.manifest.version}`);
    this.emit('tool:deregistered', entry.manifest);
    return true;
  }

  /**
   * Discover tools matching a filter
   */
  discoverTools(filter?: ToolFilter): ToolManifest[] {
    let results = Array.from(this.tools.values()).map(e => e.manifest);

    if (!filter) return results;

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(m => filter.tags!.some(t => m.tags.includes(t)));
    }
    if (filter.publishedBy) {
      results = results.filter(m => m.publishedBy === filter.publishedBy);
    }
    if (filter.name) {
      const nameLower = filter.name.toLowerCase();
      results = results.filter(m => m.name.toLowerCase().includes(nameLower));
    }
    if (filter.deprecated !== undefined) {
      results = results.filter(m => (m.deprecated ?? false) === filter.deprecated);
    }
    if (filter.version) {
      results = results.filter(m => semverSatisfies(m.version, filter.version!));
    }

    return results;
  }

  /**
   * Resolve the best matching version of a tool by name
   */
  resolveVersion(toolName: string, versionRange: string): ToolManifest | null {
    const candidates = Array.from(this.tools.values())
      .filter(e => e.manifest.name === toolName && semverSatisfies(e.manifest.version, versionRange))
      .sort((a, b) => semverCompare(b.manifest.version, a.manifest.version));

    return candidates[0]?.manifest ?? null;
  }

  /**
   * Record a tool call for metrics
   */
  recordCall(toolId: string, success: boolean, latencyMs: number, error?: string): void {
    const entry = this.tools.get(toolId);
    if (!entry) return;

    const m = entry.metrics;
    m.totalCalls++;
    if (success) {
      m.successCalls++;
    } else {
      m.errorCalls++;
      m.lastError = error;
    }
    m.lastUsed = Date.now();

    // Rolling latency history (keep last 100)
    m.latencyHistory.push(latencyMs);
    if (m.latencyHistory.length > 100) {
      m.latencyHistory.shift();
    }

    // Recalculate avg and p95
    const sum = m.latencyHistory.reduce((a, b) => a + b, 0);
    m.avgLatencyMs = sum / m.latencyHistory.length;

    const sorted = [...m.latencyHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    m.p95LatencyMs = sorted[p95Index] ?? m.avgLatencyMs;

    if (entry.manifest.deprecated) {
      logWarn('DynamicToolRegistry', `Deprecated tool called: ${entry.manifest.name} — ${entry.manifest.deprecatedMessage ?? 'consider migrating'}`);
    }
  }

  /**
   * Get metrics for a specific tool
   */
  getMetrics(toolId: string): ToolMetrics | null {
    return this.tools.get(toolId)?.metrics ?? null;
  }

  /**
   * Get all tool metrics
   */
  getAllMetrics(): ToolMetrics[] {
    return Array.from(this.tools.values()).map(e => ({
      ...e.metrics,
      latencyHistory: [],  // omit large array in bulk response
    }));
  }

  /**
   * Get a tool entry by ID
   */
  getTool(toolId: string): ToolRegistryEntry | null {
    return this.tools.get(toolId) ?? null;
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    deprecatedTools: number;
    totalCalls: number;
    avgLatencyMs: number;
    publishers: string[];
  } {
    let totalCalls = 0;
    let totalLatency = 0;
    let callsWithLatency = 0;
    const publishers = new Set<string>();
    let deprecated = 0;

    for (const entry of this.tools.values()) {
      totalCalls += entry.metrics.totalCalls;
      if (entry.metrics.totalCalls > 0) {
        totalLatency += entry.metrics.avgLatencyMs * entry.metrics.totalCalls;
        callsWithLatency += entry.metrics.totalCalls;
      }
      publishers.add(entry.manifest.publishedBy);
      if (entry.manifest.deprecated) deprecated++;
    }

    return {
      totalTools: this.tools.size,
      deprecatedTools: deprecated,
      totalCalls,
      avgLatencyMs: callsWithLatency > 0 ? totalLatency / callsWithLatency : 0,
      publishers: Array.from(publishers),
    };
  }

  /** Clear all tools (for testing) */
  clear(): void {
    this.tools.clear();
  }
}

// Convenience singleton accessor
export function getDynamicToolRegistry(): DynamicToolRegistry {
  return DynamicToolRegistry.getInstance();
}

// Helper: convert ToolManifest to MCP-compatible tool definition
export function manifestToMcpTool(manifest: ToolManifest): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
} {
  let inputSchema: Record<string, unknown>;
  try {
    // Try to extract JSON schema from Zod
    if (manifest.inputSchema && typeof (manifest.inputSchema as { _def?: unknown })._def === 'object') {
      // Simplified: create basic object schema from Zod type
      inputSchema = {
        type: 'object',
        properties: { task: { type: 'string', description: 'Input for the tool' } },
        required: ['task'],
      };
    } else {
      inputSchema = {
        type: 'object',
        properties: { task: { type: 'string', description: 'Input for the tool' } },
        required: ['task'],
      };
    }
  } catch {
    inputSchema = {
      type: 'object',
      properties: { task: { type: 'string', description: 'Input for the tool' } },
      required: ['task'],
    };
  }

  const desc = manifest.deprecated
    ? `[DEPRECATED: ${manifest.deprecatedMessage ?? 'use alternative'}] ${manifest.description}`
    : manifest.description;

  return {
    name: manifest.name,
    description: `${desc} (v${manifest.version} by ${manifest.publishedBy})`,
    inputSchema,
  };
}
