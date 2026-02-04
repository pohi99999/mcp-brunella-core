/**
 * BaseAgent - Alaposztály az AgentContext/AgentResult használó ügynököknek
 * EdgeProxyAgent, ProjectConductorAgent öröklik
 */

export interface AgentContext {
  task?: string;
  [key: string]: unknown;
}

export interface AgentResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract role: string;

  abstract execute(context: AgentContext): Promise<AgentResult>;
}
