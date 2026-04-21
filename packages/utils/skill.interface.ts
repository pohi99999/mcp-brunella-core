export type BrunellaSkillCategory =
  | 'sales'
  | 'finance'
  | 'marketing'
  | 'devops'
  | 'research'
  | 'logistics'
  | 'studio';

export interface BrunellaSkillValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Brunella skill contract.
 *
 * A skill is a thin orchestration layer over existing tools, services, and
 * knowledge helpers. It exposes a stable metadata shape and a single async
 * execution entry point.
 */
export interface BrunellaSkill {
  name: string;
  description: string;
  version: string;
  category: BrunellaSkillCategory;
  tools: string[];
  agents?: string[];
  execute(params: Record<string, unknown>): Promise<unknown>;
  validate?(params: Record<string, unknown>): boolean;
  getValidationResult?(params: Record<string, unknown>): BrunellaSkillValidationResult;
}
