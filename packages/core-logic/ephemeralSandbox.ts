import { record as auditRecord } from './auditLog.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { getSafeZoneValidator } from '@packages/core-logic/safe_zone_validator.js';
import { NetworkPolicy } from './sandbox/networkPolicy.js';
import { logWarn } from '@packages/utils/logger.js';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallRequest {
  /** ID of the ephemeral agent making the call */
  agentId: string;
  /** Name of the tool being requested */
  toolName: string;
  /** Alternative tool identifiers, e.g. manifest name + id */
  toolAliases?: string[];
  /** Parent agent name (for audit trail) */
  parentAgentName: string;
}

export interface FileAccessRequest {
  agentId: string;
  parentAgentName: string;
  filePath: string;
  operation: 'read' | 'write' | 'delete' | 'execute' | 'append';
  toolName?: string;
}

export interface NetworkAccessRequest {
  agentId: string;
  parentAgentName: string;
  url: string;
  toolName?: string;
}

export interface ToolChainScopeRequest {
  agentId: string;
  parentAgentName: string;
  chainId: string;
  stepToolNames: string[];
}

export interface SandboxVerdict {
  allowed: boolean;
  reason: string;
  scope: 'tool' | 'file' | 'network' | 'composition';
}

// ============================================================================
// SANDBOX
// ============================================================================

class EphemeralSandbox {
  private readonly safeZoneValidator = getSafeZoneValidator();

  private isToolAllowed(allowedTools: string[], toolName: string, deniedTools?: string[], aliases?: string[]): boolean {
    const candidates = [toolName, ...(aliases ?? [])];
    const matches = (configured: string) => configured === '*' || candidates.includes(configured);
    const allowed = allowedTools.some(matches);
    if (!allowed) {
      return false;
    }

    return !(deniedTools ?? []).some(matches);
  }

