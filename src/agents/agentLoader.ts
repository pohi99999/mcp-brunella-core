import type { IAgent } from './types.js';

export type AgentConstructor = new (config?: Record<string, unknown>) => IAgent;

export interface ResolvedAgentExport {
  AgentClass: AgentConstructor;
  exportName: string;
  strategy: 'class-name' | 'default' | 'first-constructable';
  availableExports: string[];
}

function isConstructableAgent(value: unknown): value is AgentConstructor {
  return typeof value === 'function';
}

export function resolveAgentExport(
  moduleExports: Record<string, unknown>,
  expectedClassName?: string,
): ResolvedAgentExport {
  const availableExports = Object.keys(moduleExports);

  if (expectedClassName) {
    const namedCandidate = moduleExports[expectedClassName];
    if (isConstructableAgent(namedCandidate)) {
      return {
        AgentClass: namedCandidate,
        exportName: expectedClassName,
        strategy: 'class-name',
        availableExports,
      };
    }
  }

  const defaultCandidate = moduleExports.default;
  if (isConstructableAgent(defaultCandidate)) {
    return {
      AgentClass: defaultCandidate,
      exportName: 'default',
      strategy: 'default',
      availableExports,
    };
  }

  const firstConstructable = Object.entries(moduleExports).find(
    ([exportName, value]) => exportName !== 'default' && isConstructableAgent(value),
  );

  if (firstConstructable) {
    const [exportName, candidate] = firstConstructable as [string, AgentConstructor];
    return {
      AgentClass: candidate,
      exportName,
      strategy: 'first-constructable',
      availableExports,
    };
  }

  const expectedLabel = expectedClassName
    ? ` Expected class export: ${expectedClassName}.`
    : '';
  const exportsLabel = availableExports.length > 0
    ? availableExports.join(', ')
    : '<none>';

  throw new Error(
    `No constructable agent export found.${expectedLabel} Available exports: ${exportsLabel}`,
  );
}