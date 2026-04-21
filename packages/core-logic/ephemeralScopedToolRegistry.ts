import {
  DynamicToolRegistry,
  getDynamicToolRegistry,
  type ToolManifest,
  type ToolRegistryEntry,
} from './dynamicToolRegistry.js';
import { ephemeralSandbox } from './ephemeralSandbox.js';

export interface EphemeralScopedRegistryRecord {
  id: string;
  spec: {
    allowedTools: string[];
    deniedTools?: string[];
    allowedPaths?: string[];
    allowedHosts?: string[];
    parentAgentName: string;
  };
}

function matchesTool(toolName: string, manifest: ToolManifest): boolean {
  return toolName === '*' || toolName === manifest.id || toolName === manifest.name;
}

function isToolVisible(record: EphemeralScopedRegistryRecord, manifest: ToolManifest): boolean {
  const allowed = record.spec.allowedTools.some((toolName) => matchesTool(toolName, manifest));
  if (!allowed) {
    return false;
  }

  const deniedTools = record.spec.deniedTools ?? [];
  return !deniedTools.some((toolName) => matchesTool(toolName, manifest));
}

export class EphemeralScopedToolRegistry {
  constructor(
    private readonly record: EphemeralScopedRegistryRecord,
    private readonly registry: DynamicToolRegistry = getDynamicToolRegistry(),
  ) {}

  listVisibleTools(): ToolManifest[] {
    return this.registry
      .getAll()
      .map((entry) => entry.manifest)
      .filter((manifest) => isToolVisible(this.record, manifest));
  }

  getTool(toolId: string): ToolRegistryEntry | null {
    const entry = this.registry.getTool(toolId);
    if (!entry) {
      return null;
    }

    return isToolVisible(this.record, entry.manifest) ? entry : null;
  }

  canAccessTool(toolId: string): boolean {
    return this.getTool(toolId) !== null;
  }

  async callTool(toolId: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.registry.getTool(toolId);
    const manifest = entry?.manifest;
    const toolName = manifest?.id ?? toolId;

    const verdict = ephemeralSandbox.checkToolAccess(
      this.record.spec.allowedTools,
      {
        agentId: this.record.id,
        toolName,
        toolAliases: manifest ? [manifest.id, manifest.name] : undefined,
        parentAgentName: this.record.spec.parentAgentName,
      },
      this.record.spec.deniedTools,
    );

    if (!verdict.allowed) {
      throw new Error(verdict.reason);
    }

    if (!entry?.handler) {
      throw new Error(`Tool handler not available: ${toolId}`);
    }

    return entry.handler(args);
  }

  describeCapabilities(): {
    allowedTools: string[];
    deniedTools: string[];
    allowedPaths: string[];
    allowedHosts: string[];
    visibleToolIds: string[];
  } {
    const visibleToolIds = this.listVisibleTools().map((manifest) => manifest.id);

    return {
      allowedTools: [...this.record.spec.allowedTools],
      deniedTools: [...(this.record.spec.deniedTools ?? [])],
      allowedPaths: [...(this.record.spec.allowedPaths ?? [])],
      allowedHosts: [...(this.record.spec.allowedHosts ?? [])],
      visibleToolIds,
    };
  }
}

export function createScopedToolRegistryView(
  record: EphemeralScopedRegistryRecord,
  registry?: DynamicToolRegistry,
): EphemeralScopedToolRegistry {
  return new EphemeralScopedToolRegistry(record, registry ?? getDynamicToolRegistry());
}