  private isWithinAllowedPaths(allowedPaths: string[], targetPath: string): boolean {
    const normalizedTarget = path.resolve(targetPath);

    return allowedPaths.some((allowedPath) => {
      const normalizedAllowed = path.resolve(allowedPath);
      const relative = path.relative(normalizedAllowed, normalizedTarget);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  private async recordViolation(input: {
    agentId: string;
    parentAgentName: string;
    violationType: 'tool' | 'file' | 'network' | 'composition';
    toolName?: string;
    allowedTools?: string[];
    target?: string;
    reason: string;
    chainId?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const action = `ephemeral:${input.violationType}:${input.toolName ?? input.chainId ?? 'scope'}`;
    const resource = input.target ?? input.toolName ?? input.chainId ?? `ephemeral:${input.agentId}`;

    logWarn(
      'EphemeralSandbox',
      `Agent ${input.agentId} ${input.violationType} violation: ${input.reason}`,
    );

    phoenixEventBus.publish('phoenix:ephemeral_tool_violation', {
      agentId: input.agentId,
      parentAgentName: input.parentAgentName,
      toolName: input.toolName ?? input.chainId ?? input.violationType,
      allowedTools: input.allowedTools ?? [],
      violationType: input.violationType,
      target: input.target,
      reason: input.reason,
      chainId: input.chainId,
      timestamp: now,
    });

    await auditRecord(
      'DENIED',
      `ephemeral:${input.agentId}`,
      action,
      resource,
      input.reason,
    );
  }

  /**
   * Check whether a tool call is permitted for a given ephemeral agent.
   *
   * If the tool is not in the allowed list:
   *  - logs a warning
   *  - publishes a phoenix:ephemeral_tool_violation event
   *  - records a DENIED entry in the audit log
   *
   * Returns a SandboxVerdict indicating whether the call is allowed.
   */
  checkToolAccess(allowedTools: string[], request: ToolCallRequest, deniedTools?: string[]): SandboxVerdict {
    if (this.isToolAllowed(allowedTools, request.toolName, deniedTools, request.toolAliases)) {
      return { allowed: true, reason: 'Tool is in the allowed list', scope: 'tool' };
    }

    void this.recordViolation({
      agentId: request.agentId,
      parentAgentName: request.parentAgentName,
      violationType: 'tool',
      toolName: request.toolName,
      allowedTools,
      reason: `Tool not in allowedTools for ephemeral agent ${request.agentId} (parent: ${request.parentAgentName})`,
    });

    return {
      allowed: false,
      reason: `Tool '${request.toolName}' is not in the allowed tool list for ephemeral agent ${request.agentId}`,
      scope: 'tool',
    };
  }

  checkFileAccess(allowedPaths: string[] | undefined, request: FileAccessRequest): SandboxVerdict {
    const scope = allowedPaths ?? [];

    if (scope.length === 0) {
      void this.recordViolation({
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        violationType: 'file',
        toolName: request.toolName,
        target: request.filePath,
        reason: `No file scopes assigned for ephemeral agent ${request.agentId}`,
      });

      return {
        allowed: false,
        reason: `File access denied for ${request.filePath}: no allowedPaths configured`,
        scope: 'file',
      };
    }

    if (!this.isWithinAllowedPaths(scope, request.filePath)) {
      void this.recordViolation({
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        violationType: 'file',
        toolName: request.toolName,
        target: request.filePath,
        reason: `Path outside ephemeral file scope: ${request.filePath}`,
      });

      return {
        allowed: false,
        reason: `File access denied for ${request.filePath}: outside ephemeral allowedPaths`,
        scope: 'file',
      };
    }

    const safeZoneAllowed = this.safeZoneValidator.validate(
      request.filePath,
      request.operation,
      {
        scope: 'ephemeral',
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        toolName: request.toolName,
      },
    );

    if (!safeZoneAllowed) {
      void this.recordViolation({
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        violationType: 'file',
        toolName: request.toolName,
        target: request.filePath,
        reason: `Safe Zone denied ${request.operation} on ${request.filePath}`,
      });

      return {
        allowed: false,
        reason: `File access denied for ${request.filePath}: blocked by Safe Zone policy`,
        scope: 'file',
      };
    }

    return {
      allowed: true,
      reason: 'File path is within assigned scope and Safe Zone policy',
      scope: 'file',
    };
  }

  checkNetworkAccess(allowedHosts: string[] | undefined, request: NetworkAccessRequest): SandboxVerdict {
    const scope = allowedHosts ?? [];

    if (scope.length === 0) {
      void this.recordViolation({
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        violationType: 'network',
        toolName: request.toolName,
        target: request.url,
        reason: `No network scopes assigned for ephemeral agent ${request.agentId}`,
      });

      return {
        allowed: false,
        reason: `Network access denied for ${request.url}: no allowedHosts configured`,
        scope: 'network',
      };
    }

    const policy = new NetworkPolicy({
      mode: 'whitelist',
      whitelist: scope,
      blacklist: [],
      blockMetadataEndpoints: true,
      blockPrivateNetworks: true,
      blockLocalhost: true,
      logDenials: true,
      maxRequestsPerMinute: 100,
    });

    const result = policy.checkAccess(request.url);
    if (!result.allowed) {
      void this.recordViolation({
        agentId: request.agentId,
        parentAgentName: request.parentAgentName,
        violationType: 'network',
        toolName: request.toolName,
        target: request.url,
        reason: result.reason,
      });

      return {
        allowed: false,
        reason: `Network access denied for ${request.url}: ${result.reason}`,
        scope: 'network',
      };
    }

    return {
      allowed: true,
      reason: 'Network target is within assigned host scope',
      scope: 'network',
    };
  }

  checkToolComposition(
    allowedTools: string[],
    request: ToolChainScopeRequest,
    deniedTools?: string[],
  ): SandboxVerdict {
    const violatingTool = request.stepToolNames.find(
      (toolName) => !this.isToolAllowed(allowedTools, toolName, deniedTools),
    );

    if (!violatingTool) {
      return {
        allowed: true,
        reason: 'Every tool in the chain is within the assigned scope',
        scope: 'composition',
      };
    }

    void this.recordViolation({
      agentId: request.agentId,
      parentAgentName: request.parentAgentName,
      violationType: 'composition',
      toolName: violatingTool,
      allowedTools,
      chainId: request.chainId,
      reason: `Tool chain contains disallowed step '${violatingTool}'`,
      target: request.chainId,
    });

    return {
      allowed: false,
      reason: `Tool chain '${request.chainId}' contains disallowed tool '${violatingTool}'`,
      scope: 'composition',
    };
  }
}

export const ephemeralSandbox = new EphemeralSandbox();

export default ephemeralSandbox;

