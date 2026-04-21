import { StoryCutAgent } from '@packages/agents/StoryCutAgent.js';
import { captureValidationResult, type SkillParams } from './skill-helpers.js';
import type { BrunellaSkill } from './skill.interface.js';

function validateRoughCutSkill(_params: SkillParams) {
  return captureValidationResult(() => {});
}

export const RoughCutSkill: BrunellaSkill = {
  name: 'rough-cut',
  description: 'Rough-cut timeline tervet general fashion promo assetekbol.',
  version: '1.0.0',
  category: 'studio',
  tools: ['studio_timeline_plan'],
  agents: ['StoryCut'],
  validate(params: SkillParams): boolean {
    return validateRoughCutSkill(params).valid;
  },
  getValidationResult: validateRoughCutSkill,
  async execute(params: SkillParams): Promise<unknown> {
    const agent = new StoryCutAgent();
    return agent.executeTask({ task: 'rough-cut', payload: params });
  },
};

export default RoughCutSkill;

