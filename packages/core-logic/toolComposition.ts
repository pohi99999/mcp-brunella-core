/**
 * Tool Composition — Chain tools together with schema compatibility
 * Track #6: MCP Tool Discovery & Composability — Phase 2+3
 *
 * Enables defining tool chains where the output of one tool feeds into the next.
 * Supports macro tools (chain → single MCP tool registration).
 */

import { logInfo, logWarn, logError } from '@packages/utils/logger.js';
import { getDynamicToolRegistry, type ToolManifest } from './dynamicToolRegistry.js';

export interface ChainStep {
  toolId: string;
  version?: string;              // semver range for resolution
  transform?: (output: unknown) => unknown;  // optional output → input transform
  label?: string;
}

export interface ToolChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  tags: string[];
  createdBy: string;
}

export interface ChainExecutionResult {
  chainId: string;
  success: boolean;
  stepResults: Array<{
    toolId: string;
    success: boolean;
    output: unknown;
    latencyMs: number;
    error?: string;
  }>;
  finalOutput: unknown;
  totalLatencyMs: number;
}

/**
 * Validate that all tools in a chain exist in the registry
 */
export function validateChain(chain: ToolChain): { valid: boolean; errors: string[] } {
  const registry = getDynamicToolRegistry();
  const errors: string[] = [];

  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    const tool = registry.getTool(step.toolId);

    if (!tool) {
      // Try version resolution if a version range is specified
      if (step.version) {
        const resolved = registry.resolveVersion(step.toolId, step.version);
        if (!resolved) {
          errors.push(`Step ${i}: tool "${step.toolId}" version "${step.version}" not found`);
        }
      } else {
        errors.push(`Step ${i}: tool "${step.toolId}" not registered`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Execute a tool chain sequentially, passing output → input between steps
 */
export async function executeChain(
  chain: ToolChain,
  initialInput: unknown,
): Promise<ChainExecutionResult> {
  const registry = getDynamicToolRegistry();
  const start = Date.now();
  const stepResults: ChainExecutionResult['stepResults'] = [];
  let currentInput = initialInput;

  for (const step of chain.steps) {
    const stepStart = Date.now();
    const entry = registry.getTool(step.toolId);

    if (!entry?.handler) {
      const error = `Tool "${step.toolId}" has no handler`;
      logWarn('ToolComposition', error);
      stepResults.push({
        toolId: step.toolId,
        success: false,
        output: null,
        latencyMs: Date.now() - stepStart,
        error,
      });

      return {
        chainId: chain.id,
        success: false,
        stepResults,
        finalOutput: null,
        totalLatencyMs: Date.now() - start,
      };
    }

    try {
      const input = typeof currentInput === 'object' && currentInput !== null
        ? currentInput as Record<string, unknown>
        : { task: String(currentInput) };

      const output = await entry.handler(input);
      const latencyMs = Date.now() - stepStart;

      registry.recordCall(step.toolId, true, latencyMs);

      // Apply transform if provided
      currentInput = step.transform ? step.transform(output) : output;

      stepResults.push({
        toolId: step.toolId,
        success: true,
        output: currentInput,
        latencyMs,
      });

      logInfo('ToolComposition', `Chain "${chain.id}" step "${step.toolId}" completed (${latencyMs}ms)`);
    } catch (err: unknown) {
      const latencyMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      registry.recordCall(step.toolId, false, latencyMs, errorMsg);

      stepResults.push({
        toolId: step.toolId,
        success: false,
        output: null,
        latencyMs,
        error: errorMsg,
      });

      logError('ToolComposition', `Chain "${chain.id}" failed at step "${step.toolId}": ${errorMsg}`);

      return {
        chainId: chain.id,
        success: false,
        stepResults,
        finalOutput: null,
        totalLatencyMs: Date.now() - start,
      };
    }
  }

  logInfo('ToolComposition', `Chain "${chain.id}" completed: ${chain.steps.length} steps, ${Date.now() - start}ms total`);

  return {
    chainId: chain.id,
    success: true,
    stepResults,
    finalOutput: currentInput,
    totalLatencyMs: Date.now() - start,
  };
}

/**
 * Create a tool chain definition
 */
export function createChain(config: {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  tags?: string[];
  createdBy: string;
}): ToolChain {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    steps: config.steps,
    tags: config.tags ?? [],
    createdBy: config.createdBy,
  };
}

